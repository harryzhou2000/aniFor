import { describe, expect, it } from 'vitest';
import { ALL_MATERIALS, Material } from '../shared/materials';
import {
  CANVAS_CONTOUR_CHUNK_SIZE,
  CANVAS_CONTOUR_OUTPUT_SCALE,
  CanvasPhaseContourScratch,
  type CanvasPhaseContourInput,
} from './canvas-phase-contour';
import { createRenderLookups } from './render-field-set';

const lookups = createRenderLookups(ALL_MATERIALS);

interface Fixture {
  readonly materials: Uint8Array;
  readonly pixels: Uint8ClampedArray;
  readonly stability: Uint8Array;
  readonly walls: Uint8Array;
  readonly input: CanvasPhaseContourInput;
}

function fixture(width = 5, height = 5): Fixture {
  const materials = new Uint8Array(width * height);
  const pixels = new Uint8ClampedArray(width * height * 4);
  const stability = new Uint8Array(width * height);
  const walls = new Uint8Array(width * height);
  return {
    materials,
    pixels,
    stability,
    walls,
    input: {
      materials,
      sourcePixels: pixels,
      styleBytes: lookups.styleBytes,
      powderStability: stability,
      walls,
      worldWidth: width,
      worldHeight: height,
      chunkX: 0,
      chunkY: 0,
      chunkWidth: width,
      chunkHeight: height,
    },
  };
}

function paint(value: Fixture, x: number, y: number, material: Material): void {
  const index = y * value.input.worldWidth + x;
  value.materials[index] = material;
  value.stability[index] = 255;
  const color = material * 3;
  const pixel = index * 4;
  value.pixels[pixel] = lookups.colorByMaterial[color];
  value.pixels[pixel + 1] = lookups.colorByMaterial[color + 1];
  value.pixels[pixel + 2] = lookups.colorByMaterial[color + 2];
  value.pixels[pixel + 3] = 255;
}

function outputIndex(x: number, y: number): number {
  return y * CANVAS_CONTOUR_CHUNK_SIZE * CANVAS_CONTOUR_OUTPUT_SCALE + x;
}

function alphaAt(scratch: CanvasPhaseContourScratch, x: number, y: number): number {
  return scratch.pixels[outputIndex(x, y) * 4 + 3];
}

function rgbaAt(scratch: CanvasPhaseContourScratch, x: number, y: number): number[] {
  const pixel = outputIndex(x, y) * 4;
  return Array.from(scratch.pixels.slice(pixel, pixel + 4));
}

describe('Canvas 2x phase contour scratch', () => {
  it('owns one bounded 32x32 chunk, one-cell halo, and stable output buffers', () => {
    const scratch = new CanvasPhaseContourScratch();
    expect(scratch.allocatedByteLength).toBe(33_824);
    const pixels = scratch.pixels;
    const coverage = scratch.coverage;
    const owners = scratch.ownerMaterials;
    const value = fixture();
    paint(value, 2, 2, Material.Metal);
    scratch.rasterize(value.input);
    scratch.rasterize(value.input);
    expect(scratch.pixels).toBe(pixels);
    expect(scratch.coverage).toBe(coverage);
    expect(scratch.ownerMaterials).toBe(owners);
    expect(scratch.outputWidth).toBe(10);
    expect(scratch.outputHeight).toBe(10);
    expect(scratch.outputStride).toBe(64);
  });

  it('handles every local neighbour topology with mirror-symmetric categorical solid support', () => {
    const scratch = new CanvasPhaseContourScratch();
    const neighbours = [
      [1, 1], [2, 1], [3, 1], [1, 2],
      [3, 2], [1, 3], [2, 3], [3, 3],
    ] as const;
    for (let mask = 0; mask < 256; mask++) {
      const value = fixture();
      paint(value, 2, 2, Material.Metal);
      for (let bit = 0; bit < neighbours.length; bit++) {
        if (mask & (1 << bit)) paint(value, neighbours[bit][0], neighbours[bit][1], Material.Glass);
      }
      scratch.rasterize(value.input);
      const originalTopLeft = scratch.coverage[outputIndex(4, 4)];
      const originalTopRight = scratch.coverage[outputIndex(5, 4)];
      const originalBottomLeft = scratch.coverage[outputIndex(4, 5)];
      const originalBottomRight = scratch.coverage[outputIndex(5, 5)];
      for (let subY = 4; subY <= 5; subY++) for (let subX = 4; subX <= 5; subX++) {
        expect(scratch.coverage[outputIndex(subX, subY)]).toBeGreaterThanOrEqual(0);
        expect(scratch.coverage[outputIndex(subX, subY)]).toBeLessThanOrEqual(255);
        expect(scratch.ownerMaterials[outputIndex(subX, subY)]).toBe(Material.Metal);
      }
      expect(alphaAt(scratch, 0, 0)).toBe(0);

      const mirrored = fixture();
      paint(mirrored, 2, 2, Material.Metal);
      for (let bit = 0; bit < neighbours.length; bit++) {
        if (mask & (1 << bit)) paint(
          mirrored, 4 - neighbours[bit][0], neighbours[bit][1], Material.Glass,
        );
      }
      scratch.rasterize(mirrored.input);
      expect(scratch.coverage[outputIndex(4, 4)]).toBe(originalTopRight);
      expect(scratch.coverage[outputIndex(5, 4)]).toBe(originalTopLeft);
      expect(scratch.coverage[outputIndex(4, 5)]).toBe(originalBottomRight);
      expect(scratch.coverage[outputIndex(5, 5)]).toBe(originalBottomLeft);
    }
  });

  it('keeps unlike solid and liquid ownership exclusive at shared seams', () => {
    const scratch = new CanvasPhaseContourScratch();
    const value = fixture(4, 3);
    for (let y = 0; y < 3; y++) {
      paint(value, 0, y, Material.Metal);
      paint(value, 1, y, Material.Metal);
      paint(value, 2, y, Material.Glass);
      paint(value, 3, y, Material.Glass);
    }
    scratch.rasterize(value.input);
    const metal = rgbaAt(scratch, 3, 3);
    const glass = rgbaAt(scratch, 4, 3);
    expect(metal.slice(0, 3)).toEqual(Array.from(lookups.colorByMaterial.slice(Material.Metal * 3, Material.Metal * 3 + 3)));
    expect(glass.slice(0, 3)).toEqual(Array.from(lookups.colorByMaterial.slice(Material.Glass * 3, Material.Glass * 3 + 3)));
    expect(metal[3]).toBeGreaterThan(0);
    expect(glass[3]).toBeGreaterThan(0);
    expect(scratch.ownerMaterials[outputIndex(3, 3)]).toBe(Material.Metal);
    expect(scratch.ownerMaterials[outputIndex(4, 3)]).toBe(Material.Glass);

    const liquids = fixture(4, 3);
    for (let y = 0; y < 3; y++) {
      paint(liquids, 0, y, Material.Water);
      paint(liquids, 1, y, Material.Water);
      paint(liquids, 2, y, Material.Oil);
      paint(liquids, 3, y, Material.Oil);
    }
    scratch.rasterize(liquids.input);
    expect(rgbaAt(scratch, 3, 3).slice(0, 3)).toEqual(
      Array.from(lookups.colorByMaterial.slice(Material.Water * 3, Material.Water * 3 + 3)),
    );
    expect(rgbaAt(scratch, 4, 3).slice(0, 3)).toEqual(
      Array.from(lookups.colorByMaterial.slice(Material.Oil * 3, Material.Oil * 3 + 3)),
    );

    const unlikeSupport = fixture();
    paint(unlikeSupport, 2, 2, Material.Water);
    paint(unlikeSupport, 3, 2, Material.Oil);
    scratch.rasterize(unlikeSupport.input);
    const unlikeEdge = scratch.coverage[outputIndex(5, 4)];
    paint(unlikeSupport, 3, 2, Material.Water);
    scratch.rasterize(unlikeSupport.input);
    expect(scratch.coverage[outputIndex(5, 4)]).toBeGreaterThan(unlikeEdge);
  });

  it('keeps isolated powder round and an isolated liquid inside its owner cell', () => {
    const scratch = new CanvasPhaseContourScratch();
    const powder = fixture();
    paint(powder, 2, 2, Material.Sand);
    powder.stability[2 * 5 + 2] = 0;
    scratch.rasterize(powder.input);
    let powderPixels = 0;
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
      if (alphaAt(scratch, x, y) > 0) powderPixels++;
    }
    expect(powderPixels).toBeGreaterThan(0);
    expect(powderPixels).toBeLessThanOrEqual(4);
    expect(alphaAt(scratch, 3, 4)).toBe(0);
    expect(alphaAt(scratch, 6, 4)).toBe(0);

    const liquid = fixture();
    paint(liquid, 2, 2, Material.Water);
    scratch.rasterize(liquid.input);
    let liquidPixels = 0;
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
      if (alphaAt(scratch, x, y) > 0) liquidPixels++;
    }
    expect(liquidPixels).toBeGreaterThan(0);
    expect(liquidPixels).toBeLessThanOrEqual(4);
    expect(alphaAt(scratch, 3, 4)).toBe(0);
    expect(alphaAt(scratch, 6, 4)).toBe(0);
  });

  it('blends settled powder continuously into heap support without reshaping a solid', () => {
    const scratch = new CanvasPhaseContourScratch();
    const value = fixture();
    paint(value, 2, 2, Material.Sand);
    paint(value, 2, 3, Material.Metal);
    paint(value, 1, 2, Material.Salt);
    const index = 2 * 5 + 2;
    const samples: number[] = [];
    for (const stability of [0, 64, 128, 192, 255]) {
      value.stability[index] = stability;
      scratch.rasterize(value.input);
      samples.push(alphaAt(scratch, 4, 4));
    }
    for (let sample = 1; sample < samples.length; sample++) {
      expect(Math.abs(samples[sample] - samples[sample - 1])).toBeLessThan(160);
    }
    expect(new Set(samples).size).toBeGreaterThan(1);

    const solidOnly = fixture();
    paint(solidOnly, 2, 2, Material.Metal);
    scratch.rasterize(solidOnly.input);
    const baseline = Array.from(scratch.coverage);
    paint(solidOnly, 1, 2, Material.Sand);
    paint(solidOnly, 2, 1, Material.Water);
    scratch.rasterize(solidOnly.input);
    for (let y = 4; y <= 5; y++) for (let x = 4; x <= 5; x++) {
      expect(scratch.coverage[outputIndex(x, y)]).toBe(baseline[outputIndex(x, y)]);
    }
  });

  it('passes walls, gas, energy, and field cells directly without contour support', () => {
    const scratch = new CanvasPhaseContourScratch();
    const value = fixture();
    paint(value, 2, 2, Material.Smoke);
    paint(value, 3, 2, Material.Fire);
    paint(value, 2, 3, Material.GRVT);
    paint(value, 1, 2, Material.Metal);
    paint(value, 1, 3, Material.Wall);
    value.walls[2 * 5 + 1] = 1;
    scratch.rasterize(value.input);
    for (const [x, y, material] of [
      [4, 4, Material.Smoke], [6, 4, Material.Fire], [4, 6, Material.GRVT],
      [2, 4, Material.Metal], [2, 6, Material.Wall],
    ] as const) {
      expect(scratch.ownerMaterials[outputIndex(x, y)]).toBe(material);
      expect(alphaAt(scratch, x, y)).toBe(255);
    }
  });
});
