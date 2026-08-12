import { GAS_MATERIAL_LIGHTING_ATLAS_CATALOG } from './gas-material-lighting-atlas-catalog.js';
import { MATERIAL_LIGHTING_ATLAS_CATALOG } from './material-lighting-atlas-catalog.js';
import { OPPOSED_SOURCE_MATERIAL_LIGHTING_ATLAS_CATALOG } from './opposed-source-material-lighting-atlas-catalog.js';
import { POWDER_STYLE_ATLAS_CATALOG } from './powder-style-atlas-catalog.js';
import { SOLID_MATERIAL_LIGHTING_ATLAS_CATALOG } from './solid-material-lighting-atlas-catalog.js';

/**
 * Data-only source registry for current inspection projection. Projection names
 * are scripts-owned geometry adapters, never browser or fixture-preparation
 * authority. Candidate ordering is deliberately absent: capture recipes own it.
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
  sources: [
    { name: 'cross-phase', projection: 'declared', atlases: MATERIAL_LIGHTING_ATLAS_CATALOG.atlases },
    { name: 'gas', projection: 'gas-geometry', atlases: GAS_MATERIAL_LIGHTING_ATLAS_CATALOG.atlases },
    { name: 'solid', projection: 'solid-template', atlases: SOLID_MATERIAL_LIGHTING_ATLAS_CATALOG.atlases },
    { name: 'opposed-source', projection: 'declared', atlases: OPPOSED_SOURCE_MATERIAL_LIGHTING_ATLAS_CATALOG.atlases },
    { name: 'powder-style', projection: 'declared', atlases: POWDER_STYLE_ATLAS_CATALOG.atlases },
  ],
});
