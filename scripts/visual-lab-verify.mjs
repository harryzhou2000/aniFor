import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { verifyVisualLabComparisonPackage } from './visual-lab-baseline.mjs';
import { verifyVisualLabBatchPackage } from './visual-lab-batch.mjs';

const MODULE_PATH = fileURLToPath(import.meta.url);

const HELP = `Usage:
  node scripts/visual-lab-verify.mjs \\
    --batch-root=<downloaded-batch> \\
    [--baseline-root=<accepted-baseline>] \\
    [--comparison-root=<comparison-package>] \\
    [--recipe-set-source=<checked-recipe-set>] \\
    [--require-complete=0|1] [--require-recipe-set=0|1] \
    [--require-browser-host-plan=0|1] [--require-execution-tuning-plan=0|1] \
    [--require-origin-attestation=0|1]

The verifier is read-only. It reconstructs the batch from reports and PNGs,
checks the deterministic contact sheet and optional recipe-set sidecar, and can
also apply the promotion-grade accepted-baseline comparison validation. When a
baseline is supplied, comparison-root defaults to <batch-root>/comparison.`;

const BOOLEAN_OPTIONS = new Set([
  'require-browser-host-plan', 'require-execution-tuning-plan',
  'require-complete', 'require-origin-attestation', 'require-recipe-set',
]);
const PATH_OPTIONS = new Set([
  'batch-root', 'baseline-root', 'comparison-root', 'recipe-set-source',
]);
const KNOWN_OPTIONS = new Set([...BOOLEAN_OPTIONS, ...PATH_OPTIONS]);

const parseBoolean = (values, name, fallback) => {
  const value = values.get(name);
  if (value === undefined) return fallback;
  if (value !== '0' && value !== '1') throw new Error(`--${name} must be 0 or 1`);
  return value === '1';
};

export function parseVisualLabVerifyArguments(argv) {
  if (!Array.isArray(argv)) throw new TypeError('arguments must be an array');
  if (argv.includes('--help') || argv.includes('-h')) return Object.freeze({ help: true });
  const values = new Map();
  for (const argument of argv) {
    if (!argument.startsWith('--') || !argument.includes('=')) {
      throw new Error(`Unknown argument ${JSON.stringify(argument)}; options use --name=value`);
    }
    const separator = argument.indexOf('=');
    const name = argument.slice(2, separator);
    if (!KNOWN_OPTIONS.has(name)) throw new Error(`Unknown option --${name}`);
    if (values.has(name)) throw new Error(`Option --${name} may only be provided once`);
    values.set(name, argument.slice(separator + 1));
  }
  for (const name of PATH_OPTIONS) {
    if (values.has(name) && values.get(name).length === 0) {
      throw new Error(`--${name} must not be empty`);
    }
  }
  if (!values.has('batch-root')) throw new Error('--batch-root is required');
  if (values.has('comparison-root') && !values.has('baseline-root')) {
    throw new Error('--comparison-root requires --baseline-root');
  }
  const batchRoot = values.get('batch-root');
  const baselineRoot = values.get('baseline-root');
  return Object.freeze({
    help: false,
    batchRoot,
    baselineRoot,
    comparisonRoot: baselineRoot === undefined
      ? undefined : values.get('comparison-root') ?? path.join(batchRoot, 'comparison'),
    recipeSetSourcePath: values.get('recipe-set-source'),
    requireBrowserHostPlan: parseBoolean(values, 'require-browser-host-plan', false),
    requireExecutionTuningPlan: parseBoolean(
      values, 'require-execution-tuning-plan', false,
    ),
    requireOriginAttestation: parseBoolean(
      values, 'require-origin-attestation', false,
    ),
    requireComplete: parseBoolean(values, 'require-complete', true),
    requireRecipeSet: parseBoolean(values, 'require-recipe-set', false),
  });
}

const deepFreeze = (value) => {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
};

export async function runVisualLabPackageVerification(options, dependencies = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Visual Lab package verification options must be an object');
  }
  const allowed = new Set([
    'batchRoot', 'baselineRoot', 'comparisonRoot', 'recipeSetSourcePath',
    'requireBrowserHostPlan', 'requireExecutionTuningPlan',
    'requireComplete', 'requireOriginAttestation', 'requireRecipeSet',
  ]);
  const unexpected = Reflect.ownKeys(options).filter((key) => !allowed.has(key));
  if (unexpected.length > 0) {
    throw new TypeError(`Unknown Visual Lab package verification option ${String(unexpected[0])}`);
  }
  if (options.baselineRoot === undefined && options.comparisonRoot !== undefined) {
    throw new TypeError('comparisonRoot requires baselineRoot');
  }
  if (options.baselineRoot !== undefined && options.comparisonRoot === undefined) {
    throw new TypeError('baselineRoot requires comparisonRoot');
  }

  const verifyBatch = dependencies.verifyBatch ?? verifyVisualLabBatchPackage;
  const verifyComparison = dependencies.verifyComparison
    ?? verifyVisualLabComparisonPackage;
  const batch = await verifyBatch({
    batchRoot: options.batchRoot,
    requireBrowserHostPlan: options.requireBrowserHostPlan ?? false,
    requireExecutionTuningPlan: options.requireExecutionTuningPlan ?? false,
    requireOriginAttestation: options.requireOriginAttestation ?? false,
    requireComplete: options.requireComplete ?? true,
    requireRecipeSet: options.requireRecipeSet ?? false,
    ...(options.recipeSetSourcePath === undefined
      ? {} : { recipeSetSourcePath: options.recipeSetSourcePath }),
  });
  const comparison = options.baselineRoot === undefined ? null : await verifyComparison({
    baselineRoot: options.baselineRoot,
    resultRoot: options.batchRoot,
    comparisonRoot: options.comparisonRoot,
  });

  return deepFreeze({
    tool: 'visual-lab-package-verifier-v1',
    ok: true,
    batch: {
      schema: batch.index.schema,
      complete: batch.index.complete,
      summary: batch.index.summary,
      resultIds: batch.index.candidates
        .filter(({ status }) => status === 'passed')
        .map(({ result }) => result.id),
    },
    browserHostPlan: batch.browserHostPlan === null ? null : {
      schema: batch.browserHostPlan.schema,
      id: batch.browserHostPlan.id,
      requestedMode: batch.browserHostPlan.requestedMode,
    },
    executionTuningPlan: batch.executionTuningPlan === null ? null : {
      schema: batch.executionTuningPlan.schema,
      id: batch.executionTuningPlan.id,
      gpuMode: batch.executionTuningPlan.gpuMode,
    },
    originAttestation: batch.originAttestation == null ? null : {
      schema: batch.originAttestation.schema,
      baseUrl: batch.originAttestation.baseUrl,
      revision: batch.originAttestation.revision,
      checkedResources: batch.originAttestation.checkedResources,
    },
    captureSubphases: batch.captureSubphases,
    recipeSet: batch.recipeSet === null ? null : {
      schema: batch.recipeSet.schema,
      id: batch.recipeSet.id,
      name: batch.recipeSet.name,
    },
    comparison: comparison === null ? null : {
      schema: comparison.comparison.schema,
      id: comparison.comparison.id,
      complete: comparison.comparison.complete,
      summary: comparison.comparison.summary,
    },
  });
}

const main = async () => {
  try {
    const options = parseVisualLabVerifyArguments(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(`${HELP}\n`);
      return;
    }
    const { help: _help, ...verificationOptions } = options;
    const result = await runVisualLabPackageVerification(verificationOptions);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      tool: 'visual-lab-package-verifier-v1',
      ok: false,
      error: error?.stack ?? String(error),
    })}\n`);
    process.exitCode = 1;
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === MODULE_PATH) void main();
