import { describe, expect, it } from 'vitest';
import { applyCanvasPowderBulkStyle, canvasPowderBulkDepth } from './canvas-powder-bulk-style';
import { RenderOptics } from './render-optics';

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
    // Disable only the volume cue to isolate established canonical-albedo
    // convergence from the mineral body response.
    applyCanvasPowderBulkStyle(color, ...canonical, 255, 212, 128, 128, 255, 1, false);

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

  it('adds a bounded upper-left mineral key and opposing fill', () => {
    const canonical = [180, 140, 90] as const;
    const lit = new Float32Array(canonical);
    const shaded = new Float32Array(canonical);
    applyCanvasPowderBulkStyle(lit, ...canonical, 255, 212, 0, 0, 255, 1);
    applyCanvasPowderBulkStyle(shaded, ...canonical, 255, 212, 255, 255, 255, 1);

    expect(lit[0]).toBeGreaterThan(canonical[0]);
    expect(shaded[0]).toBeLessThan(canonical[0]);
    expect(lit[0] / canonical[0]).not.toBeCloseTo(lit[1] / canonical[1], 4);
    expect(shaded[0] / canonical[0]).not.toBeCloseTo(shaded[1] / canonical[1], 4);
    expect(lit[0]).toBeGreaterThan(lit[1]);
    expect(lit[1]).toBeGreaterThan(lit[2]);
    expect(shaded[0]).toBeGreaterThan(shaded[1]);
    expect(shaded[1]).toBeGreaterThan(shaded[2]);
  });

  it('separates crystalline, sooty, metallic, and mineral bulk optics', () => {
    const canonical = [140, 140, 140] as const;
    const render = (optics: RenderOptics): Float32Array => {
      const color = new Float32Array(canonical);
      applyCanvasPowderBulkStyle(
        color, ...canonical, 255, 169, 0, 0, 160, 1, true, optics,
      );
      return color;
    };
    const mineral = render(RenderOptics.RoughGranular);
    const crystal = render(RenderOptics.CrystallineGranular);
    const soot = render(RenderOptics.SootyGranular);
    const metal = render(RenderOptics.MetallicGranular);

    expect(crystal[2] - crystal[0]).toBeGreaterThan(1);
    expect(metal[0] - metal[2]).toBeGreaterThan(2);
    expect(luma(soot) - luma(canonical)).toBeLessThan(luma(crystal) - luma(canonical));
    expect(new Set([mineral, crystal, soot, metal].map((color) => Array.from(color).join(','))).size)
      .toBe(4);
  });

  it('separates a flat supported shoulder from its dense core without a slope', () => {
    const canonical = [180, 140, 90] as const;
    const shoulder = new Float32Array(canonical);
    const core = new Float32Array(canonical);
    applyCanvasPowderBulkStyle(shoulder, ...canonical, 255, 169, 128, 128, 160, 1);
    applyCanvasPowderBulkStyle(core, ...canonical, 255, 255, 128, 128, 255, 1);

    expect(shoulder[0]).toBeGreaterThan(canonical[0]);
    expect(shoulder[1]).toBeGreaterThan(canonical[1]);
    expect(shoulder[2]).toBeGreaterThan(canonical[2]);
    expect(core[0]).toBeLessThan(canonical[0]);
    expect(core[1]).toBeLessThan(canonical[1]);
    expect(core[2]).toBeLessThan(canonical[2]);
    expect(shoulder[0] - canonical[0]).not.toBeCloseTo(
      shoulder[1] - canonical[1],
      4,
    );
  });

  it('can disable only body chroma while retaining canonical blend and scalar relief', () => {
    const canonical = [180, 140, 90] as const;
    const disabled = new Float32Array(canonical);
    const scalarOnly = new Float32Array(canonical);
    const enabled = new Float32Array(canonical);
    applyCanvasPowderBulkStyle(
      disabled, ...canonical, 255, 255, 0, 0, 255, 1, false,
    );
    applyLegacyScalarRelief(scalarOnly, 255, 0, 0);
    applyCanvasPowderBulkStyle(
      enabled, ...canonical, 255, 255, 0, 0, 255, 1, true,
    );

    expect(Array.from(disabled)).toEqual(Array.from(scalarOnly));
    expect(Array.from(enabled)).not.toEqual(Array.from(disabled));
  });

  it('keeps the stronger mineral volume within twenty-four output bytes', () => {
    const canonical = [180, 140, 90] as const;
    for (const density of [169, 212, 255]) for (const [gradientX, gradientY] of [
      [0, 0], [128, 128], [255, 255],
    ] as const) {
      const actual = new Float32Array(canonical);
      const scalarOnly = new Float32Array(canonical);
      applyCanvasPowderBulkStyle(
        actual, ...canonical, 255, density, gradientX, gradientY, 255, 1,
      );
      applyLegacyScalarRelief(scalarOnly, density, gradientX, gradientY);
      expect(Math.max(
        Math.abs(actual[0] - scalarOnly[0]),
        Math.abs(actual[1] - scalarOnly[1]),
        Math.abs(actual[2] - scalarOnly[2]),
      )).toBeLessThanOrEqual(24);
    }
  });

  it('keeps bright relief below the output peak without changing channel order', () => {
    const color = new Float32Array([254, 250, 245]);
    applyCanvasPowderBulkStyle(color, 254, 250, 245, 255, 255, 0, 0, 255, 1);

    expect(Math.max(...color)).toBeLessThanOrEqual(254);
    expect(color[0]).toBeGreaterThan(color[1]);
    expect(color[1]).toBeGreaterThan(color[2]);
    expect(Math.abs(color[0] / color[1] - 254 / 250)).toBeLessThan(0.002);
    expect(Math.abs(color[1] / color[2] - 250 / 245)).toBeLessThan(0.002);
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

function applyLegacyScalarRelief(
  color: Float32Array,
  _density: number,
  gradientX: number,
  gradientY: number,
): void {
  const directedSlope = Math.max(-1, Math.min(1,
    (gradientX - 128) / 508 * (-0.55 * 4)
      + (gradientY - 128) / 508 * (-0.80 * 4),
  ));
  const relief = directedSlope < 0 ? directedSlope * 0.07 : directedSlope * 0.08;
  const scale = 1 + relief;
  color[0] *= scale;
  color[1] *= scale;
  color[2] *= scale;
  const peak = Math.max(color[0], color[1], color[2]);
  if (peak <= 254) return;
  const headroomScale = 254 / peak;
  color[0] *= headroomScale;
  color[1] *= headroomScale;
  color[2] *= headroomScale;
}

function luma(color: ArrayLike<number>): number {
  return color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722;
}
