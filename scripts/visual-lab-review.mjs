import { lstat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseVisualLabBatchArguments,
  runVisualLabBatch,
} from './visual-lab-batch.mjs';
import { runVisualLabBaseline } from './visual-lab-baseline.mjs';
import { readVisualLabRecipeSet } from './visual-lab-recipe-set.mjs';
import { runVisualLabPackageVerification } from './visual-lab-verify.mjs';

const MODULE_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIRECTORY = path.dirname(MODULE_PATH);
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, '..');
const TOOL = 'visual-lab-review-cycle-v1';

const HELP = `Usage:
  node scripts/visual-lab-review.mjs \\
    --output-dir=<new-review-root> \\
    [--baseline-root=<accepted-baseline>] \\
    [--candidates=<name[,name...]> | --recipe-set=<recipe-set.json>] \\
    [--bundle=<dist/index.html> | --base-url=<http(s)-origin>] \\
    [--expected-revision=<40-hex-commit>] \\
    [--chrome=<path>] [--gpu=auto|swiftshader] [--browser-host=fresh|shared] \\
    [--capture-proof=stable-snapshots|completed-frame-receipt|readiness-completed-frame-receipt] \\
    [--candidate-timeout-ms=<milliseconds>]

Runs one trusted review cycle against one existing production bundle or hosted origin:
capture the selected recipes and verify the exact current-only portable package.
When --baseline-root is explicitly supplied, a legacy comparison is also written
beneath <new-review-root>/comparison. This command never promotes a baseline, records a
visual decision, opens a browser UI, or mutates version control.`;

const displayError = (error) => error?.stack ?? String(error);

const deepFreeze = (value) => {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
};

const resolvedPath = (value, label) => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty path`);
  }
  return path.resolve(value);
};

const rootsOverlap = (left, right) => (
  left === right
  || left.startsWith(`${right}${path.sep}`)
  || right.startsWith(`${left}${path.sep}`)
);

const pathDetails = async (target) => {
  try { return await lstat(target); }
  catch (error) {
    if (error?.code === 'ENOENT') return undefined;
    throw error;
  }
};

const assertReviewOutputReady = async (outputDirectory) => {
  const details = await pathDetails(outputDirectory);
  if (details === undefined) return;
  if (details.isSymbolicLink() || !details.isDirectory()) {
    throw new Error(`review output must be a real directory: ${outputDirectory}`);
  }
  if ((await readdir(outputDirectory)).length > 0) {
    throw new Error(`review output must be empty: ${outputDirectory}`);
  }
};

const assertComparisonOutputReady = async (comparisonRoot) => {
  const details = await pathDetails(comparisonRoot);
  if (details === undefined) return;
  if (details.isSymbolicLink() || !details.isDirectory()) {
    throw new Error(`comparison output must be a real directory: ${comparisonRoot}`);
  }
  if ((await readdir(comparisonRoot)).length > 0) {
    throw new Error(`comparison output must be empty: ${comparisonRoot}`);
  }
};

const throwIfAborted = (signal) => {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error
    ? signal.reason
    : new Error('Visual Lab review cycle interrupted');
};

/**
 * Reuses the batch parser for every capture flag and owns only baseline-root
 * plus the requirement for an explicit review root.
 */
export function parseVisualLabReviewArguments(argv) {
  if (!Array.isArray(argv)) throw new TypeError('arguments must be an array');
  if (argv.includes('--help') || argv.includes('-h')) return Object.freeze({ help: true });
  for (const unsupported of ['index-only', 'plan-only']) {
    if (argv.some((argument) => argument.startsWith(`--${unsupported}=`))) {
      throw new Error(`--${unsupported} is not supported by a complete review cycle`);
    }
  }

  let baselineRoot;
  const batchArguments = [];
  for (const argument of argv) {
    if (argument.startsWith('--baseline-root=')) {
      if (baselineRoot !== undefined) {
        throw new Error('Option --baseline-root may only be provided once');
      }
      baselineRoot = argument.slice('--baseline-root='.length);
      if (baselineRoot.length === 0) throw new Error('--baseline-root must not be empty');
    } else {
      batchArguments.push(argument);
    }
  }

  const parsedBatch = parseVisualLabBatchArguments(batchArguments);
  if (parsedBatch.help) return Object.freeze({ help: true });
  if (parsedBatch.outputDir === undefined) throw new Error('--output-dir is required');
  if (parsedBatch.indexOnly) throw new Error('--index-only is not supported');
  const {
    indexOnly: _indexOnly,
    planOnly: _planOnly,
    ...batchOptions
  } = parsedBatch;
  return Object.freeze({
    ...batchOptions,
    ...(baselineRoot === undefined ? {} : { baselineRoot }),
  });
}

/**
 * Thin orchestration over the existing capture, comparison, and portable
 * verifier APIs. It creates no new evidence schema and never promotes.
 */
export async function runVisualLabReviewCycle(options = {}, dependencies = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Visual Lab review cycle options must be an object');
  }
  const allowed = new Set([
    'baseUrl', 'baselineRoot', 'browserHost', 'bundle', 'candidateTimeoutMs', 'candidates',
    'captureProof', 'chrome', 'expectedRevision', 'gpu', 'outputDir', 'recipeSetPath', 'signal',
  ]);
  const unexpected = Reflect.ownKeys(options).filter((key) => !allowed.has(key));
  if (unexpected.length > 0) {
    throw new TypeError(`Unknown Visual Lab review cycle option ${String(unexpected[0])}`);
  }
  if (options.recipeSetPath !== undefined && options.candidates !== undefined) {
    throw new TypeError('Visual Lab review recipeSetPath and candidates are mutually exclusive');
  }

  const outputDirectory = resolvedPath(options.outputDir, 'Visual Lab review output directory');
  const baselineRoot = options.baselineRoot === undefined ? undefined : resolvedPath(
    options.baselineRoot, 'accepted baseline root',
  );
  const comparisonRoot = path.join(outputDirectory, 'comparison');
  if (baselineRoot !== undefined && rootsOverlap(outputDirectory, baselineRoot)) {
    throw new Error('accepted baseline and review output must be disjoint');
  }
  await assertReviewOutputReady(outputDirectory);
  if (baselineRoot !== undefined) await assertComparisonOutputReady(comparisonRoot);
  throwIfAborted(options.signal);

  const readRecipeSet = dependencies.readRecipeSet ?? readVisualLabRecipeSet;
  const runBatch = dependencies.runBatch ?? runVisualLabBatch;
  const runBaseline = dependencies.runBaseline ?? runVisualLabBaseline;
  const verifyPackage = dependencies.verifyPackage ?? runVisualLabPackageVerification;

  let recipeSet;
  let recipeSetSourcePath;
  if (options.recipeSetPath !== undefined) {
    recipeSetSourcePath = resolvedPath(options.recipeSetPath, 'Visual Lab recipe-set source');
    recipeSet = await readRecipeSet(recipeSetSourcePath);
    throwIfAborted(options.signal);
  }

  const batch = await runBatch({
    outputDir: outputDirectory,
    ...(options.baseUrl === undefined ? {} : { baseUrl: options.baseUrl }),
    ...(options.bundle === undefined ? {} : { bundle: options.bundle }),
    ...(options.captureProof === undefined ? {} : { captureProof: options.captureProof }),
    ...(options.chrome === undefined ? {} : { chrome: options.chrome }),
    ...(options.expectedRevision === undefined
      ? {} : { expectedRevision: options.expectedRevision }),
    ...(options.gpu === undefined ? {} : { gpu: options.gpu }),
    ...(options.browserHost === undefined ? {} : { browserHost: options.browserHost }),
    ...(options.candidateTimeoutMs === undefined
      ? {} : { candidateTimeoutMs: options.candidateTimeoutMs }),
    ...(recipeSet === undefined ? { candidates: options.candidates } : {
      recipeSet,
      recipeSetSourcePath,
    }),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  });
  if (batch?.ok !== true || batch?.exitCode !== 0 || batch?.index?.complete !== true) {
    throw new Error('Visual Lab review capture batch is incomplete; comparison was not generated');
  }
  throwIfAborted(options.signal);

  const comparison = baselineRoot === undefined ? null : await runBaseline({
    mode: 'compare', baselineRoot, resultRoot: outputDirectory, outputDir: comparisonRoot,
  });
  throwIfAborted(options.signal);

  const verification = await verifyPackage({
    batchRoot: outputDirectory,
    ...(baselineRoot === undefined ? {} : { baselineRoot, comparisonRoot }),
    ...(recipeSetSourcePath === undefined ? {} : { recipeSetSourcePath }),
    requireBaselineCaptureProvenance: baselineRoot !== undefined,
    requireBrowserHostPlan: true,
    requireCaptureGeometry: true,
    requireExecutionTuningPlan: true,
    requireExperimentResponse: true,
    requireOriginAttestation: options.baseUrl !== undefined,
    requireComplete: true,
    requireRecipeSet: true,
  });
  throwIfAborted(options.signal);
  if (verification?.ok !== true) {
    throw new Error('Visual Lab review package verifier did not confirm the generated package');
  }
  if (comparison !== null && verification.comparison?.id !== comparison.comparison?.id) {
    throw new Error('Visual Lab review verifier returned a different comparison identity');
  }

  return deepFreeze({
    tool: TOOL,
    ok: true,
    reviewRoot: outputDirectory,
    batch: {
      index: batch.indexPath,
      contactSheet: batch.contactSheetPath,
      response: batch.responsePath,
      experimentBoard: batch.experimentBoardPath,
    },
    recipeSet: {
      id: batch.recipeSet.id,
      path: batch.recipeSetPath,
    },
    comparison: comparison === null ? null : {
      id: comparison.comparison.id,
      index: comparison.html,
      brief: comparison.brief,
      board: comparison.board,
      response: comparison.responsePath,
      experimentBoard: comparison.experimentBoard,
      metrics: comparison.metricsPath,
      json: comparison.json,
    },
    verification,
  });
}

const main = async () => {
  const controller = new AbortController();
  let interruptedExitCode;
  const interrupt = (exitCode) => {
    interruptedExitCode ??= exitCode;
    controller.abort(new Error('Visual Lab review cycle interrupted'));
  };
  const onSigint = () => interrupt(130);
  const onSigterm = () => interrupt(143);
  process.once('SIGINT', onSigint);
  process.once('SIGTERM', onSigterm);
  try {
    const options = parseVisualLabReviewArguments(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(`${HELP}\n`);
      return;
    }
    const { help: _help, ...cycleOptions } = options;
    const result = await runVisualLabReviewCycle({
      ...cycleOptions,
      signal: controller.signal,
    });
    process.stdout.write(`${JSON.stringify({
      tool: result.tool,
      ok: result.ok,
      reviewRoot: result.reviewRoot,
      recipeSet: result.recipeSet,
      comparison: result.comparison,
    })}\n`);
    process.exitCode = interruptedExitCode ?? 0;
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      tool: TOOL,
      ok: false,
      error: displayError(error),
    })}\n`);
    process.exitCode = interruptedExitCode ?? 1;
  } finally {
    process.removeListener('SIGINT', onSigint);
    process.removeListener('SIGTERM', onSigterm);
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === MODULE_PATH) void main();
