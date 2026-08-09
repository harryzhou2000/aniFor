import { createHash } from 'node:crypto';
import { lstat, open } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

import {
  resolveVisualLabCaptureRecipe,
  visualLabCaptureRecipeNames,
} from './visual-lab-recipes.mjs';

export const VISUAL_LAB_RECIPE_SET_SCHEMA = 'anifor.visual-lab.recipe-set/v1';
export const VISUAL_LAB_RECIPE_SET_MAX_BYTES = 1_048_576;

const MODULE_PATH = fileURLToPath(import.meta.url);
const SET_FIELDS = Object.freeze(['schema', 'id', 'name', 'recipes']);
const RECIPE_FIELDS = Object.freeze([
  'name', 'domain', 'target', 'fixture', 'gain', 'renderScale',
]);
const SAFE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_NAME_LENGTH = 64;
const SHA256_ID = /^sha256:[0-9a-f]{64}$/;
const MAX_JSON_DEPTH = 64;

const HELP = `Usage:
  node scripts/visual-lab-recipe-set.mjs create \\
    --name=<safe-name> [--candidates=<name[,name...]>]

  node scripts/visual-lab-recipe-set.mjs verify --input=<recipe-set.json>

create writes one canonical recipe-set/v1 JSON document to stdout. Omitting
--candidates selects the complete frozen catalog. verify reads a bounded real
file, validates its content identity, and rejects catalog drift.`;

const displayValue = (value) => JSON.stringify(value) ?? String(value);

const deepFreeze = (value) => {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
};

const assertExactFields = (value, expected, label) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be a data object`);
  }
  const keys = Reflect.ownKeys(value);
  const missing = expected.filter((key) => !keys.includes(key));
  const unexpected = keys.filter((key) => !expected.includes(key));
  if (missing.length === 0 && unexpected.length === 0) return;
  const details = [
    missing.length > 0 ? `missing ${missing.join(', ')}` : '',
    unexpected.length > 0
      ? `unexpected ${unexpected.map(displayValue).join(', ')}` : '',
  ].filter(Boolean).join('; ');
  throw new TypeError(`${label} must define exactly ${expected.join(', ')} (${details})`);
};

const normalizeName = (name) => {
  if (typeof name !== 'string' || name.length > MAX_NAME_LENGTH || !SAFE_NAME.test(name)) {
    throw new TypeError(
      `Visual Lab recipe-set name must be at most ${MAX_NAME_LENGTH} characters of safe `
      + 'kebab-case (lowercase letters, digits, and single hyphens)',
    );
  }
  return name;
};

const cloneRecipe = (recipe) => Object.freeze({
  name: recipe.name,
  domain: recipe.domain,
  target: recipe.target,
  fixture: recipe.fixture,
  gain: recipe.gain,
  renderScale: recipe.renderScale,
});

const selectRecipes = (candidateNames) => {
  const catalog = visualLabCaptureRecipeNames();
  const selected = candidateNames ?? catalog;
  if (!Array.isArray(selected) || selected.length === 0) {
    throw new TypeError('Visual Lab recipe-set candidates must be a non-empty array');
  }

  const seen = new Set();
  for (const candidate of selected) {
    const recipe = resolveVisualLabCaptureRecipe(candidate);
    if (seen.has(recipe.name)) {
      throw new TypeError(`Duplicate Visual Lab recipe-set candidate ${displayValue(recipe.name)}`);
    }
    seen.add(recipe.name);
  }
  return catalog.filter((candidate) => seen.has(candidate))
    .map((candidate) => cloneRecipe(resolveVisualLabCaptureRecipe(candidate)));
};

/**
 * Creates a portable cohort whose identity includes its human name and the
 * complete canonical recipe descriptors. A later catalog edit therefore makes
 * an old set fail closed instead of silently changing the requested capture.
 */
export function createVisualLabRecipeSet(name, candidateNames) {
  const normalizedName = normalizeName(name);
  const recipes = Object.freeze(selectRecipes(candidateNames));
  const identity = {
    schema: VISUAL_LAB_RECIPE_SET_SCHEMA,
    name: normalizedName,
    recipes,
  };
  const digest = createHash('sha256').update(JSON.stringify(identity), 'utf8').digest('hex');
  return deepFreeze({
    schema: VISUAL_LAB_RECIPE_SET_SCHEMA,
    id: `sha256:${digest}`,
    name: normalizedName,
    recipes,
  });
}

/** Validates untrusted JSON and returns a detached canonical frozen record. */
export function normalizeVisualLabRecipeSet(input) {
  assertExactFields(input, SET_FIELDS, 'Visual Lab recipe set');
  if (input.schema !== VISUAL_LAB_RECIPE_SET_SCHEMA) {
    throw new TypeError(
      `Visual Lab recipe set schema must be ${VISUAL_LAB_RECIPE_SET_SCHEMA}`,
    );
  }
  if (typeof input.id !== 'string' || !SHA256_ID.test(input.id)) {
    throw new TypeError('Visual Lab recipe set id must be a lowercase SHA-256 identity');
  }
  const name = normalizeName(input.name);
  if (!Array.isArray(input.recipes) || input.recipes.length === 0) {
    throw new TypeError('Visual Lab recipe set recipes must be a non-empty array');
  }

  const names = [];
  const seen = new Set();
  for (const [index, recipe] of input.recipes.entries()) {
    const label = `Visual Lab recipe set recipe at index ${index}`;
    assertExactFields(recipe, RECIPE_FIELDS, label);
    let expected;
    try {
      expected = cloneRecipe(resolveVisualLabCaptureRecipe(recipe.name));
    } catch (error) {
      throw new TypeError(`${label} is not in the frozen catalog: ${error.message}`, {
        cause: error,
      });
    }
    if (seen.has(expected.name)) {
      throw new TypeError(`Duplicate Visual Lab recipe-set candidate ${displayValue(expected.name)}`);
    }
    seen.add(expected.name);
    names.push(expected.name);
    if (!isDeepStrictEqual(recipe, expected)) {
      throw new TypeError(
        `${label} does not exactly match the current ${displayValue(expected.name)} catalog recipe`,
      );
    }
  }

  const expected = createVisualLabRecipeSet(name, names);
  const expectedOrder = expected.recipes.map((recipe) => recipe.name);
  if (!isDeepStrictEqual(names, expectedOrder)) {
    throw new TypeError(
      `Visual Lab recipe set recipes must use frozen catalog order: ${expectedOrder.join(', ')}`,
    );
  }
  if (input.id !== expected.id) {
    throw new TypeError(
      `Visual Lab recipe set identity mismatch: expected ${expected.id}, received ${input.id}`,
    );
  }
  return expected;
}

const assertUniqueJsonObjectKeys = (source, label) => {
  let cursor = 0;
  const fail = (message) => {
    throw new TypeError(`Invalid ${label} at byte ${cursor}: ${message}`);
  };
  const skipWhitespace = () => {
    while (/^[\t\n\r ]$/.test(source[cursor] ?? '')) cursor++;
  };
  const isDelimiter = (character) => (
    character === undefined || character === ',' || character === ']'
    || character === '}' || /^[\t\n\r ]$/.test(character)
  );
  const parseString = () => {
    if (source[cursor] !== '"') fail('expected a JSON string');
    const start = cursor++;
    while (cursor < source.length) {
      const character = source[cursor++];
      if (character === '"') {
        try { return JSON.parse(source.slice(start, cursor)); }
        catch (error) { throw new TypeError(`Invalid ${label} JSON string`, { cause: error }); }
      }
      if (character === '\\') {
        if (cursor >= source.length) fail('unterminated JSON escape');
        if (source[cursor] === 'u') cursor += 5;
        else cursor++;
        continue;
      }
      if (character.charCodeAt(0) < 0x20) fail('unescaped control character in string');
    }
    fail('unterminated JSON string');
  };
  const parseValue = (depth) => {
    if (depth > MAX_JSON_DEPTH) fail(`JSON nesting exceeds ${MAX_JSON_DEPTH}`);
    skipWhitespace();
    const character = source[cursor];
    if (character === '{') {
      cursor++;
      const keys = new Set();
      skipWhitespace();
      if (source[cursor] === '}') { cursor++; return; }
      while (cursor < source.length) {
        skipWhitespace();
        const key = parseString();
        if (keys.has(key)) fail(`duplicate object member ${displayValue(key)}`);
        keys.add(key);
        skipWhitespace();
        if (source[cursor++] !== ':') fail('expected colon after object member');
        parseValue(depth + 1);
        skipWhitespace();
        const separator = source[cursor++];
        if (separator === '}') return;
        if (separator !== ',') fail('expected comma or closing brace');
      }
      fail('unterminated JSON object');
    }
    if (character === '[') {
      cursor++;
      skipWhitespace();
      if (source[cursor] === ']') { cursor++; return; }
      while (cursor < source.length) {
        parseValue(depth + 1);
        skipWhitespace();
        const separator = source[cursor++];
        if (separator === ']') return;
        if (separator !== ',') fail('expected comma or closing bracket');
      }
      fail('unterminated JSON array');
    }
    if (character === '"') { parseString(); return; }
    for (const literal of ['true', 'false', 'null']) {
      if (source.startsWith(literal, cursor)) {
        cursor += literal.length;
        if (!isDelimiter(source[cursor])) fail(`invalid token after ${literal}`);
        return;
      }
    }
    const number = source.slice(cursor).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u)?.[0];
    if (number) {
      cursor += number.length;
      if (!isDelimiter(source[cursor])) fail('invalid token after number');
      return;
    }
    fail('expected a JSON value');
  };

  parseValue(0);
  skipWhitespace();
  if (cursor !== source.length) fail('trailing data');
};

export function parseVisualLabRecipeSet(source, label = 'Visual Lab recipe set JSON') {
  if (typeof source !== 'string') throw new TypeError(`${label} must be UTF-8 text`);
  if (Buffer.byteLength(source, 'utf8') > VISUAL_LAB_RECIPE_SET_MAX_BYTES) {
    throw new TypeError(
      `${label} exceeds the ${VISUAL_LAB_RECIPE_SET_MAX_BYTES}-byte limit`,
    );
  }
  assertUniqueJsonObjectKeys(source, label);
  let parsed;
  try { parsed = JSON.parse(source); }
  catch (error) { throw new TypeError(`Invalid ${label}`, { cause: error }); }
  return normalizeVisualLabRecipeSet(parsed);
}

const sameFile = (left, right) => (
  left.dev === right.dev
  && left.ino === right.ino
  && left.size === right.size
  && left.mtimeNs === right.mtimeNs
  && left.ctimeNs === right.ctimeNs
);

const assertNoSymlinkAncestors = async (absolute) => {
  const parsed = path.parse(absolute);
  const segments = absolute.slice(parsed.root.length).split(path.sep).filter(Boolean);
  let current = parsed.root;
  for (const segment of segments.slice(0, -1)) {
    current = path.join(current, segment);
    const details = await lstat(current, { bigint: true });
    if (details.isSymbolicLink()) {
      throw new TypeError(
        `Visual Lab recipe-set input must not have a symbolic-link ancestor: ${current}`,
      );
    }
  }
};

/** Reads one bounded regular file exactly once and rejects symlink/replace races. */
export async function readVisualLabRecipeSet(inputPath) {
  if (typeof inputPath !== 'string' || inputPath.length === 0) {
    throw new TypeError('Visual Lab recipe-set input path must be a non-empty string');
  }
  const inputSegments = inputPath.split(path.sep);
  if (path.normalize(inputPath) !== inputPath
    || inputSegments.includes('.') || inputSegments.includes('..')) {
    throw new TypeError(
      'Visual Lab recipe-set input must be a canonical path without dot segments',
    );
  }
  const absolute = path.resolve(inputPath);
  await assertNoSymlinkAncestors(absolute);
  let before;
  try { before = await lstat(absolute, { bigint: true }); }
  catch (error) {
    throw new TypeError(`Cannot inspect Visual Lab recipe-set input ${absolute}`, { cause: error });
  }
  if (before.isSymbolicLink()) {
    throw new TypeError(`Visual Lab recipe-set input must not be a symbolic link: ${absolute}`);
  }
  if (!before.isFile()) {
    throw new TypeError(`Visual Lab recipe-set input must be a regular file: ${absolute}`);
  }
  if (before.size > BigInt(VISUAL_LAB_RECIPE_SET_MAX_BYTES)) {
    throw new TypeError(
      `Visual Lab recipe-set input exceeds the ${VISUAL_LAB_RECIPE_SET_MAX_BYTES}-byte limit`,
    );
  }

  const handle = await open(absolute, 'r');
  let bytes;
  try {
    const opened = await handle.stat({ bigint: true });
    if (!opened.isFile() || !sameFile(before, opened)) {
      throw new TypeError(`Visual Lab recipe-set input changed while opening: ${absolute}`);
    }
    bytes = await handle.readFile();
  } finally {
    await handle.close();
  }

  await assertNoSymlinkAncestors(absolute);
  const after = await lstat(absolute, { bigint: true });
  if (after.isSymbolicLink() || !after.isFile() || !sameFile(before, after)) {
    throw new TypeError(`Visual Lab recipe-set input changed while reading: ${absolute}`);
  }
  if (bytes.byteLength > VISUAL_LAB_RECIPE_SET_MAX_BYTES) {
    throw new TypeError(
      `Visual Lab recipe-set input exceeds the ${VISUAL_LAB_RECIPE_SET_MAX_BYTES}-byte limit`,
    );
  }
  return parseVisualLabRecipeSet(bytes.toString('utf8'), absolute);
}

export function parseVisualLabRecipeSetArguments(argv) {
  if (argv.includes('--help')) return Object.freeze({ help: true });
  const [command, ...arguments_] = argv;
  if (command !== 'create' && command !== 'verify') {
    throw new Error('Visual Lab recipe-set command must be create or verify');
  }
  const known = command === 'create'
    ? new Set(['name', 'candidates']) : new Set(['input']);
  const values = new Map();
  for (const argument of arguments_) {
    if (!argument.startsWith('--') || !argument.includes('=')) {
      throw new Error(`Unknown argument ${displayValue(argument)}; options use --name=value`);
    }
    const separator = argument.indexOf('=');
    const option = argument.slice(2, separator);
    if (!known.has(option)) throw new Error(`Unknown ${command} option --${option}`);
    if (values.has(option)) throw new Error(`Option --${option} may only be provided once`);
    values.set(option, argument.slice(separator + 1));
  }

  if (command === 'create') {
    if (!values.has('name')) throw new Error('create requires --name=<safe-name>');
    let candidates;
    if (values.has('candidates')) {
      candidates = values.get('candidates').split(',').map((value) => value.trim());
      if (candidates.some((value) => value.length === 0)) {
        throw new Error('--candidates must be a comma-separated list of recipe names');
      }
    }
    return Object.freeze({ command, name: values.get('name'), candidates });
  }

  if (!values.has('input') || values.get('input').length === 0) {
    throw new Error('verify requires --input=<recipe-set.json>');
  }
  return Object.freeze({ command, input: values.get('input') });
}

const main = async () => {
  try {
    const options = parseVisualLabRecipeSetArguments(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(`${HELP}\n`);
      return;
    }
    if (options.command === 'create') {
      const recipeSet = createVisualLabRecipeSet(options.name, options.candidates);
      process.stdout.write(`${JSON.stringify(recipeSet, null, 2)}\n`);
      return;
    }
    const recipeSet = await readVisualLabRecipeSet(options.input);
    process.stdout.write(`${JSON.stringify({
      tool: 'visual-lab-recipe-set-v1',
      ok: true,
      schema: recipeSet.schema,
      id: recipeSet.id,
      name: recipeSet.name,
      candidates: recipeSet.recipes.map((recipe) => recipe.name),
    })}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      tool: 'visual-lab-recipe-set-v1',
      ok: false,
      error: error?.stack ?? String(error),
    })}\n`);
    process.exitCode = 1;
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === MODULE_PATH) void main();
