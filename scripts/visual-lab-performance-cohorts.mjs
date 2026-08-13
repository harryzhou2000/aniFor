import { execFile } from 'node:child_process';
import {
  lstat, mkdir, readFile, readdir, rename, writeFile,
} from 'node:fs/promises';
import { isDeepStrictEqual, promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readVisualLabRecipeSet } from './visual-lab-recipe-set.mjs';
import {
  runVisualLabBatch,
  verifyVisualLabBatchPackage,
  VISUAL_LAB_CAPTURE_PROOF_MODES,
} from './visual-lab-batch.mjs';
import {
  VISUAL_LAB_EXECUTION_TUNING_PLAN_SCHEMA,
  VISUAL_LAB_EXECUTION_TUNING_PLAN_V2_SCHEMA,
  VISUAL_LAB_EXECUTION_TUNING_PLAN_V3_SCHEMA,
  VISUAL_LAB_EXECUTION_TUNING_PLAN_V4_SCHEMA,
  VISUAL_LAB_EXECUTION_TUNING_PLAN_V5_SCHEMA,
  VISUAL_LAB_EXECUTION_TUNING_PLAN_V6_SCHEMA,
  VISUAL_LAB_EXECUTION_TUNING_PLAN_V7_SCHEMA,
} from './visual-lab-execution-tuning-plan.mjs';

export const VISUAL_LAB_PERFORMANCE_COHORT_SCHEMA = 'anifor.visual-lab.performance-cohorts/v1';
export const VISUAL_LAB_PERFORMANCE_COHORT_RECEIPT_SCHEMA = 'anifor.visual-lab.performance-cohorts/v2';
export const VISUAL_LAB_PERFORMANCE_COHORT_ORDER = Object.freeze([
  'fresh', 'shared', 'shared', 'fresh',
]);

const MODULE_PATH = fileURLToPath(import.meta.url);
const REPOSITORY_ROOT = path.resolve(path.dirname(MODULE_PATH), '..');
const execFileAsync = promisify(execFile);
const MAX_SUMMARY_BYTES = 1_048_576;
const MAX_FAILURE_DIAGNOSTIC_BYTES = 16_384;
const MAX_HOST_DURATION_MS = 3_600_000;
const MAX_HOST_EVENTS = 1_000_000;
const SHA256_ID = /^sha256:[0-9a-f]{64}$/;
const NORMAL_DETAIL_SCALES = Object.freeze([1, 2, 4]);
const STABLE_SNAPSHOTS_CAPTURE_PROOF = 'stable-snapshots';
const COMPLETED_FRAME_RECEIPT_CAPTURE_PROOF = 'completed-frame-receipt';
const READINESS_COMPLETED_FRAME_RECEIPT_CAPTURE_PROOF = 'readiness-completed-frame-receipt';
const SELECTION_OWNED_FRAME_RECEIPT_CAPTURE_PROOF = 'selection-owned-frame-receipt';
const FIXTURE_ACTIVATION_GENERATION_CAPTURE_PROOF = 'fixture-activation-generation';
const FIXTURE_ACTIVATION_WORK_GENERATION_CAPTURE_PROOF = 'fixture-activation-work-generation';
const FIXTURE_ACTIVATION_RENDER_FIELD_GENERATION_CAPTURE_PROOF = 'fixture-activation-render-field-generation';
const EXECUTION_TUNING_SCHEMAS_BY_CAPTURE_PROOF = Object.freeze({
  [STABLE_SNAPSHOTS_CAPTURE_PROOF]: VISUAL_LAB_EXECUTION_TUNING_PLAN_SCHEMA,
  [COMPLETED_FRAME_RECEIPT_CAPTURE_PROOF]: VISUAL_LAB_EXECUTION_TUNING_PLAN_V2_SCHEMA,
  [READINESS_COMPLETED_FRAME_RECEIPT_CAPTURE_PROOF]: VISUAL_LAB_EXECUTION_TUNING_PLAN_V3_SCHEMA,
  [SELECTION_OWNED_FRAME_RECEIPT_CAPTURE_PROOF]: VISUAL_LAB_EXECUTION_TUNING_PLAN_V4_SCHEMA,
  [FIXTURE_ACTIVATION_GENERATION_CAPTURE_PROOF]: VISUAL_LAB_EXECUTION_TUNING_PLAN_V5_SCHEMA,
  [FIXTURE_ACTIVATION_WORK_GENERATION_CAPTURE_PROOF]: VISUAL_LAB_EXECUTION_TUNING_PLAN_V6_SCHEMA,
  [FIXTURE_ACTIVATION_RENDER_FIELD_GENERATION_CAPTURE_PROOF]: VISUAL_LAB_EXECUTION_TUNING_PLAN_V7_SCHEMA,
});
const RECYCLE_REASONS = Object.freeze([
  'launch-fault',
  'fresh-only-entry',
  'candidate-execution-fault',
  'candidate-process-fault',
  'candidate-report-fault',
  'cohort-complete',
  'batch-abort',
]);
const HELP = `Usage:
  node scripts/visual-lab-performance-cohorts.mjs \\
    --recipe-set=<tracked-recipe-set.json> \\
    [--bundle=dist/index.html] [--output-dir=/tmp/anifor-visual-lab-performance-cohorts] \\
    [--gpu=auto|swiftshader] [--capture-proof=stable-snapshots|completed-frame-receipt|readiness-completed-frame-receipt|selection-owned-frame-receipt|fixture-activation-generation|fixture-activation-work-generation|fixture-activation-render-field-generation] \\
    [--chrome=/path/to/chrome]

Runs the fixed fresh/shared/shared/fresh Visual Lab cohort order. Each cohort is
captured into a distinct directory and then portable-verified before the next
one starts. performance-summary.json is published only after every cohort passes.`;

const deepFreeze = (value) => {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
};

export function assertVisualLabPerformanceCohortPlatform(platform = process.platform) {
  if (platform !== 'linux') {
    throw new Error('Visual Lab performance cohorts require Linux because shared Chrome is Linux-only');
  }
}

const assertOptions = (options) => {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Visual Lab performance cohort options must be an object');
  }
  const allowed = new Set(['recipeSetPath', 'bundle', 'outputDir', 'gpu', 'captureProof', 'chrome']);
  const extra = Reflect.ownKeys(options).find((key) => !allowed.has(key));
  if (extra !== undefined) throw new TypeError(`Unknown Visual Lab performance cohort option ${String(extra)}`);
  if (typeof options.recipeSetPath !== 'string' || options.recipeSetPath.length === 0) {
    throw new TypeError('Visual Lab performance cohorts require recipeSetPath');
  }
  if (options.bundle !== undefined && (typeof options.bundle !== 'string' || options.bundle.length === 0)) {
    throw new TypeError('Visual Lab performance cohort bundle must be a non-empty string');
  }
  if (options.outputDir !== undefined && (typeof options.outputDir !== 'string' || options.outputDir.length === 0)) {
    throw new TypeError('Visual Lab performance cohort outputDir must be a non-empty string');
  }
  if (options.chrome !== undefined && (typeof options.chrome !== 'string' || options.chrome.length === 0)) {
    throw new TypeError('Visual Lab performance cohort chrome must be a non-empty string');
  }
  const gpu = options.gpu ?? 'auto';
  if (gpu !== 'auto' && gpu !== 'swiftshader') {
    throw new TypeError('Visual Lab performance cohort gpu must be auto or swiftshader');
  }
  const captureProof = options.captureProof ?? STABLE_SNAPSHOTS_CAPTURE_PROOF;
  if (!VISUAL_LAB_CAPTURE_PROOF_MODES.includes(captureProof)) {
    throw new TypeError('Visual Lab performance cohort captureProof is unsupported');
  }
  return Object.freeze({
    recipeSetPath: path.resolve(options.recipeSetPath),
    bundle: options.bundle === undefined ? undefined : path.resolve(options.bundle),
    outputDir: path.resolve(options.outputDir ?? path.join('/tmp', 'anifor-visual-lab-performance-cohorts')),
    gpu,
    captureProof,
    ...(options.chrome === undefined ? {} : { chrome: options.chrome }),
  });
};

const assertExecutionTuningSchema = (ordinal, mode, captureProof, portablePlan) => {
  const expectedSchema = EXECUTION_TUNING_SCHEMAS_BY_CAPTURE_PROOF[captureProof];
  if (portablePlan?.schema !== expectedSchema) {
    throw new Error(
      `Visual Lab performance cohort ${ordinal} (${mode}) requires portable ${expectedSchema} for ${captureProof}`,
    );
  }
};

const summaryCaptureProof = (captureProof) => {
  if (captureProof === STABLE_SNAPSHOTS_CAPTURE_PROOF) return undefined;
  return deepFreeze({
    mode: captureProof,
    tuningSchema: EXECUTION_TUNING_SCHEMAS_BY_CAPTURE_PROOF[captureProof],
    receiptSchema: 'anifor.renderer.completed-frame-receipt/v1',
    ...(captureProof === FIXTURE_ACTIVATION_WORK_GENERATION_CAPTURE_PROOF
      ? { readinessCapability: 'renderer-fixture-activation-generation/v2' } : {}),
    ...(captureProof === FIXTURE_ACTIVATION_RENDER_FIELD_GENERATION_CAPTURE_PROOF
      ? { readinessCapability: 'renderer-fixture-activation-generation/v3' } : {}),
  });
};

const assertTrackedRecipeSet = async (recipeSetPath) => {
  const relative = path.relative(REPOSITORY_ROOT, recipeSetPath);
  if (relative === '' || relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
    throw new Error('Visual Lab performance cohort recipe set must be a tracked repository file');
  }
  try {
    await execFileAsync('git', ['ls-files', '--error-unmatch', '--', relative], {
      cwd: REPOSITORY_ROOT,
      windowsHide: true,
    });
  } catch {
    throw new Error('Visual Lab performance cohort recipe set must be a tracked repository file');
  }
};

const ensureEmptyOutputDirectory = async (directory) => {
  try {
    await mkdir(directory);
    return;
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
  }
  const details = await lstat(directory);
  if (details.isSymbolicLink() || !details.isDirectory()) {
    throw new Error('Visual Lab performance cohort output must be a real directory');
  }
  if ((await readdir(directory)).length > 0) {
    throw new Error('Visual Lab performance cohort output directory must be empty');
  }
};

const assertCompleteBatch = async (ordinal, mode, cohortDirectory, batch) => {
  if (batch?.ok === true && batch?.index?.complete === true) return;
  const failed = Array.isArray(batch?.index?.candidates)
    ? batch.index.candidates.filter(({ status }) => status === 'failed') : [];
  const details = [];
  for (const entry of failed) {
    const diagnostic = entry?.artifacts?.diagnostic;
    if (typeof diagnostic !== 'string') {
      details.push(`${entry?.candidate ?? 'unknown'}: ${entry?.failure ?? 'failed'}`);
      continue;
    }
    const target = path.resolve(cohortDirectory, diagnostic);
    const relative = path.relative(cohortDirectory, target);
    if (relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
      details.push(`${entry.candidate}: ${entry.failure ?? 'failed'} (unsafe diagnostic omitted)`);
      continue;
    }
    try {
      const metadata = await lstat(target);
      if (!metadata.isFile() || metadata.isSymbolicLink()
        || metadata.size > MAX_FAILURE_DIAGNOSTIC_BYTES) {
        details.push(`${entry.candidate}: ${entry.failure ?? 'failed'} (diagnostic omitted)`);
        continue;
      }
      const diagnosticText = (await readFile(target, 'utf8')).trim();
      details.push(`${entry.candidate}: ${diagnosticText || entry.failure || 'failed'}`);
    } catch {
      details.push(`${entry.candidate}: ${entry.failure ?? 'failed'} (diagnostic unavailable)`);
    }
  }
  const suffix = details.length === 0 ? '' : `\n${details.join('\n')}`;
  throw new Error(
    `Visual Lab performance cohort ${ordinal} (${mode}) capture failed${suffix}`,
  );
};

const reasonCountsFor = (reasons) => Object.freeze(Object.fromEntries(
  RECYCLE_REASONS.map((reason) => [
    reason,
    reasons.filter((candidate) => candidate === reason).length,
  ]),
));

const assertBoundedCount = (value, label) => {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_HOST_EVENTS) {
    throw new TypeError(`${label} must be an integer from 0 through ${MAX_HOST_EVENTS}`);
  }
  return value;
};

const assertBoundedDuration = (value, label) => {
  if (typeof value !== 'number' || !Number.isFinite(value)
    || value < 0 || value > MAX_HOST_DURATION_MS) {
    throw new TypeError(`${label} must be a finite value from 0 through ${MAX_HOST_DURATION_MS}`);
  }
  return Object.is(value, -0) ? 0 : value;
};

const projectHostRuntime = (runtime) => {
  if (runtime === null || typeof runtime !== 'object' || Array.isArray(runtime)) {
    throw new TypeError('Visual Lab batch did not expose browser-host runtime diagnostics');
  }
  const {
    hostsStarted, hostRestarts, launchMs, teardownMs, assignments, recycleReasons,
  } = runtime;
  if (!Array.isArray(assignments) || assignments.length > MAX_HOST_EVENTS
    || !Array.isArray(recycleReasons) || recycleReasons.length > MAX_HOST_EVENTS
    || recycleReasons.some((reason) => !RECYCLE_REASONS.includes(reason))) {
    throw new TypeError('Visual Lab batch browser-host runtime diagnostics are malformed');
  }
  return deepFreeze({
    hostsStarted: assertBoundedCount(hostsStarted, 'Visual Lab hostsStarted'),
    hostRestarts: assertBoundedCount(hostRestarts, 'Visual Lab hostRestarts'),
    assignmentCount: assertBoundedCount(assignments.length, 'Visual Lab assignment count'),
    launchMs: assertBoundedDuration(launchMs, 'Visual Lab host launch timing'),
    teardownMs: assertBoundedDuration(teardownMs, 'Visual Lab host teardown timing'),
    recycleReasonCounts: reasonCountsFor(recycleReasons),
  });
};

const summarizeCohort = (ordinal, mode, batch) => {
  if (batch?.ok !== true || batch?.index?.complete !== true) {
    throw new Error(`Visual Lab performance cohort ${ordinal} (${mode}) did not complete`);
  }
  if (batch.timings === undefined || batch.captureSubphases === undefined) {
    throw new Error(`Visual Lab performance cohort ${ordinal} (${mode}) lacks timing diagnostics`);
  }
  return deepFreeze({
    ordinal,
    mode,
    timings: {
      phases: batch.timings.phases,
      counters: batch.timings.counters,
    },
    captureSubphases: {
      readiness: batch.captureSubphases.readiness,
      captures: batch.captureSubphases.captures,
    },
    browserHost: projectHostRuntime(batch.browserHostRuntime),
  });
};

const assertCompleteDiagnostics = (ordinal, mode, expectedCandidates, batch) => {
  for (const name of ['timings', 'captureSubphases']) {
    const sampled = batch?.[name]?.sampledCandidates;
    if (!Array.isArray(sampled) || !isDeepStrictEqual(sampled, expectedCandidates)) {
      throw new Error(
        `Visual Lab performance cohort ${ordinal} (${mode}) ${name} does not cover every candidate`,
      );
    }
  }
};

const assertEffectiveHostMode = (
  ordinal, mode, expectedCandidateOrder, runtime, portablePlan,
) => {
  if (portablePlan?.requestedMode !== mode
    || !Array.isArray(portablePlan.entries)
    || portablePlan.entries.length !== expectedCandidateOrder.length) {
    throw new Error(`Visual Lab performance cohort ${ordinal} has a mismatched portable host plan`);
  }
  for (const [sequence, entry] of portablePlan.entries.entries()) {
    if (entry?.sequence !== sequence || entry?.candidate !== expectedCandidateOrder[sequence]
      || entry?.requestedMode !== mode || entry?.effectiveMode !== mode) {
      throw new Error(
        `Visual Lab performance cohort ${ordinal} portable host plan does not preserve ${mode} routing`,
      );
    }
  }
  if (runtime?.requestedMode !== mode) {
    throw new Error(`Visual Lab performance cohort ${ordinal} did not use requested ${mode} mode`);
  }
  const expectedAssignments = mode === 'shared' ? expectedCandidateOrder.length : 0;
  if (!Array.isArray(runtime.assignments) || runtime.assignments.length !== expectedAssignments) {
    throw new Error(
      `Visual Lab performance cohort ${ordinal} (${mode}) did not execute every candidate in that host mode`,
    );
  }
  if (mode === 'shared') {
    if (!Number.isSafeInteger(runtime.hostsStarted) || runtime.hostsStarted < 1
      || runtime.assignments.some((assignment, index) => (
        assignment?.candidate !== expectedCandidateOrder[index]
        || !Number.isSafeInteger(assignment.host)
        || assignment.host < 1 || assignment.host > runtime.hostsStarted
      ))) {
      throw new Error(
        `Visual Lab performance cohort ${ordinal} shared runtime does not match its assignments`,
      );
    }
  } else if (runtime.hostsStarted !== 0) {
    throw new Error(`Visual Lab performance cohort ${ordinal} fresh runtime retained a shared host`);
  }
};

const cohortResultIdentity = (ordinal, expectedCandidateOrder, index) => {
  if (index?.complete !== true || !Array.isArray(index.candidates)
    || index.candidates.length !== expectedCandidateOrder.length) {
    throw new Error(`Visual Lab performance cohort ${ordinal} has incomplete result identity`);
  }
  return Object.freeze(index.candidates.map((entry, sequence) => {
    if (entry?.candidate !== expectedCandidateOrder[sequence] || entry?.status !== 'passed'
      || !SHA256_ID.test(entry?.result?.id)) {
      throw new Error(`Visual Lab performance cohort ${ordinal} has mismatched result identity`);
    }
    return `${entry.candidate}:${entry.result.id}`;
  }));
};

const writeSummary = async (outputDirectory, summary) => {
  const target = path.join(outputDirectory, 'performance-summary.json');
  const temporary = `${target}.tmp`;
  const bytes = `${JSON.stringify(summary, null, 2)}\n`;
  if (Buffer.byteLength(bytes) > MAX_SUMMARY_BYTES) {
    throw new RangeError('Visual Lab performance cohort summary exceeds its 1 MiB bound');
  }
  await writeFile(temporary, bytes, { encoding: 'utf8', flag: 'wx' });
  await rename(temporary, target);
  return target;
};

/** Runs a fixed ABBA host-mode cohort without giving it CI or promotion authority. */
export async function runVisualLabPerformanceCohorts(options = {}, dependencies = {}) {
  const requested = assertOptions(options);
  assertVisualLabPerformanceCohortPlatform();
  const allowedDependencies = new Set([
    'assertTrackedRecipeSet', 'readRecipeSet', 'runBatch', 'verifyBatch', 'ensureOutputDirectory',
    'publishSummary',
  ]);
  const extraDependency = Reflect.ownKeys(dependencies).find((key) => !allowedDependencies.has(key));
  if (extraDependency !== undefined) throw new TypeError(`Unknown cohort dependency ${String(extraDependency)}`);
  const tracked = dependencies.assertTrackedRecipeSet ?? assertTrackedRecipeSet;
  const readRecipeSet = dependencies.readRecipeSet ?? readVisualLabRecipeSet;
  const runBatch = dependencies.runBatch ?? runVisualLabBatch;
  const verifyBatch = dependencies.verifyBatch ?? verifyVisualLabBatchPackage;
  const ensureOutputDirectory = dependencies.ensureOutputDirectory ?? ensureEmptyOutputDirectory;
  const publishSummary = dependencies.publishSummary ?? writeSummary;
  if ([tracked, readRecipeSet, runBatch, verifyBatch, ensureOutputDirectory, publishSummary]
    .some((dependency) => typeof dependency !== 'function')) {
    throw new TypeError('Visual Lab performance cohort dependencies must be functions');
  }

  await tracked(requested.recipeSetPath);
  const recipeSet = await readRecipeSet(requested.recipeSetPath);
  if (recipeSet?.schema !== 'anifor.visual-lab.recipe-set/v1'
    || !SHA256_ID.test(recipeSet?.id) || !Array.isArray(recipeSet?.recipes)
    || recipeSet.recipes.length === 0) {
    throw new TypeError('Visual Lab performance cohort recipe set is malformed');
  }
  if (recipeSet.recipes.some(({ renderScale }) => !NORMAL_DETAIL_SCALES.includes(renderScale))) {
    throw new Error(
      'Visual Lab performance cohorts require only 1x/2x/4x recipes; true 8x is fresh-browser-only',
    );
  }
  const expectedCandidateOrder = Object.freeze(recipeSet.recipes.map(({ name }) => name));
  const expectedCandidates = Object.freeze(
    [...expectedCandidateOrder].sort((left, right) => left.localeCompare(right)),
  );
  await ensureOutputDirectory(requested.outputDir);

  const cohorts = [];
  let acceptedResultIdentity;
  for (const [index, mode] of VISUAL_LAB_PERFORMANCE_COHORT_ORDER.entries()) {
    const ordinal = index + 1;
    const cohortDirectory = path.join(requested.outputDir, `cohort-${String(ordinal).padStart(2, '0')}-${mode}`);
    await mkdir(cohortDirectory);
    const batch = await runBatch({
      recipeSet,
      recipeSetSourcePath: requested.recipeSetPath,
      outputDir: cohortDirectory,
      gpu: requested.gpu,
      browserHost: mode,
      captureProof: requested.captureProof,
      ...(requested.bundle === undefined ? {} : { bundle: requested.bundle }),
      ...(requested.chrome === undefined ? {} : { chrome: requested.chrome }),
    });
    await assertCompleteBatch(ordinal, mode, cohortDirectory, batch);
    const verified = await verifyBatch({
      batchRoot: cohortDirectory,
      recipeSetSourcePath: requested.recipeSetPath,
      requireComplete: true,
      requireRecipeSet: true,
      requireBrowserHostPlan: true,
      requireCaptureGeometry: true,
      requireExecutionTuningPlan: true,
    });
    if (!isDeepStrictEqual(batch.timings, verified?.timings)
      || !isDeepStrictEqual(batch.captureSubphases, verified?.captureSubphases)
      || !isDeepStrictEqual(batch.browserHostPlan, verified?.browserHostPlan)) {
      throw new Error(
        `Visual Lab performance cohort ${ordinal} (${mode}) diagnostics differ after verification`,
      );
    }
    assertCompleteDiagnostics(ordinal, mode, expectedCandidates, verified);
    assertExecutionTuningSchema(ordinal, mode, requested.captureProof, verified.executionTuningPlan);
    assertEffectiveHostMode(
      ordinal, mode, expectedCandidateOrder, batch.browserHostRuntime, verified.browserHostPlan,
    );
    const resultIdentity = cohortResultIdentity(
      ordinal, expectedCandidateOrder, verified.index,
    );
    acceptedResultIdentity ??= resultIdentity;
    if (!isDeepStrictEqual(resultIdentity, acceptedResultIdentity)) {
      throw new Error(
        `Visual Lab performance cohort ${ordinal} (${mode}) changed accepted capture identity`,
      );
    }
    cohorts.push(summarizeCohort(ordinal, mode, {
      ...batch,
      timings: verified.timings,
      captureSubphases: verified.captureSubphases,
    }));
  }
  const captureProof = summaryCaptureProof(requested.captureProof);
  const summary = deepFreeze({
    schema: captureProof === undefined
      ? VISUAL_LAB_PERFORMANCE_COHORT_SCHEMA
      : VISUAL_LAB_PERFORMANCE_COHORT_RECEIPT_SCHEMA,
    recipeSet: { schema: recipeSet.schema, id: recipeSet.id },
    gpuMode: requested.gpu,
    order: VISUAL_LAB_PERFORMANCE_COHORT_ORDER,
    cohorts,
    ...(captureProof === undefined ? {} : { captureProof }),
  });
  const summaryPath = await publishSummary(requested.outputDir, summary);
  return deepFreeze({ ok: true, summary, summaryPath });
}

export function parseVisualLabPerformanceCohortArguments(argv) {
  if (!Array.isArray(argv)) throw new TypeError('arguments must be an array');
  if (argv.includes('--help') || argv.includes('-h')) return Object.freeze({ help: true });
  const known = new Set(['recipe-set', 'bundle', 'output-dir', 'gpu', 'capture-proof', 'chrome']);
  const values = new Map();
  for (const argument of argv) {
    if (!argument.startsWith('--') || !argument.includes('=')) {
      throw new Error(`Unknown argument ${JSON.stringify(argument)}; options use --name=value`);
    }
    const separator = argument.indexOf('=');
    const name = argument.slice(2, separator);
    if (!known.has(name)) throw new Error(`Unknown option --${name}`);
    if (values.has(name)) throw new Error(`Option --${name} may only be provided once`);
    const value = argument.slice(separator + 1);
    if (value.length === 0) throw new Error(`--${name} must not be empty`);
    values.set(name, value);
  }
  if (!values.has('recipe-set')) throw new Error('--recipe-set is required');
  const gpu = values.get('gpu') ?? 'auto';
  if (gpu !== 'auto' && gpu !== 'swiftshader') throw new Error('--gpu must be auto or swiftshader');
  const captureProof = values.get('capture-proof') ?? STABLE_SNAPSHOTS_CAPTURE_PROOF;
  if (!VISUAL_LAB_CAPTURE_PROOF_MODES.includes(captureProof)) {
    throw new Error('--capture-proof is unsupported');
  }
  return Object.freeze({
    help: false,
    recipeSetPath: values.get('recipe-set'),
    bundle: values.get('bundle'),
    outputDir: values.get('output-dir'),
    gpu,
    captureProof,
    chrome: values.get('chrome'),
  });
}

const main = async () => {
  try {
    const parsed = parseVisualLabPerformanceCohortArguments(process.argv.slice(2));
    if (parsed.help) {
      process.stdout.write(`${HELP}\n`);
      return;
    }
    const { help: _help, ...options } = parsed;
    const result = await runVisualLabPerformanceCohorts(options);
    const tool = result.summary.schema === VISUAL_LAB_PERFORMANCE_COHORT_RECEIPT_SCHEMA
      ? 'visual-lab-performance-cohorts-v2'
      : 'visual-lab-performance-cohorts-v1';
    process.stdout.write(`${JSON.stringify({ tool, ok: true, summary: result.summary })}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      tool: 'visual-lab-performance-cohorts-v1', ok: false, error: error?.stack ?? String(error),
    })}\n`);
    process.exitCode = 1;
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === MODULE_PATH) void main();
