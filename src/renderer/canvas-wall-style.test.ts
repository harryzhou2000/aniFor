import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import {
  canvasWallPatternLight, writeCanvasRefractedWallPixel, writeCanvasWallPixel,
} from './canvas-wall-style';

describe('Canvas native-wall style', () => {
  it('moves only the procedural pattern and preserves wall alpha', () => {
    const ordinary = new Uint8ClampedArray(4);
    const glass = new Uint8ClampedArray(4);
    writeCanvasWallPixel(ordinary, 0, 6, 8, 8);
    glass.set(ordinary);
    expect(writeCanvasRefractedWallPixel(glass, 0, 6, 8, 8, Material.Glass)).toBe(true);
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
    expect(canvasWallPatternLight(6, 8, 8)).toBe(18);
    expect(canvasWallPatternLight(6, 9, 8)).toBe(-4);
    expect(canvasWallPatternLight(8, 8, 8)).toBe(-4);
  });
});
