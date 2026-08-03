import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import {
  applyCanvasCrystallinePowderStyle,
  isCanvasCrystallinePowderMaterial,
} from './canvas-crystalline-powder-style';

const CRYSTALS = [Material.Salt, Material.Snow, Material.Quartz] as const;

describe('Canvas crystalline-powder styling', () => {
  it('owns exactly Salt, Snow, and Powder Quartz', () => {
    for (const material of CRYSTALS) expect(isCanvasCrystallinePowderMaterial(material)).toBe(true);
    for (const material of [Material.Empty, Material.Sand, Material.BGLA, Material.QRTZ, Material.Water]) {
      expect(isCanvasCrystallinePowderMaterial(material)).toBe(false);
    }
  });

  it('is deterministic, RGB-only, bounded, and materially distinct', () => {
    const fingerprints = new Set<string>();
    for (const material of CRYSTALS) {
      let fingerprint = 2166136261;
      for (let y = -4; y < 28; y++) for (let x = -4; x < 32; x++) {
        const output = new Float32Array([96, 112, 128, 173]);
        const repeated = new Float32Array(output);
        applyCanvasCrystallinePowderStyle(output, material, x, y);
        applyCanvasCrystallinePowderStyle(repeated, material, x, y);
        expect(repeated).toEqual(output);
        expect(output[3]).toBe(173);
        for (let channel = 0; channel < 3; channel++) {
          expect(Math.abs(output[channel] - [96, 112, 128][channel])).toBeLessThanOrEqual(8);
          fingerprint = Math.imul(fingerprint ^ Math.round(output[channel] * 4), 16777619) >>> 0;
        }
      }
      fingerprints.add(fingerprint.toString(16));
    }
    expect(fingerprints.size).toBe(CRYSTALS.length);
  });

  it('is an exact no-op outside its three exact owners', () => {
    for (const material of [Material.Empty, Material.Sand, Material.BGLA, Material.QRTZ, Material.Water]) {
      const output = new Float32Array([17, 29, 43, 211]);
      applyCanvasCrystallinePowderStyle(output, material, 12, 19);
      expect(Array.from(output)).toEqual([17, 29, 43, 211]);
    }
  });
});
