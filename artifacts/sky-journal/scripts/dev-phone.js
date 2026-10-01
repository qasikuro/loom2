'use strict';

const { spawn } = require('node:child_process');
const { createPhoneGateway } = require('./phone-gateway');

const TUNNEL_START_TIMEOUT_MS = 45_000;
const SHUTDOWN_TIMEOUT_MS = 5_000;

function parseQuickTunnelOrigin(text) {
  const match = String(text).match(/https:\/\/([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.trycloudflare\.com)(?=$|[\s/"'<>])/i);
  return match ? `https://${match[1].toLowerCase()}` : null;
}

function buildExpoEnvironment(sourceEnv, tunnelOrigin) {
  const parsed = new URL(tunnelOrigin);
  if (
    parsed.protocol !== 'https:' ||
    !/^[a-z0-9-]+\.trycloudflare\.com$/i.test(parsed.hostname) ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error('Expected a valid https://<random>.trycloudflare.com tunnel origin');
  }

  return {
    ...sourceEnv,
    EXPO_PACKAGER_PROXY_URL: parsed.origin,
    EXPO_PUBLIC_DOMAIN: parsed.hostname,
    EXPO_PUBLIC_API_URL: `${parsed.origin}/api`,
    EXPO_PUBLIC_PHONE_DEV: 'true',
    REACT_NATIVE_PACKAGER_HOSTNAME: parsed.hostname,
    // Preserve the existing Replit-to-Clerk publishable-key wiring without
    // touching Clerk's proxy URL or any of its other environment settings.
    EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY:
      sourceEnv.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || sourceEnv.CLERK_PUBLISHABLE_KEY || '',
    EXPO_PUBLIC_REPL_ID: sourceEnv.EXPO_PUBLIC_REPL_ID || sourceEnv.REPL_ID || '',
  };
}

function requiredManagedPort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be provided by the managed development environment (1–65535)');
  }
  return port;
}

function appendTail(previous, chunk) {
  return `${previous}${chunk}`.slice(-4000);
}

function signalChild(child, signal) {
  if (process.platform !== 'win32' && Number.isInteger(child.pid) && child.pid > 1) {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      // Fall back to signalling the direct child if the group is unavailable.
    }
  }
  try {
    child.kill(signal);
  } catch {
    // The child may already have exited.
  }
}

function childGroupRunning(child) {
  if (child.exitCode === null && child.signalCode == null) return true;
  if (process.platform === 'win32' || !Number.isInteger(child.pid) || child.pid <= 1) return false;
  try {
    process.kill(-child.pid, 0);
    return true;
  } catch (error) {
    return error.code !== 'ESRCH';
  }
}

function waitForChildGroups(children) {
  let resolveWait;
  let timer;
  let settled = false;
  const closeListeners = [];
  const promise = new Promise((resolve) => { resolveWait = resolve; });

  const check = () => {
    if (settled) return;
    if (children.every((child) => !childGroupRunning(child))) {
      settled = true;
      if (timer) clearTimeout(timer);
      for (const [child, listener] of closeListeners) child.off('close', listener);
      resolveWait();
      return;
    }
    timer = setTimeout(check, 20);
  };

  for (const child of children) {
    const onClose = () => check();
    child.once('close', onClose);
    closeListeners.push([child, onClose]);
  }
  check();

  return {
    promise,
    cancel() {
      settled = true;
      if (timer) clearTimeout(timer);
      for (const [child, listener] of closeListeners) child.off('close', listener);
    },
  };
}

async function runPhoneDevelopment({
  env = process.env,
  cwd = process.cwd(),
  spawnProcess = spawn,
  log = console,
  tunnelTimeoutMs = TUNNEL_START_TIMEOUT_MS,
  shutdownTimeoutMs = SHUTDOWN_TIMEOUT_MS,
} = {}) {
  const expoPort = requiredManagedPort(env.PORT);
  const gateway = createPhoneGateway({ apiPort: 8080, expoPort });
  let gatewayPort;
  try {
    gatewayPort = await gateway.listen(0);
  } catch (error) {
    throw new Error(`Could not start the loopback phone gateway: ${error.message}`);
  }

  let tunnel;
  let expo;
  let stopping = false;
  let resolveStartup;
  let rejectStartup;
  let startupSettled = false;
  let startupTimer;
  let outputTail = '';
  let shutdownExitCode = 0;
  let shutdownPromise;
  let signalExitRequested = false;
  const children = new Set();

  const startup = new Promise((resolve, reject) => {
    resolveStartup = resolve;
    rejectStartup = reject;
  });

  function settleStartup(error, origin) {
    if (startupSettled) return;
    startupSettled = true;
    clearTimeout(startupTimer);
    if (error) rejectStartup(error);
    else resolveStartup(origin);
  }

  function trackChild(child, label) {
    children.add(child);
    child.once('error', (error) => {
      if (!stopping && label === 'cloudflared') {
        settleStartup(new Error(`Could not start cloudflared: ${error.message}. Confirm cloudflared is installed and on PATH.`));
      }
    });
  }

  function stop(exitCode = 0) {
    if (shutdownPromise) return shutdownPromise;
    stopping = true;
    shutdownExitCode = exitCode;
    clearTimeout(startupTimer);
    settleStartup(new Error('Phone development stopped before the tunnel was ready'));
    process.off('SIGINT', onSigint);
    process.off('SIGTERM', onSigterm);

    const allChildren = [...children];
    shutdownPromise = Promise.resolve().then(async () => {
      const waitForChildren = waitForChildGroups(allChildren);
      for (const child of allChildren) signalChild(child, 'SIGTERM');

      let deadlineTimer;
      const timedOut = allChildren.some(childGroupRunning) && await Promise.race([
        waitForChildren.promise.then(() => false),
        new Promise((resolve) => {
          deadlineTimer = setTimeout(() => resolve(true), shutdownTimeoutMs);
        }),
      ]);
      if (deadlineTimer) clearTimeout(deadlineTimer);
      waitForChildren.cancel();
      if (timedOut) {
        const remaining = allChildren.filter(childGroupRunning);
        for (const child of remaining) signalChild(child, 'SIGKILL');
        await waitForChildGroups(remaining).promise;
      }
      await gateway.close();
      return shutdownExitCode;
    });
    return shutdownPromise;
  }

  const onSigint = () => {
    signalExitRequested = true;
    void stop(130);
  };
  const onSigterm = () => {
    signalExitRequested = true;
    void stop(143);
  };
  process.once('SIGINT', onSigint);
  process.once('SIGTERM', onSigterm);

  function fail(error) {
    if (!stopping) log.error(error.message);
    void stop(1);
  }

  startupTimer = setTimeout(() => {
    const timeoutSeconds = Math.max(1, Math.ceil(tunnelTimeoutMs / 1000));
    settleStartup(new Error(
      `cloudflared did not provide a trycloudflare.com URL within ${timeoutSeconds} second${timeoutSeconds === 1 ? '' : 's'}.`,
    ));
  }, tunnelTimeoutMs);

  try {
    tunnel = spawnProcess('cloudflared', [
      'tunnel',
      '--url',
      `http://127.0.0.1:${gatewayPort}`,
      '--protocol',
      'http2',
      '--edge-ip-version',
      '4',
      '--no-autoupdate',
    ], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
    trackChild(tunnel, 'cloudflared');
  } catch (error) {
    settleStartup(new Error(`Could not start cloudflared: ${error.message}. Confirm cloudflared is installed and on PATH.`));
  }

  if (tunnel) {
    const onTunnelOutput = (chunk) => {
      outputTail = appendTail(outputTail, chunk.toString());
      if (startupSettled) return;
      const origin = parseQuickTunnelOrigin(outputTail);
      if (origin) {
        gateway.setPublicHost(new URL(origin).hostname);
        settleStartup(null, origin);
      }
    };
    tunnel.stdout?.on('data', onTunnelOutput);
    tunnel.stderr?.on('data', onTunnelOutput);
    tunnel.once('close', (code, signal) => {
      if (stopping) return;
      const detail = signal ? `signal ${signal}` : `exit code ${code}`;
      const error = new Error(
        `cloudflared exited with ${detail} before or during the tunnel session.`,
      );
      settleStartup(error);
      fail(error);
    });
  }

  let origin;
  try {
    origin = await startup;
  } catch (error) {
    if (signalExitRequested) return await stop(shutdownExitCode);
    await stop(1);
    throw error;
  }
  if (stopping) return await stop(shutdownExitCode);

  let expoEnv;
  try {
    expoEnv = buildExpoEnvironment(env, origin);
  } catch (error) {
    await stop(1);
    throw error;
  }

  log.log(`Phone development tunnel: ${origin}`);
  try {
    expo = spawnProcess('pnpm', [
      'exec',
      'expo',
      'start',
      '--localhost',
      '--port',
      String(expoPort),
      '--go',
    ], { cwd, env: expoEnv, stdio: 'inherit', detached: process.platform !== 'win32' });
    trackChild(expo, 'expo');
  } catch (error) {
    await stop(1);
    throw new Error(`Could not start Expo: ${error.message}`);
  }

  return new Promise((resolve) => {
    let finished = false;
    const finish = async (code) => {
      if (finished) return;
      finished = true;
      resolve(await stop(code));
    };

    expo.once('error', (error) => {
      if (!stopping) log.error(`Could not start Expo: ${error.message}`);
      void finish(1);
    });
    expo.once('close', (code, signal) => {
      if (stopping) {
        void finish(shutdownExitCode);
        return;
      }
      if (signal) log.error(`Expo exited after ${signal}`);
      void finish(code ?? (signal ? 1 : 0));
    });
    tunnel.once('close', (code, signal) => {
      if (stopping) return;
      const detail = signal ? `signal ${signal}` : `exit code ${code}`;
      log.error(`cloudflared exited with ${detail}; stopping Expo and the gateway.`);
      void finish(1);
    });
  });
}

if (require.main === module) {
  runPhoneDevelopment().then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { buildExpoEnvironment, parseQuickTunnelOrigin, requiredManagedPort, runPhoneDevelopment };