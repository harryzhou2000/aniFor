import {
  resolveVisualLabDomain,
  resolveVisualLabFixture,
} from './visual-lab-fixtures.mjs';

const RECIPE_FIELDS = Object.freeze([
  'name', 'domain', 'target', 'fixture', 'gain', 'renderScale',
]);
const RECIPE_FIELD_SET = new Set(RECIPE_FIELDS);
const SAFE_RECIPE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const displayValue = (value) => JSON.stringify(value) ?? String(value);

const recipeContext = (entry, index) => (
  typeof entry?.name === 'string' && entry.name.length > 0
    ? `Visual Lab capture recipe ${displayValue(entry.name)}`
    : `Visual Lab capture recipe at index ${index}`
);

const assertExactRecipeFields = (entry, context) => {
  const ownKeys = Reflect.ownKeys(entry);
  const missing = RECIPE_FIELDS.filter((field) => !Object.hasOwn(entry, field));
  const unexpected = ownKeys.filter((field) => (
    typeof field !== 'string' || !RECIPE_FIELD_SET.has(field)
  ));
  if (missing.length === 0 && unexpected.length === 0) return;

  const details = [];
  if (missing.length > 0) details.push(`missing ${missing.join(', ')}`);
  if (unexpected.length > 0) {
    details.push(`unexpected ${unexpected.map(displayValue).join(', ')}`);
  }
  throw new Error(
    `${context} must define exactly ${RECIPE_FIELDS.join(', ')} (${details.join('; ')})`,
  );
};

const validateRecipe = (entry, index, names) => {
  if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new TypeError(`Visual Lab capture recipe at index ${index} must be a data object`);
  }

  const context = recipeContext(entry, index);
  assertExactRecipeFields(entry, context);

  if (typeof entry.name !== 'string' || !SAFE_RECIPE_NAME.test(entry.name)) {
    throw new Error(
      `${context} name must be safe kebab-case (lowercase letters, digits, and single hyphens)`,
    );
  }
  if (names.has(entry.name)) {
    throw new Error(`Duplicate Visual Lab capture recipe name ${displayValue(entry.name)}`);
  }

  if (!Number.isInteger(entry.target) || entry.target < 0 || entry.target > 255) {
    throw new Error(`${context} target must be an integer from 0 through 255`);
  }
  if (!Number.isFinite(entry.gain) || entry.gain <= 0 || entry.gain > 2) {
    throw new Error(`${context} gain must be a finite number greater than 0 and at most 2`);
  }

  let domainAdapter;
  try {
    domainAdapter = resolveVisualLabDomain(entry.domain);
  } catch (error) {
    throw new Error(`${context} has an unknown domain: ${error.message}`, { cause: error });
  }

  try {
    resolveVisualLabFixture(entry.fixture, domainAdapter.name, entry.target);
  } catch (error) {
    throw new Error(`${context} has an incompatible fixture: ${error.message}`, { cause: error });
  }

  const supportedScales = domainAdapter.executionProfile.detailScales;
  if (!supportedScales.includes(entry.renderScale)) {
    throw new Error(
      `${context} renderScale must be supported by domain ${displayValue(domainAdapter.name)}`
      + ` (${supportedScales.join(', ')})`,
    );
  }

  names.add(entry.name);
  return Object.freeze({
    name: entry.name,
    domain: domainAdapter.name,
    target: entry.target,
    fixture: entry.fixture,
    gain: entry.gain,
    renderScale: entry.renderScale,
  });
};

/**
 * Builds a validated, JSON-safe capture recipe catalog. Each recipe resolves
 * through the same domain and fixture descriptors consumed by the generic CDP
 * harness, so named shortcuts cannot bypass capability constraints.
 */
export function createVisualLabCaptureRecipeCatalog(entries) {
  if (!Array.isArray(entries)) {
    throw new TypeError('Visual Lab capture recipe catalog entries must be an array');
  }
  const names = new Set();
  return Object.freeze(Array.from(
    entries, (entry, index) => validateRecipe(entry, index, names),
  ));
}

export const VISUAL_LAB_CAPTURE_RECIPES = createVisualLabCaptureRecipeCatalog([
  {
    name: 'gas-showcase',
    domain: 'gas',
    target: 0,
    fixture: 'showcase',
    gain: 1,
    renderScale: 2,
  },
  {
    name: 'oxygen-showcase',
    domain: 'gas',
    target: 4,
    fixture: 'showcase',
    gain: 1,
    renderScale: 2,
  },
  {
    name: 'oil-motion',
    domain: 'liquid',
    target: 8,
    fixture: 'oil-motion',
    gain: 1,
    renderScale: 2,
  },
  {
    name: 'water-motion',
    domain: 'liquid',
    target: 2,
    fixture: 'water-motion',
    gain: 1,
    renderScale: 2,
  },
]);

const RECIPE_BY_NAME = new Map(
  VISUAL_LAB_CAPTURE_RECIPES.map((recipe) => [recipe.name, recipe]),
);

export function visualLabCaptureRecipeNames() {
  return VISUAL_LAB_CAPTURE_RECIPES.map(({ name }) => name);
}

export function resolveVisualLabCaptureRecipe(name) {
  const recipe = RECIPE_BY_NAME.get(name);
  if (recipe) return recipe;
  throw new Error(
    `Unknown Visual Lab capture candidate ${displayValue(name)}; --candidate must be one of: `
    + visualLabCaptureRecipeNames().join(', '),
  );
}
