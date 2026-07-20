import { describe, expect, it } from 'vitest';
import {
  canvasAtmosphereAlphaAtWorldCell, canvasGasSemanticAccentAlpha, shadeCanvasAtmosphere,
} from './canvas-atmosphere-relief';

function pixel(source: Uint8Array, width: number, x: number, y: number, rgba: readonly number[]): void {
  source.set(rgba, (y * width + x) * 4);
}

function luminance(source: Uint8ClampedArray, width: number, x: number, y: number): number {
  const offset = (y * width + x) * 4;
  return source[offset] * 0.2126 + source[offset + 1] * 0.7152 + source[offset + 2] * 0.0722;
}

describe('Canvas atmosphere relief', () => {
  it('samples atmosphere alpha linearly in world-cell coordinates', () => {
    const source = new Uint8Array(2 * 2 * 4);
    source[3] = 0;
    source[7] = 255;
    source[11] = 255;
    source[15] = 0;
    const centre = canvasAtmosphereAlphaAtWorldCell(source, 2, 2, 4, 4, 1.5, 1.5);
    expect(centre).toBeCloseTo(0.5, 5);
    expect(canvasAtmosphereAlphaAtWorldCell(source, 2, 2, 4, 4, 0, 0)).toBe(0);
  });

  it('hands dense gas mass to the atmosphere while retaining a bounded species accent', () => {
    const sparse = canvasGasSemanticAccentAlpha(0.01, 4, false);
    const dense = canvasGasSemanticAccentAlpha(0.7, 4, false);
    const emissive = canvasGasSemanticAccentAlpha(0.7, 4, true);
    expect(dense).toBeLessThan(sparse);
    expect(emissive).toBeGreaterThan(dense);
    expect(dense).toBeGreaterThanOrEqual(12);
    expect(sparse).toBeLessThanOrEqual(68);
  });

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

  it('adds chromatic billow depth without changing alpha or flat gas', () => {
    const width = 5;
    const source = new Uint8Array(width * width * 4);
    pixel(source, width, 2, 2, [90, 130, 190, 132]);
    pixel(source, width, 1, 2, [90, 130, 190, 52]);
    pixel(source, width, 3, 2, [90, 130, 190, 180]);
    pixel(source, width, 2, 1, [90, 130, 190, 52]);
    pixel(source, width, 2, 3, [90, 130, 190, 180]);
    const flat = new Uint8ClampedArray(source.length);
    const chromatic = new Uint8ClampedArray(source.length);

    shadeCanvasAtmosphere(flat, source, width, width, undefined, false);
    shadeCanvasAtmosphere(chromatic, source, width, width, undefined, true);

    const offset = (2 * width + 2) * 4;
    expect(chromatic[offset + 2] - flat[offset + 2])
      .toBeGreaterThan(chromatic[offset] - flat[offset]);
    for (let alpha = 3; alpha < source.length; alpha += 4) {
      expect(chromatic[alpha]).toBe(source[alpha]);
      expect(flat[alpha]).toBe(source[alpha]);
    }

    const uniform = new Uint8Array([90, 130, 190, 132]);
    const uniformFlat = new Uint8ClampedArray(4);
    const uniformChromatic = new Uint8ClampedArray(4);
    shadeCanvasAtmosphere(uniformFlat, uniform, 1, 1, undefined, false);
    shadeCanvasAtmosphere(uniformChromatic, uniform, 1, 1, undefined, true);
    expect(uniformChromatic).toEqual(uniformFlat);
  });

  it('scatters coloured field light onto the facing gas flank without changing alpha', () => {
    const width = 5;
    const source = new Uint8Array(width * width * 4);
    for (const [x, alpha] of [[1, 112], [2, 220], [3, 112]] as const) {
      pixel(source, width, x, 2, [90, 120, 160, alpha]);
    }
    const light = new Uint8Array(source.length);
    pixel(light, width, 0, 2, [255, 112, 36, 255]);
    pixel(light, width, 1, 2, [255, 112, 36, 200]);
    pixel(light, width, 2, 2, [255, 112, 36, 70]);
    const baseline = new Uint8ClampedArray(source.length);
    const lit = new Uint8ClampedArray(source.length);

    shadeCanvasAtmosphere(baseline, source, width, width);
    shadeCanvasAtmosphere(lit, source, width, width, { bytes: light, width, height: width });

    const leftOffset = (2 * width + 1) * 4;
    const coreOffset = (2 * width + 2) * 4;
    const rightOffset = (2 * width + 3) * 4;
    const leftGain = lit[leftOffset] - baseline[leftOffset];
    const coreGain = lit[coreOffset] - baseline[coreOffset];
    expect(leftGain).toBeGreaterThan(coreGain);
    expect(leftGain).toBeGreaterThan(lit[leftOffset + 2] - baseline[leftOffset + 2]);
    expect(luminance(lit, width, 1, 2)).toBeGreaterThan(luminance(baseline, width, 1, 2));
    expect(lit.slice(rightOffset, rightOffset + 4)).toEqual(baseline.slice(rightOffset, rightOffset + 4));
    for (let offset = 3; offset < source.length; offset += 4) expect(lit[offset]).toBe(source[offset]);
  });

  it('reaches one field texel toward an external light without widening gas support', () => {
    const width = 5;
    const source = new Uint8Array(width * width * 4);
    pixel(source, width, 1, 2, [90, 120, 160, 112]);
    pixel(source, width, 2, 2, [90, 120, 160, 220]);
    const light = new Uint8Array(source.length);
    pixel(light, width, 0, 2, [255, 112, 36, 255]);
    const baseline = new Uint8ClampedArray(source.length);
    const lit = new Uint8ClampedArray(source.length);

    shadeCanvasAtmosphere(baseline, source, width, width);
    shadeCanvasAtmosphere(lit, source, width, width, { bytes: light, width, height: width });

    const flankOffset = (2 * width + 1) * 4;
    expect(lit[flankOffset]).toBeGreaterThan(baseline[flankOffset]);
    expect(lit[flankOffset] - baseline[flankOffset])
      .toBeGreaterThan(lit[flankOffset + 2] - baseline[flankOffset + 2]);
    for (let offset = 3; offset < source.length; offset += 4) expect(lit[offset]).toBe(source[offset]);
  });

  it('is byte-identical to unlit relief when the emission field is dark', () => {
    const width = 3;
    const source = new Uint8Array(width * width * 4);
    pixel(source, width, 1, 1, [70, 130, 200, 180]);
    const baseline = new Uint8ClampedArray(source.length);
    const darkLit = new Uint8ClampedArray(source.length);
    shadeCanvasAtmosphere(baseline, source, width, width);
    shadeCanvasAtmosphere(darkLit, source, width, width, {
      bytes: new Uint8Array(2 * 2 * 4), width: 2, height: 2,
    });
    expect(darkLit).toEqual(baseline);
  });

  it('rejects invalid dimensions and mismatched buffers', () => {
    expect(() => shadeCanvasAtmosphere(new Uint8ClampedArray(4), new Uint8Array(4), 0, 1)).toThrow('Invalid');
    expect(() => shadeCanvasAtmosphere(new Uint8ClampedArray(8), new Uint8Array(4), 1, 1)).toThrow('size');
    expect(() => shadeCanvasAtmosphere(
      new Uint8ClampedArray(4), new Uint8Array(4), 1, 1,
      { bytes: new Uint8Array(4), width: 0, height: 1 },
    )).toThrow('light');
  });
});
