/**
 * Data-only authoring for the paused cross-phase material-lighting board.
 * Runtime and current-only review tooling project the same frozen descriptor;
 * it grants no browser, renderer, capture, scoring, or promotion authority.
 */

export const MATERIAL_LIGHTING_ATLAS_CATALOG_SCHEMA = (
  'anifor.visual-lab.material-lighting-atlas-catalog/v1'
);

const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
};

const powder = {
  sand: { x: 28, y: 82, width: 144, height: 116 },
  clay: { x: 28, y: 218, width: 144, height: 98 },
  hole: { x: 92, y: 122, width: 12, height: 14 },
  fineColumn: { x: 184, y: 198, width: 1, height: 76 },
  warmEmitter: { x: 18, y: 106, width: 5, height: 68 },
};
const liquid = {
  water: { x: 224, y: 72, width: 152, height: 108 },
  oil: { x: 224, y: 204, width: 152, height: 104 },
  waterHole: { x: 286, y: 112, width: 14, height: 12 },
  oilChimney: { x: 336, y: 204, width: 10, height: 42 },
  coolEmitter: { x: 386, y: 92, width: 5, height: 72 },
};
const gas = {
  smoke: {
    bounds: { x: 430, y: 64, width: 154, height: 112 },
    probe: { x: 508, y: 120 },
    lobes: [
      { x: 508, y: 120, radiusX: 61, radiusY: 43 },
      { x: 468, y: 102, radiusX: 32, radiusY: 27 },
      { x: 550, y: 136, radiusX: 30, radiusY: 25 },
    ],
  },
  fog: {
    bounds: { x: 430, y: 208, width: 154, height: 104 },
    probe: { x: 512, y: 260 },
    lobes: [
      { x: 512, y: 260, radiusX: 69, radiusY: 37 },
      { x: 465, y: 278, radiusX: 31, radiusY: 24 },
      { x: 554, y: 238, radiusX: 34, radiusY: 27 },
    ],
  },
  smokeHole: { x: 496, y: 106, width: 16, height: 14 },
  fogChannel: { x: 430, y: 208, width: 12, height: 42 },
  warmEmitter: { x: 420, y: 86, width: 5, height: 70 },
  coolEmitter: { x: 590, y: 228, width: 5, height: 66 },
  sparseSmoke: [{ x: 456, y: 340 }, { x: 458, y: 340 }, { x: 486, y: 340 }],
};
const guardedBlank = { x: 198, y: 334, width: 210, height: 28 };
const reviewAnchors = {
  sandBody: { x: 40, y: 94, width: 48, height: 40 },
  clayBody: { x: 40, y: 230, width: 48, height: 40 },
  waterBody: { x: 238, y: 86, width: 48, height: 38 },
  oilBody: { x: 238, y: 218, width: 48, height: 38 },
  smokeWarmFlank: { x: 452, y: 94, width: 24, height: 28 },
  smokeCore: { x: 496, y: 120, width: 24, height: 24 },
  fogCore: { x: 500, y: 248, width: 24, height: 24 },
  fogCoolFlank: { x: 548, y: 244, width: 22, height: 28 },
};

export const MATERIAL_LIGHTING_ATLAS_CATALOG = deepFreeze({
  schema: MATERIAL_LIGHTING_ATLAS_CATALOG_SCHEMA,
  atlases: [{
    candidate: 'material-lighting-atlas',
    world: { width: 612, height: 384 },
    descriptor: {
      materials: {
        empty: 0, sand: 1, water: 2, fire: 4, smoke: 5, oil: 8,
        clay: 28, fog: 65, liquidCoolEmitter: 101, gasCoolEmitter: 103,
      },
      powder,
      liquid,
      gas,
      guardedBlank,
      inspectionRegions: [
        { name: 'sand-body', role: 'response', ...reviewAnchors.sandBody },
        { name: 'clay-body', role: 'response', ...reviewAnchors.clayBody },
        { name: 'water-body', role: 'response', ...reviewAnchors.waterBody },
        { name: 'oil-body', role: 'response', ...reviewAnchors.oilBody },
        { name: 'smoke-warm-flank', role: 'response', ...reviewAnchors.smokeWarmFlank },
        { name: 'smoke-core', role: 'response', ...reviewAnchors.smokeCore },
        { name: 'fog-core', role: 'response', ...reviewAnchors.fogCore },
        { name: 'fog-cool-flank', role: 'response', ...reviewAnchors.fogCoolFlank },
        { name: 'powder-hole', role: 'control', ...powder.hole },
        { name: 'powder-fine-column', role: 'control', ...powder.fineColumn },
        { name: 'powder-warm-emitter', role: 'control', ...powder.warmEmitter },
        { name: 'water-hole', role: 'control', ...liquid.waterHole },
        { name: 'oil-chimney', role: 'control', ...liquid.oilChimney },
        { name: 'liquid-cool-emitter', role: 'control', ...liquid.coolEmitter },
        { name: 'smoke-hole', role: 'control', ...gas.smokeHole },
        { name: 'fog-channel', role: 'control', ...gas.fogChannel },
        { name: 'gas-warm-emitter', role: 'control', ...gas.warmEmitter },
        { name: 'gas-cool-emitter', role: 'control', ...gas.coolEmitter },
        { name: 'sparse-smoke', role: 'control', x: 456, y: 340, width: 3, height: 1 },
        { name: 'guarded-blank', role: 'control', ...guardedBlank },
      ],
    },
  }],
});
