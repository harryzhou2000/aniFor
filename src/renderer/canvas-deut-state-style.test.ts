import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { DEUT_PRESENTATION_STATE } from '../simulation/types';
import { applyCanvasDeutStateStyle } from './canvas-deut-state-style';

describe('Canvas DEUT native-state styling', () => {
  it('is an exact no-op for state zero and for non-DEUT owners', () => {
    const zero = new Float32Array([12, 34, 56]);
    applyCanvasDeutStateStyle(zero, Material.DEUT, 0, 8, 8);
    expect(Array.from(zero)).toEqual([12, 34, 56]);

    const wrongOwner = new Float32Array([12, 34, 56]);
    applyCanvasDeutStateStyle(
      wrongOwner, Material.Water, DEUT_PRESENTATION_STATE.maximumConcentration, 8, 8,
    );
    expect(Array.from(wrongOwner)).toEqual([12, 34, 56]);
  });

  it('makes native concentration monotonic while retaining spatial structure', () => {
    const response = (state: number, x = 8, y = 13): number[] => {
      const color = new Float32Array([12, 34, 56]);
      applyCanvasDeutStateStyle(color, Material.DEUT, state, x, y);
      return Array.from(color, (value, channel) => value - [12, 34, 56][channel]);
    };
    const ordinary = response(DEUT_PRESENTATION_STATE.defaultConcentration);
    const glowing = response(DEUT_PRESENTATION_STATE.glowThreshold);
    const compressed = response(DEUT_PRESENTATION_STATE.maximumConcentration);
    for (let channel = 0; channel < 3; channel++) {
      expect(ordinary[channel]).toBeGreaterThan(0);
      expect(glowing[channel]).toBeGreaterThan(ordinary[channel]);
      expect(compressed[channel]).toBeGreaterThan(glowing[channel]);
    }
    expect(response(DEUT_PRESENTATION_STATE.maximumConcentration, 0, 0))
      .not.toEqual(compressed);
    expect(Math.max(...compressed)).toBeLessThanOrEqual(35);

    const preGlow = response(DEUT_PRESENTATION_STATE.glowThreshold - 1);
    const glow = response(DEUT_PRESENTATION_STATE.glowThreshold);
    expect(glow[2] - preGlow[2]).toBeGreaterThan(6);
  });
});
