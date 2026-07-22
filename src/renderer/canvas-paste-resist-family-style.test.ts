import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { RenderPhase } from './render-profile';
import {
  applyCanvasPasteResistFamilyMorphology,
  CANVAS_PASTE_RESIST_FAMILY_LOOKUP_BYTES,
  canvasPasteResistFamilyMotifDelta,
  isPasteResistFamilyMaterial,
} from './canvas-paste-resist-family-style';

const FAMILY_MATERIALS = [
  Material.PSTE, Material.PSTS, Material.RSST, Material.RSSS,
] as const;

function delta(
  material: Material,
  phase: RenderPhase.Solid | RenderPhase.Liquid,
  x: number,
  y: number,
): readonly number[] {
  return [0, 1, 2].map((channel) => canvasPasteResistFamilyMotifDelta(
    material, phase, x, y, channel as 0 | 1 | 2,
  ));
}

describe('Canvas paste/resist phase-family morphology', () => {
  it('owns one bounded four-variant 32-cell lookup', () => {
    expect(CANVAS_PASTE_RESIST_FAMILY_LOOKUP_BYTES).toBe(2 * 2 * 32 * 32 * 3);
    for (const material of FAMILY_MATERIALS) {
      expect(isPasteResistFamilyMaterial(material)).toBe(true);
    }
    for (const material of [Material.Empty, Material.Wax, Material.MWAX, Material.Metal]) {
      expect(isPasteResistFamilyMaterial(material)).toBe(false);
    }
  });

  it('pins shared paste strata and rounded pockets across both phases', () => {
    expect(delta(Material.PSTE, RenderPhase.Liquid, 0, 0)).toEqual([6, 5, 3]);
    expect(delta(Material.PSTS, RenderPhase.Solid, 0, 0)).toEqual([-7, -6, -4]);
    expect(delta(Material.PSTE, RenderPhase.Liquid, 13, 8)).toEqual([-3, -2, 1]);
    expect(delta(Material.PSTS, RenderPhase.Solid, 13, 8)).toEqual([6, 4, 2]);
    expect(delta(Material.PSTE, RenderPhase.Liquid, 8, 8)).toEqual([1, 0, 2]);
    expect(delta(Material.PSTS, RenderPhase.Solid, 8, 8)).toEqual([1, 0, 2]);
  });

  it('pins shared resist diagonals, junctions, and nodes across both phases', () => {
    expect(delta(Material.RSST, RenderPhase.Liquid, 8, 8)).toEqual([10, 3, -3]);
    expect(delta(Material.RSSS, RenderPhase.Solid, 8, 8)).toEqual([13, 4, -4]);
    expect(delta(Material.RSST, RenderPhase.Liquid, 0, 0)).toEqual([12, 2, -2]);
    expect(delta(Material.RSSS, RenderPhase.Solid, 0, 0)).toEqual([14, 3, -3]);
    expect(delta(Material.RSST, RenderPhase.Liquid, 0, 1)).toEqual([7, 2, -2]);
    expect(delta(Material.RSSS, RenderPhase.Solid, 2, 1)).toEqual([7, -4, 2]);
    expect(delta(Material.RSST, RenderPhase.Liquid, 3, 2)).toEqual([2, -1, -1]);
    expect(delta(Material.RSSS, RenderPhase.Solid, 3, 2)).toEqual([1, -1, -2]);
  });

  it('is deterministic, world-tiled, RGB-only, and bounded to fourteen bytes', () => {
    for (const material of FAMILY_MATERIALS) {
      const phase = material === Material.PSTE || material === Material.RSST
        ? RenderPhase.Liquid : RenderPhase.Solid;
      for (let y = -9; y < 38; y++) for (let x = -9; x < 42; x++) {
        const output = new Float32Array([96, 112, 128, 173]);
        applyCanvasPasteResistFamilyMorphology(output, material, phase, x, y);
        const repeated = new Float32Array([96, 112, 128, 173]);
        applyCanvasPasteResistFamilyMorphology(repeated, material, phase, x, y);
        expect(repeated).toEqual(output);
        expect(output[3]).toBe(173);
        expect(Math.max(
          Math.abs(output[0] - 96),
          Math.abs(output[1] - 112),
          Math.abs(output[2] - 128),
        )).toBeLessThanOrEqual(14);
        expect(delta(material, phase, x, y)).toEqual(delta(material, phase, x + 32, y + 32));
      }
    }
  });

  it('clamps output bytes and leaves unrelated materials unchanged', () => {
    const bright = new Float32Array([250, 252, 254, 137]);
    applyCanvasPasteResistFamilyMorphology(
      bright, Material.RSSS, RenderPhase.Solid, 0, 0,
    );
    expect([...bright.slice(0, 3)].every((value) => value >= 0 && value <= 255)).toBe(true);
    expect(bright[3]).toBe(137);

    const control = new Float32Array([17, 29, 43, 211]);
    applyCanvasPasteResistFamilyMorphology(
      control, Material.Metal, RenderPhase.Solid, 0, 0,
    );
    expect([...control]).toEqual([17, 29, 43, 211]);
    expect(delta(Material.Metal, RenderPhase.Solid, 0, 0)).toEqual([0, 0, 0]);
  });
});
