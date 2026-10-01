'use strict';

const http = require('node:http');
const net = require('node:net');

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'proxy-connection',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function isApiPath(requestUrl) {
  const path = getRequestPath(requestUrl);
  if (path === null) return false;
  const pathname = path.split('?')[0];
  return pathname === '/api' || pathname.startsWith('/api/');
}

function getRequestPath(requestUrl) {
  if (
    typeof requestUrl !== 'string' ||
    !requestUrl.startsWith('/') ||
    requestUrl.startsWith('//') ||
    /[\\\u0000-\u0020\u007f#]/.test(requestUrl) ||
    /%(?![0-9a-f]{2})/i.test(requestUrl)
  ) {
    return null;
  }
  try {
    const parsed = new URL(requestUrl, 'http://gateway.local');
    if (parsed.origin !== 'http://gateway.local') return null;
    return requestUrl;
  } catch {
    return null;
  }
}

function forwardedHeaders(request, publicHost, isUpgrade = false) {
  const headers = { ...request.headers };
  const connectionTokens = String(headers.connection || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  for (const name of [
    ...HOP_BY_HOP_HEADERS,
    ...connectionTokens,
    'forwarded',
    'x-forwarded-for',
    'x-forwarded-host',
    'x-forwarded-proto',
    'x-real-ip',
  ]) {
    delete headers[name];
  }

  const cfConnectingIp = request.headers['cf-connecting-ip'];
  if (typeof cfConnectingIp === 'string' && net.isIP(cfConnectingIp.trim())) {
    headers['x-forwarded-for'] = cfConnectingIp.trim();
  }

  // Only use a host authenticated by the established tunnel when available.
  const externalHost = publicHost || request.headers.host;
  if (externalHost) {
    headers.host = externalHost;
    headers['x-forwarded-host'] = externalHost;
  }
  headers['x-forwarded-proto'] = 'https';

  if (isUpgrade) {
    headers.connection = 'Upgrade';
    headers.upgrade = request.headers.upgrade;
  }
  return headers;
}

function createPhoneGateway({ apiPort, expoPort, host = '127.0.0.1' }) {
  if (!Number.isInteger(apiPort) || apiPort < 1 || apiPort > 65535) {
    throw new TypeError('apiPort must be a valid TCP port');
  }
  if (!Number.isInteger(expoPort) || expoPort < 1 || expoPort > 65535) {
    throw new TypeError('expoPort must be a valid TCP port');
  }

  const sockets = new Set();
  const upstreamSockets = new Set();
  let publicHost;

  function trackUpstreamSocket(request) {
    request.on('socket', (socket) => {
      upstreamSockets.add(socket);
      socket.once('close', () => upstreamSockets.delete(socket));
    });
  }

  const server = http.createServer((request, response) => {
    const requestPath = getRequestPath(request.url);
    if (requestPath === null) {
      response.writeHead(400, { connection: 'close', 'content-type': 'text/plain; charset=utf-8' });
      response.end('Bad Request: expected an origin-form request target');
      return;
    }

    let upstream;
    try {
      upstream = http.request({
        host: '127.0.0.1',
        port: isApiPath(requestPath) ? apiPort : expoPort,
        method: request.method,
        path: requestPath,
        headers: forwardedHeaders(request, publicHost),
      });
    } catch {
      response.writeHead(502, { connection: 'close', 'content-type': 'text/plain; charset=utf-8' });
      response.end('Phone development gateway: could not create upstream request');
      return;
    }
    trackUpstreamSocket(upstream);

    upstream.on('response', (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.statusMessage, upstreamResponse.headers);
      upstreamResponse.pipe(response);
      upstreamResponse.on('error', () => {
        if (!response.destroyed) response.destroy();
      });
    });

    upstream.on('error', () => {
      if (response.destroyed || response.writableEnded) return;
      if (!response.headersSent) {
        response.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('Phone development gateway: upstream unavailable');
      } else {
        response.destroy();
      }
    });

    request.on('aborted', () => upstream.destroy());
    response.on('close', () => {
      if (!response.writableEnded) upstream.destroy();
    });
    request.pipe(upstream);
  });

  server.on('upgrade', (request, clientSocket, head) => {
    const requestPath = getRequestPath(request.url);
    if (requestPath === null) {
      clientSocket.end(
        'HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n',
      );
      return;
    }

    let upstream;
    try {
      upstream = http.request({
        host: '127.0.0.1',
        port: isApiPath(requestPath) ? apiPort : expoPort,
        method: request.method,
        path: requestPath,
        headers: forwardedHeaders(request, publicHost, true),
      });
    } catch {
      clientSocket.end(
        'HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\nContent-Length: 0\r\n\r\n',
      );
      return;
    }
    trackUpstreamSocket(upstream);
    let upgraded = false;

    upstream.on('upgrade', (response, upstreamSocket, upstreamHead) => {
      upgraded = true;
      upstreamSockets.add(upstreamSocket);
      upstreamSocket.once('close', () => {
        upstreamSockets.delete(upstreamSocket);
      });
      const statusLine = `HTTP/1.1 ${response.statusCode || 101} ${response.statusMessage || 'Switching Protocols'}\r\n`;
      const responseHeaders = Object.entries(response.headers)
        .filter(([, value]) => value !== undefined)
        .map(([name, value]) => `${name}: ${Array.isArray(value) ? value.join(', ') : value}\r\n`)
        .join('');
      clientSocket.write(`${statusLine}${responseHeaders}\r\n`);
      if (head.length) upstreamSocket.write(head);
      if (upstreamHead.length) clientSocket.write(upstreamHead);
      clientSocket.pipe(upstreamSocket);
      upstreamSocket.pipe(clientSocket);
      clientSocket.on('error', () => upstreamSocket.destroy());
      upstreamSocket.on('error', () => clientSocket.destroy());
      clientSocket.on('close', () => upstreamSocket.destroy());
      upstreamSocket.on('close', () => clientSocket.destroy());
    });

    upstream.on('response', (response) => {
      if (upgraded || clientSocket.destroyed) return;
      const statusLine = `HTTP/1.1 ${response.statusCode || 502} ${response.statusMessage || 'Bad Gateway'}\r\n`;
      const headers = Object.entries(response.headers)
        .filter(([, value]) => value !== undefined)
        .map(([name, value]) => `${name}: ${Array.isArray(value) ? value.join(', ') : value}\r\n`)
        .join('');
      clientSocket.write(`${statusLine}${headers}\r\n`);
      response.pipe(clientSocket);
    });

    upstream.on('error', () => {
      if (!upgraded && !clientSocket.destroyed) {
        clientSocket.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
      }
    });
    clientSocket.on('error', () => upstream.destroy());
    clientSocket.on('close', () => upstream.destroy());
    upstream.end();
  });

  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  server.on('clientError', (_error, socket) => {
    if (!socket.destroyed && socket.writable) {
      socket.end(
        'HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n',
      );
    }
  });

  // SSE streams and Metro connections are intentionally long-lived.
  server.timeout = 0;
  server.requestTimeout = 0;
  server.keepAliveTimeout = 0;

  return {
    server,
    setPublicHost(hostname) {
      publicHost = hostname;
    },
    listen(port = 0) {
      return new Promise((resolve, reject) => {
        const onError = (error) => {
          server.off('listening', onListening);
          reject(error);
        };
        const onListening = () => {
          server.off('error', onError);
          const address = server.address();
          if (!address || typeof address === 'string') {
            reject(new Error('Phone gateway did not bind a TCP port'));
            return;
          }
          resolve(address.port);
        };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(port, host);
      });
    },
    close() {
      const activeSockets = [...new Set([...sockets, ...upstreamSockets])];
      const socketsClosed = Promise.all(activeSockets.map((socket) => (
        socket.destroyed
          ? Promise.resolve()
          : new Promise((resolve) => socket.once('close', resolve))
      )));
      const serverClosed = new Promise((resolve) => {
        if (!server.listening) {
          resolve();
          return;
        }
        server.close(() => resolve());
      });
      for (const socket of activeSockets) socket.destroy();
      return Promise.all([serverClosed, socketsClosed]).then(() => undefined);
    },
  };
}

module.exports = { createPhoneGateway, isApiPath };