import { RENDER_OPTICS_MATERIAL_LIGHTING_ATLAS_CATALOG } from '../src/shared/render-optics-material-lighting-atlas-catalog.js';

const SAFE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
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
  'render-optics-material-lighting-atlas': renderOpticsSections,
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
  const sections = descriptor.map(({ key, label, regionNames }) => ({
    key,
    label,
    regions: regionNames.map((name) => {
      const region = byName.get(name);
      if (!region || consumed.has(name)) {
        throw new TypeError(`${candidate} inspection presentation references an invalid region`);
      }
      consumed.add(name);
      return region;
    }),
  }));
  if (consumed.size !== byName.size) {
    throw new TypeError(`${candidate} inspection presentation does not cover every region`);
  }
  return deepFreeze(sections);
}
