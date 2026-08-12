/**
 * Frozen data-only authoring for the configured-source target atlas. Numeric
 * material/state IDs are part of the public particle ABI. This catalog grants
 * no fixture, renderer, browser, capture, or evidence execution authority.
 */

export const SOURCE_TARGET_MATERIAL_LIGHTING_ATLAS_CATALOG_SCHEMA = (
  'anifor.visual-lab.source-target-material-lighting-atlas-catalog/v1'
);

const owners = [
  { material: 126, code: 'CLNE' },
  { material: 124, code: 'BCLN' },
  { material: 159, code: 'PCLN' },
  { material: 158, code: 'PBCN' },
  { material: 127, code: 'CONV' },
  { material: 137, code: 'CRAY' },
];

const targets = [
  { material: 1, code: 'SAND', family: 'powder' },
  { material: 2, code: 'WATR', family: 'liquid' },
  { material: 39, code: 'OXYG', family: 'gas' },
  { material: 107, code: 'PHOT', family: 'energy' },
  { material: 23, code: 'METL', family: 'rigid' },
  { material: 10, code: 'PLNT', family: 'organic' },
  { material: 217, code: 'BCOL', family: 'high-id-powder' },
];

const columns = 7;
const rows = 6;
const cards = owners.flatMap((owner, row) => targets.map((target, column) => {
  const card = { x: 8 + column * 84, y: 4 + row * 64, width: 80, height: 60 };
  return {
    owner: owner.material,
    ownerCode: owner.code,
    target: target.material,
    targetCode: target.code,
    targetFamily: target.family,
    encodedState: target.material,
    row,
    column,
    index: row * columns + column,
    card,
    body: { x: card.x + 4, y: card.y + 4, width: 32, height: 28 },
    ownerShellProbe: { x: card.x + 6, y: card.y + 6, width: 6, height: 6 },
    targetAccentProbe: { x: card.x + 22, y: card.y + 6, width: 6, height: 6 },
    authoredHole: { x: card.x + 16, y: card.y + 14, width: 4, height: 4 },
    openNotch: { x: card.x + 28, y: card.y + 20, width: 8, height: 6 },
    thinStructure: { x: card.x + 5, y: card.y + 36, width: 1, height: 12 },
    isolated: { x: card.x + 20, y: card.y + 50 },
    zeroState: { x: card.x + 44, y: card.y + 4, width: 10, height: 10 },
    wrongOwner: { x: card.x + 64, y: card.y + 4, width: 12, height: 10 },
    targetControl: { x: card.x + 44, y: card.y + 20, width: 12, height: 10 },
    wallCoexistence: { x: card.x + 60, y: card.y + 20, width: 12, height: 12 },
    guardedBlank: { x: card.x + 40, y: card.y + 36, width: 36, height: 20 },
  };
}));

const namedRegion = (name, role, rect) => ({ name, role, ...rect });
const inspectionRegions = [
  ...cards.map((card) => namedRegion(
    `${card.ownerCode.toLowerCase()}-${card.targetCode.toLowerCase()}-body`,
    'response', card.body,
  )),
  ...cards.slice(0, columns).map((card) => namedRegion(
    `clne-${card.targetCode.toLowerCase()}-target-control`, 'control', card.targetControl,
  )),
  ...cards.filter(({ column }) => column === 0).map((card) => namedRegion(
    `${card.ownerCode.toLowerCase()}-sand-zero-state`, 'control', card.zeroState,
  )),
  namedRegion('clne-sand-authored-hole', 'control', cards[0].authoredHole),
  namedRegion('bcln-watr-open-notch', 'control', cards[8].openNotch),
  namedRegion('pcln-oxyg-thin-structure', 'control', cards[16].thinStructure),
  namedRegion('pbcn-phot-isolated', 'control', {
    x: cards[24].isolated.x, y: cards[24].isolated.y, width: 1, height: 1,
  }),
  namedRegion('conv-metl-wrong-owner', 'control', cards[32].wrongOwner),
  namedRegion('cray-plnt-wall-coexistence', 'control', cards[40].wallCoexistence),
  namedRegion('clne-bcol-guarded-blank', 'control', cards[6].guardedBlank),
  namedRegion('clne-sand-wrong-owner', 'control', cards[0].wrongOwner),
  namedRegion('bcln-watr-wrong-owner', 'control', cards[8].wrongOwner),
];

const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
};

export const SOURCE_TARGET_MATERIAL_LIGHTING_ATLAS_CATALOG = deepFreeze({
  schema: SOURCE_TARGET_MATERIAL_LIGHTING_ATLAS_CATALOG_SCHEMA,
  atlases: [{
    candidate: 'source-target-material-lighting-atlas',
    world: { width: 612, height: 384 },
    descriptor: {
      materials: { empty: 0, sand: 1, metal: 23 },
      conductiveWall: 1,
      columns,
      rows,
      owners,
      targets,
      cards,
      recoveryProbe: { x: 548, y: 220, owner: 126, target: 217 },
      inspectionRegions,
    },
  }],
});
