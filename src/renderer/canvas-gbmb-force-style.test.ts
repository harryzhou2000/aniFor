import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { applyCanvasGbmbForceStyle, isCanvasGbmbForceMaterial } from './canvas-gbmb-force-style';

const SOURCE = [28, 77, 159, 171] as const;
function shade(material: number, x: number, y: number): number[] {
  const output = new Float32Array(SOURCE);
  applyCanvasGbmbForceStyle(output, material, x, y);
  return Array.from(output);
}

describe('Canvas GBMB force identity style', () => {
  it('is exact-owner, bounded, deterministic, and RGB-only', () => {
    expect(isCanvasGbmbForceMaterial(Material.GBMB)).toBe(true);
    expect(isCanvasGbmbForceMaterial(Material.DMG)).toBe(false);
    for (let y = -28; y <= 28; y++) for (let x = -28; x <= 28; x++) {
      const styled = shade(Material.GBMB, x, y);
      expect(shade(Material.GBMB, x, y)).toEqual(styled);
      expect(styled[3]).toBe(SOURCE[3]);
      for (let channel = 0; channel < 3; channel++) {
        expect(Math.abs(styled[channel] - SOURCE[channel])).toBeLessThanOrEqual(12);
      }
    }
  });

  it('keeps other force/powder/phase owners exact', () => {
    expect(shade(Material.DMG, 13, 17)).toEqual(Array.from(SOURCE));
    expect(shade(Material.FRAY, 13, 17)).toEqual(Array.from(SOURCE));
    expect(shade(Material.Water, 13, 17)).toEqual(Array.from(SOURCE));
    expect(shade(Material.Metal, 13, 17)).toEqual(Array.from(SOURCE));
  });
});
