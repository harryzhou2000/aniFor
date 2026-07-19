import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import {
  applyCanvasSolidLighting, canvasSolidInteriorCohesion, canvasSolidRelief,
} from './canvas-solid-relief';
import { RenderOptics } from './render-optics';
import { RenderProfile } from './render-profile';

describe('Canvas solid relief', () => {
  it('is deterministic, bounded, and varies gradually across a material chunk', () => {
    const first = canvasSolidRelief(12, 9, Material.Metal, RenderProfile.Rigid, RenderOptics.SmoothRigid);
    const adjacent = canvasSolidRelief(13, 9, Material.Metal, RenderProfile.Rigid, RenderOptics.SmoothRigid);
    const distant = canvasSolidRelief(36, 25, Material.Metal, RenderProfile.Rigid, RenderOptics.SmoothRigid);
    expect(canvasSolidRelief(12, 9, Material.Metal, RenderProfile.Rigid, RenderOptics.SmoothRigid)).toBe(first);
    expect(Math.abs(first)).toBeLessThanOrEqual(7);
    expect(Math.abs(adjacent - first)).toBeLessThan(1.5);
    expect(distant).not.toBe(first);
  });

  it('uses distinct family-directed macro waves and no dense powder relief', () => {
    const fingerprints = new Set<string>();
    for (const [profile, optics] of [
      [RenderProfile.Rigid, RenderOptics.SmoothRigid],
      [RenderProfile.Organic, RenderOptics.Organic],
      [RenderProfile.Device, RenderOptics.Device],
      [RenderProfile.Radioactive, RenderOptics.Radioactive],
      [RenderProfile.Rigid, RenderOptics.TranslucentRigid],
    ] as const) {
      fingerprints.add(Array.from({ length: 8 }, (_, offset) => (
        canvasSolidRelief(12 + offset, 9 + offset * 2, Material.Metal, profile, optics).toFixed(4)
      )).join(','));
    }
    expect(fingerprints.size).toBe(5);
    expect(canvasSolidRelief(
      12, 9, Material.Sand, RenderProfile.Granular, RenderOptics.RoughGranular,
    )).toBe(0);
  });

  it('makes dense Canvas cohesion family-aware without smoothing granular matter', () => {
    expect(canvasSolidInteriorCohesion(RenderProfile.Granular, RenderOptics.RoughGranular)).toBe(0);
    expect(canvasSolidInteriorCohesion(RenderProfile.Rigid, RenderOptics.SmoothRigid))
      .toBeGreaterThan(canvasSolidInteriorCohesion(RenderProfile.Organic, RenderOptics.Organic));
    expect(canvasSolidInteriorCohesion(RenderProfile.Device, RenderOptics.Device))
      .toBeGreaterThan(canvasSolidInteriorCohesion(RenderProfile.Radioactive, RenderOptics.Radioactive));
    expect(canvasSolidInteriorCohesion(RenderProfile.Rigid, RenderOptics.TranslucentRigid))
      .toBeGreaterThan(canvasSolidInteriorCohesion(RenderProfile.Rigid, RenderOptics.SmoothRigid));
  });

  it('compresses over-range solid highlights uniformly instead of clipping a channel', () => {
    const color = new Float32Array([253, 157, 24]);
    const litRatio = (253 + 9) / (157 + 9);
    applyCanvasSolidLighting(color, 9);
    expect(Math.max(...color)).toBeCloseTo(254, 4);
    expect(color[0] / color[1]).toBeCloseTo(litRatio, 5);

    const inRange = new Float32Array([80, 100, 120]);
    applyCanvasSolidLighting(inRange, -5);
    expect(Array.from(inRange)).toEqual([75, 95, 115]);
  });
});
