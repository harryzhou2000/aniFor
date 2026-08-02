import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { applyCanvasFrayForceStyle, isCanvasFrayForceMaterial } from './canvas-fray-force-style';

const SOURCE = [68, 142, 190, 177] as const;
function shade(material: number, x: number, y: number): number[] {
  const output = new Float32Array(SOURCE);
  applyCanvasFrayForceStyle(output, material, x, y);
  return Array.from(output);
}

describe('Canvas FRAY force identity style', () => {
  it('is exact-owner, RGB-only, bounded, and deterministic', () => {
    expect(isCanvasFrayForceMaterial(Material.FRAY)).toBe(true);
    expect(isCanvasFrayForceMaterial(Material.ARAY)).toBe(false);
    for (let y = -24; y <= 24; y++) for (let x = -24; x <= 24; x++) {
      const styled = shade(Material.FRAY, x, y);
      expect(shade(Material.FRAY, x, y)).toEqual(styled);
      expect(styled[3]).toBe(SOURCE[3]);
      for (let channel = 0; channel < 3; channel++) {
        expect(Math.abs(styled[channel] - SOURCE[channel])).toBeLessThanOrEqual(12);
      }
    }
  });

  it('keeps non-FRAY owners and an absent presentation layer exact', () => {
    expect(shade(Material.ARAY, 13, 17)).toEqual(Array.from(SOURCE));
    expect(shade(Material.Water, 13, 17)).toEqual(Array.from(SOURCE));
    expect(shade(Material.Metal, 13, 17)).toEqual(Array.from(SOURCE));
  });
});
