import { pathToFileURL } from 'node:url';

import { VISUAL_CAPTURE_STATIC_RECIPES } from '../src/shared/visual-capture-static-catalog.js';
import {
  VISUAL_CAPTURE_INSPECTION_SOURCE_CATALOG,
} from '../src/shared/visual-capture-inspection-source-catalog.js';

/**
 * Scripts-owned current-only spatial review annotations. These records are
 * deliberately outside the browser static contracts and every capture/result
 * identity. They describe where a human or additive measurement tool should
 * look in already-captured PNGs; they grant no execution authority.
 */

export const VISUAL_LAB_INSPECTION_REGION_CATALOG_SCHEMA = (
  'anifor.visual-lab.inspection-region-catalog/v1'
);

const SAFE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EXACT_CATALOG_FIELDS = Object.freeze(['schema', 'fixtures']);
const EXACT_FIXTURE_FIELDS = Object.freeze(['candidate', 'world', 'regions']);
const EXACT_WORLD_FIELDS = Object.freeze(['width', 'height']);
const EXACT_REGION_FIELDS = Object.freeze(['name', 'role', 'x', 'y', 'width', 'height']);
const ROLES = new Set(['response', 'control']);
const MAX_FIXTURES = 64;
const MAX_REGIONS = 64;
const MAX_WORLD_AXIS = 8_192;

const deepFreeze = (value) => {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
};

const hasExactFields = (value, fields) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Reflect.ownKeys(value);
  return keys.length === fields.length
    && fields.every((field) => Object.hasOwn(value, field));
};

const positiveBoundedInteger = (value, maximum) => (
  Number.isSafeInteger(value) && value > 0 && value <= maximum
);

/** Validates and freezes a data-only inspection catalog. */
export function normalizeVisualLabInspectionRegionCatalog(input) {
  if (!hasExactFields(input, EXACT_CATALOG_FIELDS)
    || input.schema !== VISUAL_LAB_INSPECTION_REGION_CATALOG_SCHEMA
    || !Array.isArray(input.fixtures) || input.fixtures.length > MAX_FIXTURES) {
    throw new TypeError('Visual Lab inspection-region catalog is malformed');
  }
  const candidates = new Set();
  const fixtures = input.fixtures.map((fixture, fixtureIndex) => {
    if (!hasExactFields(fixture, EXACT_FIXTURE_FIELDS)
      || !SAFE_NAME.test(fixture.candidate ?? '') || candidates.has(fixture.candidate)
      || !hasExactFields(fixture.world, EXACT_WORLD_FIELDS)
      || !positiveBoundedInteger(fixture.world.width, MAX_WORLD_AXIS)
      || !positiveBoundedInteger(fixture.world.height, MAX_WORLD_AXIS)
      || !Array.isArray(fixture.regions) || fixture.regions.length === 0
      || fixture.regions.length > MAX_REGIONS) {
      throw new TypeError(`Visual Lab inspection fixture ${fixtureIndex} is malformed`);
    }
    candidates.add(fixture.candidate);
    const names = new Set();
    const regions = fixture.regions.map((region, regionIndex) => {
      if (!hasExactFields(region, EXACT_REGION_FIELDS)
        || !SAFE_NAME.test(region.name ?? '') || names.has(region.name)
        || !ROLES.has(region.role)
        || !Number.isSafeInteger(region.x) || region.x < 0
        || !Number.isSafeInteger(region.y) || region.y < 0
        || !positiveBoundedInteger(region.width, fixture.world.width)
        || !positiveBoundedInteger(region.height, fixture.world.height)
        || region.x + region.width > fixture.world.width
        || region.y + region.height > fixture.world.height) {
        throw new TypeError(
          `Visual Lab inspection region ${fixture.candidate}:${regionIndex} is malformed`,
        );
      }
      names.add(region.name);
      return { ...region };
    });
    return {
      candidate: fixture.candidate,
      world: { ...fixture.world },
      regions,
    };
  });
  return deepFreeze({ schema: input.schema, fixtures });
}

/**
 * Projects an ordered closed list of geometry-only review anchors. The shared
 * data can name rectangles, but cannot run code or select browser/renderer work.
 */
export function projectDeclaredInspectionFixture(atlas) {
  const { candidate, world, descriptor } = atlas;
  if (!SAFE_NAME.test(candidate ?? '') || !Array.isArray(descriptor?.inspectionRegions)
    || descriptor.inspectionRegions.length === 0) {
    throw new TypeError('Declared inspection authoring is malformed');
  }
  return {
    candidate,
    world: { ...world },
    regions: descriptor.inspectionRegions.map((region) => ({ ...region })),
  };
}

const INSPECTION_PROJECTORS = new Map([
  ['declared', projectDeclaredInspectionFixture],
]);

/**
 * Compiles data-only inspection sources, then orders the covered subset by the
 * canonical capture recipes. A source cannot invent a candidate or execute a
 * catalog-supplied callback.
 */
export function compileVisualLabInspectionFixtures(sourceCatalog, recipes) {
  if (!Array.isArray(sourceCatalog?.sources) || !Array.isArray(recipes)) {
    throw new TypeError('Visual Lab inspection sources are malformed');
  }
  const recipeOrder = new Map();
  for (const [index, recipe] of recipes.entries()) {
    if (!SAFE_NAME.test(recipe?.name ?? '') || recipeOrder.has(recipe.name)) {
      throw new TypeError('Visual Lab inspection recipe order is malformed');
    }
    recipeOrder.set(recipe.name, index);
  }
  const sourceNames = new Set();
  const projected = new Map();
  for (const source of sourceCatalog.sources) {
    if (!SAFE_NAME.test(source?.name ?? '') || sourceNames.has(source.name)
      || !Array.isArray(source.atlases)) {
      throw new TypeError('Visual Lab inspection source is malformed');
    }
    sourceNames.add(source.name);
    const projector = INSPECTION_PROJECTORS.get(source.projection);
    if (!projector) throw new TypeError(`Unknown Visual Lab inspection projection ${JSON.stringify(source.projection)}`);
    for (const atlas of source.atlases) {
      const fixture = projector(atlas);
      if (!recipeOrder.has(fixture.candidate) || projected.has(fixture.candidate)) {
        throw new TypeError(`Invalid or duplicate Visual Lab inspection candidate ${JSON.stringify(fixture.candidate)}`);
      }
      projected.set(fixture.candidate, fixture);
    }
  }
  return [...projected.values()].sort((left, right) => (
    recipeOrder.get(left.candidate) - recipeOrder.get(right.candidate)
  ));
}

const INSPECTION_FIXTURES = compileVisualLabInspectionFixtures(
  VISUAL_CAPTURE_INSPECTION_SOURCE_CATALOG,
  VISUAL_CAPTURE_STATIC_RECIPES,
);

export const VISUAL_LAB_INSPECTION_REGIONS = normalizeVisualLabInspectionRegionCatalog({
  schema: VISUAL_LAB_INSPECTION_REGION_CATALOG_SCHEMA,
  fixtures: INSPECTION_FIXTURES,
});

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  if (process.argv.length !== 3 || process.argv[2] !== '--check') {
    throw new TypeError('usage: node scripts/visual-lab-inspection-regions.mjs --check');
  }
  process.stdout.write(
    `visual inspection-region authoring is current (${VISUAL_LAB_INSPECTION_REGIONS.fixtures.length} fixtures)\n`,
  );
}
