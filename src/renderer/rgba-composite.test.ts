import { describe, expect, it } from 'vitest';
import { compositePixel } from './rgba-composite';

describe('straight-alpha pixel compositing', () => {
  it('preserves an opaque wall beneath translucent material', () => {
    const pixel = new Uint8ClampedArray([100, 120, 140, 255]);
    compositePixel(pixel, 0, 20, 180, 220, 128);
    expect(Array.from(pixel)).toEqual([60, 150, 180, 255]);
  });

  it('preserves source colour and alpha over transparency', () => {
    const pixel = new Uint8ClampedArray(4);
    compositePixel(pixel, 0, 20, 180, 220, 128);
    expect(Array.from(pixel)).toEqual([20, 180, 220, 128]);
  });
});
