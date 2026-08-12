/**
 * Data-only authoring for the paused Ceramic temperature atlas. It records
 * native material, wall, and Uint16 temperature expectations but grants no
 * browser, renderer, capture, scoring, or promotion authority.
 */

export const THERMAL_SOURCE_MATERIAL_LIGHTING_ATLAS_CATALOG_SCHEMA = (
  'anifor.visual-lab.thermal-source-material-lighting-atlas-catalog/v1'
);

const deepFreeze = (value) => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
};

const definitions = [
  { key: 'ambient', temperature: 2_952 },
  { key: 'onset', temperature: 8_192 },
  { key: 'warm', temperature: 12_288 },
  { key: 'orange', temperature: 15_360 },
  { key: 'bright', temperature: 23_040 },
];

const card = ({ key, temperature }, index) => {
  const x = 4 + index * 120;
  const body = { x: x + 8, y: 16, width: 80, height: 72 };
  return {
    key,
    temperature,
    material: 25,
    temperatureByte: Math.floor(temperature / 256),
    card: { x, y: 8, width: 116, height: 360 },
    body,
    core: { x: body.x + 48, y: body.y + 46, width: 16, height: 16 },
    authoredHole: { x: body.x + 26, y: body.y + 24, width: 8, height: 8 },
    openNotch: { x: body.x + body.width - 1, y: body.y + 42, width: 1, height: 12 },
    thinLine: { x: x + 92, y: 16, width: 1, height: 64 },
    isolated: { x: x + 100, y: 84 },
    wallCoexistence: { x: x + 92, y: 104, width: 24, height: 24 },
    waterContact: {
      ceramic: { x: x + 8, y: 144, width: 28, height: 20 },
      water: { x: x + 36, y: 144, width: 20, height: 20 },
    },
    hotControls: {
      brick: { x: x + 60, y: 144, width: 20, height: 20, material: 22 },
      metal: { x: x + 84, y: 144, width: 20, height: 20, material: 23 },
    },
    guardedBlank: { x: x + 8, y: 184, width: 100, height: 48 },
  };
};

const cards = definitions.map(card);
const bright = cards[4];

export const THERMAL_SOURCE_MATERIAL_LIGHTING_ATLAS_CATALOG = deepFreeze({
  schema: THERMAL_SOURCE_MATERIAL_LIGHTING_ATLAS_CATALOG_SCHEMA,
  atlases: [{
    candidate: 'thermal-source-material-lighting-atlas',
    world: { width: 612, height: 384 },
    descriptor: {
      snapshot: {
        version: 1,
        world: { width: 612, height: 384 },
        material: 25,
        ambientTemperature: 2_952,
        conductiveWall: 1,
        wallBlockSize: 4,
        expected: {
          ceramicCells: 34_425,
          waterCells: 2_000,
          brickCells: 2_000,
          metalCells: 2_000,
          wallCells: 1_440,
          temperatureCounts: [
            { temperature: 2_952, cells: 203_468 },
            { temperature: 8_192, cells: 6_885 },
            { temperature: 12_288, cells: 6_885 },
            { temperature: 15_360, cells: 6_885 },
            { temperature: 23_040, cells: 10_885 },
          ],
          materialHash: 2_538_147_332,
          temperatureHash: 1_678_827_139,
          wallHash: 1_396_481_125,
        },
      },
      materials: { empty: 0, water: 2, fire: 4, brick: 22, metal: 23, ceramic: 25 },
      cards,
      inspectionRegions: [
        { name: 'ambient-core', role: 'response', ...cards[0].core },
        { name: 'onset-core', role: 'response', ...cards[1].core },
        { name: 'warm-core', role: 'response', ...cards[2].core },
        { name: 'orange-core', role: 'response', ...cards[3].core },
        { name: 'bright-core', role: 'response', ...bright.core },
        { name: 'bright-authored-hole', role: 'control', ...bright.authoredHole },
        { name: 'bright-open-notch', role: 'control', ...bright.openNotch },
        { name: 'bright-thin-line', role: 'control', ...bright.thinLine },
        { name: 'bright-isolated', role: 'control', x: bright.isolated.x, y: bright.isolated.y, width: 1, height: 1 },
        { name: 'bright-native-wall', role: 'control', ...bright.wallCoexistence },
        { name: 'bright-ceramic-water-contact', role: 'response', x: bright.waterContact.ceramic.x, y: bright.waterContact.ceramic.y, width: 48, height: 20 },
        { name: 'bright-water-control', role: 'control', ...bright.waterContact.water },
        { name: 'bright-hot-brick-control', role: 'control', x: bright.hotControls.brick.x, y: bright.hotControls.brick.y, width: bright.hotControls.brick.width, height: bright.hotControls.brick.height },
        { name: 'bright-hot-metal-control', role: 'control', x: bright.hotControls.metal.x, y: bright.hotControls.metal.y, width: bright.hotControls.metal.width, height: bright.hotControls.metal.height },
        { name: 'bright-guarded-blank', role: 'control', ...bright.guardedBlank },
      ],
    },
  }],
});
