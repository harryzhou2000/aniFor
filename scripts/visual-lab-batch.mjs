import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import {
  lstat, mkdir, open, readFile, realpath, rename, rm, stat, writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

import {
  resolveVisualLabCaptureRecipe,
  visualLabCaptureRecipeNames,
} from './visual-lab-recipes.mjs';
import {
  createVisualLabRecipeSet,
  normalizeVisualLabRecipeSet,
  readVisualLabRecipeSet,
} from './visual-lab-recipe-set.mjs';
import {
  resolveVisualLabDomain,
  resolveVisualLabFixture,
  VISUAL_LAB_CAPTURE_PROTOCOL,
  visualLabFixturePreparationLabel,
} from './visual-lab-fixtures.mjs';
import { createVisualLabResultRecord } from './visual-lab-result.mjs';
import {
  isDetachedProcessGroupAlive,
  terminateDetachedProcessGroup,
} from './detached-process.mjs';
import {
  VISUAL_LAB_CAPTURE_VARIANT_NAMES as VARIANTS,
} from './visual-lab-capture-abi.mjs';
import { inspectVisualLabPng } from './visual-lab-png.mjs';

export { inspectVisualLabPng } from './visual-lab-png.mjs';

export const VISUAL_LAB_BATCH_SCHEMA = 'anifor.visual-lab.batch/v1';
export const VISUAL_LAB_DEFAULT_CANDIDATE_TIMEOUT_MS = 300_000;

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
const LIFECYCLE_CLOCK_SKEW_MS = 60_000;
const MIN_LIFECYCLE_RECOVERY_WINDOW_MS = 30 * 60_000;
const CANDIDATE_GENERATED_FILES = Object.freeze([
  'off.png', 'a.png', 'b.png', 'report.json', 'stdout.log', 'stderr.log',
]);
const FAILURE_CODES = new Set([
  'capture-failed', 'report-missing', 'report-invalid', 'artifact-invalid',
]);

const HELP = `Usage:
  node scripts/visual-lab-batch.mjs [options]

Options (use --name=value):
  --candidates=<name,name>               Named recipes (default: all catalog entries)
  --recipe-set=<recipe-set.json>         Exact recipe-set/v1 (exclusive with --candidates)
  --bundle=dist/index.html               One existing production bundle for every capture
  --output-dir=/tmp/anifor-visual-lab-batch
  --chrome=/path/to/chrome               Forwarded to the generic capture runner
  --gpu=auto|swiftshader                 Forwarded to the generic capture runner
  --candidate-timeout-ms=300000          Per-candidate timeout before TERM/KILL cleanup
  --index-only=0|1                       Aggregate existing candidate reports without capture
  --help

Outputs: recipe-set.json, index.json, index.html, and candidates/<name>/ capture artifacts.`;

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

const requestForRecipe = (recipe) => ({
  domain: recipe.domain,
  target: recipe.target,
  fixture: recipe.fixture,
  gain: recipe.gain,
  renderScale: recipe.renderScale,
});

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
const readStableRegularFile = async (file, label, encoding) => {
  await assertRealAncestors(file, label);
  const before = await lstat(file, { bigint: true });
  if (before.isSymbolicLink() || !before.isFile()) {
    throw new Error(`${label} must be a real regular file`);
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
    contents = await handle.readFile(encoding);
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

const relativeCandidateRoot = (candidate) => `candidates/${candidate}`;

const passedArtifacts = (candidate) => {
  const root = relativeCandidateRoot(candidate);
  return Object.freeze({
    report: `${root}/report.json`,
    off: `${root}/off.png`,
    a: `${root}/a.png`,
    b: `${root}/b.png`,
  });
};

const failedArtifacts = (candidate) => Object.freeze({
  diagnostic: `${relativeCandidateRoot(candidate)}/failure.log`,
});

const deepFreeze = (value) => {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
};

const normalizeResult = (recipe, result) => {
  let expected;
  try {
    expected = createVisualLabResultRecord(
      recipe.name,
      requestForRecipe(recipe),
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
        artifacts: passedArtifacts(recipe.name),
        warnings: Object.freeze([...entry.warnings]),
      };
    }

    if (entry.status === 'failed' && FAILURE_CODES.has(entry.failure)) {
      return {
        candidate: recipe.name,
        status: 'failed',
        failure: entry.failure,
        artifacts: failedArtifacts(recipe.name),
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
  const warnings = entry.warnings.length === 0 ? '' : `
        <ul class="warnings">${entry.warnings.map((warning) => (
    `<li>${escapeHtml(warning)}</li>`
  )).join('')}</ul>`;
  const figures = VARIANTS.map((variant) => `
          <figure>
            <img src="./${escapeHtml(entry.artifacts[variant])}" loading="lazy" alt="${
  escapeHtml(`${entry.candidate} ${variant}`)
}">
            <figcaption>${variant === 'off' ? 'Off' : variant.toUpperCase()}</figcaption>
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

const assertCurrentCaptureContract = (report, recipe, hashes) => {
  const request = requestForRecipe(recipe);
  const domain = resolveVisualLabDomain(recipe.domain);
  const fixture = resolveVisualLabFixture(recipe.fixture, recipe.domain, recipe.target);
  const expectedPreparation = visualLabFixturePreparationLabel(fixture);
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
  if (report.backend !== domain.executionProfile.backend
    || report.hdrPipeline !== VISUAL_LAB_CAPTURE_PROTOCOL.datasetRequirements.hdrPipeline) {
    throw new Error('report did not complete on canonical WebGL with active HDR');
  }
  if (report.backingSize !== expectedBacking) {
    throw new Error(`backingSize must be ${expectedBacking}`);
  }

  const startup = report.startupSelection;
  if (startup?.requestedVariant !== 2
    || startup.fixture !== recipe.fixture
    || startup.scene !== fixture.scene
    || startup.preparation !== expectedPreparation
    || startup.fixturePrepared !== true
    || startup.backendBeforeSelection !== 'canvas2d'
    || startup.backendReasonBeforeSelection !== 'webgl-starting'
    || startup.stagedBeforeWebGL !== true) {
    throw new Error('startup selection was not staged through bounded Canvas promotion');
  }

  for (let index = 0; index < VARIANTS.length; index++) {
    const variant = VARIANTS[index];
    const capture = report.captures?.[variant];
    const dataset = capture?.dataset;
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
    if (capture.distinctFromOff !== (hashes[variant] !== hashes.off)) {
      throw new Error(`${variant} distinctFromOff does not match its capture hash`);
    }
    if (dataset?.renderer !== VISUAL_LAB_CAPTURE_PROTOCOL.datasetRequirements.renderer
      || dataset.hdrPipeline !== VISUAL_LAB_CAPTURE_PROTOCOL.datasetRequirements.hdrPipeline
      || dataset.renderLook !== VISUAL_LAB_CAPTURE_PROTOCOL.fixedUrlParameters.renderLook
      || dataset.outputScale !== String(recipe.renderScale)
      || dataset.backingSize !== expectedBacking
      || dataset.visualLabDomain !== recipe.domain
      || dataset.visualLabVariant !== String(index)
      || dataset.visualLabTarget !== String(recipe.target)
      || dataset.visualLabGain !== String(recipe.gain)
      || dataset.visualLab !== (index === 0 ? 'inactive' : 'active')) {
      throw new Error(`${variant} capture dataset does not match the requested WebGL/HDR state`);
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
} = {}) => {
  await readFailureTombstone(candidateDirectory, recipe, {
    rejectSymlink: strictFailureTombstone,
  });
  const reportPath = path.join(candidateDirectory, 'report.json');
  let source;
  try {
    source = await readStableRegularFile(reportPath, `${recipe.name} report.json`, 'utf8');
  } catch (error) {
    throw new CandidateArtifactError(
      error?.code === 'ENOENT' ? 'report-missing' : 'report-invalid',
      `Cannot read ${recipe.name} report.json: ${error.message}`,
      { cause: error },
    );
  }

  let report;
  try {
    report = JSON.parse(source);
  } catch (error) {
    throw new CandidateArtifactError(
      'report-invalid', `${recipe.name} report.json is not valid JSON`, { cause: error },
    );
  }

  let expected;
  try {
    if (report?.tool !== 'visual-lab-audit-v1') throw new Error('unexpected report tool');
    const hashes = Object.fromEntries(VARIANTS.map((variant) => [
      variant, report?.captures?.[variant]?.sha256,
    ]));
    expected = createVisualLabResultRecord(recipe.name, requestForRecipe(recipe), hashes);
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
    assertCurrentCaptureContract(report, recipe, hashes);
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
  };
};

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
    'batchRoot', 'requireComplete', 'requireRecipeSet', 'recipeSetSourcePath',
  ]);
  const unexpected = Reflect.ownKeys(options).filter((key) => !allowed.has(key));
  if (unexpected.length > 0) {
    throw new TypeError(`Unknown Visual Lab batch verification option ${String(unexpected[0])}`);
  }
  if (typeof options.batchRoot !== 'string' || options.batchRoot.length === 0) {
    throw new TypeError('Visual Lab batch verification requires batchRoot');
  }
  const requireComplete = options.requireComplete ?? true;
  const requireRecipeSet = options.requireRecipeSet ?? false;
  if (typeof requireComplete !== 'boolean' || typeof requireRecipeSet !== 'boolean') {
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
  for (const raw of index.candidates) {
    const recipe = resolveVisualLabCaptureRecipe(raw?.candidate);
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
      return { name: candidate, ...requestForRecipe(recipe) };
    });
    if (!isDeepStrictEqual(recipeSet.recipes, captured)) {
      throw new TypeError('Visual Lab batch package does not match its recipe-set request');
    }
  }

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

const resolveBatchRecipeSet = (options) => {
  if (options.recipeSet !== undefined && options.candidates !== undefined) {
    throw new TypeError('Visual Lab batch recipeSet and candidates are mutually exclusive');
  }
  if (options.recipeSet !== undefined) return normalizeVisualLabRecipeSet(options.recipeSet);
  if (options.candidates !== undefined) {
    const seen = new Set();
    for (const candidate of options.candidates) {
      const recipe = resolveVisualLabCaptureRecipe(candidate);
      if (seen.has(recipe.name)) throw new Error(`Duplicate --candidates entry ${recipe.name}`);
      seen.add(recipe.name);
    }
  }
  return createVisualLabRecipeSet(
    options.candidates === undefined ? 'full-catalog' : 'ad-hoc',
    options.candidates,
  );
};

/**
 * Runs generic named captures sequentially, then produces a deterministic index
 * and static contact sheet even when individual candidates fail.
 */
export async function runVisualLabBatch(options = {}, dependencies = {}) {
  // Resolve and validate the complete request before inspecting or mutating an
  // output directory. A stale external set therefore cannot invalidate a
  // previously useful batch package.
  const recipeSet = resolveBatchRecipeSet(options);
  const recipes = recipeSet.recipes.map(({ name }) => resolveVisualLabCaptureRecipe(name));
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
  const bundle = path.resolve(options.bundle ?? path.join(REPOSITORY_ROOT, 'dist/index.html'));
  const gpu = options.gpu ?? 'auto';
  const candidateTimeoutMs = options.candidateTimeoutMs
    ?? VISUAL_LAB_DEFAULT_CANDIDATE_TIMEOUT_MS;
  if (gpu !== 'auto' && gpu !== 'swiftshader') {
    throw new Error('Visual Lab batch gpu must be auto or swiftshader');
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
  if (!indexOnly) {
    let details;
    try { details = await stat(bundle); } catch { /* handled below */ }
    if (!details?.isFile()) throw new Error(`Cannot read production bundle ${bundle}`);
  }

  const outputDirectory = await ensureRealDirectory(
    requestedOutputDirectory, 'Visual Lab output directory',
  );
  const releaseBatchLock = await acquireBatchLock(outputDirectory);
  const executeLockedBatch = async () => {
  const candidateRoot = path.join(outputDirectory, 'candidates');
  const indexPath = path.join(outputDirectory, 'index.json');
  const contactSheetPath = path.join(outputDirectory, 'index.html');
  const recipeSetPath = path.join(outputDirectory, 'recipe-set.json');
  const resolvedCandidateRoot = await ensureCandidateRoot(outputDirectory, candidateRoot);
  const candidateDirectories = new Map();
  const lifecycleOwners = new Map();
  for (const recipe of recipes) {
    const candidateDirectory = path.join(candidateRoot, recipe.name);
    const lifecycleOwner = lifecycleOwnerFor(outputDirectory, recipe.name);
    await ensureCandidateDirectory(resolvedCandidateRoot, candidateDirectory, recipe.name);
    // A prior supervisor may have died after its audit published the exact
    // Chrome handoff. Recover that identity before deleting or replacing any
    // candidate-owned file, and before invalidating a previously useful index.
    await recoverRecordedChrome(
      path.join(candidateDirectory, LIFECYCLE_FILE_NAME), candidateTimeoutMs, lifecycleOwner,
    );
    candidateDirectories.set(recipe.name, candidateDirectory);
    lifecycleOwners.set(recipe.name, lifecycleOwner);
  }
  // A prior successful sheet must never survive a rerun that is interrupted
  // before new evidence can be aggregated. Remove only root files owned by
  // this tool; candidate logs remain available for diagnosis.
  await Promise.all([
    indexPath, contactSheetPath, recipeSetPath,
    `${indexPath}.tmp`, `${contactSheetPath}.tmp`, `${recipeSetPath}.tmp`,
  ].map((file) => rm(file, { force: true })));
  const runCandidate = dependencies.runCandidate ?? defaultRunCandidate;
  const publishFile = dependencies.publishFile ?? writeAtomic;
  const auditScript = path.resolve(dependencies.auditScript ?? DEFAULT_AUDIT_SCRIPT);
  const command = dependencies.command ?? process.execPath;
  const cwd = path.resolve(dependencies.cwd ?? REPOSITORY_ROOT);
  const entries = [];

  // This sidecar is a separate schema family; batch/v1 stays byte-compatible.
  // Publishing it before any completion marker makes the selected cohort
  // independently inspectable even when capture is interrupted.
  await publishFile(recipeSetPath, `${JSON.stringify(recipeSet, null, 2)}\n`);
  const publishedRecipeSet = await readVisualLabRecipeSet(recipeSetPath);
  if (!isDeepStrictEqual(publishedRecipeSet, recipeSet)) {
    throw new Error('Published Visual Lab recipe set does not match the validated request');
  }

  for (const recipe of recipes) {
    if (options.signal?.aborted) throw abortError(options.signal);
    const candidateDirectory = candidateDirectories.get(recipe.name);
    const lifecycleOwner = lifecycleOwners.get(recipe.name);
    await ensureCandidateDirectory(resolvedCandidateRoot, candidateDirectory, recipe.name);
    if (!indexOnly) {
      // Clear only files owned by this tool. An explicit output directory may
      // contain a user's notes or comparison artifacts; never remove its tree.
      await Promise.all(CANDIDATE_GENERATED_FILES.map((file) => (
        rm(path.join(candidateDirectory, file), { force: true })
      )));
      const stdoutPath = path.join(candidateDirectory, 'stdout.log');
      const stderrPath = path.join(candidateDirectory, 'stderr.log');
      const lifecyclePath = path.join(candidateDirectory, LIFECYCLE_FILE_NAME);
      await Promise.all([writeFile(stdoutPath, ''), writeFile(stderrPath, '')]);
      const args = [
        auditScript,
        `--bundle=${bundle}`,
        `--candidate=${recipe.name}`,
        `--output-dir=${candidateDirectory}`,
        `--gpu=${gpu}`,
        `--lifecycle-file=${lifecyclePath}`,
        `--lifecycle-owner=${lifecycleOwner}`,
      ];
      if (options.chrome) args.push(`--chrome=${options.chrome}`);

      let outcome;
      let executionError;
      try {
        outcome = await runCandidate({
          command, args, cwd, recipe, candidateDirectory,
          stdoutPath, stderrPath, lifecyclePath, signal: options.signal,
          timeoutMs: candidateTimeoutMs,
        });
      } catch (error) {
        executionError = error;
      }
      let recoveredChrome = false;
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
      if (options.signal?.aborted) {
        const interruption = abortError(options.signal);
        throw executionError
          ? new AggregateError([interruption, executionError], interruption.message)
          : interruption;
      }
      if (recoveredChrome && !executionError
        && outcome?.killUnsettled !== true
        && outcome?.timedOut !== true && outcome?.code === 0) {
        executionError = new Error(
          'Audit child exited successfully but left detached Chrome cleanup for its supervisor',
        );
      }
      if (executionError) {
        await writeFailure(candidateDirectory, 'capture-failed', executionError);
        entries.push({ candidate: recipe.name, status: 'failed', failure: 'capture-failed' });
        continue;
      }
      if (options.signal?.aborted) throw abortError(options.signal);
      if (outcome?.killUnsettled === true
        || outcome?.timedOut === true || outcome?.code !== 0) {
        const detail = new Error(outcome?.killUnsettled === true
          ? `Audit child did not settle within ${CANDIDATE_KILL_SETTLEMENT_MS} ms after SIGKILL`
          : outcome?.timedOut === true
            ? `Audit child timed out after ${candidateTimeoutMs} ms`
            : `Audit child exited with code ${String(outcome?.code)}`
              + (outcome?.signal ? ` after ${outcome.signal}` : ''));
        await writeFailure(candidateDirectory, 'capture-failed', detail);
        entries.push({ candidate: recipe.name, status: 'failed', failure: 'capture-failed' });
        continue;
      }
      // A successful current capture supersedes an older diagnostic only after
      // child and detached-Chrome cleanup both satisfy their contracts.
      await rm(path.join(candidateDirectory, 'failure.log'), { force: true });
    }

    try {
      entries.push(await readCandidateReport(candidateDirectory, recipe));
    } catch (error) {
      const code = error instanceof CandidateArtifactError ? error.code : 'report-invalid';
      if (!(error instanceof CandidateArtifactError && error.preserveDiagnostic)) {
        await writeFailure(candidateDirectory, code, error);
      }
      entries.push({ candidate: recipe.name, status: 'failed', failure: code });
    }
  }

  await ensureCandidateRoot(outputDirectory, candidateRoot);
  for (const recipe of recipes) {
    await ensureCandidateDirectory(
      resolvedCandidateRoot, candidateDirectories.get(recipe.name), recipe.name,
    );
  }
  const index = createVisualLabBatchIndex(entries);
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
    recipeSet,
    recipeSetPath,
  });
  };
  return executeLockedBatch().finally(releaseBatchLock);
}

export function parseVisualLabBatchArguments(argv) {
  if (argv.includes('--help')) return Object.freeze({ help: true });
  const known = new Set([
    'candidates', 'recipe-set', 'bundle', 'output-dir', 'chrome', 'gpu',
    'candidate-timeout-ms', 'index-only',
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
  const indexOnlyValue = values.get('index-only') ?? '0';
  if (indexOnlyValue !== '0' && indexOnlyValue !== '1') {
    throw new Error('--index-only must be 0 or 1');
  }
  const gpu = values.get('gpu') ?? 'auto';
  if (gpu !== 'auto' && gpu !== 'swiftshader') throw new Error('--gpu must be auto or swiftshader');
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
  for (const name of ['recipe-set', 'bundle', 'output-dir', 'chrome']) {
    if (values.has(name) && values.get(name).length === 0) {
      throw new Error(`--${name} must not be empty`);
    }
  }

  return Object.freeze({
    help: false,
    candidates,
    ...(values.has('recipe-set') ? { recipeSetPath: values.get('recipe-set') } : {}),
    bundle: values.get('bundle'),
    outputDir: values.get('output-dir'),
    chrome: values.get('chrome'),
    gpu,
    candidateTimeoutMs,
    indexOnly: indexOnlyValue === '1',
  });
}

const main = async () => {
  const options = parseVisualLabBatchArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${HELP}\n`);
    return;
  }
  const controller = new AbortController();
  let interruptedExitCode;
  const interrupt = (exitCode) => {
    interruptedExitCode ??= exitCode;
    controller.abort(new Error('Visual Lab batch interrupted'));
  };
  const onSigint = () => interrupt(130);
  const onSigterm = () => interrupt(143);
  process.once('SIGINT', onSigint);
  process.once('SIGTERM', onSigterm);
  try {
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
    process.stdout.write(`${JSON.stringify({
      tool: 'visual-lab-batch-v1',
      ok: result.ok,
      summary: result.index.summary,
      recipeSet: {
        id: result.recipeSet.id,
        path: result.recipeSetPath,
      },
      index: result.indexPath,
      contactSheet: result.contactSheetPath,
    })}\n`);
    process.exitCode = interruptedExitCode ?? result.exitCode;
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      tool: 'visual-lab-batch-v1',
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
