import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import {
  applyCanvasUnusualPowderStyle,
  isCanvasUnusualPowderMaterial,
} from './canvas-unusual-powder-style';

const UNUSUAL_POWDERS = [
  Material.ANAR,
  Material.BGLA,
  Material.BREC,
  Material.BRMT,
  Material.FRZZ,
  Material.GRAV,
  Material.SAWD,
  Material.SLCN,
  Material.DYST,
  Material.BCOL,
] as const;

describe('Canvas unusual-powder styling', () => {
  it('covers exactly the requested non-contiguous identities', () => {
    for (const material of UNUSUAL_POWDERS) {
      expect(isCanvasUnusualPowderMaterial(material)).toBe(true);
    }
    for (const material of [
      Material.Empty,
      Material.NobleGas,
      Material.SEED,
      Material.YEST,
      Material.BIZRG,
      Material.VRSS,
    ]) {
      expect(isCanvasUnusualPowderMaterial(material)).toBe(false);
    }
  });

  it('is deterministic, RGB-only, and bounded to fourteen channel bytes', () => {
    for (const material of UNUSUAL_POWDERS) {
      for (let y = -5; y < 28; y++) {
        for (let x = -5; x < 32; x++) {
          const index = (y + 16) * 612 + x + 16;
          const output = new Float32Array([96, 112, 128, 173]);
          applyCanvasUnusualPowderStyle(output, material, x, y, index, 2.5, -1.25);
          const repeated = new Float32Array([96, 112, 128, 173]);
          applyCanvasUnusualPowderStyle(repeated, material, x, y, index, 2.5, -1.25);
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

  it('gives every material a distinct bulk fingerprint and visible variation', () => {
    const fingerprints = new Set<string>();
    for (const material of UNUSUAL_POWDERS) {
      let fingerprint = 2166136261;
      const responses = new Set<string>();
      let changed = 0;
      for (let y = 0; y < 35; y++) {
        for (let x = 0; x < 41; x++) {
          const index = y * 612 + x;
          const output = new Float32Array([100, 110, 120, 199]);
          applyCanvasUnusualPowderStyle(output, material, x, y, index, 1.5, -0.75);
          const deltas = [
            Math.round((output[0] - 100) * 4),
            Math.round((output[1] - 110) * 4),
            Math.round((output[2] - 120) * 4),
          ];
          if (deltas[0] !== 0 || deltas[1] !== 0 || deltas[2] !== 0) changed++;
          responses.add(deltas.join(','));
          for (const delta of deltas) {
            fingerprint = Math.imul(fingerprint ^ (delta + 127), 16777619) >>> 0;
          }
        }
      }
      expect(changed).toBeGreaterThan(1000);
      expect(responses.size).toBeGreaterThan(4);
      fingerprints.add(fingerprint.toString(16));
    }
    expect(fingerprints.size).toBe(UNUSUAL_POWDERS.length);
  });

  it('keeps isolated grains styled while preserving their topology', () => {
    for (const material of UNUSUAL_POWDERS) {
      const output = new Float32Array([80, 96, 112, 151]);
      applyCanvasUnusualPowderStyle(output, material, 173, 91, 91 * 612 + 173, -2, 3);
      expect(Array.from(output.slice(0, 3))).not.toEqual([80, 96, 112]);
      expect(output[3]).toBe(151);
    }
  });

  it('orients GRAV bands with velocity and keeps stationary output stable', () => {
    const renderFingerprint = (velocityX: number, velocityY: number): number => {
      let fingerprint = 2166136261;
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const output = new Float32Array([100, 110, 120, 255]);
          applyCanvasUnusualPowderStyle(
            output, Material.GRAV, x, y, y * 612 + x, velocityX, velocityY,
          );
          fingerprint = Math.imul(fingerprint ^ Math.round(output[0] * 4), 16777619) >>> 0;
          fingerprint = Math.imul(fingerprint ^ Math.round(output[2] * 4), 16777619) >>> 0;
        }
      }
      return fingerprint;
    };

    expect(renderFingerprint(3, 0)).not.toBe(renderFingerprint(0, 3));
    expect(renderFingerprint(2, 2)).not.toBe(renderFingerprint(2, -2));
    expect(renderFingerprint(0, 0)).toBe(renderFingerprint(0, 0));
  });

  it('is an exact no-op for every control material', () => {
    for (const material of [
      Material.Empty,
      Material.Sand,
      Material.SEED,
      Material.YEST,
      Material.BIZR,
      Material.DYST + 1,
      Material.BCOL - 1,
    ]) {
      const output = new Float32Array([17, 29, 43, 211]);
      applyCanvasUnusualPowderStyle(output, material, 12, 19, 11640, 4, -3);
      expect(Array.from(output)).toEqual([17, 29, 43, 211]);
    }
  });
});
