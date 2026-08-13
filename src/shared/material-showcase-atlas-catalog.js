/**
 * Data-only authoring for the paused production showcase. The app consumes the
 * ordered scene commands while review tooling projects the two existing gas
 * recipes into bounded inspection regions. No executable authority lives here.
 */

export const MATERIAL_SHOWCASE_ATLAS_CATALOG_SCHEMA = (
  'anifor.visual-lab.material-showcase-atlas-catalog/v1'
);

const deepFreeze = (value) => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
};

const command = (kind, values) => ({ kind, ...values });
const region = (name, role, x, y, width, height) => ({ name, role, x, y, width, height });

export const MATERIAL_SHOWCASE_SCENE_AUTHORING = deepFreeze({
  world: { width: 612, height: 384 },
  commands: [
    command('rounded-rect', { x: 52, y: 196, width: 48, height: 28, radius: 10, material: 38 }),
    command('rounded-rect', { x: 24, y: 280, width: 564, height: 76, radius: 18, material: 78 }),
    command('erase-rect', { x: 315, y: 280, width: 54, height: 18 }),
    command('slope', { x: 40, bottom: 186, width: 198, height: 142, material: 1 }),
    command('slope', { x: 76, bottom: 221, width: 132, height: 107, material: 28 }),
    command('rounded-rect', { x: 50, y: 308, width: 178, height: 24, radius: 10, material: 26 }),
    command('rounded-rect', { x: 252, y: 192, width: 232, height: 128, radius: 28, material: 2 }),
    command('split-capsule', { x: 332, y: 214, width: 116, height: 55, radius: 24, splitX: 389, left: 2, right: 8 }),
    command('rounded-rect', { x: 315, y: 289, width: 54, height: 18, radius: 8, material: 23 }),
    command('rounded-rect', { x: 277, y: 185, width: 14, height: 143, radius: 7, material: 24 }),
    command('rounded-rect', { x: 466, y: 185, width: 14, height: 143, radius: 7, material: 24 }),
    command('rounded-rect', { x: 277, y: 313, width: 203, height: 15, radius: 7, material: 24 }),
    command('rect', { x: 276, y: 251, width: 6, height: 36, material: 4, density: 1, seed: 0 }),
    command('rect', { x: 473, y: 235, width: 5, height: 30, material: 101, density: 1, seed: 0 }),
    command('ellipse', { cx: 360, cy: 92, radiusX: 94, radiusY: 49, material: 5, density: 0.96, seed: 811, feather: 0.30 }),
    command('ellipse', { cx: 427, cy: 82, radiusX: 82, radiusY: 43, material: 39, density: 0.92, seed: 823, feather: 0.34 }),
    command('ellipse', { cx: 497, cy: 103, radiusX: 64, radiusY: 37, material: 42, density: 0.88, seed: 827, feather: 0.40 }),
    command('ellipse', { cx: 398, cy: 166, radiusX: 55, radiusY: 18, material: 41, density: 0.96, seed: 841, feather: 0.30 }),
    command('rounded-rect', { x: 296, y: 129, width: 30, height: 20, radius: 9, material: 20 }),
    command('rounded-rect', { x: 205, y: 38, width: 54, height: 70, radius: 16, material: 105 }),
    command('rounded-rect', { x: 226, y: 123, width: 54, height: 62, radius: 15, material: 113 }),
    command('rounded-rect', { x: 112, y: 121, width: 20, height: 158, radius: 8, material: 9 }),
    command('rounded-rect', { x: 66, y: 82, width: 112, height: 76, radius: 32, material: 10 }),
    command('rounded-rect', { x: 150, y: 151, width: 70, height: 44, radius: 18, material: 10 }),
    command('curvature-plate', { x: 510, y: 226, width: 54, height: 58, radius: 14, material: 164 }),
    command('rounded-rect', { x: 522, y: 144, width: 38, height: 62, radius: 15, material: 112 }),
    command('rounded-rect', { x: 548, y: 166, width: 20, height: 30, radius: 9, material: 109 }),
  ],
});

const gasRegions = [
  region('smoke-body', 'response', 327, 66, 66, 52),
  region('oxygen-control', 'control', 397, 60, 60, 44),
  region('noble-control', 'control', 469, 83, 56, 40),
  region('carbon-dioxide-control', 'control', 364, 154, 68, 24),
  region('guarded-blank', 'control', 8, 8, 16, 16),
];
const oxygenRegions = [
  region('oxygen-body', 'response', 397, 60, 60, 44),
  region('smoke-control', 'control', 327, 66, 66, 52),
  region('noble-control', 'control', 469, 83, 56, 40),
  region('carbon-dioxide-control', 'control', 364, 154, 68, 24),
  region('guarded-blank', 'control', 8, 8, 16, 16),
];

export const MATERIAL_SHOWCASE_ATLAS_CATALOG = deepFreeze({
  schema: MATERIAL_SHOWCASE_ATLAS_CATALOG_SCHEMA,
  atlases: [
    { candidate: 'gas-showcase', world: MATERIAL_SHOWCASE_SCENE_AUTHORING.world,
      descriptor: { inspectionRegions: gasRegions } },
    { candidate: 'oxygen-showcase', world: MATERIAL_SHOWCASE_SCENE_AUTHORING.world,
      descriptor: { inspectionRegions: oxygenRegions } },
  ],
});
