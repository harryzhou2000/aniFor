import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  parseVisualLabReviewArguments,
  runVisualLabReviewCycle,
} from './visual-lab-review.mjs';

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    rm(directory, { recursive: true, force: true })
  )));
});

const temporaryDirectory = async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'visual-lab-review-test-'));
  temporaryDirectories.push(directory);
  return directory;
};

const completeBatch = (outputDir) => ({
  ok: true,
  exitCode: 0,
  index: { complete: true },
  indexPath: path.join(outputDir, 'index.json'),
  contactSheetPath: path.join(outputDir, 'index.html'),
  recipeSet: { id: 'sha256:recipe-set' },
  recipeSetPath: path.join(outputDir, 'recipe-set.json'),
});

const completeComparison = (outputDir) => ({
  comparison: { id: 'sha256:comparison' },
  html: path.join(outputDir, 'index.html'),
  brief: path.join(outputDir, 'brief.html'),
  board: path.join(outputDir, 'board.html'),
  metricsPath: path.join(outputDir, 'metrics.json'),
  json: path.join(outputDir, 'comparison.json'),
});

describe('Visual Lab review-cycle CLI', () => {
  it('accepts the batch selection flags, requires output, and defaults the accepted baseline', () => {
    const parsed = parseVisualLabReviewArguments([
      '--candidates=oxygen-showcase,water-motion',
      '--bundle=dist/index.html',
      '--capture-proof=completed-frame-receipt',
      '--output-dir=artifacts/review',
      '--chrome=/usr/bin/chrome',
      '--gpu=swiftshader',
      '--browser-host=shared',
      '--candidate-timeout-ms=123456',
    ]);

    expect(parsed).toMatchObject({
      help: false,
      candidates: ['oxygen-showcase', 'water-motion'],
      bundle: 'dist/index.html',
      outputDir: 'artifacts/review',
      chrome: '/usr/bin/chrome',
      gpu: 'swiftshader',
      browserHost: 'shared',
      candidateTimeoutMs: 123456,
      captureProof: 'completed-frame-receipt',
    });
    expect(parsed.baselineRoot).toBe(path.resolve('visual-baselines/accepted-v1'));
    expect(parsed).not.toHaveProperty('indexOnly');
    expect(parsed).not.toHaveProperty('planOnly');

    expect(parseVisualLabReviewArguments([
      '--output-dir=hosted-review',
      '--base-url=https://example.invalid/anifortpt',
      '--expected-revision=1234567890abcdef1234567890abcdef12345678',
    ])).toMatchObject({
      baseUrl: 'https://example.invalid/anifortpt/',
      expectedRevision: '1234567890abcdef1234567890abcdef12345678',
    });

    expect(parseVisualLabReviewArguments([
      '--recipe-set=visual-lab/recipe-sets/release.json',
      '--baseline-root=visual-baselines/custom',
      '--output-dir=artifacts/review',
    ])).toMatchObject({
      recipeSetPath: 'visual-lab/recipe-sets/release.json',
      baselineRoot: 'visual-baselines/custom',
      outputDir: 'artifacts/review',
    });
    expect(parseVisualLabReviewArguments(['--help'])).toEqual({ help: true });

    expect(() => parseVisualLabReviewArguments([])).toThrow('--output-dir is required');
    expect(() => parseVisualLabReviewArguments(['--output-dir=review', '--index-only=0']))
      .toThrow('--index-only is not supported');
    expect(() => parseVisualLabReviewArguments(['--output-dir=review', '--index-only=1']))
      .toThrow('--index-only is not supported');
    expect(() => parseVisualLabReviewArguments(['--output-dir=review', '--plan-only=1']))
      .toThrow('--plan-only is not supported');
    expect(() => parseVisualLabReviewArguments([
      '--output-dir=review', '--candidates=gas-showcase', '--recipe-set=set.json',
    ])).toThrow('mutually exclusive');
    expect(() => parseVisualLabReviewArguments([
      '--output-dir=review', '--bundle=dist/index.html', '--base-url=https://example.invalid/game/',
    ])).toThrow('mutually exclusive');
  });
});

describe('Visual Lab review-cycle orchestration', () => {
  it('runs selected candidates through batch, comparison, then complete portable verification', async () => {
    const root = await temporaryDirectory();
    const outputDir = path.join(root, 'batch');
    const baselineRoot = path.join(root, 'accepted');
    const calls = [];
    const result = await runVisualLabReviewCycle({
      candidates: ['water-motion'],
      bundle: 'dist/index.html',
      outputDir,
      chrome: '/usr/bin/chrome',
      gpu: 'swiftshader',
      browserHost: 'shared',
      candidateTimeoutMs: 987,
      baselineRoot,
    }, {
      runBatch: async (options) => { calls.push(['batch', options]); return completeBatch(outputDir); },
      runBaseline: async (options) => {
        calls.push(['baseline', options]);
        return completeComparison(options.outputDir);
      },
      verifyPackage: async (options) => {
        calls.push(['verify', options]);
        return {
          ok: true,
          tool: 'visual-lab-package-verifier-v1',
          comparison: { id: 'sha256:comparison' },
        };
      },
    });

    const comparisonRoot = path.join(outputDir, 'comparison');
    expect(calls).toEqual([
      ['batch', {
        candidates: ['water-motion'],
        bundle: 'dist/index.html',
        outputDir,
        chrome: '/usr/bin/chrome',
        gpu: 'swiftshader',
        browserHost: 'shared',
        candidateTimeoutMs: 987,
      }],
      ['baseline', {
        mode: 'compare', baselineRoot, resultRoot: outputDir, outputDir: comparisonRoot,
      }],
      ['verify', {
        batchRoot: outputDir,
        baselineRoot,
        comparisonRoot,
        requireBaselineCaptureProvenance: true,
        requireBrowserHostPlan: true,
        requireCaptureGeometry: true,
        requireExecutionTuningPlan: true,
        requireOriginAttestation: false,
        requireComplete: true,
        requireRecipeSet: true,
      }],
    ]);
    expect(result).toMatchObject({
      ok: true,
      reviewRoot: outputDir,
      batch: { index: path.join(outputDir, 'index.json') },
      comparison: { id: 'sha256:comparison', json: path.join(comparisonRoot, 'comparison.json') },
    });
  });

  it('reads exactly the selected recipe set and never forwards a competing candidate selection', async () => {
    const root = await temporaryDirectory();
    const outputDir = path.join(root, 'batch');
    const recipeSetPath = path.join(root, 'release.json');
    const recipeSet = Object.freeze({ schema: 'anifor.visual-lab.recipe-set/v1', id: 'set-id' });
    const calls = [];

    await runVisualLabReviewCycle({
      recipeSetPath,
      outputDir,
      baselineRoot: path.join(root, 'accepted'),
    }, {
      readRecipeSet: async (input) => { calls.push(['read', input]); return recipeSet; },
      runBatch: async (options) => { calls.push(['batch', options]); return completeBatch(outputDir); },
      runBaseline: async (options) => {
        calls.push(['baseline', options]);
        return completeComparison(options.outputDir);
      },
      verifyPackage: async (options) => {
        calls.push(['verify', options]);
        return { ok: true, comparison: { id: 'sha256:comparison' } };
      },
    });

    expect(calls[0]).toEqual(['read', recipeSetPath]);
    expect(calls[1][0]).toBe('batch');
    expect(calls[1][1]).toMatchObject({ recipeSet, recipeSetSourcePath: recipeSetPath, outputDir });
    expect(calls[1][1]).not.toHaveProperty('candidates');
  });

  it('forwards a hosted base URL and receipt proof unchanged to the shared batch runner', async () => {
    const root = await temporaryDirectory();
    const outputDir = path.join(root, 'batch');
    const calls = [];

    await runVisualLabReviewCycle({
      candidates: ['water-motion'],
      baseUrl: 'https://example.invalid/anifortpt/',
      expectedRevision: '1234567890abcdef1234567890abcdef12345678',
      captureProof: 'completed-frame-receipt',
      outputDir,
      baselineRoot: path.join(root, 'accepted'),
    }, {
      runBatch: async (options) => { calls.push(['batch', options]); return completeBatch(outputDir); },
      runBaseline: async (options) => {
        calls.push(['baseline', options]);
        return completeComparison(options.outputDir);
      },
      verifyPackage: async (options) => {
        calls.push(['verify', options]);
        return { ok: true, comparison: { id: 'sha256:comparison' } };
      },
    });

    expect(calls[0]).toEqual(['batch', {
      candidates: ['water-motion'],
      baseUrl: 'https://example.invalid/anifortpt/',
      expectedRevision: '1234567890abcdef1234567890abcdef12345678',
      captureProof: 'completed-frame-receipt',
      outputDir,
    }]);
    expect(calls[2][1]).toMatchObject({
      requireCaptureGeometry: true,
      requireExecutionTuningPlan: true,
      requireOriginAttestation: true,
    });
  });

  it('stops before comparison and verification when capture reports an incomplete batch or throws', async () => {
    const root = await temporaryDirectory();
    const options = {
      candidates: ['gas-showcase'], outputDir: path.join(root, 'batch'), baselineRoot: path.join(root, 'accepted'),
    };
    let laterCalls = 0;
    await expect(runVisualLabReviewCycle(options, {
      runBatch: async () => ({ ok: false, index: { complete: false } }),
      runBaseline: async () => { laterCalls++; },
      verifyPackage: async () => { laterCalls++; },
    })).rejects.toThrow('complete');
    expect(laterCalls).toBe(0);

    await expect(runVisualLabReviewCycle(options, {
      runBatch: async () => { throw new Error('capture failed'); },
      runBaseline: async () => { laterCalls++; },
      verifyPackage: async () => { laterCalls++; },
    })).rejects.toThrow('capture failed');
    expect(laterCalls).toBe(0);
  });

  it('does not publish success when interrupted during portable verification', async () => {
    const root = await temporaryDirectory();
    const outputDir = path.join(root, 'batch');
    const controller = new AbortController();
    await expect(runVisualLabReviewCycle({
      candidates: ['gas-showcase'],
      outputDir,
      baselineRoot: path.join(root, 'accepted'),
      signal: controller.signal,
    }, {
      runBatch: async () => completeBatch(outputDir),
      runBaseline: async (options) => completeComparison(options.outputDir),
      verifyPackage: async () => {
        controller.abort(new Error('interrupted during verification'));
        return { ok: true, comparison: { id: 'sha256:comparison' } };
      },
    })).rejects.toThrow('interrupted during verification');
  });

  it('rejects unsafe output topology before capture', async () => {
    const root = await temporaryDirectory();
    const outputDir = path.join(root, 'batch');
    const runBatch = async () => { throw new Error('capture must not start'); };

    await expect(runVisualLabReviewCycle({
      candidates: ['gas-showcase'], outputDir, baselineRoot: outputDir,
    }, { runBatch })).rejects.toThrow('disjoint');

    await mkdir(outputDir);
    await writeFile(path.join(outputDir, 'stale.txt'), 'stale review evidence');
    await expect(runVisualLabReviewCycle({
      candidates: ['gas-showcase'], outputDir, baselineRoot: path.join(root, 'accepted'),
    }, { runBatch })).rejects.toThrow('review output must be empty');

    const realOutput = path.join(root, 'real-output');
    const linkedOutput = path.join(root, 'linked-output');
    await mkdir(realOutput);
    await symlink(realOutput, linkedOutput, 'dir');
    await expect(runVisualLabReviewCycle({
      candidates: ['gas-showcase'], outputDir: linkedOutput,
      baselineRoot: path.join(root, 'accepted'),
    }, { runBatch })).rejects.toThrow('review output must be a real directory');
  });
});
