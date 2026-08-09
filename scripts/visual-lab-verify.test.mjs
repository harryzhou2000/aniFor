import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import {
  parseVisualLabVerifyArguments,
  runVisualLabPackageVerification,
} from './visual-lab-verify.mjs';

const batchEvidence = {
  index: {
    schema: 'anifor.visual-lab.batch/v1',
    complete: true,
    summary: { selected: 1, passed: 1, failed: 0 },
    candidates: [{
      candidate: 'gas-showcase',
      status: 'passed',
      result: { id: `sha256:${'1'.repeat(64)}` },
    }],
  },
  recipeSet: {
    schema: 'anifor.visual-lab.recipe-set/v1',
    id: `sha256:${'2'.repeat(64)}`,
    name: 'gas-review',
  },
  browserHostPlan: {
    schema: 'anifor.visual-lab.browser-host-plan/v1',
    id: `sha256:${'4'.repeat(64)}`,
    requestedMode: 'shared',
  },
  executionTuningPlan: {
    schema: 'anifor.visual-lab.execution-tuning-plan/v1',
    id: `sha256:${'5'.repeat(64)}`,
    gpuMode: 'swiftshader',
  },
};

const comparisonEvidence = {
  comparison: {
    schema: 'anifor.visual-lab.comparison/v1',
    id: `sha256:${'3'.repeat(64)}`,
    complete: true,
    summary: {
      baseline: 1,
      selected: 1,
      compared: 1,
      identical: 0,
      review: 1,
      added: 0,
      notSampled: 0,
    },
  },
};

describe('Visual Lab portable package verifier', () => {
  it('parses one read-only batch or batch-plus-comparison request strictly', () => {
    expect(parseVisualLabVerifyArguments(['--batch-root=artifacts/review'])).toEqual({
      help: false,
      batchRoot: 'artifacts/review',
      baselineRoot: undefined,
      comparisonRoot: undefined,
      recipeSetSourcePath: undefined,
      requireBrowserHostPlan: false,
      requireExecutionTuningPlan: false,
      requireComplete: true,
      requireRecipeSet: false,
    });
    expect(parseVisualLabVerifyArguments([
      '--batch-root=artifacts/review',
      '--baseline-root=visual-baselines/accepted-v1',
      '--recipe-set-source=visual-lab/recipe-sets/release.json',
      '--require-complete=0',
      '--require-recipe-set=1',
      '--require-browser-host-plan=1',
      '--require-execution-tuning-plan=1',
    ])).toEqual({
      help: false,
      batchRoot: 'artifacts/review',
      baselineRoot: 'visual-baselines/accepted-v1',
      comparisonRoot: 'artifacts/review/comparison',
      recipeSetSourcePath: 'visual-lab/recipe-sets/release.json',
      requireBrowserHostPlan: true,
      requireExecutionTuningPlan: true,
      requireComplete: false,
      requireRecipeSet: true,
    });
    expect(parseVisualLabVerifyArguments(['--help'])).toEqual({ help: true });
    expect(() => parseVisualLabVerifyArguments([])).toThrow('--batch-root is required');
    expect(() => parseVisualLabVerifyArguments([
      '--batch-root=batch', '--comparison-root=comparison',
    ])).toThrow('requires --baseline-root');
    expect(() => parseVisualLabVerifyArguments([
      '--batch-root=batch', '--require-complete=yes',
    ])).toThrow('must be 0 or 1');
    expect(() => parseVisualLabVerifyArguments([
      '--batch-root=batch', '--batch-root=again',
    ])).toThrow('only be provided once');
    expect(() => parseVisualLabVerifyArguments([
      '--batch-root=batch', '--unknown=value',
    ])).toThrow('Unknown option');
  });

  it('composes reusable batch and comparison validators into a frozen summary', async () => {
    const calls = [];
    const result = await runVisualLabPackageVerification({
      batchRoot: 'downloaded-review',
      baselineRoot: 'accepted',
      comparisonRoot: 'downloaded-review/comparison',
      recipeSetSourcePath: 'release.json',
      requireBrowserHostPlan: true,
      requireExecutionTuningPlan: true,
      requireComplete: true,
      requireRecipeSet: true,
    }, {
      verifyBatch: async (options) => { calls.push(['batch', options]); return batchEvidence; },
      verifyComparison: async (options) => {
        calls.push(['comparison', options]);
        return comparisonEvidence;
      },
    });

    expect(calls).toEqual([
      ['batch', {
        batchRoot: 'downloaded-review',
        requireBrowserHostPlan: true,
        requireExecutionTuningPlan: true,
        requireComplete: true,
        requireRecipeSet: true,
        recipeSetSourcePath: 'release.json',
      }],
      ['comparison', {
        baselineRoot: 'accepted',
        resultRoot: 'downloaded-review',
        comparisonRoot: 'downloaded-review/comparison',
      }],
    ]);
    expect(result).toEqual({
      tool: 'visual-lab-package-verifier-v1',
      ok: true,
      batch: {
        schema: 'anifor.visual-lab.batch/v1',
        complete: true,
        summary: { selected: 1, passed: 1, failed: 0 },
        resultIds: [`sha256:${'1'.repeat(64)}`],
      },
      recipeSet: {
        schema: 'anifor.visual-lab.recipe-set/v1',
        id: `sha256:${'2'.repeat(64)}`,
        name: 'gas-review',
      },
      browserHostPlan: batchEvidence.browserHostPlan,
      executionTuningPlan: batchEvidence.executionTuningPlan,
      comparison: comparisonEvidence.comparison,
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.batch.summary)).toBe(true);

    const batchOnly = await runVisualLabPackageVerification({
      batchRoot: 'legacy', requireComplete: false, requireRecipeSet: false,
    }, {
      verifyBatch: async () => ({
        ...batchEvidence, recipeSet: null, browserHostPlan: null, executionTuningPlan: null,
      }),
      verifyComparison: async () => { throw new Error('must not run'); },
    });
    expect(batchOnly.recipeSet).toBeNull();
    expect(batchOnly.browserHostPlan).toBeNull();
    expect(batchOnly.executionTuningPlan).toBeNull();
    expect(batchOnly.comparison).toBeNull();
  });

  it('rejects inconsistent direct orchestration options before invoking validators', async () => {
    await expect(runVisualLabPackageVerification({
      batchRoot: 'batch', comparisonRoot: 'comparison',
    })).rejects.toThrow('requires baselineRoot');
    await expect(runVisualLabPackageVerification({
      batchRoot: 'batch', baselineRoot: 'accepted',
    })).rejects.toThrow('requires comparisonRoot');
    await expect(runVisualLabPackageVerification({
      batchRoot: 'batch', mutation: true,
    })).rejects.toThrow('Unknown Visual Lab package verification option');
  });

  it('keeps the package command and CI artifact round trip wired to the shared verifier', async () => {
    const [workflow, packageJson] = await Promise.all([
      readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8'),
      readFile(new URL('../package.json', import.meta.url), 'utf8').then(JSON.parse),
    ]);
    expect(packageJson.scripts['audit:visual-lab:verify'])
      .toBe('node scripts/visual-lab-verify.mjs');
    const upload = workflow.indexOf('Upload Visual Lab review evidence');
    const download = workflow.indexOf('Download uploaded Visual Lab review evidence');
    const verify = workflow.indexOf('node scripts/visual-lab-verify.mjs "${verify_args[@]}"');
    const deployVerification = workflow.indexOf('  verify-deployment:');
    const deploySuccessGuard = workflow.indexOf(
      "if: always() && needs.deploy.result == 'success'", deployVerification,
    );
    const liveVerification = workflow.indexOf(
      'node scripts/verify-live-pages.mjs "${PAGE_URL}" "${GITHUB_SHA}"',
      deployVerification,
    );
    expect(upload).toBeGreaterThan(0);
    expect(download).toBeGreaterThan(upload);
    expect(verify).toBeGreaterThan(download);
    expect(workflow).toContain('"--batch-root=${REVIEW_ROOT}"');
    expect(workflow).toContain('--baseline-root=visual-baselines/accepted-v1');
    expect(workflow).toContain('"--comparison-root=${REVIEW_ROOT}/comparison"');
    expect(workflow).toContain('--require-complete=1');
    expect(workflow).toContain('--require-recipe-set=1');
    expect(workflow).toContain('--require-browser-host-plan=1');
    expect(workflow).toContain('--require-execution-tuning-plan=1');
    expect(deployVerification).toBeGreaterThan(verify);
    expect(deploySuccessGuard).toBeGreaterThan(deployVerification);
    expect(liveVerification).toBeGreaterThan(deploySuccessGuard);
  });
});
