import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import {
  applyCanvasCrystallineSolidMorphology,
  isCanvasCrystallineSolidMaterial,
} from './canvas-crystalline-solid-style';

const CRYSTALLINE_SOLIDS = [
  Material.DRIC,
  Material.NICE,
  Material.QRTZ,
  Material.RIME,
] as const;

function response(material: Material, x: number, y: number): readonly number[] {
  const output = new Float32Array([100, 110, 120, 173]);
  applyCanvasCrystallineSolidMorphology(output, material, x, y);
  return Array.from(output);
}

describe('Canvas crystalline-solid morphology', () => {
  it('covers exactly the four native solid identities, not powder quartz', () => {
    for (const material of CRYSTALLINE_SOLIDS) {
      expect(isCanvasCrystallineSolidMaterial(material)).toBe(true);
    }
    for (const material of [
      Material.Empty,
      Material.Ice,
      Material.Glass,
      Material.Quartz,
      Material.FRZZ,
      Material.RFGL,
    ]) {
      expect(isCanvasCrystallineSolidMaterial(material)).toBe(false);
    }
  });

  it('is deterministic, RGB-only, and bounded to fourteen channel bytes', () => {
    for (const material of CRYSTALLINE_SOLIDS) {
      for (let y = -35; y < 38; y++) {
        for (let x = -35; x < 38; x++) {
          const output = new Float32Array([96, 112, 128, 197]);
          const repeated = new Float32Array(output);
          applyCanvasCrystallineSolidMorphology(output, material, x, y);
          applyCanvasCrystallineSolidMorphology(repeated, material, x, y);
          expect(repeated).toEqual(output);
          expect(output[3]).toBe(197);
          expect(Math.max(
            Math.abs(output[0] - 96),
            Math.abs(output[1] - 112),
            Math.abs(output[2] - 128),
          )).toBeLessThanOrEqual(14);
        }
      }
    }
  });

  it('is exactly world-anchored to one 32-cell period', () => {
    for (const material of CRYSTALLINE_SOLIDS) {
      for (let y = -5; y <= 35; y += 5) {
        for (let x = -7; x <= 39; x += 7) {
          expect(response(material, x + 32, y)).toEqual(response(material, x, y));
          expect(response(material, x, y - 32)).toEqual(response(material, x, y));
        }
      }
    }
  });

  it('gives every material a distinct coherent bulk fingerprint', () => {
    const fingerprints = new Set<string>();
    for (const material of CRYSTALLINE_SOLIDS) {
      let fingerprint = 2166136261;
      const responses = new Set<string>();
      for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 32; x++) {
          const delta = response(material, x, y).slice(0, 3)
            .map((channel, index) => channel - [100, 110, 120][index]);
          responses.add(delta.join(','));
          for (const channel of delta) {
            fingerprint = Math.imul(fingerprint ^ (channel + 31), 16777619) >>> 0;
          }
        }
      }
      expect(responses.size).toBeGreaterThan(3);
      fingerprints.add(fingerprint.toString(16));
    }
    expect(fingerprints.size).toBe(CRYSTALLINE_SOLIDS.length);
  });

  it('keeps fracture, facet, prism, and deposition anchors distinct', () => {
    expect(response(Material.DRIC, 0, 0)).toEqual([90, 103, 116, 173]);
    expect(response(Material.DRIC, 4, 4)).toEqual([99, 110, 122, 173]);

    expect(response(Material.NICE, 0, 0)).toEqual([107, 120, 134, 173]);
    expect(response(Material.NICE, 3, 3)).toEqual([100, 111, 124, 173]);

    expect(response(Material.QRTZ, 0, 0)).toEqual([112, 119, 134, 173]);
    expect(response(Material.QRTZ, 3, 3)).toEqual([102, 110, 124, 173]);

    expect(response(Material.RIME, 8, 8)).toEqual([104, 119, 132, 173]);
    expect(response(Material.RIME, 15, 15)).toEqual([107, 121, 134, 173]);
  });

  it('is an exact no-op for all neighbouring optical controls', () => {
    for (const material of [
      Material.Ice,
      Material.Glass,
      Material.Quartz,
      Material.FRZZ,
      Material.RFGL,
      Material.Wax,
    ]) {
      const output = new Float32Array([17, 29, 43, 211]);
      applyCanvasCrystallineSolidMorphology(output, material, 12, 19);
      expect(Array.from(output)).toEqual([17, 29, 43, 211]);
    }
  });
});
