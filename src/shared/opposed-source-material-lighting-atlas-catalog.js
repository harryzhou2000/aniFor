/**
 * Data-only authoring for the paused opposed-source powder board. Runtime and
 * current-only inspection tooling consume the same frozen geometry; this data
 * grants no browser, renderer, capture, scoring, or promotion authority.
 */

export const OPPOSED_SOURCE_MATERIAL_LIGHTING_ATLAS_CATALOG_SCHEMA = (
  'anifor.visual-lab.opposed-source-material-lighting-atlas-catalog/v1'
);

const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
};

const card = (material, code, x) => ({
  material,
  code,
  body: { x, y: 40, width: 72, height: 92 },
  warmSource: { x: x - 5, y: 50, width: 3, height: 72 },
  coolSource: { x: x + 74, y: 50, width: 3, height: 72 },
  warmGap: { x: x - 2, y: 50, width: 2, height: 72 },
  coolGap: { x: x + 72, y: 50, width: 2, height: 72 },
  authoredHole: { x: x + 5, y: 71, width: 4, height: 5 },
  fineColumn: { x: x + 35, y: 145, width: 1, height: 3 },
  fineSource: { x: x + 27, y: 142, width: 3, height: 10 },
  fineGap: { x: x + 30, y: 142, width: 5, height: 10 },
  darkCore: { x: x + 43, y: 96, width: 8, height: 16 },
});

const cards = [card(1, 'SAND', 40), card(28, 'CLAY', 204), card(26, 'CONC', 368)];
const wetSuspension = {
  water: { x: 38, y: 210, width: 158, height: 104 },
  mixture: { x: 84, y: 244, width: 66, height: 46 },
  source: { x: 76, y: 248, width: 3, height: 38 },
  gap: { x: 79, y: 248, width: 5, height: 38 },
  lightFacingSand: { x: 85, y: 267 },
  sandWeave: { period: 3, sandResidues: [0, 1] },
};
const transportOccluder = {
  wall: { x: 38, y: 70, width: 2, height: 30 },
  litFrontShoulder: { x: 42, y: 52, width: 12, height: 14 },
  umbra: { x: 42, y: 76, width: 12, height: 18 },
  openShoulder: { x: 42, y: 106, width: 12, height: 14 },
};
const wallFreeControl = { x: 270, y: 224, width: 68, height: 70 };

export const OPPOSED_SOURCE_MATERIAL_LIGHTING_ATLAS_CATALOG = deepFreeze({
  schema: OPPOSED_SOURCE_MATERIAL_LIGHTING_ATLAS_CATALOG_SCHEMA,
  atlases: [{
    candidate: 'opposed-source-material-lighting-atlas',
    world: { width: 612, height: 384 },
    descriptor: {
      materials: { empty: 0, sand: 1, water: 2, fire: 4, concrete: 26, clay: 28, elec: 101 },
      conductiveWall: 1,
      cards,
      isolatedSand: { x: 193, y: 80 },
      wetSuspension,
      nativeWall: { x: 250, y: 224 },
      transportOccluder,
      wallFreeControl,
      inspectionRegions: [
        { name: 'clay-warm-flank', role: 'response', x: 212, y: 88, width: 12, height: 24 },
        { name: 'clay-cool-flank', role: 'response', x: 256, y: 88, width: 12, height: 24 },
        { name: 'clay-centre', role: 'response', x: 232, y: 88, width: 12, height: 20 },
        { name: 'sand-lit-front-shoulder', role: 'response', ...transportOccluder.litFrontShoulder },
        { name: 'sand-wall-umbra', role: 'response', ...transportOccluder.umbra },
        { name: 'sand-open-shoulder', role: 'response', ...transportOccluder.openShoulder },
        { name: 'authored-hole', role: 'control', ...cards[1].authoredHole },
        { name: 'fine-structure-context', role: 'response', x: 228, y: 139, width: 16, height: 16 },
        { name: 'wet-suspension', role: 'response', x: 84, y: 256, width: 16, height: 24 },
        { name: 'native-wall', role: 'control', x: 246, y: 220, width: 12, height: 12 },
        { name: 'guarded-blank', role: 'control', x: 280, y: 240, width: 40, height: 35 },
      ],
    },
  }],
});
