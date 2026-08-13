/**
 * Data-only authoring for the paused exact-owner candidate survey. This is an
 * app diagnostic surface, not a Visual Lab fixture or capture registration.
 */

export const MATERIAL_CANDIDATE_SURVEY_ATLAS_CATALOG_SCHEMA = (
  'anifor.material-candidate-survey-atlas-catalog/v1'
);

const deepFreeze = (value) => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
};

const command = (kind, values) => ({ kind, ...values });
const semanticSupport = (material) => ({
  kind: 'semantic', materials: [material], minimumRecall: 0.96,
});
const region = (name, material, phase, x, y) => ({
  name,
  material,
  phase,
  profile: phase === 'powder' ? 'granular-body' : 'cohesive-liquid',
  x,
  y,
  radiusX: 30,
  radiusY: 24,
  support: semanticSupport(material),
  semanticMaterials: [material],
  expectedMatching: 2_880,
});

export const MATERIAL_CANDIDATE_SURVEY_ATLAS_CATALOG = deepFreeze({
  schema: MATERIAL_CANDIDATE_SURVEY_ATLAS_CATALOG_SCHEMA,
  world: { width: 612, height: 384 },
  commands: [
    command('rounded-rect', { x: 24, y: 168, width: 564, height: 48, radius: 12, material: 78 }),
    command('wall-pattern-rect', { x: 248, y: 168, width: 116, height: 48, blockSize: 6 }),
    command('rounded-rect', { x: 50, y: 40, width: 120, height: 128, radius: 22, material: 32 }),
    command('erase-rect', { x: 65, y: 68, width: 10, height: 16 }),
    command('rounded-rect', { x: 246, y: 40, width: 120, height: 128, radius: 22, material: 18 }),
    command('erase-rect', { x: 246, y: 82, width: 12, height: 20 }),
    command('rounded-rect', { x: 442, y: 40, width: 120, height: 128, radius: 22, material: 53 }),
    command('rect', { x: 499, y: 26, width: 6, height: 14, material: 53, density: 1, seed: 0 }),
    command('rounded-rect', { x: 50, y: 216, width: 120, height: 128, radius: 22, material: 31 }),
    command('erase-rect', { x: 65, y: 260, width: 10, height: 16 }),
    command('rounded-rect', { x: 246, y: 216, width: 120, height: 128, radius: 22, material: 44 }),
    command('erase-rect', { x: 246, y: 266, width: 12, height: 20 }),
    command('rounded-rect', { x: 442, y: 216, width: 120, height: 128, radius: 22, material: 29 }),
    command('rect', { x: 499, y: 344, width: 6, height: 14, material: 29, density: 1, seed: 0 }),
  ],
  audit: {
    version: 1,
    world: { width: 612, height: 384 },
    semantic: {
      hash: 2_255_453_673,
      occupied: 115_368,
      materialCounts: [
        { material: 32, count: 14_692 },
        { material: 18, count: 14_612 },
        { material: 53, count: 14_936 },
        { material: 31, count: 14_692 },
        { material: 44, count: 14_612 },
        { material: 29, count: 14_936 },
        { material: 78, count: 26_888 },
      ],
    },
    regions: [
      region('candidateNitro', 32, 'liquid', 110, 120),
      region('candidateSnow', 18, 'powder', 306, 120),
      region('candidateBASE', 53, 'liquid', 502, 120),
      region('candidateC4', 31, 'powder', 110, 280),
      region('candidateBGLA', 44, 'powder', 306, 280),
      region('candidateQuartz', 29, 'powder', 502, 280),
    ],
    sharedContext: {
      material: 78,
      contactProbes: [
        { x: 110, y: 167, material: 32 },
        { x: 306, y: 167, material: 18 },
        { x: 502, y: 167, material: 53 },
        { x: 110, y: 216, material: 31 },
        { x: 306, y: 216, material: 44 },
        { x: 502, y: 216, material: 29 },
      ],
      wallProbes: [{ x: 252, y: 180 }, { x: 360, y: 204 }],
    },
  },
});
