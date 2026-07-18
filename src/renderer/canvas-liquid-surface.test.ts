import { describe, expect, it } from 'vitest';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { LiquidDensityField } from './liquid-density-field';
import { reconstructLiquidSurface } from './canvas-liquid-surface';
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
    reconstructLiquidSurface(pixels, materials, field.bytes, width, height);
    expect(materials[4]).toBe(Material.Empty);
    expect(pixels[4 * 4 + 3]).toBeGreaterThan(150);
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
    reconstructLiquidSurface(pixels, materials, field.bytes, width, height);
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
    reconstructLiquidSurface(pixels, materials, field.bytes, width, height);
    const painted = Array.from({ length: materials.length }, (_, index) => pixels[index * 4 + 3]).filter(Boolean);
    expect(painted).toHaveLength(1);
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
    reconstructLiquidSurface(pixels, materials, field.bytes, width, height);
    const center = 4 * 4;
    expect(pixels[center + 3]).toBeGreaterThan(0);
    expect(pixels[center]).toBeGreaterThan(pixels[center + 2]);
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
    reconstructLiquidSurface(pixels, materials, field.bytes, width, height);
    expect(pixels[4 * 4 + 3]).toBe(0);
  });

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
