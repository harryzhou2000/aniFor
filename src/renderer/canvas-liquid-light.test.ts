import { describe, expect, it } from 'vitest';
import { canvasLiquidContourScale, canvasLiquidSurfaceExposure } from './canvas-liquid-light';

describe('Canvas liquid field-owned light', () => {
  it('suppresses cell contour noise only in a field-dense liquid body', () => {
    expect(canvasLiquidContourScale(0)).toBe(1);
    expect(canvasLiquidContourScale(160)).toBe(1);
    expect(canvasLiquidContourScale(200)).toBeCloseTo(0.59, 5);
    expect(canvasLiquidContourScale(240)).toBeCloseTo(0.18, 5);
    expect(canvasLiquidContourScale(255)).toBeCloseTo(0.18, 5);
  });

  it('keeps a true top surface bright and rejects a dense semantic pinhole', () => {
    const width = 3;
    const density = new Uint8Array(width * 3 * 4);
    const top = (0 * width + 1) * 4;
    density[top + 3] = 40;
    const original = density.slice();

    expect(canvasLiquidSurfaceExposure(density, width, 1, 1, true)).toBe(1);
    density[top + 3] = 136;
    expect(canvasLiquidSurfaceExposure(density, width, 1, 1, true)).toBeGreaterThan(0);
    expect(canvasLiquidSurfaceExposure(density, width, 1, 1, true)).toBeLessThan(1);
    density[top + 3] = 224;
    expect(canvasLiquidSurfaceExposure(density, width, 1, 1, true)).toBe(0);
    expect(canvasLiquidSurfaceExposure(density, width, 1, 1, false)).toBe(0);
    expect(canvasLiquidSurfaceExposure(original, width, 1, 0, true)).toBe(1);
    expect(original[top + 3]).toBe(40);
  });
});
