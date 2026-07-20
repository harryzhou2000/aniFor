import { describe, expect, it } from 'vitest';
import { RenderOptics } from './render-optics';
import { applyCanvasSurfaceChroma, canvasSurfaceChromaResponse } from './solid-surface-chroma';

describe('solid surface chroma', () => {
  it('is signed, deterministic, and exact outside a real contour', () => {
    const facing = canvasSurfaceChromaResponse(0.5, 0.4, 0.5, RenderOptics.SmoothRigid);
    const away = canvasSurfaceChromaResponse(0.5, -0.4, -0.5, RenderOptics.SmoothRigid);
    expect(facing).toBeGreaterThan(0);
    expect(away).toBeLessThan(0);
    expect(facing).toBeCloseTo(-away, 8);
    expect(canvasSurfaceChromaResponse(0.5, 0.4, 0.5, RenderOptics.SmoothRigid)).toBe(facing);
    expect(canvasSurfaceChromaResponse(0, 0.4, 0.5, RenderOptics.SmoothRigid)).toBe(0);
    expect(canvasSurfaceChromaResponse(1, 0.4, 0.5, RenderOptics.SmoothRigid)).toBe(0);
    expect(canvasSurfaceChromaResponse(0.5, 0, 0, RenderOptics.SmoothRigid)).toBe(0);
  });

  it('uses bounded family-coloured key and fill without touching alpha', () => {
    const baseline = new Uint8ClampedArray([92, 112, 132, 173]);
    const device = baseline.slice();
    const rough = baseline.slice();
    applyCanvasSurfaceChroma(device, 0, 0.065, RenderOptics.Device);
    applyCanvasSurfaceChroma(rough, 0, 0.065, RenderOptics.RoughGranular);

    expect(device[2] - baseline[2]).toBeGreaterThan(device[0] - baseline[0]);
    expect(rough[0] - baseline[0]).toBeGreaterThan(rough[2] - baseline[2]);
    expect(device).not.toEqual(rough);
    expect(device[3]).toBe(173);
    expect(rough[3]).toBe(173);
    expect(Math.max(
      ...Array.from(device.slice(0, 3), (value, channel) => Math.abs(value - baseline[channel])),
      ...Array.from(rough.slice(0, 3), (value, channel) => Math.abs(value - baseline[channel])),
    )).toBeLessThanOrEqual(18);

    const shadow = baseline.slice();
    applyCanvasSurfaceChroma(shadow, 0, -0.065, RenderOptics.Organic);
    expect(shadow[0]).toBeLessThan(baseline[0]);
    expect(shadow[1]).toBeLessThan(baseline[1]);
    expect(shadow[2]).toBeLessThan(baseline[2]);
    expect(shadow[3]).toBe(173);
  });

  it('is an exact no-op at zero response', () => {
    const target = new Uint8ClampedArray([17, 91, 203, 229]);
    const original = target.slice();
    applyCanvasSurfaceChroma(target, 0, 0, RenderOptics.Radioactive);
    expect(target).toEqual(original);
  });
});
