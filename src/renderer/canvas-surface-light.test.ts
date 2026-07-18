import { describe, expect, it } from 'vitest';
import { lightCanvasSurface } from './canvas-surface-light';
import { RenderProfile, surfaceLightGain } from './render-profile';

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
