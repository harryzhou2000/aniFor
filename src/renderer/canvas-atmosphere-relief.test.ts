import { describe, expect, it } from 'vitest';
import { shadeCanvasAtmosphere } from './canvas-atmosphere-relief';

function pixel(source: Uint8Array, width: number, x: number, y: number, rgba: readonly number[]): void {
  source.set(rgba, (y * width + x) * 4);
}

function luminance(source: Uint8ClampedArray, width: number, x: number, y: number): number {
  const offset = (y * width + x) * 4;
  return source[offset] * 0.2126 + source[offset + 1] * 0.7152 + source[offset + 2] * 0.0722;
}

describe('Canvas atmosphere relief', () => {
  it('preserves alpha, transparency, hue ordering, and source bytes', () => {
    const width = 3;
    const source = new Uint8Array(width * 2 * 4);
    pixel(source, width, 1, 0, [80, 140, 220, 96]);
    pixel(source, width, 1, 1, [80, 140, 220, 220]);
    const original = source.slice();
    const target = new Uint8ClampedArray(source.length);

    shadeCanvasAtmosphere(target, source, width, 2);

    expect(source).toEqual(original);
    for (let offset = 0; offset < source.length; offset += 4) {
      expect(target[offset + 3]).toBe(source[offset + 3]);
      if (source[offset + 3] === 0) expect(Array.from(target.slice(offset, offset + 4))).toEqual([0, 0, 0, 0]);
      else expect(target[offset]).toBeLessThan(target[offset + 1]);
    }
  });

  it('uses optical depth to darken a dense gas core without changing alpha', () => {
    const sparse = new Uint8Array([120, 150, 210, 96]);
    const dense = new Uint8Array([120, 150, 210, 220]);
    const sparseTarget = new Uint8ClampedArray(4);
    const denseTarget = new Uint8ClampedArray(4);
    shadeCanvasAtmosphere(sparseTarget, sparse, 1, 1);
    shadeCanvasAtmosphere(denseTarget, dense, 1, 1);
    expect(luminance(denseTarget, 1, 0, 0)).toBeLessThan(luminance(sparseTarget, 1, 0, 0));
    expect(denseTarget[3]).toBe(220);
    expect(sparseTarget[3]).toBe(96);
  });

  it('lights the upper-left flank of an equal-density hill', () => {
    const width = 5;
    const source = new Uint8Array(width * width * 4);
    for (const [x, y, alpha] of [[2, 2, 240], [1, 2, 96], [3, 2, 96], [2, 1, 96], [2, 3, 96]] as const) {
      pixel(source, width, x, y, [150, 160, 180, alpha]);
    }
    const target = new Uint8ClampedArray(source.length);
    shadeCanvasAtmosphere(target, source, width, width);

    expect(target[(2 * width + 1) * 4 + 3]).toBe(target[(2 * width + 3) * 4 + 3]);
    expect(luminance(target, width, 1, 2)).toBeGreaterThan(luminance(target, width, 3, 2));
    expect(luminance(target, width, 2, 1)).toBeGreaterThan(luminance(target, width, 2, 3));
  });

  it('lights a rounded crown and self-shadows a concave pocket without changing support', () => {
    const width = 5;
    const fixture = (neighbourAlpha: number) => {
      const source = new Uint8Array(width * width * 4);
      pixel(source, width, 2, 2, [130, 160, 205, 128]);
      for (const [x, y] of [[1, 2], [3, 2], [2, 1], [2, 3]] as const) {
        pixel(source, width, x, y, [130, 160, 205, neighbourAlpha]);
      }
      const target = new Uint8ClampedArray(source.length);
      shadeCanvasAtmosphere(target, source, width, width);
      return { source, target };
    };
    const crown = fixture(64);
    const flat = fixture(128);
    const pocket = fixture(220);

    expect(luminance(crown.target, width, 2, 2)).toBeGreaterThan(luminance(flat.target, width, 2, 2));
    expect(luminance(flat.target, width, 2, 2)).toBeGreaterThan(luminance(pocket.target, width, 2, 2));
    for (const result of [crown, flat, pocket]) {
      for (let offset = 3; offset < result.source.length; offset += 4) {
        expect(result.target[offset]).toBe(result.source[offset]);
      }
    }
  });

  it('rejects invalid dimensions and mismatched buffers', () => {
    expect(() => shadeCanvasAtmosphere(new Uint8ClampedArray(4), new Uint8Array(4), 0, 1)).toThrow('Invalid');
    expect(() => shadeCanvasAtmosphere(new Uint8ClampedArray(8), new Uint8Array(4), 1, 1)).toThrow('size');
  });
});
