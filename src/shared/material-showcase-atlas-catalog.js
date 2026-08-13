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
  // This stays outside `atlases`: scripts project only the two declared
  // inspection descriptors, while the renderer retains the full v6 audit
  // through its typed compatibility facade.
  audit: {
    version: 6,
    semantic: {
      hash: 3_610_338_776,
      occupied: 114_015,
      materialCounts: [
        { material: 1, count: 5_862 }, { material: 2, count: 20_862 },
        { material: 4, count: 216 }, { material: 5, count: 6_806 },
        { material: 8, count: 2_538 }, { material: 9, count: 2_374 },
        { material: 10, count: 10_215 }, { material: 20, count: 492 },
        { material: 23, count: 880 }, { material: 24, count: 6_206 },
        { material: 26, count: 4_148 }, { material: 28, count: 4_720 },
        { material: 39, count: 6_003 }, { material: 41, count: 2_184 },
        { material: 42, count: 4_300 }, { material: 78, count: 23_090 },
        { material: 101, count: 150 }, { material: 109, count: 492 },
        { material: 105, count: 3_488 }, { material: 112, count: 1_804 },
        { material: 113, count: 3_096 }, { material: 164, count: 2_869 },
        { material: 38, count: 1_220 },
      ],
    },
    metalInsert: {
      material: 23,
      rect: { x: 315, y: 289, width: 54, height: 18 },
      radius: 8,
      expectedCells: 880,
      rowCounts: [38, 44, 48, 50, 50, 52, 52, 52, 54, 54, 52, 52, 52, 50, 50, 48, 44, 38],
      coreProbe: { x: 342, y: 298 },
      waterControls: [{ x: 315, y: 289 }, { x: 342, y: 288 }, { x: 342, y: 307 }],
    },
    regions: [
      { name: 'powderSand', family: 'powder', profile: 'granular-body', x: 140, y: 275, radiusX: 35, radiusY: 20, support: { kind: 'semantic', materials: [1], minimumRecall: 0.96 }, semanticMaterials: [1], topology: true, silhouette: true, expectedMatching: 800 },
      { name: 'powderClay', family: 'powder', profile: 'granular-body', x: 140, y: 275, radiusX: 35, radiusY: 20, support: { kind: 'semantic', materials: [28], minimumRecall: 0.96 }, semanticMaterials: [28], topology: true, silhouette: true, expectedMatching: 1_369 },
      { name: 'powderConcrete', family: 'powder', profile: 'granular-body', x: 140, y: 320, radiusX: 50, radiusY: 8, support: { kind: 'semantic', materials: [26], minimumRecall: 0.96 }, semanticMaterials: [26], topology: true, silhouette: true, expectedMatching: 1_600 },
      { name: 'liquidWater', family: 'liquid', profile: 'cohesive-liquid', x: 355, y: 260, radiusX: 42, radiusY: 38, support: { kind: 'semantic', materials: [2], minimumRecall: 0.96 }, semanticMaterials: [2], topology: true, silhouette: true, expectedMatching: 5_636 },
      { name: 'liquidOil', family: 'liquid', profile: 'cohesive-liquid', x: 420, y: 240, radiusX: 20, radiusY: 15, support: { kind: 'semantic', materials: [8], minimumRecall: 0.96 }, semanticMaterials: [8], topology: true, silhouette: true, expectedMatching: 1_200 },
      { name: 'liquidSoap', family: 'liquid', profile: 'cohesive-liquid', x: 76, y: 216, radiusX: 16, radiusY: 6, support: { kind: 'semantic', materials: [38], minimumRecall: 0.96 }, semanticMaterials: [38], topology: true, silhouette: true, expectedMatching: 384 },
      { name: 'gasSmoke', family: 'gas', profile: 'diffuse-gas', x: 360, y: 92, radiusX: 33, radiusY: 26, support: { kind: 'atmosphere', style: 1, minimumAlpha: 12, minimumRecall: 0.78 }, semanticMaterials: [5], topology: true, silhouette: true, expectedMatching: 2_185 },
      { name: 'gasOxygen', family: 'gas', profile: 'diffuse-gas', x: 427, y: 82, radiusX: 30, radiusY: 22, support: { kind: 'atmosphere', style: 4, minimumAlpha: 12, minimumRecall: 0.78 }, semanticMaterials: [39], topology: true, silhouette: true, expectedMatching: 2_315 },
      { name: 'gasCarbonDioxide', family: 'gas', profile: 'diffuse-gas', x: 398, y: 166, radiusX: 34, radiusY: 12, support: { kind: 'atmosphere', style: 6, minimumAlpha: 12, minimumRecall: 0.78 }, semanticMaterials: [41], topology: true, silhouette: true, expectedMatching: 1_528 },
      { name: 'gasNoble', family: 'gas', profile: 'diffuse-gas', x: 497, y: 103, radiusX: 28, radiusY: 20, support: { kind: 'atmosphere', style: 7, minimumAlpha: 12, minimumRecall: 0.78 }, semanticMaterials: [42], topology: true, silhouette: true, expectedMatching: 1_986 },
      { name: 'solidRock', family: 'solid', profile: 'rigid-body', x: 530, y: 331, radiusX: 35, radiusY: 19, support: { kind: 'semantic', materials: [78], minimumRecall: 0.96 }, semanticMaterials: [78], topology: true, silhouette: true, expectedMatching: 2_660 },
      { name: 'solidISZS', family: 'solid', profile: 'rigid-body', x: 232, y: 73, radiusX: 18, radiusY: 24, support: { kind: 'semantic', materials: [105], minimumRecall: 0.96 }, semanticMaterials: [105], topology: true, silhouette: true, expectedMatching: 1_728 },
      { name: 'solidVIBR', family: 'solid', profile: 'rigid-body', x: 253, y: 154, radiusX: 18, radiusY: 21, support: { kind: 'semantic', materials: [113], minimumRecall: 0.96 }, semanticMaterials: [113], topology: true, silhouette: true, expectedMatching: 1_512 },
      { name: 'organicWood', family: 'organic', profile: 'organic-body', x: 122, y: 220, radiusX: 7, radiusY: 34, support: { kind: 'semantic', materials: [9], minimumRecall: 0.96 }, semanticMaterials: [9], topology: true, silhouette: true, expectedMatching: 952 },
      { name: 'organicPlant', family: 'organic', profile: 'organic-body', x: 116, y: 120, radiusX: 38, radiusY: 22, support: { kind: 'semantic', materials: [10], minimumRecall: 0.96 }, semanticMaterials: [10], topology: true, silhouette: true, expectedMatching: 3_344 },
      { name: 'emissionPlasma', family: 'emission', profile: 'emissive-volume', x: 311, y: 139, radiusX: 15, radiusY: 10, support: { kind: 'emission', minimumAlpha: 8, minimumRecall: 0.72 }, semanticMaterials: [20], topology: true, silhouette: true, expectedMatching: 492 },
      { name: 'contactWaterGlass', family: 'contact', profile: 'phase-contact', x: 282, y: 225, radiusX: 11, radiusY: 20, support: { kind: 'semantic', materials: [2, 24], minimumRecall: 0.96 }, semanticMaterials: [2, 24], topology: true, silhouette: true, expectedMatching: 880 },
      { name: 'contactWaterMetal', family: 'contact', profile: 'phase-contact', x: 342, y: 289, radiusX: 20, radiusY: 12, support: { kind: 'semantic', materials: [2, 23], minimumRecall: 0.96 }, semanticMaterials: [2, 23], topology: true, silhouette: true, expectedMatching: 960 },
    ],
  },
});
