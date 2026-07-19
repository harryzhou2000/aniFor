import { describe, expect, it } from 'vitest';
import {
  CANVAS_TRANSLUCENT_FIELD_EXPOSURE, CANVAS_TRANSLUCENT_FIELD_GAIN,
  canvasTranslucentFieldExposure, lightCanvasSurface,
} from './canvas-surface-light';
import { RenderProfile, surfaceLightGain } from './render-profile';
import { RenderOptics } from './render-optics';

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

  it('gates coloured body transmission to enabled dense non-emissive translucent solids', () => {
    expect(canvasTranslucentFieldExposure(
      RenderOptics.TranslucentRigid, true, false, true,
    )).toBe(CANVAS_TRANSLUCENT_FIELD_EXPOSURE);
    expect(canvasTranslucentFieldExposure(RenderOptics.SmoothRigid, true, false, true)).toBe(0);
    expect(canvasTranslucentFieldExposure(RenderOptics.TranslucentRigid, false, false, true)).toBe(0);
    expect(canvasTranslucentFieldExposure(RenderOptics.TranslucentRigid, true, true, true)).toBe(0);
    expect(canvasTranslucentFieldExposure(RenderOptics.TranslucentRigid, true, false, false)).toBe(0);
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
