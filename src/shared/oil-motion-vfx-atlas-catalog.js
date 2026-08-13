/** Data-only authoring for the paused Oil-motion fixture and inspection board. */

export const OIL_MOTION_VFX_ATLAS_CATALOG_SCHEMA = (
  'anifor.visual-lab.oil-motion-vfx-atlas-catalog/v1'
);

const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
};

const target = {
  material: 8,
  body: { x: 20, y: 24, width: 260, height: 150 },
  airFacingTop: { x: 100, y: 24, width: 108, height: 1 },
  airFacingLeft: { x: 20, y: 64, width: 1, height: 72 },
  airFacingRight: { x: 279, y: 64, width: 1, height: 72 },
  core: { x: 52, y: 112, width: 40, height: 24 },
  authoredHole: { x: 112, y: 82, width: 18, height: 16 },
  openChimney: { x: 220, y: 24, width: 12, height: 52 },
  velocity: { x: 30, y: -18 },
};
const boundary = (code, x, otherMaterial, velocity) => ({
  code,
  oil: { x, y: 300, width: 80, height: 40 },
  other: { x: x + 80, y: 300, width: 64, height: 40 },
  otherMaterial,
  oilProbe: { x: x + 79, y: 300 },
  otherProbe: { x: x + 80, y: 300 },
  velocity,
});
const stationaryOil = { x: 320, y: 24, width: 160, height: 100, material: 8 };
const movingSiblings = {
  water: { x: 20, y: 204, width: 96, height: 56, material: 2, velocity: { x: -26, y: 16 } },
  acid: { x: 132, y: 204, width: 96, height: 56, material: 13, velocity: { x: 20, y: 22 } },
  diesel: { x: 244, y: 204, width: 96, height: 56, material: 35, velocity: { x: 24, y: -14 } },
  nitro: { x: 356, y: 204, width: 96, height: 56, material: 32, velocity: { x: -18, y: -20 } },
};
const movingOil = {
  thin: { x: 494, y: 196, width: 1, height: 60, material: 8, velocity: { x: 28, y: -16 } },
  isolated: { x: 540, y: 220, material: 8, velocity: { x: -32, y: 18 } },
};
const seams = [
  boundary('OIL_WATR', 20, 2, { x: 24, y: -16 }),
  boundary('OIL_DESL', 220, 35, { x: -22, y: -18 }),
];
const wallCoexistence = {
  region: { x: 20, y: 24, width: 72, height: 32 },
  blockSize: 4,
  wall: 1,
  wallProbe: { x: 21, y: 24 },
};
const guardedBlank = { x: 24, y: 352, width: 548, height: 20 };
const inspectionRect = (name, role, area) => ({
  name, role, x: area.x, y: area.y, width: area.width, height: area.height,
});
const inspectionPoint = (name, role, point) => ({
  name, role, x: point.x, y: point.y, width: 1, height: 1,
});
const fixture = {
  version: 1,
  world: { width: 612, height: 384 },
  target,
  stationaryOil,
  movingSiblings,
  movingOil,
  seams,
  wallCoexistence,
  guardedBlank,
  expected: {
    oilCells: 60_549,
    waterCells: 7_936,
    acidCells: 5_376,
    dieselCells: 7_936,
    nitroCells: 5_376,
    wallCells: 2_304,
    movingVelocityCells: 66_053,
  },
};

export const OIL_MOTION_VFX_ATLAS_CATALOG = deepFreeze({
  schema: OIL_MOTION_VFX_ATLAS_CATALOG_SCHEMA,
  atlases: [{
    candidate: 'oil-motion',
    world: fixture.world,
    descriptor: {
      fixture,
      inspectionRegions: [
        inspectionRect('moving-oil-top', 'response', target.airFacingTop),
        inspectionRect('moving-oil-left', 'response', target.airFacingLeft),
        inspectionRect('moving-oil-right', 'response', target.airFacingRight),
        inspectionRect('moving-oil-core', 'response', target.core),
        inspectionRect('stationary-oil', 'response', stationaryOil),
        inspectionRect('moving-oil-thin', 'response', movingOil.thin),
        inspectionPoint('moving-oil-isolated', 'response', movingOil.isolated),
        inspectionRect('oil-water-contact', 'response', seams[0].oil),
        inspectionRect('oil-diesel-contact', 'response', seams[1].oil),
        inspectionRect('oil-hole', 'control', target.authoredHole),
        inspectionRect('oil-chimney', 'control', target.openChimney),
        inspectionRect('moving-water-control', 'control', movingSiblings.water),
        inspectionRect('moving-acid-control', 'control', movingSiblings.acid),
        inspectionRect('moving-diesel-control', 'control', movingSiblings.diesel),
        inspectionRect('moving-nitro-control', 'control', movingSiblings.nitro),
        inspectionRect('water-contact-owner', 'control', seams[0].other),
        inspectionRect('diesel-contact-owner', 'control', seams[1].other),
        inspectionRect('native-wall-oil', 'control', wallCoexistence.region),
        inspectionRect('guarded-blank', 'control', guardedBlank),
      ],
    },
  }],
});
