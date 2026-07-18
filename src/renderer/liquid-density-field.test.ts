import { describe, expect, it } from 'vitest';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { LiquidDensityField } from './liquid-density-field';
import { createRenderLookups } from './render-field-set';

function fixture(width = 9, height = 9): { field: LiquidDensityField; materials: Uint8Array } {
  const lookup = createRenderLookups(ALL_MATERIALS);
  return {
    field: new LiquidDensityField(width, height, lookup.liquidByMaterial, lookup.colorByMaterial),
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

describe('liquid density field', () => {
  it('stays within its explicit 612x384 CPU allocation budget', () => {
    const { field } = fixture(612, 384);
    expect(field.allocatedByteLength).toBe(3_760_392);
    expect(field.allocatedByteLength).toBeLessThan(4 * 1024 * 1024);
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
  });

  it('clears stale density and ignores gas', () => {
    const { field, materials } = fixture();
    materials[4 * 9 + 4] = Material.Water;
    field.update(materials);
    materials.fill(Material.Smoke);
    field.update(materials);
    expect(field.bytes.some(Boolean)).toBe(false);
  });
});
