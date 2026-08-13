import { constants as fsConstants } from 'node:fs';
import {
  lstat, mkdir, open, readdir, rename, rm,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createVisualLabRecipeSet,
  readVisualLabRecipeSet,
} from './visual-lab-recipe-set.mjs';
import { VISUAL_LAB_CAPTURE_RECIPES } from './visual-lab-recipes.mjs';
import { VISUAL_CAPTURE_AUTHORING_MANIFEST } from '../src/shared/visual-capture-authoring-manifest.js';

export const VISUAL_LAB_COHORT_CATALOG_SCHEMA = 'anifor.visual-lab.cohort-catalog/v1';
export const VISUAL_LAB_COHORT_CATALOG_SCHEMA_V2 = 'anifor.visual-lab.cohort-catalog/v2';
export const VISUAL_LAB_COHORT_CATALOG_SCHEMA_V3 = 'anifor.visual-lab.cohort-catalog/v3';
export const VISUAL_LAB_COHORT_CATALOG_MAX_BYTES = 65_536;

const MODULE_PATH = fileURLToPath(import.meta.url);
const DEFAULT_CATALOG = fileURLToPath(new URL('../visual-lab/cohorts.json', import.meta.url));
const DEFAULT_OUTPUT = fileURLToPath(new URL('../visual-lab/recipe-sets', import.meta.url));
const CATALOG_FIELDS = Object.freeze(['schema', 'cohorts']);
const COHORT_FIELDS_V1 = Object.freeze(['name', 'includes', 'candidates']);
const COHORT_FIELDS = Object.freeze(['name', 'includes', 'selectors', 'candidates']);
const SELECTOR_FIELDS_V2 = Object.freeze(['domains', 'fixtures']);
const SELECTOR_FIELDS = Object.freeze(['sources', 'domains', 'fixtures']);
const SAFE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_NAME_LENGTH = 64;
const MAX_JSON_DEPTH = 32;

const HELP = `Usage:
  node scripts/visual-lab-cohort-catalog.mjs check [--catalog=<cohorts.json>] [--output=<directory>]
  node scripts/visual-lab-cohort-catalog.mjs sync [--catalog=<cohorts.json>] [--output=<directory>]
  node scripts/visual-lab-cohort-catalog.mjs resolve --name=<cohort> [--catalog=<cohorts.json>] [--output=<directory>]

check fails unless the output directory contains exactly the canonical recipe
sets compiled from the v1/v2/v3 cohort catalog. v2 may select recipes by their
closed domain and fixture metadata; v3 may also select the data-only authoring
source that owns an atlas. sync writes those same bytes
with atomic per-file replacement; it does not delete unexpected files, so it
also fails while extra recipe-set JSON files remain.`;

const displayValue = (value) => JSON.stringify(value) ?? String(value);

const assertExactFields = (value, expected, label) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be a data object`);
  }
  const keys = Reflect.ownKeys(value);
  const missing = expected.filter((field) => !keys.includes(field));
  const unexpected = keys.filter((field) => !expected.includes(field));
  if (missing.length || unexpected.length) {
    throw new TypeError(
      `${label} must define exactly ${expected.join(', ')} (`
      + `${missing.length ? `missing ${missing.join(', ')}` : ''}`
      + `${missing.length && unexpected.length ? '; ' : ''}`
      + `${unexpected.length ? `unexpected ${unexpected.map(displayValue).join(', ')}` : ''})`,
    );
  }
};

const normalizeName = (value, label) => {
  if (typeof value !== 'string' || value.length > MAX_NAME_LENGTH || !SAFE_NAME.test(value)) {
    throw new TypeError(`${label} must be at most 64 characters of safe kebab-case`);
  }
  return value;
};

const normalizeNameList = (value, label) => {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  const seen = new Set();
  return Object.freeze(value.map((entry, index) => {
    const name = normalizeName(entry, `${label} at index ${index}`);
    if (seen.has(name)) throw new TypeError(`Duplicate ${label} entry ${displayValue(name)}`);
    seen.add(name);
    return name;
  }));
};

const RECIPE_DOMAINS = new Set(VISUAL_LAB_CAPTURE_RECIPES.map(({ domain }) => domain));
const RECIPE_FIXTURES = new Set(VISUAL_LAB_CAPTURE_RECIPES.map(({ fixture }) => fixture));
const AUTHORING_SOURCE_CANDIDATES = new Map(VISUAL_CAPTURE_AUTHORING_MANIFEST.map((source) => [
  source.name, new Set(source.entries.map(({ atlas }) => atlas.candidate)),
]));
const AUTHORING_SOURCES = new Set(AUTHORING_SOURCE_CANDIDATES.keys());

const normalizeSelectorList = (value, label, known, kind) => {
  const names = normalizeNameList(value, label);
  for (const name of names) {
    if (!known.has(name)) throw new TypeError(`Unknown Visual Lab recipe ${kind} ${displayValue(name)}`);
  }
  return names;
};

const normalizeSelectors = (value, label, schema) => {
  const legacyV2 = schema === VISUAL_LAB_COHORT_CATALOG_SCHEMA_V2;
  assertExactFields(value, legacyV2 ? SELECTOR_FIELDS_V2 : SELECTOR_FIELDS, label);
  return Object.freeze({
    sources: legacyV2 ? Object.freeze([]) : normalizeSelectorList(
      value.sources, `${label} sources`, AUTHORING_SOURCES, 'authoring source',
    ),
    domains: normalizeSelectorList(value.domains, `${label} domains`, RECIPE_DOMAINS, 'domain'),
    fixtures: normalizeSelectorList(value.fixtures, `${label} fixtures`, RECIPE_FIXTURES, 'fixture'),
  });
};

export function normalizeVisualLabCohortCatalog(input) {
  assertExactFields(input, CATALOG_FIELDS, 'Visual Lab cohort catalog');
  if (input.schema !== VISUAL_LAB_COHORT_CATALOG_SCHEMA_V3
    && input.schema !== VISUAL_LAB_COHORT_CATALOG_SCHEMA_V2
    && input.schema !== VISUAL_LAB_COHORT_CATALOG_SCHEMA) {
    throw new TypeError(
      `Visual Lab cohort catalog schema must be ${VISUAL_LAB_COHORT_CATALOG_SCHEMA_V3}, `
      + `${VISUAL_LAB_COHORT_CATALOG_SCHEMA_V2}, or ${VISUAL_LAB_COHORT_CATALOG_SCHEMA}`,
    );
  }
  if (!Array.isArray(input.cohorts) || input.cohorts.length === 0) {
    throw new TypeError('Visual Lab cohort catalog cohorts must be a non-empty array');
  }
  const names = new Set();
  const cohorts = input.cohorts.map((cohort, index) => {
    const label = `Visual Lab cohort at index ${index}`;
    const legacy = input.schema === VISUAL_LAB_COHORT_CATALOG_SCHEMA;
    assertExactFields(cohort, legacy ? COHORT_FIELDS_V1 : COHORT_FIELDS, label);
    const name = normalizeName(cohort.name, `${label} name`);
    if (names.has(name)) throw new TypeError(`Duplicate Visual Lab cohort ${displayValue(name)}`);
    names.add(name);
    return Object.freeze({
      name,
      includes: normalizeNameList(cohort.includes, `${label} includes`),
      selectors: legacy
        ? Object.freeze({ sources: Object.freeze([]), domains: Object.freeze([]), fixtures: Object.freeze([]) })
        : normalizeSelectors(cohort.selectors, `${label} selectors`, input.schema),
      candidates: normalizeNameList(cohort.candidates, `${label} candidates`),
    });
  });
  return Object.freeze({
    schema: input.schema,
    cohorts: Object.freeze(cohorts),
  });
}

const assertUniqueJsonObjectKeys = (source, label) => {
  let cursor = 0;
  const fail = (message) => { throw new TypeError(`Invalid ${label} at byte ${cursor}: ${message}`); };
  const skip = () => { while (/^[\t\n\r ]$/.test(source[cursor] ?? '')) cursor++; };
  const delimiter = (character) => character === undefined || ',]}'.includes(character)
    || /^[\t\n\r ]$/.test(character);
  const string = () => {
    if (source[cursor] !== '"') fail('expected string');
    const start = cursor++;
    while (cursor < source.length) {
      const character = source[cursor++];
      if (character === '"') {
        try { return JSON.parse(source.slice(start, cursor)); }
        catch (error) { throw new TypeError(`Invalid ${label} string`, { cause: error }); }
      }
      if (character === '\\') {
        if (cursor >= source.length) fail('unterminated escape');
        cursor += source[cursor] === 'u' ? 5 : 1;
      } else if (character.charCodeAt(0) < 0x20) fail('unescaped control character');
    }
    fail('unterminated string');
  };
  const value = (depth) => {
    if (depth > MAX_JSON_DEPTH) fail(`nesting exceeds ${MAX_JSON_DEPTH}`);
    skip();
    if (source[cursor] === '{') {
      cursor++; skip();
      const keys = new Set();
      if (source[cursor] === '}') { cursor++; return; }
      for (;;) {
        skip(); const key = string();
        if (keys.has(key)) fail(`duplicate object member ${displayValue(key)}`);
        keys.add(key); skip();
        if (source[cursor++] !== ':') fail('expected colon');
        value(depth + 1); skip();
        const separator = source[cursor++];
        if (separator === '}') return;
        if (separator !== ',') fail('expected comma or closing brace');
      }
    }
    if (source[cursor] === '[') {
      cursor++; skip();
      if (source[cursor] === ']') { cursor++; return; }
      for (;;) {
        value(depth + 1); skip();
        const separator = source[cursor++];
        if (separator === ']') return;
        if (separator !== ',') fail('expected comma or closing bracket');
      }
    }
    if (source[cursor] === '"') { string(); return; }
    for (const literal of ['true', 'false', 'null']) {
      if (source.startsWith(literal, cursor)) {
        cursor += literal.length;
        if (!delimiter(source[cursor])) fail(`invalid token after ${literal}`);
        return;
      }
    }
    const number = source.slice(cursor).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u)?.[0];
    if (number) {
      cursor += number.length;
      if (!delimiter(source[cursor])) fail('invalid token after number');
      return;
    }
    fail('expected JSON value');
  };
  value(0); skip();
  if (cursor !== source.length) fail('trailing data');
};

export function parseVisualLabCohortCatalog(source, label = 'Visual Lab cohort catalog JSON') {
  if (typeof source !== 'string') throw new TypeError(`${label} must be UTF-8 text`);
  if (Buffer.byteLength(source, 'utf8') > VISUAL_LAB_COHORT_CATALOG_MAX_BYTES) {
    throw new TypeError(`${label} exceeds the ${VISUAL_LAB_COHORT_CATALOG_MAX_BYTES}-byte limit`);
  }
  assertUniqueJsonObjectKeys(source, label);
  let parsed;
  try { parsed = JSON.parse(source); }
  catch (error) { throw new TypeError(`Invalid ${label}`, { cause: error }); }
  return normalizeVisualLabCohortCatalog(parsed);
}

const sameFile = (left, right) => left.dev === right.dev && left.ino === right.ino
  && left.size === right.size && left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs;

const readBoundedFile = async (handle, maximumBytes, label) => {
  const bytes = Buffer.allocUnsafe(maximumBytes + 1);
  let offset = 0;
  while (offset < bytes.length) {
    const { bytesRead } = await handle.read(bytes, offset, bytes.length - offset, offset);
    if (bytesRead === 0) break;
    offset += bytesRead;
  }
  if (offset > maximumBytes) throw new TypeError(`${label} exceeds the ${maximumBytes}-byte limit`);
  return bytes.subarray(0, offset);
};

const assertNoSymlinkAncestors = async (absolute, label, includeLeaf = false) => {
  const parsed = path.parse(absolute);
  const segments = absolute.slice(parsed.root.length).split(path.sep).filter(Boolean);
  let current = parsed.root;
  const checked = includeLeaf ? segments : segments.slice(0, -1);
  for (const segment of checked) {
    current = path.join(current, segment);
    const details = await lstat(current);
    if (details.isSymbolicLink()) throw new TypeError(`${label} must not have a symbolic-link path component: ${current}`);
  }
};

const assertRealDirectory = async (absolute, label) => {
  await assertNoSymlinkAncestors(absolute, label, true);
  const details = await lstat(absolute, { bigint: true });
  if (!details.isDirectory()) throw new TypeError(`${label} must be a real directory`);
  return details;
};

const ensureRealDirectory = async (absolute, label) => {
  const parsed = path.parse(absolute);
  const segments = absolute.slice(parsed.root.length).split(path.sep).filter(Boolean);
  let current = parsed.root;
  for (const segment of segments) {
    current = path.join(current, segment);
    let details;
    try {
      details = await lstat(current, { bigint: true });
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      await mkdir(current);
      details = await lstat(current, { bigint: true });
    }
    if (details.isSymbolicLink() || !details.isDirectory()) {
      throw new TypeError(`${label} must not have a symbolic-link or non-directory path component: ${current}`);
    }
  }
  return assertRealDirectory(absolute, label);
};

export async function readVisualLabCohortCatalog(inputPath) {
  if (typeof inputPath !== 'string' || inputPath.length === 0 || path.normalize(inputPath) !== inputPath
    || inputPath.split(path.sep).some((part) => part === '.' || part === '..')) {
    throw new TypeError('Visual Lab cohort catalog path must be canonical without dot segments');
  }
  const absolute = path.resolve(inputPath);
  await assertNoSymlinkAncestors(absolute, 'Visual Lab cohort catalog');
  const before = await lstat(absolute, { bigint: true });
  if (before.isSymbolicLink() || !before.isFile()) {
    throw new TypeError('Visual Lab cohort catalog must be a real regular file');
  }
  if (before.size > BigInt(VISUAL_LAB_COHORT_CATALOG_MAX_BYTES)) {
    throw new TypeError(`Visual Lab cohort catalog exceeds the ${VISUAL_LAB_COHORT_CATALOG_MAX_BYTES}-byte limit`);
  }
  const flags = typeof fsConstants.O_NOFOLLOW === 'number'
    ? fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW : 'r';
  const handle = await open(absolute, flags);
  let bytes;
  try {
    const opened = await handle.stat({ bigint: true });
    if (!opened.isFile() || !sameFile(before, opened)) throw new TypeError('Visual Lab cohort catalog changed while opening');
    bytes = await readBoundedFile(handle, VISUAL_LAB_COHORT_CATALOG_MAX_BYTES, 'Visual Lab cohort catalog');
  } finally { await handle.close(); }
  const after = await lstat(absolute, { bigint: true });
  if (after.isSymbolicLink() || !after.isFile() || !sameFile(before, after)) {
    throw new TypeError('Visual Lab cohort catalog changed while reading');
  }
  await assertNoSymlinkAncestors(absolute, 'Visual Lab cohort catalog');
  return parseVisualLabCohortCatalog(bytes.toString('utf8'), absolute);
}

export function compileVisualLabCohortCatalog(input) {
  const catalog = normalizeVisualLabCohortCatalog(input);
  const byName = new Map(catalog.cohorts.map((cohort) => [cohort.name, cohort]));
  const completed = new Map();
  const active = [];
  const expand = (name) => {
    if (completed.has(name)) return completed.get(name);
    const cohort = byName.get(name);
    if (!cohort) throw new TypeError(`Unknown included Visual Lab cohort ${displayValue(name)}`);
    const cycleAt = active.indexOf(name);
    if (cycleAt !== -1) {
      throw new TypeError(`Visual Lab cohort include cycle: ${[...active.slice(cycleAt), name].join(' -> ')}`);
    }
    active.push(name);
    const hasSourceSelector = cohort.selectors.sources.length > 0;
    const hasDomainSelector = cohort.selectors.domains.length > 0;
    const hasFixtureSelector = cohort.selectors.fixtures.length > 0;
    const selected = VISUAL_LAB_CAPTURE_RECIPES.filter((recipe) => (
      (hasSourceSelector || hasDomainSelector || hasFixtureSelector)
      && (!hasSourceSelector || cohort.selectors.sources.some((source) => (
        AUTHORING_SOURCE_CANDIDATES.get(source).has(recipe.name)
      )))
      && (!hasDomainSelector || cohort.selectors.domains.includes(recipe.domain))
      && (!hasFixtureSelector || cohort.selectors.fixtures.includes(recipe.fixture))
    )).map((recipe) => recipe.name);
    const candidates = cohort.includes.flatMap((included) => expand(included).candidates)
      .concat(selected, cohort.candidates);
    active.pop();
    const seen = new Set();
    for (const candidate of candidates) {
      if (seen.has(candidate)) {
        throw new TypeError(`Duplicate candidate ${displayValue(candidate)} in expanded cohort ${displayValue(name)}`);
      }
      seen.add(candidate);
    }
    if (candidates.length === 0) throw new TypeError(`Visual Lab cohort ${displayValue(name)} expands to no candidates`);
    const recipeSet = createVisualLabRecipeSet(name, candidates);
    const result = Object.freeze({ candidates: Object.freeze(candidates), recipeSet });
    completed.set(name, result);
    return result;
  };
  return Object.freeze(catalog.cohorts.map(({ name }) => expand(name).recipeSet));
}

export function visualLabCohortNamesFromCatalog(input) {
  return Object.freeze(compileVisualLabCohortCatalog(input).map(({ name }) => name));
}

export function resolveVisualLabCohortFromCatalog(input, name, outputDirectory = DEFAULT_OUTPUT) {
  const normalizedName = normalizeName(name, 'Visual Lab cohort name');
  const recipeSet = compileVisualLabCohortCatalog(input)
    .find((candidate) => candidate.name === normalizedName);
  if (!recipeSet) throw new TypeError(`Unknown Visual Lab cohort ${displayValue(normalizedName)}`);
  const fileName = `${recipeSet.name}.json`;
  return Object.freeze({
    name: recipeSet.name,
    recipeSet,
    fileName,
    snapshotPath: path.join(path.resolve(outputDirectory), fileName),
  });
}

/** Launcher-facing default-catalog resolver; returns no executable authority. */
export async function resolveVisualLabCohort(name, options = {}) {
  const catalogPath = options.catalogPath ?? DEFAULT_CATALOG;
  const outputDirectory = options.outputDirectory ?? DEFAULT_OUTPUT;
  const catalog = await readVisualLabCohortCatalog(catalogPath);
  return resolveVisualLabCohortFromCatalog(catalog, name, outputDirectory);
}

/**
 * Resolves one catalog cohort and proves that its checked-in recipe-set
 * snapshot still represents the compiled catalog bytes. This grants no Git,
 * path-containment, capture, or execution authority; callers retain those
 * boundaries around the returned read-only path.
 */
export async function resolveTrackedVisualLabCohortSnapshot(name, options = {}) {
  const resolved = await resolveVisualLabCohort(name, options);
  const snapshot = await (options.readRecipeSet ?? readVisualLabRecipeSet)(
    resolved.snapshotPath,
  );
  if (snapshot.name !== resolved.name || snapshot.id !== resolved.recipeSet.id) {
    throw new Error(
      'Visual Lab cohort snapshot is stale; run npm run visual-lab:authoring:sync',
    );
  }
  return Object.freeze({ ...resolved, snapshot });
}

export async function visualLabCohortNames(options = {}) {
  const catalog = await readVisualLabCohortCatalog(options.catalogPath ?? DEFAULT_CATALOG);
  return visualLabCohortNamesFromCatalog(catalog);
}

export const serializeVisualLabRecipeSet = (recipeSet) => `${JSON.stringify(recipeSet, null, 2)}\n`;

const expectedFiles = (recipeSets) => new Map(recipeSets.map((recipeSet) => [
  `${recipeSet.name}.json`, serializeVisualLabRecipeSet(recipeSet),
]));

export async function checkVisualLabCohortOutputs(catalog, outputDirectory) {
  const expected = expectedFiles(compileVisualLabCohortCatalog(catalog));
  const absoluteOutput = path.resolve(outputDirectory);
  await assertRealDirectory(absoluteOutput, 'Visual Lab recipe-set output');
  const entries = await readdir(absoluteOutput, { withFileTypes: true });
  const actualNames = entries.filter((entry) => entry.name.endsWith('.json')).map((entry) => entry.name).sort();
  const wantedNames = [...expected.keys()].sort();
  if (JSON.stringify(actualNames) !== JSON.stringify(wantedNames)) {
    throw new TypeError(`Visual Lab recipe-set files differ: expected ${wantedNames.join(', ')}, received ${actualNames.join(', ')}`);
  }
  for (const entry of entries) {
    if (!expected.has(entry.name)) continue;
    if (!entry.isFile() || entry.isSymbolicLink()) throw new TypeError(`${entry.name} must be a real regular file`);
    const file = path.join(absoluteOutput, entry.name);
    const expectedBytes = Buffer.byteLength(expected.get(entry.name), 'utf8');
    const before = await lstat(file, { bigint: true });
    if (before.isSymbolicLink() || !before.isFile()) throw new TypeError(`${entry.name} must be a real regular file`);
    if (before.size !== BigInt(expectedBytes)) {
      throw new TypeError(`${entry.name} does not have the expected byte size`);
    }
    const flags = typeof fsConstants.O_NOFOLLOW === 'number'
      ? fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW : 'r';
    const handle = await open(file, flags);
    let bytes;
    try {
      const opened = await handle.stat({ bigint: true });
      if (!opened.isFile() || !sameFile(before, opened)) {
        throw new TypeError(`${entry.name} changed while opening`);
      }
      bytes = await readBoundedFile(handle, expectedBytes, entry.name);
    } finally { await handle.close(); }
    const after = await lstat(file, { bigint: true });
    if (after.isSymbolicLink() || !after.isFile() || !sameFile(before, after)) {
      throw new TypeError(`${entry.name} changed while reading`);
    }
    await assertRealDirectory(absoluteOutput, 'Visual Lab recipe-set output');
    if (bytes.toString('utf8') !== expected.get(entry.name)) {
      throw new TypeError(`${entry.name} is not the exact compiled recipe set`);
    }
  }
  return Object.freeze({ checked: expected.size, names: Object.freeze(wantedNames) });
}

export async function syncVisualLabCohortOutputs(catalog, outputDirectory) {
  const expected = expectedFiles(compileVisualLabCohortCatalog(catalog));
  const absoluteOutput = path.resolve(outputDirectory);
  await ensureRealDirectory(absoluteOutput, 'Visual Lab recipe-set output');
  const nonce = `${process.pid}-${Date.now().toString(36)}`;
  const staged = [];
  try {
    for (const [name, bytes] of expected) {
      const temporary = path.join(absoluteOutput, `.${name}.${nonce}.tmp`);
      const handle = await open(temporary, fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL, 0o644);
      try { await handle.writeFile(bytes, 'utf8'); await handle.sync(); } finally { await handle.close(); }
      staged.push([temporary, path.join(absoluteOutput, name)]);
    }
    for (const [temporary, destination] of staged) await rename(temporary, destination);
  } finally {
    await Promise.all(staged.map(([temporary]) => rm(temporary, { force: true })));
  }
  return checkVisualLabCohortOutputs(catalog, absoluteOutput);
}

export function parseVisualLabCohortCatalogArguments(argv) {
  if (argv.includes('--help')) return Object.freeze({ help: true });
  const [command, ...arguments_] = argv;
  if (command !== 'check' && command !== 'sync' && command !== 'resolve') {
    throw new Error('command must be check, sync, or resolve');
  }
  const values = new Map();
  for (const argument of arguments_) {
    if (!argument.startsWith('--') || !argument.includes('=')) throw new Error(`Unknown argument ${displayValue(argument)}`);
    const separator = argument.indexOf('=');
    const name = argument.slice(2, separator);
    if (name !== 'catalog' && name !== 'output' && name !== 'name') {
      throw new Error(`Unknown option --${name}`);
    }
    if (values.has(name)) throw new Error(`Option --${name} may only be provided once`);
    const value = argument.slice(separator + 1);
    if (!value) throw new Error(`--${name} requires a value`);
    values.set(name, value);
  }
  const cohortName = values.get('name');
  if (command === 'resolve' && cohortName === undefined) {
    throw new Error('resolve requires --name=<cohort>');
  }
  if (command !== 'resolve' && cohortName !== undefined) {
    throw new Error(`--name is not supported by ${command}`);
  }
  return Object.freeze({
    command,
    catalog: values.get('catalog') ?? DEFAULT_CATALOG,
    output: values.get('output') ?? DEFAULT_OUTPUT,
    ...(cohortName === undefined ? {} : { name: cohortName }),
  });
}

const main = async () => {
  try {
    const options = parseVisualLabCohortCatalogArguments(process.argv.slice(2));
    if (options.help) { process.stdout.write(`${HELP}\n`); return; }
    if (options.command === 'resolve') {
      const resolved = await resolveTrackedVisualLabCohortSnapshot(options.name, {
        catalogPath: options.catalog,
        outputDirectory: options.output,
      });
      process.stdout.write(`${resolved.snapshotPath}\n`);
      return;
    }
    const catalog = await readVisualLabCohortCatalog(options.catalog);
    const result = options.command === 'sync'
      ? await syncVisualLabCohortOutputs(catalog, options.output)
      : await checkVisualLabCohortOutputs(catalog, options.output);
    process.stdout.write(`${JSON.stringify({ tool: 'visual-lab-cohort-catalog-v3', ok: true, ...result })}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ tool: 'visual-lab-cohort-catalog-v3', ok: false, error: error?.stack ?? String(error) })}\n`);
    process.exitCode = 1;
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === MODULE_PATH) void main();
