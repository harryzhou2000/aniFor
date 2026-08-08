import { createHash } from 'node:crypto';

export const VISUAL_LAB_RESULT_SCHEMA = 'anifor.visual-lab.result/v1';

const REQUEST_KEYS = Object.freeze([
  'domain',
  'target',
  'fixture',
  'gain',
  'renderScale',
]);
const CAPTURE_KEYS = Object.freeze(['off', 'a', 'b']);
const SHA256_HEX = /^[0-9a-f]{64}$/;

const assertExactRecord = (value, expectedKeys, label) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  const actualKeys = Reflect.ownKeys(value);
  const missing = expectedKeys.filter((key) => !actualKeys.includes(key));
  const unexpected = actualKeys.filter((key) => !expectedKeys.includes(key));
  if (missing.length > 0 || unexpected.length > 0) {
    const details = [
      missing.length > 0 ? `missing ${missing.join(', ')}` : '',
      unexpected.length > 0 ? `unexpected ${unexpected.map(String).join(', ')}` : '',
    ].filter(Boolean).join('; ');
    throw new TypeError(`${label} must contain exactly ${expectedKeys.join(', ')} (${details})`);
  }
};

const assertNonemptyString = (value, label) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
};

const normalizeCandidate = (candidate) => {
  if (candidate === null) return null;
  assertNonemptyString(candidate, 'candidate');
  return candidate;
};

const normalizeRequest = (request) => {
  assertExactRecord(request, REQUEST_KEYS, 'request');
  assertNonemptyString(request.domain, 'request.domain');
  if (!Number.isInteger(request.target) || request.target < 0 || request.target > 255) {
    throw new TypeError('request.target must be an integer from 0 through 255');
  }
  assertNonemptyString(request.fixture, 'request.fixture');
  if (!Number.isFinite(request.gain) || request.gain <= 0 || request.gain > 2) {
    throw new TypeError('request.gain must be greater than 0 and no greater than 2');
  }
  if (!Number.isInteger(request.renderScale) || request.renderScale <= 0) {
    throw new TypeError('request.renderScale must be a positive integer');
  }
  return Object.freeze({
    domain: request.domain,
    target: request.target,
    fixture: request.fixture,
    gain: request.gain,
    renderScale: request.renderScale,
  });
};

const normalizeCaptureHashes = (captures) => {
  assertExactRecord(captures, CAPTURE_KEYS, 'captures');
  for (const name of CAPTURE_KEYS) {
    if (typeof captures[name] !== 'string' || !SHA256_HEX.test(captures[name])) {
      throw new TypeError(`captures.${name} must be a lowercase 64-character SHA-256 hex digest`);
    }
  }
  return Object.freeze({ off: captures.off, a: captures.a, b: captures.b });
};

/**
 * Builds the content-addressed, JSON-safe record shared by capture producers and
 * later comparison/catalog tooling. Explicit reconstruction makes caller key
 * insertion order irrelevant while keeping the hashed JSON order stable.
 */
export function createVisualLabResultRecord(candidate, request, captures) {
  const normalizedCandidate = normalizeCandidate(candidate);
  const normalizedRequest = normalizeRequest(request);
  const captureSha256 = normalizeCaptureHashes(captures);
  const identity = {
    schema: VISUAL_LAB_RESULT_SCHEMA,
    candidate: normalizedCandidate,
    request: normalizedRequest,
    captureSha256,
  };
  const digest = createHash('sha256').update(JSON.stringify(identity), 'utf8').digest('hex');
  return Object.freeze({
    schema: VISUAL_LAB_RESULT_SCHEMA,
    id: `sha256:${digest}`,
    candidate: normalizedCandidate,
    request: normalizedRequest,
    captureSha256,
  });
}
