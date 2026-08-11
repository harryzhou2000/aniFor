import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import {
  parseVisualCheckpointArguments,
  resolveVisualCheckpointProfile,
  runVisualCheckpoint,
} from './visual-lab-checkpoint.mjs';

const temporaryDirectories = [];
afterEach(async () => Promise.all(temporaryDirectories.splice(0).map((directory) => (
  rm(directory, { recursive: true, force: true })
))));

describe('Visual checkpoint', () => {
  it('accepts only a safe cohort selector', () => {
    expect(() => parseVisualCheckpointArguments([])).toThrow('exactly one');
    expect(parseVisualCheckpointArguments(['--cohort=future-gas']))
      .toEqual({ cohort: 'future-gas' });
    expect(() => parseVisualCheckpointArguments(['--cohort=Unsafe_Name']))
      .toThrow('safe kebab-case');
    expect(parseVisualCheckpointArguments(['--cohort=atmosphere']))
      .toEqual({ cohort: 'atmosphere' });
    expect(parseVisualCheckpointArguments(['--cohort=material-lighting']))
      .toEqual({ cohort: 'material-lighting' });
    expect(parseVisualCheckpointArguments([
      '--cohort=atmosphere', '--canvas-companion=1',
    ])).toEqual({ cohort: 'atmosphere', canvasCompanion: true });
    expect(parseVisualCheckpointArguments([
      '--canvas-companion=0', '--cohort=atmosphere',
    ])).toEqual({ cohort: 'atmosphere', canvasCompanion: false });
    expect(() => parseVisualCheckpointArguments([
      '--cohort=atmosphere', '--canvas-companion=yes',
    ])).toThrow('must be 0 or 1');
    expect(() => parseVisualCheckpointArguments(['--help', '--cohort=atmosphere']))
      .toThrow('cannot be combined');
  });

  it('derives compact routing from a validated single-domain cohort', () => {
    const resolved = resolveVisualCheckpointProfile({
      name: 'future-gas',
      recipeSet: { recipes: [{ domain: 'gas' }, { domain: 'gas' }] },
    });
    expect(resolved).toMatchObject({ cohort: 'future-gas', domain: 'gas' });
    expect(resolved.compact).toMatchObject({
      label: 'true-8x gas identity',
      evidenceRelationship: 'same-gas-identity-family',
    });
    expect(() => resolveVisualCheckpointProfile({
      name: 'mixed',
      recipeSet: { recipes: [{ domain: 'gas' }, { domain: 'liquid' }] },
    })).toThrow('spans 2 domains');
    expect(() => resolveVisualCheckpointProfile({
      name: 'future', recipeSet: { recipes: [{ domain: 'future-domain' }] },
    })).toThrow('no compact audit capability');
  });

  it('rejects a multi-domain cohort before normal review starts', async () => {
    let reviewed = false;
    await expect(runVisualCheckpoint(['--cohort=material-optics'], {
      runDeveloperReview: async () => { reviewed = true; },
      stdout: { write() {} }, stderr: { write() {} },
    })).rejects.toThrow('spans 3 domains');
    expect(reviewed).toBe(false);
  });

  it('labels material-lighting 8x evidence as inactive-profile compatibility', async () => {
    const repositoryRoot = await mkdtemp(path.join(tmpdir(), 'visual-checkpoint-test-'));
    temporaryDirectories.push(repositoryRoot);
    const reviewRoot = path.join(repositoryRoot, 'review');
    await mkdir(reviewRoot);
    await Promise.all([
      writeFile(path.join(reviewRoot, 'experiment-board.html'), 'experiment'),
      writeFile(path.join(reviewRoot, 'index.html'), 'captures'),
    ]);
    let compactOptions;
    const result = await runVisualCheckpoint(['--cohort=material-lighting'], {
      repositoryRoot,
      runDeveloperReview: async () => ({
        ok: true,
        reviewRoot,
        links: {
          experimentBoard: pathToFileURL(path.join(reviewRoot, 'experiment-board.html')).href,
          contactSheet: pathToFileURL(path.join(reviewRoot, 'index.html')).href,
        },
      }),
      runCompactAudit: async (options) => { compactOptions = options; },
      stdout: { write() {} }, stderr: { write() {} },
    });
    expect(compactOptions.argv).toEqual([
      'scripts/verify-browser-input.mjs', '--eight-material-atlas-only',
      '--production-bundle',
    ]);
    expect(result.manifest.compact).toMatchObject({
      label: 'true-8x 217-material atlas',
      evidenceRelationship: 'profile-inactive-compact-compatibility',
      detail: 8,
      backend: 'webgl',
      passed: true,
    });
  });

  it('adds an opt-in noncanonical Canvas companion after canonical compact success', async () => {
    const repositoryRoot = await mkdtemp(path.join(tmpdir(), 'visual-checkpoint-test-'));
    temporaryDirectories.push(repositoryRoot);
    const reviewRoot = path.join(repositoryRoot, 'review');
    const canvasRoot = path.join(reviewRoot, 'canvas-companion');
    await mkdir(reviewRoot);
    await Promise.all([
      writeFile(path.join(reviewRoot, 'experiment-board.html'), 'experiment'),
      writeFile(path.join(reviewRoot, 'index.html'), 'captures'),
      writeFile(path.join(reviewRoot, 'recipe-set.json'), '{}'),
      mkdir(canvasRoot),
    ]);
    await Promise.all([
      writeFile(path.join(canvasRoot, 'index.html'), 'canvas'),
      writeFile(path.join(canvasRoot, 'canvas-companion.json'), '{}'),
    ]);
    const calls = [];
    const result = await runVisualCheckpoint([
      '--cohort=atmosphere', '--canvas-companion=1',
    ], {
      repositoryRoot,
      runDeveloperReview: async () => ({
        ok: true,
        reviewRoot,
        links: {
          experimentBoard: pathToFileURL(path.join(reviewRoot, 'experiment-board.html')).href,
          contactSheet: pathToFileURL(path.join(reviewRoot, 'index.html')).href,
        },
        result: { recipeSet: { path: path.join(reviewRoot, 'recipe-set.json') } },
      }),
      runCompactAudit: async () => { calls.push('compact'); },
      runCanvasCompanion: async (options) => {
        calls.push('canvas');
        expect(options.recipeSetPath).toBe(path.join(reviewRoot, 'recipe-set.json'));
        expect(options.reviewRoot).toBe(reviewRoot);
        return {
          ok: true,
          index: path.join(canvasRoot, 'index.html'),
          receipt: path.join(canvasRoot, 'canvas-companion.json'),
        };
      },
      stdout: { write() {} }, stderr: { write() {} },
    });
    expect(calls).toEqual(['compact', 'canvas']);
    expect(result.manifest.canvas).toEqual({
      requested: true,
      passed: true,
      canonical: false,
      comparison: 'none',
      selection: 'baseline-only',
      index: 'canvas-companion/index.html',
      receipt: 'canvas-companion/canvas-companion.json',
    });
  });

  it('records Canvas companion failure without failing the canonical checkpoint', async () => {
    const repositoryRoot = await mkdtemp(path.join(tmpdir(), 'visual-checkpoint-test-'));
    temporaryDirectories.push(repositoryRoot);
    const reviewRoot = path.join(repositoryRoot, 'review');
    await mkdir(reviewRoot);
    await Promise.all([
      writeFile(path.join(reviewRoot, 'experiment-board.html'), 'experiment'),
      writeFile(path.join(reviewRoot, 'index.html'), 'captures'),
      writeFile(path.join(reviewRoot, 'recipe-set.json'), '{}'),
    ]);
    const result = await runVisualCheckpoint([
      '--cohort=powder-style', '--canvas-companion=1',
    ], {
      repositoryRoot,
      runDeveloperReview: async () => ({
        ok: true,
        reviewRoot,
        links: {
          experimentBoard: pathToFileURL(path.join(reviewRoot, 'experiment-board.html')).href,
          contactSheet: pathToFileURL(path.join(reviewRoot, 'index.html')).href,
        },
        result: { recipeSet: { path: path.join(reviewRoot, 'recipe-set.json') } },
      }),
      runCompactAudit: async () => {},
      runCanvasCompanion: async () => { throw new Error('fallback unavailable'); },
      stdout: { write() {} }, stderr: { write() {} },
    });
    expect(result.ok).toBe(true);
    expect(result.manifest.canvas).toMatchObject({
      requested: true, passed: false, canonical: false, error: 'fallback unavailable',
    });
  });

  it('runs the trusted normal review before its existing compact audit and writes local links only after success', async () => {
    const repositoryRoot = await mkdtemp(path.join(tmpdir(), 'visual-checkpoint-test-'));
    temporaryDirectories.push(repositoryRoot);
    const reviewRoot = path.join(repositoryRoot, 'review');
    await mkdir(reviewRoot);
    await Promise.all([
      writeFile(path.join(reviewRoot, 'experiment-board.html'), 'experiment'),
      writeFile(path.join(reviewRoot, 'index.html'), 'captures'),
    ]);
    const calls = [];
    const result = await runVisualCheckpoint(['--cohort=liquid-motion'], {
      repositoryRoot,
      runDeveloperReview: async (argv, options) => {
        calls.push({ kind: 'review', argv, options });
        return {
          ok: true,
          reviewRoot,
          links: {
            experimentBoard: pathToFileURL(path.join(reviewRoot, 'experiment-board.html')).href,
            contactSheet: pathToFileURL(path.join(reviewRoot, 'index.html')).href,
          },
        };
      },
      runCompactAudit: async (options) => {
        calls.push({ kind: 'compact', options });
        await expect(readFile(path.join(reviewRoot, 'checkpoint.json'), 'utf8'))
          .rejects.toMatchObject({ code: 'ENOENT' });
        return { stdout: 'compact ok\n', stderr: '' };
      },
      stdout: { write() {} },
      stderr: { write() {} },
    });
    expect(calls.map(({ kind }) => kind)).toEqual(['review', 'compact']);
    expect(calls[0].argv).toEqual(['--cohort=liquid-motion']);
    expect(calls[1].options.argv).toEqual([
      'scripts/verify-browser-input.mjs', '--distilled-diesel-liquid-graphics-only',
      '--render-scale=8', '--webgl-only', '--production-bundle',
    ]);
    expect(result.manifest.compact).toMatchObject({
      detail: 8, backend: 'webgl', passed: true,
    });
    expect(JSON.parse(await readFile(path.join(reviewRoot, 'checkpoint.json'), 'utf8')))
      .toMatchObject({
        cohort: 'liquid-motion',
        normal: { experimentBoard: 'experiment-board.html', contactSheet: 'index.html' },
        compact: { passed: true },
      });
    expect(result.checkpointLink).toBe(
      pathToFileURL(path.join(reviewRoot, 'checkpoint.json')).href,
    );
  });

  it('retains normal evidence but does not write a checkpoint when the compact audit fails', async () => {
    const repositoryRoot = await mkdtemp(path.join(tmpdir(), 'visual-checkpoint-test-'));
    temporaryDirectories.push(repositoryRoot);
    const reviewRoot = path.join(repositoryRoot, 'review');
    await mkdir(reviewRoot);
    await Promise.all([
      writeFile(path.join(reviewRoot, 'experiment-board.html'), 'experiment'),
      writeFile(path.join(reviewRoot, 'index.html'), 'captures'),
    ]);
    let errorOutput = '';
    await expect(runVisualCheckpoint(['--cohort=powder-style'], {
      repositoryRoot,
      runDeveloperReview: async () => ({
        ok: true,
        reviewRoot,
        links: {
          experimentBoard: pathToFileURL(path.join(reviewRoot, 'experiment-board.html')).href,
          contactSheet: pathToFileURL(path.join(reviewRoot, 'index.html')).href,
        },
      }),
      runCompactAudit: async () => { throw new Error('compact failed'); },
      stdout: { write() {} }, stderr: { write(chunk) { errorOutput += String(chunk); } },
    })).rejects.toThrow('compact failed');
    await expect(readFile(path.join(reviewRoot, 'checkpoint.json'), 'utf8'))
      .rejects.toMatchObject({ code: 'ENOENT' });
    expect(errorOutput).toContain(`normal evidence retained at: ${reviewRoot}`);
  });

  it('rejects a normal-review link outside the unique evidence root', async () => {
    const repositoryRoot = await mkdtemp(path.join(tmpdir(), 'visual-checkpoint-test-'));
    temporaryDirectories.push(repositoryRoot);
    const reviewRoot = path.join(repositoryRoot, 'review');
    await mkdir(reviewRoot);
    await expect(runVisualCheckpoint(['--cohort=atmosphere'], {
      repositoryRoot,
      runDeveloperReview: async () => ({
        ok: true,
        reviewRoot,
        links: {
          experimentBoard: pathToFileURL(path.join(repositoryRoot, 'outside.html')).href,
          contactSheet: pathToFileURL(path.join(reviewRoot, 'index.html')).href,
        },
      }),
      runCompactAudit: async () => {},
      stdout: { write() {} }, stderr: { write() {} },
    })).rejects.toThrow('outside its review root');
  });
});
