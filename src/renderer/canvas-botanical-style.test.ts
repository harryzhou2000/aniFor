import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import {
  applyCanvasBotanicalMorphology, applyCanvasPlantCanopyVolume, isBotanicalMaterial,
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

  it('adds bounded canopy volume only to a field-proven deep Plant body', () => {
    const base = [101, 169, 95, 197] as const;
    const crown = new Float32Array(base);
    const pocket = new Float32Array(base);
    const firstInterior = new Float32Array(base);
    const stem = new Float32Array(base);
    const wood = new Float32Array(base);

    applyCanvasPlantCanopyVolume(crown, Material.Plant, true, 42, true, 6);
    applyCanvasPlantCanopyVolume(pocket, Material.Plant, true, 42, true, -6);
    applyCanvasPlantCanopyVolume(firstInterior, Material.Plant, true, 6, true, 6);
    applyCanvasPlantCanopyVolume(stem, Material.Plant, false, 255, true, 6);
    applyCanvasPlantCanopyVolume(wood, Material.Wood, true, 255, true, 6);

    expect(crown[1] - base[1]).toBeGreaterThan(crown[0] - base[0]);
    expect(crown[1] - base[1]).toBeLessThanOrEqual(6.5);
    expect(pocket[0]).toBeLessThan(base[0]);
    expect(pocket[2] / base[2]).toBeLessThan(pocket[1] / base[1]);
    expect(firstInterior).toEqual(new Float32Array(base));
    expect(stem).toEqual(new Float32Array(base));
    expect(wood).toEqual(new Float32Array(base));
    expect(crown[3]).toBe(base[3]);
    expect(pocket[3]).toBe(base[3]);
  });
});
