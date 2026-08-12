/**
 * Data-only authoring catalog for paused solid material-lighting boards.
 * The app projects these descriptors into simulation fixtures; Node tooling
 * projects the same geometry into current-only inspection regions. This is not
 * a browser execution contract and grants no renderer or capture authority.
 */

export const SOLID_MATERIAL_LIGHTING_ATLAS_CATALOG_SCHEMA = (
  'anifor.visual-lab.solid-material-lighting-atlas-catalog/v1'
);

const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
};

export const SOLID_MATERIAL_LIGHTING_ATLAS_CATALOG = deepFreeze({
  schema: SOLID_MATERIAL_LIGHTING_ATLAS_CATALOG_SCHEMA,
  atlases: [{
    candidate: 'solid-material-lighting-atlas',
    world: { width: 612, height: 384 },
    descriptor: {
      definitions: [
        { material: 22, code: 'BRCK' },
        { material: 23, code: 'METL' },
        { material: 25, code: 'CRMC' },
        { material: 24, code: 'GLAS' },
        { material: 12, code: 'ICE' },
        { material: 9, code: 'WOOD' },
        { material: 136, code: 'BTRY' },
        { material: 105, code: 'ISZS' },
      ],
      columns: 4,
      origin: { x: 6, y: 6 },
      stride: { x: 152, y: 190 },
      cardSize: { width: 146, height: 184 },
      conductiveWall: 1,
      template: {
        body: { x: 10, y: 12, width: 72, height: 62 },
        hole: { x: 42, y: 38, width: 8, height: 8 },
        openNotch: { x: 81, y: 48, width: 1, height: 12 },
        thinStructure: { x: 96, y: 20, width: 1, height: 70 },
        isolated: { x: 108, y: 108 },
        contactOwner: { x: 12, y: 146, width: 16, height: 14 },
        contactNeighbour: { x: 28, y: 146, width: 16, height: 14 },
        nativeWall: { x: 116, y: 20, width: 20, height: 20 },
        emitter: { x: 86, y: 22, width: 3, height: 44 },
        guardedBlank: { x: 50, y: 116, width: 66, height: 18 },
      },
    },
  }, {
    candidate: 'multi-metal-material-lighting-atlas',
    world: { width: 612, height: 384 },
    descriptor: {
      definitions: [
        { material: 23, code: 'METL' },
        { material: 67, code: 'BMTL' },
        { material: 70, code: 'GOLD' },
        { material: 73, code: 'IRON' },
        { material: 75, code: 'PTNM' },
        { material: 82, code: 'TTAN' },
      ],
      columns: 3,
      origin: { x: 6, y: 6 },
      stride: { x: 202, y: 190 },
      cardSize: { width: 196, height: 184 },
      conductiveWall: 1,
      template: {
        body: { x: 10, y: 12, width: 112, height: 82 },
        hole: { x: 56, y: 38, width: 12, height: 10 },
        openNotch: { x: 121, y: 56, width: 1, height: 14 },
        thinStructure: { x: 150, y: 18, width: 1, height: 78 },
        isolated: { x: 170, y: 108 },
        contactOwner: { x: 12, y: 146, width: 22, height: 14 },
        contactNeighbour: { x: 34, y: 146, width: 22, height: 14 },
        nativeWall: { x: 166, y: 20, width: 20, height: 20 },
        emitter: { x: 126, y: 22, width: 4, height: 54 },
        guardedBlank: { x: 70, y: 118, width: 90, height: 18 },
      },
    },
  }],
});
