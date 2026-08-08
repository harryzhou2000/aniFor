import { spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const DEFAULT_TERM_GRACE_MS = 2_000;
const DEFAULT_KILL_GRACE_MS = 1_000;

const validateDetachedProcessGroupPid = (pid) => {
  if (!Number.isSafeInteger(pid) || pid <= 1) {
    throw new TypeError('Detached process group PID must be a safe integer greater than 1');
  }
  return pid;
};

/**
 * A detached leader may exit before Chrome's descendants. ChildProcess.exitCode
 * therefore cannot prove that the process group is gone.
 */
export function isDetachedProcessGroupAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0 || process.platform === 'win32') return false;
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    return error?.code !== 'ESRCH';
  }
}

const isChildAlive = (child) => (
  child?.exitCode === null && child?.signalCode === null
);

const isTreeAlive = (child, pid) => (
  isChildAlive(child) || isDetachedProcessGroupAlive(pid)
);

const isProcessAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code !== 'ESRCH';
  }
};

const isProcessGroupAlive = (pid) => (
  process.platform === 'win32' ? isProcessAlive(pid) : isDetachedProcessGroupAlive(pid)
);

const signalProcessGroup = (pid, signal) => {
  if (process.platform === 'win32') {
    const force = signal === 'SIGKILL' ? ['/F'] : [];
    try {
      const result = spawnSync('taskkill', ['/PID', String(pid), '/T', ...force], {
        stdio: 'ignore', timeout: 2_000,
      });
      return !result.error && result.status === 0;
    } catch { return false; }
  } else {
    try {
      process.kill(-pid, signal);
      return true;
    } catch { return false; }
  }
};

const signalTree = (child, pid, signal) => {
  if (signalProcessGroup(pid, signal)) return;
  if (!isChildAlive(child)) return;
  try { child.kill(signal); } catch { /* already gone */ }
};

async function waitForTreeExit(child, pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (isTreeAlive(child, pid) && Date.now() < deadline) await sleep(25);
  return !isTreeAlive(child, pid);
}

async function waitForProcessGroupExit(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (isProcessGroupAlive(pid) && Date.now() < deadline) await sleep(25);
  return !isProcessGroupAlive(pid);
}

/**
 * Terminates a detached process group using a validated leader PID. This is the
 * lifecycle-file recovery path for a supervisor that no longer owns the
 * original ChildProcess object.
 */
export async function terminateDetachedProcessGroup(pid, {
  termGraceMs = DEFAULT_TERM_GRACE_MS,
  killGraceMs = DEFAULT_KILL_GRACE_MS,
} = {}) {
  const groupPid = validateDetachedProcessGroupPid(pid);
  if (!isProcessGroupAlive(groupPid)) return true;

  signalProcessGroup(groupPid, 'SIGTERM');
  if (await waitForProcessGroupExit(groupPid, termGraceMs)) return true;

  signalProcessGroup(groupPid, 'SIGKILL');
  return waitForProcessGroupExit(groupPid, killGraceMs);
}

/**
 * Terminates a detached process tree even when its tracked leader already
 * exited. Returns false only when the group survives the bounded SIGKILL tail.
 */
export async function terminateDetachedProcess(child, {
  termGraceMs = DEFAULT_TERM_GRACE_MS,
  killGraceMs = DEFAULT_KILL_GRACE_MS,
} = {}) {
  const pid = child?.pid;
  if (!Number.isInteger(pid) || pid <= 0 || !isTreeAlive(child, pid)) return true;

  signalTree(child, pid, 'SIGTERM');
  if (await waitForTreeExit(child, pid, termGraceMs)) return true;

  signalTree(child, pid, 'SIGKILL');
  return waitForTreeExit(child, pid, killGraceMs);
}

/** Ask Chrome to close cleanly before the detached-process fallback runs. */
export async function requestBrowserShutdown(cdp, timeoutMs = 2_000) {
  if (!cdp) return;
  try { await cdp.send('Browser.close', {}, timeoutMs); }
  catch { /* closing the browser commonly closes CDP before the reply */ }
  try { cdp.close(); } catch { /* already closed */ }
}
