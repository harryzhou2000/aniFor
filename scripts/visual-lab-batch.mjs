import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import {
  lstat, mkdir, open, readFile, realpath, rename, rm, stat, writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

import {
  resolveVisualLabCaptureRecipe,
  visualLabCaptureRecipeNames,
} from './visual-lab-recipes.mjs';
import {
  readVisualLabRecipeSet,
} from './visual-lab-recipe-set.mjs';
import {
  resolveVisualCaptureRequest,
  VISUAL_LAB_CAPTURE_PROTOCOL,
} from './visual-lab-fixtures.mjs';
import {
  assertVisualCaptureDriverReportDescriptor,
  visualCaptureVariantLabel,
} from './visual-capture-drivers.mjs';
import {
  createVisualLabExecutionPlan,
  VISUAL_LAB_CANDIDATE_GENERATED_FILES,
  visualLabFailedArtifacts,
  visualLabPassedArtifacts,
  visualLabRequestForRecipe,
} from './visual-lab-execution-plan.mjs';
import { createVisualLabResultRecord } from './visual-lab-result.mjs';
import {
  normalizeVisualLabCaptureSubphaseTimings,
  normalizeVisualLabTimings,
  summarizeVisualLabCaptureSubphaseTimings,
  summarizeVisualLabTimings,
} from './visual-lab-timing.mjs';
import {
  isDetachedProcessGroupAlive,
  terminateDetachedProcessGroup,
} from './detached-process.mjs';
import {
  VISUAL_LAB_CAPTURE_VARIANT_NAMES as VARIANTS,
} from './visual-lab-capture-abi.mjs';
import { inspectVisualLabPng } from './visual-lab-png.mjs';
import {
  createVisualLabBatchExperimentResponse,
  VISUAL_LAB_CURRENT_EXPERIMENT_RESPONSE_SCHEMA,
} from './visual-lab-comparison-metrics.mjs';
import {
  VISUAL_LAB_CURRENT_REGION_RESPONSE_SCHEMA,
} from './visual-lab-region-response.mjs';
import {
  VISUAL_LAB_CURRENT_REGION_APPEARANCE_SCHEMA,
} from './visual-lab-region-appearance.mjs';
import {
  createVisualLabCurrentRegionMeasurements,
} from './visual-lab-region-measurements.mjs';
import { resolveVisualLabInspectionPresentation } from './visual-lab-inspection-presentation.mjs';
import {
  createVisualLabBrowserHostPlan,
  normalizeVisualLabBrowserHostPlan,
  resolveVisualLabBrowserHostPlanEntry,
} from './visual-lab-browser-host-plan.mjs';
import {
  visualCaptureExecutionCapabilitiesForCaptureOrder,
  visualCaptureExecutionV2CapabilitiesForCaptureOrder,
  visualCaptureExecutionV3CapabilitiesForCaptureOrder,
  visualCaptureExecutionV4CapabilitiesForCaptureOrder,
  visualCaptureExecutionV5CapabilitiesForCaptureOrder,
  visualCaptureExecutionV6CapabilitiesForCaptureOrder,
  visualCaptureExecutionV7CapabilitiesForCaptureOrder,
} from './visual-capture-execution-capabilities.mjs';
import {
  createVisualLabExecutionTuningPlan,
  createVisualLabExecutionTuningPlanV2,
  createVisualLabExecutionTuningPlanV3,
  createVisualLabExecutionTuningPlanV4,
  createVisualLabExecutionTuningPlanV5,
  createVisualLabExecutionTuningPlanV6,
  createVisualLabExecutionTuningPlanV7,
  normalizeVisualLabExecutionTuningPlan,
  normalizeVisualLabExecutionTuningPlanV2,
  normalizeVisualLabExecutionTuningPlanV3,
  normalizeVisualLabExecutionTuningPlanV4,
  normalizeVisualLabExecutionTuningPlanV5,
  normalizeVisualLabExecutionTuningPlanV6,
  normalizeVisualLabExecutionTuningPlanV7,
  resolveVisualLabExecutionTuningPlanEntry,
  resolveVisualLabExecutionTuningPlanV2Entry,
  resolveVisualLabExecutionTuningPlanV3Entry,
  resolveVisualLabExecutionTuningPlanV4Entry,
  resolveVisualLabExecutionTuningPlanV5Entry,
  resolveVisualLabExecutionTuningPlanV6Entry,
  resolveVisualLabExecutionTuningPlanV7Entry,
  VISUAL_LAB_EXECUTION_TUNING_PLAN_SCHEMA,
  VISUAL_LAB_EXECUTION_TUNING_PLAN_V2_SCHEMA,
  VISUAL_LAB_EXECUTION_TUNING_PLAN_V3_SCHEMA,
  VISUAL_LAB_EXECUTION_TUNING_PLAN_V4_SCHEMA,
  VISUAL_LAB_EXECUTION_TUNING_PLAN_V5_SCHEMA,
  VISUAL_LAB_EXECUTION_TUNING_PLAN_V6_SCHEMA,
  VISUAL_LAB_EXECUTION_TUNING_PLAN_V7_SCHEMA,
} from './visual-lab-execution-tuning-plan.mjs';
import { startVisualLabChromeHost } from './visual-lab-chrome-host.mjs';
import {
  normalizeLivePagesRevision,
  verifyLivePagesDeployment,
  verifyLivePagesRevision,
} from './live-pages-attestation.mjs';
import {
  createVisualLabOriginAttestation,
  normalizeVisualLabOriginAttestation,
} from './visual-lab-origin-attestation.mjs';
import { createVisualCaptureGeometryProof } from '../src/shared/visual-capture-geometry.js';

export { inspectVisualLabPng } from './visual-lab-png.mjs';

export const VISUAL_LAB_BATCH_SCHEMA = 'anifor.visual-lab.batch/v1';
export const VISUAL_LAB_DEFAULT_CANDIDATE_TIMEOUT_MS = 300_000;
export const VISUAL_LAB_CAPTURE_PROOF_MODES = Object.freeze([
  'stable-snapshots', 'completed-frame-receipt', 'readiness-completed-frame-receipt',
  'selection-owned-frame-receipt',
  'fixture-activation-generation',
  'fixture-activation-work-generation',
  'fixture-activation-render-field-generation',
]);

const MODULE_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIRECTORY = path.dirname(MODULE_PATH);
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, '..');
const DEFAULT_AUDIT_SCRIPT = path.join(SCRIPT_DIRECTORY, 'visual-lab-audit.mjs');
const CANDIDATE_TERMINATION_GRACE_MS = 10_000;
const CANDIDATE_KILL_SETTLEMENT_MS = 5_000;
const MAX_CANDIDATE_TIMEOUT_MS = 2_147_483_647;
const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const LIFECYCLE_FILE_NAME = 'chrome-lifecycle.json';
const LIFECYCLE_SCHEMA = 'anifor.visual-lab.lifecycle/v1';
const BATCH_LOCK_FILE_NAME = '.visual-lab-batch.lock';
const BATCH_LOCK_SCHEMA = 'anifor.visual-lab.batch-lock/v1';
const BROWSER_HOST_PLAN_FILE_NAME = 'browser-host-plan.json';
const EXECUTION_TUNING_PLAN_FILE_NAME = 'execution-tuning-plan.json';
const ORIGIN_ATTESTATION_FILE_NAME = 'origin-attestation.json';
const CLI_DIAGNOSTIC_MAX_FILE_BYTES = 1_048_576;
const EXPERIMENT_EVIDENCE_MAX_BYTES = 1_048_576;
const CLI_DIAGNOSTIC_MAX_CHARACTERS = 8_000;
const CLI_DIAGNOSTIC_MAX_AGGREGATE_DEPTH = 4;
const CLI_DIAGNOSTIC_MAX_AGGREGATE_CHILDREN = 8;
const SHARED_CHROME_LIFECYCLE_FILE_NAME = '.shared-chrome-lifecycle.json';
const DEFERRED_REPORT_FILE_NAME = 'report.pending.json';
const LIFECYCLE_CLOCK_SKEW_MS = 60_000;
const MIN_LIFECYCLE_RECOVERY_WINDOW_MS = 30 * 60_000;
const FAILURE_CODES = new Set([
  'capture-failed', 'report-missing', 'report-invalid', 'artifact-invalid',
]);

const captureProofForTuningSchema = (schema) => {
  if (schema === VISUAL_LAB_EXECUTION_TUNING_PLAN_SCHEMA) return 'stable-snapshots';
  if (schema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V2_SCHEMA) {
    return 'completed-frame-receipt';
  }
  if (schema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V3_SCHEMA) {
    return 'readiness-completed-frame-receipt';
  }
  if (schema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V4_SCHEMA) {
    return 'selection-owned-frame-receipt';
  }
  if (schema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V5_SCHEMA) {
    return 'fixture-activation-generation';
  }
  if (schema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V6_SCHEMA) {
    return 'fixture-activation-work-generation';
  }
  if (schema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V7_SCHEMA) {
    return 'fixture-activation-render-field-generation';
  }
  throw new TypeError(`Unsupported Visual Lab execution-tuning schema ${String(schema)}`);
};

const normalizeExecutionTuningPlan = (input, captureExecutionPlan) => {
  if (input?.schema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V2_SCHEMA) {
    return normalizeVisualLabExecutionTuningPlanV2(input, captureExecutionPlan);
  }
  if (input?.schema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V3_SCHEMA) {
    return normalizeVisualLabExecutionTuningPlanV3(input, captureExecutionPlan);
  }
  if (input?.schema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V4_SCHEMA) {
    return normalizeVisualLabExecutionTuningPlanV4(input, captureExecutionPlan);
  }
  if (input?.schema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V5_SCHEMA) {
    return normalizeVisualLabExecutionTuningPlanV5(input, captureExecutionPlan);
  }
  if (input?.schema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V6_SCHEMA) {
    return normalizeVisualLabExecutionTuningPlanV6(input, captureExecutionPlan);
  }
  if (input?.schema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V7_SCHEMA) {
    return normalizeVisualLabExecutionTuningPlanV7(input, captureExecutionPlan);
  }
  return normalizeVisualLabExecutionTuningPlan(input, captureExecutionPlan);
};

const createExecutionTuningPlan = (captureExecutionPlan, driverOrder, captureProof) => (
  captureProof === 'fixture-activation-render-field-generation'
    ? createVisualLabExecutionTuningPlanV7(
      captureExecutionPlan,
      visualCaptureExecutionV7CapabilitiesForCaptureOrder(driverOrder),
    )
    : captureProof === 'fixture-activation-work-generation'
    ? createVisualLabExecutionTuningPlanV6(
      captureExecutionPlan,
      visualCaptureExecutionV6CapabilitiesForCaptureOrder(driverOrder),
    )
    : captureProof === 'fixture-activation-generation'
    ? createVisualLabExecutionTuningPlanV5(
      captureExecutionPlan,
      visualCaptureExecutionV5CapabilitiesForCaptureOrder(driverOrder),
    )
    : captureProof === 'selection-owned-frame-receipt'
    ? createVisualLabExecutionTuningPlanV4(
      captureExecutionPlan,
      visualCaptureExecutionV4CapabilitiesForCaptureOrder(driverOrder),
    )
    : captureProof === 'readiness-completed-frame-receipt'
    ? createVisualLabExecutionTuningPlanV3(
      captureExecutionPlan,
      visualCaptureExecutionV3CapabilitiesForCaptureOrder(driverOrder),
    )
    : captureProof === 'completed-frame-receipt'
    ? createVisualLabExecutionTuningPlanV2(
      captureExecutionPlan,
      visualCaptureExecutionV2CapabilitiesForCaptureOrder(driverOrder),
    )
    : createVisualLabExecutionTuningPlan(
      captureExecutionPlan,
      visualCaptureExecutionCapabilitiesForCaptureOrder(driverOrder),
    )
);

const resolveExecutionTuningPlanEntry = (
  plan, entryId, expectedCaptureEntryId, captureExecutionPlan,
) => {
  if (plan.schema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V2_SCHEMA) {
    return resolveVisualLabExecutionTuningPlanV2Entry(
      plan, entryId, expectedCaptureEntryId, captureExecutionPlan,
    );
  }
  if (plan.schema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V3_SCHEMA) {
    return resolveVisualLabExecutionTuningPlanV3Entry(
      plan, entryId, expectedCaptureEntryId, captureExecutionPlan,
    );
  }
  if (plan.schema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V4_SCHEMA) {
    return resolveVisualLabExecutionTuningPlanV4Entry(
      plan, entryId, expectedCaptureEntryId, captureExecutionPlan,
    );
  }
  if (plan.schema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V5_SCHEMA) {
    return resolveVisualLabExecutionTuningPlanV5Entry(
      plan, entryId, expectedCaptureEntryId, captureExecutionPlan,
    );
  }
  if (plan.schema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V6_SCHEMA) {
    return resolveVisualLabExecutionTuningPlanV6Entry(
      plan, entryId, expectedCaptureEntryId, captureExecutionPlan,
    );
  }
  if (plan.schema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V7_SCHEMA) {
    return resolveVisualLabExecutionTuningPlanV7Entry(
      plan, entryId, expectedCaptureEntryId, captureExecutionPlan,
    );
  }
  return resolveVisualLabExecutionTuningPlanEntry(
    plan, entryId, expectedCaptureEntryId, captureExecutionPlan,
  );
};

const HELP = `Usage:
  node scripts/visual-lab-batch.mjs [options]

Options (use --name=value):
  --candidates=<name,name>               Named recipes (default: all catalog entries)
  --recipe-set=<recipe-set.json>         Exact recipe-set/v1 (exclusive with --candidates)
  --bundle=dist/index.html               One existing production bundle for every capture
  --base-url=https://host/app/           Remote HTTP(S) app root (exclusive with --bundle)
  --expected-revision=<40-hex-commit>    Required exact revision for remote capture
  --output-dir=/tmp/anifor-visual-lab-batch
  --chrome=/path/to/chrome               Forwarded to the generic capture runner
  --gpu=auto|swiftshader                 Forwarded to the generic capture runner
  --browser-host=fresh|shared            Opt-in sequential Chrome-host reuse (Linux only)
  --capture-proof=stable-snapshots|completed-frame-receipt|readiness-completed-frame-receipt|selection-owned-frame-receipt|fixture-activation-generation|fixture-activation-work-generation|fixture-activation-render-field-generation
                                         Default keeps the v1 two-snapshot proof
  --candidate-timeout-ms=300000          Per-candidate timeout before TERM/KILL cleanup
  --index-only=0|1                       Aggregate existing candidate reports without capture
  --plan-only=0|1                        Inspect the exact plan without writes or Chrome
  --help

Capture outputs: recipe-set.json, browser-host-plan.json, execution-tuning-plan.json,
optional origin-attestation.json,
index.json, index.html,
and candidates/<name>/ artifacts.
Plan-only writes one JSON record to stdout and does not create the output tree.`;

/**
 * Normalizes a remote app root before it can enter the executable plan. Keep
 * this deliberately narrower than the execution-plan URL parser: batch remote
 * captures cannot inherit credentials, query state, or a fragment from a
 * caller, and always resolve recipe URLs beneath one explicit app-root slash.
 */
export function normalizeVisualLabBatchBaseUrl(value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError('Visual Lab batch baseUrl must be a non-empty absolute HTTP(S) URL');
  }
  if (value.trim() !== value || !/^https?:\/\//i.test(value) || /[?#]/.test(value)) {
    throw new TypeError('Visual Lab batch baseUrl must be an unambiguous HTTP(S) app root');
  }
  let url;
  try { url = new URL(value); }
  catch { throw new TypeError('Visual Lab batch baseUrl must be an absolute HTTP(S) URL'); }
  if ((url.protocol !== 'http:' && url.protocol !== 'https:')
    || url.username !== '' || url.password !== '' || url.search !== '' || url.hash !== '') {
    throw new TypeError('Visual Lab batch baseUrl must be an uncredentialed HTTP(S) app root');
  }
  if (!url.pathname.endsWith('/')) url.pathname = `${url.pathname}/`;
  return url;
}

class CandidateArtifactError extends Error {
  constructor(code, message, options = {}) {
    const { preserveDiagnostic = false, ...errorOptions } = options;
    super(message, errorOptions);
    this.name = 'CandidateArtifactError';
    this.code = code;
    this.preserveDiagnostic = preserveDiagnostic;
  }
}

const displayError = (error, ancestors = new Set()) => {
  if (!(error instanceof Error)) return String(error);
  const primary = error.stack ?? error.message;
  if (!(error instanceof AggregateError) || ancestors.has(error)) return primary;
  const nestedAncestors = new Set(ancestors).add(error);
  const nested = [...error.errors].map((entry, index) => (
    `[${index + 1}] ${displayError(entry, nestedAncestors)}`
  ));
  return `${primary}\nNested errors:\n${nested.join('\n')}`;
};

const displayCliErrorWithinBudget = (error, ancestors, depth) => {
  const primary = error instanceof Error ? error.message : String(error);
  if (!(error instanceof AggregateError)) return primary;
  if (ancestors.has(error)) return `${primary}\n<nested errors omitted: cycle>`;
  if (depth >= CLI_DIAGNOSTIC_MAX_AGGREGATE_DEPTH) {
    return `${primary}\n<nested errors omitted: maximum depth>`;
  }
  const nestedAncestors = new Set(ancestors).add(error);
  const children = [...error.errors];
  const nested = children.slice(0, CLI_DIAGNOSTIC_MAX_AGGREGATE_CHILDREN)
    .map((entry, index) => (
      `[${index + 1}] ${displayCliErrorWithinBudget(entry, nestedAncestors, depth + 1)}`
    ));
  if (children.length > CLI_DIAGNOSTIC_MAX_AGGREGATE_CHILDREN) {
    nested.push(
      `[${CLI_DIAGNOSTIC_MAX_AGGREGATE_CHILDREN + 1}+] `
      + `<omitted: ${children.length - CLI_DIAGNOSTIC_MAX_AGGREGATE_CHILDREN} nested errors>`,
    );
  }
  return `${primary}\nNested errors:\n${nested.join('\n')}`;
};

/** Bounded, stack-free error text suitable for public CI diagnostics. */
export function formatVisualLabBatchCliError(error) {
  const displayed = displayCliErrorWithinBudget(error, new Set(), 0);
  if (displayed.length <= CLI_DIAGNOSTIC_MAX_CHARACTERS) return displayed;
  const marker = '\n<omitted: CLI diagnostic exceeds character budget>';
  return `${displayed.slice(0, CLI_DIAGNOSTIC_MAX_CHARACTERS - marker.length)}${marker}`;
}

const displayCliError = formatVisualLabBatchCliError;

const lifecycleOwnerFor = (outputDirectory, candidate) => createHash('sha256')
  .update(`${outputDirectory}\0${candidate}`, 'utf8').digest('hex');

const pathDetails = async (target) => {
  try { return await lstat(target); }
  catch (error) {
    if (error?.code === 'ENOENT') return undefined;
    throw error;
  }
};

const assertRealAncestors = async (directory, label) => {
  const absolute = path.resolve(directory);
  const parsed = path.parse(absolute);
  const segments = absolute.slice(parsed.root.length).split(path.sep).filter(Boolean);
  let current = parsed.root;
  for (const segment of segments.slice(0, -1)) {
    current = path.join(current, segment);
    const details = await pathDetails(current);
    if (!details) break;
    if (details.isSymbolicLink()) {
      throw new Error(`${label} must not have a symbolic-link ancestor: ${current}`);
    }
  }
};

const sameStableFile = (left, right) => (
  left.dev === right.dev
  && left.ino === right.ino
  && left.size === right.size
  && left.mtimeNs === right.mtimeNs
  && left.ctimeNs === right.ctimeNs
);

/** Reads one real regular file without following a leaf/ancestor symlink or replacement. */
const readStableRegularFile = async (file, label, encoding, maxBytes) => {
  await assertRealAncestors(file, label);
  const before = await lstat(file, { bigint: true });
  if (before.isSymbolicLink() || !before.isFile()) {
    throw new Error(`${label} must be a real regular file`);
  }
  if (maxBytes !== undefined && before.size > BigInt(maxBytes)) {
    throw new Error(`${label} exceeds ${maxBytes} bytes`);
  }
  const flags = typeof fsConstants.O_NOFOLLOW === 'number'
    ? fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW
    : 'r';
  const handle = await open(file, flags);
  let contents;
  try {
    const opened = await handle.stat({ bigint: true });
    if (!opened.isFile() || !sameStableFile(before, opened)) {
      throw new Error(`${label} changed while opening`);
    }
    if (maxBytes === undefined) {
      contents = await handle.readFile(encoding);
    } else {
      const bounded = Buffer.allocUnsafe(maxBytes + 1);
      let offset = 0;
      while (offset < bounded.length) {
        const { bytesRead } = await handle.read(
          bounded, offset, bounded.length - offset, offset,
        );
        if (bytesRead === 0) break;
        offset += bytesRead;
      }
      if (offset > maxBytes) throw new Error(`${label} exceeds ${maxBytes} bytes`);
      const bytes = bounded.subarray(0, offset);
      contents = encoding === undefined ? bytes : bytes.toString(encoding);
    }
  } finally {
    await handle.close();
  }
  await assertRealAncestors(file, label);
  const after = await lstat(file, { bigint: true });
  if (after.isSymbolicLink() || !after.isFile() || !sameStableFile(before, after)) {
    throw new Error(`${label} changed while reading`);
  }
  return contents;
};

const assertExistingRealDirectory = async (directory, label) => {
  if (typeof directory !== 'string' || directory.length === 0) {
    throw new TypeError(`${label} path must be a non-empty string`);
  }
  const segments = directory.split(path.sep);
  if (path.normalize(directory) !== directory
    || segments.includes('.') || segments.includes('..')) {
    throw new TypeError(`${label} path must be canonical without dot segments`);
  }
  const absolute = path.resolve(directory);
  await assertRealAncestors(absolute, label);
  const details = await lstat(absolute);
  if (details.isSymbolicLink() || !details.isDirectory()) {
    throw new Error(`${label} must be a real directory`);
  }
  const resolved = await realpath(absolute);
  if (resolved !== absolute) throw new Error(`${label} must not resolve through a symbolic link`);
  return resolved;
};

const assertResolvedChild = (resolvedParent, resolvedChild, label) => {
  const relative = path.relative(resolvedParent, resolvedChild);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`)
    || path.isAbsolute(relative)) {
    throw new Error(`${label} resolves outside its batch parent`);
  }
};

const ensureRealDirectory = async (directory, label) => {
  const before = await pathDetails(directory);
  if (before?.isSymbolicLink()) throw new Error(`${label} must not be a symbolic link`);
  if (before && !before.isDirectory()) throw new Error(`${label} must be a directory`);
  await assertRealAncestors(directory, label);
  await mkdir(directory, { recursive: true });
  const after = await lstat(directory);
  if (after.isSymbolicLink()) throw new Error(`${label} must not be a symbolic link`);
  if (!after.isDirectory()) throw new Error(`${label} must be a directory`);
  await assertRealAncestors(directory, label);
  return realpath(directory);
};

const inspectPlannedOutputPaths = async (outputDirectory, executionPlan) => {
  await assertRealAncestors(outputDirectory, 'Visual Lab planned output directory');
  const output = await pathDetails(outputDirectory);
  if (output?.isSymbolicLink()) {
    throw new Error('Visual Lab planned output directory must not be a symbolic link');
  }
  if (output && !output.isDirectory()) {
    throw new Error('Visual Lab planned output directory must be a directory');
  }
  if (!output) return;

  const candidateRoot = path.join(outputDirectory, 'candidates');
  const root = await pathDetails(candidateRoot);
  if (root?.isSymbolicLink()) {
    throw new Error('Visual Lab planned candidate root must not be a symbolic link');
  }
  if (root && !root.isDirectory()) {
    throw new Error('Visual Lab planned candidate root must be a directory');
  }
  if (!root) return;
  for (const entry of executionPlan.entries) {
    const candidateDirectory = path.join(candidateRoot, entry.candidate);
    const details = await pathDetails(candidateDirectory);
    if (details?.isSymbolicLink()) {
      throw new Error(
        `Visual Lab planned candidate directory ${entry.candidate} must not be a symbolic link`,
      );
    }
    if (details && !details.isDirectory()) {
      throw new Error(
        `Visual Lab planned candidate directory ${entry.candidate} must be a directory`,
      );
    }
  }
};

const processExists = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error?.code === 'ESRCH') return false;
    if (error?.code === 'EPERM') return true;
    throw error;
  }
};

const parseBatchLock = (source, lockPath) => {
  let record;
  try { record = JSON.parse(source); }
  catch (error) {
    throw new Error(`Invalid Visual Lab batch lock JSON at ${lockPath}`, { cause: error });
  }
  const keys = record !== null && typeof record === 'object' && !Array.isArray(record)
    ? Reflect.ownKeys(record) : [];
  if (keys.length !== 4
    || !['schema', 'pid', 'token', 'createdAtMs'].every((key) => keys.includes(key))
    || record.schema !== BATCH_LOCK_SCHEMA
    || !Number.isSafeInteger(record.pid) || record.pid <= 1
    || typeof record.token !== 'string' || record.token.length < 16
    || !Number.isSafeInteger(record.createdAtMs) || record.createdAtMs <= 0) {
    throw new Error(`Invalid Visual Lab batch lock at ${lockPath}; inspect it before removal`);
  }
  return record;
};

const acquireBatchLock = async (outputDirectory) => {
  const lockPath = path.join(outputDirectory, BATCH_LOCK_FILE_NAME);
  const token = randomUUID();
  const record = {
    schema: BATCH_LOCK_SCHEMA,
    pid: process.pid,
    token,
    createdAtMs: Date.now(),
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    let handle;
    try {
      handle = await open(lockPath, 'wx', 0o600);
      await handle.writeFile(`${JSON.stringify(record)}\n`);
      await handle.sync();
      await handle.close();
      handle = undefined;
      return async () => {
        const details = await pathDetails(lockPath);
        if (!details) return;
        if (details.isSymbolicLink() || !details.isFile()) {
          throw new Error(`Visual Lab batch lock changed type at ${lockPath}`);
        }
        const current = parseBatchLock(await readFile(lockPath, 'utf8'), lockPath);
        if (current.token !== token || current.pid !== process.pid) {
          throw new Error(`Visual Lab batch lock ownership changed at ${lockPath}`);
        }
        await rm(lockPath, { force: true });
      };
    } catch (error) {
      if (handle) {
        await handle.close().catch(() => {});
        await rm(lockPath, { force: true }).catch(() => {});
      }
      if (error?.code !== 'EEXIST') throw error;
      const details = await pathDetails(lockPath);
      if (details?.isSymbolicLink() || (details && !details.isFile())) {
        throw new Error(`Visual Lab batch lock must be a regular file at ${lockPath}`);
      }
      const owner = parseBatchLock(await readFile(lockPath, 'utf8'), lockPath);
      if (processExists(owner.pid)) {
        throw new Error(
          `Visual Lab batch output is already owned by active process ${owner.pid}`,
        );
      }
      await rm(lockPath, { force: true });
    }
  }
  throw new Error(`Could not acquire Visual Lab batch lock at ${lockPath}`);
};

const ensureCandidateRoot = async (outputDirectory, candidateRoot) => {
  const resolvedCandidateRoot = await ensureRealDirectory(
    candidateRoot, 'Visual Lab candidate root',
  );
  const resolvedOutputDirectory = await realpath(outputDirectory);
  assertResolvedChild(
    resolvedOutputDirectory, resolvedCandidateRoot, 'Visual Lab candidate root',
  );
  return resolvedCandidateRoot;
};

const ensureCandidateDirectory = async (
  resolvedCandidateRoot, candidateDirectory, candidate,
) => {
  const resolvedCandidateDirectory = await ensureRealDirectory(
    candidateDirectory, `Visual Lab candidate directory ${candidate}`,
  );
  assertResolvedChild(
    resolvedCandidateRoot,
    resolvedCandidateDirectory,
    `Visual Lab candidate directory ${candidate}`,
  );
};

const deepFreeze = (value) => {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
};

const verifiedUnsignedInteger = (value, label, maximum = Number.MAX_SAFE_INTEGER) => {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new TypeError(`${label} must be a bounded unsigned integer`);
  }
  return value;
};

const verifiedSemanticDiagnostic = (semantic) => Object.freeze({
  hash: verifiedUnsignedInteger(semantic?.hash, 'semantic.hash', 0xffff_ffff),
  occupied: verifiedUnsignedInteger(semantic?.occupied, 'semantic.occupied', WORLD_WIDTH * WORLD_HEIGHT),
  countHash: verifiedUnsignedInteger(semantic?.countHash, 'semantic.countHash', 0xffff_ffff),
});

const verifiedAlphaDiagnostic = (alpha, label) => Object.freeze({
  hash: verifiedUnsignedInteger(alpha?.hash, `${label}.hash`, 0xffff_ffff),
  supportHash: verifiedUnsignedInteger(alpha?.supportHash, `${label}.supportHash`, 0xffff_ffff),
  alphaSum: verifiedUnsignedInteger(alpha?.alphaSum, `${label}.alphaSum`),
  nonzero: verifiedUnsignedInteger(alpha?.nonzero, `${label}.nonzero`),
});

/**
 * Projects only bounded, path-free diagnostics from an already validated
 * report. This record is runtime evidence and never enters batch/result IDs.
 */
const createVerifiedCaptureDiagnostic = (
  recipe, report, result, executionProof, executionTuningProof, executionPlan,
) => deepFreeze({
  candidate: recipe.name,
  result,
  execution: {
    captureEntryId: executionProof.entryId,
    gpu: executionProof.gpu,
    executionTuning: executionTuningProof,
  },
  render: {
    backend: report.backend,
    hdrPipeline: report.hdrPipeline,
    backingSize: report.backingSize,
  },
  ...(report.captureGeometry === undefined ? {} : {
    captureGeometry: report.captureGeometry,
  }),
  invariants: {
    semantic: true,
    fieldAlpha: true,
    framebufferAlpha: true,
  },
  // Older portable packages legitimately predate these report signatures.
  // Preserve their verifier contract while projecting every signature that a
  // newer capture supplies; consumers such as the live receipt-v2 manifest
  // remain free to require the complete set.
  ...(report.semantic === undefined ? {} : {
    semantic: verifiedSemanticDiagnostic(report.semantic),
  }),
  ...(report.fieldAlpha === undefined ? {} : {
    fieldAlpha: verifiedAlphaDiagnostic(report.fieldAlpha, 'fieldAlpha'),
  }),
  ...(report.framebufferAlpha === undefined ? {} : {
    framebufferAlpha: verifiedAlphaDiagnostic(report.framebufferAlpha, 'framebufferAlpha'),
  }),
  captures: Object.fromEntries(VARIANTS.map((variant, index) => {
    const capture = report.captures[variant];
    const receipt = capture.completedFrameReceipt;
    return [variant, {
      sha256: result.captureSha256[variant],
      bytes: capture.bytes,
      width: capture.width,
      height: capture.height,
      cssWidth: capture.cssWidth,
      cssHeight: capture.cssHeight,
      clipScale: capture.clipScale,
      selection: executionPlan.compiled.variants[index].expectedDataset,
      ...(receipt === undefined ? {} : {
        completedFrameReceipt: { schema: receipt.schema, state: receipt.state },
      }),
    }];
  })),
});

const normalizeResult = (recipe, result) => {
  let expected;
  try {
    expected = createVisualLabResultRecord(
      recipe.name,
      visualLabRequestForRecipe(recipe),
      result?.captureSha256,
    );
  } catch (error) {
    throw new TypeError(`Invalid result for ${recipe.name}: ${error.message}`, { cause: error });
  }
  if (!isDeepStrictEqual(result, expected)) {
    throw new TypeError(
      `Invalid result for ${recipe.name}: content-addressed record does not match recipe`,
    );
  }
  return expected;
};

/** Constructs the canonical, machine-independent batch index. */
export function createVisualLabBatchIndex(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new TypeError('Visual Lab batch entries must be a non-empty array');
  }
  const seen = new Set();
  const candidates = entries.map((entry, index) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new TypeError(`Visual Lab batch entry ${index} must be an object`);
    }
    const recipe = resolveVisualLabCaptureRecipe(entry.candidate);
    if (seen.has(recipe.name)) throw new TypeError(`Duplicate batch candidate ${recipe.name}`);
    seen.add(recipe.name);

    if (entry.status === 'passed') {
      if (!Array.isArray(entry.warnings)
        || entry.warnings.some((warning) => typeof warning !== 'string')) {
        throw new TypeError(`Batch warnings for ${recipe.name} must be strings`);
      }
      return {
        candidate: recipe.name,
        status: 'passed',
        result: normalizeResult(recipe, entry.result),
        artifacts: visualLabPassedArtifacts(recipe.name),
        warnings: Object.freeze([...entry.warnings]),
      };
    }

    if (entry.status === 'failed' && FAILURE_CODES.has(entry.failure)) {
      return {
        candidate: recipe.name,
        status: 'failed',
        failure: entry.failure,
        artifacts: visualLabFailedArtifacts(recipe.name),
      };
    }
    throw new TypeError(`Batch entry for ${recipe.name} has an invalid status or failure code`);
  });

  const catalogOrder = new Map(
    visualLabCaptureRecipeNames().map((candidate, index) => [candidate, index]),
  );
  candidates.sort((left, right) => (
    catalogOrder.get(left.candidate) - catalogOrder.get(right.candidate)
  ));
  const passed = candidates.filter(({ status }) => status === 'passed').length;
  const complete = passed === candidates.length;
  return deepFreeze({
    schema: VISUAL_LAB_BATCH_SCHEMA,
    complete,
    summary: {
      selected: candidates.length,
      passed,
      failed: candidates.length - passed,
    },
    candidates,
  });
}

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const renderPassedCard = (entry) => {
  const { request } = entry.result;
  const { captureDriver } = resolveVisualCaptureRequest(request);
  const warnings = entry.warnings.length === 0 ? '' : `
        <ul class="warnings">${entry.warnings.map((warning) => (
    `<li>${escapeHtml(warning)}</li>`
  )).join('')}</ul>`;
  const figures = VARIANTS.map((variant) => `
          <figure>
            <img src="./${escapeHtml(entry.artifacts[variant])}" loading="lazy" alt="${
  escapeHtml(`${entry.candidate} ${variant}`)
}">
            <figcaption>${escapeHtml(visualCaptureVariantLabel(captureDriver, variant))}</figcaption>
          </figure>`).join('');
  return `
      <article class="candidate passed">
        <header>
          <h2>${escapeHtml(entry.candidate)}</h2>
          <span class="status">passed</span>
        </header>
        <p>${escapeHtml(request.domain)} target ${request.target} · ${
  escapeHtml(request.fixture)
} · gain ${request.gain} · ${request.renderScale}×</p>
        <p class="identity"><code>${escapeHtml(entry.result.id)}</code> · <a href="./${
  escapeHtml(entry.artifacts.report)
}">report.json</a></p>${warnings}
        <div class="captures">${figures}
        </div>
      </article>`;
};

const renderFailedCard = (entry) => `
      <article class="candidate failed">
        <header>
          <h2>${escapeHtml(entry.candidate)}</h2>
          <span class="status">failed</span>
        </header>
        <p>Failure: <code>${escapeHtml(entry.failure)}</code></p>
        <p><a href="./${escapeHtml(entry.artifacts.diagnostic)}">diagnostic log</a></p>
      </article>`;

/** Renders a portable static sheet; all links are rooted inside the batch directory. */
export function renderVisualLabContactSheet(index) {
  if (index?.schema !== VISUAL_LAB_BATCH_SCHEMA
    || typeof index.complete !== 'boolean'
    || !Array.isArray(index.candidates)) {
    throw new TypeError(`Contact sheet requires ${VISUAL_LAB_BATCH_SCHEMA}`);
  }
  const cards = index.candidates.map((entry) => (
    entry.status === 'passed' ? renderPassedCard(entry) : renderFailedCard(entry)
  )).join('');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>AniforTPT Visual Lab batch</title>
  <style>
    :root { color-scheme: dark; font-family: system-ui, sans-serif; background: #11151b; color: #eaf0f7; }
    body { margin: 0 auto; max-width: 1800px; padding: 24px; }
    h1, h2, p { margin: 0; }
    body > header { display: flex; gap: 16px; align-items: baseline; margin-bottom: 20px; }
    main { display: grid; gap: 18px; }
    .candidate { background: #1b222c; border: 1px solid #344252; border-radius: 12px; padding: 16px; }
    .candidate > header { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
    .status { border-radius: 999px; padding: 3px 9px; background: #254e3b; color: #bff6d4; }
    .failed { border-color: #71404a; }
    .failed .status { background: #612f3b; color: #ffd4dc; }
    .identity { margin-top: 7px; overflow-wrap: anywhere; color: #aebdcd; }
    a { color: #92c7ff; }
    .warnings { color: #ffd88d; }
    .captures { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
    figure { margin: 0; min-width: 0; }
    img { display: block; width: 100%; height: auto; border-radius: 7px; background: #080b0f; }
    figcaption { margin-top: 5px; text-align: center; color: #b8c5d2; }
    @media (max-width: 760px) { body { padding: 12px; } .captures { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <header>
    <h1>Visual Lab contact sheet</h1>
    <p><strong>${index.complete ? 'Complete' : 'Incomplete'}</strong> · ${
  index.summary.passed
}/${index.summary.selected} passed</p>
  </header>
  <main>${cards}
  </main>
</body>
</html>
`;
}

/** Current-only inspection surface. It deliberately has no decision controls. */
export function renderVisualLabExperimentBoard(index, response) {
  if (index?.schema !== VISUAL_LAB_BATCH_SCHEMA || index.complete !== true
    || response?.schema !== VISUAL_LAB_CURRENT_EXPERIMENT_RESPONSE_SCHEMA
    || !Array.isArray(response.candidates)) {
    throw new TypeError('Experiment board requires a complete batch and response evidence');
  }
  const byCandidate = new Map(response.candidates.map((entry) => [entry.candidate, entry]));
  const cards = index.candidates.map((entry) => {
    const measured = byCandidate.get(entry.candidate);
    if (entry.status !== 'passed' || measured?.result?.id !== entry.result.id) {
      throw new TypeError(`Experiment response does not match ${entry.candidate}`);
    }
    const figures = VARIANTS.map((variant) => `<figure><a href="./${
      escapeHtml(entry.artifacts[variant])
    }"><img src="./${escapeHtml(entry.artifacts[variant])}" loading="lazy" alt="${
      escapeHtml(`${entry.candidate} ${variant}`)
    }"></a><figcaption>${escapeHtml(variant.toUpperCase())}</figcaption></figure>`).join('');
    const metrics = Object.values(measured.pairs).map(({ left, right, metric }) => {
      const summary = metric.kind === 'dimension-mismatch'
        ? `dimensions ${metric.left?.width ?? metric.baseline.width}×${metric.left?.height ?? metric.baseline.height} → ${metric.right?.width ?? metric.current.width}×${metric.right?.height ?? metric.current.height}`
        : `RGB changed pixels ${metric.rgb.differentPixels}, peak ${metric.rgb.channelPeak}; alpha changed pixels ${metric.alpha.differentPixels}, peak ${metric.alpha.channelPeak}`;
      return `<li><strong>${escapeHtml(left.toUpperCase())}→${escapeHtml(right.toUpperCase())}</strong>: ${escapeHtml(summary)}</li>`;
    }).join('');
    return `<article><h2>${escapeHtml(entry.candidate)}</h2><div class="captures">${figures}</div><ul>${metrics}</ul></article>`;
  }).join('');
  if (byCandidate.size !== index.candidates.length) {
    throw new TypeError('Experiment response contains candidates outside the batch');
  }
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Visual Lab current experiment</title><style>:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#11151b;color:#eaf0f7}body{margin:0 auto;max-width:1800px;padding:24px}article{background:#1b222c;border:1px solid #344252;border-radius:12px;padding:16px;margin:18px 0}.captures{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}figure{margin:0}img{display:block;width:100%;height:auto}figcaption{text-align:center;margin-top:5px}@media(max-width:760px){.captures{grid-template-columns:1fr}}</style></head><body><h1>Current experiment response</h1><p>OFF, A, and B captures from this batch. Hashes authenticate files within this package only. Measurements provide no score or verdict and do not pin visuals across revisions. Full response data is in <a href="./experiment-response.json">experiment-response.json</a>.</p><main>${cards}</main></body></html>\n`;
}

/** Compact, current-only spatial evidence view with no decision controls. */
export function renderVisualLabRegionResponseBoard(response) {
  if (response?.schema !== VISUAL_LAB_CURRENT_REGION_RESPONSE_SCHEMA
    || !Array.isArray(response.candidates) || response.candidates.length === 0) {
    throw new TypeError('Region-response board requires current spatial evidence');
  }
  const cards = response.candidates.map((candidate) => {
    const renderRow = (region) => {
      const delta = region.pairs.offToB.signedRgbaMeanDelta;
      return `<tr><th>${escapeHtml(region.name)}</th><td>${escapeHtml(region.role)}</td><td>${escapeHtml(`${region.x},${region.y} ${region.width}×${region.height}`)}</td><td>${escapeHtml(delta.slice(0, 3).map((value) => value.toFixed(3)).join(', '))}</td><td>${escapeHtml(delta[3].toFixed(3))}</td></tr>`;
    };
    const presentation = resolveVisualLabInspectionPresentation(
      candidate.candidate, candidate.regions,
    );
    const rows = presentation === null
      ? candidate.regions.map(renderRow).join('')
      : presentation.map(({ key, label, regions }) => `<tr class="section" data-section="${escapeHtml(key)}"><th colspan="5">${escapeHtml(label)}</th></tr>${regions.map(renderRow).join('')}`).join('');
    return `<article><h2>${escapeHtml(candidate.candidate)}</h2><table><thead><tr><th>Region</th><th>Role</th><th>World rect</th><th>OFF→B signed RGB mean</th><th>Alpha</th></tr></thead><tbody>${rows}</tbody></table></article>`;
  }).join('');
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Visual Lab region response</title><style>:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#11151b;color:#eaf0f7}body{margin:0 auto;max-width:1400px;padding:24px}article{overflow:auto;background:#1b222c;border:1px solid #344252;border-radius:12px;padding:16px}table{border-collapse:collapse;width:100%}th,td{padding:7px;border-bottom:1px solid #344252;text-align:left}.section th{padding-top:18px;color:#9fd0ff;background:#151d26}</style></head><body><h1>Current region response</h1><p>Spatial measurements from this batch only. Hashes authenticate package files; values provide no aesthetic score, verdict, or cross-revision visual requirement. Full data is in <a href="./region-response.json">region-response.json</a>.</p>${cards}</body></html>\n`;
}

/** Descriptive local-structure evidence with no ranking or acceptance controls. */
export function renderVisualLabRegionAppearanceBoard(appearance) {
  if (appearance?.schema !== VISUAL_LAB_CURRENT_REGION_APPEARANCE_SCHEMA
    || !Array.isArray(appearance.candidates) || appearance.candidates.length === 0) {
    throw new TypeError('Region-appearance board requires current spatial evidence');
  }
  const cards = appearance.candidates.map((candidate) => {
    const renderRegion = (region) => {
      const delta = region.pairs.offToB;
      const rect = region.pixelRect;
      const fitScale = Math.max(1, Math.floor(Math.min(
        320 / rect.width, 220 / rect.height,
      )));
      const detailScale = Math.ceil(12 / Math.min(rect.width, rect.height));
      const longAxisScale = Math.max(1, Math.floor(
        900 / Math.max(rect.width, rect.height),
      ));
      const cropScale = Math.min(
        8, Math.max(fitScale, Math.min(detailScale, longAxisScale)),
      );
      const crops = VARIANTS.map((variant) => {
        const source = `./candidates/${candidate.candidate}/${variant}.png`;
        return `<figure><a href="${escapeHtml(source)}"><span class="crop" style="width:${rect.width * cropScale}px;height:${rect.height * cropScale}px"><img src="${escapeHtml(source)}" loading="lazy" alt="${escapeHtml(`${candidate.candidate} ${region.name} ${variant}`)}" style="left:-${rect.x * cropScale}px;top:-${rect.y * cropScale}px;transform:scale(${cropScale});transform-origin:top left"></span></a><figcaption>${escapeHtml(`${variant.toUpperCase()} · ${cropScale}×`)}</figcaption></figure>`;
      }).join('');
      const profile = region.presentation === undefined ? '' : `<details class="profile"><summary>${escapeHtml(`${region.presentation.optics} · class ${region.presentation.opticsCode}`)}</summary><dl>${Object.entries(region.presentation.profile).map(([lane, value]) => `<div><dt>${escapeHtml(lane)}</dt><dd>${escapeHtml(Number(value).toFixed(2))}</dd></div>`).join('')}</dl></details>`;
      return `<section class="region"><header><h4>${escapeHtml(region.name)}</h4><p>${escapeHtml(region.role)} · world ${escapeHtml(`${region.x},${region.y} ${region.width}×${region.height}`)} · pixels ${escapeHtml(`${rect.x},${rect.y} ${rect.width}×${rect.height}`)}</p></header>${profile}<div class="crops">${crops}</div><dl><div><dt>OFF→B luma</dt><dd>${escapeHtml(delta.signedLumaMeanDelta.toFixed(3))}</dd></div><div><dt>spread</dt><dd>${escapeHtml(delta.signedLumaStandardDeviationDelta.toFixed(3))}</dd></div><div><dt>neighbour contrast</dt><dd>${escapeHtml(delta.signedLumaNeighbourAbsoluteMeanDelta.toFixed(3))}</dd></div></dl></section>`;
    };
    const presentation = resolveVisualLabInspectionPresentation(
      candidate.candidate, candidate.regions,
    );
    const sections = presentation === null
      ? `<div class="regions">${candidate.regions.map(renderRegion).join('')}</div>`
      : presentation.map(({ key, label, regions }) => `<section class="region-group" data-section="${escapeHtml(key)}"><h3>${escapeHtml(label)}</h3><div class="regions">${regions.map(renderRegion).join('')}</div></section>`).join('');
    return `<article><h2>${escapeHtml(candidate.candidate)}</h2>${sections}</article>`;
  }).join('');
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Visual Lab region appearance</title><style>:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#11151b;color:#eaf0f7}body{margin:0 auto;max-width:1800px;padding:24px}article{background:#1b222c;border:1px solid #344252;border-radius:12px;padding:16px;margin:18px 0}.region-group{margin-top:22px}.region-group>h3{color:#9fd0ff;border-bottom:1px solid #344252;padding-bottom:7px}.regions{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,560px),1fr));gap:14px}.region{min-width:0;background:#121820;border:1px solid #2d3a48;border-radius:9px;padding:12px}.region header{display:flex;justify-content:space-between;gap:10px;align-items:baseline}.region h4,.region p{margin:0}.region p{color:#aebdcd;font-size:.82rem;text-align:right}.profile{margin-top:8px;color:#b8c5d2}.profile summary{cursor:pointer;color:#9fd0ff}.profile dl{padding:7px 9px;background:#0c1117;border-radius:6px}.crops{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:10px;overflow:auto}.crops figure{margin:0;min-width:0}.crop{display:block;position:relative;overflow:hidden;max-width:none;background:#080b0f;border:1px solid #344252;image-rendering:auto}.crop img{display:block;position:absolute;max-width:none}figcaption{text-align:center;color:#b8c5d2;font-size:.78rem;margin-top:3px}dl{display:flex;flex-wrap:wrap;gap:6px 14px;margin:10px 0 0}dl div{display:flex;gap:5px}dt{color:#9eb0c2}dd{margin:0;font-variant-numeric:tabular-nums}@media(max-width:700px){body{padding:12px}.region header{display:block}.region p{text-align:left;margin-top:3px}}</style></head><body><h1>Current region appearance</h1><p>OFF/A/B crops are deterministically enlarged up to 8× for inspection; local luminance measurements still use the authenticated source pixels. They expose texture, edges, and tonal variation without scoring or deciding aesthetics. Resolved class profiles explain renderer inputs without changing evidence. Select a crop to open its authenticated full capture. Full data is in <a href="./region-appearance.json">region-appearance.json</a>.</p>${cards}</body></html>\n`;
}

const assertCurrentCaptureContract = (report, executionPlan, hashes) => {
  const {
    recipe, request, domainAdapter: domain, fixtureAdapter: fixture,
    captureDriver: driver, compiled,
  } = executionPlan;
  const expectedPreparation = executionPlan.inspection.fixture.preparation.reportLabel;
  const expectedBacking = `${WORLD_WIDTH * recipe.renderScale}x${WORLD_HEIGHT * recipe.renderScale}`;
  const expectedCapability = {
    targetKind: domain.targetKind,
    executionProfile: domain.executionProfile,
    evidence: domain.evidence,
    fixedUrlParameters: domain.fixedUrlParameters,
  };

  for (const [name, value] of Object.entries(request)) {
    if (report[name] !== value) throw new Error(`top-level ${name} does not match the recipe`);
  }
  if (report.fixtureScene !== fixture.scene
    || report.fixturePreparation !== expectedPreparation) {
    throw new Error('fixture scene or preparation does not match the current fixture adapter');
  }
  if (report.targetKind !== domain.targetKind
    || !isDeepStrictEqual(report.domainCapability, expectedCapability)) {
    throw new Error('domain capability does not match the current capture adapter');
  }
  if (!isDeepStrictEqual(report.captureProtocol, VISUAL_LAB_CAPTURE_PROTOCOL)) {
    throw new Error('capture protocol does not match the current protocol');
  }
  let captureUrl;
  try { captureUrl = new URL(report.url); }
  catch { throw new Error('capture URL must be an absolute HTTP(S) or file URL'); }
  if (!['http:', 'https:', 'file:'].includes(captureUrl.protocol)
    || captureUrl.searchParams.toString() !== executionPlan.inspection.canonicalQuery) {
    throw new Error('capture URL query does not match the hermetic execution plan');
  }
  assertVisualCaptureDriverReportDescriptor(driver, report.captureDriver);
  if (report.backend !== domain.executionProfile.backend
    || report.hdrPipeline !== VISUAL_LAB_CAPTURE_PROTOCOL.datasetRequirements.hdrPipeline) {
    throw new Error('report did not complete on canonical WebGL with active HDR');
  }
  if (report.backingSize !== expectedBacking) {
    throw new Error(`backingSize must be ${expectedBacking}`);
  }

  // This proof is additive so historical portable packages remain readable.
  // When present it must bind the report to the canonical audit frame, rather
  // than merely proving that each PNG agrees with its own sampled clip.
  const captureGeometry = report.captureGeometry;
  if (captureGeometry !== undefined) {
    const expectedGeometry = createVisualCaptureGeometryProof(recipe.renderScale);
    if (!isDeepStrictEqual(captureGeometry, expectedGeometry)) {
      throw new Error('captureGeometry does not match the canonical proof');
    }
    const expectedGeometryBacking = `${expectedGeometry.canvas.backingWidth}x${
      expectedGeometry.canvas.backingHeight}`;
    if (report.backingSize !== expectedGeometryBacking) {
      throw new Error('backingSize does not match captureGeometry');
    }
  }

  const startup = report.startupSelection;
  const expectedStartupDriverFields = compiled.startupFields;
  const actualStartupDriverFields = Object.fromEntries(
    ['captureDriver', 'selection']
      .filter((name) => Object.hasOwn(startup ?? {}, name))
      .map((name) => [name, startup[name]]),
  );
  const fixtureActivationStartup = [
    VISUAL_LAB_EXECUTION_TUNING_PLAN_V5_SCHEMA,
    VISUAL_LAB_EXECUTION_TUNING_PLAN_V6_SCHEMA,
    VISUAL_LAB_EXECUTION_TUNING_PLAN_V7_SCHEMA,
  ].includes(report.executionTuning?.schema);
  const startupTransportValid = fixtureActivationStartup
    ? startup?.typedActivation === true
      && Number.isSafeInteger(startup.ticket) && startup.ticket > 0
      && startup.backendBeforeSelection === undefined
      && startup.backendReasonBeforeSelection === undefined
      && startup.stagedBeforeWebGL === undefined
    : startup?.backendBeforeSelection === 'canvas2d'
      && startup.backendReasonBeforeSelection === 'webgl-starting'
      && startup.stagedBeforeWebGL === true
      && startup.typedActivation === undefined
      && startup.ticket === undefined;
  if (startup?.requestedVariant !== 2
    || startup.fixture !== recipe.fixture
    || startup.scene !== fixture.scene
    || startup.preparation !== expectedPreparation
    || startup.fixturePrepared !== true
    || !startupTransportValid
    || !isDeepStrictEqual(actualStartupDriverFields, expectedStartupDriverFields)) {
    throw new Error(fixtureActivationStartup
      ? 'startup selection was not bound to the typed fixture-activation transaction'
      : 'startup selection was not staged through bounded Canvas promotion');
  }

  for (let index = 0; index < VARIANTS.length; index++) {
    const variant = VARIANTS[index];
    const capture = report.captures?.[variant];
    const dataset = capture?.dataset;
    const expectedDriverState = compiled.variants[index].expectedDataset;
    if (!Number.isSafeInteger(capture?.bytes) || capture.bytes <= 0) {
      throw new Error(`${variant} capture byte count must be positive`);
    }
    if (!Number.isSafeInteger(capture.width) || !Number.isSafeInteger(capture.height)) {
      throw new Error(`${variant} capture pixel dimensions must be integers`);
    }
    if (!Number.isFinite(capture.cssWidth) || capture.cssWidth <= 0
      || !Number.isFinite(capture.cssHeight) || capture.cssHeight <= 0
      || capture.clipScale !== 1
      || Math.abs(capture.width - capture.cssWidth) > 1
      || Math.abs(capture.height - capture.cssHeight) > 1) {
      throw new Error(`${variant} capture pixels do not match the scale-1 CSS canvas clip`);
    }
    if (captureGeometry !== undefined) {
      const { canvas } = captureGeometry;
      if (capture.width !== canvas.width
        || capture.height !== canvas.height
        || capture.cssWidth !== canvas.width
        || capture.cssHeight !== canvas.height
        || capture.clipScale !== canvas.clipScale) {
        throw new Error(`${variant} capture does not match captureGeometry`);
      }
    }
    if (capture.distinctFromOff !== (hashes[variant] !== hashes.off)) {
      throw new Error(`${variant} distinctFromOff does not match its capture hash`);
    }
    if (dataset?.renderer !== VISUAL_LAB_CAPTURE_PROTOCOL.datasetRequirements.renderer
      || dataset.hdrPipeline !== VISUAL_LAB_CAPTURE_PROTOCOL.datasetRequirements.hdrPipeline
      || dataset.renderLook !== VISUAL_LAB_CAPTURE_PROTOCOL.fixedUrlParameters.renderLook
      || dataset.outputScale !== String(recipe.renderScale)
      || dataset.backingSize !== expectedBacking
      || Object.entries(expectedDriverState).some(([name, value]) => (
        dataset?.[name] !== value
      ))) {
      throw new Error(`${variant} capture dataset does not match the requested driver state`);
    }
  }
};

const readFailureTombstone = async (candidateDirectory, recipe, {
  rejectSymlink = false,
} = {}) => {
  const tombstonePath = path.join(candidateDirectory, 'failure.log');
  const details = await pathDetails(tombstonePath);
  // A stale leaf symlink is never evidence. Treat it as absent so the current
  // report decision owns the failure code and writeFailure can atomically
  // replace the link without following or modifying its target.
  if (details?.isSymbolicLink()) {
    if (rejectSymlink) {
      throw new CandidateArtifactError(
        'artifact-invalid', `${recipe.name} failure tombstone must not be a symbolic link`,
      );
    }
    return;
  }
  let source;
  try {
    source = await readStableRegularFile(
      tombstonePath, `${recipe.name} failure tombstone`, 'utf8',
    );
  }
  catch (error) {
    if (error?.code === 'ENOENT') return;
    throw new CandidateArtifactError(
      'capture-failed', `Cannot read ${recipe.name} failure tombstone: ${error.message}`,
      { cause: error },
    );
  }
  const recordedCode = source.split(/\r?\n/, 1)[0];
  const code = FAILURE_CODES.has(recordedCode) ? recordedCode : 'capture-failed';
  throw new CandidateArtifactError(
    code, `${recipe.name} retains a ${code} failure tombstone; run a fresh capture to clear it`,
    { preserveDiagnostic: true },
  );
};

const readCandidateReport = async (candidateDirectory, recipe, {
  strictFailureTombstone = false,
  executionPlan,
  executionTuningPlan,
  executionTuningEntry,
  reportFileName = 'report.json',
  skipFailureTombstone = false,
} = {}) => {
  if (!skipFailureTombstone) {
    await readFailureTombstone(candidateDirectory, recipe, {
      rejectSymlink: strictFailureTombstone,
    });
  }
  if (reportFileName !== 'report.json' && reportFileName !== 'report.pending.json') {
    throw new TypeError('Visual Lab candidate report file name is not owned by the batch');
  }
  const reportPath = path.join(candidateDirectory, reportFileName);
  let source;
  try {
    source = await readStableRegularFile(reportPath, `${recipe.name} ${reportFileName}`, 'utf8');
  } catch (error) {
    throw new CandidateArtifactError(
      error?.code === 'ENOENT' ? 'report-missing' : 'report-invalid',
      `Cannot read ${recipe.name} ${reportFileName}: ${error.message}`,
      { cause: error },
    );
  }

  let report;
  try {
    report = JSON.parse(source);
  } catch (error) {
    throw new CandidateArtifactError(
      'report-invalid', `${recipe.name} ${reportFileName} is not valid JSON`, { cause: error },
    );
  }

  let expected;
  let timings = null;
  let captureSubphases = null;
  let executionProof;
  let executionTuningProof = null;
  let captureExecutionPlan;
  let captureDiagnostic;
  try {
    if (report?.tool !== 'visual-lab-audit-v1') throw new Error('unexpected report tool');
    const hashes = Object.fromEntries(VARIANTS.map((variant) => [
      variant, report?.captures?.[variant]?.sha256,
    ]));
    expected = createVisualLabResultRecord(
      recipe.name, visualLabRequestForRecipe(recipe), hashes,
    );
    if (!isDeepStrictEqual(report.result, expected)) {
      throw new Error('content-addressed result does not match recipe and declared captures');
    }
    if (!Array.isArray(report.warnings)
      || report.warnings.some((warning) => typeof warning !== 'string')) {
      throw new Error('warnings must be an array of strings');
    }
    if (report.invariants?.semantic !== true
      || report.invariants?.fieldAlpha !== true
      || report.invariants?.framebufferAlpha !== true) {
      throw new Error('semantic, field-alpha, and framebuffer-alpha invariants must all pass');
    }
    if (report.browserErrors !== 0) {
      throw new Error('browserErrors must be exactly zero');
    }
    if (report.timings !== undefined) {
      timings = normalizeVisualLabTimings(report.timings);
    }
    if (report.captureSubphases !== undefined) {
      captureSubphases = normalizeVisualLabCaptureSubphaseTimings(
        report.captureSubphases,
      );
    }
    if (typeof report.url !== 'string') throw new Error('capture URL must be a string');
    let reportBaseUrl;
    try {
      reportBaseUrl = new URL(report.url);
      reportBaseUrl.search = '';
      reportBaseUrl.hash = '';
    } catch {
      throw new Error('capture URL must be an absolute HTTP(S) or file URL');
    }
    const resolvedExecutionPlan = executionPlan ?? createVisualLabExecutionPlan({
      candidates: [recipe.name],
      baseUrl: reportBaseUrl,
      gpu: report.gpu,
    }).entries[0];
    captureExecutionPlan = resolvedExecutionPlan;
    assertCurrentCaptureContract(report, resolvedExecutionPlan, hashes);
    executionProof = Object.freeze({
      entryId: resolvedExecutionPlan.inspection.id,
      baseUrl: reportBaseUrl.href,
      gpu: report.gpu,
    });
    if (report.executionTuning !== undefined) {
      const proof = report.executionTuning;
      const fields = proof !== null && typeof proof === 'object' && !Array.isArray(proof)
        ? Reflect.ownKeys(proof) : [];
      if (fields.length !== 3
        || !['schema', 'planId', 'entryId'].every((field) => fields.includes(field))
        || ![
          VISUAL_LAB_EXECUTION_TUNING_PLAN_SCHEMA,
          VISUAL_LAB_EXECUTION_TUNING_PLAN_V2_SCHEMA,
          VISUAL_LAB_EXECUTION_TUNING_PLAN_V3_SCHEMA,
          VISUAL_LAB_EXECUTION_TUNING_PLAN_V4_SCHEMA,
          VISUAL_LAB_EXECUTION_TUNING_PLAN_V5_SCHEMA,
          VISUAL_LAB_EXECUTION_TUNING_PLAN_V6_SCHEMA,
          VISUAL_LAB_EXECUTION_TUNING_PLAN_V7_SCHEMA,
        ].includes(proof.schema)
        || !/^sha256:[a-f0-9]{64}$/.test(proof.planId)
        || !/^sha256:[a-f0-9]{64}$/.test(proof.entryId)) {
        throw new Error('execution-tuning proof is malformed');
      }
      executionTuningProof = Object.freeze({
        schema: proof.schema,
        planId: proof.planId,
        entryId: proof.entryId,
      });
      assertCompletedFrameReceiptReportProof(report, proof.schema);
      if ([VISUAL_LAB_EXECUTION_TUNING_PLAN_V5_SCHEMA,
        VISUAL_LAB_EXECUTION_TUNING_PLAN_V6_SCHEMA,
        VISUAL_LAB_EXECUTION_TUNING_PLAN_V7_SCHEMA].includes(proof.schema)
        && captureSubphases?.readiness?.snapshotAttempts !== 1) {
        throw new Error('fixture-activation generation proof must retain exactly one readiness snapshot');
      }
    }
    if (executionTuningPlan !== undefined || executionTuningEntry !== undefined) {
      if (!executionTuningPlan || !executionTuningEntry) {
        throw new Error('execution-tuning validation requires its plan and entry together');
      }
      const expectedTuningProof = {
        schema: executionTuningPlan.schema,
        planId: executionTuningPlan.id,
        entryId: executionTuningEntry.id,
      };
      if (!isDeepStrictEqual(executionTuningProof, expectedTuningProof)) {
        throw new Error('execution-tuning proof does not match the captured plan entry');
      }
    }
    captureDiagnostic = createVerifiedCaptureDiagnostic(
      recipe, report, expected, executionProof, executionTuningProof, captureExecutionPlan,
    );
  } catch (error) {
    throw new CandidateArtifactError(
      'report-invalid', `${recipe.name} report validation failed: ${error.message}`, { cause: error },
    );
  }

  let dimensions;
  for (const variant of VARIANTS) {
    const image = path.join(candidateDirectory, `${variant}.png`);
    let bytes;
    try {
      bytes = await readStableRegularFile(image, `${recipe.name} ${variant}.png`);
    } catch (error) {
      throw new CandidateArtifactError(
        'artifact-invalid', `Cannot read ${recipe.name} ${variant}.png: ${error.message}`,
        { cause: error },
      );
    }
    const actual = createHash('sha256').update(bytes).digest('hex');
    if (actual !== expected.captureSha256[variant]) {
      throw new CandidateArtifactError(
        'artifact-invalid', `${recipe.name} ${variant}.png does not match report SHA-256`,
      );
    }
    if (bytes.byteLength !== report.captures[variant].bytes) {
      throw new CandidateArtifactError(
        'artifact-invalid', `${recipe.name} ${variant}.png byte count does not match report`,
      );
    }
    let current;
    try { current = inspectVisualLabPng(bytes, `${recipe.name} ${variant}.png`); }
    catch (error) {
      throw new CandidateArtifactError('artifact-invalid', error.message, { cause: error });
    }
    dimensions ??= current;
    if (current.width !== report.captures[variant].width
      || current.height !== report.captures[variant].height) {
      throw new CandidateArtifactError(
        'artifact-invalid', `${recipe.name} ${variant}.png dimensions do not match report`,
      );
    }
    if (current.width !== dimensions.width || current.height !== dimensions.height) {
      throw new CandidateArtifactError(
        'artifact-invalid', `${recipe.name} PNG dimensions are inconsistent across variants`,
      );
    }
  }

  return {
    candidate: recipe.name,
    status: 'passed',
    result: expected,
    warnings: [...report.warnings],
    executionProof,
    executionTuningProof,
    captureDiagnostic,
    ...(timings === null ? {} : { timings }),
    ...(captureSubphases === null ? {} : { captureSubphases }),
  };
};

const summarizeEntryTimings = (entries) => summarizeVisualLabTimings(
  entries.flatMap((entry) => entry.timings === undefined ? [] : [{
    candidate: entry.candidate,
    timings: entry.timings,
  }]),
);

const summarizeEntryCaptureSubphases = (entries) => (
  summarizeVisualLabCaptureSubphaseTimings(
    entries.flatMap((entry) => entry.captureSubphases === undefined ? [] : [{
      candidate: entry.candidate,
      captureSubphases: entry.captureSubphases,
    }]),
  )
);

const readPortableFailureEntry = async (candidateDirectory, recipe) => {
  const source = await readStableRegularFile(
    path.join(candidateDirectory, 'failure.log'), `${recipe.name} failure tombstone`, 'utf8',
  );
  const [recordedCode, ...details] = source.split(/\r?\n/);
  if (!FAILURE_CODES.has(recordedCode) || details.join('\n').trim().length === 0) {
    throw new CandidateArtifactError(
      'capture-failed', `${recipe.name} failure tombstone is not canonical`,
    );
  }
  return { candidate: recipe.name, status: 'failed', failure: recordedCode };
};

const parsePortableJson = (source, label) => {
  try { return JSON.parse(source); }
  catch (error) { throw new TypeError(`${label} is not valid JSON`, { cause: error }); }
};

const readOptionalBrowserHostPlan = async (file) => {
  if (await pathDetails(file) === undefined) return null;
  const source = await readStableRegularFile(file, 'Visual Lab browser-host plan', 'utf8');
  return normalizeVisualLabBrowserHostPlan(
    parsePortableJson(source, 'Visual Lab browser-host plan'),
  );
};

const readOptionalExecutionTuningPlan = async (file) => {
  if (await pathDetails(file) === undefined) return null;
  const source = await readStableRegularFile(file, 'Visual Lab execution-tuning plan', 'utf8');
  return normalizeExecutionTuningPlan(
    parsePortableJson(source, 'Visual Lab execution-tuning plan'),
  );
};

const readOptionalOriginAttestation = async (file) => {
  if (await pathDetails(file) === undefined) return null;
  const source = await readStableRegularFile(
    file, 'Visual Lab deployed-origin attestation', 'utf8',
  );
  return normalizeVisualLabOriginAttestation(
    parsePortableJson(source, 'Visual Lab deployed-origin attestation'),
  );
};

const assertOriginAttestationCaptureIdentity = (
  originAttestation, entries, { required = false } = {},
) => {
  const passed = entries.filter((entry) => entry.status === 'passed');
  if (originAttestation === null) {
    if (required) {
      throw new TypeError('Visual Lab batch package is missing origin-attestation.json');
    }
    return;
  }
  if (passed.length === 0) {
    if (required) {
      throw new TypeError('Visual Lab origin attestation lacks passed capture identity proof');
    }
    return;
  }
  for (const entry of passed) {
    if (entry.executionProof?.baseUrl !== originAttestation.baseUrl) {
      throw new TypeError(
        `Visual Lab deployed origin does not match ${entry.candidate} capture base URL`,
      );
    }
  }
};

const assertCompletedFrameReceiptReportProof = (report, tuningSchema) => {
  const variantReceiptRequired = tuningSchema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V2_SCHEMA
    || tuningSchema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V3_SCHEMA
    || tuningSchema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V4_SCHEMA
    || tuningSchema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V5_SCHEMA
    || tuningSchema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V6_SCHEMA
    || tuningSchema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V7_SCHEMA;
  const readinessReceiptRequired = tuningSchema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V3_SCHEMA;
  const activationGenerationRequired = tuningSchema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V5_SCHEMA;
  const activationWorkGenerationRequired = tuningSchema
    === VISUAL_LAB_EXECUTION_TUNING_PLAN_V6_SCHEMA;
  const activationRenderFieldGenerationRequired = tuningSchema
    === VISUAL_LAB_EXECUTION_TUNING_PLAN_V7_SCHEMA;
  const contiguousSubmissionsRequired = tuningSchema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V4_SCHEMA
    || tuningSchema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V5_SCHEMA
    || tuningSchema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V6_SCHEMA
    || tuningSchema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V7_SCHEMA;
  const readinessReceipt = report?.readinessCompletedFrameReceipt;
  if (!readinessReceiptRequired && readinessReceipt !== undefined) {
    throw new Error('non-v3 capture must not claim readiness completed-frame receipt proof');
  }
  if (readinessReceiptRequired) {
    const fields = readinessReceipt !== null && typeof readinessReceipt === 'object'
      && !Array.isArray(readinessReceipt) ? Reflect.ownKeys(readinessReceipt) : [];
    if (fields.length !== 4
      || !['schema', 'ticket', 'submission', 'state'].every((field) => fields.includes(field))
      || readinessReceipt.schema !== 'anifor.renderer.completed-frame-receipt/v1'
      || readinessReceipt.state !== 'completed'
      || !Number.isSafeInteger(readinessReceipt.ticket) || readinessReceipt.ticket <= 0
      || !Number.isSafeInteger(readinessReceipt.submission) || readinessReceipt.submission <= 0) {
      throw new Error('readiness completed-frame receipt proof is malformed');
    }
  }
  const activation = report?.readinessFixtureActivationGeneration;
  if (!activationGenerationRequired && activation !== undefined) {
    throw new Error('non-v5 capture must not claim fixture-activation generation proof');
  }
  if (activationGenerationRequired) {
    const fields = activation !== null && typeof activation === 'object'
      && !Array.isArray(activation) ? Reflect.ownKeys(activation) : [];
    if (fields.length !== 3
      || !['ticket', 'generation', 'state'].every((field) => fields.includes(field))
      || activation.state !== 'completed'
      || !Number.isSafeInteger(activation.ticket) || activation.ticket <= 0
      || !Number.isSafeInteger(activation.generation) || activation.generation <= 0) {
      throw new Error('fixture-activation generation proof is malformed');
    }
  }
  const activationWork = report?.readinessFixtureActivationWorkGeneration;
  if (!activationWorkGenerationRequired && activationWork !== undefined) {
    throw new Error('non-v6 capture must not claim fixture-activation work generation proof');
  }
  if (activationWorkGenerationRequired) {
    const fields = activationWork !== null && typeof activationWork === 'object'
      && !Array.isArray(activationWork) ? Reflect.ownKeys(activationWork) : [];
    if (fields.length !== 3
      || !['ticket', 'generation', 'state'].every((field) => fields.includes(field))
      || activationWork.state !== 'completed'
      || !Number.isSafeInteger(activationWork.ticket) || activationWork.ticket <= 0
      || !Number.isSafeInteger(activationWork.generation) || activationWork.generation <= 0) {
      throw new Error('fixture-activation work generation proof is malformed');
    }
  }
  const activationRenderField = report?.readinessFixtureActivationRenderFieldGeneration;
  if (!activationRenderFieldGenerationRequired && activationRenderField !== undefined) {
    throw new Error('non-v7 capture must not claim fixture-activation render-field generation proof');
  }
  if (activationRenderFieldGenerationRequired) {
    const fields = activationRenderField !== null && typeof activationRenderField === 'object'
      && !Array.isArray(activationRenderField) ? Reflect.ownKeys(activationRenderField) : [];
    if (fields.length !== 3
      || !['ticket', 'generation', 'state'].every((field) => fields.includes(field))
      || activationRenderField.state !== 'completed'
      || !Number.isSafeInteger(activationRenderField.ticket) || activationRenderField.ticket <= 0
      || !Number.isSafeInteger(activationRenderField.generation)
      || activationRenderField.generation <= 0) {
      throw new Error('fixture-activation render-field generation proof is malformed');
    }
  }
  let previousTicket = readinessReceiptRequired ? readinessReceipt.ticket : 0;
  let previousSubmission = readinessReceiptRequired ? readinessReceipt.submission : 0;
  let firstCaptureReceipt = true;
  for (const variant of VARIANTS) {
    const receipt = report?.captures?.[variant]?.completedFrameReceipt;
    if (!variantReceiptRequired) {
      if (receipt !== undefined) {
        throw new Error('v1 stable-snapshot capture must not claim completed-frame receipt proof');
      }
      continue;
    }
    const fields = receipt !== null && typeof receipt === 'object' && !Array.isArray(receipt)
      ? Reflect.ownKeys(receipt) : [];
    if (fields.length !== 4
      || !['schema', 'ticket', 'submission', 'state'].every((field) => fields.includes(field))
      || receipt.schema !== 'anifor.renderer.completed-frame-receipt/v1'
      || receipt.state !== 'completed'
      || !Number.isSafeInteger(receipt.ticket) || receipt.ticket <= previousTicket
      || !Number.isSafeInteger(receipt.submission)
      || receipt.submission <= previousSubmission
      || (contiguousSubmissionsRequired && !firstCaptureReceipt
        && receipt.submission !== previousSubmission + 1)) {
      throw new Error(
        `${variant} completed-frame receipt proof is malformed or not monotonically bound`,
      );
    }
    previousTicket = receipt.ticket;
    previousSubmission = receipt.submission;
    firstCaptureReceipt = false;
  }
};

const assertBrowserHostPlanMatchesEntries = (
  browserHostPlan,
  recipes,
  entries = [],
  { requireTimingProof = false } = {},
) => {
  if (browserHostPlan.entries.length !== recipes.length) {
    throw new TypeError('Visual Lab browser-host plan does not match batch candidate count');
  }
  for (let index = 0; index < recipes.length; index++) {
    const recipe = recipes[index];
    const planEntry = browserHostPlan.entries[index];
    if (planEntry.candidate !== recipe.name || planEntry.renderScale !== recipe.renderScale) {
      throw new TypeError(
        `Visual Lab browser-host plan entry ${index} does not match ${recipe.name}`,
      );
    }
    const captured = entries[index];
    if (captured?.status !== 'passed') continue;
    const browserHosts = captured.timings?.counters?.browserHosts;
    if (browserHosts === undefined) {
      if (requireTimingProof) {
        throw new TypeError(
          `Visual Lab browser-host plan for ${recipe.name} lacks capture timing proof`,
        );
      }
      continue;
    }
    const capturedMode = browserHosts === 1 ? 'fresh'
      : browserHosts === 0 ? 'shared' : null;
    if (capturedMode === null || planEntry.effectiveMode !== capturedMode) {
      throw new TypeError(
        `Visual Lab browser-host plan mode for ${recipe.name} does not match its capture timing`,
      );
    }
  }
};

const assertBrowserHostPlanCaptureIdentity = (
  browserHostPlan,
  recipes,
  entries,
  recipeSet,
  outputDirectory,
  { required = false } = {},
) => {
  const passed = entries.filter((entry) => entry.status === 'passed');
  if (passed.length === 0) {
    if (required) {
      throw new TypeError('Visual Lab browser-host plan lacks passed capture identity proof');
    }
    return;
  }
  if (passed.some((entry) => entry.executionProof === undefined)) {
    throw new TypeError('Visual Lab browser-host plan lacks capture execution-entry proof');
  }
  const baseUrls = new Set(passed.map(({ executionProof }) => executionProof.baseUrl));
  const gpuModes = new Set(passed.map(({ executionProof }) => executionProof.gpu));
  if (baseUrls.size !== 1 || gpuModes.size !== 1) {
    throw new TypeError('Visual Lab browser-host plan capture policy is inconsistent across reports');
  }
  const reconstructed = createVisualLabExecutionPlan({
    ...(recipeSet === null
      ? { candidates: recipes.map(({ name }) => name) }
      : { recipeSet }),
    baseUrl: [...baseUrls][0],
    gpu: [...gpuModes][0],
    outputDir: outputDirectory,
  });
  if (browserHostPlan.capturePlan.id !== reconstructed.inspection.id) {
    throw new TypeError(
      'Visual Lab browser-host plan does not bind the captured execution plan identity',
    );
  }
  for (let index = 0; index < reconstructed.entries.length; index++) {
    const expectedEntryId = reconstructed.entries[index].inspection.id;
    if (browserHostPlan.entries[index].captureEntryId !== expectedEntryId) {
      throw new TypeError(
        `Visual Lab browser-host plan does not bind capture entry ${recipes[index].name}`,
      );
    }
    if (entries[index].status === 'passed'
      && entries[index].executionProof.entryId !== expectedEntryId) {
      throw new TypeError(
        `Visual Lab report does not prove capture entry ${recipes[index].name}`,
      );
    }
  }
};

const assertExecutionTuningPlanMatchesEntries = (
  executionTuningPlan,
  recipes,
  entries = [],
  { requireProof = false } = {},
) => {
  if (executionTuningPlan.entries.length !== recipes.length) {
    throw new TypeError('Visual Lab execution-tuning plan does not match batch candidate count');
  }
  for (let index = 0; index < recipes.length; index++) {
    const recipe = recipes[index];
    const planEntry = executionTuningPlan.entries[index];
    if (planEntry.candidate !== recipe.name) {
      throw new TypeError(
        `Visual Lab execution-tuning plan entry ${index} does not match ${recipe.name}`,
      );
    }
    const captured = entries[index];
    if (captured?.status !== 'passed') continue;
    const expectedProof = {
      schema: executionTuningPlan.schema,
      planId: executionTuningPlan.id,
      entryId: planEntry.id,
    };
    if (captured.executionTuningProof === null) {
      if (requireProof) {
        throw new TypeError(
          `Visual Lab execution-tuning plan for ${recipe.name} lacks report proof`,
        );
      }
      continue;
    }
    if (!isDeepStrictEqual(captured.executionTuningProof, expectedProof)) {
      throw new TypeError(
        `Visual Lab execution-tuning proof for ${recipe.name} does not match its plan entry`,
      );
    }
  }
};

const assertExecutionTuningPlanCaptureIdentity = (
  executionTuningPlan,
  recipes,
  entries,
  recipeSet,
  outputDirectory,
  { required = false } = {},
) => {
  const passed = entries.filter((entry) => entry.status === 'passed');
  if (passed.some((entry) => entry.executionProof === undefined)) {
    throw new TypeError('Visual Lab execution-tuning plan lacks capture execution-entry proof');
  }
  const baseUrls = new Set(passed.map(({ executionProof }) => executionProof.baseUrl));
  const gpuModes = new Set(passed.map(({ executionProof }) => executionProof.gpu));
  if (passed.length > 0 && (baseUrls.size !== 1 || gpuModes.size !== 1)) {
    throw new TypeError(
      'Visual Lab execution-tuning plan capture policy is inconsistent across reports',
    );
  }
  // A present sidecar is authoritative evidence even when every capture failed.
  // Reconstruct it against the current capability registry before applying the
  // stronger "must have passed proof" requirement. Capture-plan identity is
  // independent of the runtime base URL, so a fixed valid URL is sufficient in
  // the no-report case; GPU mode remains an explicit tuning-plan identity input.
  const reconstructedBaseUrl = passed.length === 0
    ? 'https://visual-lab.invalid/' : [...baseUrls][0];
  const reconstructedGpuMode = passed.length === 0
    ? executionTuningPlan.gpuMode : [...gpuModes][0];
  const reconstructed = createVisualLabExecutionPlan({
    ...(recipeSet === null
      ? { candidates: recipes.map(({ name }) => name) }
      : { recipeSet }),
    baseUrl: reconstructedBaseUrl,
    gpu: reconstructedGpuMode,
    outputDir: outputDirectory,
  });
  const driverOrder = [...new Set(
    reconstructed.entries.map(({ captureDriver }) => captureDriver.name),
  )];
  const expected = createExecutionTuningPlan(
    reconstructed, driverOrder, captureProofForTuningSchema(executionTuningPlan.schema),
  );
  if (!isDeepStrictEqual(executionTuningPlan, expected)) {
    throw new TypeError(
      'Visual Lab execution-tuning plan does not bind the captured execution plan/capabilities',
    );
  }
  if (passed.length === 0 && required) {
    throw new TypeError('Visual Lab execution-tuning plan lacks passed capture identity proof');
  }
  for (let index = 0; index < reconstructed.entries.length; index++) {
    if (entries[index].status !== 'passed') continue;
    if (entries[index].executionProof.entryId !== reconstructed.entries[index].inspection.id) {
      throw new TypeError(
        `Visual Lab report does not prove capture entry ${recipes[index].name}`,
      );
    }
  }
};

/**
 * Revalidates a downloaded Visual Lab batch without creating, deleting, or
 * rewriting any package file. Legacy batches may omit recipe-set.json; every
 * new batch can require and cross-check that sidecar explicitly.
 */
export async function verifyVisualLabBatchPackage(options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Visual Lab batch verification options must be an object');
  }
  const allowed = new Set([
    'batchRoot', 'requireBrowserHostPlan', 'requireExecutionTuningPlan',
    'requireCaptureGeometry', 'requireComplete', 'requireOriginAttestation', 'requireRecipeSet',
    'recipeSetSourcePath', 'requireExperimentResponse', 'requireRegionResponse',
    'requireRegionAppearance',
  ]);
  const unexpected = Reflect.ownKeys(options).filter((key) => !allowed.has(key));
  if (unexpected.length > 0) {
    throw new TypeError(`Unknown Visual Lab batch verification option ${String(unexpected[0])}`);
  }
  if (typeof options.batchRoot !== 'string' || options.batchRoot.length === 0) {
    throw new TypeError('Visual Lab batch verification requires batchRoot');
  }
  const requireComplete = options.requireComplete ?? true;
  const requireBrowserHostPlan = options.requireBrowserHostPlan ?? false;
  const requireExecutionTuningPlan = options.requireExecutionTuningPlan ?? false;
  const requireCaptureGeometry = options.requireCaptureGeometry ?? false;
  const requireOriginAttestation = options.requireOriginAttestation ?? false;
  const requireRecipeSet = options.requireRecipeSet ?? false;
  const requireExperimentResponse = options.requireExperimentResponse ?? false;
  const requireRegionResponse = options.requireRegionResponse ?? false;
  const requireRegionAppearance = options.requireRegionAppearance ?? false;
  if (typeof requireComplete !== 'boolean'
    || typeof requireBrowserHostPlan !== 'boolean'
    || typeof requireExecutionTuningPlan !== 'boolean'
    || typeof requireCaptureGeometry !== 'boolean'
    || typeof requireOriginAttestation !== 'boolean'
    || typeof requireRecipeSet !== 'boolean'
    || typeof requireExperimentResponse !== 'boolean'
    || typeof requireRegionResponse !== 'boolean'
    || typeof requireRegionAppearance !== 'boolean') {
    throw new TypeError('Visual Lab batch verification requirement flags must be booleans');
  }

  const batchRoot = await assertExistingRealDirectory(
    options.batchRoot, 'Visual Lab batch package',
  );
  const [indexSource, sheet] = await Promise.all([
    readStableRegularFile(path.join(batchRoot, 'index.json'), 'Visual Lab batch index', 'utf8'),
    readStableRegularFile(path.join(batchRoot, 'index.html'), 'Visual Lab contact sheet', 'utf8'),
  ]);
  const index = parsePortableJson(indexSource, 'Visual Lab batch index');
  if (!Array.isArray(index?.candidates) || index.candidates.length === 0) {
    throw new TypeError('Visual Lab batch index must contain candidates');
  }

  const entries = [];
  const recipes = [];
  for (const raw of index.candidates) {
    const recipe = resolveVisualLabCaptureRecipe(raw?.candidate);
    recipes.push(recipe);
    const candidateDirectory = path.join(batchRoot, 'candidates', recipe.name);
    if (raw?.status === 'passed') {
      entries.push(await readCandidateReport(candidateDirectory, recipe, {
        strictFailureTombstone: true,
      }));
    } else if (raw?.status === 'failed') {
      entries.push(await readPortableFailureEntry(candidateDirectory, recipe));
    } else {
      throw new TypeError(`Visual Lab batch candidate ${recipe.name} has an invalid status`);
    }
  }
  const canonical = createVisualLabBatchIndex(entries);
  if (!isDeepStrictEqual(index, canonical)) {
    throw new TypeError('Visual Lab batch index does not match its portable artifacts');
  }
  if (sheet !== renderVisualLabContactSheet(canonical)) {
    throw new TypeError('Visual Lab contact sheet does not match its batch index');
  }
  if (requireComplete && !canonical.complete) {
    throw new TypeError('Visual Lab batch package is incomplete');
  }
  const responsePath = path.join(batchRoot, 'experiment-response.json');
  const experimentBoardPath = path.join(batchRoot, 'experiment-board.html');
  const [responseDetails, boardDetails] = await Promise.all([
    pathDetails(responsePath), pathDetails(experimentBoardPath),
  ]);
  if (Boolean(responseDetails) !== Boolean(boardDetails)) {
    throw new TypeError('Visual Lab batch response JSON and board must be present together');
  }
  if (requireExperimentResponse && !responseDetails) {
    throw new TypeError('Visual Lab batch package is missing current experiment response evidence');
  }
  let experimentResponse = null;
  if (responseDetails) {
    if (!canonical.complete) {
      throw new TypeError('Incomplete Visual Lab batches cannot publish experiment response evidence');
    }
    const [responseSource, boardSource] = await Promise.all([
      readStableRegularFile(
        responsePath, 'Visual Lab experiment response', 'utf8', EXPERIMENT_EVIDENCE_MAX_BYTES,
      ),
      readStableRegularFile(
        experimentBoardPath, 'Visual Lab experiment board', 'utf8',
        EXPERIMENT_EVIDENCE_MAX_BYTES,
      ),
    ]);
    const publishedResponse = parsePortableJson(responseSource, 'Visual Lab experiment response');
    experimentResponse = await createVisualLabBatchExperimentResponse(
      canonical,
      async (candidate, variant) => readStableRegularFile(
        path.join(batchRoot, canonical.candidates.find((entry) => (
          entry.candidate === candidate
        )).artifacts[variant]),
        `Visual Lab ${candidate} ${variant} capture`,
      ),
    );
    if (!isDeepStrictEqual(publishedResponse, experimentResponse)) {
      throw new TypeError('Visual Lab experiment response does not match current captures');
    }
    if (boardSource !== renderVisualLabExperimentBoard(canonical, experimentResponse)) {
      throw new TypeError('Visual Lab experiment board does not match current response evidence');
    }
  }
  const regionResponsePath = path.join(batchRoot, 'region-response.json');
  const regionBoardPath = path.join(batchRoot, 'region-response.html');
  const [regionResponseDetails, regionBoardDetails] = await Promise.all([
    pathDetails(regionResponsePath), pathDetails(regionBoardPath),
  ]);
  if (Boolean(regionResponseDetails) !== Boolean(regionBoardDetails)) {
    throw new TypeError('Visual Lab region response JSON and board must be present together');
  }
  if (requireRegionResponse && !regionResponseDetails) {
    throw new TypeError('Visual Lab batch package is missing current region response evidence');
  }
  let regionResponse = null;
  let regionMeasurementsPromise = null;
  const readRegionMeasurements = () => {
    regionMeasurementsPromise ??= createVisualLabCurrentRegionMeasurements(
      canonical,
      async (candidate, variant) => readStableRegularFile(
        path.join(batchRoot, canonical.candidates.find((entry) => (
          entry.candidate === candidate
        )).artifacts[variant]),
        `Visual Lab ${candidate} ${variant} region capture`,
      ),
    );
    return regionMeasurementsPromise;
  };
  if (regionResponseDetails) {
    if (!canonical.complete) {
      throw new TypeError('Incomplete Visual Lab batches cannot publish region response evidence');
    }
    const [publishedSource, boardSource] = await Promise.all([
      readStableRegularFile(regionResponsePath, 'Visual Lab region response', 'utf8', EXPERIMENT_EVIDENCE_MAX_BYTES),
      readStableRegularFile(regionBoardPath, 'Visual Lab region response board', 'utf8', EXPERIMENT_EVIDENCE_MAX_BYTES),
    ]);
    const published = parsePortableJson(publishedSource, 'Visual Lab region response');
    regionResponse = (await readRegionMeasurements())?.response ?? null;
    if (regionResponse === null || !isDeepStrictEqual(published, regionResponse)) {
      throw new TypeError('Visual Lab region response does not match current captures');
    }
    if (boardSource !== renderVisualLabRegionResponseBoard(regionResponse)) {
      throw new TypeError('Visual Lab region response board does not match current evidence');
    }
  }
  const regionAppearancePath = path.join(batchRoot, 'region-appearance.json');
  const regionAppearanceBoardPath = path.join(batchRoot, 'region-appearance.html');
  const [regionAppearanceDetails, regionAppearanceBoardDetails] = await Promise.all([
    pathDetails(regionAppearancePath), pathDetails(regionAppearanceBoardPath),
  ]);
  if (Boolean(regionAppearanceDetails) !== Boolean(regionAppearanceBoardDetails)) {
    throw new TypeError('Visual Lab region appearance JSON and board must be present together');
  }
  if (requireRegionAppearance && !regionAppearanceDetails) {
    throw new TypeError('Visual Lab batch package is missing current region appearance evidence');
  }
  let regionAppearance = null;
  if (regionAppearanceDetails) {
    if (!canonical.complete) {
      throw new TypeError('Incomplete Visual Lab batches cannot publish region appearance evidence');
    }
    const [publishedSource, boardSource] = await Promise.all([
      readStableRegularFile(regionAppearancePath, 'Visual Lab region appearance', 'utf8', EXPERIMENT_EVIDENCE_MAX_BYTES),
      readStableRegularFile(regionAppearanceBoardPath, 'Visual Lab region appearance board', 'utf8', EXPERIMENT_EVIDENCE_MAX_BYTES),
    ]);
    const published = parsePortableJson(publishedSource, 'Visual Lab region appearance');
    regionAppearance = (await readRegionMeasurements())?.appearance ?? null;
    if (regionAppearance === null || !isDeepStrictEqual(published, regionAppearance)) {
      throw new TypeError('Visual Lab region appearance does not match current captures');
    }
    if (boardSource !== renderVisualLabRegionAppearanceBoard(regionAppearance)) {
      throw new TypeError('Visual Lab region appearance board does not match current evidence');
    }
  }
  if (requireCaptureGeometry) {
    const missing = entries.filter((entry) => (
      entry.status === 'passed' && entry.captureDiagnostic.captureGeometry === undefined
    ));
    if (missing.length > 0) {
      throw new TypeError(
        `Visual Lab batch package is missing canonical captureGeometry proof for ${
          missing.map(({ candidate }) => candidate).join(', ')
        }`,
      );
    }
  }

  const recipeSetPath = path.join(batchRoot, 'recipe-set.json');
  const recipeSetDetails = await pathDetails(recipeSetPath);
  let recipeSet;
  if (recipeSetDetails) recipeSet = await readVisualLabRecipeSet(recipeSetPath);
  if (requireRecipeSet && !recipeSet) {
    throw new TypeError('Visual Lab batch package is missing recipe-set.json');
  }
  if (recipeSet) {
    const captured = canonical.candidates.map(({ candidate }) => {
      const recipe = resolveVisualLabCaptureRecipe(candidate);
      return { name: candidate, ...visualLabRequestForRecipe(recipe) };
    });
    if (!isDeepStrictEqual(recipeSet.recipes, captured)) {
      throw new TypeError('Visual Lab batch package does not match its recipe-set request');
    }
  }

  const browserHostPlan = await readOptionalBrowserHostPlan(
    path.join(batchRoot, BROWSER_HOST_PLAN_FILE_NAME),
  );
  if (requireBrowserHostPlan && browserHostPlan === null) {
    throw new TypeError('Visual Lab batch package is missing browser-host-plan.json');
  }
  if (browserHostPlan !== null) {
    assertBrowserHostPlanMatchesEntries(browserHostPlan, recipes, entries, {
      requireTimingProof: true,
    });
    assertBrowserHostPlanCaptureIdentity(
      browserHostPlan,
      recipes,
      entries,
      recipeSet ?? null,
      batchRoot,
      { required: requireBrowserHostPlan },
    );
  }

  const executionTuningPlan = await readOptionalExecutionTuningPlan(
    path.join(batchRoot, EXECUTION_TUNING_PLAN_FILE_NAME),
  );
  if (requireExecutionTuningPlan && executionTuningPlan === null) {
    throw new TypeError('Visual Lab batch package is missing execution-tuning-plan.json');
  }
  if (executionTuningPlan !== null) {
    assertExecutionTuningPlanMatchesEntries(executionTuningPlan, recipes, entries, {
      requireProof: true,
    });
    assertExecutionTuningPlanCaptureIdentity(
      executionTuningPlan,
      recipes,
      entries,
      recipeSet ?? null,
      batchRoot,
      { required: requireExecutionTuningPlan },
    );
  }

  const originAttestation = await readOptionalOriginAttestation(
    path.join(batchRoot, ORIGIN_ATTESTATION_FILE_NAME),
  );
  assertOriginAttestationCaptureIdentity(originAttestation, entries, {
    required: requireOriginAttestation,
  });

  let sourceRecipeSet;
  if (options.recipeSetSourcePath !== undefined) {
    sourceRecipeSet = await readVisualLabRecipeSet(options.recipeSetSourcePath);
    if (!recipeSet || !isDeepStrictEqual(sourceRecipeSet, recipeSet)) {
      throw new TypeError('Published Visual Lab recipe set differs from its source');
    }
  }

  return deepFreeze({
    batchRoot,
    index: canonical,
    recipeSet: recipeSet ?? null,
    browserHostPlan,
    executionTuningPlan,
    originAttestation,
    experimentResponse,
    responsePath: responseDetails ? responsePath : null,
    experimentBoardPath: boardDetails ? experimentBoardPath : null,
    regionResponse,
    regionResponsePath: regionResponseDetails ? regionResponsePath : null,
    regionResponseBoardPath: regionBoardDetails ? regionBoardPath : null,
    regionAppearance,
    regionAppearancePath: regionAppearanceDetails ? regionAppearancePath : null,
    regionAppearanceBoardPath: regionAppearanceBoardDetails ? regionAppearanceBoardPath : null,
    captureDiagnostics: entries.flatMap((entry) => (
      entry.status === 'passed' ? [entry.captureDiagnostic] : []
    )),
    timings: summarizeEntryTimings(entries),
    captureSubphases: summarizeEntryCaptureSubphases(entries),
  });
}

const writeAtomic = async (file, contents) => {
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  let handle;
  try {
    handle = await open(temporary, 'wx', 0o600);
    await handle.writeFile(contents);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporary, file);
  } catch (error) {
    await handle?.close().catch(() => {});
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
};

const writeFailure = async (candidateDirectory, code, error) => {
  await mkdir(candidateDirectory, { recursive: true });
  await writeAtomic(
    path.join(candidateDirectory, 'failure.log'),
    `${code}\n${displayError(error)}\n`,
  );
};

const abortError = (signal) => (
  signal?.reason instanceof Error ? signal.reason : new Error('Visual Lab batch interrupted')
);

const validCandidateTimeout = (value) => (
  Number.isSafeInteger(value) && value > 0 && value <= MAX_CANDIDATE_TIMEOUT_MS
);

const parseLifecycleRecord = (source, lifecyclePath, expectedOwner) => {
  let record;
  try { record = JSON.parse(source); }
  catch (error) {
    throw new Error(`Invalid Chrome lifecycle JSON at ${lifecyclePath}`, { cause: error });
  }
  const keys = record !== null && typeof record === 'object' && !Array.isArray(record)
    ? Reflect.ownKeys(record) : [];
  if (keys.length !== 6
    || !['schema', 'pid', 'profile', 'createdAtMs', 'startToken', 'owner']
      .every((key) => keys.includes(key))
    || record.schema !== LIFECYCLE_SCHEMA
    || !Number.isSafeInteger(record.pid) || record.pid <= 1
    || typeof record.profile !== 'string' || !path.isAbsolute(record.profile)
    || !Number.isSafeInteger(record.createdAtMs) || record.createdAtMs <= 0
    || !(record.startToken === null
      || (typeof record.startToken === 'string' && /^\d+$/.test(record.startToken)))
    || record.owner !== expectedOwner) {
    throw new Error(`Invalid Chrome lifecycle record at ${lifecyclePath}`);
  }
  const profile = path.resolve(record.profile);
  const relativeProfile = path.relative(path.resolve(tmpdir()), profile);
  if (!relativeProfile.startsWith('anifor-visual-lab-chrome-')
    || relativeProfile.includes(path.sep)
    || relativeProfile === '..' || path.isAbsolute(relativeProfile)) {
    throw new Error(`Chrome lifecycle profile is outside the Visual Lab temp namespace`);
  }
  return {
    pid: record.pid,
    profile,
    createdAtMs: record.createdAtMs,
    startToken: record.startToken,
    owner: record.owner,
  };
};

const readLinuxProcessIdentity = async (pid) => {
  if (process.platform !== 'linux') return undefined;
  let statSource;
  let commandSource;
  try {
    [statSource, commandSource] = await Promise.all([
      readFile(`/proc/${pid}/stat`, 'utf8'),
      readFile(`/proc/${pid}/cmdline`),
    ]);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw new Error(`Cannot inspect recorded Chrome process ${pid}: ${error.message}`, {
      cause: error,
    });
  }
  const commandEnd = statSource.lastIndexOf(')');
  const fields = commandEnd >= 0
    ? statSource.slice(commandEnd + 1).trim().split(/\s+/) : [];
  const startToken = fields[19];
  if (!startToken || !/^\d+$/.test(startToken)) {
    throw new Error(`Cannot identify recorded Chrome process ${pid} from /proc`);
  }
  return {
    startToken,
    args: commandSource.toString('utf8').split('\0').filter(Boolean),
  };
};

/** Repairs an audit child that exited before its detached Chrome cleanup completed. */
const recoverRecordedChrome = async (lifecyclePath, candidateTimeoutMs, expectedOwner) => {
  let source;
  try { source = await readFile(lifecyclePath, 'utf8'); }
  catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw new Error(`Cannot read Chrome lifecycle handoff ${lifecyclePath}: ${error.message}`, {
      cause: error,
    });
  }
  const record = parseLifecycleRecord(source, lifecyclePath, expectedOwner);
  const recoveryWindowMs = Math.max(
    MIN_LIFECYCLE_RECOVERY_WINDOW_MS,
    candidateTimeoutMs + CANDIDATE_TERMINATION_GRACE_MS
      + CANDIDATE_KILL_SETTLEMENT_MS + LIFECYCLE_CLOCK_SKEW_MS,
  );
  const ageMs = Date.now() - record.createdAtMs;
  if (ageMs < -LIFECYCLE_CLOCK_SKEW_MS || ageMs > recoveryWindowMs) {
    throw new Error(
      `Chrome lifecycle handoff at ${lifecyclePath} is outside its safe recovery window`,
    );
  }

  const groupAlive = process.platform === 'win32'
    ? processExists(record.pid) : isDetachedProcessGroupAlive(record.pid);
  if (groupAlive) {
    if (process.platform !== 'linux') {
      throw new Error(
        `Cannot safely verify live Chrome process group ${record.pid} on ${process.platform};`
          + ' lifecycle state was retained for manual cleanup',
      );
    }
    const identity = await readLinuxProcessIdentity(record.pid);
    if (identity !== null) {
      if (identity.startToken !== record.startToken
        || !identity.args.includes(`--user-data-dir=${record.profile}`)) {
        throw new Error(
          `Chrome lifecycle identity no longer matches live process group ${record.pid}`,
        );
      }
    }
  }
  const terminated = groupAlive
    ? await terminateDetachedProcessGroup(record.pid) : true;
  if (!terminated) {
    throw new Error(`Chrome process group ${record.pid} survived batch recovery`);
  }
  await rm(record.profile, { recursive: true, force: true });
  await rm(lifecyclePath, { force: true });
  return true;
};

const defaultRunCandidate = async ({
  command, args, cwd, stdoutPath, stderrPath, signal, timeoutMs,
}) => {
  if (signal?.aborted) throw abortError(signal);
  const stdout = await open(stdoutPath, 'a');
  let stderr;
  let abortListener;
  try {
    stderr = await open(stderrPath, 'a');
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', stdout.fd, stderr.fd],
    });
    return await new Promise((resolve, reject) => {
      let settled = false;
      let terminationRequested = false;
      let timedOut = false;
      let timeoutTimer;
      let escalationTimer;
      let settlementTimer;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutTimer);
        clearTimeout(escalationTimer);
        clearTimeout(settlementTimer);
        callback(value);
      };
      const requestTermination = (fromTimeout) => {
        timedOut ||= fromTimeout;
        if (terminationRequested || settled) return;
        terminationRequested = true;
        clearTimeout(timeoutTimer);
        child.kill('SIGTERM');
        escalationTimer = setTimeout(() => {
          if (settled) return;
          child.kill('SIGKILL');
          settlementTimer = setTimeout(() => {
            // A platform-level failed kill must not retain the batch event loop.
            // The parent integrates recorded descendant cleanup independently.
            child.unref();
            finish(resolve, {
              code: null,
              signal: 'SIGKILL',
              timedOut,
              killUnsettled: true,
            });
          }, CANDIDATE_KILL_SETTLEMENT_MS);
        }, CANDIDATE_TERMINATION_GRACE_MS);
      };
      child.once('error', (error) => finish(reject, error));
      child.once('exit', (code, terminationSignal) => finish(resolve, {
        code,
        signal: terminationSignal,
        timedOut,
      }));
      timeoutTimer = setTimeout(() => requestTermination(true), timeoutMs);
      if (signal) {
        abortListener = () => requestTermination(false);
        signal.addEventListener('abort', abortListener, { once: true });
        if (signal.aborted) abortListener();
      }
    });
  } finally {
    if (signal && abortListener) signal.removeEventListener('abort', abortListener);
    await Promise.all([stdout.close(), stderr?.close()]);
  }
};

/**
 * Runs generic named captures sequentially, then produces a deterministic index
 * and static contact sheet even when individual candidates fail.
 */
export async function runVisualLabBatch(options = {}, dependencies = {}) {
  const defaultOutputDirectory = path.join(
    await realpath(tmpdir()), 'anifor-visual-lab-batch',
  );
  const requestedOutputDirectory = path.resolve(
    options.outputDir ?? defaultOutputDirectory,
  );
  if (options.recipeSetSourcePath !== undefined) {
    if (typeof options.recipeSetSourcePath !== 'string'
      || options.recipeSetSourcePath.length === 0) {
      throw new TypeError('Visual Lab recipe-set source path must be a non-empty string');
    }
    const sourcePath = path.resolve(options.recipeSetSourcePath);
    const relativeSource = path.relative(requestedOutputDirectory, sourcePath);
    if (relativeSource === '' || (!relativeSource.startsWith(`..${path.sep}`)
      && relativeSource !== '..' && !path.isAbsolute(relativeSource))) {
      throw new Error('Visual Lab recipe-set source must be outside the batch output directory');
    }
  }
  const indexOnly = options.indexOnly === true;
  const planOnly = options.planOnly === true;
  if (indexOnly && planOnly) {
    throw new Error('Visual Lab batch indexOnly and planOnly are mutually exclusive');
  }
  if (options.bundle !== undefined && options.baseUrl !== undefined) {
    throw new Error('Visual Lab batch bundle and baseUrl are mutually exclusive');
  }
  if (options.bundle !== undefined
    && (typeof options.bundle !== 'string' || options.bundle.length === 0)) {
    throw new TypeError('Visual Lab batch bundle must be a non-empty string');
  }
  const remoteBaseUrl = options.baseUrl === undefined
    ? null : normalizeVisualLabBatchBaseUrl(options.baseUrl);
  if (remoteBaseUrl === null && options.expectedRevision !== undefined) {
    throw new Error('Visual Lab batch expectedRevision is valid only with baseUrl');
  }
  if (remoteBaseUrl !== null && options.expectedRevision === undefined) {
    throw new Error('Visual Lab batch remote capture requires expectedRevision');
  }
  const expectedRevision = remoteBaseUrl === null
    ? undefined : normalizeLivePagesRevision(options.expectedRevision);
  // Preserve the historical file URL, including its execution-plan identity,
  // whenever no remote source was selected.
  const bundle = remoteBaseUrl === null
    ? path.resolve(options.bundle ?? path.join(REPOSITORY_ROOT, 'dist/index.html'))
    : null;
  const selectedBaseUrl = remoteBaseUrl ?? pathToFileURL(bundle);
  const gpu = options.gpu ?? 'auto';
  const browserHost = options.browserHost ?? 'fresh';
  const captureProof = options.captureProof ?? 'stable-snapshots';
  const candidateTimeoutMs = options.candidateTimeoutMs
    ?? VISUAL_LAB_DEFAULT_CANDIDATE_TIMEOUT_MS;
  if (gpu !== 'auto' && gpu !== 'swiftshader') {
    throw new Error('Visual Lab batch gpu must be auto or swiftshader');
  }
  if (browserHost !== 'fresh' && browserHost !== 'shared') {
    throw new Error('Visual Lab batch browserHost must be fresh or shared');
  }
  if (!VISUAL_LAB_CAPTURE_PROOF_MODES.includes(captureProof)) {
    throw new Error(
      'Visual Lab batch captureProof must be stable-snapshots, completed-frame-receipt, readiness-completed-frame-receipt, selection-owned-frame-receipt, fixture-activation-generation, fixture-activation-work-generation, or fixture-activation-render-field-generation',
    );
  }
  if (browserHost === 'shared' && process.platform !== 'linux') {
    throw new Error('Shared Visual Lab browser hosts are currently supported on Linux only');
  }
  if (options.chrome !== undefined
    && (typeof options.chrome !== 'string' || options.chrome.length === 0)) {
    throw new Error('Visual Lab batch chrome path must be a non-empty string');
  }
  if (!validCandidateTimeout(candidateTimeoutMs)) {
    throw new Error(
      `Visual Lab batch candidate timeout must be a positive integer no greater than ${
        MAX_CANDIDATE_TIMEOUT_MS
      } milliseconds`,
    );
  }
  // Compile every executable request before the first output-directory lookup,
  // lock, publication, child process, or Chrome launch. The real batch and
  // --plan-only therefore exercise one identical fixture/driver plan.
  const executionPlan = createVisualLabExecutionPlan({
    recipeSet: options.recipeSet,
    candidates: options.candidates,
    baseUrl: selectedBaseUrl,
    outputDir: requestedOutputDirectory,
    gpu,
    candidateTimeoutMs,
    chrome: options.chrome,
  });
  const { recipeSet } = executionPlan;
  const browserHostPlan = createVisualLabBrowserHostPlan(executionPlan, browserHost);
  const captureDriverOrder = [...new Set(
    executionPlan.entries.map(({ captureDriver }) => captureDriver.name),
  )];
  const executionTuningPlan = createExecutionTuningPlan(
    executionPlan, captureDriverOrder, captureProof,
  );
  const browserHostEntryByCandidate = new Map(browserHostPlan.entries.map((entry) => [
    entry.candidate,
    resolveVisualLabBrowserHostPlanEntry(
      browserHostPlan,
      entry.id,
      executionPlan.entries[entry.sequence].inspection.id,
    ),
  ]));
  const executionTuningEntryByCandidate = new Map(
    executionTuningPlan.entries.map((entry) => [
      entry.candidate,
      resolveExecutionTuningPlanEntry(
        executionTuningPlan,
        entry.id,
        executionPlan.entries[entry.sequence].inspection.id,
        executionPlan,
      ),
    ]),
  );
  const recipes = executionPlan.entries.map(({ recipe }) => recipe);
  const executionPlanByCandidate = new Map(
    executionPlan.entries.map((entry) => [entry.candidate, entry]),
  );
  if (bundle !== null && !indexOnly && !planOnly) {
    let details;
    try { details = await stat(bundle); } catch { /* handled below */ }
    if (!details?.isFile()) throw new Error(`Cannot read production bundle ${bundle}`);
  }

  if (planOnly) {
    await inspectPlannedOutputPaths(requestedOutputDirectory, executionPlan);
    return Object.freeze({
      ok: true,
      exitCode: 0,
      planOnly: true,
      plan: executionPlan.inspection,
      browserHostPlan,
      executionTuningPlan,
      runtime: executionPlan.runtime,
      recipeSet,
    });
  }

  const verifyDeployment = dependencies.verifyDeployment ?? verifyLivePagesDeployment;
  const verifyRevision = dependencies.verifyRevision ?? verifyLivePagesRevision;
  const initialOriginPreflight = remoteBaseUrl === null || indexOnly
    ? null : await verifyDeployment(selectedBaseUrl.href, expectedRevision);

  const outputDirectory = await ensureRealDirectory(
    requestedOutputDirectory, 'Visual Lab output directory',
  );
  const releaseBatchLock = await acquireBatchLock(outputDirectory);
  const executeLockedBatch = async () => {
  const candidateRoot = path.join(outputDirectory, 'candidates');
  const indexPath = path.join(outputDirectory, 'index.json');
  const contactSheetPath = path.join(outputDirectory, 'index.html');
  const responsePath = path.join(outputDirectory, 'experiment-response.json');
  const experimentBoardPath = path.join(outputDirectory, 'experiment-board.html');
  const regionResponsePath = path.join(outputDirectory, 'region-response.json');
  const regionResponseBoardPath = path.join(outputDirectory, 'region-response.html');
  const regionAppearancePath = path.join(outputDirectory, 'region-appearance.json');
  const regionAppearanceBoardPath = path.join(outputDirectory, 'region-appearance.html');
  const recipeSetPath = path.join(outputDirectory, 'recipe-set.json');
  const browserHostPlanPath = path.join(outputDirectory, BROWSER_HOST_PLAN_FILE_NAME);
  const executionTuningPlanPath = path.join(
    outputDirectory, EXECUTION_TUNING_PLAN_FILE_NAME,
  );
  const originAttestationPath = path.join(outputDirectory, ORIGIN_ATTESTATION_FILE_NAME);
  const publishedBrowserHostPlan = indexOnly
    ? await readOptionalBrowserHostPlan(browserHostPlanPath)
    : browserHostPlan;
  const publishedExecutionTuningPlan = indexOnly
    ? await readOptionalExecutionTuningPlan(executionTuningPlanPath)
    : executionTuningPlan;
  let publishedOriginAttestation = indexOnly
    ? await readOptionalOriginAttestation(originAttestationPath)
    : null;
  if (publishedBrowserHostPlan !== null) {
    assertBrowserHostPlanMatchesEntries(publishedBrowserHostPlan, recipes);
  }
  if (publishedExecutionTuningPlan !== null) {
    assertExecutionTuningPlanMatchesEntries(publishedExecutionTuningPlan, recipes);
  }
  const sharedLifecyclePath = path.join(outputDirectory, SHARED_CHROME_LIFECYCLE_FILE_NAME);
  const sharedLifecycleOwner = lifecycleOwnerFor(outputDirectory, 'shared-browser-host');
  const sharedRecoveryTimeoutMs = Math.min(
    MAX_CANDIDATE_TIMEOUT_MS,
    candidateTimeoutMs * Math.max(1, recipes.length),
  );
  await recoverRecordedChrome(
    sharedLifecyclePath, sharedRecoveryTimeoutMs, sharedLifecycleOwner,
  );
  const resolvedCandidateRoot = await ensureCandidateRoot(outputDirectory, candidateRoot);
  const candidateDirectories = new Map();
  const lifecycleOwners = new Map();
  for (const recipe of recipes) {
    const candidateExecutionPlan = executionPlanByCandidate.get(recipe.name);
    const candidateDirectory = candidateExecutionPlan.runtime.artifactRoot;
    const lifecycleOwner = lifecycleOwnerFor(outputDirectory, recipe.name);
    await ensureCandidateDirectory(resolvedCandidateRoot, candidateDirectory, recipe.name);
    // A prior supervisor may have died after its audit published the exact
    // Chrome handoff. Recover that identity before deleting or replacing any
    // candidate-owned file, and before invalidating a previously useful index.
    await recoverRecordedChrome(
      candidateExecutionPlan.runtime.lifecycleFile, candidateTimeoutMs, lifecycleOwner,
    );
    candidateDirectories.set(recipe.name, candidateDirectory);
    lifecycleOwners.set(recipe.name, lifecycleOwner);
  }
  // The first check fails before even creating an output tree. Repeat the full
  // closure check while holding the batch lock, after stale-process recovery,
  // so a competing batch cannot leave this capture queued behind a preflight
  // for a deployment that is no longer live.
  const originPreflight = initialOriginPreflight === null
    ? null : await verifyDeployment(selectedBaseUrl.href, expectedRevision);
  // A prior successful sheet must never survive a rerun that is interrupted
  // before new evidence can be aggregated. Remove only root files owned by
  // this tool; candidate logs remain available for diagnosis.
  await Promise.all([
    indexPath, contactSheetPath, responsePath, experimentBoardPath,
    regionResponsePath, regionResponseBoardPath, recipeSetPath,
    `${indexPath}.tmp`, `${contactSheetPath}.tmp`, `${responsePath}.tmp`,
    `${experimentBoardPath}.tmp`, `${regionResponsePath}.tmp`,
    `${regionResponseBoardPath}.tmp`, `${recipeSetPath}.tmp`,
    ...(!indexOnly ? [
      browserHostPlanPath, `${browserHostPlanPath}.tmp`,
      executionTuningPlanPath, `${executionTuningPlanPath}.tmp`,
      originAttestationPath, `${originAttestationPath}.tmp`,
    ] : []),
  ].map((file) => rm(file, { force: true })));
  const runCandidate = dependencies.runCandidate ?? defaultRunCandidate;
  const publishFile = dependencies.publishFile ?? writeAtomic;
  const auditScript = path.resolve(dependencies.auditScript ?? DEFAULT_AUDIT_SCRIPT);
  const command = dependencies.command ?? process.execPath;
  const cwd = path.resolve(dependencies.cwd ?? REPOSITORY_ROOT);
  const entriesByCandidate = new Map();
  const startSharedHost = dependencies.startSharedHost ?? startVisualLabChromeHost;
  let sharedHost;
  let sharedHostReady;
  let sharedHostOrdinal = 0;
  let sharedHostBlocker;
  let pendingSharedReports = [];
  const browserHostRuntime = {
    requestedMode: publishedBrowserHostPlan?.requestedMode ?? null,
    hostsStarted: 0,
    hostRestarts: 0,
    launchMs: 0,
    teardownMs: 0,
    assignments: [],
    recycleReasons: [],
  };

  const teardownSharedHost = async (reason) => {
    if (!sharedHost) return;
    const ownedHost = sharedHost;
    sharedHost = undefined;
    sharedHostReady = undefined;
    const started = performance.now();
    let teardownError;
    try { await ownedHost.teardown(); }
    catch (error) { teardownError = error; }
    browserHostRuntime.teardownMs += performance.now() - started;
    browserHostRuntime.recycleReasons.push(reason);
    if (!teardownError) return;
    let recovered = false;
    let recoveryError;
    try {
      recovered = await recoverRecordedChrome(
        sharedLifecyclePath, sharedRecoveryTimeoutMs, sharedLifecycleOwner,
      );
    } catch (error) { recoveryError = error; }
    if (!recovered && !recoveryError) {
      recoveryError = new Error(
        'Shared Chrome teardown failed without a recoverable lifecycle handoff',
      );
    }
    if (recoveryError) {
      sharedHostBlocker = new AggregateError(
        [teardownError, recoveryError],
        'Shared Chrome teardown and lifecycle recovery both failed',
      );
      throw sharedHostBlocker;
    }
    throw teardownError;
  };

  const ensureSharedHost = async () => {
    if (sharedHostBlocker) throw sharedHostBlocker;
    if (sharedHost) {
      await sharedHost.assertHealthy();
      return sharedHostReady;
    }
    if (process.platform !== 'linux') {
      throw new Error('Shared Visual Lab browser hosts are currently supported on Linux only');
    }
    const started = performance.now();
    try {
      sharedHost = await startSharedHost({
        chromePath: options.chrome,
        gpuMode: gpu,
        initialUrl: new URL('about:blank'),
        allowFileAccess: selectedBaseUrl.protocol === 'file:',
        lifecycleFile: sharedLifecyclePath,
        lifecycleOwner: sharedLifecycleOwner,
      });
      sharedHostReady = await sharedHost.ready();
      await sharedHost.assertHealthy();
      if (typeof sharedHostReady?.browserWebSocketDebuggerUrl !== 'string') {
        throw new Error('Shared Chrome host did not publish a browser WebSocket endpoint');
      }
      sharedHostOrdinal += 1;
      browserHostRuntime.hostsStarted += 1;
      if (sharedHostOrdinal > 1) browserHostRuntime.hostRestarts += 1;
      browserHostRuntime.launchMs += performance.now() - started;
      return sharedHostReady;
    } catch (error) {
      browserHostRuntime.launchMs += performance.now() - started;
      let cleanupError;
      try { await teardownSharedHost('launch-fault'); }
      catch (nested) { cleanupError = nested; }
      if (cleanupError) {
        throw new AggregateError(
          [error, cleanupError], 'Shared Chrome launch and cleanup both failed',
        );
      }
      throw error;
    }
  };

  const promoteSharedReports = async () => {
    const promoted = [];
    for (const pending of pendingSharedReports) {
      const deferredPath = path.join(pending.candidateDirectory, DEFERRED_REPORT_FILE_NAME);
      const reportPath = pending.executionPlan.runtime.artifacts.report;
      await rm(reportPath, { force: true });
      await rename(deferredPath, reportPath);
      await rm(path.join(pending.candidateDirectory, 'failure.log'), { force: true });
      promoted.push(await readCandidateReport(
        pending.candidateDirectory,
        pending.recipe,
        {
          executionPlan: pending.executionPlan,
          executionTuningPlan,
          executionTuningEntry: pending.executionTuningEntry,
        },
      ));
    }
    for (const entry of promoted) entriesByCandidate.set(entry.candidate, entry);
    pendingSharedReports = [];
  };

  const finalizeSharedGeneration = async (reason) => {
    if (sharedHostBlocker) throw sharedHostBlocker;
    if (!sharedHost && pendingSharedReports.length === 0) return;
    await teardownSharedHost(reason);
    await promoteSharedReports();
  };

  // This sidecar is a separate schema family; batch/v1 stays byte-compatible.
  // Publishing it before any completion marker makes the selected cohort
  // independently inspectable even when capture is interrupted.
  await publishFile(recipeSetPath, `${JSON.stringify(recipeSet, null, 2)}\n`);
  if (!indexOnly) {
    await Promise.all([
      publishFile(browserHostPlanPath, `${JSON.stringify(browserHostPlan, null, 2)}\n`),
      publishFile(
        executionTuningPlanPath, `${JSON.stringify(executionTuningPlan, null, 2)}\n`,
      ),
    ]);
  }
  const publishedRecipeSet = await readVisualLabRecipeSet(recipeSetPath);
  if (!isDeepStrictEqual(publishedRecipeSet, recipeSet)) {
    throw new Error('Published Visual Lab recipe set does not match the validated request');
  }

  try {
    for (const recipe of recipes) {
      if (options.signal?.aborted) throw abortError(options.signal);
      const candidateExecutionPlan = executionPlanByCandidate.get(recipe.name);
      const browserHostEntry = browserHostEntryByCandidate.get(recipe.name);
      const executionTuningEntry = executionTuningEntryByCandidate.get(recipe.name);
      const candidateDirectory = candidateDirectories.get(recipe.name);
      const lifecycleOwner = lifecycleOwners.get(recipe.name);
      await ensureCandidateDirectory(resolvedCandidateRoot, candidateDirectory, recipe.name);

      if (indexOnly) {
        try {
          entriesByCandidate.set(recipe.name, await readCandidateReport(
            candidateDirectory, recipe, { executionPlan: candidateExecutionPlan },
          ));
        } catch (error) {
          const code = error instanceof CandidateArtifactError ? error.code : 'report-invalid';
          if (!(error instanceof CandidateArtifactError && error.preserveDiagnostic)) {
            await writeFailure(candidateDirectory, code, error);
          }
          entriesByCandidate.set(
            recipe.name, { candidate: recipe.name, status: 'failed', failure: code },
          );
        }
        continue;
      }

      if (browserHostEntry.effectiveMode === 'fresh') {
        await finalizeSharedGeneration('fresh-only-entry');
      }
      // Clear only files owned by this tool. An explicit output directory may
      // contain a user's notes or comparison artifacts; never remove its tree.
      await Promise.all([
        ...VISUAL_LAB_CANDIDATE_GENERATED_FILES,
        DEFERRED_REPORT_FILE_NAME,
      ].map((file) => (
        rm(path.join(candidateDirectory, file), { force: true })
      )));
      const stdoutPath = candidateExecutionPlan.runtime.artifacts.stdout;
      const stderrPath = candidateExecutionPlan.runtime.artifacts.stderr;
      const lifecyclePath = candidateExecutionPlan.runtime.lifecycleFile;
      await Promise.all([writeFile(stdoutPath, ''), writeFile(stderrPath, '')]);
      const args = [
        auditScript,
        bundle === null ? `--base-url=${selectedBaseUrl.href}` : `--bundle=${bundle}`,
        `--candidate=${recipe.name}`,
        `--output-dir=${candidateDirectory}`,
        `--gpu=${gpu}`,
        `--execution-plan-id=${candidateExecutionPlan.inspection.id}`,
        `--execution-tuning-plan=${executionTuningPlanPath}`,
        `--execution-tuning-entry-id=${executionTuningEntry.id}`,
      ];
      let sharedReady;
      let executionError;
      if (browserHostEntry.effectiveMode === 'shared') {
        try {
          sharedReady = await ensureSharedHost();
          browserHostRuntime.assignments.push(Object.freeze({
            candidate: recipe.name,
            host: sharedHostOrdinal,
          }));
          args.push(
            '--browser-host=shared',
            `--browser-websocket=${sharedReady.browserWebSocketDebuggerUrl}`,
            `--browser-host-plan=${browserHostPlanPath}`,
            `--browser-host-entry-id=${browserHostEntry.id}`,
            '--defer-report=1',
          );
        } catch (error) { executionError = error; }
      } else {
        args.push(
          '--browser-host=fresh',
          `--lifecycle-file=${lifecyclePath}`,
          `--lifecycle-owner=${lifecycleOwner}`,
        );
        if (options.chrome) args.push(`--chrome=${options.chrome}`);
      }

      let outcome;
      if (!executionError) {
        try {
          outcome = await runCandidate({
            command, args, cwd, recipe, candidateDirectory,
            executionPlan: candidateExecutionPlan,
            browserHostPlanEntry: browserHostEntry,
            executionTuningPlan,
            executionTuningPlanEntry: executionTuningEntry,
            stdoutPath, stderrPath, lifecyclePath, signal: options.signal,
            timeoutMs: candidateTimeoutMs,
          });
        } catch (error) {
          executionError = error;
        }
      }
      let recoveredChrome = false;
      if (browserHostEntry.effectiveMode === 'fresh') {
        try {
          recoveredChrome = await recoverRecordedChrome(
            lifecyclePath, candidateTimeoutMs, lifecycleOwner,
          );
        }
        catch (error) {
          executionError = executionError
            ? new AggregateError([executionError, error], 'Audit child and Chrome recovery failed')
            : error;
        }
      }
      if (options.signal?.aborted) {
        const interruption = abortError(options.signal);
        throw executionError
          ? new AggregateError([interruption, executionError], interruption.message)
          : interruption;
      }
      if (browserHostEntry.effectiveMode === 'fresh'
        && recoveredChrome && !executionError
        && outcome?.killUnsettled !== true
        && outcome?.timedOut !== true && outcome?.code === 0) {
        executionError = new Error(
          'Audit child exited successfully but left detached Chrome cleanup for its supervisor',
        );
      }
      if (executionError) {
        await rm(path.join(candidateDirectory, DEFERRED_REPORT_FILE_NAME), { force: true });
        if (browserHostEntry.effectiveMode === 'shared') {
          if (sharedHostBlocker) throw executionError;
          await finalizeSharedGeneration('candidate-execution-fault');
        }
        await writeFailure(candidateDirectory, 'capture-failed', executionError);
        entriesByCandidate.set(recipe.name, {
          candidate: recipe.name, status: 'failed', failure: 'capture-failed',
        });
        continue;
      }
      if (options.signal?.aborted) throw abortError(options.signal);
      if (outcome?.killUnsettled === true
        || outcome?.timedOut === true || outcome?.code !== 0) {
        const outcomeMessage = outcome?.killUnsettled === true
          ? `Audit child did not settle within ${CANDIDATE_KILL_SETTLEMENT_MS} ms after SIGKILL`
          : outcome?.timedOut === true
            ? `Audit child timed out after ${candidateTimeoutMs} ms`
            : `Audit child exited with code ${String(outcome?.code)}`
              + (outcome?.signal ? ` after ${outcome.signal}` : '');
        const childDiagnostic = await readStructuredChildFailureDiagnostic(
          stderrPath, `${recipe.name} child stderr`,
        );
        const detail = new Error(outcomeMessage + (childDiagnostic === undefined
          ? '' : `\nAudit diagnostic:\n${childDiagnostic}`));
        await rm(path.join(candidateDirectory, DEFERRED_REPORT_FILE_NAME), { force: true });
        if (browserHostEntry.effectiveMode === 'shared') {
          await finalizeSharedGeneration('candidate-process-fault');
        }
        await writeFailure(candidateDirectory, 'capture-failed', detail);
        entriesByCandidate.set(recipe.name, {
          candidate: recipe.name, status: 'failed', failure: 'capture-failed',
        });
        continue;
      }

      if (browserHostEntry.effectiveMode === 'shared') {
        try {
          await readCandidateReport(candidateDirectory, recipe, {
            executionPlan: candidateExecutionPlan,
            executionTuningPlan,
            executionTuningEntry,
            reportFileName: DEFERRED_REPORT_FILE_NAME,
            skipFailureTombstone: true,
          });
          await sharedHost.assertHealthy();
          pendingSharedReports.push({
            recipe,
            candidateDirectory,
            executionPlan: candidateExecutionPlan,
            executionTuningEntry,
          });
        } catch (error) {
          await rm(path.join(candidateDirectory, DEFERRED_REPORT_FILE_NAME), { force: true });
          await finalizeSharedGeneration('candidate-report-fault');
          const code = error instanceof CandidateArtifactError ? error.code : 'report-invalid';
          await writeFailure(candidateDirectory, code, error);
          entriesByCandidate.set(
            recipe.name, { candidate: recipe.name, status: 'failed', failure: code },
          );
        }
        continue;
      }

      // A successful fresh capture supersedes an older diagnostic only after
      // child and detached-Chrome cleanup both satisfy their contracts.
      await rm(path.join(candidateDirectory, 'failure.log'), { force: true });
      try {
        entriesByCandidate.set(recipe.name, await readCandidateReport(
          candidateDirectory, recipe, {
            executionPlan: candidateExecutionPlan,
            executionTuningPlan,
            executionTuningEntry,
          },
        ));
      } catch (error) {
        const code = error instanceof CandidateArtifactError ? error.code : 'report-invalid';
        if (!(error instanceof CandidateArtifactError && error.preserveDiagnostic)) {
          await writeFailure(candidateDirectory, code, error);
        }
        entriesByCandidate.set(
          recipe.name, { candidate: recipe.name, status: 'failed', failure: code },
        );
      }
    }
    await finalizeSharedGeneration('cohort-complete');
  } catch (error) {
    let cleanupError;
    try { await teardownSharedHost('batch-abort'); }
    catch (nested) { cleanupError = nested; }
    throw cleanupError
      ? new AggregateError([error, cleanupError], 'Visual Lab batch and shared-host cleanup failed')
      : error;
  }

  const entries = recipes.map((recipe) => entriesByCandidate.get(recipe.name));
  if (entries.some((entry) => entry === undefined)) {
    throw new Error('Visual Lab batch did not resolve every selected candidate');
  }

  await ensureCandidateRoot(outputDirectory, candidateRoot);
  for (const recipe of recipes) {
    await ensureCandidateDirectory(
      resolvedCandidateRoot, candidateDirectories.get(recipe.name), recipe.name,
    );
  }
  const index = createVisualLabBatchIndex(entries);
  if (publishedExecutionTuningPlan !== null) {
    assertExecutionTuningPlanMatchesEntries(
      publishedExecutionTuningPlan, recipes, entries, { requireProof: true },
    );
    assertExecutionTuningPlanCaptureIdentity(
      publishedExecutionTuningPlan,
      recipes,
      entries,
      publishedRecipeSet,
      outputDirectory,
      { required: index.complete },
    );
  }
  if (originPreflight !== null) {
    const postflight = await verifyRevision(selectedBaseUrl.href, expectedRevision);
    publishedOriginAttestation = createVisualLabOriginAttestation(
      originPreflight, postflight.revision,
    );
    await publishFile(
      originAttestationPath, `${JSON.stringify(publishedOriginAttestation, null, 2)}\n`,
    );
  }
  if (remoteBaseUrl !== null && publishedOriginAttestation !== null
      && (publishedOriginAttestation.baseUrl !== selectedBaseUrl.href
        || publishedOriginAttestation.revision !== expectedRevision)) {
    throw new TypeError(
      'Visual Lab deployed-origin attestation does not match its requested remote source',
    );
  }
  assertOriginAttestationCaptureIdentity(publishedOriginAttestation, entries, {
    required: remoteBaseUrl !== null && index.complete,
  });
  const timingSummary = summarizeEntryTimings(entries);
  const captureSubphaseSummary = summarizeEntryCaptureSubphases(entries);
  let experimentResponse = null;
  let regionResponse = null;
  let regionAppearance = null;
  if (index.complete) {
    experimentResponse = await createVisualLabBatchExperimentResponse(
      index,
      async (candidate, variant) => readStableRegularFile(
        path.join(outputDirectory, index.candidates.find((entry) => (
          entry.candidate === candidate
        )).artifacts[variant]),
        `Visual Lab ${candidate} ${variant} capture`,
      ),
    );
    const responseSource = `${JSON.stringify(experimentResponse, null, 2)}\n`;
    const experimentBoard = renderVisualLabExperimentBoard(index, experimentResponse);
    if (Buffer.byteLength(responseSource) > EXPERIMENT_EVIDENCE_MAX_BYTES
      || Buffer.byteLength(experimentBoard) > EXPERIMENT_EVIDENCE_MAX_BYTES) {
      throw new Error('Visual Lab current experiment evidence exceeds the 1 MiB bound');
    }
    await publishFile(responsePath, responseSource);
    await publishFile(experimentBoardPath, experimentBoard);
    const regionMeasurements = await createVisualLabCurrentRegionMeasurements(
      index,
      async (candidate, variant) => readStableRegularFile(
        path.join(outputDirectory, index.candidates.find((entry) => entry.candidate === candidate).artifacts[variant]),
        `Visual Lab ${candidate} ${variant} region measurement capture`,
      ),
    );
    regionResponse = regionMeasurements?.response ?? null;
    if (regionResponse !== null) {
      const regionSource = `${JSON.stringify(regionResponse, null, 2)}\n`;
      const regionBoard = renderVisualLabRegionResponseBoard(regionResponse);
      if (Buffer.byteLength(regionSource) > EXPERIMENT_EVIDENCE_MAX_BYTES
        || Buffer.byteLength(regionBoard) > EXPERIMENT_EVIDENCE_MAX_BYTES) {
        throw new Error('Visual Lab current region evidence exceeds the 1 MiB bound');
      }
      await publishFile(regionResponsePath, regionSource);
      await publishFile(regionResponseBoardPath, regionBoard);
    }
    regionAppearance = regionMeasurements?.appearance ?? null;
    if (regionAppearance !== null) {
      const appearanceSource = `${JSON.stringify(regionAppearance, null, 2)}\n`;
      const appearanceBoard = renderVisualLabRegionAppearanceBoard(regionAppearance);
      if (Buffer.byteLength(appearanceSource) > EXPERIMENT_EVIDENCE_MAX_BYTES
        || Buffer.byteLength(appearanceBoard) > EXPERIMENT_EVIDENCE_MAX_BYTES) {
        throw new Error('Visual Lab current region appearance exceeds the 1 MiB bound');
      }
      await publishFile(regionAppearancePath, appearanceSource);
      await publishFile(regionAppearanceBoardPath, appearanceBoard);
    }
  }
  // Publish the human sheet first and the machine-readable completion marker
  // last. A crash or sheet error therefore cannot leave complete:true without
  // its corresponding contact sheet.
  await publishFile(contactSheetPath, renderVisualLabContactSheet(index));
  await publishFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);
  return Object.freeze({
    ok: index.complete,
    exitCode: index.complete ? 0 : 1,
    index,
    indexPath,
    contactSheetPath,
    response: experimentResponse,
    responsePath: experimentResponse === null ? null : responsePath,
    experimentBoardPath: experimentResponse === null ? null : experimentBoardPath,
    regionResponse,
    regionResponsePath: regionResponse === null ? null : regionResponsePath,
    regionResponseBoardPath: regionResponse === null ? null : regionResponseBoardPath,
    regionAppearance,
    regionAppearancePath: regionAppearance === null ? null : regionAppearancePath,
    regionAppearanceBoardPath: regionAppearance === null ? null : regionAppearanceBoardPath,
    recipeSet,
    recipeSetPath,
    plan: executionPlan.inspection,
    browserHostPlan: publishedBrowserHostPlan,
    browserHostPlanPath,
    executionTuningPlan: publishedExecutionTuningPlan,
    executionTuningPlanPath,
    originAttestation: publishedOriginAttestation,
    originAttestationPath,
    browserHostRuntime: Object.freeze({
      ...browserHostRuntime,
      assignments: Object.freeze([...browserHostRuntime.assignments]),
      recycleReasons: Object.freeze([...browserHostRuntime.recycleReasons]),
    }),
    timings: timingSummary,
    captureSubphases: captureSubphaseSummary,
  });
  };
  return executeLockedBatch().finally(releaseBatchLock);
}

export function parseVisualLabBatchArguments(argv) {
  if (argv.includes('--help')) return Object.freeze({ help: true });
  const known = new Set([
    'candidates', 'recipe-set', 'bundle', 'base-url', 'expected-revision',
    'output-dir', 'chrome', 'gpu',
    'browser-host', 'capture-proof', 'candidate-timeout-ms', 'index-only', 'plan-only',
  ]);
  const values = new Map();
  for (const argument of argv) {
    if (!argument.startsWith('--') || !argument.includes('=')) {
      throw new Error(`Unknown argument ${JSON.stringify(argument)}; options use --name=value`);
    }
    const separator = argument.indexOf('=');
    const name = argument.slice(2, separator);
    if (!known.has(name)) throw new Error(`Unknown option --${name}`);
    if (values.has(name)) throw new Error(`Option --${name} may only be provided once`);
    values.set(name, argument.slice(separator + 1));
  }

  let candidates;
  if (values.has('candidates')) {
    candidates = values.get('candidates').split(',').map((name) => name.trim());
    if (candidates.some((name) => name.length === 0)) {
      throw new Error('--candidates must be a comma-separated list of recipe names');
    }
  }
  if (values.has('candidates') && values.has('recipe-set')) {
    throw new Error('--candidates and --recipe-set are mutually exclusive');
  }
  if (values.has('bundle') && values.has('base-url')) {
    throw new Error('--bundle and --base-url are mutually exclusive');
  }
  if (values.has('expected-revision') && !values.has('base-url')) {
    throw new Error('--expected-revision requires --base-url');
  }
  if (values.has('base-url') && !values.has('expected-revision')) {
    throw new Error('--base-url requires --expected-revision');
  }
  const indexOnlyValue = values.get('index-only') ?? '0';
  if (indexOnlyValue !== '0' && indexOnlyValue !== '1') {
    throw new Error('--index-only must be 0 or 1');
  }
  const planOnlyValue = values.get('plan-only') ?? '0';
  if (planOnlyValue !== '0' && planOnlyValue !== '1') {
    throw new Error('--plan-only must be 0 or 1');
  }
  if (indexOnlyValue === '1' && planOnlyValue === '1') {
    throw new Error('--index-only and --plan-only are mutually exclusive');
  }
  const gpu = values.get('gpu') ?? 'auto';
  if (gpu !== 'auto' && gpu !== 'swiftshader') throw new Error('--gpu must be auto or swiftshader');
  const browserHost = values.get('browser-host') ?? 'fresh';
  if (browserHost !== 'fresh' && browserHost !== 'shared') {
    throw new Error('--browser-host must be fresh or shared');
  }
  const captureProof = values.get('capture-proof') ?? 'stable-snapshots';
  if (!VISUAL_LAB_CAPTURE_PROOF_MODES.includes(captureProof)) {
    throw new Error('--capture-proof must be stable-snapshots, completed-frame-receipt, readiness-completed-frame-receipt, selection-owned-frame-receipt, fixture-activation-generation, fixture-activation-work-generation, or fixture-activation-render-field-generation');
  }
  const candidateTimeoutMs = Number(
    values.get('candidate-timeout-ms') ?? VISUAL_LAB_DEFAULT_CANDIDATE_TIMEOUT_MS,
  );
  if (!validCandidateTimeout(candidateTimeoutMs)) {
    throw new Error(
      `--candidate-timeout-ms must be a positive integer no greater than ${
        MAX_CANDIDATE_TIMEOUT_MS
      }`,
    );
  }
  for (const name of [
    'recipe-set', 'bundle', 'base-url', 'expected-revision', 'output-dir', 'chrome',
  ]) {
    if (values.has(name) && values.get(name).length === 0) {
      throw new Error(`--${name} must not be empty`);
    }
  }
  const baseUrl = values.has('base-url')
    ? normalizeVisualLabBatchBaseUrl(values.get('base-url')).href : undefined;
  const expectedRevision = values.has('expected-revision')
    ? normalizeLivePagesRevision(values.get('expected-revision')) : undefined;

  return Object.freeze({
    help: false,
    candidates,
    ...(values.has('recipe-set') ? { recipeSetPath: values.get('recipe-set') } : {}),
    bundle: values.get('bundle'),
    ...(baseUrl === undefined ? {} : { baseUrl }),
    ...(expectedRevision === undefined ? {} : { expectedRevision }),
    outputDir: values.get('output-dir'),
    chrome: values.get('chrome'),
    gpu,
    browserHost,
    ...(values.has('capture-proof') ? { captureProof } : {}),
    candidateTimeoutMs,
    indexOnly: indexOnlyValue === '1',
    planOnly: planOnlyValue === '1',
  });
}

const readCliCandidateDiagnostic = async (file, label) => {
  const details = await pathDetails(file);
  if (details === undefined) return undefined;
  if (details.size > CLI_DIAGNOSTIC_MAX_FILE_BYTES) {
    return `<omitted: ${label} exceeds ${CLI_DIAGNOSTIC_MAX_FILE_BYTES} bytes>`;
  }
  try {
    const source = await readStableRegularFile(file, label, 'utf8');
    const trimmed = source.trim();
    return trimmed.length === 0 ? undefined : trimmed.slice(-CLI_DIAGNOSTIC_MAX_CHARACTERS);
  } catch (error) {
    return `<unavailable: ${displayCliError(error)}>`;
  }
};

/** Extracts only the child audit's explicit public error record, never raw logs. */
const readStructuredChildFailureDiagnostic = async (file, label) => {
  const details = await pathDetails(file);
  if (details === undefined || details.size > CLI_DIAGNOSTIC_MAX_FILE_BYTES) return undefined;
  try {
    const source = await readStableRegularFile(file, label, 'utf8');
    const lines = source.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
    for (let index = lines.length - 1; index >= 0; index--) {
      let record;
      try { record = JSON.parse(lines[index]); }
      catch { continue; }
      if (record !== null && typeof record === 'object' && !Array.isArray(record)
        && record.tool === 'visual-lab-audit-v1' && record.ok === false
        && typeof record.error === 'string') {
        return formatVisualLabBatchCliError(record.error);
      }
    }
    return undefined;
  } catch {
    return undefined;
  }
};

const emitCliFailureDiagnostics = async (result) => {
  const batchRoot = path.dirname(result.indexPath);
  for (const entry of result.index.candidates) {
    if (entry.status !== 'failed') continue;
    const candidateRoot = path.join(batchRoot, 'candidates', entry.candidate);
    const diagnostic = await readCliCandidateDiagnostic(
      path.join(candidateRoot, 'failure.log'), `${entry.candidate} failure tombstone`,
    );
    process.stderr.write(`${JSON.stringify({
      tool: 'visual-lab-batch-diagnostic-v1',
      candidate: entry.candidate,
      failure: entry.failure,
      ...(diagnostic === undefined ? {} : { diagnostic }),
    })}\n`);
  }
};

const main = async () => {
  const argv = process.argv.slice(2);
  const requestedPlanTool = argv.some((argument) => argument.startsWith('--plan-only='));
  let options;
  let controller;
  let interruptedExitCode;
  let onSigint;
  let onSigterm;
  try {
    options = parseVisualLabBatchArguments(argv);
    if (options.help) {
      process.stdout.write(`${HELP}\n`);
      return;
    }
    controller = new AbortController();
    const interrupt = (exitCode) => {
      interruptedExitCode ??= exitCode;
      controller.abort(new Error('Visual Lab batch interrupted'));
    };
    onSigint = () => interrupt(130);
    onSigterm = () => interrupt(143);
    process.once('SIGINT', onSigint);
    process.once('SIGTERM', onSigterm);
    const recipeSet = options.recipeSetPath === undefined
      ? undefined : await readVisualLabRecipeSet(options.recipeSetPath);
    const { recipeSetPath: _recipeSetPath, ...batchOptions } = options;
    const result = await runVisualLabBatch({
      ...batchOptions,
      ...(recipeSet === undefined ? {} : {
        recipeSet,
        recipeSetSourcePath: path.resolve(options.recipeSetPath),
      }),
      signal: controller.signal,
    });
    const output = result.planOnly ? {
      tool: 'visual-lab-plan-v1',
      ok: true,
      plan: result.plan,
      browserHostPlan: result.browserHostPlan,
      executionTuningPlan: result.executionTuningPlan,
      runtime: result.runtime,
    } : {
      tool: 'visual-lab-batch-v1',
      ok: result.ok,
      summary: result.index.summary,
      recipeSet: {
        id: result.recipeSet.id,
        path: result.recipeSetPath,
      },
      browserHost: result.browserHostPlan === null ? null : {
        id: result.browserHostPlan.id,
        path: result.browserHostPlanPath,
        runtime: result.browserHostRuntime,
      },
      executionTuning: result.executionTuningPlan === null ? null : {
        id: result.executionTuningPlan.id,
        path: result.executionTuningPlanPath,
      },
      originAttestation: result.originAttestation === null ? null : {
        baseUrl: result.originAttestation.baseUrl,
        revision: result.originAttestation.revision,
        checkedResources: result.originAttestation.checkedResources,
        path: result.originAttestationPath,
      },
      index: result.indexPath,
      contactSheet: result.contactSheetPath,
      timings: result.timings,
      captureSubphases: result.captureSubphases,
    };
    process.stdout.write(`${JSON.stringify(output)}\n`);
    if (!result.planOnly && !result.ok) await emitCliFailureDiagnostics(result);
    process.exitCode = interruptedExitCode ?? result.exitCode;
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      tool: options?.planOnly || requestedPlanTool
        ? 'visual-lab-plan-v1' : 'visual-lab-batch-v1',
      ok: false,
      error: displayCliError(error),
    })}\n`);
    process.exitCode = interruptedExitCode ?? 1;
  } finally {
    if (onSigint) process.removeListener('SIGINT', onSigint);
    if (onSigterm) process.removeListener('SIGTERM', onSigterm);
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === MODULE_PATH) void main();
