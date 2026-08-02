import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { applyCanvasGooSolidCoreOptics, isCanvasGooSolidMaterial } from './canvas-goo-solid-style';

const SOURCE = [104, 116, 128, 173] as const;
function shade(
  material: number, x: number, y: number, dense = true, depth = 42, relief = 4, enabled = true,
): number[] {
  const output = new Float32Array(SOURCE);
  applyCanvasGooSolidCoreOptics(output, material, x, y, dense, depth, relief, enabled);
  return Array.from(output);
}

describe('Canvas GOO solid core optics', () => {
  it('is exact-owner, depth-proven, RGB-only, bounded, and deterministic', () => {
    expect(isCanvasGooSolidMaterial(Material.GOO)).toBe(true);
    expect(isCanvasGooSolidMaterial(Material.Water)).toBe(false);
    for (let y = -16; y <= 24; y++) for (let x = -16; x <= 24; x++) {
      const first = shade(Material.GOO, x, y);
      expect(shade(Material.GOO, x, y)).toEqual(first);
      expect(first[3]).toBe(SOURCE[3]);
      for (let channel = 0; channel < 3; channel++) {
        expect(Math.abs(first[channel] - SOURCE[channel])).toBeLessThanOrEqual(10);
      }
    }
  });

  it('keeps surfaces, controls, and other owners as exact no-ops', () => {
    expect(shade(Material.GOO, 13, 17, false)).toEqual(Array.from(SOURCE));
    expect(shade(Material.GOO, 13, 17, true, 6)).toEqual(Array.from(SOURCE));
    expect(shade(Material.GOO, 13, 17, true, 42, 4, false)).toEqual(Array.from(SOURCE));
    expect(shade(Material.Water, 13, 17)).toEqual(Array.from(SOURCE));
    expect(shade(Material.Metal, 13, 17)).toEqual(Array.from(SOURCE));
  });
});
