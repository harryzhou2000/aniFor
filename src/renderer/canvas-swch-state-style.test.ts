import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { SWCH_PRESENTATION_STATE } from '../simulation/types';
import { applyCanvasSwchStateStyle, canvasSwchIsOn } from './canvas-swch-state-style';

const present = SWCH_PRESENTATION_STATE.presentMask;
const on = SWCH_PRESENTATION_STATE.onMask;

describe('Canvas native SWCH conducting-state styling', () => {
  it('requires the exact owner, native presence marker, and conducting state', () => {
    expect(canvasSwchIsOn(Material.SWCH, present | on)).toBe(true);
    expect(canvasSwchIsOn(Material.SWCH, present)).toBe(false);
    expect(canvasSwchIsOn(Material.SWCH, on)).toBe(false);
    expect(canvasSwchIsOn(Material.Water, present | on)).toBe(false);
  });

  it('adds a bounded emerald cue only to a projected on switch', () => {
    const base = [24, 58, 28];
    const enabled = new Float32Array(base);
    applyCanvasSwchStateStyle(enabled, Material.SWCH, present | on);
    expect(Array.from(enabled)).toEqual(expect.arrayContaining([
      expect.closeTo(31.84, 4), expect.closeTo(147.56, 4), expect.closeTo(61.6, 4),
    ]));

    for (const state of [0, present, on]) {
      const control = new Float32Array(base);
      applyCanvasSwchStateStyle(control, Material.SWCH, state);
      expect(Array.from(control)).toEqual(base);
    }
    const foreign = new Float32Array(base);
    applyCanvasSwchStateStyle(foreign, Material.Water, present | on);
    expect(Array.from(foreign)).toEqual(base);
  });
});
