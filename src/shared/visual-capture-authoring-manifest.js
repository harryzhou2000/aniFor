import { FORCE_ACTIVITY_MATERIAL_LIGHTING_ATLAS_CATALOG } from './force-activity-material-lighting-atlas-catalog.js';
import { GAS_MATERIAL_LIGHTING_ATLAS_CATALOG } from './gas-material-lighting-atlas-catalog.js';
import { LIQUID_MOTION_VFX_ATLAS_CATALOG } from './liquid-motion-vfx-atlas-catalog.js';
import { MATERIAL_LIGHTING_ATLAS_CATALOG } from './material-lighting-atlas-catalog.js';
import { OIL_MOTION_VFX_ATLAS_CATALOG } from './oil-motion-vfx-atlas-catalog.js';
import { OPPOSED_SOURCE_MATERIAL_LIGHTING_ATLAS_CATALOG } from './opposed-source-material-lighting-atlas-catalog.js';
import { POWDER_STYLE_ATLAS_CATALOG } from './powder-style-atlas-catalog.js';
import { SOLID_MATERIAL_LIGHTING_ATLAS_CATALOG } from './solid-material-lighting-atlas-catalog.js';
import { SOURCE_TARGET_MATERIAL_LIGHTING_ATLAS_CATALOG } from './source-target-material-lighting-atlas-catalog.js';
import { THERMAL_SOURCE_MATERIAL_LIGHTING_ATLAS_CATALOG } from './thermal-source-material-lighting-atlas-catalog.js';

const SAFE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SOURCE_FIELDS = Object.freeze(['name', 'entries']);
const ENTRY_FIELDS = Object.freeze(['atlas', 'capture']);
const CAPTURE_FIELDS = Object.freeze(['domain', 'driver', 'preparationReportLabel']);

const deepFreeze = (value) => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
};

const hasExactFields = (value, fields) => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
  && Reflect.ownKeys(value).length === fields.length
  && fields.every((field) => Object.hasOwn(value, field))
);

const capture = (domain, driver, preparationReportLabel) => ({
  domain, driver, preparationReportLabel,
});

const source = (name, atlases, captures) => {
  const atlasCandidates = new Set(atlases.map(({ candidate }) => candidate));
  const captureCandidates = Reflect.ownKeys(captures);
  if (captureCandidates.length !== atlasCandidates.size
    || captureCandidates.some((candidate) => (
      typeof candidate !== 'string' || !atlasCandidates.has(candidate)
    ))) {
    throw new TypeError(`Visual capture authoring source ${name} has incomplete capture ownership`);
  }
  return {
    name,
    entries: atlases.map((atlas) => ({
      atlas,
      capture: captures[atlas.candidate],
    })),
  };
};

/**
 * Validates the single non-executable authoring join for extension captures
 * and declared inspection atlases. It grants no fixture preparation, browser,
 * renderer, capture lifecycle, or ordering authority.
 */
export function normalizeVisualCaptureAuthoringManifest(sources) {
  if (!Array.isArray(sources) || sources.length === 0) {
    throw new TypeError('Visual capture authoring manifest is malformed');
  }
  const sourceNames = new Set();
  const candidates = new Set();
  const normalized = sources.map((candidateSource) => {
    if (!hasExactFields(candidateSource, SOURCE_FIELDS)
      || !SAFE_NAME.test(candidateSource.name ?? '')
      || sourceNames.has(candidateSource.name)
      || !Array.isArray(candidateSource.entries)
      || candidateSource.entries.length === 0) {
      throw new TypeError('Visual capture authoring source is malformed');
    }
    sourceNames.add(candidateSource.name);
    const entries = candidateSource.entries.map((entry) => {
      if (!hasExactFields(entry, ENTRY_FIELDS)
        || !hasExactFields(entry.atlas, ['candidate', 'world', 'descriptor'])
        || !SAFE_NAME.test(entry.atlas.candidate ?? '')
        || candidates.has(entry.atlas.candidate)
        || !hasExactFields(entry.atlas.world, ['width', 'height'])
        || !Number.isInteger(entry.atlas.world.width) || entry.atlas.world.width <= 0
        || !Number.isInteger(entry.atlas.world.height) || entry.atlas.world.height <= 0
        || entry.atlas.descriptor === null || typeof entry.atlas.descriptor !== 'object'
        || Array.isArray(entry.atlas.descriptor)) {
        throw new TypeError('Visual capture authoring atlas is malformed or duplicated');
      }
      candidates.add(entry.atlas.candidate);
      if (entry.capture !== null && (!hasExactFields(entry.capture, CAPTURE_FIELDS)
        || !SAFE_NAME.test(entry.capture.domain ?? '')
        || !SAFE_NAME.test(entry.capture.driver ?? '')
        || typeof entry.capture.preparationReportLabel !== 'string'
        || entry.capture.preparationReportLabel.length === 0)) {
        throw new TypeError('Visual capture authoring metadata is malformed');
      }
      return { atlas: entry.atlas, capture: entry.capture };
    });
    return { name: candidateSource.name, entries };
  });
  return deepFreeze(normalized);
}

const materialLighting = (preparationReportLabel) => capture(
  'material-lighting', 'material-lighting-profile', preparationReportLabel,
);

/**
 * Adding an extension candidate under an established driver now requires one
 * atlas row here plus its explicit app-owned typed preparer. Null capture rows
 * are legacy base-contract candidates that only contribute inspection data.
 */
export const VISUAL_CAPTURE_AUTHORING_MANIFEST = normalizeVisualCaptureAuthoringManifest([
  source('cross-phase', MATERIAL_LIGHTING_ATLAS_CATALOG.atlases, {
    'material-lighting-atlas': materialLighting('prepareMaterialLightingAtlasFixture'),
  }),
  source('gas', GAS_MATERIAL_LIGHTING_ATLAS_CATALOG.atlases, {
    'gas-material-lighting-atlas': materialLighting('prepareGasMaterialLightingAtlasFixture'),
  }),
  source('solid', SOLID_MATERIAL_LIGHTING_ATLAS_CATALOG.atlases, {
    'solid-material-lighting-atlas': materialLighting('prepareSolidMaterialLightingAtlasFixture'),
    'multi-metal-material-lighting-atlas': materialLighting(
      'prepareMultiMetalMaterialLightingAtlasFixture',
    ),
  }),
  source('source-target', SOURCE_TARGET_MATERIAL_LIGHTING_ATLAS_CATALOG.atlases, {
    'source-target-material-lighting-atlas': materialLighting(
      'prepareSourceTargetGraphicsAuditFixture',
    ),
  }),
  source('force-activity', FORCE_ACTIVITY_MATERIAL_LIGHTING_ATLAS_CATALOG.atlases, {
    'force-activity-material-lighting-atlas': materialLighting(
      'prepareForceActivityGraphicsAuditFixture',
    ),
  }),
  source('thermal-source', THERMAL_SOURCE_MATERIAL_LIGHTING_ATLAS_CATALOG.atlases, {
    'thermal-source-material-lighting-atlas': materialLighting(
      'prepareCeramicTemperatureVfxFixture',
    ),
  }),
  source('opposed-source', OPPOSED_SOURCE_MATERIAL_LIGHTING_ATLAS_CATALOG.atlases, {
    'opposed-source-material-lighting-atlas': materialLighting('preparePowderLightVfxFixture'),
  }),
  source('powder-style', POWDER_STYLE_ATLAS_CATALOG.atlases, {
    'powder-style-atlas': capture(
      'powder', 'powder-render-style', 'preparePowderStyleAtlasFixture',
    ),
  }),
  source('liquid-motion', LIQUID_MOTION_VFX_ATLAS_CATALOG.atlases, {
    'water-motion': null,
  }),
  source('oil-motion', OIL_MOTION_VFX_ATLAS_CATALOG.atlases, {
    'oil-motion': null,
  }),
]);
