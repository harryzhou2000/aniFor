import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import {
  checkVisualLabCohortOutputs,
  compileVisualLabCohortCatalog,
  normalizeVisualLabCohortCatalog,
  parseVisualLabCohortCatalog,
  parseVisualLabCohortCatalogArguments,
  readVisualLabCohortCatalog,
  resolveVisualLabCohort,
  resolveVisualLabCohortFromCatalog,
  serializeVisualLabRecipeSet,
  syncVisualLabCohortOutputs,
  VISUAL_LAB_COHORT_CATALOG_MAX_BYTES,
  VISUAL_LAB_COHORT_CATALOG_SCHEMA,
  VISUAL_LAB_COHORT_CATALOG_SCHEMA_V2,
  visualLabCohortNames,
  visualLabCohortNamesFromCatalog,
} from './visual-lab-cohort-catalog.mjs';

const temporaryDirectories = [];
afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    rm(directory, { recursive: true, force: true })
  )));
});
const temporaryDirectory = async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'visual-lab-cohorts-test-'));
  temporaryDirectories.push(directory);
  return directory;
};

const catalog = (cohorts) => ({ schema: VISUAL_LAB_COHORT_CATALOG_SCHEMA_V2, cohorts });
const selectors = (domains = [], fixtures = []) => ({ domains, fixtures });
const leaf = (name, candidates, selected = selectors()) => ({
  name, includes: [], selectors: selected, candidates,
});
const composed = (name, includes, candidates = []) => ({
  name, includes, selectors: selectors(), candidates,
});
const legacyCatalog = (cohorts) => ({
  schema: VISUAL_LAB_COHORT_CATALOG_SCHEMA, cohorts,
});

describe('Visual Lab declarative cohort catalog', () => {
  it('expands names-only composition and delegates canonical order and identity', () => {
    const input = catalog([
      leaf('liquids', ['water-motion', 'oil-motion']),
      leaf('air', ['oxygen-showcase', 'gas-showcase']),
      composed('release', ['air', 'liquids']),
    ]);
    const compiled = compileVisualLabCohortCatalog(input);
    expect(compiled.map(({ name }) => name)).toEqual(['liquids', 'air', 'release']);
    expect(compiled[0].recipes.map(({ name }) => name)).toEqual(['oil-motion', 'water-motion']);
    expect(compiled[2].recipes.map(({ name }) => name)).toEqual([
      'gas-showcase', 'oxygen-showcase', 'oil-motion', 'water-motion',
    ]);
    expect(Object.isFrozen(compiled)).toBe(true);
    expect(Object.isFrozen(compiled[2])).toBe(true);
    expect(visualLabCohortNamesFromCatalog(input)).toEqual(['liquids', 'air', 'release']);
  });

  it('derives membership from closed domain and fixture selectors in canonical recipe order', () => {
    const input = catalog([
      leaf('air', [], selectors(['gas'])),
      leaf('water-only', [], selectors([], ['water-motion'])),
      leaf('liquid-motion', [], selectors(['liquid'], ['oil-motion', 'water-motion'])),
      composed('selected', ['air', 'water-only']),
    ]);
    const compiled = compileVisualLabCohortCatalog(input);
    expect(compiled[0].recipes.map(({ name }) => name)).toEqual([
      'gas-showcase', 'oxygen-showcase',
    ]);
    expect(compiled[1].recipes.map(({ name }) => name)).toEqual(['water-motion']);
    expect(compiled[2].recipes.map(({ name }) => name)).toEqual([
      'oil-motion', 'water-motion',
    ]);
    expect(compiled[3].recipes.map(({ name }) => name)).toEqual([
      'gas-showcase', 'oxygen-showcase', 'water-motion',
    ]);
  });

  it('keeps v1 catalogs readable without granting selectors', () => {
    const input = legacyCatalog([
      { name: 'air', includes: [], candidates: ['gas-showcase'] },
    ]);
    const normalized = normalizeVisualLabCohortCatalog(input);
    expect(normalized.schema).toBe(VISUAL_LAB_COHORT_CATALOG_SCHEMA);
    expect(normalized.cohorts[0].selectors).toEqual({ domains: [], fixtures: [] });
    expect(compileVisualLabCohortCatalog(input)[0].recipes.map(({ name }) => name))
      .toEqual(['gas-showcase']);
  });

  it('fails closed for malformed structure, unknowns, duplicates, cycles, and empty expansion', () => {
    expect(() => normalizeVisualLabCohortCatalog({ ...catalog([leaf('air', ['gas-showcase'])]), extra: 1 }))
      .toThrow('exactly schema, cohorts');
    expect(() => normalizeVisualLabCohortCatalog(catalog([
      leaf('air', ['gas-showcase']), leaf('air', ['oxygen-showcase']),
    ]))).toThrow('Duplicate Visual Lab cohort');
    expect(() => normalizeVisualLabCohortCatalog(catalog([
      leaf('air', ['gas-showcase', 'gas-showcase']),
    ]))).toThrow('Duplicate');
    expect(() => compileVisualLabCohortCatalog(catalog([
      composed('release', ['missing']),
    ]))).toThrow('Unknown included');
    expect(() => compileVisualLabCohortCatalog(catalog([
      composed('one', ['two']),
      composed('two', ['one']),
    ]))).toThrow('one -> two -> one');
    expect(() => compileVisualLabCohortCatalog(catalog([
      leaf('air', ['gas-showcase']),
      composed('duplicate', ['air'], ['gas-showcase']),
    ]))).toThrow('Duplicate candidate');
    expect(() => compileVisualLabCohortCatalog(catalog([
      leaf('empty', []),
    ]))).toThrow('expands to no candidates');
    expect(() => compileVisualLabCohortCatalog(catalog([
      leaf('unknown', ['not-a-recipe']),
    ]))).toThrow('Unknown Visual Lab capture candidate');
    expect(() => normalizeVisualLabCohortCatalog(catalog([
      leaf('unknown-domain', [], selectors(['plasma'])),
    ]))).toThrow('Unknown Visual Lab recipe domain');
    expect(() => normalizeVisualLabCohortCatalog(catalog([
      leaf('unknown-fixture', [], selectors([], ['missing-fixture'])),
    ]))).toThrow('Unknown Visual Lab recipe fixture');
    expect(() => normalizeVisualLabCohortCatalog(catalog([{
      name: 'extra-selector-field', includes: [],
      selectors: { domains: ['gas'], fixtures: [], extra: [] }, candidates: [],
    }]))).toThrow('exactly domains, fixtures');
    expect(() => compileVisualLabCohortCatalog(catalog([
      leaf('nonmatching-intersection', [], selectors(['gas'], ['water-motion'])),
    ]))).toThrow('expands to no candidates');
    expect(() => compileVisualLabCohortCatalog(catalog([
      leaf('overlap', ['gas-showcase'], selectors(['gas'])),
    ]))).toThrow('Duplicate candidate');
  });

  it('parses and reads only bounded real JSON with unique object keys', async () => {
    const root = await temporaryDirectory();
    const input = catalog([leaf('air', ['gas-showcase'])]);
    const source = JSON.stringify(input);
    const file = path.join(root, 'cohorts.json');
    await writeFile(file, source);
    await expect(readVisualLabCohortCatalog(file)).resolves.toEqual(normalizeVisualLabCohortCatalog(input));
    expect(() => parseVisualLabCohortCatalog(source.replace(
      '"schema":', '"schema":"duplicate","schema":',
    ))).toThrow('duplicate object member');
    expect(() => parseVisualLabCohortCatalog(' '.repeat(VISUAL_LAB_COHORT_CATALOG_MAX_BYTES + 1)))
      .toThrow('byte limit');
    const linked = path.join(root, 'linked.json');
    await symlink(file, linked);
    await expect(readVisualLabCohortCatalog(linked)).rejects.toThrow('real regular file');
    const realAncestor = path.join(root, 'real');
    const linkedAncestor = path.join(root, 'linked-directory');
    await mkdir(realAncestor);
    await writeFile(path.join(realAncestor, 'cohorts.json'), source);
    await symlink(realAncestor, linkedAncestor, 'dir');
    await expect(readVisualLabCohortCatalog(path.join(linkedAncestor, 'cohorts.json')))
      .rejects.toThrow('symbolic-link path component');
  });

  it('syncs atomically formatted outputs and check detects drift, extras, and symlinks', async () => {
    const root = await temporaryDirectory();
    const output = path.join(root, 'sets');
    const input = catalog([
      leaf('air', ['gas-showcase']),
      leaf('liquid', ['water-motion']),
    ]);
    await expect(syncVisualLabCohortOutputs(input, output)).resolves.toEqual({
      checked: 2, names: ['air.json', 'liquid.json'],
    });
    const compiled = compileVisualLabCohortCatalog(input);
    expect(await readFile(path.join(output, 'air.json'), 'utf8')).toBe(serializeVisualLabRecipeSet(compiled[0]));
    await expect(checkVisualLabCohortOutputs(input, output)).resolves.toMatchObject({ checked: 2 });
    const airBytes = await readFile(path.join(output, 'air.json'), 'utf8');
    await writeFile(path.join(output, 'air.json'), 'x'.repeat(Buffer.byteLength(airBytes, 'utf8')));
    await expect(checkVisualLabCohortOutputs(input, output)).rejects.toThrow('exact compiled');
    await syncVisualLabCohortOutputs(input, output);
    await writeFile(path.join(output, 'air.json'), `${airBytes}x`);
    await expect(checkVisualLabCohortOutputs(input, output)).rejects.toThrow('expected byte size');
    await syncVisualLabCohortOutputs(input, output);
    await writeFile(path.join(output, 'extra.json'), '{}\n');
    await expect(checkVisualLabCohortOutputs(input, output)).rejects.toThrow('files differ');
    await expect(syncVisualLabCohortOutputs(input, output)).rejects.toThrow('files differ');
    await expect(readFile(path.join(output, 'extra.json'), 'utf8')).resolves.toBe('{}\n');
    await rm(path.join(output, 'extra.json'));
    await rm(path.join(output, 'air.json'));
    await symlink(path.join(output, 'liquid.json'), path.join(output, 'air.json'));
    await expect(checkVisualLabCohortOutputs(input, output)).rejects.toThrow('real regular file');
  });

  it('does not create an output directory through an existing symlink', async () => {
    const root = await temporaryDirectory();
    const external = path.join(root, 'external');
    const linkedAncestor = path.join(root, 'linked-output');
    await mkdir(external);
    await symlink(external, linkedAncestor, 'dir');
    const input = catalog([leaf('air', ['gas-showcase'])]);
    await expect(syncVisualLabCohortOutputs(input, path.join(linkedAncestor, 'sets')))
      .rejects.toThrow('symbolic-link or non-directory path component');
    await expect(readdir(external)).resolves.toEqual([]);
  });

  it('preserves all tracked recipe-set bytes and IDs exactly', async () => {
    const catalogPath = fileURLToPath(new URL('../visual-lab/cohorts.json', import.meta.url));
    const output = fileURLToPath(new URL('../visual-lab/recipe-sets', import.meta.url));
    const input = await readVisualLabCohortCatalog(catalogPath);
    await expect(checkVisualLabCohortOutputs(input, output)).resolves.toEqual({
      checked: 4,
      names: ['atmosphere.json', 'liquid-motion.json', 'powder-style.json', 'release.json'],
    });
    const compiled = compileVisualLabCohortCatalog(input);
    expect(compiled.map(({ id }) => id)).toEqual([
      'sha256:6fa70067d092a16e1b8d2e77283b33bd10067ce5485ae8c79239775eb7cb1e3c',
      'sha256:7fd140a5fef7cb4e692d8db08e35b3bb3da7835451a92289ba2941efe7fab380',
      'sha256:f5053916b82e8907f840ae6e334a159bedecc69b0777e2700f0383917b58a4e0',
      'sha256:2f7824673c315358416b802283d3d3333f0b22cd908699cbe512da8b38f6c5e2',
    ]);
  });

  it('exposes launcher-safe names and resolution with tracked snapshot metadata', async () => {
    expect(await visualLabCohortNames()).toEqual([
      'atmosphere', 'liquid-motion', 'powder-style', 'release',
    ]);
    const resolved = await resolveVisualLabCohort('release');
    expect(resolved.name).toBe('release');
    expect(resolved.fileName).toBe('release.json');
    expect(resolved.snapshotPath).toMatch(/visual-lab\/recipe-sets\/release\.json$/);
    expect(resolved.recipeSet.id).toBe(
      'sha256:2f7824673c315358416b802283d3d3333f0b22cd908699cbe512da8b38f6c5e2',
    );
    expect(Object.isFrozen(resolved)).toBe(true);
    expect(() => resolveVisualLabCohortFromCatalog(catalog([leaf('air', ['gas-showcase'])]), 'missing'))
      .toThrow('Unknown Visual Lab cohort');
  });

  it('keeps CLI arguments strict and defaults usable', () => {
    expect(parseVisualLabCohortCatalogArguments(['check'])).toMatchObject({ command: 'check' });
    expect(parseVisualLabCohortCatalogArguments([
      'sync', '--catalog=/tmp/cohorts.json', '--output=/tmp/sets',
    ])).toEqual({ command: 'sync', catalog: '/tmp/cohorts.json', output: '/tmp/sets' });
    expect(() => parseVisualLabCohortCatalogArguments(['write'])).toThrow('check or sync');
    expect(() => parseVisualLabCohortCatalogArguments(['check', '--catalog=']))
      .toThrow('requires a path');
    expect(() => parseVisualLabCohortCatalogArguments(['check', '--other=value']))
      .toThrow('Unknown option');
  });
});
