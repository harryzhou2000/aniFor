import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import {
  applyCanvasSolidBodyOptics, applyCanvasSolidLighting, applyCanvasTranslucentCaustic,
  applyCanvasTranslucentLensShell,
  canvasSolidInteriorCohesion, canvasSolidRelief,
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

  it('adds bounded deterministic family-aware body depth without granular over-styling', () => {
    const families = [
      [RenderProfile.Rigid, RenderOptics.SmoothRigid],
      [RenderProfile.Organic, RenderOptics.Organic],
      [RenderProfile.Device, RenderOptics.Device],
      [RenderProfile.Radioactive, RenderOptics.Radioactive],
      [RenderProfile.Rigid, RenderOptics.TranslucentRigid],
    ] as const;
    const fingerprints = new Set<string>();
    for (const [profile, optics] of families) {
      const color = new Float32Array([168, 132, 96]);
      applyCanvasSolidBodyOptics(color, 4, 0, 4, true, profile, optics);
      expect(Math.max(...color)).toBeLessThanOrEqual(254);
      expect(Math.max(
        Math.abs(color[0] - 172), Math.abs(color[1] - 136), Math.abs(color[2] - 100),
      )).toBeLessThanOrEqual(24);
      const repeated = new Float32Array([168, 132, 96]);
      applyCanvasSolidBodyOptics(repeated, 4, 0, 4, true, profile, optics);
      expect(repeated).toEqual(color);
      fingerprints.add(Array.from(color, (channel) => channel.toFixed(3)).join(','));
    }
    expect(fingerprints.size).toBe(families.length);

    const rough = new Float32Array([168, 132, 96]);
    applyCanvasSolidBodyOptics(
      rough, 4, 0, 0, true, RenderProfile.Granular, RenderOptics.RoughGranular,
    );
    expect(Math.max(
      Math.abs(rough[0] - 172), Math.abs(rough[1] - 136), Math.abs(rough[2] - 100),
    )).toBeLessThan(5);
  });

  it('adds family-coloured thickness only beyond the protected first interior layer', () => {
    const base = [168, 132, 96] as const;
    const surface = new Float32Array(base);
    const firstLayer = new Float32Array(base);
    const deepMetal = new Float32Array(base);
    const deepOrganic = new Float32Array(base);
    applyCanvasSolidBodyOptics(
      surface, 0, 0, 0, true, RenderProfile.Rigid, RenderOptics.SmoothRigid, 0,
    );
    applyCanvasSolidBodyOptics(
      firstLayer, 0, 0, 0, true, RenderProfile.Rigid, RenderOptics.SmoothRigid, 6,
    );
    applyCanvasSolidBodyOptics(
      deepMetal, 0, 0, 0, true, RenderProfile.Rigid, RenderOptics.SmoothRigid, 255,
    );
    applyCanvasSolidBodyOptics(
      deepOrganic, 0, 0, 0, true, RenderProfile.Organic, RenderOptics.Organic, 255,
    );

    expect(firstLayer).toEqual(surface);
    expect(deepMetal[0]).toBeLessThan(surface[0]);
    expect(deepMetal[1]).toBeLessThan(surface[1]);
    expect(deepMetal[2]).toBeLessThan(surface[2]);
    expect(deepMetal[0] / surface[0]).toBeLessThan(deepMetal[2] / surface[2]);
    expect(deepOrganic[1] / surface[1]).toBeGreaterThan(deepOrganic[0] / surface[0]);
    expect(Array.from(deepOrganic)).not.toEqual(Array.from(deepMetal));

    const disabled = new Float32Array(base);
    applyCanvasSolidBodyOptics(
      disabled, 0, 0, 0, true, RenderProfile.Rigid, RenderOptics.SmoothRigid, 255, false,
    );
    expect(disabled).toEqual(surface);
  });

  it('changes body response gradually with relief and keeps exposed rims restrained', () => {
    const low = new Float32Array([120, 150, 180]);
    const adjacent = new Float32Array(low);
    applyCanvasSolidBodyOptics(
      low, 1, 0, 2, true, RenderProfile.Device, RenderOptics.Device,
    );
    applyCanvasSolidBodyOptics(
      adjacent, 1.5, 0, 2.5, true, RenderProfile.Device, RenderOptics.Device,
    );
    expect(Math.max(
      Math.abs(low[0] - adjacent[0]),
      Math.abs(low[1] - adjacent[1]),
      Math.abs(low[2] - adjacent[2]),
    )).toBeLessThanOrEqual(3);

    const edge = new Float32Array([120, 150, 180]);
    applyCanvasSolidBodyOptics(
      edge, 18, 18, 0, false, RenderProfile.Device, RenderOptics.Device,
    );
    expect(edge[2] - edge[0]).toBeGreaterThan(60);
    expect(Math.max(...edge)).toBeLessThanOrEqual(254);
  });

  it('replaces neutral deep-body relief with bounded family-coloured crowns and pockets', () => {
    const body = (relief: number, enabled = true, depth = 255) => {
      const color = new Float32Array([120, 150, 180]);
      applyCanvasSolidBodyOptics(
        color, relief, 0, relief, true,
        RenderProfile.Rigid, RenderOptics.SmoothRigid, depth, enabled,
      );
      return color;
    };
    const neutral = body(0);
    const crown = body(7);
    const pocket = body(-7);
    const disabled = body(7, false);
    const firstLayer = body(7, true, 6);
    const firstLayerDisabled = body(7, false, 6);

    expect(crown[2] - neutral[2]).toBeGreaterThan(crown[0] - neutral[0]);
    expect(pocket[0] / neutral[0]).toBeLessThan(pocket[2] / neutral[2]);
    expect(Math.max(...Array.from(crown, (channel, index) => Math.abs(channel - neutral[index]))))
      .toBeLessThanOrEqual(10);
    expect(Math.max(...Array.from(pocket, (channel, index) => Math.abs(channel - neutral[index]))))
      .toBeLessThanOrEqual(10);
    expect(crown).not.toEqual(disabled);
    expect(Math.max(...Array.from(crown, (channel, index) => Math.abs(channel - disabled[index]))))
      .toBeLessThanOrEqual(10);
    expect(firstLayer).toEqual(firstLayerDisabled);
  });

  it('gives a thick rigid body a visible but bounded macro depth range at normal fit', () => {
    const shade = (relief: number) => {
      const color = new Float32Array([110, 120, 132]);
      applyCanvasSolidBodyOptics(
        color, relief, 0, relief, true,
        RenderProfile.Rigid, RenderOptics.SmoothRigid, 255,
      );
      return color;
    };
    const crown = shade(7);
    const pocket = shade(-7);
    const luma = (color: Float32Array) => color[0] * 0.2126
      + color[1] * 0.7152 + color[2] * 0.0722;

    expect(luma(crown) - luma(pocket)).toBeGreaterThan(11);
    expect(Math.max(...crown)).toBeLessThanOrEqual(254);
    expect(Math.max(...pocket)).toBeLessThanOrEqual(254);
  });

  it('gives Glass and Ice bounded opposing low-bias spectral bands only', () => {
    const glass = new Float32Array([120, 150, 180]);
    const ice = new Float32Array(glass);
    const metal = new Float32Array(glass);
    applyCanvasTranslucentCaustic(glass, 6, Material.Glass);
    applyCanvasTranslucentCaustic(ice, 6, Material.Ice);
    applyCanvasTranslucentCaustic(metal, 6, Material.Metal);

    expect(glass[0]).toBeGreaterThan(120);
    expect(glass[2]).toBeLessThan(180);
    expect(ice[0]).toBeLessThan(120);
    expect(ice[2]).toBeGreaterThan(180);
    expect(Array.from(metal)).toEqual([120, 150, 180]);
    const luma = (color: Float32Array) => color[0] * 0.2126
      + color[1] * 0.7152 + color[2] * 0.0722;
    expect(Math.abs(luma(glass) - luma(metal))).toBeLessThan(0.01);
    expect(Math.abs(luma(ice) - luma(metal))).toBeLessThan(0.01);
    expect(Math.max(
      Math.abs(glass[0] - 120), Math.abs(glass[1] - 150), Math.abs(glass[2] - 180),
    )).toBeLessThan(8);
  });

  it('adds a bounded exact-material lens shell while opaque Metal remains unchanged', () => {
    const glass = new Float32Array([120, 150, 180]);
    const ice = new Float32Array(glass);
    const metal = new Float32Array(glass);
    applyCanvasTranslucentLensShell(glass, 6, 18, Material.Glass);
    applyCanvasTranslucentLensShell(ice, -6, 18, Material.Ice);
    applyCanvasTranslucentLensShell(metal, 6, 18, Material.Metal);

    expect(glass[2] - 180).toBeGreaterThan(glass[0] - 120);
    expect(ice[2] - 180).toBeGreaterThan(ice[0] - 120);
    expect(glass[2]).toBeGreaterThan(ice[2]);
    expect(Array.from(metal)).toEqual([120, 150, 180]);
    expect(Math.max(
      Math.abs(glass[0] - 120), Math.abs(glass[1] - 150), Math.abs(glass[2] - 180),
      Math.abs(ice[0] - 120), Math.abs(ice[1] - 150), Math.abs(ice[2] - 180),
    )).toBeLessThan(18);
  });
});
