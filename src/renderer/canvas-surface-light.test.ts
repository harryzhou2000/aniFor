import { describe, expect, it } from 'vitest';
import {
  CANVAS_SOLID_FIELD_DIRECTION_GAIN,
  CANVAS_SOLID_FIELD_DIRECTION_LIMIT,
  CANVAS_TRANSLUCENT_FIELD_EXPOSURE, CANVAS_TRANSLUCENT_FIELD_GAIN,
  canvasSolidBodyFieldExposure, canvasSolidFieldLightingGain,
  canvasTranslucentFieldExposure, lightCanvasSurface,
  sampleCanvasFieldAlpha,
} from './canvas-surface-light';
import { RenderPhase, RenderProfile, surfaceLightGain } from './render-profile';
import { RenderOptics } from './render-optics';
import { RenderTrait } from './render-traits';

function field(): Uint8Array {
  return new Uint8Array([
    255, 64, 16, 255, 0, 0, 0, 0,
    32, 128, 255, 128, 0, 0, 0, 0,
  ]);
}

describe('Canvas surface lighting', () => {
  it('preserves output exactly without exposure or emitted light', () => {
    const dark = new Uint8Array(16);
    const target = new Uint8ClampedArray([80, 100, 120, 213]);
    const original = target.slice();
    lightCanvasSurface(target, 0, dark, 2, 2, 4, 4, 1, 1, RenderProfile.Rigid, 1);
    expect(target).toEqual(original);
    lightCanvasSurface(target, 0, field(), 2, 2, 4, 4, 1, 1, RenderProfile.Rigid, 0);
    expect(target).toEqual(original);
  });

  it('tints exposed RGB while preserving alpha and channel identity', () => {
    const target = new Uint8ClampedArray([70, 90, 110, 173]);
    lightCanvasSurface(target, 0, field(), 2, 2, 4, 4, 0, 0, RenderProfile.Rigid, 1);
    expect(target[0] - 70).toBeGreaterThan(target[1] - 90);
    expect(target[1] - 90).toBeGreaterThan(target[2] - 110);
    expect(target[3]).toBe(173);
  });

  it('supports a bounded liquid-reflection gain without changing alpha', () => {
    const regular = new Uint8ClampedArray([70, 90, 110, 173]);
    const reflected = regular.slice();
    lightCanvasSurface(regular, 0, field(), 2, 2, 4, 4, 0, 0, RenderProfile.Neutral, 1);
    lightCanvasSurface(reflected, 0, field(), 2, 2, 4, 4, 0, 0, RenderProfile.Neutral, 1, 3);
    expect(reflected[0]).toBeGreaterThan(regular[0]);
    expect(reflected[1]).toBeGreaterThan(regular[1]);
    expect(reflected[2]).toBeGreaterThanOrEqual(regular[2]);
    expect(reflected[3]).toBe(173);
  });

  it('adds source-facing solid contour light from the four existing field taps', () => {
    const emission = new Uint8Array([
      255, 48, 12, 24, 255, 48, 12, 224,
      255, 48, 12, 24, 255, 48, 12, 224,
    ]);
    const baseline = new Uint8ClampedArray([58, 78, 98, 231]);
    const facing = baseline.slice();
    const away = baseline.slice();
    lightCanvasSurface(
      baseline, 0, emission, 2, 2, 4, 4, 1, 1, RenderProfile.Rigid, 1,
    );
    lightCanvasSurface(
      facing, 0, emission, 2, 2, 4, 4, 1, 1, RenderProfile.Rigid, 1, 1,
      1, 0, CANVAS_SOLID_FIELD_DIRECTION_GAIN,
    );
    lightCanvasSurface(
      away, 0, emission, 2, 2, 4, 4, 1, 1, RenderProfile.Rigid, 1, 1,
      -1, 0, CANVAS_SOLID_FIELD_DIRECTION_GAIN,
    );
    expect(facing[0]).toBeGreaterThan(baseline[0]);
    expect(facing[0] - baseline[0]).toBeGreaterThan(facing[1] - baseline[1]);
    expect(Math.max(
      facing[0] - baseline[0], facing[1] - baseline[1], facing[2] - baseline[2],
    )).toBeLessThanOrEqual(Math.ceil(255 * CANVAS_SOLID_FIELD_DIRECTION_LIMIT));
    expect(away).toEqual(baseline);
    expect(facing[3]).toBe(231);
  });

  it('keeps directional response exact for a flat field or disabled solid class', () => {
    const uniform = new Uint8Array([
      220, 90, 30, 160, 220, 90, 30, 160,
      220, 90, 30, 160, 220, 90, 30, 160,
    ]);
    const baseline = new Uint8ClampedArray([68, 88, 108, 205]);
    const directed = baseline.slice();
    lightCanvasSurface(
      baseline, 0, uniform, 2, 2, 4, 4, 1, 1, RenderProfile.Rigid, 1,
    );
    lightCanvasSurface(
      directed, 0, uniform, 2, 2, 4, 4, 1, 1, RenderProfile.Rigid, 1, 1,
      1, 0, CANVAS_SOLID_FIELD_DIRECTION_GAIN,
    );
    expect(directed).toEqual(baseline);

    expect(canvasSolidFieldLightingGain(
      RenderPhase.Solid, RenderOptics.SmoothRigid, 0, false, false, false, true,
    )).toBe(CANVAS_SOLID_FIELD_DIRECTION_GAIN);
    expect(canvasSolidFieldLightingGain(
      RenderPhase.Solid, RenderOptics.SmoothRigid, 0, false, false, false, false,
    )).toBe(0);
    expect(canvasSolidFieldLightingGain(
      RenderPhase.Solid, RenderOptics.SmoothRigid, 0, false, true, false, true,
    )).toBe(0);
    expect(canvasSolidFieldLightingGain(
      RenderPhase.Solid, RenderOptics.TranslucentRigid, 0, false, false, false, true,
    )).toBe(0);
    expect(canvasSolidFieldLightingGain(
      RenderPhase.Solid, RenderOptics.SmoothRigid, 1, false, false, false, true,
    )).toBe(0);
    expect(canvasSolidFieldLightingGain(
      RenderPhase.Solid, RenderOptics.SmoothRigid, 0, true, false, false, true,
    )).toBe(0);
    expect(canvasSolidFieldLightingGain(
      RenderPhase.Solid, RenderOptics.SmoothRigid, 0, false, false, true, true,
    )).toBe(0);
    for (const phase of [
      RenderPhase.Powder, RenderPhase.Liquid, RenderPhase.Gas,
      RenderPhase.Energy, RenderPhase.Field,
    ]) expect(canvasSolidFieldLightingGain(
      phase, RenderOptics.SmoothRigid, 0, false, false, false, true,
    )).toBe(0);
  });

  it('gates coloured body transmission to enabled dense non-emissive translucent solids', () => {
    expect(canvasTranslucentFieldExposure(
      RenderOptics.TranslucentRigid, true, false, true,
    )).toBe(CANVAS_TRANSLUCENT_FIELD_EXPOSURE);
    expect(canvasTranslucentFieldExposure(RenderOptics.SmoothRigid, true, false, true)).toBe(0);
    expect(canvasTranslucentFieldExposure(RenderOptics.TranslucentRigid, false, false, true)).toBe(0);
    expect(canvasTranslucentFieldExposure(RenderOptics.TranslucentRigid, true, true, true)).toBe(0);
    expect(canvasTranslucentFieldExposure(RenderOptics.TranslucentRigid, true, false, false)).toBe(0);
  });

  it('gates and differentiates thick opaque solid scene-light exposure', () => {
    const exposure = (profile: RenderProfile, optics: RenderOptics, depth = 120, relief = 0) => (
      canvasSolidBodyFieldExposure(
        RenderPhase.Solid, profile, optics, 0, false, true, false,
        depth, relief, true,
      )
    );
    const rigid = exposure(RenderProfile.Rigid, RenderOptics.SmoothRigid);
    const organic = exposure(RenderProfile.Organic, RenderOptics.Organic);
    const device = exposure(RenderProfile.Device, RenderOptics.Device);
    const radioactive = exposure(RenderProfile.Radioactive, RenderOptics.Radioactive);
    expect(device).toBeGreaterThan(rigid);
    expect(rigid).toBeGreaterThan(organic);
    expect(organic).toBeGreaterThan(0);
    expect(radioactive).toBeGreaterThan(0);
    expect(canvasSolidBodyFieldExposure(
      RenderPhase.Solid, RenderProfile.Organic, RenderOptics.Organic,
      RenderTrait.Organic, false, true, false, 120, 0, true,
    )).toBe(organic);
    expect(canvasSolidBodyFieldExposure(
      RenderPhase.Solid, RenderProfile.Radioactive, RenderOptics.Radioactive,
      RenderTrait.Radioactive, false, true, false, 120, 0, true,
    )).toBe(radioactive);
    expect(exposure(RenderProfile.Rigid, RenderOptics.SmoothRigid, 120, 7))
      .toBeGreaterThan(exposure(RenderProfile.Rigid, RenderOptics.SmoothRigid, 120, -7));
    expect(exposure(RenderProfile.Rigid, RenderOptics.SmoothRigid, 255))
      .toBeLessThan(exposure(RenderProfile.Rigid, RenderOptics.SmoothRigid, 120));

    const rejected: ReadonlyArray<Parameters<typeof canvasSolidBodyFieldExposure>> = [
      [RenderPhase.Powder, RenderProfile.Granular, RenderOptics.RoughGranular, 0, false, true, false, 120, 0, true],
      [RenderPhase.Solid, RenderProfile.Rigid, RenderOptics.TranslucentRigid, 0, false, true, false, 120, 0, true],
      [RenderPhase.Solid, RenderProfile.Rigid, RenderOptics.SmoothRigid, 1, false, true, false, 120, 0, true],
      [RenderPhase.Solid, RenderProfile.Rigid, RenderOptics.SmoothRigid, 0, true, true, false, 120, 0, true],
      [RenderPhase.Solid, RenderProfile.Rigid, RenderOptics.SmoothRigid, 0, false, false, false, 120, 0, true],
      [RenderPhase.Solid, RenderProfile.Rigid, RenderOptics.SmoothRigid, 0, false, true, true, 120, 0, true],
      [RenderPhase.Solid, RenderProfile.Rigid, RenderOptics.SmoothRigid, 0, false, true, false, 6, 0, true],
      [RenderPhase.Solid, RenderProfile.Rigid, RenderOptics.SmoothRigid, 0, false, true, false, 120, 0, false],
    ];
    for (const parameters of rejected) expect(canvasSolidBodyFieldExposure(...parameters)).toBe(0);
  });

  it('screen-blends warm light through a glass body without changing alpha', () => {
    const target = new Uint8ClampedArray([120, 160, 190, 218]);
    const original = target.slice();
    const exposure = canvasTranslucentFieldExposure(
      RenderOptics.TranslucentRigid, true, false, true,
    );
    lightCanvasSurface(
      target, 0, field(), 2, 2, 4, 4, 0, 0,
      RenderProfile.Rigid, exposure, CANVAS_TRANSLUCENT_FIELD_GAIN,
    );
    expect(target[0] - original[0]).toBeGreaterThan(target[1] - original[1]);
    expect(target[1]).toBeGreaterThanOrEqual(original[1]);
    expect(target[3]).toBe(original[3]);
    expect(Math.max(target[0], target[1], target[2])).toBeLessThan(255);
  });

  it('matches numeric bilinear sampling inside the field', () => {
    const emission = new Uint8Array([
      0, 0, 0, 255, 100, 0, 0, 255,
      200, 0, 0, 255, 255, 0, 0, 255,
    ]);
    const target = new Uint8ClampedArray([0, 0, 0, 211]);
    lightCanvasSurface(target, 0, emission, 2, 2, 4, 4, 1, 1, RenderProfile.Rigid, 1);
    expect(Array.from(target)).toEqual([23, 0, 0, 211]);
  });

  it('samples world-cell alpha with the same clamped bilinear mapping', () => {
    const alphaField = new Uint8Array([
      0, 0, 0, 0, 0, 0, 0, 100,
      0, 0, 0, 200, 0, 0, 0, 255,
    ]);
    expect(sampleCanvasFieldAlpha(alphaField, 2, 2, 4, 4, 1, 1)).toBeCloseTo(72.1875);
    expect(sampleCanvasFieldAlpha(alphaField, 2, 2, 4, 4, -20, -20)).toBe(0);
    expect(sampleCanvasFieldAlpha(alphaField, 2, 2, 4, 4, 20, 20)).toBe(255);
  });

  it('samples a far 612x384 Energy cell from the compact emission plane', () => {
    const emission = new Uint8Array(204 * 128 * 4);
    emission[emission.length - 1] = 211;

    expect(sampleCanvasFieldAlpha(emission, 204, 128, 612, 384, 611, 383)).toBe(211);
    expect(Number.isFinite(
      sampleCanvasFieldAlpha(emission, 204, 128, 612, 384, 485, 329),
    )).toBe(true);
  });

  it('rejects malformed fields before bilinear alpha sampling', () => {
    expect(() => sampleCanvasFieldAlpha(
      new Uint8Array(15), 2, 2, 4, 4, 1, 1,
    )).toThrow('Canvas surface light field size mismatch');
    expect(() => sampleCanvasFieldAlpha(
      new Uint8Array(16), 2, 2, 0, 4, 1, 1,
    )).toThrow('Canvas surface light field size mismatch');
  });

  it('clamps the far right and bottom before calculating interpolation weight', () => {
    const emission = new Uint8Array([
      0, 0, 0, 255, 0, 0, 0, 255,
      0, 0, 0, 255, 200, 0, 0, 255,
    ]);
    const target = new Uint8ClampedArray([0, 0, 0, 199]);
    lightCanvasSurface(target, 0, emission, 2, 2, 4, 4, 3, 3, RenderProfile.Rigid, 1);
    expect(Array.from(target)).toEqual([64, 0, 0, 199]);
  });

  it('uses stable, differentiated material-family gains', () => {
    expect(surfaceLightGain(RenderProfile.Rigid)).toBeGreaterThan(surfaceLightGain(RenderProfile.Device));
    expect(surfaceLightGain(RenderProfile.Device)).toBeGreaterThan(surfaceLightGain(RenderProfile.Organic));
    expect(surfaceLightGain(RenderProfile.Organic)).toBeGreaterThan(surfaceLightGain(RenderProfile.Granular));
    expect(surfaceLightGain(RenderProfile.Granular)).toBeGreaterThan(surfaceLightGain(RenderProfile.Radioactive));
    expect(surfaceLightGain(RenderProfile.Neutral)).toBeGreaterThan(0);
  });

  it('validates a sampled field before reading it', () => {
    const target = new Uint8ClampedArray([70, 90, 110, 255]);
    expect(() => lightCanvasSurface(
      target, 0, new Uint8Array(3), 2, 2, 4, 4, 0, 0, RenderProfile.Rigid, 1,
    )).toThrow('Canvas surface light field size mismatch');
  });
});
