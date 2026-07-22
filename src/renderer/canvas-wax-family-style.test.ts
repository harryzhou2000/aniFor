import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { RenderPhase } from './render-profile';
import {
  applyCanvasWaxFamilyMorphology,
  CANVAS_WAX_FAMILY_LOOKUP_BYTES,
  canvasWaxFamilyMotifDelta,
  isWaxFamilyMaterial,
} from './canvas-wax-family-style';

describe('Canvas wax-family morphology', () => {
  it('owns one bounded shared phase lookup', () => {
    expect(CANVAS_WAX_FAMILY_LOOKUP_BYTES).toBe(2 * 32 * 32 * 3);
    expect(isWaxFamilyMaterial(Material.Wax)).toBe(true);
    expect(isWaxFamilyMaterial(Material.MWAX)).toBe(true);
    expect(isWaxFamilyMaterial(Material.Water)).toBe(false);
  });

  it('keeps one spatial grammar while giving each phase a distinct response', () => {
    const solid: number[] = [];
    const liquid: number[] = [];
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      solid.push(canvasWaxFamilyMotifDelta(RenderPhase.Solid, x, y, 0));
      liquid.push(canvasWaxFamilyMotifDelta(RenderPhase.Liquid, x, y, 0));
    }
    expect(new Set(solid).size).toBeGreaterThanOrEqual(4);
    expect(new Set(liquid).size).toBeGreaterThanOrEqual(4);
    expect(solid).not.toEqual(liquid);
    const sharedSign = solid.filter((value, index) => Math.sign(value) === Math.sign(liquid[index])).length;
    expect(sharedSign / solid.length).toBeGreaterThan(0.95);
  });

  it('changes only exact wax-family RGB and clamps bytes', () => {
    const solid = new Float32Array([250, 248, 252, 137]);
    applyCanvasWaxFamilyMorphology(solid, Material.Wax, RenderPhase.Solid, 0, 8);
    expect([...solid.slice(0, 3)]).not.toEqual([250, 248, 252]);
    expect(solid[3]).toBe(137);
    expect([...solid.slice(0, 3)].every((value) => value >= 0 && value <= 255)).toBe(true);

    const control = new Float32Array([40, 50, 60, 91]);
    applyCanvasWaxFamilyMorphology(control, Material.Metal, RenderPhase.Solid, 0, 8);
    expect([...control]).toEqual([40, 50, 60, 91]);
  });
});
