import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { describe, expect, it } from 'vitest';
import {
  isDetachedProcessGroupAlive,
  requestBrowserShutdown,
  terminateDetachedProcess,
  terminateDetachedProcessGroup,
} from './detached-process.mjs';

describe('detached process lifecycle', () => {
  it.skipIf(process.platform === 'win32')(
    'terminates descendants after the tracked group leader has already exited',
    async () => {
      const leader = spawn(process.execPath, ['-e', `
        const { spawn } = require('node:child_process');
        const descendant = spawn(process.execPath, ['-e',
          "process.on('SIGTERM', () => {}); process.stdout.write('ready'); setInterval(() => {}, 1000);"
        ], { stdio: ['ignore', 'pipe', 'ignore'] });
        descendant.stdout.once('data', () => {
          process.stdout.write('ready');
          process.exit(0);
        });
      `], { detached: true, stdio: ['ignore', 'pipe', 'ignore'] });

      try {
        const exited = once(leader, 'exit');
        await once(leader.stdout, 'data');
        await exited;
        expect(leader.exitCode).toBe(0);
        expect(isDetachedProcessGroupAlive(leader.pid)).toBe(true);
        await expect(terminateDetachedProcess(leader, {
          termGraceMs: 100,
          killGraceMs: 1_000,
        })).resolves.toBe(true);
        expect(isDetachedProcessGroupAlive(leader.pid)).toBe(false);
      } finally {
        if (isDetachedProcessGroupAlive(leader.pid)) {
          try { process.kill(-leader.pid, 'SIGKILL'); } catch { /* already gone */ }
        }
      }
    },
  );

  it.skipIf(process.platform === 'win32')(
    'terminates a detached process group from its validated lifecycle PID',
    async () => {
      const leader = spawn(process.execPath, ['-e', `
        process.on('SIGTERM', () => {});
        process.stdout.write('ready');
        setInterval(() => {}, 1000);
      `], { detached: true, stdio: ['ignore', 'pipe', 'ignore'] });

      try {
        await once(leader.stdout, 'data');
        expect(isDetachedProcessGroupAlive(leader.pid)).toBe(true);
        await expect(terminateDetachedProcessGroup(leader.pid, {
          termGraceMs: 100,
          killGraceMs: 1_000,
        })).resolves.toBe(true);
        expect(isDetachedProcessGroupAlive(leader.pid)).toBe(false);
      } finally {
        if (isDetachedProcessGroupAlive(leader.pid)) {
          try { process.kill(-leader.pid, 'SIGKILL'); } catch { /* already gone */ }
        }
      }
    },
  );

  it('rejects unsafe detached process group PIDs before signaling', async () => {
    for (const pid of [undefined, null, '2', Number.NaN, 1.5, -1, 0, 1]) {
      await expect(terminateDetachedProcessGroup(pid)).rejects.toThrow(
        'PID must be a safe integer greater than 1',
      );
    }
  });

  it('requests a clean browser shutdown before closing the CDP client', async () => {
    const calls = [];
    const cdp = {
      send: async (...args) => { calls.push(['send', ...args]); },
      close: () => { calls.push(['close']); },
    };

    await requestBrowserShutdown(cdp, 321);
    expect(calls).toEqual([
      ['send', 'Browser.close', {}, 321],
      ['close'],
    ]);
  });
});
