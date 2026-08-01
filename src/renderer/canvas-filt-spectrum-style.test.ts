import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { FILT_PRESENTATION_STATE } from '../simulation/types';
import { applyCanvasFiltSpectrumStyle, canvasFiltSpectrumState } from './canvas-filt-spectrum-style';

const owner = FILT_PRESENTATION_STATE.presentMask;
const state = (red: number, green: number, blue: number, life = 0): number => owner
  | (red << FILT_PRESENTATION_STATE.redShift)
  | (green << FILT_PRESENTATION_STATE.greenShift)
  | (blue << FILT_PRESENTATION_STATE.blueShift)
  | (life << FILT_PRESENTATION_STATE.lifeShift);

function styled(word: number, temperature = 2730): number[] {
  const output = new Float32Array([18, 22, 66]);
  applyCanvasFiltSpectrumStyle(output, Material.FILT, word, temperature);
  return Array.from(output);
}

describe('Canvas native FILT spectrum styling', () => {
  it('requires its exact semantic owner and present marker', () => {
    expect(canvasFiltSpectrumState(Material.FILT, owner | 0x21)).toEqual({ red: 1, green: 2, blue: 0, life: 0 });
    expect(canvasFiltSpectrumState(Material.Water, owner | 0x21)).toBeUndefined();
    expect(canvasFiltSpectrumState(Material.FILT, 0x21)).toBeUndefined();
  });

  it('reconstructs a bounded native RGB spectrum and keeps alpha outside the helper', () => {
    const red = styled(state(8, 0, 0));
    const blue = styled(state(0, 0, 8));
    expect(red[0]).toBeGreaterThan(red[2]);
    expect(blue[2]).toBeGreaterThan(blue[0]);
    expect(red.every((channel) => channel >= 0 && channel <= 255)).toBe(true);
  });

  it('uses temperature only for the exact zero-ctype sentinel and life strengthens reveal', () => {
    const cold = styled(owner, 2730);
    const hot = styled(owner, 12730);
    expect(cold).not.toEqual(hot);
    const dim = styled(state(2, 2, 2, 0));
    const bright = styled(state(2, 2, 2, 4));
    expect(bright[0]).toBeGreaterThan(dim[0]);
    const untouched = new Float32Array([18, 22, 66]);
    applyCanvasFiltSpectrumStyle(untouched, Material.Water, state(8, 0, 0), 2730);
    expect(Array.from(untouched)).toEqual([18, 22, 66]);
  });
});
