import {
  VISUAL_CAPTURE_DECLARED_ATLAS_MANIFEST,
} from './visual-capture-declared-atlas-manifest.js';

/**
 * Data-only source registry for current inspection projection. Every atlas owns
 * its ordered review rectangles; the scripts layer only validates and clones
 * them. Candidate ordering is deliberately absent: capture recipes own it.
 */
export const VISUAL_CAPTURE_INSPECTION_SOURCE_CATALOG_SCHEMA = (
  'anifor.visual-capture.inspection-source-catalog/v1'
);

const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
};

export const VISUAL_CAPTURE_INSPECTION_SOURCE_CATALOG = deepFreeze({
  schema: VISUAL_CAPTURE_INSPECTION_SOURCE_CATALOG_SCHEMA,
  sources: VISUAL_CAPTURE_DECLARED_ATLAS_MANIFEST.map(({ name, atlases }) => ({
    name, projection: 'declared', atlases,
  })),
});
