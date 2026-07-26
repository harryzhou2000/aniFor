import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import {
  RADIOACTIVE_BODY_STYLE_BY_MATERIAL,
  CANVAS_RADIOACTIVE_IDENTITY_LOOKUP_BYTES,
  applyCanvasRadioactiveIdentityStyle,
  canvasRadioactiveBodyStyle,
} from './canvas-radioactive-identity-style';

const BODIES = [
  Material.BVBR, Material.PLUT, Material.POLO, Material.SING,
  Material.URAN, Material.ISZS, Material.VIBR,
] as const;

function style(material: number, x: number, y: number): Float32Array {
  const rgb = new Float32Array([96, 112, 128, 173]);
  applyCanvasRadioactiveIdentityStyle(rgb, material, x, y);
  return rgb;
}

describe('Canvas radioactive powder/solid identity styling', () => {
  it('maps exactly the seven exact-owner bodies', () => {
    expect(RADIOACTIVE_BODY_STYLE_BY_MATERIAL.byteLength).toBe(256);
    expect(CANVAS_RADIOACTIVE_IDENTITY_LOOKUP_BYTES).toBe(256);
    const expected = new Set<number>(BODIES);
    for (let index = 0; index < BODIES.length; index++) {
      expect(canvasRadioactiveBodyStyle(BODIES[index])).toBe(index + 1);
    }
    for (let material = 0; material < 256; material++) {
      expect(canvasRadioactiveBodyStyle(material)).toBe(expected.has(material)
        ? BODIES.indexOf(material as (typeof BODIES)[number]) + 1 : 0);
    }
  });

  it('is deterministic, RGB-only, bounded, and a no-op for fluid controls', () => {
    for (const material of BODIES) for (let y = -8; y < 24; y++) for (let x = -8; x < 24; x++) {
      const output = style(material, x, y);
      expect(style(material, x, y)).toEqual(output);
      expect(output[3]).toBe(173);
      expect(Math.max(
        Math.abs(output[0] - 96), Math.abs(output[1] - 112), Math.abs(output[2] - 128),
      )).toBeLessThanOrEqual(12);
    }
    for (const material of [Material.AMTR, Material.DEUT, Material.EXOT, Material.ISOZ, Material.WARP]) {
      expect(Array.from(style(material, 7, 11))).toEqual([96, 112, 128, 173]);
    }
  });

  it('gives every exact body a unique coherent fingerprint', () => {
    const fingerprints = new Set<string>();
    for (const material of BODIES) {
      let fingerprint = 2166136261;
      const responses = new Set<string>();
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        const output = style(material, x, y);
        const delta = [output[0] - 96, output[1] - 112, output[2] - 128];
        responses.add(delta.join(','));
        for (const value of delta) fingerprint = Math.imul(fingerprint ^ (value + 31), 16777619) >>> 0;
      }
      expect(responses.size).toBeGreaterThanOrEqual(2);
      fingerprints.add(fingerprint.toString(16));
    }
    expect(fingerprints.size).toBe(BODIES.length);
  });

  it('keeps VIBR interior lattice marks restrained while retaining charged rails', () => {
    const interior = style(Material.VIBR, 1, 1);
    const rail = style(Material.VIBR, 0, 1);
    expect(Array.from(interior)).toEqual([97, 114, 128, 173]);
    expect(rail[1]).toBe(123);
    expect(rail[2]).toBeGreaterThan(interior[2]);
  });
});
