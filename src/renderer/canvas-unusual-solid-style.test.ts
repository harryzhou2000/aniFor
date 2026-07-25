import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import {
  applyCanvasUnusualSolidMorphology,
  isCanvasUnusualSolidMaterial,
} from './canvas-unusual-solid-style';

const UNUSUAL_SOLIDS = [
  Material.BIZRS,
  Material.PSTS,
  Material.RSSS,
  Material.SHLD1,
  Material.SHLD2,
  Material.SHLD3,
  Material.SHLD4,
  Material.VRSS,
  Material.Wax,
  Material.DRIC,
  Material.NICE,
  Material.QRTZ,
  Material.RIME,
  Material.LOLZ,
  Material.LOVE,
  Material.SPAWN,
  Material.SPAWN2,
] as const;

describe('Canvas unusual-solid morphology', () => {
  it('covers exactly the seventeen requested non-contiguous identities', () => {
    for (const material of UNUSUAL_SOLIDS) {
      expect(isCanvasUnusualSolidMaterial(material)).toBe(true);
    }
    for (const material of [
      Material.Empty,
      Material.SPNG,
      Material.BIZRG,
      Material.RFGL,
      Material.VRSG,
      Material.BCOL,
      Material.Quartz,
    ]) {
      expect(isCanvasUnusualSolidMaterial(material)).toBe(false);
    }
  });

  it('is deterministic, RGB-only, and bounded to fourteen channel bytes', () => {
    for (const material of UNUSUAL_SOLIDS) {
      for (let y = -7; y < 34; y++) {
        for (let x = -7; x < 38; x++) {
          const index = (y + 12) * 612 + x + 12;
          const output = new Float32Array([96, 112, 128, 173]);
          applyCanvasUnusualSolidMorphology(output, material, x, y, index);
          const repeated = new Float32Array([96, 112, 128, 173]);
          applyCanvasUnusualSolidMorphology(repeated, material, x, y, index);
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

  it('gives every morphology a unique coherent bulk fingerprint', () => {
    const fingerprints = new Set<string>();
    for (const material of UNUSUAL_SOLIDS) {
      let fingerprint = 2166136261;
      const responses = new Set<string>();
      for (let y = 0; y < 48; y++) {
        for (let x = 0; x < 48; x++) {
          const output = new Float32Array([100, 110, 120, 199]);
          applyCanvasUnusualSolidMorphology(output, material, x, y, y * 612 + x);
          const deltas = [
            Math.round((output[0] - 100) * 2),
            Math.round((output[1] - 110) * 2),
            Math.round((output[2] - 120) * 2),
          ];
          responses.add(deltas.join(','));
          for (const delta of deltas) {
            fingerprint = Math.imul(fingerprint ^ (delta + 63), 16777619) >>> 0;
          }
        }
      }
      expect(responses.size).toBeGreaterThan(2);
      fingerprints.add(fingerprint.toString(16));
    }
    expect(fingerprints.size).toBe(UNUSUAL_SOLIDS.length);
  });

  it('retains a material-specific response on isolated cells', () => {
    const responses = new Set<string>();
    for (const material of UNUSUAL_SOLIDS) {
      const output = new Float32Array([80, 96, 112, 151]);
      applyCanvasUnusualSolidMorphology(output, material, 173, 91, 91 * 612 + 173);
      expect(Array.from(output.slice(0, 3))).not.toEqual([80, 96, 112]);
      expect(output[3]).toBe(151);
      responses.add(Array.from(output.slice(0, 3)).join(','));
    }
    expect(responses.size).toBe(UNUSUAL_SOLIDS.length);
  });

  it('makes each SHLD stage retain prior shells and add denser nested plates', () => {
    const stages = [Material.SHLD1, Material.SHLD2, Material.SHLD3, Material.SHLD4] as const;
    const accentedCounts: number[] = [];
    for (const material of stages) {
      let accented = 0;
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const output = new Float32Array([100, 110, 120, 255]);
          applyCanvasUnusualSolidMorphology(output, material, x, y, y * 612 + x);
          if (output[2] - 120 >= 7) accented++;
        }
      }
      accentedCounts.push(accented);
    }
    expect(accentedCounts[0]).toBeGreaterThan(0);
    expect(accentedCounts[1]).toBeGreaterThan(accentedCounts[0]);
    expect(accentedCounts[2]).toBeGreaterThan(accentedCounts[1]);
    expect(accentedCounts[3]).toBeGreaterThan(accentedCounts[2]);
  });

  it('keeps phase-family and crystalline anchors visibly distinct', () => {
    const response = (material: Material, x: number, y: number): readonly number[] => {
      const output = new Float32Array([100, 110, 120, 201]);
      applyCanvasUnusualSolidMorphology(output, material, x, y, y * 612 + x);
      return Array.from(output);
    };

    expect(response(Material.BIZRS, 0, 0)).not.toEqual(response(Material.BIZRS, 4, 4));
    expect(response(Material.PSTS, 4, 0)).not.toEqual(response(Material.PSTS, 4, 3));
    expect(response(Material.RSSS, 0, 0)).not.toEqual(response(Material.RSSS, 3, 2));
    expect(response(Material.VRSS, 0, 7)).not.toEqual(response(Material.VRSS, 7, 7));
    expect(response(Material.Wax, 0, 0)).not.toEqual(response(Material.Wax, 3, 3));
    expect(response(Material.DRIC, 0, 0)).not.toEqual(response(Material.DRIC, 4, 4));
    expect(response(Material.NICE, 0, 0)).not.toEqual(response(Material.NICE, 3, 3));
    expect(response(Material.QRTZ, 0, 0)).not.toEqual(response(Material.QRTZ, 3, 3));
    expect(response(Material.RIME, 8, 8)).not.toEqual(response(Material.RIME, 12, 8));
  });

  it('is an exact no-op for controls adjacent to every target range', () => {
    for (const material of [
      Material.Empty,
      Material.SPNG,
      Material.BIZRG,
      Material.BRAY,
      Material.RFGL,
      Material.VRSG,
      Material.PSTE,
      Material.RSST,
      Material.BCOL,
      Material.Quartz,
    ]) {
      const output = new Float32Array([17, 29, 43, 211]);
      applyCanvasUnusualSolidMorphology(output, material, 12, 19, 11640);
      expect(Array.from(output)).toEqual([17, 29, 43, 211]);
    }
  });
});
