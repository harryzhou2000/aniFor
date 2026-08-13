import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { lstat, mkdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  parseVisualLabReviewArguments,
  runVisualLabReviewCycle,
} from './visual-lab-review.mjs';
import {
  resolveTrackedVisualLabCohortSnapshot,
  visualLabCandidatesForAuthoringSource,
} from './visual-lab-cohort-catalog.mjs';
import { readVisualLabRecipeSet } from './visual-lab-recipe-set.mjs';

const MODULE_PATH = fileURLToPath(import.meta.url);
const REPOSITORY_ROOT = path.resolve(path.dirname(MODULE_PATH), '..');
const REVIEW_PARENT_SEGMENTS = Object.freeze(['.artifacts', 'visual-lab-reviews']);
const ROOT_RESERVATION_ATTEMPTS = 16;
const execFileAsync = promisify(execFile);

const HELP = `Usage:
  node scripts/visual-lab-developer-review.mjs \\
    (--candidate=<name> | --source=<authoring-source> | --cohort=<kebab-name> | --recipe-set=<recipe-set.json>) \\
    [Visual Lab review capture options]

Runs one local edit-to-review cycle through the existing trusted review API. It
allocates a new ignored .artifacts/visual-lab-reviews directory, captures the
selected recipe or cohort, verifies the current-only portable package, and prints
static file links only after verification succeeds. An explicit --baseline-root
also enables the legacy accepted-baseline comparison.

The developer defaults are dist/index.html, SwiftShader, combined activation-owned
render-field readiness plus selector-owned receipt/alpha evidence, and a shared
browser host on Linux (fresh elsewhere). --output-dir is deliberately unsupported
because this launcher always reserves a unique evidence root.`;

const optionName = (argument) => {
  if (typeof argument !== 'string' || !argument.startsWith('--')) return null;
  const separator = argument.indexOf('=');
  return separator === -1 ? argument.slice(2) : argument.slice(2, separator);
};

const hasOption = (argumentsList, name) => (
  argumentsList.some((argument) => optionName(argument) === name)
);

const safeRootLabel = (parsed) => {
  const source = parsed.sourceName ?? (parsed.recipeSetPath === undefined
    ? parsed.candidates.length === 1 ? parsed.candidates[0] : 'cohort'
    : path.basename(parsed.recipeSetPath, path.extname(parsed.recipeSetPath)));
  const normalized = source.toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 64);
  return normalized || 'review';
};

const assertTrackedRecipeSet = async (recipeSetPath, repositoryRoot) => {
  const relative = path.relative(repositoryRoot, recipeSetPath);
  if (relative === '' || relative === '..' || relative.startsWith(`..${path.sep}`)
    || path.isAbsolute(relative)) {
    throw new Error('Visual Lab developer recipe set must be a tracked repository file');
  }
  try {
    await execFileAsync('git', ['ls-files', '--error-unmatch', '--', relative], {
      cwd: repositoryRoot,
      windowsHide: true,
    });
  } catch {
    throw new Error('Visual Lab developer recipe set must be a tracked repository file');
  }
};

const assertRealDirectory = async (directory, filesystem, { create = false } = {}) => {
  let details;
  try { details = await filesystem.lstat(directory); }
  catch (error) {
    if (error?.code !== 'ENOENT' || !create) throw error;
    try { await filesystem.mkdir(directory); }
    catch (creationError) {
      if (creationError?.code !== 'EEXIST') throw creationError;
    }
    details = await filesystem.lstat(directory);
  }
  if (details.isSymbolicLink() || !details.isDirectory()) {
    throw new Error(`Visual Lab developer review path must be a real directory: ${directory}`);
  }
  return filesystem.realpath(directory);
};

const reserveReviewRoot = async ({
  repositoryRoot,
  label,
  filesystem,
  createUuid,
}) => {
  const canonicalRepositoryRoot = await assertRealDirectory(
    path.resolve(repositoryRoot), filesystem,
  );
  let parent = canonicalRepositoryRoot;
  for (const segment of REVIEW_PARENT_SEGMENTS) {
    const candidate = path.join(parent, segment);
    const canonical = await assertRealDirectory(candidate, filesystem, { create: true });
    if (path.dirname(canonical) !== parent) {
      throw new Error(`Visual Lab developer review path escapes its parent: ${candidate}`);
    }
    parent = canonical;
  }

  for (let attempt = 0; attempt < ROOT_RESERVATION_ATTEMPTS; attempt++) {
    const uuid = createUuid();
    if (typeof uuid !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(uuid)) {
      throw new TypeError('Visual Lab developer review UUID source returned an invalid UUID');
    }
    const reviewRoot = path.join(parent, `${label}-${uuid.toLowerCase()}`);
    try {
      await filesystem.mkdir(reviewRoot);
      return reviewRoot;
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
    }
  }
  throw new Error('Could not reserve a unique Visual Lab developer review root');
};

/**
 * Adds developer-only defaults and delegates all capture option validation to
 * the established review parser. No output directory is touched here.
 */
export function parseVisualLabDeveloperReviewArguments(
  argv,
  { platform = process.platform, repositoryRoot = REPOSITORY_ROOT } = {},
) {
  if (!Array.isArray(argv)) throw new TypeError('arguments must be an array');
  if (argv.includes('--help') || argv.includes('-h')) return Object.freeze({ help: true });

  if (hasOption(argv, 'candidates')) {
    throw new Error(
      '--candidates is not supported by the developer launcher; use one --candidate, one authoring --source, a catalog --cohort, or a tracked --recipe-set',
    );
  }
  const selectionArguments = argv.filter((argument) => (
    ['candidate', 'source', 'cohort', 'recipe-set'].includes(optionName(argument))
  ));
  if (selectionArguments.length !== 1) {
    throw new Error(
      'Visual Lab developer review requires exactly one of --candidate, --source, --cohort, or --recipe-set',
    );
  }
  if (hasOption(argv, 'output-dir')) {
    throw new Error('--output-dir is owned by the Visual Lab developer review launcher');
  }

  const repository = path.resolve(repositoryRoot);
  let cohortName;
  let sourceName;
  const normalizedArguments = argv.map((argument) => {
    if (optionName(argument) === 'cohort') {
      const separator = argument.indexOf('=');
      if (separator === -1) return argument;
      const cohort = argument.slice(separator + 1);
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(cohort) || cohort.length > 64) {
        throw new Error('--cohort must be a safe kebab-case name');
      }
      cohortName = cohort;
      return `--recipe-set=${path.join(repository, 'visual-lab', 'recipe-sets', `${cohort}.json`)}`;
    }
    if (optionName(argument) === 'recipe-set') {
      const separator = argument.indexOf('=');
      if (separator === -1) return argument;
      return `--recipe-set=${path.resolve(repository, argument.slice(separator + 1))}`;
    }
    if (optionName(argument) === 'source') {
      const separator = argument.indexOf('=');
      if (separator === -1) return argument;
      sourceName = argument.slice(separator + 1);
      const candidates = visualLabCandidatesForAuthoringSource(sourceName);
      return `--candidates=${candidates.join(',')}`;
    }
    if (optionName(argument) !== 'candidate') return argument;
    const separator = argument.indexOf('=');
    if (separator === -1) return argument;
    const candidate = argument.slice(separator + 1);
    if (candidate.includes(',')) {
      throw new Error('--candidate accepts exactly one recipe name; use a tracked --recipe-set for a cohort');
    }
    return `--candidates=${candidate}`;
  });
  const defaults = [
    `--output-dir=${path.join(repository, '.artifacts', 'visual-lab-reviews', '.pending')}`,
    ...(hasOption(normalizedArguments, 'bundle') || hasOption(normalizedArguments, 'base-url')
      ? [] : [`--bundle=${path.join(repository, 'dist', 'index.html')}`]),
    ...(hasOption(normalizedArguments, 'gpu') ? [] : ['--gpu=swiftshader']),
    ...(hasOption(normalizedArguments, 'capture-proof')
      ? [] : [
        '--capture-proof=fixture-activation-render-field-generation-and-selection-owned-alpha-readback',
      ]),
    ...(hasOption(normalizedArguments, 'browser-host')
      ? [] : [`--browser-host=${platform === 'linux' ? 'shared' : 'fresh'}`]),
  ];
  const parsed = parseVisualLabReviewArguments([...normalizedArguments, ...defaults]);
  return Object.freeze({
    ...parsed,
    ...(cohortName === undefined ? {} : { cohortName }),
    ...(sourceName === undefined ? {} : { sourceName }),
  });
}

const requireReviewArtifact = async (value, label, reviewRoot, filesystem) => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Visual Lab developer review did not return ${label}`);
  }
  const absolute = path.resolve(value);
  const relative = path.relative(reviewRoot, absolute);
  if (relative === '' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Visual Lab developer review returned ${label} outside its evidence root`);
  }
  const details = await filesystem.lstat(absolute);
  if (details.isSymbolicLink() || !details.isFile()) {
    throw new Error(`Visual Lab developer review returned an invalid ${label}`);
  }
  const canonical = await filesystem.realpath(absolute);
  const canonicalRelative = path.relative(reviewRoot, canonical);
  if (canonicalRelative.startsWith(`..${path.sep}`) || path.isAbsolute(canonicalRelative)) {
    throw new Error(`Visual Lab developer review returned ${label} outside its evidence root`);
  }
  return pathToFileURL(canonical).href;
};

/**
 * Developer convenience envelope only. The established review cycle retains
 * capture, comparison, verification, browser, and failure-publication authority.
 */
export async function runVisualLabDeveloperReview(argv, runtime = {}) {
  const repositoryRoot = path.resolve(runtime.repositoryRoot ?? REPOSITORY_ROOT);
  const platform = runtime.platform ?? process.platform;
  const parsed = parseVisualLabDeveloperReviewArguments(argv, { platform, repositoryRoot });
  if (parsed.help) {
    (runtime.stdout ?? process.stdout).write(`${HELP}\n`);
    return Object.freeze({ help: true });
  }

  const filesystem = runtime.filesystem ?? Object.freeze({ lstat, mkdir, realpath });
  const stdout = runtime.stdout ?? process.stdout;
  const stderr = runtime.stderr ?? process.stderr;
  const createUuid = runtime.randomUUID ?? randomUUID;
  const runReviewCycle = runtime.runReviewCycle ?? runVisualLabReviewCycle;
  const cohortResolver = runtime.resolveCohort ?? resolveTrackedVisualLabCohortSnapshot;
  const cohort = parsed.cohortName === undefined ? undefined : await cohortResolver(
    parsed.cohortName,
    {
      catalogPath: path.join(repositoryRoot, 'visual-lab', 'cohorts.json'),
      outputDirectory: path.join(repositoryRoot, 'visual-lab', 'recipe-sets'),
    },
  );
  if (cohort !== undefined) {
    const expectedSnapshotPath = path.join(
      repositoryRoot, 'visual-lab', 'recipe-sets', `${parsed.cohortName}.json`,
    );
    if (cohort.name !== parsed.cohortName
      || path.resolve(cohort.snapshotPath) !== expectedSnapshotPath) {
      throw new Error('Visual Lab developer cohort resolver returned an unexpected tracked recipe set');
    }
  }
  if (parsed.recipeSetPath !== undefined) {
    await (runtime.assertTrackedRecipeSet ?? assertTrackedRecipeSet)(
      cohort?.snapshotPath ?? parsed.recipeSetPath,
      repositoryRoot,
    );
  }
  // Production resolution already carries the validated snapshot. Retain the
  // older injected-resolver seam for focused launcher tests and embedders,
  // without making that injection an authority to bypass stale-byte checks.
  if (cohort !== undefined && cohort.snapshot === undefined) {
    const snapshot = await (runtime.readRecipeSet ?? readVisualLabRecipeSet)(cohort.snapshotPath);
    if (snapshot.id !== cohort.recipeSet?.id || snapshot.name !== cohort.name) {
      throw new Error('Visual Lab developer cohort snapshot is stale; run npm run visual-lab:authoring:sync');
    }
  }
  const reviewRoot = await reserveReviewRoot({
    repositoryRoot,
    label: safeRootLabel(parsed),
    filesystem,
    createUuid,
  });
  stdout.write(`Visual Lab review root: ${reviewRoot}\n`);

  const {
    help: _help,
    outputDir: _placeholderOutput,
    cohortName: _cohortName,
    sourceName: _sourceName,
    ...reviewOptions
  } = parsed;
  try {
    const result = await runReviewCycle({
      ...reviewOptions,
      ...(cohort === undefined ? {} : { recipeSetPath: cohort.snapshotPath }),
      outputDir: reviewRoot,
      ...(runtime.signal === undefined ? {} : { signal: runtime.signal }),
    });
    if (result?.ok !== true) {
      throw new Error('Visual Lab developer review cycle did not report success');
    }
    const [experimentBoard, contactSheet] = await Promise.all([
      requireReviewArtifact(
        result.batch?.experimentBoard, 'the experiment response board', reviewRoot, filesystem,
      ),
      requireReviewArtifact(
        result.batch?.contactSheet, 'the raw capture sheet', reviewRoot, filesystem,
      ),
    ]);
    const legacyLinks = result.comparison == null ? {} : {
      board: await requireReviewArtifact(
        result.comparison.board, 'the review board', reviewRoot, filesystem,
      ),
      brief: await requireReviewArtifact(
        result.comparison.brief, 'the compact review brief', reviewRoot, filesystem,
      ),
    };
    const links = Object.freeze({ experimentBoard, ...legacyLinks, contactSheet });
    stdout.write(`Experiment response: ${links.experimentBoard}\n`);
    if (links.board !== undefined) stdout.write(`Review board: ${links.board}\n`);
    if (links.brief !== undefined) stdout.write(`Compact brief: ${links.brief}\n`);
    stdout.write(`Raw captures: ${links.contactSheet}\n`);
    return Object.freeze({ ok: true, reviewRoot, links, result });
  } catch (error) {
    stderr.write(`Visual Lab review failed; evidence retained at: ${reviewRoot}\n`);
    throw error;
  }
}

export async function runVisualLabDeveloperReviewCli(runtime = {}) {
  const argv = runtime.argv ?? process.argv.slice(2);
  const signalTarget = runtime.signalTarget ?? process;
  const controller = new AbortController();
  let interruptedExitCode;
  const interrupt = (exitCode) => {
    interruptedExitCode ??= exitCode;
    controller.abort(new Error('Visual Lab developer review interrupted'));
  };
  const onSigint = () => interrupt(130);
  const onSigterm = () => interrupt(143);
  signalTarget.once('SIGINT', onSigint);
  signalTarget.once('SIGTERM', onSigterm);
  try {
    await runVisualLabDeveloperReview(argv, {
      ...runtime,
      signal: runtime.signal ?? controller.signal,
    });
    return interruptedExitCode ?? 0;
  } catch (error) {
    (runtime.stderr ?? process.stderr).write(`${error?.message ?? String(error)}\n`);
    return interruptedExitCode ?? 1;
  } finally {
    signalTarget.removeListener('SIGINT', onSigint);
    signalTarget.removeListener('SIGTERM', onSigterm);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === MODULE_PATH) {
  process.exitCode = await runVisualLabDeveloperReviewCli();
}
