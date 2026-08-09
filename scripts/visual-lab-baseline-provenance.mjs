import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

import { createVisualCaptureGeometryProof } from '../src/shared/visual-capture-geometry.js';

export const VISUAL_LAB_BASELINE_CAPTURE_PROVENANCE_SCHEMA =
  'anifor.visual-lab.accepted-baseline-capture-provenance/v1';
export const VISUAL_LAB_BASELINE_CAPTURE_PROVENANCE_FILE = 'capture-provenance.json';

const SHA256_ID = /^sha256:[0-9a-f]{64}$/;

const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
};

const assertExactRecord = (value, keys, label) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  const actual = Reflect.ownKeys(value);
  const missing = keys.filter((key) => !actual.includes(key));
  const unexpected = actual.filter((key) => !keys.includes(key));
  if (missing.length > 0 || unexpected.length > 0) {
    const details = [
      missing.length > 0 ? `missing ${missing.join(', ')}` : '',
      unexpected.length > 0 ? `unexpected ${unexpected.map(String).join(', ')}` : '',
    ].filter(Boolean).join('; ');
    throw new TypeError(`${label} must contain exactly ${keys.join(', ')} (${details})`);
  }
};

const assertNormalizedBaselineShape = (baseline) => {
  if (baseline === null || typeof baseline !== 'object' || Array.isArray(baseline)
    || typeof baseline.schema !== 'string'
    || typeof baseline.id !== 'string' || !SHA256_ID.test(baseline.id)
    || !Array.isArray(baseline.candidates) || baseline.candidates.length === 0) {
    throw new TypeError('capture provenance requires a normalized accepted baseline');
  }
  for (const [index, entry] of baseline.candidates.entries()) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)
      || typeof entry.candidate !== 'string'
      || typeof entry.result?.id !== 'string' || !SHA256_ID.test(entry.result.id)
      || !Number.isInteger(entry.result?.request?.renderScale)) {
      throw new TypeError(`capture provenance baseline candidate ${index} is invalid`);
    }
  }
};

const provenanceIdentity = (baseline, captureGeometryByCandidate) => {
  assertNormalizedBaselineShape(baseline);
  if (!(captureGeometryByCandidate instanceof Map)) {
    throw new TypeError('capture provenance geometry must be a Map keyed by candidate');
  }
  const expectedNames = baseline.candidates.map(({ candidate }) => candidate);
  if (captureGeometryByCandidate.size !== expectedNames.length
    || [...captureGeometryByCandidate.keys()].some((candidate) => !expectedNames.includes(candidate))) {
    throw new TypeError('capture provenance geometry does not match baseline candidates');
  }
  const candidates = baseline.candidates.map(({ candidate, result }) => {
    const actualGeometry = captureGeometryByCandidate.get(candidate);
    const expectedGeometry = createVisualCaptureGeometryProof(result.request.renderScale);
    if (!isDeepStrictEqual(actualGeometry, expectedGeometry)) {
      throw new TypeError(
        `capture provenance geometry for ${candidate} does not match the canonical proof`,
      );
    }
    return {
      candidate,
      resultId: result.id,
      captureGeometry: expectedGeometry,
    };
  });
  return {
    schema: VISUAL_LAB_BASELINE_CAPTURE_PROVENANCE_SCHEMA,
    baseline: { schema: baseline.schema, id: baseline.id },
    candidates,
  };
};

/**
 * Builds additive, content-addressed capture provenance without changing the
 * accepted-baseline/result identities. Callers must supply geometry read from
 * validated source reports rather than reconstructing it from PNG dimensions.
 */
export function createVisualLabBaselineCaptureProvenance(
  baseline, captureGeometryByCandidate,
) {
  const identity = provenanceIdentity(baseline, captureGeometryByCandidate);
  const digest = createHash('sha256').update(JSON.stringify(identity), 'utf8').digest('hex');
  return deepFreeze({
    schema: identity.schema,
    id: `sha256:${digest}`,
    baseline: identity.baseline,
    candidates: identity.candidates,
  });
}

/** Validates a present sidecar exactly; omission policy remains an I/O concern. */
export function normalizeVisualLabBaselineCaptureProvenance(provenance, baseline) {
  assertExactRecord(
    provenance, ['schema', 'id', 'baseline', 'candidates'], 'baseline capture provenance',
  );
  if (provenance.schema !== VISUAL_LAB_BASELINE_CAPTURE_PROVENANCE_SCHEMA) {
    throw new TypeError(
      `baseline capture provenance must use ${VISUAL_LAB_BASELINE_CAPTURE_PROVENANCE_SCHEMA}`,
    );
  }
  if (typeof provenance.id !== 'string' || !SHA256_ID.test(provenance.id)) {
    throw new TypeError('baseline capture provenance id must be a SHA-256 identity');
  }
  assertExactRecord(provenance.baseline, ['schema', 'id'], 'baseline capture provenance baseline');
  if (!Array.isArray(provenance.candidates)) {
    throw new TypeError('baseline capture provenance candidates must be an array');
  }
  const geometry = new Map();
  for (const [index, entry] of provenance.candidates.entries()) {
    assertExactRecord(
      entry, ['candidate', 'resultId', 'captureGeometry'],
      `baseline capture provenance candidate ${index}`,
    );
    if (geometry.has(entry.candidate)) {
      throw new TypeError(`duplicate baseline capture provenance candidate ${entry.candidate}`);
    }
    geometry.set(entry.candidate, entry.captureGeometry);
  }
  const expected = createVisualLabBaselineCaptureProvenance(baseline, geometry);
  if (!isDeepStrictEqual(provenance, expected)) {
    throw new TypeError(
      'baseline capture provenance does not match its accepted baseline and content identity',
    );
  }
  return expected;
}

