/**
 * Data-only authoring for the paused ACEL/DCEL state board. Runtime and
 * current-only review tooling may project this frozen descriptor, but it
 * grants no browser, renderer, capture, scoring, or promotion authority.
 */

export const FORCE_ACTIVITY_MATERIAL_LIGHTING_ATLAS_CATALOG_SCHEMA = (
  'anifor.visual-lab.force-activity-material-lighting-atlas-catalog/v1'
);

const deepFreeze = (value) => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
};

const inactive = { key: 'inactive', active: false, encodedState: 0 };
const active = { key: 'active', active: true, encodedState: 1 };
const owners = [
  { material: 115, code: 'ACEL' },
  { material: 116, code: 'DCEL' },
];
const states = [inactive, active];
const layout = {
  columns: 2,
  rows: 2,
  origin: { x: 8, y: 8 },
  stride: { x: 296, y: 184 },
  cardSize: { width: 288, height: 176 },
};
const template = {
  body: { x: 8, y: 8, width: 112, height: 64 },
  surfaceProbe: { x: 12, y: 12, width: 8, height: 8 },
  coreProbe: { x: 20, y: 56, width: 8, height: 8 },
  motifAxisProbe: { x: 16, y: 40, width: 8, height: 8 },
  motifArrowProbe: { x: 32, y: 40, width: 8, height: 8 },
  motifBackgroundProbe: { x: 72, y: 40, width: 8, height: 8 },
  authoredHole: { x: 52, y: 34, width: 6, height: 6 },
  openNotch: { x: 108, y: 48, width: 12, height: 8 },
  thinStructure: { x: 10, y: 82, width: 1, height: 24 },
  isolated: { x: 38, y: 96 },
  wrongOwner: { x: 142, y: 8, width: 20, height: 16 },
  waterControl: { x: 142, y: 34, width: 20, height: 14 },
  metalControl: { x: 142, y: 56, width: 20, height: 14 },
  emitter: { x: 240, y: 8, width: 4, height: 40 },
  guardedBlank: { x: 136, y: 86, width: 80, height: 30 },
};
const offset = (part, card) => ({ ...part, x: card.x + part.x, y: card.y + part.y });
const cards = owners.flatMap((owner, row) => states.map((state, column) => {
  const card = {
    x: layout.origin.x + column * layout.stride.x,
    y: layout.origin.y + row * layout.stride.y,
    ...layout.cardSize,
  };
  return {
    material: owner.material,
    code: owner.code,
    stateKey: state.key,
    active: state.active,
    encodedState: state.encodedState,
    row,
    column,
    index: row * layout.columns + column,
    card,
    body: offset(template.body, card),
    surfaceProbe: offset(template.surfaceProbe, card),
    coreProbe: offset(template.coreProbe, card),
    motifAxisProbe: offset(template.motifAxisProbe, card),
    motifArrowProbe: offset(template.motifArrowProbe, card),
    motifBackgroundProbe: offset(template.motifBackgroundProbe, card),
    authoredHole: offset(template.authoredHole, card),
    openNotch: offset(template.openNotch, card),
    thinStructure: offset(template.thinStructure, card),
    isolated: offset(template.isolated, card),
    wrongOwner: offset(template.wrongOwner, card),
    waterControl: offset(template.waterControl, card),
    metalControl: offset(template.metalControl, card),
    emitter: offset(template.emitter, card),
    guardedBlank: offset(template.guardedBlank, card),
  };
}));
const namedRegion = (name, role, rect) => ({ name, role, ...rect });
const [acelInactive, acelActive, dcelInactive, dcelActive] = cards;
const inspectionRegions = [
  ...cards.map((card) => namedRegion(
    `${card.code.toLowerCase()}-${card.stateKey}-body`, 'response', card.body,
  )),
  namedRegion('acel-active-motif-arrow', 'response', acelActive.motifArrowProbe),
  namedRegion('dcel-active-motif-arrow', 'response', dcelActive.motifArrowProbe),
  namedRegion('acel-inactive-motif-background', 'control', acelInactive.motifBackgroundProbe),
  namedRegion('dcel-inactive-motif-background', 'control', dcelInactive.motifBackgroundProbe),
  namedRegion('acel-active-authored-hole', 'control', acelActive.authoredHole),
  namedRegion('acel-active-open-notch', 'control', acelActive.openNotch),
  namedRegion('acel-active-thin-structure', 'control', acelActive.thinStructure),
  namedRegion('acel-active-isolated', 'control', {
    ...acelActive.isolated, width: 1, height: 1,
  }),
  namedRegion('acel-active-wrong-owner', 'control', acelActive.wrongOwner),
  namedRegion('acel-active-water-control', 'control', acelActive.waterControl),
  namedRegion('acel-active-metal-control', 'control', acelActive.metalControl),
  namedRegion('acel-active-emitter', 'control', acelActive.emitter),
  namedRegion('acel-active-guarded-blank', 'control', acelActive.guardedBlank),
];

export const FORCE_ACTIVITY_MATERIAL_LIGHTING_ATLAS_CATALOG = deepFreeze({
  schema: FORCE_ACTIVITY_MATERIAL_LIGHTING_ATLAS_CATALOG_SCHEMA,
  atlases: [{
    candidate: 'force-activity-material-lighting-atlas',
    world: { width: 612, height: 384 },
    descriptor: {
      materials: {
        empty: 0, sand: 1, water: 2, fire: 4, metal: 23, acel: 115, dcel: 116,
      },
      owners,
      states,
      layout,
      template,
      cards,
      inspectionRegions,
    },
  }],
});
