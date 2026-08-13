import { FORCE_ACTIVITY_MATERIAL_LIGHTING_ATLAS_CATALOG } from './force-activity-material-lighting-atlas-catalog.js';
import { GAS_MATERIAL_LIGHTING_ATLAS_CATALOG } from './gas-material-lighting-atlas-catalog.js';
import { MATERIAL_LIGHTING_ATLAS_CATALOG } from './material-lighting-atlas-catalog.js';
import { LIQUID_MOTION_VFX_ATLAS_CATALOG } from './liquid-motion-vfx-atlas-catalog.js';
import { OIL_MOTION_VFX_ATLAS_CATALOG } from './oil-motion-vfx-atlas-catalog.js';
import { OPPOSED_SOURCE_MATERIAL_LIGHTING_ATLAS_CATALOG } from './opposed-source-material-lighting-atlas-catalog.js';
import { POWDER_STYLE_ATLAS_CATALOG } from './powder-style-atlas-catalog.js';
import { SOLID_MATERIAL_LIGHTING_ATLAS_CATALOG } from './solid-material-lighting-atlas-catalog.js';
import { SOURCE_TARGET_MATERIAL_LIGHTING_ATLAS_CATALOG } from './source-target-material-lighting-atlas-catalog.js';
import { THERMAL_SOURCE_MATERIAL_LIGHTING_ATLAS_CATALOG } from './thermal-source-material-lighting-atlas-catalog.js';

const SAFE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const deepFreeze = (value) => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
};

/** Validates the non-executable source grouping used by inspection projection. */
export function normalizeVisualCaptureDeclaredAtlasManifest(sources) {
  if (!Array.isArray(sources)) throw new TypeError('Declared atlas manifest is malformed');
  const names = new Set();
  const candidates = new Set();
  const normalized = sources.map((source) => {
    if (source === null || typeof source !== 'object' || Array.isArray(source)
      || Reflect.ownKeys(source).length !== 2 || !Object.hasOwn(source, 'name')
      || !Object.hasOwn(source, 'atlases') || !SAFE_NAME.test(source.name ?? '')
      || names.has(source.name) || !Array.isArray(source.atlases)
      || source.atlases.length === 0) {
      throw new TypeError('Declared atlas manifest source is malformed');
    }
    names.add(source.name);
    for (const atlas of source.atlases) {
      if (!SAFE_NAME.test(atlas?.candidate ?? '') || candidates.has(atlas.candidate)) {
        throw new TypeError('Declared atlas manifest candidate is malformed or duplicated');
      }
      candidates.add(atlas.candidate);
    }
    return { name: source.name, atlases: source.atlases };
  });
  return deepFreeze(normalized);
}

/**
 * One data-only registration point for declared inspection atlases. This list
 * grants no fixture-preparation, browser, renderer, capture, or ordering authority.
 */
export const VISUAL_CAPTURE_DECLARED_ATLAS_MANIFEST = normalizeVisualCaptureDeclaredAtlasManifest([
  { name: 'cross-phase', atlases: MATERIAL_LIGHTING_ATLAS_CATALOG.atlases },
  { name: 'gas', atlases: GAS_MATERIAL_LIGHTING_ATLAS_CATALOG.atlases },
  { name: 'solid', atlases: SOLID_MATERIAL_LIGHTING_ATLAS_CATALOG.atlases },
  { name: 'source-target', atlases: SOURCE_TARGET_MATERIAL_LIGHTING_ATLAS_CATALOG.atlases },
  { name: 'force-activity', atlases: FORCE_ACTIVITY_MATERIAL_LIGHTING_ATLAS_CATALOG.atlases },
  { name: 'thermal-source', atlases: THERMAL_SOURCE_MATERIAL_LIGHTING_ATLAS_CATALOG.atlases },
  { name: 'opposed-source', atlases: OPPOSED_SOURCE_MATERIAL_LIGHTING_ATLAS_CATALOG.atlases },
  { name: 'powder-style', atlases: POWDER_STYLE_ATLAS_CATALOG.atlases },
  { name: 'liquid-motion', atlases: LIQUID_MOTION_VFX_ATLAS_CATALOG.atlases },
  { name: 'oil-motion', atlases: OIL_MOTION_VFX_ATLAS_CATALOG.atlases },
]);
