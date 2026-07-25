import { describe, expect, it } from 'vitest';
import { ALL_MATERIALS, Material } from '../shared/materials';
import {
  CANVAS_CONTOUR_CHUNK_SIZE,
  CANVAS_CONTOUR_GEOMETRY_LOOKUP_BYTES,
  CANVAS_CONTOUR_OUTPUT_SCALE,
  CanvasPhaseContourScratch,
  applyCanvasLiquidFresnelShell,
  canvasPhaseContactTone,
  type CanvasPhaseContourInput,
} from './canvas-phase-contour';
import { RenderOptics } from './render-optics';
import { LiquidDensityField } from './liquid-density-field';
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

function contourSignature(scratch: CanvasPhaseContourScratch): string {
  let hash = 0x811c9dc5;
  for (const bytes of [scratch.pixels, scratch.coverage, scratch.ownerMaterials]) {
    for (const byte of bytes) hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function contourOutputsEqual(
  left: CanvasPhaseContourScratch,
  right: CanvasPhaseContourScratch,
): boolean {
  if (left.outputWidth !== right.outputWidth || left.outputHeight !== right.outputHeight) return false;
  for (let y = 0; y < left.outputHeight; y++) for (let x = 0; x < left.outputWidth; x++) {
    const leftOutput = y * left.outputStride + x;
    const rightOutput = y * right.outputStride + x;
    if (left.coverage[leftOutput] !== right.coverage[rightOutput]
      || left.ownerMaterials[leftOutput] !== right.ownerMaterials[rightOutput]) return false;
    const leftPixel = leftOutput * 4;
    const rightPixel = rightOutput * 4;
    for (let channel = 0; channel < 4; channel++) {
      if (left.pixels[leftPixel + channel] !== right.pixels[rightPixel + channel]) return false;
    }
  }
  return true;
}

function liquidField(value: Fixture): Uint8Array {
  const field = new LiquidDensityField(
    value.input.worldWidth, value.input.worldHeight,
    lookups.liquidByMaterial, lookups.colorByMaterial,
  );
  field.update(value.materials);
  return field.bytes;
}

describe('Canvas 2x phase contour scratch', () => {
  it('pins complete mixed-phase output across every scale and powder style', () => {
    const value = fixture(17, 13);
    const materials = [
      Material.Empty, Material.Metal, Material.Glass, Material.Sand,
      Material.Clay, Material.Water, Material.Oil, Material.Smoke,
      Material.Fire, Material.Plant,
    ] as const;
    for (let y = 0; y < value.input.worldHeight; y++) {
      for (let x = 0; x < value.input.worldWidth; x++) {
        const material = materials[(x * 5 + y * 7 + Math.floor(x / 3)) % materials.length];
        if (material !== Material.Empty) paint(value, x, y, material);
        const index = y * value.input.worldWidth + x;
        value.stability[index] = (x * 31 + y * 47) & 255;
        if ((x + y * 3) % 29 === 0) value.walls[index] = 1;
      }
    }
    for (let y = 6; y < value.input.worldHeight; y++) {
      for (let x = 1; x <= 8; x++) {
        paint(value, x, y, Material.Sand);
        const index = y * value.input.worldWidth + x;
        value.stability[index] = 255;
        value.walls[index] = 0;
      }
    }
    const powder = new PowderSurfaceField(
      value.input.worldWidth, value.input.worldHeight, lookups.styleBytes,
    );
    powder.update(value.materials, value.stability, value.walls);
    const signatures: Record<string, string> = {};
    for (const scale of [1, 2, 4, 8] as const) {
      for (const powderStyle of ['grains', 'local', 'smooth'] as const) {
        const scratch = new CanvasPhaseContourScratch(scale);
        scratch.rasterize({ ...value.input, powderStyle, powderSurface: powder.bytes });
        signatures[`${scale}-${powderStyle}`] = contourSignature(scratch);
      }
    }
    expect(signatures).toEqual({
      '1-grains': 'c912c4b1',
      '1-local': '1cc9387d',
      '1-smooth': '3eb8e906',
      '2-grains': 'af6d5941',
      '2-local': 'a50b1c45',
      '2-smooth': 'e4053a49',
      '4-grains': '88dcd447',
      '4-local': 'f23096fb',
      '4-smooth': '3812b4d0',
      '8-grains': 'b2fef6b7',
      '8-local': '2419d011',
      '8-smooth': 'b1854d1a',
    });
  });

  it('owns one bounded 32x32 chunk, one-cell halo, and stable output buffers', () => {
    expect(CANVAS_CONTOUR_GEOMETRY_LOOKUP_BYTES).toBe(11_855);
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

  it('preserves transparent RGB payloads while skipping only true zero empty cells', () => {
    const value = fixture(1, 1);
    value.pixels.set([7, 11, 13, 0]);
    const scratch = new CanvasPhaseContourScratch(1);
    scratch.rasterize(value.input);
    expect(rgbaAt(scratch, 0, 0)).toEqual([7, 11, 13, 0]);
  });

  it('rejects reconstructed LIFE dead-cell coverage without rejecting a powder owner', () => {
    const deadCell = fixture(3, 3);
    paint(deadCell, 1, 0, Material.LIFE_GOL);
    paint(deadCell, 0, 1, Material.LIFE_GOL);
    paint(deadCell, 2, 1, Material.LIFE_GOL);
    paint(deadCell, 1, 2, Material.LIFE_GOL);
    const deadIndex = (1 * deadCell.input.worldWidth + 1) * 4;
    const lifeColor = Material.LIFE_GOL * 3;
    deadCell.pixels.set([
      lookups.colorByMaterial[lifeColor],
      lookups.colorByMaterial[lifeColor + 1],
      lookups.colorByMaterial[lifeColor + 2],
      224,
    ], deadIndex);

    const deadScratch = new CanvasPhaseContourScratch();
    deadScratch.rasterize(deadCell.input);
    for (let subY = 0; subY < deadScratch.outputScale; subY++) {
      for (let subX = 0; subX < deadScratch.outputScale; subX++) {
        const output = (deadScratch.outputScale + subY) * deadScratch.outputStride
          + deadScratch.outputScale + subX;
        expect(deadScratch.coverage[output]).toBe(0);
        expect(deadScratch.ownerMaterials[output]).toBe(Material.Empty);
        expect(deadScratch.pixels[output * 4 + 3]).toBe(0);
      }
    }

    const powderProjection = fixture(3, 3);
    paint(powderProjection, 0, 2, Material.Sand);
    paint(powderProjection, 1, 2, Material.Sand);
    paint(powderProjection, 2, 2, Material.Sand);
    powderProjection.pixels.set([
      lookups.colorByMaterial[lifeColor],
      lookups.colorByMaterial[lifeColor + 1],
      lookups.colorByMaterial[lifeColor + 2],
      224,
    ], deadIndex);
    const powderScratch = new CanvasPhaseContourScratch();
    powderScratch.rasterize({ ...powderProjection.input, powderStyle: 'local' });
    let ownedPowderSamples = 0;
    for (let subY = 0; subY < powderScratch.outputScale; subY++) {
      for (let subX = 0; subX < powderScratch.outputScale; subX++) {
        const output = (powderScratch.outputScale + subY) * powderScratch.outputStride
          + powderScratch.outputScale + subX;
        if (powderScratch.coverage[output] !== 0
          && powderScratch.ownerMaterials[output] === Material.Sand) ownedPowderSamples++;
      }
    }
    expect(ownedPowderSamples).toBeGreaterThan(0);
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

  it('adds a signed family-aware solid contour bevel without changing support or interiors', () => {
    const value = fixture(7, 7);
    for (let y = 1; y <= 5; y++) for (let x = 1; x <= 5; x++) {
      paint(value, x, y, Material.Metal);
    }
    const flat = new CanvasPhaseContourScratch();
    const bevelled = new CanvasPhaseContourScratch();
    flat.rasterize({
      ...value.input, surfaceContourLighting: false,
      solidContactDepth: false, solidCurvatureDepth: false,
    });
    bevelled.rasterize({
      ...value.input, surfaceContourLighting: true,
      solidContactDepth: false, solidCurvatureDepth: false,
    });

    let positive = 0;
    let negative = 0;
    let peak = 0;
    for (let y = 0; y < bevelled.outputHeight; y++) for (let x = 0; x < bevelled.outputWidth; x++) {
      const output = y * bevelled.outputStride + x;
      const pixel = output * 4;
      expect(bevelled.coverage[output]).toBe(flat.coverage[output]);
      expect(bevelled.ownerMaterials[output]).toBe(flat.ownerMaterials[output]);
      expect(bevelled.pixels[pixel + 3]).toBe(flat.pixels[pixel + 3]);
      const delta = bevelled.pixels[pixel] - flat.pixels[pixel];
      if (delta > 0) positive++;
      if (delta < 0) negative++;
      peak = Math.max(peak, Math.abs(delta));
    }
    expect(positive).toBeGreaterThan(0);
    expect(negative).toBeGreaterThan(0);
    expect(peak).toBeGreaterThanOrEqual(2);
    expect(peak).toBeLessThanOrEqual(12);
    for (let y = 6; y <= 7; y++) for (let x = 6; x <= 7; x++) {
      expect(rgbaAt(bevelled, x, y)).toEqual(rgbaAt(flat, x, y));
    }

    bevelled.rasterize({
      ...value.input, surfaceContourLighting: false,
      solidContactDepth: false, solidCurvatureDepth: false,
    });
    expect(bevelled.pixels).toEqual(flat.pixels);
    expect(bevelled.coverage).toEqual(flat.coverage);
    expect(bevelled.ownerMaterials).toEqual(flat.ownerMaterials);
  });

  it('keeps the solid contour bevel off unlike seams, traits, emissive matter, and non-liquid phases', () => {
    const seam = fixture(7, 5);
    for (let y = 1; y <= 3; y++) for (let x = 1; x <= 5; x++) {
      paint(seam, x, y, x <= 2 ? Material.Metal : Material.Glass);
    }
    const seamFlat = new CanvasPhaseContourScratch();
    const seamBevelled = new CanvasPhaseContourScratch();
    seamFlat.rasterize({
      ...seam.input, surfaceContourLighting: false,
      solidContactDepth: false, solidCurvatureDepth: false,
    });
    seamBevelled.rasterize({
      ...seam.input, surfaceContourLighting: true,
      solidContactDepth: false, solidCurvatureDepth: false,
    });
    for (let y = 4; y <= 5; y++) for (let x = 3; x <= 8; x++) {
      expect(rgbaAt(seamBevelled, x, y), `unlike seam ${x},${y}`).toEqual(
        rgbaAt(seamFlat, x, y),
      );
    }

    for (const [material, byte] of [
      [Material.Metal, 3],
      [Material.Metal, 2],
      [Material.Sand, -1],
      [Material.Smoke, -1],
      [Material.Fire, -1],
    ] as const) {
      const value = fixture(5, 5);
      for (let y = 1; y <= 3; y++) for (let x = 1; x <= 3; x++) paint(value, x, y, material);
      const styleBytes = lookups.styleBytes.slice();
      if (byte >= 0) styleBytes[material * 4 + byte] = 1;
      const off = new CanvasPhaseContourScratch();
      const on = new CanvasPhaseContourScratch();
      off.rasterize({ ...value.input, styleBytes, surfaceContourLighting: false });
      on.rasterize({ ...value.input, styleBytes, surfaceContourLighting: true });
      expect(on.pixels, `${material}/${byte} pixels`).toEqual(off.pixels);
      expect(on.coverage, `${material}/${byte} coverage`).toEqual(off.coverage);
      expect(on.ownerMaterials, `${material}/${byte} owners`).toEqual(off.ownerMaterials);
    }
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
      secondDifferenceEnergy(localProfile) * 0.93,
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

  it('adds chromatic depth only to deep stable Smooth powder without changing topology', () => {
    const scale = 4;
    const value = fixture(11, 11);
    for (let y = 3; y <= 9; y++) for (let x = 2; x <= 8; x++) {
      paint(value, x, y, Material.Sand);
    }
    const field = new PowderSurfaceField(11, 11, lookups.styleBytes);
    field.update(value.materials, value.stability, value.walls);
    const flat = new CanvasPhaseContourScratch(scale);
    flat.rasterize({
      ...value.input, powderSurface: field.bytes, powderStyle: 'smooth',
      surfaceContourLighting: false,
    });
    const chromatic = new CanvasPhaseContourScratch(scale);
    chromatic.rasterize({
      ...value.input, powderSurface: field.bytes, powderStyle: 'smooth',
      surfaceContourLighting: true,
    });

    expect(chromatic.coverage).toEqual(flat.coverage);
    expect(chromatic.ownerMaterials).toEqual(flat.ownerMaterials);
    let changed = 0;
    let chromaticPixels = 0;
    let peak = 0;
    for (let index = 0; index < chromatic.outputWidth * chromatic.outputHeight; index++) {
      const pixel = index * 4;
      expect(chromatic.pixels[pixel + 3]).toBe(flat.pixels[pixel + 3]);
      const differences = [0, 1, 2].map((channel) => (
        chromatic.pixels[pixel + channel] - flat.pixels[pixel + channel]
      ));
      if (differences.some((difference) => difference !== 0)) changed++;
      if (differences[0] !== differences[1] || differences[1] !== differences[2]) chromaticPixels++;
      peak = Math.max(peak, ...differences.map(Math.abs));
    }
    expect(changed).toBeGreaterThan(0);
    expect(chromaticPixels).toBeGreaterThan(0);
    expect(peak).toBeLessThanOrEqual(18);

    for (const style of ['grains', 'local'] as const) {
      const disabled = new CanvasPhaseContourScratch(scale);
      const enabled = new CanvasPhaseContourScratch(scale);
      disabled.rasterize({
        ...value.input, powderSurface: field.bytes, powderStyle: style,
        surfaceContourLighting: false,
      });
      enabled.rasterize({
        ...value.input, powderSurface: field.bytes, powderStyle: style,
        surfaceContourLighting: true,
      });
      expect(enabled.pixels).toEqual(disabled.pixels);
      expect(enabled.coverage).toEqual(disabled.coverage);
    }

    value.stability.fill(191);
    field.update(value.materials, value.stability, value.walls);
    const unsettledFlat = new CanvasPhaseContourScratch(scale);
    const unsettledLit = new CanvasPhaseContourScratch(scale);
    unsettledFlat.rasterize({
      ...value.input, powderSurface: field.bytes, powderStyle: 'smooth',
      surfaceContourLighting: false,
    });
    unsettledLit.rasterize({
      ...value.input, powderSurface: field.bytes, powderStyle: 'smooth',
      surfaceContourLighting: true,
    });
    expect(unsettledLit.pixels).toEqual(unsettledFlat.pixels);
    expect(unsettledLit.coverage).toEqual(unsettledFlat.coverage);
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

  it('preserves sealed multi-cell powder cavities in Smooth mode at every high-resolution scale', () => {
    const width = 12;
    const height = 12;
    const value = fixture(width, height);
    for (let y = 2; y <= 10; y++) for (let x = 2; x <= 9; x++) {
      if ((x === 5 || x === 6) && (y === 5 || y === 6)) continue;
      paint(value, x, y, Material.Clay);
    }
    const field = new PowderSurfaceField(width, height, lookups.styleBytes);
    field.update(value.materials, value.stability, value.walls);

    for (const scale of [2, 4, 8] as const) {
      const smooth = new CanvasPhaseContourScratch(scale);
      smooth.rasterize({
        ...value.input,
        powderSurface: field.bytes,
        powderExteriorAir: field.exteriorAirBytes,
        powderStyle: 'smooth',
      });

      for (let cellY = 5; cellY <= 6; cellY++) for (let cellX = 5; cellX <= 6; cellX++) {
        for (let subY = 0; subY < scale; subY++) for (let subX = 0; subX < scale; subX++) {
          const pore = (cellY * scale + subY) * smooth.outputStride
            + cellX * scale + subX;
          expect(smooth.coverage[pore], `${scale}x pore ${cellX},${cellY}`).toBe(0);
          expect(smooth.pixels[pore * 4 + 3], `${scale}x pore alpha ${cellX},${cellY}`).toBe(0);
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

  it('adds a bounded family-chromatic Fresnel shell without changing support or interiors', () => {
    const baseline = [80, 110, 140, 177];
    const lit = new Map<RenderOptics, number[]>();
    for (const optics of [RenderOptics.Aqueous, RenderOptics.Oily, RenderOptics.Corrosive]) {
      const sample = new Uint8ClampedArray(baseline);
      applyCanvasLiquidFresnelShell(sample, 0, 0.5, 1, 1, optics);
      expect(sample[3]).toBe(baseline[3]);
      expect(Array.from(sample.slice(0, 3))).not.toEqual(baseline.slice(0, 3));
      lit.set(optics, Array.from(sample.slice(0, 3), (channel, index) => channel - baseline[index]));
    }
    expect(lit.get(RenderOptics.Aqueous)![2]).toBeGreaterThan(lit.get(RenderOptics.Aqueous)![0]);
    expect(lit.get(RenderOptics.Oily)![0]).toBeGreaterThan(lit.get(RenderOptics.Oily)![2]);
    expect(lit.get(RenderOptics.Corrosive)![1]).toBeGreaterThan(lit.get(RenderOptics.Corrosive)![0]);

    const dense = new Uint8ClampedArray(baseline);
    applyCanvasLiquidFresnelShell(dense, 0, 1, 1, 1, RenderOptics.Aqueous);
    expect(Array.from(dense)).toEqual(baseline);
    const molten = new Uint8ClampedArray(baseline);
    applyCanvasLiquidFresnelShell(molten, 0, 0.5, 1, 1, RenderOptics.Molten);
    expect(Array.from(molten)).toEqual(baseline);

    for (const material of [
      Material.Water, Material.Oil, Material.Acid, Material.Lava,
      Material.LiquidNitrogen, Material.Mercury, Material.Soap, Material.MWAX,
    ]) {
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
        expect(maximumDelta, `${material} bounded rim`).toBeLessThanOrEqual(18);
      }
      for (let y = 6; y <= 7; y++) for (let x = 6; x <= 7; x++) {
        expect(rgbaAt(styled, x, y), `${material} dense interior ${x},${y}`).toEqual(
          rgbaAt(flat, x, y),
        );
      }
    }
  });

  it('separates a reflected outer lip from a family-coloured inner absorption shoulder', () => {
    const source = [80, 110, 140, 177] as const;
    const families = [
      { optics: RenderOptics.Aqueous, absorbed: 0, retained: 2, neutral: false },
      { optics: RenderOptics.Oily, absorbed: 2, retained: 0, neutral: false },
      { optics: RenderOptics.Corrosive, absorbed: 0, retained: 1, neutral: false },
      { optics: RenderOptics.CryogenicLiquid, absorbed: 0, retained: 2, neutral: false },
      { optics: RenderOptics.MetallicLiquid, absorbed: 2, retained: 0, neutral: true },
      { optics: RenderOptics.ViscousLiquid, absorbed: 0, retained: 2, neutral: false },
    ] as const;

    for (const { optics, absorbed, retained, neutral } of families) {
      const outer = new Uint8ClampedArray(source);
      applyCanvasLiquidFresnelShell(outer, 0, 0.28, 0.48, 0.68, optics);
      expect(Math.max(...Array.from(outer.slice(0, 3), (value, channel) => (
        value - source[channel]
      ))), `${optics} reflected lip`).toBeGreaterThan(0);

      const innerSource = [220, 220, 220, 177] as const;
      const inner = new Uint8ClampedArray(innerSource);
      applyCanvasLiquidFresnelShell(inner, 0, 0.78, -0.48, -0.68, optics);
      const innerDelta = Array.from(inner.slice(0, 3), (value, channel) => (
        value - innerSource[channel]
      ));
      expect(innerDelta[absorbed], `${optics} absorption`).toBeLessThan(0);
      if (neutral) {
        expect(Math.max(...innerDelta) - Math.min(...innerDelta)).toBeLessThanOrEqual(1);
      } else {
        expect(innerDelta[absorbed], `${optics} spectral retention`).toBeLessThan(
          innerDelta[retained],
        );
      }
      expect(inner[3]).toBe(innerSource[3]);
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

  it('coheres connected exact-species air shores without widening or losing authored centres', () => {
    const value = fixture(9, 9);
    for (let y = 2; y <= 6; y++) for (let x = 2; x <= 6; x++) {
      // One stepped corner makes the field/categorical fringe visibly differ.
      if (x === 2 && y === 2) continue;
      paint(value, x, y, Material.Water);
    }
    const field = liquidField(value);
    for (const scale of [1, 2, 4, 8] as const) {
      const cohesive = new CanvasPhaseContourScratch(scale);
      const categorical = new CanvasPhaseContourScratch(scale);
      cohesive.rasterize({ ...value.input, liquidField: field });
      categorical.rasterize({
        ...value.input, liquidField: field, liquidSilhouetteCohesion: false,
      });

      expect(cohesive.ownerMaterials).toEqual(categorical.ownerMaterials);
      let reduced = 0;
      for (let y = 0; y < value.input.worldHeight * scale; y++) {
        for (let x = 0; x < value.input.worldWidth * scale; x++) {
          const output = y * cohesive.outputStride + x;
          expect(cohesive.coverage[output], `${scale}x ${x},${y} no widening`).toBeLessThanOrEqual(
            categorical.coverage[output],
          );
          if (cohesive.coverage[output] < categorical.coverage[output]) reduced++;
          const pixel = output * 4;
          expect(
            Array.from(cohesive.pixels.slice(pixel, pixel + 3)),
            `${scale}x ${x},${y} RGB`,
          ).toEqual(Array.from(categorical.pixels.slice(pixel, pixel + 3)));
          if (cohesive.coverage[output] > 0) {
            const cellX = Math.floor(x / scale);
            const cellY = Math.floor(y / scale);
            expect(value.materials[cellY * value.input.worldWidth + cellX]).toBe(Material.Water);
            expect(cohesive.ownerMaterials[output]).toBe(Material.Water);
          }
        }
      }
      if (scale === 1) expect(reduced).toBe(0);
      else expect(reduced, `${scale}x cohesive fringe`).toBeGreaterThan(0);

      for (let cellY = 0; cellY < value.input.worldHeight; cellY++) {
        for (let cellX = 0; cellX < value.input.worldWidth; cellX++) {
          if (value.materials[cellY * value.input.worldWidth + cellX] !== Material.Water) continue;
          let maximum = 0;
          for (let subY = 0; subY < scale; subY++) for (let subX = 0; subX < scale; subX++) {
            const output = (cellY * scale + subY) * cohesive.outputStride
              + cellX * scale + subX;
            maximum = Math.max(maximum, cohesive.coverage[output]);
          }
          expect(maximum, `${scale}x authored centre ${cellX},${cellY}`).toBeGreaterThan(127);
        }
      }

      // The fully surrounded centre is an exact dense-core no-op.
      for (let subY = 0; subY < scale; subY++) for (let subX = 0; subX < scale; subX++) {
        const output = (4 * scale + subY) * cohesive.outputStride + 4 * scale + subX;
        expect(cohesive.coverage[output]).toBe(categorical.coverage[output]);
        expect(cohesive.pixels.slice(output * 4, output * 4 + 4)).toEqual(
          categorical.pixels.slice(output * 4, output * 4 + 4),
        );
      }
    }
  });

  it('keeps isolated, one-axis, decorated, molten, and contacted liquids categorical at every scale', () => {
    const cases: Array<{ value: Fixture; styleBytes?: Uint8Array; target?: readonly [number, number] }> = [];

    const isolated = fixture(7, 7);
    paint(isolated, 3, 3, Material.Water);
    cases.push({ value: isolated });

    const sparseRow = fixture(7, 7);
    for (let x = 1; x <= 5; x++) paint(sparseRow, x, 3, Material.Water);
    cases.push({ value: sparseRow });

    const molten = fixture(7, 7);
    for (let y = 2; y <= 4; y++) for (let x = 2; x <= 4; x++) {
      paint(molten, x, y, Material.Lava);
    }
    cases.push({ value: molten });

    for (const channel of [2, 3] as const) {
      const decorated = fixture(7, 7);
      for (let y = 2; y <= 4; y++) for (let x = 2; x <= 4; x++) {
        paint(decorated, x, y, Material.Water);
      }
      const styleBytes = lookups.styleBytes.slice();
      styleBytes[Material.Water * 4 + channel] = 255;
      cases.push({ value: decorated, styleBytes });
    }

    for (const contact of [Material.Oil, Material.Metal, Material.Sand] as const) {
      const contacted = fixture(7, 7);
      for (let y = 2; y <= 4; y++) for (let x = 2; x <= 4; x++) {
        paint(contacted, x, y, Material.Water);
      }
      paint(contacted, 3, 2, contact);
      cases.push({ value: contacted, target: [3, 3] });
    }
    const walled = fixture(7, 7);
    for (let y = 2; y <= 4; y++) for (let x = 2; x <= 4; x++) {
      paint(walled, x, y, Material.Water);
    }
    walled.walls[2 * 7 + 3] = 1;
    cases.push({ value: walled, target: [3, 3] });

    for (const scale of [1, 2, 4, 8] as const) for (const testCase of cases) {
      const field = liquidField(testCase.value);
      const cohesive = new CanvasPhaseContourScratch(scale);
      const categorical = new CanvasPhaseContourScratch(scale);
      const common = {
        ...testCase.value.input,
        ...(testCase.styleBytes ? { styleBytes: testCase.styleBytes } : {}),
        liquidField: field,
      };
      cohesive.rasterize(common);
      categorical.rasterize({ ...common, liquidSilhouetteCohesion: false });
      if (!testCase.target) {
        expect(contourOutputsEqual(cohesive, categorical)).toBe(true);
      } else {
        const [cellX, cellY] = testCase.target;
        for (let subY = 0; subY < scale; subY++) for (let subX = 0; subX < scale; subX++) {
          const output = (cellY * scale + subY) * cohesive.outputStride
            + cellX * scale + subX;
          expect(cohesive.coverage[output]).toBe(categorical.coverage[output]);
          expect(cohesive.ownerMaterials[output]).toBe(categorical.ownerMaterials[output]);
          expect(cohesive.pixels.slice(output * 4, output * 4 + 4)).toEqual(
            categorical.pixels.slice(output * 4, output * 4 + 4),
          );
        }
      }
    }
  });

  it('grounds liquid/matter contacts with bounded RGB-only bipolar light', () => {
    expect(canvasPhaseContactTone(1, 1, 0)).toBe(0);
    expect(canvasPhaseContactTone(0.5, -1, -1)).toBeGreaterThan(0);
    expect(canvasPhaseContactTone(0.5, 1, 1)).toBeLessThan(0);

    const value = fixture(7, 5);
    for (let y = 1; y <= 3; y++) for (let x = 1; x <= 5; x++) {
      paint(value, x, y, x <= 3 ? Material.Water : Material.Metal);
    }
    const lit = new CanvasPhaseContourScratch();
    const flat = new CanvasPhaseContourScratch();
    const repeatedFlat = new CanvasPhaseContourScratch();
    lit.rasterize(value.input);
    flat.rasterize({ ...value.input, phaseContactLighting: false });
    repeatedFlat.rasterize({ ...value.input, phaseContactLighting: false });
    expect(repeatedFlat.pixels).toEqual(flat.pixels);

    let brighter = 0;
    let darker = 0;
    let maximumDelta = 0;
    for (let y = 0; y < value.input.worldHeight * lit.outputScale; y++) {
      for (let x = 0; x < value.input.worldWidth * lit.outputScale; x++) {
        const output = y * lit.outputStride + x;
        expect(lit.coverage[output], `${x},${y} coverage`).toBe(flat.coverage[output]);
        expect(lit.ownerMaterials[output], `${x},${y} owner`).toBe(flat.ownerMaterials[output]);
        const pixel = output * 4;
        expect(lit.pixels[pixel + 3], `${x},${y} alpha`).toBe(flat.pixels[pixel + 3]);
        for (let channel = 0; channel < 3; channel++) {
          const delta = lit.pixels[pixel + channel] - flat.pixels[pixel + channel];
          if (delta > 0) brighter++;
          if (delta < 0) darker++;
          maximumDelta = Math.max(maximumDelta, Math.abs(delta));
        }
      }
    }
    expect(brighter).toBeGreaterThan(0);
    expect(darker).toBeGreaterThan(0);
    expect(maximumDelta).toBeLessThanOrEqual(6);
  });

  it('rejects air, same-phase seams, decoration, and moving powder from phase-contact light', () => {
    const expectNoPhaseContact = (value: Fixture, styleBytes = lookups.styleBytes): void => {
      const lit = new CanvasPhaseContourScratch();
      const flat = new CanvasPhaseContourScratch();
      lit.rasterize({ ...value.input, styleBytes });
      flat.rasterize({ ...value.input, styleBytes, phaseContactLighting: false });
      expect(lit.pixels).toEqual(flat.pixels);
    };

    const air = fixture();
    paint(air, 2, 2, Material.Water);
    paint(air, 2, 3, Material.Water);
    expectNoPhaseContact(air);

    const liquidSeam = fixture();
    paint(liquidSeam, 2, 2, Material.Water);
    paint(liquidSeam, 3, 2, Material.Oil);
    expectNoPhaseContact(liquidSeam);

    const decorated = fixture();
    paint(decorated, 2, 2, Material.Water);
    paint(decorated, 3, 2, Material.Metal);
    const decoratedStyle = lookups.styleBytes.slice();
    decoratedStyle[Material.Metal * 4 + 3] = 1;
    expectNoPhaseContact(decorated, decoratedStyle);

    const movingPowder = fixture();
    paint(movingPowder, 2, 2, Material.Sand);
    paint(movingPowder, 3, 2, Material.Water);
    movingPowder.stability[2 * movingPowder.input.worldWidth + 2] = 0;
    expectNoPhaseContact(movingPowder);

    const settledPowder = fixture();
    paint(settledPowder, 2, 2, Material.Sand);
    paint(settledPowder, 2, 3, Material.Sand);
    paint(settledPowder, 3, 2, Material.Water);
    paint(settledPowder, 3, 3, Material.Water);
    const lit = new CanvasPhaseContourScratch();
    const flat = new CanvasPhaseContourScratch();
    lit.rasterize(settledPowder.input);
    flat.rasterize({ ...settledPowder.input, phaseContactLighting: false });
    expect(lit.pixels).not.toEqual(flat.pixels);
    expect(lit.coverage).toEqual(flat.coverage);
    expect(lit.ownerMaterials).toEqual(flat.ownerMaterials);
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
