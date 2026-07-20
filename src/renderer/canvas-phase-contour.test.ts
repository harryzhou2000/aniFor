import { describe, expect, it } from 'vitest';
import { ALL_MATERIALS, Material } from '../shared/materials';
import {
  CANVAS_CONTOUR_CHUNK_SIZE,
  CANVAS_CONTOUR_OUTPUT_SCALE,
  CanvasPhaseContourScratch,
  canvasLiquidMeniscusScale,
  type CanvasPhaseContourInput,
} from './canvas-phase-contour';
import { RenderOptics } from './render-optics';
import { PowderSurfaceField } from './powder-surface-field';
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
      paletteBytes: lookups.paletteBytes,
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

  it('creates real four- and eight-times contour samples with matching strides', () => {
    for (const scale of [4, 8] as const) {
      const scratch = new CanvasPhaseContourScratch(scale);
      expect(scratch.allocatedByteLength).toBe(scale === 4 ? 107_552 : 402_464);
      const value = fixture();
      paint(value, 2, 2, Material.Sand);
      scratch.rasterize(value.input);
      expect(scratch.outputScale).toBe(scale);
      expect(scratch.outputWidth).toBe(5 * scale);
      expect(scratch.outputHeight).toBe(5 * scale);
      expect(scratch.outputStride).toBe(CANVAS_CONTOUR_CHUNK_SIZE * scale);
      const alphaLevels = new Set<number>();
      for (let y = 2 * scale; y < 3 * scale; y++) {
        for (let x = 2 * scale; x < 3 * scale; x++) {
          alphaLevels.add(scratch.pixels[(y * scratch.outputStride + x) * 4 + 3]);
        }
      }
      expect(alphaLevels.size).toBeGreaterThan(2);
    }
  });

  it('renders one Grains cell as one exact axis-aligned square at true 8x', () => {
    const scale = 8;
    const scratch = new CanvasPhaseContourScratch(scale);
    const value = fixture();
    paint(value, 2, 2, Material.Sand);
    scratch.rasterize({ ...value.input, powderStyle: 'grains' });

    for (let outputY = 0; outputY < value.input.worldHeight * scale; outputY++) {
      for (let outputX = 0; outputX < value.input.worldWidth * scale; outputX++) {
        const output = outputY * scratch.outputStride + outputX;
        const inside = outputX >= 2 * scale && outputX < 3 * scale
          && outputY >= 2 * scale && outputY < 3 * scale;
        expect(scratch.coverage[output], `${outputX},${outputY}`).toBe(inside ? 255 : 0);
        expect(scratch.pixels[output * 4 + 3], `${outputX},${outputY} alpha`).toBe(inside ? 255 : 0);
        expect(scratch.ownerMaterials[output], `${outputX},${outputY} owner`).toBe(
          inside ? Material.Sand : Material.Empty,
        );
      }
    }
  });

  it('adds a bounded bipolar unlike-solid contact bevel without changing support', () => {
    const value = fixture(7, 5);
    for (let y = 1; y <= 3; y++) for (let x = 1; x <= 5; x++) {
      paint(value, x, y, x <= 2 ? Material.Metal : Material.Glass);
    }
    const flat = new CanvasPhaseContourScratch();
    const depth = new CanvasPhaseContourScratch();
    flat.rasterize({ ...value.input, solidContactDepth: false });
    depth.rasterize({ ...value.input, solidContactDepth: true });

    let positive = 0;
    let negative = 0;
    let peak = 0;
    let farPeak = 0;
    for (let y = 0; y < depth.outputHeight; y++) for (let x = 0; x < depth.outputWidth; x++) {
      const index = y * depth.outputStride + x;
      const pixel = index * 4;
      expect(depth.coverage[index]).toBe(flat.coverage[index]);
      expect(depth.pixels[pixel + 3]).toBe(flat.pixels[pixel + 3]);
      const difference = depth.pixels[pixel] - flat.pixels[pixel];
      if (difference > 0) positive++;
      if (difference < 0) negative++;
      peak = Math.max(peak, Math.abs(difference));
      if (x <= 2 || x >= 11) farPeak = Math.max(farPeak, Math.abs(difference));
    }
    expect(positive).toBeGreaterThan(0);
    expect(negative).toBeGreaterThan(0);
    expect(peak).toBeGreaterThanOrEqual(2);
    expect(peak).toBeLessThanOrEqual(9);
    expect(farPeak).toBe(0);
  });

  it('adds bounded solid contour curvature while preserving exact support and flat interiors', () => {
    const value = fixture(7, 7);
    for (let y = 1; y <= 5; y++) for (let x = 1; x <= 5; x++) {
      paint(value, x, y, Material.Metal);
    }
    const flat = new CanvasPhaseContourScratch();
    const curved = new CanvasPhaseContourScratch();
    flat.rasterize({ ...value.input, solidCurvatureDepth: false });
    curved.rasterize({ ...value.input, solidCurvatureDepth: true });

    let changed = 0;
    let peak = 0;
    for (let index = 0; index < curved.outputWidth * curved.outputHeight; index++) {
      const pixel = index * 4;
      expect(curved.coverage[index]).toBe(flat.coverage[index]);
      expect(curved.pixels[pixel + 3]).toBe(flat.pixels[pixel + 3]);
      const difference = Math.abs(curved.pixels[pixel] - flat.pixels[pixel]);
      if (difference > 0) changed++;
      peak = Math.max(peak, difference);
    }
    expect(changed).toBeGreaterThan(0);
    expect(peak).toBeGreaterThanOrEqual(2);
    expect(peak).toBeLessThanOrEqual(12);
    const centre = (6 * curved.outputStride + 6) * 4;
    expect(curved.pixels.slice(centre, centre + 4)).toEqual(flat.pixels.slice(centre, centre + 4));
  });

  it('uses the shared powder surface to smooth a shallow 4x slope without widening ownership', () => {
    const scale = 4;
    const width = 32;
    const height = 20;
    const value = fixture(width, height);
    for (let x = 2; x < width - 2; x++) {
      const top = 14 - Math.round((x - 2) * 3 / (width - 5));
      for (let y = top; y < height; y++) paint(value, x, y, Material.Sand);
    }

    const field = new PowderSurfaceField(width, height, lookups.styleBytes);
    expect(field.update(value.materials, value.stability, value.walls)).toBe(true);

    const localOnly = new CanvasPhaseContourScratch(scale);
    localOnly.rasterize(value.input);
    const sharedSurface = new CanvasPhaseContourScratch(scale);
    sharedSurface.rasterize({ ...value.input, powderSurface: field.bytes });

    const localProfile = groupMeans(
      alphaColumnMass(localOnly, 6 * scale, (width - 6) * scale), scale,
    );
    const sharedProfile = groupMeans(
      alphaColumnMass(sharedSurface, 6 * scale, (width - 6) * scale), scale,
    );
    expect(secondDifferenceEnergy(sharedProfile)).toBeLessThan(
      secondDifferenceEnergy(localProfile) * 0.96,
    );
    expect(sharedProfile).not.toEqual(localProfile);

    for (let outputY = 0; outputY < height * scale; outputY++) {
      for (let outputX = 0; outputX < width * scale; outputX++) {
        const output = outputY * sharedSurface.outputStride + outputX;
        if (sharedSurface.coverage[output] === 0) continue;
        expect(sharedSurface.ownerMaterials[output]).toBe(Material.Sand);
        const cellX = Math.floor(outputX / scale);
        const cellY = Math.floor(outputY / scale);
        if (value.materials[cellY * width + cellX] !== 0) continue;
        const hasCardinalOwner = (cellX > 0
          && value.materials[cellY * width + cellX - 1] === Material.Sand)
          || (cellX + 1 < width
            && value.materials[cellY * width + cellX + 1] === Material.Sand)
          || (cellY > 0
            && value.materials[(cellY - 1) * width + cellX] === Material.Sand)
          || (cellY + 1 < height
            && value.materials[(cellY + 1) * width + cellX] === Material.Sand);
        expect(hasCardinalOwner).toBe(true);
      }
    }
  });

  it('keeps narrow settled Clay and Concrete ridges on their exact local 4x contour', () => {
    const scale = 4;
    const width = 32;
    const height = 20;
    const value = fixture(width, height);
    for (let x = 3; x <= 14; x++) paint(value, x, 7, Material.Clay);
    for (let y = 3; y < 7; y++) paint(value, 8, y, Material.Clay);
    for (let x = 17; x <= 29; x++) paint(value, x, 14, Material.Concrete);
    for (let y = 11; y < 14; y++) paint(value, 24, y, Material.Concrete);

    const field = new PowderSurfaceField(width, height, lookups.styleBytes);
    field.update(value.materials, value.stability, value.walls);
    const localOnly = new CanvasPhaseContourScratch(scale);
    localOnly.rasterize(value.input);
    const sharedSurface = new CanvasPhaseContourScratch(scale);
    sharedSurface.rasterize({ ...value.input, powderSurface: field.bytes });

    const detailCells = [
      ...Array.from({ length: 12 }, (_, offset) => [3 + offset, 7] as const),
      ...Array.from({ length: 4 }, (_, offset) => [8, 3 + offset] as const),
      ...Array.from({ length: 13 }, (_, offset) => [17 + offset, 14] as const),
      ...Array.from({ length: 3 }, (_, offset) => [24, 11 + offset] as const),
    ];
    for (const [cellX, cellY] of detailCells) {
      for (let subY = 0; subY < scale; subY++) for (let subX = 0; subX < scale; subX++) {
        const output = (cellY * scale + subY) * sharedSurface.outputStride
          + cellX * scale + subX;
        expect(
          sharedSurface.coverage[output], `${cellX},${cellY}:${subX},${subY}`,
        ).toBe(localOnly.coverage[output]);
        expect(sharedSurface.ownerMaterials[output]).toBe(value.materials[cellY * width + cellX]);
      }
    }

    for (let outputY = 0; outputY < height * scale; outputY++) {
      for (let outputX = 0; outputX < width * scale; outputX++) {
        const output = outputY * sharedSurface.outputStride + outputX;
        if (sharedSurface.coverage[output] === 0) continue;
        const owner = sharedSurface.ownerMaterials[output];
        expect(owner === Material.Clay || owner === Material.Concrete).toBe(true);
        const cellX = Math.floor(outputX / scale);
        const cellY = Math.floor(outputY / scale);
        if (value.materials[cellY * width + cellX] !== 0) continue;
        const hasExactCardinalOwner = (cellX > 0
          && value.materials[cellY * width + cellX - 1] === owner)
          || (cellX + 1 < width && value.materials[cellY * width + cellX + 1] === owner)
          || (cellY > 0 && value.materials[(cellY - 1) * width + cellX] === owner)
          || (cellY + 1 < height && value.materials[(cellY + 1) * width + cellX] === owner);
        expect(hasExactCardinalOwner).toBe(true);
      }
    }
  });

  it('offers grains, local, and slope-aware powder comparison modes at 4x', () => {
    const scale = 4;
    const value = fixture(9, 9);
    for (let y = 4; y <= 7; y++) for (let x = 2; x <= 6; x++) {
      paint(value, x, y, Material.Sand);
    }
    const field = new PowderSurfaceField(9, 9, lookups.styleBytes);
    field.update(value.materials, value.stability, value.walls);

    const grains = new CanvasPhaseContourScratch(scale);
    grains.rasterize({ ...value.input, powderSurface: field.bytes, powderStyle: 'grains' });
    const localWithField = new CanvasPhaseContourScratch(scale);
    localWithField.rasterize({ ...value.input, powderSurface: field.bytes, powderStyle: 'local' });
    const localWithoutField = new CanvasPhaseContourScratch(scale);
    localWithoutField.rasterize({ ...value.input, powderStyle: 'local' });
    const smooth = new CanvasPhaseContourScratch(scale);
    smooth.rasterize({ ...value.input, powderSurface: field.bytes, powderStyle: 'smooth' });

    expect(Array.from(localWithField.coverage)).toEqual(Array.from(localWithoutField.coverage));
    const cellCoverage = (scratch: CanvasPhaseContourScratch, cellX: number, cellY: number): number => {
      let total = 0;
      for (let subY = 0; subY < scale; subY++) for (let subX = 0; subX < scale; subX++) {
        total += scratch.coverage[(cellY * scale + subY) * scratch.outputStride
          + cellX * scale + subX];
      }
      return total;
    };
    expect(cellCoverage(grains, 4, 3)).toBe(0);
    expect(cellCoverage(localWithField, 4, 3)).toBeGreaterThan(0);
    expect(cellCoverage(smooth, 4, 3)).toBeLessThanOrEqual(cellCoverage(localWithField, 4, 3));
    const grainBody = cellCoverage(grains, 4, 4);
    expect(grainBody).toBe(255 * scale * scale);
    expect(cellCoverage(smooth, 4, 4)).toBeGreaterThan(0);
  });

  it('never erases Local coverage from occupied Clay and Concrete columns at 4x or 8x', () => {
    const width = 24;
    const height = 24;
    const value = fixture(width, height);
    // Deep columns with asymmetric ledges and notches exercise the vertical
    // slope gate that previously let the wide field thin occupied sections.
    for (let y = 3; y <= 20; y++) for (let x = 4; x <= 8; x++) {
      if ((y === 8 || y === 15) && x === 4) continue;
      paint(value, x, y, Material.Clay);
    }
    for (let y = 5; y <= 20; y++) for (let x = 14; x <= 18; x++) {
      if ((y === 11 || y === 17) && x === 18) continue;
      paint(value, x, y, Material.Concrete);
    }
    for (let x = 2; x <= 10; x++) paint(value, x, 20, Material.Clay);
    for (let x = 12; x <= 20; x++) paint(value, x, 20, Material.Concrete);

    const field = new PowderSurfaceField(width, height, lookups.styleBytes);
    field.update(value.materials, value.stability, value.walls);
    for (const scale of [4, 8] as const) {
      const local = new CanvasPhaseContourScratch(scale);
      local.rasterize({ ...value.input, powderStyle: 'local' });
      const smooth = new CanvasPhaseContourScratch(scale);
      smooth.rasterize({ ...value.input, powderSurface: field.bytes, powderStyle: 'smooth' });

      for (let cellY = 0; cellY < height; cellY++) for (let cellX = 0; cellX < width; cellX++) {
        if (value.materials[cellY * width + cellX] === Material.Empty) continue;
        for (let subY = 0; subY < scale; subY++) for (let subX = 0; subX < scale; subX++) {
          const output = (cellY * scale + subY) * smooth.outputStride + cellX * scale + subX;
          expect(
            smooth.coverage[output], `${scale}x ${cellX},${cellY}:${subX},${subY}`,
          ).toBeGreaterThanOrEqual(Math.floor(local.coverage[output] * 0.38));
        }
      }
    }
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
    const metalBase = Array.from(
      lookups.colorByMaterial.slice(Material.Metal * 3, Material.Metal * 3 + 3),
    );
    const glassBase = Array.from(
      lookups.colorByMaterial.slice(Material.Glass * 3, Material.Glass * 3 + 3),
    );
    expect(metal.slice(0, 3).every((channel, index) => (
      Math.abs(channel - metalBase[index]) <= 9
    ))).toBe(true);
    expect(glass.slice(0, 3).every((channel, index) => (
      Math.abs(channel - glassBase[index]) <= 9
    ))).toBe(true);
    expect(metal[2]).toBeLessThan(glass[2]);
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

  it('adds bounded bipolar meniscus light without changing liquid support or interiors', () => {
    expect(canvasLiquidMeniscusScale(1, 1, 1, RenderOptics.Aqueous)).toBe(1);
    expect(canvasLiquidMeniscusScale(0.5, 1, 1, RenderOptics.Aqueous)).toBeGreaterThan(1);
    expect(canvasLiquidMeniscusScale(0.5, -1, -1, RenderOptics.Aqueous)).toBeLessThan(1);

    for (const material of [Material.Water, Material.Oil, Material.Acid, Material.Lava]) {
      const value = fixture(7, 7);
      for (let y = 2; y <= 4; y++) for (let x = 2; x <= 4; x++) {
        paint(value, x, y, material);
      }
      const flatStyle = lookups.styleBytes.slice();
      flatStyle[material * 4 + 3] = 1;
      const styled = new CanvasPhaseContourScratch();
      const flat = new CanvasPhaseContourScratch();
      styled.rasterize(value.input);
      flat.rasterize({ ...value.input, styleBytes: flatStyle });

      let brighter = 0;
      let darker = 0;
      let maximumDelta = 0;
      for (let y = 0; y < value.input.worldHeight * styled.outputScale; y++) {
        for (let x = 0; x < value.input.worldWidth * styled.outputScale; x++) {
          const output = y * styled.outputStride + x;
          expect(styled.coverage[output], `${material} ${x},${y} coverage`).toBe(flat.coverage[output]);
          expect(styled.ownerMaterials[output], `${material} ${x},${y} owner`).toBe(
            flat.ownerMaterials[output],
          );
          const pixel = output * 4;
          expect(styled.pixels[pixel + 3], `${material} ${x},${y} alpha`).toBe(
            flat.pixels[pixel + 3],
          );
          for (let channel = 0; channel < 3; channel++) {
            const delta = styled.pixels[pixel + channel] - flat.pixels[pixel + channel];
            if (delta > 0) brighter++;
            if (delta < 0) darker++;
            maximumDelta = Math.max(maximumDelta, Math.abs(delta));
          }
        }
      }

      if (material === Material.Lava) {
        expect(brighter + darker).toBe(0);
      } else {
        expect(brighter, `${material} brighter rim`).toBeGreaterThan(0);
        expect(darker, `${material} darker rim`).toBeGreaterThan(0);
        expect(maximumDelta, `${material} bounded rim`).toBeLessThanOrEqual(14);
      }
      for (let y = 6; y <= 7; y++) for (let x = 6; x <= 7; x++) {
        expect(rgbaAt(styled, x, y), `${material} dense interior ${x},${y}`).toEqual(
          rgbaAt(flat, x, y),
        );
      }
    }
  });

  it('keeps liquid meniscus light off traits, isolated droplets, and unlike contacts', () => {
    const isolated = fixture();
    paint(isolated, 2, 2, Material.Water);
    const isolatedStyled = new CanvasPhaseContourScratch();
    const isolatedFlat = new CanvasPhaseContourScratch();
    const isolatedTraitStyle = lookups.styleBytes.slice();
    isolatedTraitStyle[Material.Water * 4 + 3] = 1;
    isolatedStyled.rasterize(isolated.input);
    isolatedFlat.rasterize({ ...isolated.input, styleBytes: isolatedTraitStyle });
    expect(isolatedStyled.pixels).toEqual(isolatedFlat.pixels);

    const emissive = fixture();
    for (let y = 2; y <= 3; y++) for (let x = 2; x <= 3; x++) {
      paint(emissive, x, y, Material.Water);
    }
    const emissiveStyle = lookups.styleBytes.slice();
    emissiveStyle[Material.Water * 4 + 2] = 255;
    const traitStyle = lookups.styleBytes.slice();
    traitStyle[Material.Water * 4 + 3] = 1;
    const emissiveScratch = new CanvasPhaseContourScratch();
    const traitScratch = new CanvasPhaseContourScratch();
    emissiveScratch.rasterize({ ...emissive.input, styleBytes: emissiveStyle });
    traitScratch.rasterize({ ...emissive.input, styleBytes: traitStyle });
    expect(emissiveScratch.pixels).toEqual(traitScratch.pixels);

    const contact = fixture(6, 5);
    for (let y = 1; y <= 3; y++) for (let x = 0; x < 6; x++) {
      paint(contact, x, y, x < 3 ? Material.Water : Material.Oil);
    }
    const contactStyled = new CanvasPhaseContourScratch();
    const contactFlat = new CanvasPhaseContourScratch();
    const contactTraitStyle = lookups.styleBytes.slice();
    contactTraitStyle[Material.Water * 4 + 3] = 1;
    contactTraitStyle[Material.Oil * 4 + 3] = 1;
    contactStyled.rasterize(contact.input);
    contactFlat.rasterize({ ...contact.input, styleBytes: contactTraitStyle });
    for (let y = 0; y < contact.input.worldHeight * 2; y++) {
      for (let x = 0; x < contact.input.worldWidth * 2; x++) {
        const output = y * contactStyled.outputStride + x;
        expect(contactStyled.coverage[output], `${x},${y} coverage`).toBe(contactFlat.coverage[output]);
        expect(contactStyled.ownerMaterials[output], `${x},${y} owner`).toBe(
          contactFlat.ownerMaterials[output],
        );
        expect(contactStyled.pixels[output * 4 + 3], `${x},${y} alpha`).toBe(
          contactFlat.pixels[output * 4 + 3],
        );
        if (x >= 4 && x < 8 && y >= 2 && y < 8) {
          expect(rgbaAt(contactStyled, x, y), `unlike seam ${x},${y}`).toEqual(
            rgbaAt(contactFlat, x, y),
          );
        }
      }
    }
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

  it('extends only stable unambiguous powder into one curved empty-side band', () => {
    const scratch = new CanvasPhaseContourScratch();
    const value = fixture(7, 6);
    for (let y = 3; y <= 4; y++) for (let x = 2; x <= 4; x++) {
      paint(value, x, y, Material.Sand);
    }
    scratch.rasterize(value.input);
    const boundaryAlpha = [
      alphaAt(scratch, 6, 4), alphaAt(scratch, 6, 5),
    ];
    expect(Math.max(...boundaryAlpha)).toBeGreaterThan(0);
    expect(Math.min(...boundaryAlpha)).toBeLessThan(Math.max(...boundaryAlpha));
    expect(alphaAt(scratch, 6, 3)).toBe(0);
    expect(scratch.ownerMaterials[outputIndex(6, 5)]).toBe(Material.Sand);

    value.stability.fill(0);
    scratch.rasterize(value.input);
    expect(alphaAt(scratch, 6, 4)).toBe(0);
    expect(alphaAt(scratch, 6, 5)).toBe(0);

    const mixed = fixture();
    paint(mixed, 1, 2, Material.Sand);
    paint(mixed, 3, 2, Material.Salt);
    paint(mixed, 1, 1, Material.Sand);
    paint(mixed, 3, 1, Material.Salt);
    scratch.rasterize(mixed.input);
    for (let y = 4; y <= 5; y++) for (let x = 4; x <= 5; x++) {
      expect(alphaAt(scratch, x, y)).toBe(0);
      expect(scratch.ownerMaterials[outputIndex(x, y)]).toBe(0);
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

function secondDifferenceEnergy(values: readonly number[]): number {
  let energy = 0;
  for (let index = 1; index < values.length - 1; index++) {
    energy += Math.abs(values[index - 1] - values[index] * 2 + values[index + 1]);
  }
  return energy;
}

function alphaColumnMass(
  scratch: CanvasPhaseContourScratch,
  startX: number,
  endX: number,
): number[] {
  const masses: number[] = [];
  for (let x = startX; x < endX; x++) {
    let mass = 0;
    for (let y = 0; y < scratch.outputHeight; y++) {
      mass += scratch.coverage[y * scratch.outputStride + x] / 255;
    }
    masses.push(mass);
  }
  return masses;
}

function groupMeans(values: readonly number[], size: number): number[] {
  const result: number[] = [];
  for (let start = 0; start < values.length; start += size) {
    let total = 0;
    for (let offset = 0; offset < size; offset++) total += values[start + offset];
    result.push(total / size);
  }
  return result;
}
