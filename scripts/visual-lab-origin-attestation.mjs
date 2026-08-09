import { normalizeLivePagesBaseUrl } from './live-pages-attestation.mjs';

export const VISUAL_LAB_ORIGIN_ATTESTATION_SCHEMA =
  'anifor.visual-lab.origin-attestation/v1';

const REVISION = /^[0-9a-f]{40}$/;
const MAX_RESOURCES = 1_024;
const MAX_RESOURCE_PATH_BYTES = 2_048;
const REQUIRED_RUNTIME_RESOURCES = Object.freeze([
  'assets/app.js',
  'assets/style.css',
  'wasm/stillroom_core.js',
  'wasm/stillroom_core.wasm',
  'wasm/powder_core.wasm',
]);
const FIELDS = Object.freeze([
  'schema',
  'baseUrl',
  'revision',
  'checkedResources',
  'resources',
  'postCaptureRevision',
]);

const deepFreeze = (value) => {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
};

const assertExactFields = (input) => {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Visual Lab origin attestation must be an object');
  }
  const fields = Reflect.ownKeys(input);
  if (fields.length !== FIELDS.length
      || !FIELDS.every((field) => fields.includes(field))) {
    throw new TypeError('Visual Lab origin attestation has unexpected or missing fields');
  }
};

const normalizeRevision = (value, label) => {
  if (typeof value !== 'string' || !REVISION.test(value)) {
    throw new TypeError(`${label} must be a lowercase 40-hex commit`);
  }
  return value;
};

const normalizeResources = (input, baseUrl) => {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_RESOURCES) {
    throw new TypeError(
      `Visual Lab origin attestation resources must contain 1-${MAX_RESOURCES} paths`,
    );
  }
  const resources = input.map((resource, index) => {
    if (typeof resource !== 'string' || resource.length === 0
        || Buffer.byteLength(resource, 'utf8') > MAX_RESOURCE_PATH_BYTES
        || !resource.startsWith('/') || resource.includes('?') || resource.includes('#')
        || resource.includes('\\')) {
      throw new TypeError(`Visual Lab origin attestation resource ${index} is not a safe pathname`);
    }
    let canonical;
    try { canonical = new URL(resource, baseUrl); }
    catch { throw new TypeError(`Visual Lab origin attestation resource ${index} is invalid`); }
    if (canonical.origin !== baseUrl.origin
        || canonical.pathname !== resource
        || !canonical.pathname.startsWith(baseUrl.pathname)) {
      throw new TypeError(
        `Visual Lab origin attestation resource ${index} escapes its deployed app root`,
      );
    }
    return resource;
  });
  const sorted = [...resources].sort();
  if (new Set(resources).size !== resources.length
      || resources.some((resource, index) => resource !== sorted[index])) {
    throw new TypeError('Visual Lab origin attestation resources must be unique and sorted');
  }
  for (const required of REQUIRED_RUNTIME_RESOURCES) {
    const pathname = new URL(required, baseUrl).pathname;
    if (!resources.includes(pathname)) {
      throw new TypeError(`Visual Lab origin attestation is missing ${required}`);
    }
  }
  return resources;
};

/**
 * Normalizes the runtime-only proof that one remote capture cohort observed an
 * exact deployment before capture and the same revision after capture. The
 * record is deliberately excluded from result/batch/baseline identities.
 */
export function normalizeVisualLabOriginAttestation(input) {
  assertExactFields(input);
  if (input.schema !== VISUAL_LAB_ORIGIN_ATTESTATION_SCHEMA) {
    throw new TypeError('Visual Lab origin attestation has an unsupported schema');
  }
  const baseUrlText = normalizeLivePagesBaseUrl(input.baseUrl);
  if (baseUrlText !== input.baseUrl) {
    throw new TypeError('Visual Lab origin attestation base URL is not canonical');
  }
  const baseUrl = new URL(baseUrlText);
  const revision = normalizeRevision(input.revision, 'Visual Lab origin revision');
  const postCaptureRevision = normalizeRevision(
    input.postCaptureRevision, 'Visual Lab post-capture origin revision',
  );
  if (postCaptureRevision !== revision) {
    throw new TypeError('Visual Lab deployed origin changed revision during capture');
  }
  const resources = normalizeResources(input.resources, baseUrl);
  if (!Number.isSafeInteger(input.checkedResources)
      || input.checkedResources !== resources.length) {
    throw new TypeError(
      'Visual Lab origin attestation resource count does not match its closure',
    );
  }
  return deepFreeze({
    schema: VISUAL_LAB_ORIGIN_ATTESTATION_SCHEMA,
    baseUrl: baseUrl.href,
    revision,
    checkedResources: resources.length,
    resources: [...resources],
    postCaptureRevision,
  });
}

export function createVisualLabOriginAttestation(preflight, postCaptureRevision) {
  if (preflight === null || typeof preflight !== 'object' || Array.isArray(preflight)) {
    throw new TypeError('Visual Lab deployed-origin preflight must be an object');
  }
  return normalizeVisualLabOriginAttestation({
    schema: VISUAL_LAB_ORIGIN_ATTESTATION_SCHEMA,
    baseUrl: preflight.baseUrl,
    revision: preflight.revision,
    checkedResources: preflight.resourceCount,
    resources: Array.isArray(preflight.resourcePaths)
      ? [...preflight.resourcePaths].sort() : preflight.resourcePaths,
    postCaptureRevision,
  });
}
