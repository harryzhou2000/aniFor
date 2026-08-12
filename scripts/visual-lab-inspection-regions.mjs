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

export const VISUAL_LAB_INSPECTION_REGIONS = normalizeVisualLabInspectionRegionCatalog({
  schema: VISUAL_LAB_INSPECTION_REGION_CATALOG_SCHEMA,
  fixtures: [{
    candidate: 'opposed-source-material-lighting-atlas',
    world: { width: 612, height: 384 },
    regions: [
      { name: 'clay-warm-flank', role: 'response', x: 212, y: 88, width: 12, height: 24 },
      { name: 'clay-cool-flank', role: 'response', x: 256, y: 88, width: 12, height: 24 },
      { name: 'clay-centre', role: 'response', x: 232, y: 88, width: 12, height: 20 },
      { name: 'sand-lit-front-shoulder', role: 'response', x: 42, y: 52, width: 12, height: 14 },
      { name: 'sand-wall-umbra', role: 'response', x: 42, y: 76, width: 12, height: 18 },
      { name: 'sand-open-shoulder', role: 'response', x: 42, y: 106, width: 12, height: 14 },
      { name: 'authored-hole', role: 'control', x: 209, y: 71, width: 4, height: 5 },
      { name: 'fine-structure-context', role: 'response', x: 228, y: 139, width: 16, height: 16 },
      { name: 'wet-suspension', role: 'response', x: 84, y: 256, width: 16, height: 24 },
      { name: 'native-wall', role: 'control', x: 246, y: 220, width: 12, height: 12 },
      { name: 'guarded-blank', role: 'control', x: 280, y: 240, width: 40, height: 35 },
    ],
  }],
});
