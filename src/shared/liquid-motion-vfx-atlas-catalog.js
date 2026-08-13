/**
 * Data-only authoring for the paused Water-motion fixture and its current-only
 * inspection board. Runtime preparation and review tooling project the same
 * frozen geometry without granting this catalog execution authority.
 */

export const LIQUID_MOTION_VFX_ATLAS_CATALOG_SCHEMA = (
  'anifor.visual-lab.liquid-motion-vfx-atlas-catalog/v1'
);

const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
};

const pool = (code, x, velocity) => ({
  code,
  material: 2,
  body: { x, y: 32, width: 220, height: 112 },
  airFacingSurface: { x: x + 12, y: 32, width: 120, height: 1 },
  core: { x: x + 28, y: 96, width: 48, height: 24 },
  authoredHole: { x: x + 88, y: 86, width: 14, height: 12 },
  openChimney: { x: x + 162, y: 32, width: 10, height: 50 },
  velocity,
});

const boundary = (code, x, otherMaterial) => ({
  code,
  water: { x, y: 280, width: 64, height: 40 },
  other: { x: x + 64, y: 280, width: 56, height: 40 },
  otherMaterial,
  waterProbe: { x: x + 63, y: 300 },
  otherProbe: { x: x + 64, y: 300 },
});

const pools = [
  pool('STILL_WATER', 24, { x: 0, y: 0 }),
  pool('MOVING_WATER', 292, { x: 28, y: -12 }),
];
const moving = {
  strand: { x: 532, y: 166, width: 1, height: 56, material: 2, velocity: { x: 30, y: -22 } },
  isolated: { x: 568, y: 198, material: 2, velocity: { x: -34, y: 16 } },
  oil: { x: 24, y: 206, width: 96, height: 52, material: 8, velocity: { x: -24, y: 20 } },
  acid: { x: 144, y: 206, width: 96, height: 52, material: 13, velocity: { x: 18, y: 22 } },
};
const contacts = {
  waterMetal: boundary('WATR_METL', 24, 23),
  waterOil: boundary('WATR_OIL', 264, 8),
};
const wallCoexistence = {
  kind: 'native-wall-checker',
  region: { x: 440, y: 88, width: 56, height: 44 },
  blockSize: 4,
  occupiedParity: 0,
  wallProbe: { x: 441, y: 89 },
  clearProbe: { x: 445, y: 89 },
};
const guardedBlank = { x: 16, y: 344, width: 560, height: 24 };
const inspectionRect = (name, role, area) => ({
  name, role, x: area.x, y: area.y, width: area.width, height: area.height,
});
const inspectionPoint = (name, role, point) => ({
  name, role, x: point.x, y: point.y, width: 1, height: 1,
});

const fixture = {
  version: 1,
  world: { width: 612, height: 384 },
  pools,
  moving,
  contacts,
  wallCoexistence,
  guardedBlank,
  conductiveWall: 1,
  expected: {
    waterCells: 53_121,
    oilCells: 7_232,
    acidCells: 4_992,
    metalCells: 2_240,
    wallCells: 1_232,
    movingVelocityCells: 34_013,
  },
};

export const LIQUID_MOTION_VFX_ATLAS_CATALOG = deepFreeze({
  schema: LIQUID_MOTION_VFX_ATLAS_CATALOG_SCHEMA,
  atlases: [{
    candidate: 'water-motion',
    world: fixture.world,
    descriptor: {
      fixture,
      inspectionRegions: [
        inspectionRect('still-water-surface', 'response', pools[0].airFacingSurface),
        inspectionRect('still-water-core', 'response', pools[0].core),
        inspectionRect('moving-water-surface', 'response', pools[1].airFacingSurface),
        inspectionRect('moving-water-core', 'response', pools[1].core),
        inspectionRect('moving-water-strand', 'response', moving.strand),
        inspectionPoint('moving-water-isolated', 'response', moving.isolated),
        inspectionRect('water-metal-contact', 'response', contacts.waterMetal.water),
        inspectionRect('water-oil-contact', 'response', contacts.waterOil.water),
        inspectionRect('still-water-hole', 'control', pools[0].authoredHole),
        inspectionRect('moving-water-hole', 'control', pools[1].authoredHole),
        inspectionRect('still-water-chimney', 'control', pools[0].openChimney),
        inspectionRect('moving-water-chimney', 'control', pools[1].openChimney),
        inspectionRect('moving-oil-control', 'control', moving.oil),
        inspectionRect('moving-acid-control', 'control', moving.acid),
        inspectionRect('metal-contact-owner', 'control', contacts.waterMetal.other),
        inspectionRect('oil-contact-owner', 'control', contacts.waterOil.other),
        inspectionRect('native-wall-water', 'control', wallCoexistence.region),
        inspectionRect('guarded-blank', 'control', guardedBlank),
      ],
    },
  }],
});
