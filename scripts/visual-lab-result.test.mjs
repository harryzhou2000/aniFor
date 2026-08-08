import { describe, expect, it } from 'vitest';

import {
  createVisualLabResultRecord,
  VISUAL_LAB_RESULT_SCHEMA,
} from './visual-lab-result.mjs';

const HASHES = Object.freeze({
  off: '0'.repeat(64),
  a: '1'.repeat(64),
  b: 'f'.repeat(64),
});
const REQUEST = Object.freeze({
  domain: 'liquid',
  target: 2,
  fixture: 'moving-water',
  gain: 1.25,
  renderScale: 2,
});

describe('Visual Lab result records', () => {
  it('creates a stable content-addressed Visual Lab result', () => {
    const result = createVisualLabResultRecord('water-motion', REQUEST, HASHES);
    expect(result).toEqual({
      schema: VISUAL_LAB_RESULT_SCHEMA,
      id: 'sha256:7aca88ad3e8eedc831c891e575d00e83fc938a2ecf024a0124efc5ad3b7db3fd',
      candidate: 'water-motion',
      request: REQUEST,
      captureSha256: HASHES,
    });
  });

  it('canonicalizes request and capture key order', () => {
    const canonical = createVisualLabResultRecord('water-motion', REQUEST, HASHES);
    const reordered = createVisualLabResultRecord('water-motion', {
      renderScale: 2,
      gain: 1.25,
      fixture: 'moving-water',
      target: 2,
      domain: 'liquid',
    }, {
      b: HASHES.b,
      a: HASHES.a,
      off: HASHES.off,
    });
    expect(reordered).toEqual(canonical);
  });

  it('changes identity with candidate, request, or capture content', () => {
    const base = createVisualLabResultRecord('water-motion', REQUEST, HASHES);
    const ids = [
      createVisualLabResultRecord('water-motion-v2', REQUEST, HASHES).id,
      createVisualLabResultRecord('water-motion', { ...REQUEST, gain: 1.5 }, HASHES).id,
      createVisualLabResultRecord('water-motion', REQUEST, { ...HASHES, b: 'e'.repeat(64) }).id,
    ];
    for (const id of ids) expect(id).not.toBe(base.id);
    expect(new Set([base.id, ...ids])).toHaveLength(4);
  });

  it('rejects missing, malformed, and non-canonical capture hashes', () => {
    expect(
      () => createVisualLabResultRecord(null, REQUEST, { off: HASHES.off, a: HASHES.a }),
    ).toThrow(/missing b/);
    for (const captures of [
      { ...HASHES, off: '0'.repeat(63) },
      { ...HASHES, a: `${'1'.repeat(63)}g` },
      { ...HASHES, b: 'F'.repeat(64) },
      { ...HASHES, off: undefined },
    ]) {
      expect(() => createVisualLabResultRecord(null, REQUEST, captures)).toThrow(/SHA-256/);
    }
  });

  it('rejects incomplete, extended, or non-JSON-safe requests', () => {
    const { gain: _gain, ...missingGain } = REQUEST;
    expect(() => createVisualLabResultRecord(null, missingGain, HASHES)).toThrow(/missing gain/);
    expect(
      () => createVisualLabResultRecord(null, { ...REQUEST, ignored: true }, HASHES),
    ).toThrow(/unexpected ignored/);
    expect(
      () => createVisualLabResultRecord(null, { ...REQUEST, gain: Number.NaN }, HASHES),
    ).toThrow(/request\.gain/);
    expect(
      () => createVisualLabResultRecord(null, { ...REQUEST, target: 2n }, HASHES),
    ).toThrow(/request\.target/);
    for (const renderScale of [0, 1.5]) {
      expect(
        () => createVisualLabResultRecord(null, { ...REQUEST, renderScale }, HASHES),
      ).toThrow(/request\.renderScale/);
    }
  });

  it('returns a deeply frozen JSON-safe value', () => {
    const result = createVisualLabResultRecord(null, REQUEST, HASHES);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.request)).toBe(true);
    expect(Object.isFrozen(result.captureSha256)).toBe(true);
    expect(() => { result.id = 'sha256:tampered'; }).toThrow(TypeError);
    expect(() => { result.request.gain = 2; }).toThrow(TypeError);
    expect(() => { result.captureSha256.off = HASHES.b; }).toThrow(TypeError);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
});
