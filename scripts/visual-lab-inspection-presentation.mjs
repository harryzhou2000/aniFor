import { RENDER_OPTICS_MATERIAL_LIGHTING_ATLAS_CATALOG } from '../src/shared/render-optics-material-lighting-atlas-catalog.js';
import {
  MATERIAL_APPEARANCE_PROFILE_LANES,
  resolveMaterialAppearanceProfileCatalogEntry,
} from '../src/shared/material-appearance-profile-catalog.js';
import {
  resolveMaterialPhaseProfileCatalogEntry,
} from '../src/shared/material-phase-profile-catalog.js';

const SAFE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const OPTICS_NAME = /^[A-Z][A-Za-z0-9]*$/;
const PHASES = Object.freeze([
  Object.freeze({ key: 'powder', label: 'Powder' }),
  Object.freeze({ key: 'liquid', label: 'Liquid' }),
  Object.freeze({ key: 'gas', label: 'Gas' }),
  Object.freeze({ key: 'solid', label: 'Solid' }),
]);

const deepFreeze = (value) => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
};

const renderOpticsAtlas = RENDER_OPTICS_MATERIAL_LIGHTING_ATLAS_CATALOG.atlases.find(
  ({ candidate }) => candidate === 'render-optics-material-lighting-atlas',
);
if (!renderOpticsAtlas) throw new Error('RenderOptics inspection atlas is missing');

const renderOpticsSections = PHASES.map(({ key, label }) => ({
  key,
  label,
  regionNames: renderOpticsAtlas.descriptor.cards
    .filter(({ phase }) => phase === key)
    .flatMap(({ key: cardKey }) => [`${cardKey}-body`, `${cardKey}-core`]),
}));
const groupedNames = new Set(renderOpticsSections.flatMap(({ regionNames }) => regionNames));
renderOpticsSections.push({
  key: 'controls',
  label: 'Topology and contact controls',
  regionNames: renderOpticsAtlas.descriptor.inspectionRegions
    .map(({ name }) => name)
    .filter((name) => !groupedNames.has(name)),
});

export const VISUAL_LAB_INSPECTION_PRESENTATIONS = deepFreeze({
  'render-optics-material-lighting-atlas': {
    sections: renderOpticsSections,
    regionMetadata: Object.fromEntries(renderOpticsAtlas.descriptor.cards.flatMap((card) => {
      const family = resolveMaterialAppearanceProfileCatalogEntry(card.phase, card.optics);
      if (!family) throw new Error(`RenderOptics card ${card.key} has no appearance profile`);
      const phaseProfile = resolveMaterialPhaseProfileCatalogEntry(card.phase);
      if (!phaseProfile) throw new Error(`RenderOptics card ${card.key} has no phase profile`);
      const metadata = {
        card: card.key,
        phase: card.phase,
        optics: family.name,
        opticsCode: family.optics,
        profile: Object.fromEntries(MATERIAL_APPEARANCE_PROFILE_LANES.map(
          (lane, index) => [lane, family.profile[index]],
        )),
        composition: phaseProfile.composition,
        mesoscale: phaseProfile.mesoscale,
      };
      return [[`${card.key}-body`, metadata], [`${card.key}-core`, metadata]];
    })),
  },
});

/** Presentation-only grouping over existing authenticated region records. */
export function resolveVisualLabInspectionPresentation(candidate, regions) {
  if (!SAFE_NAME.test(candidate ?? '') || !Array.isArray(regions) || regions.length === 0) {
    throw new TypeError('Visual Lab inspection presentation input is malformed');
  }
  const descriptor = VISUAL_LAB_INSPECTION_PRESENTATIONS[candidate];
  if (!descriptor) return null;

  const byName = new Map();
  for (const region of regions) {
    if (!SAFE_NAME.test(region?.name ?? '') || byName.has(region.name)) {
      throw new TypeError(`${candidate} inspection regions are malformed or duplicated`);
    }
    byName.set(region.name, region);
  }
  const consumed = new Set();
  const sections = descriptor.sections.map(({ key, label, regionNames }) => ({
    key,
    label,
    regions: regionNames.map((name) => {
      const region = byName.get(name);
      if (!region || consumed.has(name)) {
        throw new TypeError(`${candidate} inspection presentation references an invalid region`);
      }
      consumed.add(name);
      const metadata = descriptor.regionMetadata[name] ?? null;
      return metadata === null ? region : { ...region, presentation: metadata };
    }),
  }));
  if (consumed.size !== byName.size) {
    throw new TypeError(`${candidate} inspection presentation does not cover every region`);
  }
  return deepFreeze(sections);
}

const RESPONSE_FIELDS = Object.freeze([
  Object.freeze({ source: 'signedLumaMeanDelta', target: 'meanLuma' }),
  Object.freeze({ source: 'signedLumaStandardDeviationDelta', target: 'spread' }),
  Object.freeze({
    source: 'signedLumaNeighbourAbsoluteMeanDelta', target: 'neighbourContrast',
  }),
]);

const compileResponse = (candidate, region) => {
  const source = region?.pairs?.offToB;
  if (!source || RESPONSE_FIELDS.some(({ source: field }) => !Number.isFinite(source[field]))) {
    throw new TypeError(`${candidate} profile-response matrix has malformed measurements`);
  }
  return Object.fromEntries(RESPONSE_FIELDS.map(({ source: field, target }) => (
    [target, source[field]]
  )));
};

/**
 * Presentation-only join between resolved profile metadata and current body/core
 * appearance measurements. It creates no JSON evidence or capture identity.
 */
export function compileRenderOpticsProfileResponseMatrix(candidate, presentation) {
  if (candidate !== 'render-optics-material-lighting-atlas'
    || !Array.isArray(presentation)
    || presentation.length !== PHASES.length + 1
    || presentation[presentation.length - 1]?.key !== 'controls') {
    throw new TypeError('RenderOptics profile-response matrix input is malformed');
  }
  const groups = PHASES.map(({ key, label }, index) => {
    const section = presentation[index];
    if (section?.key !== key || section.label !== label || !Array.isArray(section.regions)) {
      throw new TypeError('RenderOptics profile-response matrix phase order is malformed');
    }
    const pairs = new Map();
    const order = [];
    for (const region of section.regions) {
      const match = /^(.*)-(body|core)$/.exec(region?.name ?? '');
      const metadata = region?.presentation;
      if (!match || !SAFE_NAME.test(match[1]) || metadata?.card !== match[1]
        || metadata.phase !== key || !OPTICS_NAME.test(metadata.optics ?? '')
        || !Number.isInteger(metadata.opticsCode)
        || metadata.profile === null || typeof metadata.profile !== 'object'
        || metadata.composition === null || typeof metadata.composition !== 'object'
        || metadata.mesoscale === null || typeof metadata.mesoscale !== 'object') {
        throw new TypeError(`${candidate} profile-response matrix has malformed region metadata`);
      }
      const [, card, kind] = match;
      if (!pairs.has(card)) {
        pairs.set(card, {});
        order.push(card);
      }
      const pair = pairs.get(card);
      if (pair[kind]) {
        throw new TypeError(`${candidate} profile-response matrix has duplicate body/core regions`);
      }
      pair[kind] = region;
    }
    const rows = order.map((card) => {
      const { body, core } = pairs.get(card);
      if (!body || !core || body.presentation !== core.presentation) {
        throw new TypeError(`${candidate} profile-response matrix has unmatched body/core regions`);
      }
      const metadata = body.presentation;
      return {
        card,
        phase: key,
        optics: metadata.optics,
        opticsCode: metadata.opticsCode,
        profile: metadata.profile,
        composition: metadata.composition,
        mesoscale: metadata.mesoscale,
        body: compileResponse(candidate, body),
        core: compileResponse(candidate, core),
      };
    });
    if (rows.length * 2 !== section.regions.length) {
      throw new TypeError(`${candidate} profile-response matrix has incomplete row coverage`);
    }
    return { key, label, rows };
  });
  return deepFreeze(groups);
}
