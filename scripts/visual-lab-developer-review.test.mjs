import { EventEmitter } from 'node:events';
import { access, lstat, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import {
  parseVisualLabDeveloperReviewArguments,
  runVisualLabDeveloperReview,
  runVisualLabDeveloperReviewCli,
} from './visual-lab-developer-review.mjs';

const temporaryDirectories = [];
const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    rm(directory, { recursive: true, force: true })
  )));
});

const temporaryRepository = async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'visual-lab-developer-review-test-'));
  temporaryDirectories.push(directory);
  return directory;
};

const captureStream = () => {
  let value = '';
  return {
    write(chunk) { value += String(chunk); },
    read() { return value; },
  };
};

const successfulReview = async (reviewRoot, { regions = true } = {}) => {
  const comparisonRoot = path.join(reviewRoot, 'comparison');
  await mkdir(comparisonRoot, { recursive: true });
  await Promise.all([
    writeFile(path.join(reviewRoot, 'index.html'), 'captures'),
    writeFile(path.join(reviewRoot, 'experiment-board.html'), 'experiment'),
    ...(regions ? [
      writeFile(path.join(reviewRoot, 'region-appearance.html'), 'appearance'),
      writeFile(path.join(reviewRoot, 'region-response.html'), 'response'),
    ] : []),
    writeFile(path.join(comparisonRoot, 'experiment-board.html'), 'experiment'),
    writeFile(path.join(comparisonRoot, 'review-board.html'), 'board'),
    writeFile(path.join(comparisonRoot, 'review-brief.html'), 'brief'),
  ]);
  return {
    ok: true,
    batch: {
      contactSheet: path.join(reviewRoot, 'index.html'),
      experimentBoard: path.join(reviewRoot, 'experiment-board.html'),
      ...(regions ? {
        regionAppearanceBoard: path.join(reviewRoot, 'region-appearance.html'),
        regionResponseBoard: path.join(reviewRoot, 'region-response.html'),
      } : {}),
    },
    comparison: null,
  };
};

describe('Visual Lab developer review arguments', () => {
  it('requires exactly one selection form before reserving evidence', () => {
    const context = { repositoryRoot: '/workspace/anifor', platform: 'linux' };
    expect(() => parseVisualLabDeveloperReviewArguments([], context))
      .toThrow('exactly one');
    expect(() => parseVisualLabDeveloperReviewArguments([
      '--candidate=water-motion', '--recipe-set=visual-lab/recipe-sets/liquid-motion.json',
    ], context)).toThrow('exactly one');
    expect(() => parseVisualLabDeveloperReviewArguments([
      '--source=render-optics', '--cohort=material-optics',
    ], context)).toThrow('exactly one');
    expect(() => parseVisualLabDeveloperReviewArguments([
      '--candidates=water-motion,oil-motion',
    ], context)).toThrow('tracked --recipe-set');
    expect(() => parseVisualLabDeveloperReviewArguments([
      '--candidate=water-motion', '--output-dir=/tmp/reused',
    ], context)).toThrow('owned');
    expect(() => parseVisualLabDeveloperReviewArguments([
      '--candidate=water-motion,oil-motion',
    ], context)).toThrow('exactly one recipe name');
  });

  it('resolves a manifest authoring source without requiring a tracked cohort', () => {
    const repositoryRoot = '/workspace/anifor';
    const parsed = parseVisualLabDeveloperReviewArguments(
      ['--source=render-optics'], { repositoryRoot, platform: 'linux' },
    );
    expect(parsed).toMatchObject({
      sourceName: 'render-optics',
      candidates: ['render-optics-material-lighting-atlas'],
      bundle: path.join(repositoryRoot, 'dist', 'index.html'),
      browserHost: 'shared',
    });
    expect(parsed).not.toHaveProperty('recipeSetPath');
    expect(() => parseVisualLabDeveloperReviewArguments(
      ['--source=missing-source'], { repositoryRoot, platform: 'linux' },
    )).toThrow('Unknown Visual Lab recipe authoring source');
  });

  it('normalizes a singular recipe and supplies deterministic developer defaults', () => {
    const repositoryRoot = '/workspace/anifor';
    const parsed = parseVisualLabDeveloperReviewArguments(
      ['--candidate=water-motion'], { repositoryRoot, platform: 'linux' },
    );
    expect(parsed).toMatchObject({
      candidates: ['water-motion'],
      bundle: path.join(repositoryRoot, 'dist', 'index.html'),
      gpu: 'swiftshader',
      captureProof: 'fixture-activation-render-field-generation-and-selection-owned-alpha-readback',
      browserHost: 'shared',
    });
    expect(parseVisualLabDeveloperReviewArguments([
      '--recipe-set=visual-lab/recipe-sets/liquid-motion.json',
    ], { repositoryRoot, platform: 'darwin' })).toMatchObject({
      recipeSetPath: path.join(repositoryRoot, 'visual-lab', 'recipe-sets', 'liquid-motion.json'),
      browserHost: 'fresh',
    });

    expect(parseVisualLabDeveloperReviewArguments([
      '--cohort=liquid-motion',
    ], { repositoryRoot, platform: 'linux' })).toMatchObject({
      cohortName: 'liquid-motion',
      recipeSetPath: path.join(repositoryRoot, 'visual-lab', 'recipe-sets', 'liquid-motion.json'),
    });
    expect(parseVisualLabDeveloperReviewArguments([
      '--candidate=water-motion', '--capture-proof=stable-snapshots',
    ], { repositoryRoot, platform: 'linux' })).toMatchObject({
      captureProof: 'stable-snapshots',
    });
    expect(() => parseVisualLabDeveloperReviewArguments([
      '--cohort=liquid_motion',
    ], { repositoryRoot, platform: 'linux' })).toThrow('safe kebab-case');
  });
});

describe('Visual Lab developer review execution', () => {
  it('reserves a unique contained root, delegates once, and links verified static artifacts', async () => {
    const repositoryRoot = await temporaryRepository();
    const stdout = captureStream();
    const stderr = captureStream();
    const calls = [];
    const outcome = await runVisualLabDeveloperReview(['--candidate=water-motion'], {
      repositoryRoot,
      platform: 'linux',
      randomUUID: () => UUID_A,
      stdout,
      stderr,
      runReviewCycle: async (options) => {
        calls.push(options);
        return successfulReview(options.outputDir);
      },
    });

    const expectedRoot = path.join(
      repositoryRoot, '.artifacts', 'visual-lab-reviews', `water-motion-${UUID_A}`,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      candidates: ['water-motion'],
      outputDir: expectedRoot,
      bundle: path.join(repositoryRoot, 'dist', 'index.html'),
      gpu: 'swiftshader',
      captureProof: 'fixture-activation-render-field-generation-and-selection-owned-alpha-readback',
      browserHost: 'shared',
    });
    expect((await lstat(expectedRoot)).isDirectory()).toBe(true);
    expect(outcome.reviewRoot).toBe(expectedRoot);
    expect(stdout.read().split('\n')).toEqual([
      `Visual Lab review root: ${expectedRoot}`,
      `Experiment response: ${pathToFileURL(path.join(expectedRoot, 'experiment-board.html')).href}`,
      `Region appearance: ${pathToFileURL(path.join(expectedRoot, 'region-appearance.html')).href}`,
      `Region response: ${pathToFileURL(path.join(expectedRoot, 'region-response.html')).href}`,
      `Raw captures: ${pathToFileURL(path.join(expectedRoot, 'index.html')).href}`,
      '',
    ]);
    expect(stderr.read()).toBe('');
  });

  it('never reuses or deletes an earlier review root', async () => {
    const repositoryRoot = await temporaryRepository();
    const uuids = [UUID_A, UUID_B];
    const runtime = {
      repositoryRoot,
      randomUUID: () => uuids.shift(),
      stdout: captureStream(),
      stderr: captureStream(),
      runReviewCycle: async (options) => successfulReview(options.outputDir),
    };
    const first = await runVisualLabDeveloperReview(['--candidate=water-motion'], runtime);
    const marker = path.join(first.reviewRoot, 'developer-note.txt');
    await writeFile(marker, 'retain me');
    const second = await runVisualLabDeveloperReview(['--candidate=water-motion'], runtime);

    expect(second.reviewRoot).not.toBe(first.reviewRoot);
    expect(await readFile(marker, 'utf8')).toBe('retain me');
  });

  it('delegates a direct authoring source as its canonical candidate set', async () => {
    const repositoryRoot = await temporaryRepository();
    let cycleOptions;
    const outcome = await runVisualLabDeveloperReview(['--source=render-optics'], {
      repositoryRoot,
      randomUUID: () => UUID_A,
      stdout: captureStream(),
      stderr: captureStream(),
      runReviewCycle: async (options) => {
        cycleOptions = options;
        return successfulReview(options.outputDir);
      },
    });
    expect(cycleOptions).toMatchObject({
      candidates: ['render-optics-material-lighting-atlas'],
    });
    expect(cycleOptions).not.toHaveProperty('sourceName');
    expect(cycleOptions).not.toHaveProperty('recipeSetPath');
    expect(path.basename(outcome.reviewRoot)).toBe(`render-optics-${UUID_A}`);
  });

  it('requires recipe sets to be tracked before reserving evidence', async () => {
    const repositoryRoot = await temporaryRepository();
    const recipeSet = path.join(repositoryRoot, 'untracked.json');
    await writeFile(recipeSet, '{}');
    let captureCalls = 0;
    await expect(runVisualLabDeveloperReview([`--recipe-set=${recipeSet}`], {
      repositoryRoot,
      stdout: captureStream(),
      stderr: captureStream(),
      runReviewCycle: async () => { captureCalls++; },
    })).rejects.toThrow('tracked repository file');
    expect(captureCalls).toBe(0);
    await expect(lstat(path.join(repositoryRoot, '.artifacts')))
      .rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('forwards an explicitly validated tracked recipe set to the trusted cycle', async () => {
    const repositoryRoot = await temporaryRepository();
    const expectedRecipeSet = path.join(
      repositoryRoot, 'visual-lab', 'recipe-sets', 'liquid-motion.json',
    );
    const trackedCalls = [];
    let cycleOptions;
    const result = await runVisualLabDeveloperReview([
      '--recipe-set=visual-lab/recipe-sets/liquid-motion.json',
    ], {
      repositoryRoot,
      randomUUID: () => UUID_A,
      stdout: captureStream(),
      stderr: captureStream(),
      assertTrackedRecipeSet: async (...argumentsList) => trackedCalls.push(argumentsList),
      runReviewCycle: async (options) => {
        cycleOptions = options;
        return successfulReview(options.outputDir);
      },
    });
    expect(trackedCalls).toEqual([[expectedRecipeSet, repositoryRoot]]);
    expect(cycleOptions.recipeSetPath).toBe(expectedRecipeSet);
    expect(result).toMatchObject({ ok: true });
  });

  it('resolves a cohort through the declarative catalog before validating its tracked snapshot', async () => {
    const repositoryRoot = await temporaryRepository();
    const expectedRecipeSet = path.join(
      repositoryRoot, 'visual-lab', 'recipe-sets', 'liquid-motion.json',
    );
    const resolverCalls = [];
    const trackedCalls = [];
    let cycleOptions;
    await runVisualLabDeveloperReview(['--cohort=liquid-motion'], {
      repositoryRoot,
      randomUUID: () => UUID_A,
      stdout: captureStream(),
      stderr: captureStream(),
      resolveCohort: async (...argumentsList) => {
        resolverCalls.push(argumentsList);
        return {
          name: 'liquid-motion', snapshotPath: expectedRecipeSet,
          recipeSet: { id: 'sha256:cohort' },
        };
      },
      readRecipeSet: async () => ({ name: 'liquid-motion', id: 'sha256:cohort' }),
      assertTrackedRecipeSet: async (...argumentsList) => trackedCalls.push(argumentsList),
      runReviewCycle: async (options) => {
        cycleOptions = options;
        return successfulReview(options.outputDir);
      },
    });
    expect(resolverCalls).toEqual([[
      'liquid-motion',
      {
        catalogPath: path.join(repositoryRoot, 'visual-lab', 'cohorts.json'),
        outputDirectory: path.join(repositoryRoot, 'visual-lab', 'recipe-sets'),
      },
    ]]);
    expect(trackedCalls).toEqual([[expectedRecipeSet, repositoryRoot]]);
    expect(cycleOptions).toMatchObject({ recipeSetPath: expectedRecipeSet });
    expect(cycleOptions).not.toHaveProperty('cohortName');
  });

  it('rejects a stale declarative cohort snapshot before reserving evidence', async () => {
    const repositoryRoot = await temporaryRepository();
    const expectedRecipeSet = path.join(
      repositoryRoot, 'visual-lab', 'recipe-sets', 'liquid-motion.json',
    );
    await expect(runVisualLabDeveloperReview(['--cohort=liquid-motion'], {
      repositoryRoot,
      stdout: captureStream(),
      stderr: captureStream(),
      resolveCohort: async () => ({
        name: 'liquid-motion', snapshotPath: expectedRecipeSet,
        recipeSet: { id: 'sha256:catalog' },
      }),
      assertTrackedRecipeSet: async () => {},
      readRecipeSet: async () => ({ name: 'liquid-motion', id: 'sha256:stale' }),
    })).rejects.toThrow('cohort snapshot is stale');
    await expect(access(path.join(repositoryRoot, '.artifacts')))
      .rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('prints explicit legacy comparison links after the current experiment response', async () => {
    const repositoryRoot = await temporaryRepository();
    const stdout = captureStream();
    await runVisualLabDeveloperReview([
      '--candidate=water-motion', '--baseline-root=visual-baselines/accepted-v1',
    ], {
      repositoryRoot,
      randomUUID: () => UUID_A,
      stdout,
      stderr: captureStream(),
      runReviewCycle: async (options) => {
        const result = await successfulReview(options.outputDir);
        result.comparison = {
          board: path.join(options.outputDir, 'comparison', 'review-board.html'),
          brief: path.join(options.outputDir, 'comparison', 'review-brief.html'),
        };
        return result;
      },
    });
    const root = path.join(repositoryRoot, '.artifacts', 'visual-lab-reviews', `water-motion-${UUID_A}`);
    expect(stdout.read().split('\n')).toEqual([
      `Visual Lab review root: ${root}`,
      `Experiment response: ${pathToFileURL(path.join(root, 'experiment-board.html')).href}`,
      `Region appearance: ${pathToFileURL(path.join(root, 'region-appearance.html')).href}`,
      `Region response: ${pathToFileURL(path.join(root, 'region-response.html')).href}`,
      `Review board: ${pathToFileURL(path.join(root, 'comparison', 'review-board.html')).href}`,
      `Compact brief: ${pathToFileURL(path.join(root, 'comparison', 'review-brief.html')).href}`,
      `Raw captures: ${pathToFileURL(path.join(root, 'index.html')).href}`,
      '',
    ]);
  });

  it('keeps regionless reviews usable without inventing optional artifact links', async () => {
    const repositoryRoot = await temporaryRepository();
    const stdout = captureStream();
    const outcome = await runVisualLabDeveloperReview(['--candidate=water-motion'], {
      repositoryRoot,
      randomUUID: () => UUID_A,
      stdout,
      stderr: captureStream(),
      runReviewCycle: async (options) => successfulReview(options.outputDir, { regions: false }),
    });
    expect(outcome.links).not.toHaveProperty('regionAppearanceBoard');
    expect(outcome.links).not.toHaveProperty('regionResponseBoard');
    expect(stdout.read()).not.toContain('Region appearance:');
    expect(stdout.read()).not.toContain('Region response:');
  });

  it('reports a retained root on failure without emitting artifact URLs', async () => {
    const repositoryRoot = await temporaryRepository();
    const stdout = captureStream();
    const stderr = captureStream();
    await expect(runVisualLabDeveloperReview(['--candidate=water-motion'], {
      repositoryRoot,
      randomUUID: () => UUID_A,
      stdout,
      stderr,
      runReviewCycle: async () => { throw new Error('capture failed'); },
    })).rejects.toThrow('capture failed');

    const reviewRoot = path.join(
      repositoryRoot, '.artifacts', 'visual-lab-reviews', `water-motion-${UUID_A}`,
    );
    expect((await lstat(reviewRoot)).isDirectory()).toBe(true);
    expect(stdout.read()).toBe(`Visual Lab review root: ${reviewRoot}\n`);
    expect(stdout.read()).not.toContain('file:');
    expect(stderr.read()).toBe(
      `Visual Lab review failed; evidence retained at: ${reviewRoot}\n`,
    );
  });

  it('keeps CLI errors injectable and returns a failing exit code without capture', async () => {
    const repositoryRoot = await temporaryRepository();
    const stdout = captureStream();
    const stderr = captureStream();
    let captureCalls = 0;
    const exitCode = await runVisualLabDeveloperReviewCli({
      argv: [], repositoryRoot, stdout, stderr,
      runReviewCycle: async () => { captureCalls++; },
    });
    expect(exitCode).toBe(1);
    expect(captureCalls).toBe(0);
    expect(stdout.read()).toBe('');
    expect(stderr.read()).toContain('requires exactly one');
    expect(stderr.read()).not.toContain('file:');
  });

  it('propagates SIGINT through the review signal and returns the shell interrupt code', async () => {
    const repositoryRoot = await temporaryRepository();
    const signalTarget = new EventEmitter();
    const stderr = captureStream();
    let observedSignal;
    const exitCode = await runVisualLabDeveloperReviewCli({
      argv: ['--candidate=water-motion'],
      repositoryRoot,
      randomUUID: () => UUID_A,
      stdout: captureStream(),
      stderr,
      signalTarget,
      runReviewCycle: async (options) => {
        observedSignal = options.signal;
        signalTarget.emit('SIGINT');
        throw options.signal.reason;
      },
    });
    expect(observedSignal.aborted).toBe(true);
    expect(exitCode).toBe(130);
    expect(stderr.read()).toContain('evidence retained at');
    expect(signalTarget.listenerCount('SIGINT')).toBe(0);
    expect(signalTarget.listenerCount('SIGTERM')).toBe(0);
  });

  it('rejects success links that escape the reserved evidence root', async () => {
    const repositoryRoot = await temporaryRepository();
    const outside = path.join(repositoryRoot, 'outside.html');
    await writeFile(outside, 'outside');
    await expect(runVisualLabDeveloperReview(['--candidate=water-motion'], {
      repositoryRoot,
      randomUUID: () => UUID_A,
      stdout: captureStream(),
      stderr: captureStream(),
      runReviewCycle: async (options) => {
        const result = await successfulReview(options.outputDir);
        result.comparison = {
          board: outside,
          brief: path.join(options.outputDir, 'comparison', 'review-brief.html'),
        };
        return result;
      },
    })).rejects.toThrow('outside its evidence root');
  });

  it('applies the same containment checks to optional current review artifacts', async () => {
    const repositoryRoot = await temporaryRepository();
    const outside = path.join(repositoryRoot, 'outside.html');
    await writeFile(outside, 'outside');
    await expect(runVisualLabDeveloperReview(['--candidate=water-motion'], {
      repositoryRoot,
      randomUUID: () => UUID_A,
      stdout: captureStream(),
      stderr: captureStream(),
      runReviewCycle: async (options) => {
        const result = await successfulReview(options.outputDir);
        result.batch.regionAppearanceBoard = outside;
        return result;
      },
    })).rejects.toThrow('region appearance board outside its evidence root');
  });
});
