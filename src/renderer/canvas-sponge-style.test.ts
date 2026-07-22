import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { applyCanvasSpongeMorphology } from './canvas-sponge-style';

describe('Canvas sponge morphology', () => {
  it('is deterministic, RGB-only, bounded, and varied across a coherent tile', () => {
    const responses = new Set<string>();
    for (let y = -19; y < 38; y++) {
      for (let x = -19; x < 38; x++) {
        const output = new Float32Array([180, 150, 70, 173]);
        const repeated = new Float32Array(output);
        applyCanvasSpongeMorphology(output, Material.SPNG, x, y);
        applyCanvasSpongeMorphology(repeated, Material.SPNG, x, y);
        expect(repeated).toEqual(output);
        expect(output[3]).toBe(173);
        expect(Math.max(
          Math.abs(output[0] - 180),
          Math.abs(output[1] - 150),
          Math.abs(output[2] - 70),
        )).toBeLessThanOrEqual(12);
        responses.add(Array.from(output.slice(0, 3)).join(','));
      }
    }
    expect(responses.size).toBe(4);
  });

  it('keeps pore cores darker than their upper-left lips', () => {
    const response = (x: number, y: number): readonly number[] => {
      const output = new Float32Array([180, 150, 70, 211]);
      applyCanvasSpongeMorphology(output, Material.SPNG, x, y);
      return Array.from(output);
    };
    expect(response(5, 5)).toEqual([172, 143, 67, 211]);
    expect(response(2, 5)).toEqual([187, 155, 69, 211]);
    expect(response(8, 5)).toEqual([176, 147, 69, 211]);
  });

  it('is an exact no-op for adjacent and unrelated materials', () => {
    for (const material of [Material.RSSS, Material.SHLD1, Material.TTAN, Material.VINE]) {
      const output = new Float32Array([17, 29, 43, 197]);
      applyCanvasSpongeMorphology(output, material, 5, 5);
      expect(Array.from(output)).toEqual([17, 29, 43, 197]);
    }
  });
});
