import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { terminateDetachedProcess } from './detached-process.mjs';
import { runVisualLabDeveloperReview } from './visual-lab-developer-review.mjs';

const MODULE_PATH = fileURLToPath(import.meta.url);
const REPOSITORY_ROOT = path.resolve(path.dirname(MODULE_PATH), '..');

/**
 * Scripts-side checkpoint routing deliberately stays outside the static Visual
 * Lab contract: each compact audit owns a separate renderer and lifecycle.
 */
export const VISUAL_CHECKPOINTS = Object.freeze({
  'powder-style': Object.freeze({
    label: 'true-8x powder',
    argv: Object.freeze([
      'scripts/verify-browser-input.mjs', '--eight-powder-only', '--production-bundle',
    ]),
  }),
  atmosphere: Object.freeze({
    label: 'true-8x gas identity',
    argv: Object.freeze([
      'scripts/verify-browser-input.mjs', '--gas-identity-graphics-only',
      '--render-scale=8', '--webgl-only', '--production-bundle',
    ]),
  }),
  'liquid-motion': Object.freeze({
    label: 'true-8x distilled/diesel liquid',
    argv: Object.freeze([
      'scripts/verify-browser-input.mjs', '--distilled-diesel-liquid-graphics-only',
      '--render-scale=8', '--webgl-only', '--production-bundle',
    ]),
  }),
});

const HELP = `Usage:
  node scripts/visual-lab-checkpoint.mjs --cohort=powder-style|atmosphere|liquid-motion

Runs one current-only normal WebGL developer review, then that cohort's existing
true-8x compact audit against the same already-built dist/. It never changes
Visual Lab's normal-HDR execution contract, result identities, or browser
lifecycle. On success it writes checkpoint.json beside the retained review.`;

export function parseVisualCheckpointArguments(argv) {
  if (!Array.isArray(argv)) throw new TypeError('arguments must be an array');
  if (argv.includes('--help') || argv.includes('-h')) {
    if (argv.length !== 1) throw new Error('--help cannot be combined with checkpoint options');
    return Object.freeze({ help: true });
  }
  if (argv.length !== 1 || !argv[0].startsWith('--cohort=')) {
    throw new Error('Visual checkpoint requires exactly one --cohort=<name>');
  }
  const cohort = argv[0].slice('--cohort='.length);
  if (!Object.hasOwn(VISUAL_CHECKPOINTS, cohort)) {
    throw new Error(`Visual checkpoint has no compact audit for ${JSON.stringify(cohort)}`);
  }
  return Object.freeze({ cohort });
}

const relativeReviewLink = (reviewRoot, link, label) => {
  if (typeof link !== 'string' || !link.startsWith('file:')) {
    throw new Error(`Visual checkpoint received invalid ${label}`);
  }
  const absolute = fileURLToPath(link);
  const relative = path.relative(reviewRoot, absolute);
  if (relative === '' || relative === '..' || relative.startsWith(`..${path.sep}`)
    || path.isAbsolute(relative)) {
    throw new Error(`Visual checkpoint received ${label} outside its review root`);
  }
  return relative.split(path.sep).join('/');
};

const writeCheckpoint = async (review, cohort, compact, filesystem) => {
  const manifest = {
    schema: 'anifor.visual-checkpoint/v1',
    cohort,
    normal: {
      experimentBoard: relativeReviewLink(
        review.reviewRoot, review.links?.experimentBoard, 'experiment response board',
      ),
      contactSheet: relativeReviewLink(
        review.reviewRoot, review.links?.contactSheet, 'raw contact sheet',
      ),
    },
    compact: {
      label: compact.label,
      detail: 8,
      backend: 'webgl',
      runner: compact.argv[0],
      arguments: compact.argv.slice(1),
      passed: true,
    },
  };
  await filesystem.writeFile(
    path.join(review.reviewRoot, 'checkpoint.json'), `${JSON.stringify(manifest, null, 2)}\n`,
    { encoding: 'utf8', flag: 'wx' },
  );
  return manifest;
};

const defaultRunCompactAudit = async ({ argv, cwd, label, signal }) => {
  const child = spawn(process.execPath, argv, {
    cwd,
    detached: true,
    env: process.env,
    signal,
    stdio: 'inherit',
    windowsHide: true,
  });
  let executionError;
  try {
    await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code, exitSignal) => {
        if (code === 0) resolve();
        else reject(new Error(
          `Compact ${label} audit exited ${code ?? `on ${exitSignal}`}`,
        ));
      });
    });
  } catch (error) {
    executionError = error;
  }
  const cleaned = await terminateDetachedProcess(child);
  if (!cleaned) {
    throw new Error(`Compact ${label} audit left a live process group`, {
      ...(executionError === undefined ? {} : { cause: executionError }),
    });
  }
  if (executionError !== undefined) throw executionError;
};

/**
 * Thin coordinator only: the normal review and compact audit retain all capture,
 * verifier, renderer, and browser ownership. The manifest is local convenience
 * metadata, not portable package evidence or a promotion input.
 */
export async function runVisualCheckpoint(argv, runtime = {}) {
  const parsed = parseVisualCheckpointArguments(argv);
  const stdout = runtime.stdout ?? process.stdout;
  if (parsed.help) {
    stdout.write(`${HELP}\n`);
    return Object.freeze({ help: true });
  }
  const repositoryRoot = path.resolve(runtime.repositoryRoot ?? REPOSITORY_ROOT);
  const compact = VISUAL_CHECKPOINTS[parsed.cohort];
  const stderr = runtime.stderr ?? process.stderr;
  let review;
  try {
    review = await (runtime.runDeveloperReview ?? runVisualLabDeveloperReview)([
      `--cohort=${parsed.cohort}`,
    ], {
      repositoryRoot,
      stdout,
      stderr,
      ...(runtime.signal === undefined ? {} : { signal: runtime.signal }),
      ...(runtime.reviewRuntime ?? {}),
    });
    if (review?.ok !== true || typeof review.reviewRoot !== 'string') {
      throw new Error('Visual checkpoint normal review did not report a retained root');
    }
    stdout.write(`Compact audit: ${compact.label}\n`);
    const compactResult = await (runtime.runCompactAudit ?? defaultRunCompactAudit)({
      argv: compact.argv,
      cwd: repositoryRoot,
      cohort: parsed.cohort,
      label: compact.label,
      ...(runtime.signal === undefined ? {} : { signal: runtime.signal }),
    });
    if (compactResult?.stdout) stdout.write(compactResult.stdout);
    if (compactResult?.stderr) stderr.write(compactResult.stderr);
    const manifest = await writeCheckpoint(
      review, parsed.cohort, compact, runtime.filesystem ?? { writeFile },
    );
    const checkpointPath = path.join(review.reviewRoot, 'checkpoint.json');
    const checkpointLink = pathToFileURL(checkpointPath).href;
    stdout.write(`Visual checkpoint: ${checkpointLink}\n`);
    return Object.freeze({
      ok: true, cohort: parsed.cohort, review, manifest, checkpointLink,
    });
  } catch (error) {
    if (review?.reviewRoot) {
      stderr.write(`Visual checkpoint failed; normal evidence retained at: ${review.reviewRoot}\n`);
    }
    throw error;
  }
}

export async function runVisualCheckpointCli(runtime = {}) {
  const controller = new AbortController();
  const signalTarget = runtime.signalTarget ?? process;
  let interruptedExitCode;
  const interrupt = (exitCode) => {
    interruptedExitCode ??= exitCode;
    controller.abort(new Error('Visual checkpoint interrupted'));
  };
  const onSigint = () => interrupt(130);
  const onSigterm = () => interrupt(143);
  signalTarget.once('SIGINT', onSigint);
  signalTarget.once('SIGTERM', onSigterm);
  try {
    await runVisualCheckpoint(runtime.argv ?? process.argv.slice(2), {
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
  process.exitCode = await runVisualCheckpointCli();
}
