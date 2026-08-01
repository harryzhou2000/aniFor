import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { LCRY_PRESENTATION_STATE } from '../simulation/types';
import { applyCanvasLcryStateStyle, canvasLcryBrightness } from './canvas-lcry-state-style';

const owner = LCRY_PRESENTATION_STATE.presentMask;

describe('Canvas native LCRY charge-brightness styling', () => {
  it('requires both the exact owner and native present marker', () => {
    expect(canvasLcryBrightness(Material.LCRY, owner)).toBe(0);
    expect(canvasLcryBrightness(Material.LCRY, owner | 10)).toBe(10);
    expect(canvasLcryBrightness(Material.LCRY, owner | 15)).toBe(10);
    expect(canvasLcryBrightness(Material.LCRY, 10)).toBeUndefined();
    expect(canvasLcryBrightness(Material.Water, owner | 10)).toBeUndefined();
  });

  it('uses the bounded native 0x50 + tmp2 * 0x10 gray ramp and leaves controls intact', () => {
    const dim = new Float32Array([31, 57, 91]);
    applyCanvasLcryStateStyle(dim, Material.LCRY, owner);
    expect(Array.from(dim)).toEqual([0x50, 0x50, 0x50]);

    const bright = new Float32Array([31, 57, 91]);
    applyCanvasLcryStateStyle(bright, Material.LCRY, owner | 10);
    expect(Array.from(bright)).toEqual([0xf0, 0xf0, 0xf0]);

    const control = new Float32Array([31, 57, 91]);
    applyCanvasLcryStateStyle(control, Material.Water, owner | 10);
    expect(Array.from(control)).toEqual([31, 57, 91]);
  });
});
