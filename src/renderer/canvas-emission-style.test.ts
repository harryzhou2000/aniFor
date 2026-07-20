import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  CANVAS_EMISSION_VOLUME_RESPONSE_LIMIT,
  canvasLocalEmissionAlpha,
  shadeCanvasEmissionVolume,
} from './canvas-emission-style';
import { RenderPhase } from './render-profile';

describe('Canvas local emission styling', () => {
  it('keeps volumetric accents below opaque-surface accents', () => {
    const gas = canvasLocalEmissionAlpha(RenderPhase.Gas);
    const liquid = canvasLocalEmissionAlpha(RenderPhase.Liquid);
    const solid = canvasLocalEmissionAlpha(RenderPhase.Solid);
    expect(gas).toBeLessThan(liquid);
    expect(liquid).toBeLessThan(solid);
  });

  it('leaves Energy to its dedicated core and glow path', () => {
    expect(canvasLocalEmissionAlpha(RenderPhase.Energy)).toBe(0);
  });

  it('adds bounded RGB-only volume relief while copying support exactly', () => {
    const source = new Uint8Array([
      210, 72, 24, 48, 210, 72, 24, 144, 210, 72, 24, 0,
      210, 72, 24, 112, 210, 72, 24, 224, 210, 72, 24, 72,
      210, 72, 24, 0, 210, 72, 24, 96, 210, 72, 24, 24,
    ]);
    const target = new Uint8ClampedArray(source.length);
    shadeCanvasEmissionVolume(target, source, 3, 3, true);

    let changed = false;
    for (let offset = 0; offset < source.length; offset += 4) {
      expect(target[offset + 3]).toBe(source[offset + 3]);
      if (source[offset + 3] === 0) {
        expect(Array.from(target.slice(offset, offset + 4))).toEqual([0, 0, 0, 0]);
        continue;
      }
      for (let channel = 0; channel < 3; channel++) {
        const difference = Math.abs(target[offset + channel] - source[offset + channel]);
        expect(difference).toBeLessThanOrEqual(CANVAS_EMISSION_VOLUME_RESPONSE_LIMIT);
        changed ||= difference > 0;
      }
    }
    expect(changed).toBe(true);
  });

  it('repeats flat -> volume -> flat byte-exactly, including in-place shading', () => {
    const source = new Uint8Array([
      180, 80, 32, 32, 180, 80, 32, 180,
      180, 80, 32, 96, 180, 80, 32, 224,
    ]);
    const target = new Uint8ClampedArray(source.length);
    shadeCanvasEmissionVolume(target, source, 2, 2, false);
    expect(target).toEqual(new Uint8ClampedArray(source));
    shadeCanvasEmissionVolume(target, source, 2, 2, true);
    expect(target).not.toEqual(new Uint8ClampedArray(source));
    shadeCanvasEmissionVolume(target, source, 2, 2, false);
    expect(target).toEqual(new Uint8ClampedArray(source));

    const inPlace = new Uint8ClampedArray(source);
    shadeCanvasEmissionVolume(inPlace, inPlace, 2, 2, true);
    const first = inPlace.slice();
    inPlace.set(source);
    shadeCanvasEmissionVolume(inPlace, inPlace, 2, 2, true);
    expect(inPlace).toEqual(first);
  });

  it('validates both field buffers before entering the volume loop', () => {
    expect(() => shadeCanvasEmissionVolume(
      new Uint8ClampedArray(15), new Uint8Array(16), 2, 2, true,
    )).toThrow('Canvas emission volume size mismatch');
    expect(() => shadeCanvasEmissionVolume(
      new Uint8ClampedArray(16), new Uint8Array(16), 0, 2, true,
    )).toThrow('Canvas emission volume size mismatch');
  });

  it('keeps both Canvas emission refresh paths on the volume transform', () => {
    const source = readFileSync(new URL('./field-renderer.ts', import.meta.url), 'utf8');

    expect(source.match(/shadeCanvasEmissionVolume\(/g)).toHaveLength(2);
    expect(source).not.toContain('emissionPixels.data.set(fields.emission.bytes)');
  });
});
