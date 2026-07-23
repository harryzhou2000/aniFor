import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { applyCanvasSourceTargetStyle, isConfiguredSourceMaterial } from './canvas-source-target-style';

describe('Canvas configured-source target styling', () => {
  it('is exact-owner/state gated, RGB-only, deterministic, and bounded', () => {
    const owners = [Material.BCLN, Material.CLNE, Material.CONV, Material.PBCN, Material.PCLN];
    for (const owner of owners) {
      expect(isConfiguredSourceMaterial(owner)).toBe(true);
      const first = new Float32Array([80, 90, 100, 177]);
      const repeated = new Float32Array(first);
      applyCanvasSourceTargetStyle(first, owner, Material.Water, 41, 53);
      applyCanvasSourceTargetStyle(repeated, owner, Material.Water, 41, 53);
      expect(Array.from(first)).toEqual(Array.from(repeated));
      expect(first[3]).toBe(177);
      expect(Math.max(first[0] - 80, first[1] - 90, first[2] - 100)).toBeLessThanOrEqual(22);
      expect(first[0] + first[1] + first[2]).toBeGreaterThan(270);
    }

    for (const [material, target] of [
      [Material.Sand, Material.Water], [Material.CLNE, Material.Empty],
      [Material.CLNE, Material.CLNE], [Material.CLNE, 171],
      [Material.CLNE, 194], [Material.CLNE, 195], [Material.CLNE, 216],
      [Material.CLNE, 218], [Material.CLNE, 0xffff],
    ] as const) {
      const rgb = new Float32Array([80, 90, 100, 177]);
      applyCanvasSourceTargetStyle(rgb, material, target, 41, 53);
      expect(Array.from(rgb)).toEqual([80, 90, 100, 177]);
    }
  });

  it('gives representative targets distinct fit-view signatures', () => {
    const signatures = [
      Material.Sand, Material.Water, Material.Plant, Material.Fire, Material.Smoke,
      Material.Metal, Material.Glass, Material.DEUT, Material.PRTI, Material.BCOL,
    ].map((target) => {
      let signature = 2166136261;
      for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
        const rgb = new Float32Array(3);
        applyCanvasSourceTargetStyle(rgb, Material.CLNE, target, x, y);
        for (const value of rgb) signature = Math.imul(signature ^ Math.round(value * 16), 16777619) >>> 0;
      }
      return signature;
    });
    expect(new Set(signatures).size).toBe(signatures.length);
  });
});
