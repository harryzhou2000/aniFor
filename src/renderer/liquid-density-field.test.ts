import { describe, expect, it } from 'vitest';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { LiquidDensityField } from './liquid-density-field';
import { createRenderLookups } from './render-field-set';
import { RenderOptics } from './render-optics';

function fixture(width = 9, height = 9): { field: LiquidDensityField; materials: Uint8Array } {
  const lookup = createRenderLookups(ALL_MATERIALS);
  return {
    field: new LiquidDensityField(width, height, lookup.liquidByMaterial, lookup.paletteBytes),
    materials: new Uint8Array(width * height),
  };
}

function densityAt(field: LiquidDensityField, x: number, y: number): number {
  return field.bytes[(y * field.width + x) * 4 + 3];
}

function colorAt(field: LiquidDensityField, x: number, y: number): number[] {
  const offset = (y * field.width + x) * 4;
  return Array.from(field.bytes.slice(offset, offset + 3));
}

function opticsAt(field: LiquidDensityField, x: number, y: number): number {
  return field.opticsBytes[y * field.width + x];
}

describe('liquid density field', () => {
  it('stays within its explicit 612x384 CPU allocation budget', () => {
    const { field } = fixture(612, 384);
    expect(field.allocatedByteLength).toBe(3_995_400);
    expect(field.allocatedByteLength).toBeLessThan(4 * 1024 * 1024);
  });

  it('stores bounded species-safe depth below an exposed liquid surface', () => {
    const { field, materials } = fixture(5, 50);
    for (let y = 1; y < 28; y++) materials[y * 5 + 2] = Material.Water;
    materials[12 * 5 + 2] = Material.Oil;
    for (let y = 0; y < 50; y++) materials[y * 5 + 3] = Material.Water;
    for (let y = 1; y < 18; y++) materials[y * 5 + 1] = Material.Water;
    materials[11 * 5 + 1] = Material.Wall;
    field.update(materials);
    const opticalDepth = new Uint8Array(materials.length);
    opticalDepth[0] = 173;
    field.writeVerticalOpticalDepth(materials, opticalDepth);

    expect(opticalDepth[0]).toBe(173);
    expect(opticalDepth[1 * 5 + 2]).toBe(0);
    expect(opticalDepth[2 * 5 + 2]).toBe(6);
    expect(opticalDepth[11 * 5 + 2]).toBe(60);
    expect(opticalDepth[12 * 5 + 2]).toBe(0);
    expect(opticalDepth[13 * 5 + 2]).toBe(0);
    expect(opticalDepth[27 * 5 + 2]).toBe(84);
    expect(opticalDepth[10 * 5 + 1]).toBe(54);
    expect(opticalDepth[11 * 5 + 1]).toBe(0);
    expect(opticalDepth[12 * 5 + 1]).toBe(0);
    expect(opticalDepth[43 * 5 + 3]).toBe(255);
    expect(opticalDepth[49 * 5 + 3]).toBe(255);
  });

  it('resets exact-liquid depth at co-located native walls without touching non-liquid bytes', () => {
    const { field, materials } = fixture(3, 7);
    const walls = new Uint8Array(materials.length);
    const opticalDepth = new Uint8Array(materials.length);
    for (let y = 0; y < 7; y++) materials[y * 3 + 1] = Material.Water;
    const preservedNonLiquid = 6 * 3;
    materials[preservedNonLiquid] = Material.Sand;
    opticalDepth[preservedNonLiquid] = 173;
    walls[3 * 3 + 1] = 6;

    field.writeVerticalOpticalDepth(materials, opticalDepth, walls);

    expect(opticalDepth[0 * 3 + 1]).toBe(0);
    expect(opticalDepth[1 * 3 + 1]).toBe(6);
    expect(opticalDepth[2 * 3 + 1]).toBe(12);
    expect(opticalDepth[3 * 3 + 1]).toBe(0);
    expect(opticalDepth[4 * 3 + 1]).toBe(0);
    expect(opticalDepth[5 * 3 + 1]).toBe(6);
    expect(opticalDepth[preservedNonLiquid]).toBe(173);
  });

  it('rejects a native wall plane whose size differs from the liquid grid', () => {
    const { field, materials } = fixture(3, 3);
    expect(() => field.writeVerticalOpticalDepth(
      materials, new Uint8Array(materials.length), new Uint8Array(materials.length - 1),
    )).toThrow('Liquid optical depth field size mismatch');
  });

  it('keeps a dense core and a tight one-cell edge', () => {
    const { field, materials } = fixture();
    materials[4 * 9 + 4] = Material.Water;
    field.update(materials);
    expect(densityAt(field, 4, 4)).toBeGreaterThan(230);
    expect(densityAt(field, 5, 4)).toBeGreaterThan(0);
    expect(densityAt(field, 6, 4)).toBe(0);
  });

  it('bridges a one-cell same-species gap without creating a gas-like wide halo', () => {
    const { field, materials } = fixture();
    materials[4 * 9 + 3] = Material.Water;
    materials[4 * 9 + 5] = Material.Water;
    field.update(materials);
    expect(densityAt(field, 4, 4)).toBeGreaterThan(densityAt(field, 2, 4));
    expect(densityAt(field, 1, 4)).toBe(0);
  });

  it('keeps the supported species color in the reconstructed halo', () => {
    const { field, materials } = fixture(3, 3);
    materials.set([
      Material.Water, Material.Empty, Material.Water,
      Material.Oil, Material.Empty, Material.Oil,
      Material.Water, Material.Empty, Material.Empty,
    ]);
    field.update(materials);
    expect(densityAt(field, 1, 1)).toBeGreaterThan(0);
    expect(colorAt(field, 1, 1)).toEqual([0x8f, 0x70, 0x40]);
    expect(opticsAt(field, 1, 1)).toBe(RenderOptics.Oily);
  });

  it.each([
    [Material.Water, RenderOptics.Aqueous],
    [Material.Oil, RenderOptics.Oily],
    [Material.Acid, RenderOptics.Corrosive],
    [Material.Lava, RenderOptics.Molten],
    [Material.LiquidNitrogen, RenderOptics.CryogenicLiquid],
    [Material.Mercury, RenderOptics.MetallicLiquid],
    [Material.Soap, RenderOptics.ViscousLiquid],
  ])('projects optical class %s into exact and uniquely supported cells', (material, optics) => {
    const { field, materials } = fixture(3, 3);
    materials[4] = material;
    field.update(materials);

    expect(opticsAt(field, 1, 1)).toBe(optics);
    expect(densityAt(field, 1, 0)).toBeGreaterThan(0);
    expect(opticsAt(field, 1, 0)).toBe(optics);
  });

  it('leaves an exact mixed-species tie transparent', () => {
    const { field, materials } = fixture(3, 3);
    materials.set([
      Material.Empty, Material.Water, Material.Empty,
      Material.Oil, Material.Empty, Material.Oil,
      Material.Empty, Material.Water, Material.Empty,
    ]);
    field.update(materials);
    expect(densityAt(field, 1, 1)).toBe(0);
    expect(colorAt(field, 1, 1)).toEqual([0, 0, 0]);
    expect(opticsAt(field, 1, 1)).toBe(0);
  });

  it('clears stale density and ignores gas', () => {
    const { field, materials } = fixture();
    materials[4 * 9 + 4] = Material.Water;
    field.update(materials);
    materials.fill(Material.Smoke);
    field.update(materials);
    expect(field.bytes.some(Boolean)).toBe(false);
    expect(field.opticsBytes.some(Boolean)).toBe(false);
  });
});
