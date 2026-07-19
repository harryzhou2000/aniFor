import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import {
  canvasWallPatternLight, writeCanvasLiquidRefractedWallPixel,
  writeCanvasRefractedWallPixel, writeCanvasWallPixel,
} from './canvas-wall-style';
import { RenderOptics } from './render-optics';

describe('Canvas native-wall style', () => {
  it('moves only the procedural pattern and preserves wall alpha', () => {
    const ordinary = new Uint8ClampedArray(4);
    const glass = new Uint8ClampedArray(4);
    writeCanvasWallPixel(ordinary, 0, 6, 11, 8);
    glass.set(ordinary);
    expect(writeCanvasRefractedWallPixel(glass, 0, 6, 11, 8, Material.Glass, 1, 0)).toBe(true);
    expect(glass.slice(0, 3)).not.toEqual(ordinary.slice(0, 3));
    expect(glass[3]).toBe(ordinary[3]);
  });

  it('gives Ice a stable faceted response distinct from clear Glass', () => {
    const glass = new Uint8ClampedArray(4);
    const ice = new Uint8ClampedArray(4);
    writeCanvasWallPixel(glass, 0, 10, 17, 11);
    ice.set(glass);
    writeCanvasRefractedWallPixel(glass, 0, 10, 17, 11, Material.Glass);
    writeCanvasRefractedWallPixel(ice, 0, 10, 17, 11, Material.Ice);
    expect(ice).not.toEqual(glass);
    const repeated = new Uint8ClampedArray(4);
    writeCanvasRefractedWallPixel(repeated, 0, 10, 17, 11, Material.Ice);
    expect(repeated).toEqual(ice);
  });

  it('is an exact no-op for opaque material or absent walls', () => {
    const bytes = Uint8ClampedArray.from([31, 41, 59, 197]);
    expect(writeCanvasRefractedWallPixel(bytes, 0, 0, 4, 4, Material.Glass)).toBe(false);
    expect(writeCanvasRefractedWallPixel(bytes, 0, 6, 4, 4, Material.Metal)).toBe(false);
    expect([...bytes]).toEqual([31, 41, 59, 197]);
  });

  it('keeps the patterned stripe world-anchored and deterministic', () => {
    expect(canvasWallPatternLight(6, 8, 8)).toBe(-7);
    expect(canvasWallPatternLight(6, 13, 8)).toBe(21);
    expect(canvasWallPatternLight(6, 20, 12)).toBe(21);
    expect(canvasWallPatternLight(8, 8, 8)).toBe(-4);
  });

  it('uses opposite semantic shoulders to bend a Glass card in opposite directions', () => {
    const left = new Uint8ClampedArray(4);
    const right = new Uint8ClampedArray(4);
    writeCanvasRefractedWallPixel(left, 0, 6, 10, 12, Material.Glass, -1, 0);
    writeCanvasRefractedWallPixel(right, 0, 6, 10, 12, Material.Glass, 1, 0);
    expect(left).not.toEqual(right);
    expect(left[3]).toBe(248);
    expect(right[3]).toBe(248);
  });

  it('bends only the procedural wall pattern through a supported liquid slope', () => {
    const straight = new Uint8ClampedArray(4);
    const refracted = new Uint8ClampedArray(4);
    writeCanvasWallPixel(straight, 0, 6, 2, 1);
    expect(writeCanvasLiquidRefractedWallPixel(
      refracted, 0, 6, 2, 1, RenderOptics.Aqueous, 1, 0,
    )).toBe(true);
    expect([...refracted]).not.toEqual([...straight]);
    expect(refracted[3]).toBe(straight[3]);
  });

  it('gives a flat pool one coherent lens shift while molten remains an exact no-op', () => {
    const target = new Uint8ClampedArray([11, 22, 33, 44]);
    expect(writeCanvasLiquidRefractedWallPixel(
      target, 0, 6, 1, 1, RenderOptics.Aqueous,
    )).toBe(true);
    expect(target[3]).toBe(248);
    const molten = new Uint8ClampedArray([11, 22, 33, 44]);
    expect(writeCanvasLiquidRefractedWallPixel(
      molten, 0, 6, 1, 1, RenderOptics.Molten,
    )).toBe(false);
    expect([...molten]).toEqual([11, 22, 33, 44]);
  });
});
