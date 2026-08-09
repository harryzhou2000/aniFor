import { constants as fsConstants } from 'node:fs';
import {
  access, mkdtemp, readFile, rm, writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  connectVisualLabIncognitoPage,
  startVisualLabChromeHost,
} from './visual-lab-chrome-host.mjs';
import {
  isDetachedProcessGroupAlive,
  terminateDetachedProcess,
} from './detached-process.mjs';

const OWNER = '7c7a8ba5117f99c68fb9534afb3367633369422443f2191f4cc9e829052d21d5';
const REAL_CHROME_PATHS = [
  process.env.CHROME_BIN,
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

const chromePath = await (async () => {
  for (const candidate of REAL_CHROME_PATHS) {
    try {
      await access(candidate, fsConstants.X_OK);
      return candidate;
    } catch { /* try the next candidate */ }
  }
  return null;
})();

const pathIsGone = async (target) => {
  try {
    await access(target);
    return false;
  } catch (error) {
    if (error?.code === 'ENOENT') return true;
    throw error;
  }
};

const evaluateFixture = async (page, expected) => {
  const deadline = Date.now() + 5_000;
  let lastValue;
  while (Date.now() < deadline) {
    const response = await page.pageCdp.send('Runtime.evaluate', {
      expression: `({
        href: location.href,
        title: document.title,
        marker: document.body?.dataset.marker ?? null,
        value: globalThis.__visualLabHostValue ?? null,
      })`,
      returnByValue: true,
      awaitPromise: true,
    }, 2_000);
    if (!response.exceptionDetails) {
      lastValue = response.result?.value;
      if (JSON.stringify(lastValue) === JSON.stringify(expected)) return lastValue;
    }
    await sleep(25);
  }
  throw new Error(
    `Chrome page did not publish the exact fixture value: ${JSON.stringify(lastValue)}`,
  );
};

const fixtureHtml = (marker, count) => `<!doctype html>
<meta charset="utf-8">
<title>${marker}</title>
<body data-marker="${marker}">
<script>
  globalThis.__visualLabHostValue = Object.freeze({ marker: ${JSON.stringify(marker)}, count: ${count} });
</script>
`;

const cleanupRealHost = async ({ host, pages, root, lifecycleFile }) => {
  const errors = [];
  for (const page of [...pages].reverse()) {
    try { await page.close(); }
    catch (error) { errors.push(error); }
  }
  if (host) {
    try { await host.teardown(); }
    catch (error) { errors.push(error); }
    try {
      const terminated = await terminateDetachedProcess(host.chrome, {
        termGraceMs: 250,
        killGraceMs: 2_000,
      });
      if (!terminated) errors.push(new Error(`Chrome process ${host.chrome.pid} survived fallback`));
    } catch (error) { errors.push(error); }
    try { await rm(host.profile, { recursive: true, force: true }); }
    catch (error) { errors.push(error); }
  }
  if (lifecycleFile) {
    try { await rm(lifecycleFile, { force: true }); }
    catch (error) { errors.push(error); }
  }
  if (root) {
    try { await rm(root, { recursive: true, force: true }); }
    catch (error) { errors.push(error); }
  }
  return errors;
};

const expectStartRejection = async (options, expectedMessage) => {
  let host;
  let rejection;
  try { host = await startVisualLabChromeHost(options); }
  catch (error) { rejection = error; }
  if (host) {
    const cleanupErrors = await cleanupRealHost({
      host, pages: [], root: null, lifecycleFile: null,
    });
    if (cleanupErrors.length > 0) {
      throw new AggregateError(cleanupErrors, 'Unexpected Chrome host cleanup failed');
    }
  }
  expect(rejection).toBeInstanceOf(Error);
  expect(rejection?.message).toContain(expectedMessage);
};

describe('Visual Lab Chrome host', () => {
  it('rejects invalid public inputs before Chrome is needed', async () => {
    const missingChrome = path.join(
      tmpdir(), `anifor-definitely-missing-chrome-${process.pid}`,
    );

    await expectStartRejection({
      chromePath: missingChrome,
      gpuMode: 'hardware',
      initialUrl: 'about:blank',
    }, 'gpuMode must be auto or swiftshader');
    await expectStartRejection({
      chromePath: missingChrome,
      initialUrl: 'about:blank',
      lifecycleFile: path.join(tmpdir(), `unpaired-visual-lab-lifecycle-${process.pid}.json`),
    }, 'lifecycle file and owner must be provided together');
    await expectStartRejection({
      chromePath: missingChrome,
      initialUrl: 'about:blank',
      lifecycleFile: path.join(tmpdir(), `unpublished-visual-lab-lifecycle-${process.pid}.json`),
      lifecycleOwner: 'UPPERCASE-OR-UNSAFE',
    }, 'owner must be a lowercase SHA-256 identity');
    await expect(startVisualLabChromeHost({
      chromePath: missingChrome,
      initialUrl: 'not an absolute URL',
    })).rejects.toThrow();
    await expect(connectVisualLabIncognitoPage({
      browserWebSocketDebuggerUrl: 'not a WebSocket URL',
      url: 'not an absolute URL',
    })).rejects.toThrow();
  });

  it.skipIf(chromePath === null)(
    'reuses one healthy host across two isolated direct-URL pages and removes all ownership artifacts',
    async () => {
      const root = await mkdtemp(path.join(tmpdir(), 'anifor-chrome-host-test-'));
      const lifecycleFile = path.join(root, 'chrome-lifecycle.json');
      const firstFile = path.join(root, 'first.html');
      const secondFile = path.join(root, 'second.html');
      await writeFile(firstFile, fixtureHtml('first-page', 17), 'utf8');
      await writeFile(secondFile, fixtureHtml('second-page', 29), 'utf8');
      const firstUrl = pathToFileURL(firstFile);
      const secondUrl = pathToFileURL(secondFile);

      let host;
      const openPages = [];
      let testError;
      try {
        host = await startVisualLabChromeHost({
          chromePath,
          gpuMode: 'auto',
          initialUrl: new URL('about:blank'),
          allowFileAccess: true,
          lifecycleFile,
          lifecycleOwner: OWNER,
        });
        const pid = host.chrome.pid;
        const profile = host.profile;
        const ready = await host.ready();
        expect(ready.browserCdp).toBe(host.browserCdp);
        expect(ready.initialPage).toBeUndefined();
        expect(host.browserWebSocketDebuggerUrl).toMatch(
          /^ws:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):\d+\/devtools\/browser\//,
        );
        await host.assertHealthy();

        const lifecycle = JSON.parse(await readFile(lifecycleFile, 'utf8'));
        expect(lifecycle).toMatchObject({
          schema: 'anifor.visual-lab.lifecycle/v1',
          pid,
          profile,
          owner: OWNER,
        });
        expect(Number.isFinite(lifecycle.createdAtMs)).toBe(true);
        if (process.platform === 'linux') expect(lifecycle.startToken).toMatch(/^\d+$/);
        expect(await pathIsGone(profile)).toBe(false);
        if (process.platform !== 'win32') {
          expect(isDetachedProcessGroupAlive(pid)).toBe(true);
        }

        const first = await connectVisualLabIncognitoPage({
          browserWebSocketDebuggerUrl: host.browserWebSocketDebuggerUrl,
          url: firstUrl,
        });
        openPages.push(first);
        const firstIds = {
          context: first.browserContextId,
          target: first.targetId,
        };
        await expect(evaluateFixture(first, {
          href: firstUrl.href,
          title: 'first-page',
          marker: 'first-page',
          value: { marker: 'first-page', count: 17 },
        })).resolves.toEqual({
          href: firstUrl.href,
          title: 'first-page',
          marker: 'first-page',
          value: { marker: 'first-page', count: 17 },
        });
        await first.close();
        openPages.pop();
        await first.close();
        await host.assertHealthy();
        const afterFirst = await host.browserCdp.send('Target.getBrowserContexts');
        expect(afterFirst.browserContextIds).not.toContain(firstIds.context);

        const second = await connectVisualLabIncognitoPage({
          browserWebSocketDebuggerUrl: host.browserWebSocketDebuggerUrl,
          url: secondUrl,
        });
        openPages.push(second);
        const secondIds = {
          context: second.browserContextId,
          target: second.targetId,
        };
        expect(secondIds.context).not.toBe(firstIds.context);
        expect(secondIds.target).not.toBe(firstIds.target);
        await expect(evaluateFixture(second, {
          href: secondUrl.href,
          title: 'second-page',
          marker: 'second-page',
          value: { marker: 'second-page', count: 29 },
        })).resolves.toEqual({
          href: secondUrl.href,
          title: 'second-page',
          marker: 'second-page',
          value: { marker: 'second-page', count: 29 },
        });
        await second.close();
        openPages.pop();
        await host.assertHealthy();
        const afterSecond = await host.browserCdp.send('Target.getBrowserContexts');
        expect(afterSecond.browserContextIds).not.toContain(secondIds.context);

        await host.teardown();
        expect(await pathIsGone(profile)).toBe(true);
        expect(await pathIsGone(lifecycleFile)).toBe(true);
        if (process.platform !== 'win32') {
          expect(isDetachedProcessGroupAlive(pid)).toBe(false);
        }
        expect(host.chrome.exitCode !== null || host.chrome.signalCode !== null).toBe(true);
      } catch (error) {
        testError = error;
      }

      const cleanupErrors = await cleanupRealHost({
        host, pages: openPages, root, lifecycleFile,
      });
      if (testError && cleanupErrors.length > 0) {
        throw new AggregateError([testError, ...cleanupErrors], 'Chrome-host test and cleanup failed');
      }
      if (testError) throw testError;
      if (cleanupErrors.length === 1) throw cleanupErrors[0];
      if (cleanupErrors.length > 1) {
        throw new AggregateError(cleanupErrors, 'Chrome-host test cleanup failed');
      }
    },
    45_000,
  );
});
