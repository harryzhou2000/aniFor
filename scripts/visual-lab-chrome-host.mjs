import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  access, mkdtemp, readFile, rename, rm, writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  isDetachedProcessGroupAlive,
  requestBrowserShutdown,
  terminateDetachedProcess,
} from './detached-process.mjs';

const CDP_CONNECT_TIMEOUT_MS = 10_000;
const CDP_COMMAND_TIMEOUT_MS = 20_000;
const DEVTOOLS_STARTUP_TIMEOUT_MS = 15_000;
const TARGET_DISCOVERY_TIMEOUT_MS = 10_000;
const TARGET_TEARDOWN_TIMEOUT_MS = 5_000;
const VISUAL_LAB_LIFECYCLE_SCHEMA = 'anifor.visual-lab.lifecycle/v1';

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const throwCollectedErrors = (errors, label) => {
  if (errors.length === 0) return;
  if (errors.length === 1) throw errors[0];
  throw new AggregateError(errors, label);
};

const asError = (error) => error instanceof Error ? error : new Error(String(error));

const readProcessStartToken = async (pid) => {
  if (process.platform !== 'linux') return null;
  const source = await readFile(`/proc/${pid}/stat`, 'utf8');
  const commandEnd = source.lastIndexOf(')');
  const fields = commandEnd >= 0
    ? source.slice(commandEnd + 1).trim().split(/\s+/) : [];
  const token = fields[19];
  if (!token || !/^\d+$/.test(token)) {
    throw new Error(`Cannot identify Chrome process ${pid} from /proc`);
  }
  return token;
};

const publishLifecycleFile = async (file, pid, profile, owner) => {
  if (!Number.isSafeInteger(pid) || pid <= 1) {
    throw new Error(`Chrome returned an unsafe detached process group PID: ${String(pid)}`);
  }
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  const record = {
    schema: VISUAL_LAB_LIFECYCLE_SCHEMA,
    pid,
    profile,
    createdAtMs: Date.now(),
    startToken: await readProcessStartToken(pid),
    owner,
  };
  try {
    await writeFile(temporary, `${JSON.stringify(record)}\n`, { mode: 0o600, flag: 'wx' });
    await rename(temporary, file);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
};

/** Retains the lifecycle handoff until its referenced profile is gone. */
export async function removeVisualLabHostArtifacts({
  profile,
  lifecycleFile,
  lifecyclePublished,
  remove = rm,
}) {
  const cleanupErrors = [];
  let profileRemoved = profile === undefined;
  if (profile) {
    try {
      await remove(profile, { recursive: true, force: true });
      profileRemoved = true;
    } catch (error) {
      cleanupErrors.push(asError(error));
    }
  }
  let lifecycleRemoved = !lifecyclePublished;
  if (lifecyclePublished && profileRemoved) {
    try {
      await remove(lifecycleFile, { force: true });
      lifecycleRemoved = true;
    } catch (error) {
      cleanupErrors.push(asError(error));
    }
  }
  throwCollectedErrors(cleanupErrors, 'Visual Lab host-artifact cleanup failed');
  return Object.freeze({ profileRemoved, lifecycleRemoved });
}

export async function resolveVisualLabChrome(explicit) {
  const candidates = [
    explicit, process.env.CHROME_BIN, '/usr/bin/google-chrome',
    '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch { /* try the next candidate */ }
  }
  throw new Error('Chrome/Chromium not found; pass --chrome=/path or set CHROME_BIN');
}

const browserHttpOrigin = (browserWebSocketDebuggerUrl) => {
  let url;
  try { url = new URL(browserWebSocketDebuggerUrl); }
  catch { throw new TypeError('Visual Lab browser WebSocket must be an absolute URL'); }
  if (url.protocol !== 'ws:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new TypeError('Visual Lab browser WebSocket must use loopback ws://');
  }
  if (!url.port || !url.pathname.startsWith('/devtools/browser/')) {
    throw new TypeError('Visual Lab browser WebSocket must identify a DevTools browser endpoint');
  }
  return `http://${url.hostname}:${url.port}`;
};

const waitForTarget = async (browserWebSocketDebuggerUrl, predicate, label) => {
  const origin = browserHttpOrigin(browserWebSocketDebuggerUrl);
  const deadline = Date.now() + TARGET_DISCOVERY_TIMEOUT_MS;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${origin}/json/list`, {
        signal: AbortSignal.timeout(2_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const targets = await response.json();
      const target = targets.find(predicate);
      if (target?.webSocketDebuggerUrl) return target;
    } catch (error) {
      lastError = error;
    }
    await sleep(50);
  }
  throw new Error(`${label} timed out${lastError ? `: ${lastError}` : ''}`);
};

const observeChromeDevTools = (chrome) => {
  let chromeLog = '';
  let resolved = false;
  let hostFault = null;
  let resolveReady;
  let rejectReady;
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  // Ownership is returned before callers await readiness so signal handlers can
  // already see the Chrome process. Keep an eager rejection observed without
  // changing what a later `await ready` receives.
  void ready.catch(() => {});
  const timeout = setTimeout(() => {
    if (resolved) return;
    resolved = true;
    rejectReady(new Error(`Chrome DevTools timeout\n${chromeLog.slice(-4_000)}`));
  }, DEVTOOLS_STARTUP_TIMEOUT_MS);
  const fail = (error) => {
    hostFault = asError(error);
    if (resolved) return;
    resolved = true;
    clearTimeout(timeout);
    rejectReady(hostFault);
  };
  chrome.stderr.on('data', (chunk) => {
    chromeLog = `${chromeLog}${chunk}`.slice(-8_000);
    if (resolved) return;
    const match = chromeLog.match(/DevTools listening on (ws:\/\/[^\s]+)/);
    if (!match) return;
    resolved = true;
    clearTimeout(timeout);
    resolveReady(match[1]);
  });
  chrome.once('error', (error) => fail(new Error(
    `Chrome failed to start: ${asError(error).message}`,
  )));
  chrome.once('exit', (code, signal) => fail(new Error(
    `Chrome exited${resolved ? '' : ' before DevTools'} (${String(code ?? signal)})`
      + `\n${chromeLog.slice(-4_000)}`,
  )));
  return Object.freeze({
    ready,
    assertProcessHealthy() {
      if (hostFault) throw hostFault;
      const childRunning = chrome.exitCode === null && chrome.signalCode === null;
      if (!childRunning && (process.platform === 'win32'
        || !isDetachedProcessGroupAlive(chrome.pid))) {
        throw new Error(`Chrome process group ${chrome.pid} is no longer alive`);
      }
    },
    diagnostics: () => chromeLog,
  });
};

export class Cdp {
  static async connect(url, timeoutMs = CDP_CONNECT_TIMEOUT_MS) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timeout);
        socket.removeEventListener('open', opened);
        socket.removeEventListener('error', failed);
        socket.removeEventListener('close', closed);
      };
      const opened = () => { cleanup(); resolve(); };
      const failed = () => { cleanup(); reject(new Error(`CDP connection failed: ${url}`)); };
      const closed = () => { cleanup(); reject(new Error(`CDP closed while connecting: ${url}`)); };
      const timeout = setTimeout(() => {
        cleanup();
        try { socket.close(); } catch { /* not open */ }
        reject(new Error(`CDP connection timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      socket.addEventListener('open', opened, { once: true });
      socket.addEventListener('error', failed, { once: true });
      socket.addEventListener('close', closed, { once: true });
    });
    return new Cdp(socket);
  }

  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.closed = false;
    socket.addEventListener('message', ({ data }) => {
      let message;
      try { message = JSON.parse(data); }
      catch (error) {
        this.fail(asError(error));
        return;
      }
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        clearTimeout(pending.timeout);
        if (message.error) {
          pending.reject(new Error(
            `${message.error.message}: ${JSON.stringify(message.error.data ?? {})}`,
          ));
        } else {
          pending.resolve(message.result ?? {});
        }
        return;
      }
      for (const listener of this.listeners.get(message.method) ?? []) {
        listener(message.params ?? {});
      }
    });
    socket.addEventListener('error', () => {
      this.closed = true;
      this.fail(new Error('CDP WebSocket error'));
    });
    socket.addEventListener('close', () => {
      this.closed = true;
      this.fail(new Error('CDP WebSocket closed'));
    });
  }

  send(method, params = {}, timeoutMs = CDP_COMMAND_TIMEOUT_MS) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      if (this.closed || this.socket.readyState !== WebSocket.OPEN) {
        reject(new Error(`Cannot send ${method}: CDP WebSocket is not open`));
        return;
      }
      const timeout = setTimeout(() => {
        if (!this.pending.delete(id)) return;
        reject(new Error(`CDP ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
      try { this.socket.send(JSON.stringify({ id, method, params })); }
      catch (error) {
        this.pending.delete(id);
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  fail(error) {
    for (const { reject, timeout } of this.pending.values()) {
      clearTimeout(timeout);
      reject(error);
    }
    this.pending.clear();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.fail(new Error('CDP connection closed by visual-lab audit'));
    try { this.socket.close(); } catch { /* already closed */ }
  }
}

/**
 * Starts one detached, lifecycle-recorded Chrome host. `ready()` separates the
 * synchronous ownership handoff from DevTools/page discovery so signal cleanup
 * can see the process even while Chrome is starting.
 */
export async function startVisualLabChromeHost({
  chromePath,
  gpuMode = 'auto',
  initialUrl = new URL('about:blank'),
  allowFileAccess,
  lifecycleFile,
  lifecycleOwner,
}) {
  const normalizedInitialUrl = initialUrl instanceof URL ? initialUrl : new URL(initialUrl);
  const fileAccess = allowFileAccess ?? normalizedInitialUrl.protocol === 'file:';
  if (gpuMode !== 'auto' && gpuMode !== 'swiftshader') {
    throw new TypeError('Visual Lab Chrome gpuMode must be auto or swiftshader');
  }
  if ((lifecycleFile === undefined) !== (lifecycleOwner === undefined)) {
    throw new TypeError('Visual Lab Chrome lifecycle file and owner must be provided together');
  }
  if (lifecycleFile !== undefined
    && (typeof lifecycleFile !== 'string' || !path.isAbsolute(lifecycleFile))) {
    throw new TypeError('Visual Lab Chrome lifecycle file must be an absolute path');
  }
  if (lifecycleOwner !== undefined && !/^[a-f0-9]{64}$/.test(lifecycleOwner)) {
    throw new TypeError('Visual Lab Chrome lifecycle owner must be a lowercase SHA-256 identity');
  }
  const executable = await resolveVisualLabChrome(chromePath);
  const profile = await mkdtemp(path.join(tmpdir(), 'anifor-visual-lab-chrome-'));
  const gpuFlags = gpuMode === 'swiftshader'
    ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    : ['--enable-webgl', '--ignore-gpu-blocklist'];
  const chrome = spawn(executable, [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
    '--no-proxy-server', '--remote-debugging-port=0',
    ...(fileAccess ? ['--allow-file-access-from-files'] : []),
    `--user-data-dir=${profile}`, '--window-size=1280,720',
    '--force-device-scale-factor=1', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', ...gpuFlags, normalizedInitialUrl.href,
  ], { detached: true, stdio: ['ignore', 'ignore', 'pipe'] });
  const observer = observeChromeDevTools(chrome);
  let lifecyclePublished = false;
  const lifecyclePublication = lifecycleFile === undefined
    ? Promise.resolve()
    : publishLifecycleFile(
      lifecycleFile, chrome.pid, profile, lifecycleOwner,
    ).then(() => { lifecyclePublished = true; });
  void lifecyclePublication.catch(() => {});
  let browserWebSocketDebuggerUrl;
  let browserCdp;
  let initialPage;
  let readyPromise;
  let teardownPromise;

  const ready = () => {
    readyPromise ??= (async () => {
      [browserWebSocketDebuggerUrl] = await Promise.all([
        observer.ready,
        lifecyclePublication,
      ]);
      browserCdp = await Cdp.connect(browserWebSocketDebuggerUrl);
      if (normalizedInitialUrl.protocol !== 'about:') {
        initialPage = await waitForTarget(
          browserWebSocketDebuggerUrl,
          (candidate) => candidate.type === 'page'
            && candidate.url === normalizedInitialUrl.href,
          'Chrome page target',
        );
      }
      observer.assertProcessHealthy();
      return Object.freeze({ browserWebSocketDebuggerUrl, browserCdp, initialPage });
    })();
    return readyPromise;
  };

  const teardown = () => {
    teardownPromise ??= (async () => {
      const cleanupErrors = [];
      await lifecyclePublication.catch(() => {});
      await requestBrowserShutdown(browserCdp);
      let terminated = false;
      try { terminated = await terminateDetachedProcess(chrome); }
      catch (error) { cleanupErrors.push(asError(error)); }
      if (!terminated) {
        cleanupErrors.push(new Error(`Chrome process group ${chrome.pid} survived cleanup`));
      }
      if (terminated) {
        try {
          const removed = await removeVisualLabHostArtifacts({
            profile, lifecycleFile, lifecyclePublished,
          });
          if (removed.lifecycleRemoved) lifecyclePublished = false;
        } catch (error) {
          cleanupErrors.push(asError(error));
        }
      }
      throwCollectedErrors(cleanupErrors, 'Visual Lab Chrome-host teardown failed');
    })();
    return teardownPromise;
  };

  return Object.freeze({
    chrome,
    profile,
    ready,
    teardown,
    async assertHealthy() {
      observer.assertProcessHealthy();
      if (!browserCdp) throw new Error('Visual Lab Chrome host is not ready');
      await browserCdp.send('Browser.getVersion', {}, 2_000);
      observer.assertProcessHealthy();
    },
    diagnostics: observer.diagnostics,
    get browserWebSocketDebuggerUrl() { return browserWebSocketDebuggerUrl; },
    get browserCdp() { return browserCdp; },
    get initialPage() { return initialPage; },
  });
}

/**
 * Creates one direct-URL page in a fresh incognito context on a caller-owned
 * Chrome host. Closing is strict and idempotent; any partial teardown is an
 * error so the host supervisor can recycle the whole process.
 */
export async function connectVisualLabIncognitoPage({
  browserWebSocketDebuggerUrl,
  url,
}) {
  const pageUrl = url instanceof URL ? url : new URL(url);
  browserHttpOrigin(browserWebSocketDebuggerUrl);
  const browserCdp = await Cdp.connect(browserWebSocketDebuggerUrl);
  let browserContextId;
  let targetId;
  let pageCdp;
  let closePromise;

  const close = () => {
    closePromise ??= (async () => {
      const errors = [];
      if (targetId) {
        try {
          const result = await browserCdp.send(
            'Target.closeTarget', { targetId }, TARGET_TEARDOWN_TIMEOUT_MS,
          );
          if (result.success !== true) {
            throw new Error(`Chrome refused to close target ${targetId}`);
          }
        } catch (error) { errors.push(asError(error)); }
      }
      try { pageCdp?.close(); }
      catch (error) { errors.push(asError(error)); }
      if (browserContextId) {
        try {
          await browserCdp.send(
            'Target.disposeBrowserContext', { browserContextId }, TARGET_TEARDOWN_TIMEOUT_MS,
          );
          const { browserContextIds = [] } = await browserCdp.send(
            'Target.getBrowserContexts', {}, TARGET_TEARDOWN_TIMEOUT_MS,
          );
          if (browserContextIds.includes(browserContextId)) {
            throw new Error(`Chrome retained browser context ${browserContextId} after disposal`);
          }
        } catch (error) { errors.push(asError(error)); }
      }
      try { browserCdp.close(); }
      catch (error) { errors.push(asError(error)); }
      throwCollectedErrors(errors, 'Visual Lab incognito target/context teardown failed');
    })();
    return closePromise;
  };

  try {
    ({ browserContextId } = await browserCdp.send('Target.createBrowserContext', {
      disposeOnDetach: true,
    }));
    if (typeof browserContextId !== 'string' || browserContextId.length === 0) {
      throw new Error('Chrome did not return a browser context ID');
    }
    ({ targetId } = await browserCdp.send('Target.createTarget', {
      url: pageUrl.href,
      browserContextId,
      background: false,
    }));
    if (typeof targetId !== 'string' || targetId.length === 0) {
      throw new Error('Chrome did not return a target ID');
    }
    const { targetInfo } = await browserCdp.send('Target.getTargetInfo', { targetId });
    if (targetInfo?.targetId !== targetId
      || targetInfo.type !== 'page'
      || targetInfo.browserContextId !== browserContextId) {
      throw new Error('Chrome target does not belong to the requested fresh context');
    }
    const pageTarget = await waitForTarget(
      browserWebSocketDebuggerUrl,
      (candidate) => candidate.id === targetId && candidate.type === 'page',
      `Chrome incognito target ${targetId}`,
    );
    pageCdp = await Cdp.connect(pageTarget.webSocketDebuggerUrl);
    return Object.freeze({
      browserContextId,
      targetId,
      pageCdp,
      close,
    });
  } catch (error) {
    let cleanupError;
    try { await close(); }
    catch (nested) { cleanupError = asError(nested); }
    if (cleanupError) {
      throw new AggregateError(
        [asError(error), cleanupError],
        'Visual Lab incognito target setup and cleanup both failed',
      );
    }
    throw error;
  }
}
