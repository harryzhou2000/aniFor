import { describe, expect, it } from 'vitest';

import {
  createVisualLabOriginAttestation,
  normalizeVisualLabOriginAttestation,
  VISUAL_LAB_ORIGIN_ATTESTATION_SCHEMA,
} from './visual-lab-origin-attestation.mjs';

const REVISION = '1234567890abcdef1234567890abcdef12345678';
const BASE_URL = 'https://example.test/aniFor/';
const RESOURCES = Object.freeze([
  '/aniFor/',
  '/aniFor/assets/app.js',
  '/aniFor/assets/style.css',
  '/aniFor/wasm/powder_core.wasm',
  '/aniFor/wasm/stillroom_core.js',
  '/aniFor/wasm/stillroom_core.wasm',
]);

const record = () => ({
  schema: VISUAL_LAB_ORIGIN_ATTESTATION_SCHEMA,
  baseUrl: BASE_URL,
  revision: REVISION,
  checkedResources: RESOURCES.length,
  resources: [...RESOURCES],
  postCaptureRevision: REVISION,
});

describe('Visual Lab deployed-origin attestation', () => {
  it('creates one frozen runtime-only preflight/postflight record', () => {
    const attestation = createVisualLabOriginAttestation({
      baseUrl: BASE_URL,
      revision: REVISION,
      resourceCount: RESOURCES.length,
      resourcePaths: [...RESOURCES].reverse(),
    }, REVISION);
    expect(attestation).toEqual(record());
    expect(Object.isFrozen(attestation)).toBe(true);
    expect(Object.isFrozen(attestation.resources)).toBe(true);
    expect(attestation).not.toHaveProperty('id');
  });

  it('rejects revision drift and malformed or noncanonical deployed roots', () => {
    expect(() => normalizeVisualLabOriginAttestation({
      ...record(), postCaptureRevision: 'a'.repeat(40),
    })).toThrow('changed revision');
    for (const baseUrl of [
      'file:///tmp/dist/index.html',
      'https://example.test/aniFor/?stale=1',
      'https://user@example.test/aniFor/',
      'https://example.test/aniFor',
    ]) {
      expect(() => normalizeVisualLabOriginAttestation({ ...record(), baseUrl }))
        .toThrow();
    }
  });

  it('rejects missing, escaped, duplicated, reordered, or miscounted closure paths', () => {
    expect(() => normalizeVisualLabOriginAttestation({
      ...record(), resources: RESOURCES.filter((path) => !path.endsWith('powder_core.wasm')),
      checkedResources: RESOURCES.length - 1,
    })).toThrow('missing wasm/powder_core.wasm');
    expect(() => normalizeVisualLabOriginAttestation({
      ...record(), resources: [...RESOURCES, '/outside.js'].sort(),
      checkedResources: RESOURCES.length + 1,
    })).toThrow('escapes');
    expect(() => normalizeVisualLabOriginAttestation({
      ...record(), resources: [...RESOURCES, RESOURCES[0]].sort(),
      checkedResources: RESOURCES.length + 1,
    })).toThrow('unique and sorted');
    expect(() => normalizeVisualLabOriginAttestation({
      ...record(), resources: [...RESOURCES].reverse(),
    })).toThrow('unique and sorted');
    expect(() => normalizeVisualLabOriginAttestation({
      ...record(), checkedResources: RESOURCES.length + 1,
    })).toThrow('resource count');
  });

  it('rejects schema extension so the portable proof cannot be reinterpreted', () => {
    expect(() => normalizeVisualLabOriginAttestation({ ...record(), extra: true }))
      .toThrow('unexpected or missing fields');
  });
});
