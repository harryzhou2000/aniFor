import { createHash } from 'node:crypto';
import fsPromises from 'node:fs/promises';
import {
  mkdir, mkdtemp, readFile, rm, symlink, writeFile,
} from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { parseVisualLabBatchArguments } from './visual-lab-batch.mjs';
import {
  createVisualLabRecipeSet,
  normalizeVisualLabRecipeSet,
  parseVisualLabRecipeSet,
  parseVisualLabRecipeSetArguments,
  readVisualLabRecipeSet,
  VISUAL_LAB_RECIPE_SET_MAX_BYTES,
  VISUAL_LAB_RECIPE_SET_SCHEMA,
} from './visual-lab-recipe-set.mjs';

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    rm(directory, { recursive: true, force: true })
  )));
});

const temporaryDirectory = async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'visual-lab-recipe-set-test-'));
  temporaryDirectories.push(directory);
  return directory;
};

const recipeSetId = (recipeSet) => {
  const { id: _id, ...identity } = recipeSet;
  return `sha256:${createHash('sha256').update(JSON.stringify(identity), 'utf8').digest('hex')}`;
};

/** Interposes synchronously at the reader's open call, after its lstat completed. */
const replaceLeafWithSymlinkWhenOpened = async (file, target, operation) => {
  const absolute = path.resolve(file);
  const originalOpen = fsPromises.open;
  let interposed = false;
  fsPromises.open = async (openedPath, ...arguments_) => {
    if (!interposed && path.resolve(openedPath) === absolute) {
      interposed = true;
      await rm(absolute);
      await symlink(target, absolute);
    }
    return originalOpen(openedPath, ...arguments_);
  };
  syncBuiltinESMExports();
  try {
    await expect(operation()).rejects.toThrow(/changed while opening|symbolic link/i);
  } finally {
    fsPromises.open = originalOpen;
    syncBuiltinESMExports();
  }
  expect(interposed).toBe(true);
};

describe('Visual Lab recipe-set/v1', () => {
  it('creates a deterministic, exact, canonical, deeply frozen identity', () => {
    const selected = ['water-motion', 'gas-showcase'];
    const first = createVisualLabRecipeSet('spring-review', selected);
    const second = createVisualLabRecipeSet('spring-review', [...selected].reverse());

    expect(first).toEqual(second);
    expect(first).toMatchObject({ schema: VISUAL_LAB_RECIPE_SET_SCHEMA, name: 'spring-review' });
    expect(first.id).toBe(recipeSetId(first));
    expect(first.recipes.map(({ name }) => name)).toEqual(['gas-showcase', 'water-motion']);
    expect(Reflect.ownKeys(first)).toEqual(['schema', 'id', 'name', 'recipes']);
    expect(Reflect.ownKeys(first.recipes[0])).toEqual([
      'name', 'domain', 'target', 'fixture', 'gain', 'renderScale',
    ]);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.recipes)).toBe(true);
    expect(first.recipes.every(Object.isFrozen)).toBe(true);
    selected[0] = 'oxygen-showcase';
    expect(first.recipes.map(({ name }) => name)).toEqual(['gas-showcase', 'water-motion']);
  });

  it('fails closed for malformed names, selections, fields, and catalog drift', () => {
    expect(() => createVisualLabRecipeSet('Spring Review', ['gas-showcase']))
      .toThrow('safe kebab-case');
    expect(() => createVisualLabRecipeSet('a'.repeat(65), ['gas-showcase']))
      .toThrow('at most 64 characters');
    expect(() => createVisualLabRecipeSet('empty', [])).toThrow('non-empty');
    expect(() => createVisualLabRecipeSet('duplicates', ['gas-showcase', 'gas-showcase']))
      .toThrow('Duplicate');
    expect(() => createVisualLabRecipeSet('unknown', ['not-a-candidate']))
      .toThrow('Unknown Visual Lab capture candidate');

    const valid = createVisualLabRecipeSet('review', ['gas-showcase']);
    expect(() => normalizeVisualLabRecipeSet({ ...valid, note: 'unexpected' }))
      .toThrow('exactly schema, id, name, recipes');
    const stale = JSON.parse(JSON.stringify(valid));
    stale.recipes[0].target = 4;
    expect(() => normalizeVisualLabRecipeSet(stale)).toThrow('does not exactly match');
    stale.id = recipeSetId(stale);
    expect(() => normalizeVisualLabRecipeSet(stale)).toThrow('does not exactly match');
    const reordered = createVisualLabRecipeSet(
      'reordered', ['gas-showcase', 'water-motion'],
    );
    const noncanonical = JSON.parse(JSON.stringify(reordered));
    noncanonical.recipes.reverse();
    noncanonical.id = recipeSetId(noncanonical);
    expect(() => normalizeVisualLabRecipeSet(noncanonical)).toThrow('frozen catalog order');
    expect(() => normalizeVisualLabRecipeSet({ ...valid, id: `sha256:${'0'.repeat(64)}` }))
      .toThrow('identity mismatch');
  });

  it('parses and loads only bounded real recipe-set files', async () => {
    const root = await temporaryDirectory();
    const valid = createVisualLabRecipeSet('portable-review', ['gas-showcase']);
    const source = JSON.stringify(valid);
    const file = path.join(root, 'recipe-set.json');
    await writeFile(file, source);
    await expect(readVisualLabRecipeSet(file)).resolves.toEqual(valid);
    expect(() => parseVisualLabRecipeSet('{')).toThrow('Invalid');
    const duplicateName = source.replace(
      '"name":"portable-review"',
      '"name":"portable-review","na\\u006de":"other-review"',
    );
    expect(() => parseVisualLabRecipeSet(duplicateName)).toThrow('duplicate object member "name"');
    expect(parseVisualLabRecipeSet(source.padEnd(VISUAL_LAB_RECIPE_SET_MAX_BYTES, ' ')))
      .toEqual(valid);
    expect(() => parseVisualLabRecipeSet(' '.repeat(VISUAL_LAB_RECIPE_SET_MAX_BYTES + 1)))
      .toThrow('byte limit');

    await expect(readVisualLabRecipeSet(root)).rejects.toThrow('regular file');
    const linked = path.join(root, 'recipe-set-link.json');
    await symlink(file, linked);
    await expect(readVisualLabRecipeSet(linked)).rejects.toThrow('symbolic link');
    const realAncestor = path.join(root, 'real-ancestor');
    const linkedAncestor = path.join(root, 'linked-ancestor');
    await mkdir(realAncestor);
    await writeFile(path.join(realAncestor, 'set.json'), source);
    await symlink(realAncestor, linkedAncestor, 'dir');
    await expect(readVisualLabRecipeSet(path.join(linkedAncestor, 'set.json')))
      .rejects.toThrow('symbolic-link ancestor');
    await expect(readVisualLabRecipeSet(`${linkedAncestor}/../recipe-set.json`))
      .rejects.toThrow('canonical path without dot segments');
    const oversized = path.join(root, 'oversized.json');
    await writeFile(oversized, ' '.repeat(VISUAL_LAB_RECIPE_SET_MAX_BYTES + 1));
    await expect(readVisualLabRecipeSet(oversized)).rejects.toThrow('byte limit');

    const changed = JSON.parse(source);
    changed.recipes[0].target = 4;
    changed.id = recipeSetId(changed);
    await writeFile(file, `${JSON.stringify(changed)}\n`);
    await expect(readVisualLabRecipeSet(file)).rejects.toThrow('does not exactly match');
  });

  it('rejects a regular recipe-set leaf replaced by a symlink between lstat and open', async () => {
    if (process.platform === 'win32') return;
    const root = await temporaryDirectory();
    const recipeSet = createVisualLabRecipeSet('portable-review', ['gas-showcase']);
    const input = path.join(root, 'recipe-set.json');
    const replacement = path.join(root, 'replacement-recipe-set.json');
    await writeFile(input, `${JSON.stringify(recipeSet)}\n`);
    await writeFile(replacement, `${JSON.stringify(recipeSet)}\n`);

    // The open wrapper is the interposition point: readVisualLabRecipeSet has
    // already lstat'ed recipe-set.json, but has not yet issued its no-follow open.
    await replaceLeafWithSymlinkWhenOpened(
      input,
      replacement,
      () => readVisualLabRecipeSet(input),
    );
    expect(await readFile(replacement)).toStrictEqual(await readFile(input));
  });

  it('keeps checked-in framework cohorts valid and pinned', async () => {
    const expected = new Map([
      ['release', ['gas-showcase', 'oxygen-showcase', 'oil-motion', 'water-motion']],
      ['atmosphere', ['gas-showcase', 'oxygen-showcase']],
      ['liquid-motion', ['oil-motion', 'water-motion']],
    ]);
    for (const [name, candidates] of expected) {
      const file = fileURLToPath(new URL(
        `../visual-lab/recipe-sets/${name}.json`, import.meta.url,
      ));
      const recipeSet = await readVisualLabRecipeSet(file);
      expect(recipeSet.name).toBe(name);
      expect(recipeSet.recipes.map((recipe) => recipe.name)).toEqual(candidates);
      expect(recipeSet.id).toBe(recipeSetId(recipeSet));
      if (name === 'release') {
        expect(recipeSet.id).toBe(
          'sha256:28b2d27f44c54ba5de933addbbc1c99358428a79b2ed8da05df9c7c121fec463',
        );
      }
    }
  });

  it('keeps create/verify CLI shapes strict and recipe-set batch selection exclusive', () => {
    expect(parseVisualLabRecipeSetArguments([
      'create', '--name=review-set', '--candidates=water-motion,gas-showcase',
    ])).toEqual({
      command: 'create', name: 'review-set', candidates: ['water-motion', 'gas-showcase'],
    });
    expect(parseVisualLabRecipeSetArguments(['verify', '--input=/tmp/review.json']))
      .toEqual({ command: 'verify', input: '/tmp/review.json' });
    expect(() => parseVisualLabRecipeSetArguments(['create', '--name=review', '--name=again']))
      .toThrow('only be provided once');
    expect(() => parseVisualLabRecipeSetArguments(['verify', '--input=']))
      .toThrow('requires --input');

    expect(parseVisualLabBatchArguments(['--recipe-set=/tmp/review.json']))
      .toMatchObject({ candidates: undefined, recipeSetPath: '/tmp/review.json' });
    expect(() => parseVisualLabBatchArguments([
      '--candidates=gas-showcase', '--recipe-set=/tmp/review.json',
    ])).toThrow('mutually exclusive');
  });

  it('keeps manual CI recipe-set selection quoted, gated, and fully cross-checked', async () => {
    const workflow = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
    expect(workflow).toContain('visual_lab_recipe_set:');
    expect(workflow).toContain('VISUAL_LAB_RECIPE_SET: ${{ inputs.visual_lab_recipe_set }}');
    expect(workflow).toContain("github.event_name == 'workflow_dispatch' &&");
    expect(workflow).toContain('inputs.visual_lab_review == true &&');
    expect(workflow).toContain(
      'visual_lab_candidates and visual_lab_recipe_set are mutually exclusive',
    );
    expect(workflow).toContain('git --literal-pathspecs ls-files --error-unmatch');
    expect(workflow).toContain('path.posix.normalize(value) !== value');
    expect(workflow).toContain(
      'visual_lab_recipe_set must be a canonical repository-relative path',
    );
    expect(workflow).toContain('review_args+=("--recipe-set=${VISUAL_LAB_RECIPE_SET}")');
    expect(workflow).toContain('node scripts/visual-lab-batch.mjs "${review_args[@]}"');
    expect(workflow).toContain('Download uploaded Visual Lab review evidence');
    expect(workflow).toContain('path: ${{ runner.temp }}/anifortpt-visual-lab-review');
    expect(workflow).toContain('node scripts/visual-lab-verify.mjs "${verify_args[@]}"');
    expect(workflow).toContain('--require-recipe-set=1');
    expect(workflow).toContain('--require-browser-host-plan=1');
    expect(workflow).toContain('--recipe-set-source=${VISUAL_LAB_RECIPE_SET}');
  });
});
