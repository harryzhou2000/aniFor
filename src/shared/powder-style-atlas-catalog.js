/**
 * Data-only authoring for the paused powder-style board. Runtime and
 * current-only review tooling may project this frozen geometry, but it grants
 * no browser, renderer, capture, scoring, or promotion authority.
 */

export const POWDER_STYLE_ATLAS_CATALOG_SCHEMA = (
  'anifor.visual-lab.powder-style-atlas-catalog/v1'
);

const deepFreeze = (value) => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
};

const bulk = {
  sandProbe: { x: 136, y: 240 },
  clayProbe: { x: 315, y: 258 },
  sandPile: { left: 24, right: 246, peakX: 122, peakY: 116, baseY: 304 },
  clayPile: { left: 224, right: 394, peakX: 311, peakY: 166, baseY: 304 },
};
const fine = {
  clayStem: { x: 420, y: 76, width: 1, height: 88 },
  clayLedge: { x: 420, y: 163, width: 42, height: 1 },
  concreteRidge: { x: 432, y: 178, width: 146, height: 56 },
  authoredHole: { x: 486, y: 202, width: 7, height: 7 },
  concreteProbe: { x: 450, y: 220 },
};
const grains = {
  sand: { x: 248, y: 54 },
  clay: { x: 270, y: 54 },
  concreteDiagonal: [{ x: 292, y: 54 }, { x: 293, y: 55 }],
};
const unstableControl = [{ x: 330, y: 56 }, { x: 331, y: 57 }];
const wetContact = {
  powder: { x: 420, y: 284, width: 30, height: 28 },
  water: { x: 450, y: 284, width: 34, height: 28 },
  powderProbe: { x: 434, y: 298 },
  waterProbe: { x: 466, y: 298 },
};
const wallCoexistence = { x: 540, y: 276, width: 32, height: 32 };
const wallProbe = { x: 548, y: 284 };
const blank = { x: 290, y: 334, width: 120, height: 28 };
const blankProbe = { x: 350, y: 348 };

export const POWDER_STYLE_ATLAS_CATALOG = deepFreeze({
  schema: POWDER_STYLE_ATLAS_CATALOG_SCHEMA,
  atlases: [{
    candidate: 'powder-style-atlas',
    world: { width: 612, height: 384 },
    descriptor: {
      materials: { empty: 0, sand: 1, water: 2, concrete: 26, clay: 28 },
      conductiveWall: 1,
      bulk,
      fine,
      grains,
      unstableControl,
      wetContact,
      wallCoexistence,
      wallProbe,
      blank,
      blankProbe,
      inspectionRegions: [
        { name: 'sand-pile-bulk', role: 'response', x: 104, y: 206, width: 36, height: 52 },
        { name: 'sand-pile-surface', role: 'response', x: 112, y: 124, width: 24, height: 16 },
        { name: 'clay-pile-bulk', role: 'response', x: 294, y: 244, width: 32, height: 40 },
        { name: 'clay-pile-surface', role: 'response', x: 302, y: 174, width: 20, height: 16 },
        { name: 'concrete-ridge', role: 'response', x: 438, y: 212, width: 34, height: 16 },
        { name: 'wet-powder', role: 'response', x: 426, y: 290, width: 18, height: 16 },
        { name: 'wet-water', role: 'response', x: 456, y: 290, width: 20, height: 16 },
        { name: 'clay-stem', role: 'control', ...fine.clayStem },
        { name: 'clay-ledge', role: 'control', ...fine.clayLedge },
        { name: 'concrete-hole', role: 'control', ...fine.authoredHole },
        { name: 'sand-grain', role: 'control', x: grains.sand.x, y: grains.sand.y, width: 1, height: 1 },
        { name: 'clay-grain', role: 'control', x: grains.clay.x, y: grains.clay.y, width: 1, height: 1 },
        { name: 'concrete-diagonal', role: 'control', x: 292, y: 54, width: 2, height: 2 },
        { name: 'unstable-grains', role: 'control', x: 330, y: 56, width: 2, height: 2 },
        { name: 'wall-coexistence', role: 'control', ...wallCoexistence },
        { name: 'guarded-blank', role: 'control', ...blank },
      ],
    },
  }],
});
