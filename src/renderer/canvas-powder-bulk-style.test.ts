import { describe, expect, it } from 'vitest';
import { applyCanvasPowderBulkStyle, canvasPowderBulkDepth } from './canvas-powder-bulk-style';

describe('Canvas powder bulk style', () => {
  it('accepts only two-cell-deep material with a same-row lateral support', () => {
    const width = 5;
    const height = 5;
    const material = 7;
    const materials = new Uint8Array(width * height);
    setMaterial(materials, width, 2, 1, material);
    setMaterial(materials, width, 2, 2, material);
    setMaterial(materials, width, 2, 3, material);
    setMaterial(materials, width, 1, 1, material);
    const original = materials.slice();

    expect(canvasPowderBulkDepth(materials, width, height, 2, 1, material)).toBe(1);
    setMaterial(materials, width, 1, 1, 0);
    expect(canvasPowderBulkDepth(materials, width, height, 2, 1, material)).toBe(0);
    setMaterial(materials, width, 3, 1, material);
    expect(canvasPowderBulkDepth(materials, width, height, 2, 1, material)).toBe(1);
    setMaterial(materials, width, 2, 3, material + 1);
    expect(canvasPowderBulkDepth(materials, width, height, 2, 1, material)).toBe(0);

    expect(original[1 * width + 2]).toBe(material);
    expect(original[2 * width + 2]).toBe(material);
    expect(original[3 * width + 2]).toBe(material);
  });

  it('rejects edges, out-of-range rows, empty material, and thin structures', () => {
    const width = 5;
    const height = 5;
    const material = 3;
    const materials = new Uint8Array(width * height).fill(material);

    expect(canvasPowderBulkDepth(materials, width, height, 0, 1, material)).toBe(0);
    expect(canvasPowderBulkDepth(materials, width, height, width - 1, 1, material)).toBe(0);
    expect(canvasPowderBulkDepth(materials, width, height, 2, -1, material)).toBe(0);
    expect(canvasPowderBulkDepth(materials, width, height, 2, height - 2, material)).toBe(0);
    expect(canvasPowderBulkDepth(materials, width, height, 2, 1, 0)).toBe(0);

    materials.fill(0);
    setMaterial(materials, width, 2, 1, material);
    setMaterial(materials, width, 2, 2, material);
    setMaterial(materials, width, 2, 3, material);
    expect(canvasPowderBulkDepth(materials, width, height, 2, 1, material)).toBe(0);
    setMaterial(materials, width, 1, 1, material);
    setMaterial(materials, width, 2, 3, 0);
    expect(canvasPowderBulkDepth(materials, width, height, 2, 1, material)).toBe(0);
  });

  it('is an exact no-op until every bulk confidence gate is active', () => {
    const base = [178, 120, 72] as const;
    const cases = [
      [255, 255, 128, 128, 255, 0],
      [191, 255, 128, 128, 255, 1],
      [255, 140, 128, 128, 255, 1],
      [255, 255, 128, 128, 113, 1],
    ] as const;
    for (const [stability, density, gradientX, gradientY, support, bulk] of cases) {
      const color = new Float32Array(base);
      applyCanvasPowderBulkStyle(
        color, 215, 170, 104, stability, density, gradientX, gradientY, support, bulk,
      );
      expect(Array.from(color)).toEqual(base);
    }
  });

  it('suppresses per-cell deviation while retaining canonical hue ownership', () => {
    const canonical = [215, 170, 104] as const;
    const original = [173, 136, 83] as const;
    const color = new Float32Array(original);
    applyCanvasPowderBulkStyle(color, ...canonical, 255, 255, 128, 128, 255, 1);

    for (let channel = 0; channel < 3; channel++) {
      expect(Math.abs(color[channel] - canonical[channel])).toBeLessThan(
        Math.abs(original[channel] - canonical[channel]) * 0.4,
      );
      expect(color[channel]).toBeCloseTo(
        original[channel] + (canonical[channel] - original[channel]) * 0.62,
        4,
      );
    }
    expect(color[0]).toBeGreaterThan(color[1]);
    expect(color[1]).toBeGreaterThan(color[2]);
  });

  it('adds nonzero mirrored directional relief with one hue-preserving scale', () => {
    const canonical = [180, 140, 90] as const;
    const lit = new Float32Array(canonical);
    const shaded = new Float32Array(canonical);
    applyCanvasPowderBulkStyle(lit, ...canonical, 255, 255, 0, 0, 255, 1);
    applyCanvasPowderBulkStyle(shaded, ...canonical, 255, 255, 255, 255, 255, 1);

    expect(lit[0]).toBeGreaterThan(canonical[0]);
    expect(shaded[0]).toBeLessThan(canonical[0]);
    expect(lit[0] / canonical[0]).toBeCloseTo(lit[1] / canonical[1], 6);
    expect(lit[1] / canonical[1]).toBeCloseTo(lit[2] / canonical[2], 6);
    expect(shaded[0] / canonical[0]).toBeCloseTo(shaded[1] / canonical[1], 6);
    expect(shaded[1] / canonical[1]).toBeCloseTo(shaded[2] / canonical[2], 6);
    expect(lit[0] / canonical[0]).toBeLessThanOrEqual(1.080001);
    expect(shaded[0] / canonical[0]).toBeGreaterThanOrEqual(0.929999);
  });

  it('keeps bright relief below the output peak without changing channel order', () => {
    const color = new Float32Array([254, 250, 245]);
    applyCanvasPowderBulkStyle(color, 254, 250, 245, 255, 255, 0, 0, 255, 1);

    expect(Math.max(...color)).toBeLessThanOrEqual(254);
    expect(color[0]).toBeGreaterThan(color[1]);
    expect(color[1]).toBeGreaterThan(color[2]);
    expect(color[0] / color[1]).toBeCloseTo(254 / 250, 5);
    expect(color[1] / color[2]).toBeCloseTo(250 / 245, 5);
  });
});

function setMaterial(
  materials: Uint8Array,
  width: number,
  x: number,
  y: number,
  material: number,
): void {
  materials[y * width + x] = material;
}
