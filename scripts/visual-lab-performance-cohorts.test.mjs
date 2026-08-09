import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  assertVisualLabPerformanceCohortPlatform,
  parseVisualLabPerformanceCohortArguments,
  runVisualLabPerformanceCohorts,
  VISUAL_LAB_PERFORMANCE_COHORT_ORDER,
  VISUAL_LAB_PERFORMANCE_COHORT_SCHEMA,
} from './visual-lab-performance-cohorts.mjs';

const roots = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));
const temporaryRoot = async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'visual-lab-performance-cohorts-test-'));
  roots.push(root);
  return root;
};

const timing = Object.freeze({
  sampledCandidates: Object.freeze(['gas-showcase']),
  phases: Object.freeze({}),
  counters: Object.freeze({}),
});
const subphases = Object.freeze({
  sampledCandidates: Object.freeze(['gas-showcase']),
  readiness: Object.freeze({}),
  captures: Object.freeze({}),
});
const recipeSetId = `sha256:${'a'.repeat(64)}`;
const resultId = `sha256:${'b'.repeat(64)}`;
const batchIndex = (id = resultId) => ({
  complete: true,
  candidates: [{ candidate: 'gas-showcase', status: 'passed', result: { id } }],
});
const recipeSet = (renderScale = 2) => ({
  schema: 'anifor.visual-lab.recipe-set/v1',
  id: recipeSetId,
  recipes: [{ name: 'gas-showcase', renderScale }],
});
const hostPlan = (mode) => ({
  requestedMode: mode,
  entries: [{
    sequence: 0,
    candidate: 'gas-showcase',
    requestedMode: mode,
    effectiveMode: mode,
  }],
});
const completeBatch = (mode) => ({
  ok: true,
  index: batchIndex(),
  timings: timing,
  captureSubphases: subphases,
  browserHostPlan: hostPlan(mode),
  browserHostRuntime: {
    requestedMode: mode,
    hostsStarted: mode === 'shared' ? 1 : 0,
    hostRestarts: 0,
    launchMs: mode === 'shared' ? 11 : 0,
    teardownMs: mode === 'shared' ? 7 : 0,
    assignments: mode === 'shared' ? [{ candidate: 'gas-showcase', host: 1 }] : [],
    recycleReasons: mode === 'shared' ? ['cohort-complete'] : [],
  },
});
const verifiedBatch = (options, overrides = {}) => {
  const mode = path.basename(options.batchRoot).endsWith('-shared') ? 'shared' : 'fresh';
  return {
    index: batchIndex(),
    timings: timing,
    captureSubphases: subphases,
    browserHostPlan: hostPlan(mode),
    ...overrides,
  };
};

describe('Visual Lab performance cohort CLI', () => {
  it('requires one tracked recipe-set path and accepts only its narrow batch forwarding options', () => {
    expect(parseVisualLabPerformanceCohortArguments([
      '--recipe-set=visual-lab/recipe-sets/release.json', '--bundle=dist/index.html',
      '--output-dir=/tmp/cohorts', '--gpu=swiftshader', '--chrome=/usr/bin/chrome',
    ])).toMatchObject({
      help: false, recipeSetPath: 'visual-lab/recipe-sets/release.json', gpu: 'swiftshader',
    });
    expect(parseVisualLabPerformanceCohortArguments(['--help'])).toEqual({ help: true });
    expect(() => parseVisualLabPerformanceCohortArguments([])).toThrow('--recipe-set is required');
    expect(() => parseVisualLabPerformanceCohortArguments([
      '--recipe-set=set.json', '--browser-host=fresh',
    ])).toThrow('Unknown option');
    expect(() => assertVisualLabPerformanceCohortPlatform('darwin')).toThrow('require Linux');
    expect(() => assertVisualLabPerformanceCohortPlatform('linux')).not.toThrow();
  });
});

describe('Visual Lab performance cohort orchestration', () => {
  it('runs and verifies a fixed ABBA cohort before publishing a bounded path-free summary', async () => {
    const root = await temporaryRoot();
    const calls = [];
    const result = await runVisualLabPerformanceCohorts({
      recipeSetPath: 'visual-lab/recipe-sets/release.json', outputDir: root, gpu: 'swiftshader',
    }, {
      assertTrackedRecipeSet: async (file) => calls.push(['tracked', file]),
      readRecipeSet: async () => recipeSet(),
      runBatch: async (options) => { calls.push(['batch', options]); return completeBatch(options.browserHost); },
      verifyBatch: async (options) => {
        calls.push(['verify', options]);
        return verifiedBatch(options);
      },
    });
    expect(calls.filter(([kind]) => kind === 'batch').map(([, options]) => options.browserHost))
      .toEqual(VISUAL_LAB_PERFORMANCE_COHORT_ORDER);
    expect(calls.filter(([kind]) => kind === 'verify')).toHaveLength(4);
    for (const [, options] of calls.filter(([kind]) => kind === 'verify')) {
      expect(options).toMatchObject({
        requireComplete: true, requireRecipeSet: true, requireBrowserHostPlan: true,
        requireExecutionTuningPlan: true,
      });
    }
    expect(result.summary).toMatchObject({
      schema: VISUAL_LAB_PERFORMANCE_COHORT_SCHEMA,
      recipeSet: { schema: 'anifor.visual-lab.recipe-set/v1', id: recipeSetId },
      gpuMode: 'swiftshader', order: VISUAL_LAB_PERFORMANCE_COHORT_ORDER,
    });
    const written = JSON.parse(await readFile(result.summaryPath, 'utf8'));
    expect(written.cohorts.map(({ ordinal, mode }) => [ordinal, mode]))
      .toEqual([[1, 'fresh'], [2, 'shared'], [3, 'shared'], [4, 'fresh']]);
    expect(JSON.stringify(written))
      .not.toMatch(/gas-showcase|index\.json|dist\/|chrome|png|result/i);
  });

  it('preserves completed cohort output and does not publish a summary after a later failure', async () => {
    const root = await temporaryRoot();
    let runs = 0;
    await expect(runVisualLabPerformanceCohorts({ recipeSetPath: 'set.json', outputDir: root }, {
      assertTrackedRecipeSet: async () => {},
      readRecipeSet: async () => recipeSet(),
      runBatch: async (options) => {
        runs += 1;
        if (runs === 2) throw new Error('second cohort failed');
        return completeBatch(options.browserHost);
      },
      verifyBatch: async (options) => verifiedBatch(options),
    })).rejects.toThrow('second cohort failed');
    expect(runs).toBe(2);
    await expect(readFile(path.join(root, 'performance-summary.json'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects true 8x and incomplete diagnostics before publishing a summary', async () => {
    const scaleRoot = await temporaryRoot();
    await expect(runVisualLabPerformanceCohorts({
      recipeSetPath: 'set.json', outputDir: scaleRoot,
    }, {
      assertTrackedRecipeSet: async () => {},
      readRecipeSet: async () => recipeSet(8),
      runBatch: async () => { throw new Error('must not run'); },
      verifyBatch: async () => { throw new Error('must not verify'); },
    })).rejects.toThrow('true 8x is fresh-browser-only');

    const telemetryRoot = await temporaryRoot();
    await expect(runVisualLabPerformanceCohorts({
      recipeSetPath: 'set.json', outputDir: telemetryRoot,
    }, {
      assertTrackedRecipeSet: async () => {},
      readRecipeSet: async () => recipeSet(),
      runBatch: async (options) => ({
        ...completeBatch(options.browserHost),
        captureSubphases: { sampledCandidates: [] },
      }),
      verifyBatch: async (options) => verifiedBatch(options, {
        captureSubphases: { sampledCandidates: [] },
      }),
    })).rejects.toThrow('captureSubphases does not cover every candidate');
    await expect(readFile(path.join(telemetryRoot, 'performance-summary.json'), 'utf8'))
      .rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects a portable host plan that does not prove the requested route', async () => {
    const root = await temporaryRoot();
    await expect(runVisualLabPerformanceCohorts({
      recipeSetPath: 'set.json', outputDir: root,
    }, {
      assertTrackedRecipeSet: async () => {},
      readRecipeSet: async () => recipeSet(),
      runBatch: async () => ({
        ...completeBatch('fresh'), browserHostPlan: hostPlan('shared'),
      }),
      verifyBatch: async () => ({
        timings: timing,
        captureSubphases: subphases,
        browserHostPlan: hostPlan('shared'),
      }),
    })).rejects.toThrow('mismatched portable host plan');
  });

  it('rejects cross-cohort capture-identity drift without serializing identities', async () => {
    const root = await temporaryRoot();
    let verifications = 0;
    await expect(runVisualLabPerformanceCohorts({
      recipeSetPath: 'set.json', outputDir: root,
    }, {
      assertTrackedRecipeSet: async () => {},
      readRecipeSet: async () => recipeSet(),
      runBatch: async (options) => completeBatch(options.browserHost),
      verifyBatch: async (options) => {
        verifications += 1;
        return verifiedBatch(options, {
          index: batchIndex(verifications === 2 ? `sha256:${'c'.repeat(64)}` : resultId),
        });
      },
    })).rejects.toThrow('changed accepted capture identity');
    expect(verifications).toBe(2);
    await expect(readFile(path.join(root, 'performance-summary.json'), 'utf8'))
      .rejects.toMatchObject({ code: 'ENOENT' });
  });
});
