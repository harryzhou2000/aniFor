import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import {
  parseVisualCheckpointArguments,
  runVisualCheckpoint,
} from './visual-lab-checkpoint.mjs';

const temporaryDirectories = [];
afterEach(async () => Promise.all(temporaryDirectories.splice(0).map((directory) => (
  rm(directory, { recursive: true, force: true })
))));

describe('Visual checkpoint', () => {
  it('accepts only a closed cohort selector', () => {
    expect(() => parseVisualCheckpointArguments([])).toThrow('exactly one');
    expect(() => parseVisualCheckpointArguments(['--cohort=unknown']))
      .toThrow('no compact audit');
    expect(parseVisualCheckpointArguments(['--cohort=atmosphere']))
      .toEqual({ cohort: 'atmosphere' });
    expect(() => parseVisualCheckpointArguments(['--help', '--cohort=atmosphere']))
      .toThrow('cannot be combined');
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
