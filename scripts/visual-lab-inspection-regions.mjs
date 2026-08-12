import { pathToFileURL } from 'node:url';

import {
  GAS_MATERIAL_LIGHTING_ATLAS_CATALOG,
} from '../src/shared/gas-material-lighting-atlas-catalog.js';
import {
  SOLID_MATERIAL_LIGHTING_ATLAS_CATALOG,
} from '../src/shared/solid-material-lighting-atlas-catalog.js';

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

const translateRect = (card, region) => ({
  x: card.x + region.x,
  y: card.y + region.y,
  width: region.width,
  height: region.height,
});

const boundingRect = (left, right) => {
  const x = Math.min(left.x, right.x);
  const y = Math.min(left.y, right.y);
  return {
    x,
    y,
    width: Math.max(left.x + left.width, right.x + right.width) - x,
    height: Math.max(left.y + left.height, right.y + right.height) - y,
  };
};

const namedRegion = (name, role, region) => ({ name, role, ...region });

/**
 * Projects one app-authored solid atlas into scripts-owned review annotations.
 * The projection carries geometry only: it grants no preparation, renderer,
 * capture, scoring, threshold, or promotion authority.
 */
export function projectSolidMaterialLightingAtlasInspectionFixture(atlas) {
  const { candidate, world, descriptor } = atlas;
  if (!SAFE_NAME.test(candidate ?? '') || !Array.isArray(descriptor?.definitions)
    || descriptor.definitions.length === 0 || !positiveBoundedInteger(descriptor.columns, 64)) {
    throw new TypeError('Solid material-lighting atlas inspection authoring is malformed');
  }
  const regions = descriptor.definitions.flatMap((definition, index) => {
    if (!/^[A-Z0-9]{2,8}$/.test(definition.code ?? '')) {
      throw new TypeError('Solid material-lighting atlas inspection code is malformed');
    }
    const column = index % descriptor.columns;
    const row = Math.floor(index / descriptor.columns);
    const card = {
      x: descriptor.origin.x + column * descriptor.stride.x,
      y: descriptor.origin.y + row * descriptor.stride.y,
    };
    const code = definition.code.toLowerCase();
    const contactOwner = translateRect(card, descriptor.template.contactOwner);
    const contactNeighbour = translateRect(card, descriptor.template.contactNeighbour);
    return [
      namedRegion(`${code}-body`, 'response', translateRect(card, descriptor.template.body)),
      namedRegion(`${code}-contact`, 'response', boundingRect(contactOwner, contactNeighbour)),
      namedRegion(`${code}-hole`, 'control', translateRect(card, descriptor.template.hole)),
      namedRegion(`${code}-open-notch`, 'control', translateRect(card, descriptor.template.openNotch)),
      namedRegion(`${code}-thin-structure`, 'control', translateRect(card, descriptor.template.thinStructure)),
      namedRegion(`${code}-isolated`, 'control', {
        x: card.x + descriptor.template.isolated.x,
        y: card.y + descriptor.template.isolated.y,
        width: 1,
        height: 1,
      }),
      namedRegion(`${code}-native-wall`, 'control', translateRect(card, descriptor.template.nativeWall)),
      namedRegion(`${code}-guarded-blank`, 'control', translateRect(card, descriptor.template.guardedBlank)),
    ];
  });
  return { candidate, world: { ...world }, regions };
}

/** Projects the gas atlas geometry into a compact, current-only review board. */
export function projectGasMaterialLightingAtlasInspectionFixture(atlas) {
  const { candidate, world, descriptor } = atlas;
  if (!SAFE_NAME.test(candidate ?? '') || descriptor === null || typeof descriptor !== 'object') {
    throw new TypeError('Gas material-lighting atlas inspection authoring is malformed');
  }
  const regions = [
    namedRegion('sooty-warm-flank', 'response', { x: 52, y: 112, width: 24, height: 28 }),
    namedRegion('sooty-core', 'response', { x: 176, y: 114, width: 24, height: 24 }),
    namedRegion('clean-core', 'response', { x: 442, y: 108, width: 24, height: 24 }),
    namedRegion('clean-cool-flank', 'response', { x: 522, y: 104, width: 20, height: 28 }),
    namedRegion('sooty-hole', 'control', descriptor.sootyHole),
    namedRegion('clean-channel', 'control', descriptor.cleanChannel),
    namedRegion('warm-emitter', 'control', descriptor.warmEmitter),
    namedRegion('cool-emitter', 'control', descriptor.coolEmitter),
    namedRegion('sparse-sooty-pair', 'control', boundingPoints(descriptor.sparseSooty.slice(0, 2))),
    namedRegion('sparse-clean-pair', 'control', boundingPoints(descriptor.sparseClean.slice(0, 2))),
    namedRegion('solid-contact-gas', 'response', descriptor.solidContact.gas),
    namedRegion('solid-contact-owner', 'control', descriptor.solidContact.solid),
    namedRegion('liquid-contact-gas', 'response', descriptor.liquidContact.gas),
    namedRegion('liquid-contact-owner', 'control', descriptor.liquidContact.liquid),
    namedRegion('foreign-gas-contact', 'response', boundingRect(
      descriptor.foreignGasContact.gas, descriptor.foreignGasContact.foreignGas,
    )),
    namedRegion('native-wall-gas', 'control', descriptor.nativeWall.gas),
    namedRegion('emissive-gas', 'response', descriptor.emissiveGas.body),
    namedRegion('guarded-blank', 'control', descriptor.guardedBlank),
  ];
  return { candidate, world: { ...world }, regions };
}

function boundingPoints(points) {
  if (!Array.isArray(points) || points.length === 0) {
    throw new TypeError('Gas material-lighting atlas inspection points are malformed');
  }
  const xs = points.map(({ x }) => x);
  const ys = points.map(({ y }) => y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs) + 1,
    height: Math.max(...ys) - Math.min(...ys) + 1,
  };
}

const SOLID_ATLAS_INSPECTION_FIXTURES = SOLID_MATERIAL_LIGHTING_ATLAS_CATALOG.atlases.map(
  projectSolidMaterialLightingAtlasInspectionFixture,
);
const GAS_ATLAS_INSPECTION_FIXTURES = GAS_MATERIAL_LIGHTING_ATLAS_CATALOG.atlases.map(
  projectGasMaterialLightingAtlasInspectionFixture,
);

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
  }, ...SOLID_ATLAS_INSPECTION_FIXTURES, ...GAS_ATLAS_INSPECTION_FIXTURES],
});

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  if (process.argv.length !== 3 || process.argv[2] !== '--check') {
    throw new TypeError('usage: node scripts/visual-lab-inspection-regions.mjs --check');
  }
  process.stdout.write(
    `visual inspection-region authoring is current (${VISUAL_LAB_INSPECTION_REGIONS.fixtures.length} fixtures)\n`,
  );
}
