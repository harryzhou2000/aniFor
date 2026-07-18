import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { LiquidDensityField } from './liquid-density-field';

function fixture(width = 9, height = 9): { field: LiquidDensityField; materials: Uint8Array } {
  const liquid = new Uint8Array(256);
  liquid[Material.Water] = 1;
  liquid[Material.Oil] = 1;
  return { field: new LiquidDensityField(width, height, liquid), materials: new Uint8Array(width * height) };
}

function densityAt(field: LiquidDensityField, x: number, y: number): number {
  return field.bytes[(y * field.width + x) * 4];
}

describe('liquid density field', () => {
  it('stays within its explicit 612x384 CPU allocation budget', () => {
    const { field } = fixture(612, 384);
    expect(field.allocatedByteLength).toBe(3_760_128);
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

  it('bridges a one-cell gap without creating a gas-like wide halo', () => {
    const { field, materials } = fixture();
    materials[4 * 9 + 3] = Material.Water;
    materials[4 * 9 + 5] = Material.Oil;
    field.update(materials);
    expect(densityAt(field, 4, 4)).toBeGreaterThan(densityAt(field, 2, 4));
    expect(densityAt(field, 1, 4)).toBe(0);
  });

  it('clears stale density and ignores gas', () => {
    const { field, materials } = fixture();
    materials[4 * 9 + 4] = Material.Water;
    field.update(materials);
    materials.fill(Material.Smoke);
    field.update(materials);
    expect(field.bytes.some((value, index) => index % 4 === 0 && value !== 0)).toBe(false);
  });
});
