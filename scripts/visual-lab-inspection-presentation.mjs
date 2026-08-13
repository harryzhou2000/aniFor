import {
  MATERIAL_APPEARANCE_PROFILE_LANES,
  resolveMaterialAppearanceProfileCatalogEntry,
} from '../src/shared/material-appearance-profile-catalog.js';
import { resolveMaterialPhaseProfileCatalogEntry } from '../src/shared/material-phase-profile-catalog.js';
import { VISUAL_CAPTURE_DECLARED_ATLAS_MANIFEST } from '../src/shared/visual-capture-declared-atlas-manifest.js';

const SAFE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_LABEL = /^[A-Za-z][A-Za-z0-9 -]{0,63}$/;
const OPTICS_NAME = /^[A-Z][A-Za-z0-9]*$/;
const MATERIAL_PROFILE_BODY_CORE_KIND = 'material-profile-body-core';

const deepFreeze = (value) => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
};

const hasExactKeys = (value, keys) => value !== null && typeof value === 'object'
  && !Array.isArray(value)
  && Object.keys(value).length === keys.length
  && keys.every((key) => Object.hasOwn(value, key));

const compileMaterialProfileBodyCoreDescriptor = (candidate, atlas) => {
  const presentation = atlas.descriptor.inspectionPresentation;
  const cards = atlas.descriptor.cards;
  const inspectionRegions = atlas.descriptor.inspectionRegions;
  if (!hasExactKeys(presentation, ['kind', 'title', 'phases', 'controls'])
    || presentation.kind !== MATERIAL_PROFILE_BODY_CORE_KIND
    || !SAFE_LABEL.test(presentation.title ?? '')
    || !Array.isArray(presentation.phases) || presentation.phases.length === 0
    || !hasExactKeys(presentation.controls, ['key', 'label'])
    || !SAFE_NAME.test(presentation.controls?.key ?? '')
    || !SAFE_LABEL.test(presentation.controls?.label ?? '')
    || !Array.isArray(cards) || cards.length === 0
    || !Array.isArray(inspectionRegions) || inspectionRegions.length === 0) {
    throw new TypeError(`${candidate} inspection presentation descriptor is malformed`);
  }
  const phaseKeys = new Set();
  const phases = presentation.phases.map((phase) => {
    if (!hasExactKeys(phase, ['key', 'label'])) {
      throw new TypeError(`${candidate} inspection presentation phases are malformed`);
    }
    const { key, label } = phase;
    if (!SAFE_NAME.test(key ?? '') || !SAFE_LABEL.test(label ?? '') || phaseKeys.has(key)) {
      throw new TypeError(`${candidate} inspection presentation phases are malformed`);
    }
    phaseKeys.add(key);
    return { key, label };
  });
  if (phaseKeys.has(presentation.controls.key)) {
    throw new TypeError(`${candidate} inspection presentation controls overlap a phase`);
  }
  const cardKeys = new Set();
  for (const card of cards) {
    if (!SAFE_NAME.test(card?.key ?? '') || !phaseKeys.has(card.phase) || cardKeys.has(card.key)) {
      throw new TypeError(`${candidate} inspection presentation cards are malformed or duplicated`);
    }
    cardKeys.add(card.key);
  }
  const sections = phases.map(({ key, label }) => ({
    key,
    label,
    regionNames: cards.filter(({ phase }) => phase === key)
      .flatMap(({ key: cardKey }) => [`${cardKey}-body`, `${cardKey}-core`]),
  }));
  if (sections.some(({ regionNames }) => regionNames.length === 0)
    || cards.some(({ phase }) => !phaseKeys.has(phase))) {
    throw new TypeError(`${candidate} inspection presentation does not cover every card phase`);
  }
  const groupedNames = new Set(sections.flatMap(({ regionNames }) => regionNames));
  if (groupedNames.size !== cardKeys.size * 2) {
    throw new TypeError(`${candidate} inspection presentation body/core names are duplicated`);
  }
  const inspectionRegionNames = new Set();
  for (const region of inspectionRegions) {
    if (!SAFE_NAME.test(region?.name ?? '') || inspectionRegionNames.has(region.name)) {
      throw new TypeError(`${candidate} inspection presentation regions are malformed or duplicated`);
    }
    inspectionRegionNames.add(region.name);
  }
  if ([...groupedNames].some((name) => !inspectionRegionNames.has(name))) {
    throw new TypeError(`${candidate} inspection presentation is missing body/core regions`);
  }
  const controlRegionNames = inspectionRegions.map(({ name }) => name)
    .filter((name) => !groupedNames.has(name));
  if (controlRegionNames.length === 0) {
    throw new TypeError(`${candidate} inspection presentation controls are empty`);
  }
  sections.push({
    key: presentation.controls.key,
    label: presentation.controls.label,
    regionNames: controlRegionNames,
  });
  if (groupedNames.size + controlRegionNames.length !== inspectionRegionNames.size) {
    throw new TypeError(`${candidate} inspection presentation region coverage is malformed`);
  }
  const regionMetadata = Object.fromEntries(cards.flatMap((card) => {
    const family = resolveMaterialAppearanceProfileCatalogEntry(card.phase, card.optics);
    const phaseProfile = resolveMaterialPhaseProfileCatalogEntry(card.phase);
    if (!family || !phaseProfile) {
      throw new TypeError(`${candidate} card ${card.key} has no material profile`);
    }
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
  }));
  return { kind: presentation.kind, title: presentation.title, phases, sections, regionMetadata };
};

export const compileVisualLabInspectionPresentations = (sources) => {
  if (!Array.isArray(sources)) throw new TypeError('Visual Lab inspection presentation sources are malformed');
  const entries = [];
  const candidates = new Set();
  for (const { atlases } of sources) {
    if (!Array.isArray(atlases)) throw new TypeError('Visual Lab inspection presentation atlases are malformed');
    for (const atlas of atlases) {
      const presentation = atlas?.descriptor?.inspectionPresentation;
      if (presentation === undefined) continue;
      if (!SAFE_NAME.test(atlas?.candidate ?? '') || candidates.has(atlas.candidate)) {
        throw new TypeError('Visual Lab inspection presentation candidates are malformed or duplicated');
      }
      candidates.add(atlas.candidate);
      if (presentation?.kind !== MATERIAL_PROFILE_BODY_CORE_KIND) {
        throw new TypeError(`${atlas?.candidate ?? 'unknown'} has an unsupported inspection presentation kind`);
      }
      entries.push([atlas.candidate, compileMaterialProfileBodyCoreDescriptor(atlas.candidate, atlas)]);
    }
  }
  return deepFreeze(Object.fromEntries(entries));
};

export const VISUAL_LAB_INSPECTION_PRESENTATIONS = compileVisualLabInspectionPresentations(
  VISUAL_CAPTURE_DECLARED_ATLAS_MANIFEST,
);

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
  Object.freeze({ source: 'signedLumaNeighbourAbsoluteMeanDelta', target: 'neighbourContrast' }),
]);

const compileResponse = (candidate, region) => {
  const source = region?.pairs?.offToB;
  if (!source || RESPONSE_FIELDS.some(({ source: field }) => !Number.isFinite(source[field]))) {
    throw new TypeError(`${candidate} profile-response matrix has malformed measurements`);
  }
  return Object.fromEntries(RESPONSE_FIELDS.map(({ source: field, target }) => [target, source[field]]));
};

/** Presentation-only join; creates no JSON evidence or capture identity. */
export function compileVisualLabInspectionResponseMatrix(candidate, presentation) {
  const descriptor = VISUAL_LAB_INSPECTION_PRESENTATIONS[candidate];
  if (!descriptor) return null;
  if (descriptor.kind !== MATERIAL_PROFILE_BODY_CORE_KIND
    || !Array.isArray(presentation)
    || presentation.length !== descriptor.sections.length) {
    throw new TypeError(`${candidate} profile-response matrix input is malformed`);
  }
  const controls = presentation[presentation.length - 1];
  const controlDescriptor = descriptor.sections[descriptor.sections.length - 1];
  if (controls?.key !== controlDescriptor.key || controls.label !== controlDescriptor.label
    || !Array.isArray(controls.regions) || controls.regions.length === 0) {
    throw new TypeError(`${candidate} profile-response matrix controls are malformed`);
  }
  const groups = descriptor.phases.map(({ key, label }, index) => {
    const section = presentation[index];
    if (section?.key !== key || section.label !== label || !Array.isArray(section.regions)) {
      throw new TypeError(`${candidate} profile-response matrix phase order is malformed`);
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
      if (!pairs.has(card)) { pairs.set(card, {}); order.push(card); }
      const pair = pairs.get(card);
      if (pair[kind]) throw new TypeError(`${candidate} profile-response matrix has duplicate body/core regions`);
      pair[kind] = region;
    }
    const rows = order.map((card) => {
      const { body, core } = pairs.get(card);
      if (!body || !core || body.presentation !== core.presentation) {
        throw new TypeError(`${candidate} profile-response matrix has unmatched body/core regions`);
      }
      const metadata = body.presentation;
      return {
        card, phase: key, optics: metadata.optics, opticsCode: metadata.opticsCode,
        profile: metadata.profile, composition: metadata.composition, mesoscale: metadata.mesoscale,
        body: compileResponse(candidate, body), core: compileResponse(candidate, core),
      };
    });
    if (rows.length * 2 !== section.regions.length) {
      throw new TypeError(`${candidate} profile-response matrix has incomplete row coverage`);
    }
    return { key, label, rows };
  });
  return deepFreeze({ kind: descriptor.kind, title: descriptor.title, groups });
}

/** Historical name retained for downloaded-tooling and focused callers. */
export function compileRenderOpticsProfileResponseMatrix(candidate, presentation) {
  const matrix = compileVisualLabInspectionResponseMatrix(candidate, presentation);
  if (matrix === null) throw new TypeError('RenderOptics profile-response matrix input is malformed');
  return matrix.groups;
}
