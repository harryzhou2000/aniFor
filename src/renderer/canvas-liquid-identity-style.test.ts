import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import {
  applyCanvasLiquidIdentityStyle,
  CANVAS_LIQUID_IDENTITY_LOOKUP_BYTES,
  hasCanvasLiquidIdentityStyle,
} from './canvas-liquid-identity-style';

const IDENTITY_LIQUIDS = [
  Material.Soap,
  Material.BIZR,
  Material.CBNW,
  Material.GEL,
  Material.GLOW,
  Material.VIRS,
  Material.FRZW,
  Material.RFGL,
  Material.DEUT,
  Material.EXOT,
  Material.ISOZ,
] as const;

function style(
  material: Material,
  x: number,
  y: number,
  neighbours = 6,
  fieldAlpha = 224,
  relief = 0.08,
  surface = 0.75,
  depth = 96,
): Float32Array {
  const output = new Float32Array([96, 112, 128, 173]);
  applyCanvasLiquidIdentityStyle(
    output, material, x, y, neighbours, fieldAlpha, relief, surface, depth,
  );
  return output;
}

describe('Canvas liquid identity styling', () => {
  it('keeps its world-independent lookup below 25 KiB', () => {
    expect(CANVAS_LIQUID_IDENTITY_LOOKUP_BYTES).toBe(34_169);
    expect(CANVAS_LIQUID_IDENTITY_LOOKUP_BYTES).toBeLessThan(34 * 1024);
  });

  it('covers the eight unusual and three radioactive exact liquid identities', () => {
    for (const material of IDENTITY_LIQUIDS) {
      expect(hasCanvasLiquidIdentityStyle(material)).toBe(true);
    }
    for (const material of [
      Material.Empty,
      Material.LiquidNitrogen,
      Material.LO2,
      Material.RSST,
      Material.VRSG,
      Material.BCOL,
    ]) {
      expect(hasCanvasLiquidIdentityStyle(material)).toBe(false);
    }
  });

  it('is deterministic, RGB-only, and bounded to fourteen channel bytes', () => {
    for (const material of IDENTITY_LIQUIDS) {
      for (let y = -8; y < 38; y++) {
        for (let x = -8; x < 42; x++) {
          const output = style(material, x, y);
          const repeated = style(material, x, y);
          expect(repeated).toEqual(output);
          expect(output[3]).toBe(173);
          expect(Math.max(
            Math.abs(output[0] - 96),
            Math.abs(output[1] - 112),
            Math.abs(output[2] - 128),
          )).toBeLessThanOrEqual(14);
        }
      }
    }
  });

  it('adds a bounded delta without clamping an out-of-range working RGB value', () => {
    for (const material of IDENTITY_LIQUIDS) {
      const baseline = [300, -40, 512, 173] as const;
      const output = new Float32Array(baseline);
      applyCanvasLiquidIdentityStyle(
        output, material, 31, 47, 8, 255, 0.18, 1, 255,
      );
      for (let channel = 0; channel < 3; channel++) {
        expect(Math.abs(output[channel] - baseline[channel])).toBeLessThanOrEqual(14);
      }
      expect(output[0]).toBeGreaterThan(255);
      expect(output[1]).toBeLessThan(0);
      expect(output[2]).toBeGreaterThan(255);
      expect(output[3]).toBe(173);
    }
  });

  it('gives all eleven materials unique coherent bulk fingerprints', () => {
    const fingerprints = new Set<string>();
    for (const material of IDENTITY_LIQUIDS) {
      let fingerprint = 2166136261;
      const responses = new Set<string>();
      for (let y = 0; y < 48; y++) {
        for (let x = 0; x < 48; x++) {
          const output = style(material, x, y);
          const deltas = [
            Math.round((output[0] - 96) * 4),
            Math.round((output[1] - 112) * 4),
            Math.round((output[2] - 128) * 4),
          ];
          responses.add(deltas.join(','));
          for (const delta of deltas) {
            fingerprint = Math.imul(fingerprint ^ (delta + 127), 16777619) >>> 0;
          }
        }
      }
      expect(responses.size).toBeGreaterThanOrEqual(2);
      fingerprints.add(fingerprint.toString(16));
    }
    expect(fingerprints.size).toBe(IDENTITY_LIQUIDS.length);
  });

  it('retains a bounded identity response on sparse and dense semantic cells', () => {
    for (const material of IDENTITY_LIQUIDS) {
      const sparse = style(material, 173, 91, 0, 45, 0, 0, 0);
      const dense = style(material, 173, 91, 8, 255, 0.12, 1, 255);
      expect(Array.from(sparse.slice(0, 3))).not.toEqual([96, 112, 128]);
      expect(Array.from(dense.slice(0, 3))).not.toEqual([96, 112, 128]);
      expect(sparse[3]).toBe(173);
      expect(dense[3]).toBe(173);
    }
  });

  it('exposes the requested motif anchors as non-flat world-space structures', () => {
    expect(style(Material.Soap, 0, 0)).not.toEqual(style(Material.Soap, 3, 3));
    expect(style(Material.BIZR, 0, 0)).not.toEqual(style(Material.BIZR, 4, 4));
    expect(style(Material.CBNW, 7, 7)).not.toEqual(style(Material.CBNW, 4, 8));
    expect(style(Material.GEL, 2, 3)).not.toEqual(style(Material.GEL, 12, 3));
    expect(style(Material.GLOW, 9, 2)).not.toEqual(style(Material.GLOW, 9, 9));
    expect(style(Material.VIRS, 0, 7)).not.toEqual(style(Material.VIRS, 7, 7));
    expect(style(Material.FRZW, 8, 1)).not.toEqual(style(Material.FRZW, 4, 3));
    expect(style(Material.RFGL, 10, 1)).not.toEqual(style(Material.RFGL, 10, 8));
    expect(style(Material.DEUT, 1, 1)).not.toEqual(style(Material.DEUT, 1, 8));
    expect(style(Material.EXOT, 1, 1)).not.toEqual(style(Material.EXOT, 6, 7));
    expect(style(Material.ISOZ, 8, 8)).not.toEqual(style(Material.ISOZ, 8, 2));
  });

  it('responds to existing volume inputs without changing topology state', () => {
    for (const material of IDENTITY_LIQUIDS) {
      const shallow = style(material, 11, 17, 2, 80, -0.12, 1, 0);
      const deep = style(material, 11, 17, 8, 255, 0.16, 0, 255);
      expect(deep).not.toEqual(shallow);
      expect(shallow[3]).toBe(173);
      expect(deep[3]).toBe(173);
    }
  });

  it('is an exact no-op for adjacent and same-family controls', () => {
    for (const material of [
      Material.Empty,
      Material.LiquidNitrogen,
      Material.LO2,
      Material.RSST,
      Material.VRSG,
      Material.BCOL,
    ]) {
      const output = new Float32Array([17, 29, 43, 211]);
      applyCanvasLiquidIdentityStyle(output, material, 12, 19, 6, 224, 0.08, 0.75, 96);
      expect(Array.from(output)).toEqual([17, 29, 43, 211]);
    }
  });
});
