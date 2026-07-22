import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { RenderPhase } from './render-profile';
import {
  applyCanvasVirusFamilyMorphology, CANVAS_VIRUS_FAMILY_LOOKUP_BYTES,
  isVirusFamilyMaterial,
} from './canvas-virus-family-style';

const VIRUSES = [
  [Material.VIRS, RenderPhase.Liquid],
  [Material.VRSG, RenderPhase.Gas],
  [Material.VRSS, RenderPhase.Solid],
] as const;

function response(material: Material, phase: RenderPhase, x: number, y: number): number[] {
  const output = new Float32Array([100, 100, 100]);
  applyCanvasVirusFamilyMorphology(output, material, phase, x, y);
  return Array.from(output, (value) => value - 100);
}

describe('Canvas virus-family morphology', () => {
  it('recognizes only the three native virus phase identities', () => {
    expect(VIRUSES.map(([material]) => isVirusFamilyMaterial(material))).toEqual([true, true, true]);
    expect(isVirusFamilyMaterial(Material.Plant)).toBe(false);
    expect(isVirusFamilyMaterial(Material.BIZR)).toBe(false);
    expect(CANVAS_VIRUS_FAMILY_LOOKUP_BYTES).toBe(3 * 16 * 16 * 3);
  });

  it('is deterministic, bounded, RGB-only, and rejects a mismatched phase', () => {
    for (const [material, phase] of VIRUSES) {
      const first = response(material, phase, 7, 0);
      const second = response(material, phase, 7, 0);
      expect(first).toEqual(second);
      expect(first.some((value) => value !== 0)).toBe(true);
      expect(first.every((value) => Number.isInteger(value) && Math.abs(value) <= 12)).toBe(true);

      const mismatch = response(material, RenderPhase.Powder, 7, 0);
      expect(mismatch).toEqual([0, 0, 0]);
    }
  });

  it('keeps one membrane/capsid topology while retaining phase-specific response', () => {
    const signatures = VIRUSES.map(([material, phase]) => {
      const values: number[] = [];
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const delta = response(material, phase, x, y);
        values.push(Math.abs(delta[0]) + Math.abs(delta[1]) + Math.abs(delta[2]));
      }
      return values;
    });
    expect(new Set(signatures.map((values) => values.join(','))).size).toBe(3);

    const cosine = (left: number[], right: number[]): number => {
      let dot = 0;
      let leftSquared = 0;
      let rightSquared = 0;
      for (let index = 0; index < left.length; index++) {
        dot += left[index] * right[index];
        leftSquared += left[index] * left[index];
        rightSquared += right[index] * right[index];
      }
      return dot / Math.sqrt(leftSquared * rightSquared);
    };
    expect(cosine(signatures[0], signatures[1])).toBeGreaterThan(0.84);
    expect(cosine(signatures[0], signatures[2])).toBeGreaterThan(0.84);
    expect(cosine(signatures[1], signatures[2])).toBeGreaterThan(0.84);
  });
});
