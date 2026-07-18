import { describe, expect, it } from 'vitest';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { LiquidDensityField } from './liquid-density-field';
import { createLiquidSurfaceScratch, reconstructLiquidSurface } from './canvas-liquid-surface';
import { createRenderLookups } from './render-field-set';

describe('Canvas liquid surface reconstruction', () => {
  const lookup = createRenderLookups(ALL_MATERIALS);

  it('closes a surrounded liquid pinhole without changing physics cells', () => {
    const width = 3;
    const height = 3;
    const materials = new Uint8Array([
      Material.Water, Material.Water, Material.Water,
      Material.Water, Material.Empty, Material.Water,
      Material.Water, Material.Water, Material.Water,
    ]);
    const field = new LiquidDensityField(width, height, lookup.liquidByMaterial, lookup.colorByMaterial);
    field.update(materials);
    const pixels = seedLiquidPixels(materials);
    reconstruct(pixels, materials, field.bytes, width, height);
    expect(materials[4]).toBe(Material.Empty);
    expect(pixels[4 * 4 + 3]).toBe(210);
    expect(pixels[4 * 4 + 2]).toBeGreaterThan(pixels[4 * 4]);
  });

  it('does not paint over a hard particle inside liquid', () => {
    const width = 3;
    const height = 3;
    const materials = new Uint8Array(9).fill(Material.Water);
    materials[4] = Material.Sand;
    const field = new LiquidDensityField(width, height, lookup.liquidByMaterial, lookup.colorByMaterial);
    field.update(materials);
    const pixels = seedLiquidPixels(materials);
    reconstruct(pixels, materials, field.bytes, width, height);
    expect(Array.from(pixels.slice(16, 20))).toEqual([0, 0, 0, 0]);
  });

  it('does not turn an isolated droplet into a large blur', () => {
    const width = 5;
    const height = 5;
    const materials = new Uint8Array(width * height);
    materials[12] = Material.Water;
    const field = new LiquidDensityField(width, height, lookup.liquidByMaterial, lookup.colorByMaterial);
    field.update(materials);
    const pixels = seedLiquidPixels(materials);
    reconstruct(pixels, materials, field.bytes, width, height);
    const painted = Array.from({ length: materials.length }, (_, index) => pixels[index * 4 + 3]).filter(Boolean);
    expect(painted).toHaveLength(1);
  });

  it('ramps reconstructed shoreline alpha from zero instead of jumping opaque', () => {
    const materials = new Uint8Array(2);
    const density = new Uint8Array(8);
    density.set([70, 120, 190, 90], 0);
    density.set([70, 120, 190, 170], 4);
    const pixels = new Uint8ClampedArray(8);
    reconstruct(pixels, materials, density, 2, 1);
    expect(pixels[3]).toBeGreaterThan(0);
    expect(pixels[3]).toBeLessThan(96);
    expect(pixels[7]).toBeGreaterThan(pixels[3]);
  });

  it('prefers cardinal species support over diagonal liquid color', () => {
    const width = 3;
    const height = 3;
    const materials = new Uint8Array([
      Material.Water, Material.Empty, Material.Water,
      Material.Oil, Material.Empty, Material.Oil,
      Material.Water, Material.Empty, Material.Empty,
    ]);
    const field = new LiquidDensityField(width, height, lookup.liquidByMaterial, lookup.colorByMaterial);
    field.update(materials);
    const pixels = seedLiquidPixels(materials);
    for (let index = 0; index < materials.length; index++) {
      if (materials[index] === Material.Water) {
        pixels[index * 4] = 245;
        pixels[index * 4 + 1] = 16;
        pixels[index * 4 + 2] = 240;
      } else if (materials[index] === Material.Oil) {
        pixels[index * 4] = 72;
        pixels[index * 4 + 1] = 54;
        pixels[index * 4 + 2] = 28;
      }
    }
    reconstruct(pixels, materials, field.bytes, width, height);
    const center = 4 * 4;
    expect(pixels[center + 3]).toBeGreaterThan(0);
    expect(pixels[center]).toBeLessThan(120);
    expect(pixels[center + 2]).toBeLessThan(80);
  });

  it('leaves an exact mixed-species tie as a visible interface', () => {
    const width = 3;
    const height = 3;
    const materials = new Uint8Array([
      Material.Empty, Material.Water, Material.Empty,
      Material.Oil, Material.Empty, Material.Oil,
      Material.Empty, Material.Water, Material.Empty,
    ]);
    const field = new LiquidDensityField(width, height, lookup.liquidByMaterial, lookup.colorByMaterial);
    field.update(materials);
    const pixels = seedLiquidPixels(materials);
    reconstruct(pixels, materials, field.bytes, width, height);
    expect(pixels[4 * 4 + 3]).toBe(0);
  });

  it('inherits same-species styled pool colour instead of exposing a bright field pixel', () => {
    const width = 3;
    const height = 3;
    const materials = new Uint8Array(9).fill(Material.Water);
    materials[4] = Material.Empty;
    const field = new LiquidDensityField(width, height, lookup.liquidByMaterial, lookup.colorByMaterial);
    field.update(materials);
    const pixels = seedLiquidPixels(materials);
    for (let index = 0; index < materials.length; index++) {
      if (materials[index] !== Material.Water) continue;
      pixels[index * 4] = 24;
      pixels[index * 4 + 1] = 112;
      pixels[index * 4 + 2] = 164;
    }
    reconstruct(pixels, materials, field.bytes, width, height);
    expect(Array.from(pixels.slice(16, 19))).toEqual([24, 112, 164]);
  });

  it('falls back to styled diagonal donors when they alone cross the field threshold', () => {
    const width = 3;
    const height = 3;
    const materials = new Uint8Array([
      Material.Water, Material.Empty, Material.Water,
      Material.Empty, Material.Empty, Material.Empty,
      Material.Water, Material.Empty, Material.Water,
    ]);
    const field = new LiquidDensityField(width, height, lookup.liquidByMaterial, lookup.colorByMaterial);
    field.update(materials);
    const pixels = seedLiquidPixels(materials);
    for (let index = 0; index < materials.length; index++) {
      if (materials[index] !== Material.Water) continue;
      pixels[index * 4] = 31;
      pixels[index * 4 + 1] = 104;
      pixels[index * 4 + 2] = 158;
    }
    reconstruct(pixels, materials, field.bytes, width, height);
    expect(field.bytes[4 * 4 + 3]).toBeGreaterThanOrEqual(86);
    expect(Array.from(pixels.slice(16, 19))).toEqual([31, 104, 158]);
  });

  it('reduces colour variance only inside a strongly supported liquid body', () => {
    const width = 7;
    const height = 5;
    const materials = new Uint8Array(width * height).fill(Material.Water);
    const density = uniformDensity(materials.length, Material.Water);
    const pixels = seedLiquidPixels(materials);
    const center = (2 * width + 3) * 4;
    pixels.set([176, 224, 246, 220], center);
    const alphaBefore = pixels.filter((_, offset) => offset % 4 === 3);

    reconstruct(pixels, materials, density, width, height);

    expect(pixels[center]).toBeLessThan(176);
    expect(pixels[center]).toBeGreaterThan(lookup.colorByMaterial[Material.Water * 3]);
    expect(Math.abs(pixels[center] - lookup.colorByMaterial[Material.Water * 3]))
      .toBeLessThan(Math.abs(176 - lookup.colorByMaterial[Material.Water * 3]) * 0.75);
    expect(pixels.filter((_, offset) => offset % 4 === 3)).toEqual(alphaBefore);
  });

  it('keeps cohesion around a reconstructed dense pinhole', () => {
    const width = 7;
    const height = 5;
    const materials = new Uint8Array(width * height).fill(Material.Water);
    const hole = 2 * width + 3;
    materials[hole] = Material.Empty;
    const density = uniformDensity(materials.length, Material.Water);
    const pixels = seedLiquidPixels(materials);
    const probe = (hole + 1) * 4;
    pixels.set([178, 226, 247, 220], probe);

    reconstruct(pixels, materials, density, width, height);

    expect(pixels[hole * 4 + 3]).toBe(210);
    expect(pixels[probe]).toBeLessThan(178);
    expect(pixels[probe + 3]).toBe(220);
  });

  it('leaves a straight shoreline and a narrow stream exactly styled', () => {
    const width = 7;
    const height = 5;
    const materials = new Uint8Array(width * height);
    for (let y = 2; y < height; y++) for (let x = 0; x < width; x++) {
      materials[y * width + x] = Material.Water;
    }
    const density = densityFromMaterials(materials);
    const pixels = seedLiquidPixels(materials);
    const shoreline = (2 * width + 3) * 4;
    pixels.set([183, 231, 249, 220], shoreline);
    const before = Array.from(pixels.slice(shoreline, shoreline + 4));
    reconstruct(pixels, materials, density, width, height);
    expect(Array.from(pixels.slice(shoreline, shoreline + 4))).toEqual(before);

    const streamMaterials = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      streamMaterials[y * width + 2] = Material.Water;
      streamMaterials[y * width + 3] = Material.Water;
    }
    const streamDensity = densityFromMaterials(streamMaterials);
    const streamPixels = seedLiquidPixels(streamMaterials);
    const streamCenter = (2 * width + 2) * 4;
    streamPixels.set([172, 218, 241, 220], streamCenter);
    const streamBefore = Array.from(streamPixels.slice(streamCenter, streamCenter + 4));
    reconstruct(streamPixels, streamMaterials, streamDensity, width, height);
    expect(Array.from(streamPixels.slice(streamCenter, streamCenter + 4))).toEqual(streamBefore);
  });

  it('does not mix styled colour across a vertical Water/Oil boundary', () => {
    const width = 6;
    const height = 5;
    const materials = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      materials[y * width + x] = x < 3 ? Material.Water : Material.Oil;
    }
    const density = densityFromMaterials(materials);
    const pixels = seedLiquidPixels(materials);
    const waterEdge = (2 * width + 2) * 4;
    const oilEdge = (2 * width + 3) * 4;
    pixels.set([181, 228, 247, 220], waterEdge);
    pixels.set([121, 92, 49, 220], oilEdge);
    const before = Array.from(pixels.slice(waterEdge, oilEdge + 4));
    reconstruct(pixels, materials, density, width, height);
    expect(Array.from(pixels.slice(waterEdge, oilEdge + 4))).toEqual(before);
  });

  it('leaves low-alpha and trait-bearing liquid pixels unsmoothed', () => {
    const width = 5;
    const height = 5;
    const materials = new Uint8Array(width * height).fill(Material.Water);
    const density = uniformDensity(materials.length, Material.Water);
    const lowAlphaPixels = seedLiquidPixels(materials);
    const center = 12 * 4;
    lowAlphaPixels.set([180, 229, 248, 175], center);
    const lowAlphaBefore = Array.from(lowAlphaPixels.slice(center, center + 4));
    reconstruct(lowAlphaPixels, materials, density, width, height);
    expect(Array.from(lowAlphaPixels.slice(center, center + 4))).toEqual(lowAlphaBefore);

    const traitPixels = seedLiquidPixels(materials);
    traitPixels.set([180, 229, 248, 220], center);
    const traitBefore = Array.from(traitPixels);
    const style = new Uint8Array(lookup.styleBytes);
    style[Material.Water * 4 + 3] = 1;
    reconstruct(traitPixels, materials, density, width, height, style);
    expect(Array.from(traitPixels)).toEqual(traitBefore);
  });

  it('is mirror-symmetric and does not mutate material or density semantics', () => {
    const width = 7;
    const height = 5;
    const materials = new Uint8Array(width * height).fill(Material.Water);
    const density = uniformDensity(materials.length, Material.Water);
    const pixels = seedLiquidPixels(materials);
    const levels = [36, 58, 92, 168, 92, 58, 36];
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const pixel = (y * width + x) * 4;
      pixels[pixel] = levels[x];
      pixels[pixel + 1] = levels[x] + 48;
      pixels[pixel + 2] = levels[x] + 72;
    }
    const materialsBefore = new Uint8Array(materials);
    const densityBefore = new Uint8Array(density);
    reconstruct(pixels, materials, density, width, height);

    expect(materials).toEqual(materialsBefore);
    expect(density).toEqual(densityBefore);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const left = (y * width + x) * 4;
      const right = (y * width + (width - 1 - x)) * 4;
      expect(Array.from(pixels.slice(left, left + 4))).toEqual(Array.from(pixels.slice(right, right + 4)));
    }
  });

  function reconstruct(
    pixels: Uint8ClampedArray,
    materials: Uint8Array,
    density: Uint8Array,
    width: number,
    height: number,
    style = lookup.styleBytes,
  ): void {
    reconstructLiquidSurface(
      pixels, materials, density, lookup.liquidByMaterial, lookup.colorByMaterial, style,
      createLiquidSurfaceScratch(pixels, width), width, height,
    );
  }

  function uniformDensity(length: number, material: Material): Uint8Array {
    const density = new Uint8Array(length * 4);
    const color = material * 3;
    for (let index = 0; index < length; index++) {
      density[index * 4] = lookup.colorByMaterial[color];
      density[index * 4 + 1] = lookup.colorByMaterial[color + 1];
      density[index * 4 + 2] = lookup.colorByMaterial[color + 2];
      density[index * 4 + 3] = 255;
    }
    return density;
  }

  function densityFromMaterials(materials: Uint8Array): Uint8Array {
    const density = new Uint8Array(materials.length * 4);
    for (let index = 0; index < materials.length; index++) {
      const material = materials[index];
      if (!material) continue;
      const color = material * 3;
      density[index * 4] = lookup.colorByMaterial[color];
      density[index * 4 + 1] = lookup.colorByMaterial[color + 1];
      density[index * 4 + 2] = lookup.colorByMaterial[color + 2];
      density[index * 4 + 3] = 255;
    }
    return density;
  }

  function seedLiquidPixels(materials: Uint8Array): Uint8ClampedArray {
    const pixels = new Uint8ClampedArray(materials.length * 4);
    for (let index = 0; index < materials.length; index++) {
      if (!lookup.liquidByMaterial[materials[index]]) continue;
      const color = materials[index] * 3;
      pixels[index * 4] = lookup.colorByMaterial[color];
      pixels[index * 4 + 1] = lookup.colorByMaterial[color + 1];
      pixels[index * 4 + 2] = lookup.colorByMaterial[color + 2];
      pixels[index * 4 + 3] = 220;
    }
    return pixels;
  }
});
