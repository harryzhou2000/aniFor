import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { BASE_PRESENTATION_STATE } from '../simulation/types';
import {
  applyCanvasBaseStateStyle,
  canvasBasePresentationState,
} from './canvas-base-state-style';

function state(concentration: number, sparked = false): number {
  return (concentration & BASE_PRESENTATION_STATE.concentrationMask)
    | (sparked ? BASE_PRESENTATION_STATE.sparkMask : 0);
}

describe('Canvas BASE native-state style', () => {
  it('decodes exact-owner zero concentration and the authentic spark flag', () => {
    expect(canvasBasePresentationState(Material.BASE, 0)).toEqual({
      concentration: 0,
      sparked: false,
    });
    expect(canvasBasePresentationState(Material.BASE, state(76, true))).toEqual({
      concentration: 76,
      sparked: true,
    });
    expect(canvasBasePresentationState(Material.BASE, 0x007f)?.concentration)
      .toBe(BASE_PRESENTATION_STATE.concentrationMaximum);
    expect(canvasBasePresentationState(Material.Water, state(25, true))).toBeUndefined();
  });

  it.each([
    [0, [51, 76, 216]],
    [25, [51, 76, 216]],
    [26, [88, 131, 232]],
    [50, [88, 131, 232]],
    [51, [125, 186, 247]],
    [75, [125, 186, 247]],
    [76, [144, 213, 255]],
    [100, [144, 213, 255]],
  ] as const)('preserves upstream concentration band %i', (concentration, expected) => {
    const output = new Float32Array([144, 213, 255]);
    applyCanvasBaseStateStyle(output, Material.BASE, state(concentration), 7, 11);
    expect(Array.from(output)).toEqual(expected);
  });

  it('keeps body relief additive and makes the reaction spark deterministic', () => {
    const ordinary = new Float32Array([151, 204, 239]);
    const first = new Float32Array(ordinary);
    const repeat = new Float32Array(ordinary);
    applyCanvasBaseStateStyle(first, Material.BASE, state(76, true), 4, 2);
    applyCanvasBaseStateStyle(repeat, Material.BASE, state(76, true), 4, 2);
    expect(Array.from(first)).toEqual(Array.from(repeat));
    expect(first[0]).toBeGreaterThan(ordinary[0]);
    expect(first[1]).toBeGreaterThan(ordinary[1]);
    expect(first[2]).toBeGreaterThan(ordinary[2]);

    const wrongOwner = new Float32Array(ordinary);
    applyCanvasBaseStateStyle(wrongOwner, Material.Acid, state(25, true), 4, 2);
    expect(Array.from(wrongOwner)).toEqual(Array.from(ordinary));
  });
});
