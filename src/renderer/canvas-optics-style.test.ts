import { describe, expect, it } from 'vitest';
import { shadeCanvasOpticalVolume } from './canvas-optics-style';
import { RenderOptics, RENDER_OPTICS_CLASS_COUNT } from './render-optics';

describe('Canvas optical volume styling', () => {
  it('differentiates clear and absorbing gases without touching alpha', () => {
    const clean = new Float32Array([0, 0, 0, 91]);
    const soot = new Float32Array([0, 0, 0, 91]);
    shadeCanvasOpticalVolume(clean, 120, 135, 150, RenderOptics.CleanGas, 'gas', 5, 4);
    shadeCanvasOpticalVolume(soot, 120, 135, 150, RenderOptics.SootyGas, 'gas', 5, 4);
    expect(clean[0]).toBeGreaterThan(soot[0]);
    expect(clean[2]).toBeGreaterThan(clean[0]);
    expect(clean[3]).toBe(91);
    expect(soot[3]).toBe(91);
  });

  it('gives all authored liquid optics families distinct RGB responses', () => {
    const signatures = [
      RenderOptics.Aqueous, RenderOptics.Oily, RenderOptics.Corrosive, RenderOptics.Molten,
      RenderOptics.CryogenicLiquid, RenderOptics.MetallicLiquid, RenderOptics.ViscousLiquid,
    ].map((optics) => {
      const output = new Float32Array(3);
      shadeCanvasOpticalVolume(output, 120, 135, 150, optics, 'liquid', 5, 4);
      return Array.from(output).map(Math.round).join(',');
    });
    expect(new Set(signatures).size).toBe(7);
  });

  it('keeps every optics class finite without allocating a result object', () => {
    const output = new Float32Array(4);
    output[3] = 73;
    for (let optics = 0; optics < RENDER_OPTICS_CLASS_COUNT; optics++) {
      shadeCanvasOpticalVolume(output, 90, 120, 160, optics, 'liquid', 4, -2);
      expect(Array.from(output.slice(0, 3)).every(Number.isFinite)).toBe(true);
      expect(output[3]).toBe(73);
    }
  });
});
