import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import {
  applyCanvasBotanicalMorphology, isBotanicalMaterial,
} from './canvas-botanical-style';

describe('Canvas botanical morphology', () => {
  it('gives each botanical a stable bounded identity without touching alpha', () => {
    const fingerprints = new Set<string>();
    for (const material of [
      Material.Wood, Material.Plant, Material.VINE, Material.SEED, Material.YEST,
    ]) {
      const color = new Float32Array([100, 110, 120, 191]);
      applyCanvasBotanicalMorphology(color, material, 19, 23, 1_250);
      const repeated = new Float32Array([100, 110, 120, 191]);
      applyCanvasBotanicalMorphology(repeated, material, 19, 23, 1_250);
      expect(repeated).toEqual(color);
      expect(color[3]).toBe(191);
      expect(Math.max(
        Math.abs(color[0] - 100), Math.abs(color[1] - 110), Math.abs(color[2] - 120),
      )).toBeLessThanOrEqual(12);
      fingerprints.add(Array.from(color.slice(0, 3), (value) => value.toFixed(3)).join(','));
    }
    expect(fingerprints.size).toBe(5);
  });

  it('is an exact RGB no-op outside the five botanical materials', () => {
    const color = new Float32Array([100, 110, 120, 191]);
    applyCanvasBotanicalMorphology(color, Material.VIRS, 19, 23, 1_250);
    expect(Array.from(color)).toEqual([100, 110, 120, 191]);
    expect(isBotanicalMaterial(Material.VIRS)).toBe(false);
    expect(isBotanicalMaterial(Material.SEED)).toBe(true);
  });
});
