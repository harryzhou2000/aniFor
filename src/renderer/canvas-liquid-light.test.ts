import { describe, expect, it } from 'vitest';
import {
  applyCanvasLiquidBodyOptics, canvasLiquidContourScale, canvasLiquidEmissionExposure,
  canvasLiquidEmissionSurfaceExposure, canvasLiquidFieldRelief, canvasLiquidSpeciesRelief,
  canvasLiquidSurfaceExposure,
} from './canvas-liquid-light';
import { RenderOptics } from './render-optics';

describe('Canvas liquid field-owned light', () => {
  it('adds bounded deterministic family-specific body optics without changing hue ownership', () => {
    const families = [
      { optics: RenderOptics.Aqueous, base: [42, 166, 205], order: [2, 1, 0] },
      { optics: RenderOptics.Oily, base: [91, 67, 35], order: [0, 1, 2] },
      { optics: RenderOptics.Corrosive, base: [211, 94, 232], order: [2, 0, 1] },
      { optics: RenderOptics.Molten, base: [230, 100, 32], order: [0, 1, 2] },
    ] as const;
    const fingerprints = new Set<string>();
    for (const { optics, base, order } of families) {
      const color = new Float32Array(base);
      applyCanvasLiquidBodyOptics(color, optics, 255, 8, 0.08, 1);
      expect(Math.max(...color)).toBeLessThanOrEqual(254);
      expect(color[order[0]]).toBeGreaterThan(color[order[1]]);
      expect(color[order[1]]).toBeGreaterThan(color[order[2]]);
      const repeated = new Float32Array(base);
      applyCanvasLiquidBodyOptics(repeated, optics, 255, 8, 0.08, 1);
      expect(repeated).toEqual(color);
      fingerprints.add(Array.from(color, (channel) => channel.toFixed(3)).join(','));
    }
    expect(fingerprints.size).toBe(families.length);
  });

  it('leaves isolated or field-sparse droplets unchanged and restrains molten reflection', () => {
    for (const [fieldAlpha, neighbours] of [[255, 0], [160, 8], [220, 1]] as const) {
      const color = new Float32Array([80, 120, 160]);
      applyCanvasLiquidBodyOptics(
        color, RenderOptics.Aqueous, fieldAlpha, neighbours, 0.18, 1,
      );
      expect(Array.from(color)).toEqual([80, 120, 160]);
    }

    const water = new Float32Array([100, 130, 160]);
    const molten = new Float32Array(water);
    applyCanvasLiquidBodyOptics(water, RenderOptics.Aqueous, 255, 8, 0.12, 1);
    applyCanvasLiquidBodyOptics(molten, RenderOptics.Molten, 255, 8, 0.12, 1);
    const response = (color: Float32Array) => Array.from(color)
      .reduce((sum, channel, index) => sum + Math.abs(channel - [100, 130, 160][index]), 0);
    expect(response(molten)).toBeLessThan(response(water) * 0.5);
  });

  it('keeps macro variation gradual and preserves highlight headroom', () => {
    const first = new Float32Array([120, 150, 180]);
    const adjacent = new Float32Array(first);
    applyCanvasLiquidBodyOptics(first, RenderOptics.Aqueous, 255, 8, 0.04, 0.7);
    applyCanvasLiquidBodyOptics(adjacent, RenderOptics.Aqueous, 255, 8, 0.045, 0.7);
    expect(Math.max(
      Math.abs(first[0] - adjacent[0]),
      Math.abs(first[1] - adjacent[1]),
      Math.abs(first[2] - adjacent[2]),
    )).toBeLessThanOrEqual(3);

    const bright = new Float32Array([252, 253, 254]);
    applyCanvasLiquidBodyOptics(bright, RenderOptics.Aqueous, 255, 8, 0.18, 1);
    expect(Math.max(...bright)).toBeLessThanOrEqual(254);
    expect(bright[2] + 1).toBeGreaterThanOrEqual(bright[1]);
    expect(bright[1]).toBeGreaterThan(bright[0]);
  });

  it('shapes emission reflection only on exposed, light-facing liquid relief', () => {
    expect(canvasLiquidEmissionExposure(0, 0.18)).toBe(0);
    expect(canvasLiquidEmissionExposure(1, -0.16)).toBeCloseTo(0.46);
    expect(canvasLiquidEmissionExposure(1, 0)).toBeCloseTo(0.46);
    expect(canvasLiquidEmissionExposure(1, 0.12)).toBeGreaterThan(0.70);
    expect(canvasLiquidEmissionExposure(4, 2)).toBe(1);
  });

  it('finds side-facing liquid exposure but rejects a field-dense pinhole', () => {
    const width = 3;
    const height = 3;
    const edge = alphaField(width, height, 0);
    setAlpha(edge, width, 1, 1, 255);
    setAlpha(edge, width, 2, 1, 40);
    expect(canvasLiquidEmissionSurfaceExposure(
      edge, width, height, 1, 1, false, false, true, false,
    )).toBeCloseTo(0.82);

    setAlpha(edge, width, 2, 1, 224);
    expect(canvasLiquidEmissionSurfaceExposure(
      edge, width, height, 1, 1, false, false, true, false,
    )).toBe(0);
    expect(canvasLiquidEmissionSurfaceExposure(
      edge, width, height, 1, 1, false, false, false, false,
    )).toBe(0);
  });

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

  it('keeps a uniform connected field neutral and mirrors directional slopes', () => {
    const width = 3;
    const height = 3;
    const density = alphaField(width, height, 160);
    expect(canvasLiquidFieldRelief(density, width, height, 1, 1)).toBe(0);

    setAlpha(density, width, 0, 1, 100);
    setAlpha(density, width, 2, 1, 220);
    const lit = canvasLiquidFieldRelief(density, width, height, 1, 1);
    setAlpha(density, width, 0, 1, 220);
    setAlpha(density, width, 2, 1, 100);
    const shaded = canvasLiquidFieldRelief(density, width, height, 1, 1);
    expect(lit).toBeGreaterThan(0);
    expect(shaded).toBeLessThan(0);
    expect(lit).toBeCloseTo(-shaded, 6);
  });

  it('lights a convex crown, shades a pocket, and ignores an isolated droplet', () => {
    const width = 3;
    const height = 3;
    const crown = alphaField(width, height, 160);
    setAlpha(crown, width, 1, 1, 220);
    const pocket = alphaField(width, height, 180);
    setAlpha(pocket, width, 1, 1, 120);
    const droplet = alphaField(width, height, 0);
    setAlpha(droplet, width, 1, 1, 255);
    const original = crown.slice();

    expect(canvasLiquidFieldRelief(crown, width, height, 1, 1)).toBeGreaterThan(0);
    expect(canvasLiquidFieldRelief(pocket, width, height, 1, 1)).toBeLessThan(0);
    expect(canvasLiquidFieldRelief(droplet, width, height, 1, 1)).toBe(0);
    expect(crown).toEqual(original);
  });

  it('adds mirrored optical relief at a dense unlike-liquid interface', () => {
    const width = 3;
    const height = 3;
    const rightField = rgbaField(width, height, [42, 166, 205], 255);
    setColor(rightField, width, 2, 1, [91, 67, 35]);
    const rightOriginal = rightField.slice();
    const rightInterface = canvasLiquidSpeciesRelief(rightField, width, height, 1, 1);

    const leftField = rgbaField(width, height, [42, 166, 205], 255);
    setColor(leftField, width, 0, 1, [91, 67, 35]);
    const leftOriginal = leftField.slice();
    const leftInterface = canvasLiquidSpeciesRelief(leftField, width, height, 1, 1);

    expect(rightInterface).toBeGreaterThan(0);
    expect(leftInterface).toBeLessThan(0);
    expect(rightInterface).toBeCloseTo(-leftInterface, 6);
    expect(rightField).toEqual(rightOriginal);
    expect(leftField).toEqual(leftOriginal);
  });

  it('does not turn low-alpha colour changes into liquid interfaces', () => {
    const width = 3;
    const height = 3;
    const field = rgbaField(width, height, [42, 166, 205], 120);
    setColor(field, width, 2, 1, [91, 67, 35]);
    const original = field.slice();
    expect(canvasLiquidSpeciesRelief(field, width, height, 1, 1)).toBe(0);
    expect(field).toEqual(original);
  });
});

function alphaField(width: number, height: number, alpha: number): Uint8Array {
  const result = new Uint8Array(width * height * 4);
  for (let offset = 3; offset < result.length; offset += 4) result[offset] = alpha;
  return result;
}

function setAlpha(field: Uint8Array, width: number, x: number, y: number, alpha: number): void {
  field[(y * width + x) * 4 + 3] = alpha;
}

function rgbaField(
  width: number,
  height: number,
  color: readonly [number, number, number],
  alpha: number,
): Uint8Array {
  const result = new Uint8Array(width * height * 4);
  for (let offset = 0; offset < result.length; offset += 4) {
    result[offset] = color[0];
    result[offset + 1] = color[1];
    result[offset + 2] = color[2];
    result[offset + 3] = alpha;
  }
  return result;
}

function setColor(
  field: Uint8Array,
  width: number,
  x: number,
  y: number,
  color: readonly [number, number, number],
): void {
  const offset = (y * width + x) * 4;
  field[offset] = color[0];
  field[offset + 1] = color[1];
  field[offset + 2] = color[2];
}
