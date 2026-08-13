import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  assertVisualLabPerformanceCohortPlatform,
  parseVisualLabPerformanceCohortArguments,
  runVisualLabPerformanceCohorts,
  VisualLabPerformanceIdentityMismatchError,
  VISUAL_LAB_PERFORMANCE_COHORT_ORDER,
  VISUAL_LAB_PERFORMANCE_COHORT_RECEIPT_SCHEMA,
  VISUAL_LAB_PERFORMANCE_COHORT_SCHEMA,
  VISUAL_LAB_PERFORMANCE_IDENTITY_FAILURE_SCHEMA,
  VISUAL_LAB_PERFORMANCE_IDENTITY_FAILURE_V2_SCHEMA,
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
const captureSha256 = Object.freeze({
  off: 'd'.repeat(64), a: 'e'.repeat(64), b: 'f'.repeat(64),
});
const batchIndex = (id = resultId, hashes = captureSha256) => ({
  complete: true,
  candidates: [{
    candidate: 'gas-showcase', status: 'passed', result: { id, captureSha256: hashes },
  }],
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
const tuningPlan = (schema = 'anifor.visual-lab.execution-tuning-plan/v1') => ({ schema });
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
    executionTuningPlan: tuningPlan(),
    ...overrides,
  };
};

describe('Visual Lab performance cohort CLI', () => {
  it('requires one tracked recipe-set path and accepts only its narrow batch forwarding options', () => {
    expect(parseVisualLabPerformanceCohortArguments([
      '--recipe-set=visual-lab/recipe-sets/release.json', '--bundle=dist/index.html',
      '--output-dir=/tmp/cohorts', '--gpu=swiftshader', '--capture-proof=completed-frame-receipt', '--chrome=/usr/bin/chrome',
    ])).toMatchObject({
      help: false, recipeSetPath: 'visual-lab/recipe-sets/release.json', gpu: 'swiftshader',
      captureProof: 'completed-frame-receipt',
    });
    expect(parseVisualLabPerformanceCohortArguments(['--help'])).toEqual({ help: true });
    expect(() => parseVisualLabPerformanceCohortArguments([])).toThrow('--recipe-set is required');
    expect(() => parseVisualLabPerformanceCohortArguments([
      '--recipe-set=set.json', '--browser-host=fresh',
    ])).toThrow('Unknown option');
    expect(() => parseVisualLabPerformanceCohortArguments([
      '--recipe-set=set.json', '--capture-proof=raf-only',
    ])).toThrow('--capture-proof is unsupported');
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
    expect(calls.filter(([kind]) => kind === 'batch').map(([, options]) => options.captureProof))
      .toEqual(['stable-snapshots', 'stable-snapshots', 'stable-snapshots', 'stable-snapshots']);
    expect(calls.filter(([kind]) => kind === 'verify')).toHaveLength(4);
    for (const [, options] of calls.filter(([kind]) => kind === 'verify')) {
      expect(options).toMatchObject({
        requireComplete: true, requireRecipeSet: true, requireBrowserHostPlan: true,
        requireCaptureGeometry: true,
        requireExecutionTuningPlan: true,
      });
    }
    expect(result.summary).toMatchObject({
      schema: VISUAL_LAB_PERFORMANCE_COHORT_SCHEMA,
      recipeSet: { schema: 'anifor.visual-lab.recipe-set/v1', id: recipeSetId },
      gpuMode: 'swiftshader', order: VISUAL_LAB_PERFORMANCE_COHORT_ORDER,
    });
    const bytes = await readFile(result.summaryPath, 'utf8');
    const written = JSON.parse(bytes);
    expect(written.cohorts.map(({ ordinal, mode }) => [ordinal, mode]))
      .toEqual([[1, 'fresh'], [2, 'shared'], [3, 'shared'], [4, 'fresh']]);
    expect(JSON.stringify(written))
      .not.toMatch(/gas-showcase|index\.json|dist\/|chrome|png|result/i);
    expect(written).not.toHaveProperty('captureProof');
    expect(bytes).toBe(`${JSON.stringify({
      schema: VISUAL_LAB_PERFORMANCE_COHORT_SCHEMA,
      recipeSet: { schema: 'anifor.visual-lab.recipe-set/v1', id: recipeSetId },
      gpuMode: 'swiftshader',
      order: VISUAL_LAB_PERFORMANCE_COHORT_ORDER,
      cohorts: written.cohorts,
    }, null, 2)}\n`);
    await expect(readFile(path.join(root, 'performance-identity-failure.json'), 'utf8'))
      .rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('forwards receipt proof, requires tuning v2, and publishes a self-describing v2 summary', async () => {
    const root = await temporaryRoot();
    const batchCalls = [];
    const result = await runVisualLabPerformanceCohorts({
      recipeSetPath: 'set.json', outputDir: root, captureProof: 'completed-frame-receipt',
    }, {
      assertTrackedRecipeSet: async () => {},
      readRecipeSet: async () => recipeSet(),
      runBatch: async (options) => {
        batchCalls.push(options);
        return completeBatch(options.browserHost);
      },
      verifyBatch: async (options) => verifiedBatch(options, {
        executionTuningPlan: tuningPlan('anifor.visual-lab.execution-tuning-plan/v2'),
      }),
    });
    expect(batchCalls.map(({ captureProof }) => captureProof))
      .toEqual(['completed-frame-receipt', 'completed-frame-receipt', 'completed-frame-receipt', 'completed-frame-receipt']);
    expect(result.summary).toMatchObject({
      schema: VISUAL_LAB_PERFORMANCE_COHORT_RECEIPT_SCHEMA,
      captureProof: {
        mode: 'completed-frame-receipt',
        tuningSchema: 'anifor.visual-lab.execution-tuning-plan/v2',
        receiptSchema: 'anifor.renderer.completed-frame-receipt/v1',
      },
    });
    expect(JSON.stringify(result.summary.captureProof)).not.toMatch(/path|result|ticket|sample/i);
  });

  it('forwards selection-owned receipt proof and requires tuning v4', async () => {
    const root = await temporaryRoot();
    const batchCalls = [];
    const result = await runVisualLabPerformanceCohorts({
      recipeSetPath: 'set.json', outputDir: root,
      captureProof: 'selection-owned-frame-receipt',
    }, {
      assertTrackedRecipeSet: async () => {},
      readRecipeSet: async () => recipeSet(),
      runBatch: async (options) => {
        batchCalls.push(options);
        return completeBatch(options.browserHost);
      },
      verifyBatch: async (options) => verifiedBatch(options, {
        executionTuningPlan: tuningPlan('anifor.visual-lab.execution-tuning-plan/v4'),
      }),
    });
    expect(batchCalls.map(({ captureProof }) => captureProof))
      .toEqual(Array(4).fill('selection-owned-frame-receipt'));
    expect(result.summary.captureProof).toEqual({
      mode: 'selection-owned-frame-receipt',
      tuningSchema: 'anifor.visual-lab.execution-tuning-plan/v4',
      receiptSchema: 'anifor.renderer.completed-frame-receipt/v1',
    });
  });

  it('forwards fixture-activation generation proof and requires tuning v5', async () => {
    const root = await temporaryRoot();
    const batchCalls = [];
    const result = await runVisualLabPerformanceCohorts({
      recipeSetPath: 'set.json', outputDir: root,
      captureProof: 'fixture-activation-generation',
    }, {
      assertTrackedRecipeSet: async () => {},
      readRecipeSet: async () => recipeSet(),
      runBatch: async (options) => {
        batchCalls.push(options);
        return completeBatch(options.browserHost);
      },
      verifyBatch: async (options) => verifiedBatch(options, {
        executionTuningPlan: tuningPlan('anifor.visual-lab.execution-tuning-plan/v5'),
      }),
    });
    expect(batchCalls.map(({ captureProof }) => captureProof))
      .toEqual(Array(4).fill('fixture-activation-generation'));
    expect(result.summary.captureProof).toEqual({
      mode: 'fixture-activation-generation',
      tuningSchema: 'anifor.visual-lab.execution-tuning-plan/v5',
      receiptSchema: 'anifor.renderer.completed-frame-receipt/v1',
    });
  });

  it('forwards activation-owned work generation proof and requires tuning v6', async () => {
    const root = await temporaryRoot();
    const batchCalls = [];
    const result = await runVisualLabPerformanceCohorts({
      recipeSetPath: 'set.json', outputDir: root,
      captureProof: 'fixture-activation-work-generation',
    }, {
      assertTrackedRecipeSet: async () => {},
      readRecipeSet: async () => recipeSet(),
      runBatch: async (options) => {
        batchCalls.push(options);
        return completeBatch(options.browserHost);
      },
      verifyBatch: async (options) => verifiedBatch(options, {
        executionTuningPlan: tuningPlan('anifor.visual-lab.execution-tuning-plan/v6'),
      }),
    });
    expect(batchCalls.map(({ captureProof }) => captureProof))
      .toEqual(Array(4).fill('fixture-activation-work-generation'));
    expect(result.summary.captureProof).toEqual({
      mode: 'fixture-activation-work-generation',
      tuningSchema: 'anifor.visual-lab.execution-tuning-plan/v6',
      receiptSchema: 'anifor.renderer.completed-frame-receipt/v1',
      readinessCapability: 'renderer-fixture-activation-generation/v2',
    });
  });

  it('forwards activation-owned render-field generation proof and requires tuning v7', async () => {
    const root = await temporaryRoot();
    const batchCalls = [];
    const result = await runVisualLabPerformanceCohorts({
      recipeSetPath: 'set.json', outputDir: root,
      captureProof: 'fixture-activation-render-field-generation',
    }, {
      assertTrackedRecipeSet: async () => {},
      readRecipeSet: async () => recipeSet(),
      runBatch: async (options) => {
        batchCalls.push(options);
        return completeBatch(options.browserHost);
      },
      verifyBatch: async (options) => verifiedBatch(options, {
        executionTuningPlan: tuningPlan('anifor.visual-lab.execution-tuning-plan/v7'),
      }),
    });
    expect(batchCalls.map(({ captureProof }) => captureProof))
      .toEqual(Array(4).fill('fixture-activation-render-field-generation'));
    expect(result.summary.captureProof).toEqual({
      mode: 'fixture-activation-render-field-generation',
      tuningSchema: 'anifor.visual-lab.execution-tuning-plan/v7',
      receiptSchema: 'anifor.renderer.completed-frame-receipt/v1',
      readinessCapability: 'renderer-fixture-activation-generation/v3',
    });
  });

  it('forwards render-field generation with selection-owned alpha readback and requires tuning v9', async () => {
    const root = await temporaryRoot();
    const batchCalls = [];
    const captureProof =
      'fixture-activation-render-field-generation-and-selection-owned-alpha-readback';
    const result = await runVisualLabPerformanceCohorts({
      recipeSetPath: 'set.json', outputDir: root, captureProof,
    }, {
      assertTrackedRecipeSet: async () => {},
      readRecipeSet: async () => recipeSet(),
      runBatch: async (options) => {
        batchCalls.push(options);
        return completeBatch(options.browserHost);
      },
      verifyBatch: async (options) => verifiedBatch(options, {
        executionTuningPlan: tuningPlan('anifor.visual-lab.execution-tuning-plan/v9'),
      }),
    });
    expect(batchCalls.map(({ captureProof: forwardedProof }) => forwardedProof))
      .toEqual(Array(4).fill(captureProof));
    expect(result.summary.captureProof).toEqual({
      mode: captureProof,
      tuningSchema: 'anifor.visual-lab.execution-tuning-plan/v9',
      receiptSchema: 'anifor.renderer.completed-frame-receipt/v1',
      readinessCapability: 'renderer-fixture-activation-generation/v3',
    });
  });

  it('rejects mismatched portable tuning schemas before publishing', async () => {
    const stableRoot = await temporaryRoot();
    await expect(runVisualLabPerformanceCohorts({ recipeSetPath: 'set.json', outputDir: stableRoot }, {
      assertTrackedRecipeSet: async () => {},
      readRecipeSet: async () => recipeSet(),
      runBatch: async (options) => completeBatch(options.browserHost),
      verifyBatch: async (options) => verifiedBatch(options, {
        executionTuningPlan: tuningPlan('anifor.visual-lab.execution-tuning-plan/v2'),
      }),
    })).rejects.toThrow('requires portable anifor.visual-lab.execution-tuning-plan/v1 for stable-snapshots');
    await expect(readFile(path.join(stableRoot, 'performance-summary.json'), 'utf8'))
      .rejects.toMatchObject({ code: 'ENOENT' });

    const receiptRoot = await temporaryRoot();
    await expect(runVisualLabPerformanceCohorts({
      recipeSetPath: 'set.json', outputDir: receiptRoot, captureProof: 'completed-frame-receipt',
    }, {
      assertTrackedRecipeSet: async () => {},
      readRecipeSet: async () => recipeSet(),
      runBatch: async (options) => completeBatch(options.browserHost),
      verifyBatch: async (options) => verifiedBatch(options),
    })).rejects.toThrow('requires portable anifor.visual-lab.execution-tuning-plan/v2 for completed-frame-receipt');
    await expect(readFile(path.join(receiptRoot, 'performance-summary.json'), 'utf8'))
      .rejects.toMatchObject({ code: 'ENOENT' });
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

  it('surfaces the bounded candidate tombstone before portable verification', async () => {
    const root = await temporaryRoot();
    let verified = false;
    await expect(runVisualLabPerformanceCohorts({
      recipeSetPath: 'set.json', outputDir: root,
    }, {
      assertTrackedRecipeSet: async () => {},
      readRecipeSet: async () => recipeSet(),
      runBatch: async ({ outputDir, browserHost }) => {
        const diagnostic = 'candidates/gas-showcase/failure.log';
        await mkdir(path.dirname(path.join(outputDir, diagnostic)), { recursive: true });
        await writeFile(path.join(outputDir, diagnostic), 'capture-failed\nGPU receipt watchdog expired\n');
        return {
          ...completeBatch(browserHost),
          ok: false,
          index: {
            complete: false,
            candidates: [{
              candidate: 'gas-showcase', status: 'failed', failure: 'capture-failed',
              artifacts: { diagnostic },
            }],
          },
        };
      },
      verifyBatch: async () => { verified = true; },
    })).rejects.toThrow('GPU receipt watchdog expired');
    expect(verified).toBe(false);
    await expect(readFile(path.join(root, 'performance-summary.json'), 'utf8'))
      .rejects.toMatchObject({ code: 'ENOENT' });
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
        executionTuningPlan: tuningPlan(),
      }),
    })).rejects.toThrow('mismatched portable host plan');
  });

  it('finishes the fixed order before rejecting capture-identity drift without serializing identities', async () => {
    const root = await temporaryRoot();
    let verifications = 0;
    const changedResultId = `sha256:${'c'.repeat(64)}`;
    const changedCaptures = [
      captureSha256,
      { ...captureSha256, b: '1'.repeat(64) },
      { ...captureSha256, a: '2'.repeat(64) },
      captureSha256,
    ];
    await expect(runVisualLabPerformanceCohorts({
      recipeSetPath: 'set.json', outputDir: root,
    }, {
      assertTrackedRecipeSet: async () => {},
      readRecipeSet: async () => recipeSet(),
      runBatch: async (options) => completeBatch(options.browserHost),
      verifyBatch: async (options) => {
        verifications += 1;
        return verifiedBatch(options, {
          index: batchIndex(
            verifications === 2 || verifications === 3 ? changedResultId : resultId,
            changedCaptures[verifications - 1],
          ),
        });
      },
    })).rejects.toEqual(expect.objectContaining({
      name: 'VisualLabPerformanceIdentityMismatchError',
      message: 'Visual Lab performance cohorts changed accepted capture identity',
    }));
    expect(verifications).toBe(4);
    await expect(readFile(path.join(root, 'performance-summary.json'), 'utf8'))
      .rejects.toMatchObject({ code: 'ENOENT' });
    const diagnosticBytes = await readFile(
      path.join(root, 'performance-identity-failure.json'), 'utf8',
    );
    expect(Buffer.byteLength(diagnosticBytes)).toBeLessThanOrEqual(8_192);
    expect(JSON.parse(diagnosticBytes)).toEqual({
      schema: VISUAL_LAB_PERFORMANCE_IDENTITY_FAILURE_V2_SCHEMA,
      referenceOrdinal: 1,
      observations: [
        {
          observedOrdinal: 2,
          observedMode: 'shared',
          changedCandidateCount: 1,
          changes: [{ candidate: 'gas-showcase', variants: ['b'] }],
          omittedChangedCandidateCount: 0,
        },
        {
          observedOrdinal: 3,
          observedMode: 'shared',
          changedCandidateCount: 1,
          changes: [{ candidate: 'gas-showcase', variants: ['a'] }],
          omittedChangedCandidateCount: 0,
        },
      ],
      omittedChangedCandidateCount: 0,
    });
    expect(JSON.stringify(JSON.parse(diagnosticBytes)))
      .not.toMatch(/sha256|[0-9a-f]{64}|path|timestamp|browser|png|timing|metadata/i);
    expect((await readdir(root)).some((entry) => entry.includes('.tmp'))).toBe(false);
    expect(new VisualLabPerformanceIdentityMismatchError().message)
      .toBe('Visual Lab performance cohorts changed accepted capture identity');
  });

  it('caps retained identity changes at 64 in fixed off/a/b order and below 8 KiB', async () => {
    const root = await temporaryRoot();
    const candidates = Array.from({ length: 65 }, (_, index) => (
      `candidate-${String(index).padStart(2, '0')}`
    ));
    const sampled = Object.freeze([...candidates]);
    const cohortTiming = { ...timing, sampledCandidates: sampled };
    const cohortSubphases = { ...subphases, sampledCandidates: sampled };
    const indexFor = (changed) => ({
      complete: true,
      candidates: candidates.map((candidate) => ({
        candidate,
        status: 'passed',
        result: {
          id: changed ? `sha256:${'c'.repeat(64)}` : resultId,
          captureSha256: changed ? {
            off: '1'.repeat(64), a: '2'.repeat(64), b: '3'.repeat(64),
          } : captureSha256,
        },
      })),
    });
    const planFor = (mode) => ({
      requestedMode: mode,
      entries: candidates.map((candidate, sequence) => ({
        sequence, candidate, requestedMode: mode, effectiveMode: mode,
      })),
    });
    let runs = 0;
    const batchFor = (mode, changed) => ({
      ok: true,
      index: indexFor(changed),
      timings: cohortTiming,
      captureSubphases: cohortSubphases,
      browserHostPlan: planFor(mode),
      browserHostRuntime: {
        requestedMode: mode,
        hostsStarted: mode === 'shared' ? 1 : 0,
        hostRestarts: 0,
        launchMs: 0,
        teardownMs: 0,
        assignments: mode === 'shared'
          ? candidates.map((candidate) => ({ candidate, host: 1 })) : [],
        recycleReasons: [],
      },
    });
    await expect(runVisualLabPerformanceCohorts({
      recipeSetPath: 'set.json', outputDir: root,
    }, {
      assertTrackedRecipeSet: async () => {},
      readRecipeSet: async () => ({
        schema: 'anifor.visual-lab.recipe-set/v1',
        id: recipeSetId,
        recipes: candidates.map((name) => ({ name, renderScale: 2 })),
      }),
      runBatch: async ({ browserHost }) => {
        runs += 1;
        return batchFor(browserHost, runs === 2);
      },
      verifyBatch: async ({ batchRoot }) => {
        const mode = path.basename(batchRoot).endsWith('-shared') ? 'shared' : 'fresh';
        return {
          index: indexFor(runs === 2),
          timings: cohortTiming,
          captureSubphases: cohortSubphases,
          browserHostPlan: planFor(mode),
          executionTuningPlan: tuningPlan(),
        };
      },
    })).rejects.toBeInstanceOf(VisualLabPerformanceIdentityMismatchError);
    const bytes = await readFile(path.join(root, 'performance-identity-failure.json'), 'utf8');
    const diagnostic = JSON.parse(bytes);
    expect(Buffer.byteLength(bytes)).toBeLessThanOrEqual(8_192);
    expect(diagnostic.observations[0].changes).toHaveLength(64);
    expect(diagnostic).toMatchObject({
      schema: VISUAL_LAB_PERFORMANCE_IDENTITY_FAILURE_V2_SCHEMA,
      referenceOrdinal: 1,
      observations: [{
        observedOrdinal: 2,
        observedMode: 'shared',
        changedCandidateCount: 65,
        omittedChangedCandidateCount: 1,
      }],
      omittedChangedCandidateCount: 1,
    });
    expect(diagnostic.observations[0].changes[0].candidate).toBe('candidate-00');
    expect(diagnostic.observations[0].changes[63].candidate).toBe('candidate-63');
    expect(diagnostic.observations[0].changes[0].variants).toEqual(['off', 'a', 'b']);
    expect(JSON.stringify(diagnostic)).not.toMatch(/sha256|[0-9a-f]{64}/i);
    await expect(readFile(path.join(root, 'performance-summary.json'), 'utf8'))
      .rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects result-only identity drift as structural corruption without a failure record', async () => {
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
    })).rejects.toThrow(
      'Visual Lab performance result identity and variant hashes have inconsistent drift',
    );
    expect(verifications).toBe(2);
    await expect(readFile(path.join(root, 'performance-identity-failure.json'), 'utf8'))
      .rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readFile(path.join(root, 'performance-summary.json'), 'utf8'))
      .rejects.toMatchObject({ code: 'ENOENT' });
  });
});
