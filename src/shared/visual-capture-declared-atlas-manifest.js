import { VISUAL_CAPTURE_AUTHORING_MANIFEST } from './visual-capture-authoring-manifest.js';

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
  ...VISUAL_CAPTURE_AUTHORING_MANIFEST.map(({ name, entries }) => ({
    name,
    atlases: entries.map(({ atlas }) => atlas),
  })),
]);
