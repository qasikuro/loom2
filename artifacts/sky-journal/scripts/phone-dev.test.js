'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const http = require('node:http');
const net = require('node:net');
const { PassThrough } = require('node:stream');
const test = require('node:test');
const { buildExpoEnvironment, parseQuickTunnelOrigin, runPhoneDevelopment } = require('./dev-phone');
const { createPhoneGateway, isApiPath } = require('./phone-gateway');

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve(server.address().port);
    });
  });
}

function close(server) {
  return new Promise((resolve) => {
    if (!server.listening) return resolve();
    server.close(() => resolve());
    server.closeAllConnections?.();
  });
}

test('routes only /api and /api/* to API; other paths go to Expo', () => {
  assert.equal(isApiPath('/api'), true);
  assert.equal(isApiPath('/api?x=1'), true);
  assert.equal(isApiPath('/api/users/1'), true);
  assert.equal(isApiPath('/apian'), false);
  assert.equal(isApiPath('/'), false);
});

test('HTTP gateway preserves authorization/cookies and routes API separately from Metro', async (t) => {
  const received = [];
  const api = http.createServer((request, response) => {
    received.push({
      service: 'api',
      url: request.url,
      authorization: request.headers.authorization,
      cookie: request.headers.cookie,
      forwarded: request.headers.forwarded,
      forwardedFor: request.headers['x-forwarded-for'],
      realIp: request.headers['x-real-ip'],
      forwardedHost: request.headers['x-forwarded-host'],
      forwardedProto: request.headers['x-forwarded-proto'],
    });
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ service: 'api' }));
  });
  const expo = http.createServer((request, response) => {
    received.push({ service: 'expo', url: request.url });
    response.end('metro');
  });
  const apiPort = await listen(api);
  const expoPort = await listen(expo);
  const gateway = createPhoneGateway({ apiPort, expoPort });
  const gatewayPort = await gateway.listen(0);
  t.after(async () => {
    await gateway.close();
    await Promise.all([close(api), close(expo)]);
  });

  const apiResponse = await fetch(`http://127.0.0.1:${gatewayPort}/api/users?limit=2`, {
    headers: {
      authorization: 'Bearer test-token',
      cookie: 'session=test-cookie',
      forwarded: 'for=203.0.113.10',
      'x-forwarded-for': '203.0.113.10',
      'x-real-ip': '203.0.113.10',
      'cf-connecting-ip': '198.51.100.22',
    },
  });
  assert.deepEqual(await apiResponse.json(), { service: 'api' });
  const metroResponse = await fetch(`http://127.0.0.1:${gatewayPort}/_expo/manifest?platform=ios`);
  assert.equal(await metroResponse.text(), 'metro');
  assert.deepEqual(received[0], {
    service: 'api',
    url: '/api/users?limit=2',
    authorization: 'Bearer test-token',
    cookie: 'session=test-cookie',
    forwarded: undefined,
    forwardedFor: '198.51.100.22',
    realIp: undefined,
    forwardedHost: `127.0.0.1:${gatewayPort}`,
    forwardedProto: 'https',
  });
  assert.equal(received[1].service, 'expo');
  assert.equal(received[1].url, '/_expo/manifest?platform=ios');

  await fetch(`http://127.0.0.1:${gatewayPort}/api/check-ip`, {
    headers: {
      'x-forwarded-for': '203.0.113.10',
      'cf-connecting-ip': 'not-an-ip',
    },
  });
  assert.equal(received[2].forwardedFor, undefined);
});

test('gateway streams SSE chunks without waiting for the event stream to end', async (t) => {
  const api = http.createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    response.write('data: first\n\n');
    setTimeout(() => {
      response.write('data: second\n\n');
      response.end();
    }, 200);
  });
  const apiPort = await listen(api);
  const expo = http.createServer((_request, response) => response.end('expo'));
  const expoPort = await listen(expo);
  const gateway = createPhoneGateway({ apiPort, expoPort });
  const gatewayPort = await gateway.listen(0);
  t.after(async () => {
    await gateway.close();
    await Promise.all([close(api), close(expo)]);
  });

  const response = await fetch(`http://127.0.0.1:${gatewayPort}/api/events`);
  assert.equal(response.headers.get('content-type'), 'text/event-stream');
  const reader = response.body.getReader();
  const first = await reader.read();
  assert.equal(first.done, false);
  assert.match(new TextDecoder().decode(first.value), /data: first\n\n/);
  const second = await reader.read();
  assert.match(new TextDecoder().decode(second.value), /data: second\n\n/);
  assert.equal(second.done, false);
  assert.equal((await reader.read()).done, true);
});

test('gateway proxies Metro websocket upgrades', async (t) => {
  let receivedForwardedHeaders;
  const expo = http.createServer();
  expo.on('upgrade', (request, socket, head) => {
    assert.equal(request.url, '/message?role=ios');
    assert.equal(request.headers.upgrade, 'websocket');
    receivedForwardedHeaders = {
      forwarded: request.headers.forwarded,
      forwardedFor: request.headers['x-forwarded-for'],
      realIp: request.headers['x-real-ip'],
    };
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      'Sec-WebSocket-Accept: test-accept\r\n\r\n',
    );
    if (head.length) socket.write(head);
    socket.on('data', (data) => {
      socket.write(data);
      socket.end();
    });
  });
  const expoPort = await listen(expo);
  const api = http.createServer((_request, response) => response.end('api'));
  const apiPort = await listen(api);
  const gateway = createPhoneGateway({ apiPort, expoPort });
  const gatewayPort = await gateway.listen(0);
  t.after(async () => {
    await gateway.close();
    await Promise.all([close(api), close(expo)]);
  });

  const response = await new Promise((resolve, reject) => {
    const socket = net.connect(gatewayPort, '127.0.0.1');
    let text = '';
    let sentPayload = false;
    socket.setTimeout(2000, () => reject(new Error('websocket upgrade timed out')));
    socket.on('connect', () => socket.write(
      'GET /message?role=ios HTTP/1.1\r\n' +
      `Host: 127.0.0.1:${gatewayPort}\r\n` +
      'Connection: Upgrade\r\n' +
      'Upgrade: websocket\r\n' +
      'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n' +
      'Forwarded: for=203.0.113.10\r\n' +
      'X-Forwarded-For: 203.0.113.10\r\n' +
      'X-Real-IP: 203.0.113.10\r\n' +
      'CF-Connecting-IP: 198.51.100.33\r\n' +
      'Sec-WebSocket-Version: 13\r\n\r\n',
    ));
    socket.on('data', (chunk) => {
      text += chunk.toString();
      if (!sentPayload && text.includes('\r\n\r\n')) {
        sentPayload = true;
        socket.write('websocket-test-payload');
      }
    });
    socket.on('end', () => resolve(text));
    socket.on('error', reject);
  });
  assert.match(response, /^HTTP\/1\.1 101 Switching Protocols/);
  assert.match(response, /Sec-WebSocket-Accept: test-accept/i);
  assert.deepEqual(receivedForwardedHeaders, {
    forwarded: undefined,
    forwardedFor: '198.51.100.33',
    realIp: undefined,
  });
});

test('malformed HTTP and WebSocket targets receive 400 and gateway remains healthy', async (t) => {
  const api = http.createServer((_request, response) => response.end('api-healthy'));
  const apiPort = await listen(api);
  const expo = http.createServer((_request, response) => response.end('expo-healthy'));
  const expoPort = await listen(expo);
  const gateway = createPhoneGateway({ apiPort, expoPort });
  const gatewayPort = await gateway.listen(0);
  t.after(async () => {
    await gateway.close();
    await Promise.all([close(api), close(expo)]);
  });

  const rawRequest = (requestText) => new Promise((resolve, reject) => {
    const socket = net.connect(gatewayPort, '127.0.0.1');
    let result = '';
    socket.setTimeout(2000, () => reject(new Error('malformed-target response timed out')));
    socket.on('connect', () => socket.write(requestText));
    socket.on('data', (chunk) => { result += chunk.toString(); });
    socket.on('end', () => resolve(result));
    socket.on('error', reject);
  });

  const malformedHttp = await rawRequest(
    `GET http://127.0.0.1:${apiPort}/api/users HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n`,
  );
  assert.match(malformedHttp, /^HTTP\/1\.1 400 Bad Request/);
  const invalidPercentPath = await rawRequest(
    `GET /bad%ZZ HTTP/1.1\r\nHost: localhost:${gatewayPort}\r\nConnection: close\r\n\r\n`,
  );
  assert.match(invalidPercentPath, /^HTTP\/1\.1 400 Bad Request/);
  const malformedWebSocket = await rawRequest(
    `GET http://127.0.0.1:${expoPort}/message HTTP/1.1\r\n` +
    `Host: localhost:${gatewayPort}\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n` +
    'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n',
  );
  assert.match(malformedWebSocket, /^HTTP\/1\.1 400 Bad Request/);

  const healthy = await fetch(`http://127.0.0.1:${gatewayPort}/api/health`);
  assert.equal(await healthy.text(), 'api-healthy');
});

test('gateway shutdown closes active Metro WebSockets before resolving', async (t) => {
  let upstreamSocket;
  let resolveUpstreamClosed;
  const upstreamClosed = new Promise((resolve) => { resolveUpstreamClosed = resolve; });
  const expo = http.createServer();
  expo.on('upgrade', (_request, socket) => {
    upstreamSocket = socket;
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\nConnection: Upgrade\r\n\r\n',
    );
    socket.on('end', () => socket.end());
    socket.once('close', resolveUpstreamClosed);
  });
  const expoPort = await listen(expo);
  const api = http.createServer((_request, response) => response.end('api'));
  const apiPort = await listen(api);
  const gateway = createPhoneGateway({ apiPort, expoPort });
  const gatewayPort = await gateway.listen(0);
  t.after(async () => {
    await gateway.close();
    await Promise.all([close(api), close(expo)]);
  });

  const clientSocket = net.connect(gatewayPort, '127.0.0.1');
  const handshake = new Promise((resolve, reject) => {
    clientSocket.once('data', resolve);
    clientSocket.once('error', reject);
  });
  clientSocket.write(
    `GET /message HTTP/1.1\r\nHost: localhost:${gatewayPort}\r\n` +
    'Connection: Upgrade\r\nUpgrade: websocket\r\n' +
    'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n' +
    'Sec-WebSocket-Version: 13\r\n\r\n',
  );
  const handshakeData = await handshake;
  assert.match(handshakeData.toString(), /^HTTP\/1\.1 101 Switching Protocols/);

  const clientClosed = new Promise((resolve) => clientSocket.once('close', resolve));
  await gateway.close();
  await Promise.all([clientClosed, upstreamClosed]);
  assert.equal(upstreamSocket.destroyed, true);
});

test('tunnel URL and Expo environment configure phone networking without altering Clerk proxy settings', () => {
  assert.equal(
    parseQuickTunnelOrigin('INFO Tunnel ready at https://abc-123.trycloudflare.com'),
    'https://abc-123.trycloudflare.com',
  );
  assert.equal(parseQuickTunnelOrigin('https://example.com'), null);
  assert.equal(parseQuickTunnelOrigin('https://abc.trycloudflare.com.evil.example'), null);
  const env = buildExpoEnvironment({
    PORT: '19000',
    CLERK_PUBLISHABLE_KEY: 'pk_test_public_value',
    EXPO_PUBLIC_CLERK_PROXY_URL: 'https://clerk-proxy.example',
    CLERK_SECRET_KEY: 'secret-not-logged',
    REPL_ID: 'repl-id',
  }, 'https://abc-123.trycloudflare.com');
  assert.equal(env.EXPO_PACKAGER_PROXY_URL, 'https://abc-123.trycloudflare.com');
  assert.equal(env.EXPO_PUBLIC_DOMAIN, 'abc-123.trycloudflare.com');
  assert.equal(env.EXPO_PUBLIC_API_URL, 'https://abc-123.trycloudflare.com/api');
  assert.equal(env.REACT_NATIVE_PACKAGER_HOSTNAME, 'abc-123.trycloudflare.com');
  assert.equal(env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY, 'pk_test_public_value');
  assert.equal(env.EXPO_PUBLIC_CLERK_PROXY_URL, 'https://clerk-proxy.example');
  assert.equal(env.CLERK_SECRET_KEY, 'secret-not-logged');
  assert.throws(() => buildExpoEnvironment({}, 'https://example.com'), /trycloudflare\.com/);
});

test('launcher starts Expo with the managed port and tunnel environment, then shuts down cloudflared', async () => {
  class FakeChild extends EventEmitter {
    constructor() {
      super();
      this.stdout = new PassThrough();
      this.stderr = new PassThrough();
      this.exitCode = null;
      this.killed = false;
    }

    kill() {
      if (this.exitCode !== null) return false;
      this.killed = true;
      this.exitCode = 0;
      this.emit('close', 0, null);
      return true;
    }
  }

  const calls = [];
  const logs = [];
  const spawnProcess = (command, args, options) => {
    const child = new FakeChild();
    calls.push({ command, args, options, child });
    if (command === 'cloudflared') {
      setImmediate(() => child.stderr.write('Quick Tunnel: https://phone-test.trycloudflare.com\n'));
    } else {
      setImmediate(() => {
        child.exitCode = 0;
        child.emit('close', 0, null);
      });
    }
    return child;
  };

  const result = await runPhoneDevelopment({
    env: {
      PORT: '19000',
      CLERK_PUBLISHABLE_KEY: 'pk_test_public_value',
      CLERK_SECRET_KEY: 'secret-never-log',
      EXPO_PUBLIC_CLERK_PROXY_URL: 'https://clerk-proxy.example',
      REPL_ID: 'repl-id',
    },
    cwd: '/project',
    spawnProcess,
    log: { log: (message) => logs.push(message), error: (message) => logs.push(message) },
    shutdownTimeoutMs: 20,
  });

  assert.equal(result, 0);
  assert.equal(calls[0].command, 'cloudflared');
  assert.deepEqual(calls[0].args.slice(0, 2), ['tunnel', '--url']);
  assert.match(calls[0].args[2], /^http:\/\/127\.0\.0\.1:\d+$/);
  assert.deepEqual(calls[0].args.slice(3), ['--protocol', 'http2', '--edge-ip-version', '4', '--no-autoupdate']);
  assert.deepEqual(calls[1].args, ['exec', 'expo', 'start', '--localhost', '--port', '19000', '--go']);
  assert.equal(calls[1].options.env.EXPO_PACKAGER_PROXY_URL, 'https://phone-test.trycloudflare.com');
  assert.equal(calls[1].options.env.EXPO_PUBLIC_DOMAIN, 'phone-test.trycloudflare.com');
  assert.equal(calls[1].options.env.EXPO_PUBLIC_API_URL, 'https://phone-test.trycloudflare.com/api');
  assert.equal(calls[1].options.env.EXPO_PUBLIC_PHONE_DEV, 'true');
  assert.equal(calls[1].options.env.EXPO_PUBLIC_CLERK_PROXY_URL, 'https://clerk-proxy.example');
  assert.equal(calls[0].child.killed, true);
  assert.equal(logs.some((message) => message.includes('secret-never-log')), false);
});

test('launcher reports bounded tunnel startup failure and stops the child', async () => {
  class FakeChild extends EventEmitter {
    constructor() {
      super();
      this.stdout = new PassThrough();
      this.stderr = new PassThrough();
      this.exitCode = null;
      this.killed = false;
    }

    kill() {
      if (this.exitCode !== null) return false;
      this.killed = true;
      this.exitCode = 0;
      this.emit('close', 0, null);
      return true;
    }
  }

  let tunnelChild;
  await assert.rejects(runPhoneDevelopment({
    env: { PORT: '19000' },
    spawnProcess: () => (tunnelChild = new FakeChild()),
    log: { log() {}, error() {} },
    tunnelTimeoutMs: 20,
    shutdownTimeoutMs: 20,
  }), /did not provide a trycloudflare\.com URL within 1 second/);
  assert.equal(tunnelChild.killed, true);
});

test('launcher awaits delayed child cleanup and sends SIGKILL only after its deadline', async () => {
  class DelayedChild extends EventEmitter {
    constructor() {
      super();
      this.stdout = new PassThrough();
      this.stderr = new PassThrough();
      this.exitCode = null;
      this.signalCode = null;
      this.signals = [];
    }

    kill(signal) {
      this.signals.push(signal);
      assert.ok(this.listenerCount('close') > 0, 'close listener must be attached before signalling child');
      if (signal === 'SIGTERM') {
        setTimeout(() => {
          this.exitCode = 0;
          this.emit('close', 0, null);
        }, 35);
      } else if (signal === 'SIGKILL') {
        this.signalCode = 'SIGKILL';
        this.emit('close', null, 'SIGKILL');
      }
      return true;
    }
  }

  const children = [];
  const spawnProcess = (command) => {
    const child = new DelayedChild();
    children.push(child);
    if (command === 'cloudflared') {
      setImmediate(() => child.stdout.write('https://delayed.trycloudflare.com\n'));
    } else {
      setImmediate(() => {
        child.exitCode = 0;
        child.emit('close', 0, null);
      });
    }
    return child;
  };
  const startedAt = Date.now();
  const result = await runPhoneDevelopment({
    env: { PORT: '19000' },
    spawnProcess,
    log: { log() {}, error() {} },
    shutdownTimeoutMs: 250,
  });

  assert.equal(result, 0);
  assert.ok(Date.now() - startedAt >= 30, 'launcher must wait for cloudflared close');
  assert.deepEqual(children[0].signals, ['SIGTERM']);
});