import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { EmissionField } from './emission-field';

function fixture(width = 21, height = 21): { field: EmissionField; materials: Uint8Array } {
  const emissive = new Uint8Array(256);
  emissive[Material.PHOT] = 1;
  emissive[Material.ELEC] = 1;
  const colors = new Uint8Array(256 * 3);
  colors.set([250, 245, 180], Material.PHOT * 3);
  colors.set([80, 210, 255], Material.ELEC * 3);
  return { field: new EmissionField(width, height, emissive, colors), materials: new Uint8Array(width * height) };
}

function alphaAt(field: EmissionField, x: number, y: number): number {
  return field.bytes[(y * field.width + x) * 4 + 3];
}

describe('emission field', () => {
  it('tracks whether the packed field contains useful light', () => {
    const { field, materials } = fixture();
    field.update(materials);
    expect(field.hasLight).toBe(false);
    expect(field.mayLightWorldCell(10, 10)).toBe(false);
    materials[10 * 21 + 10] = Material.PHOT;
    field.update(materials);
    expect(field.hasLight).toBe(true);
    expect(field.mayLightWorldCell(10, 10)).toBe(true);
    // The conservative bilinear guard may admit the cell immediately outside
    // an active field bound, but it must reject the far side of the world.
    expect(field.mayLightWorldCell(20, 20)).toBe(false);
    materials.fill(Material.Empty);
    field.update(materials);
    expect(field.hasLight).toBe(false);
    expect(field.mayLightWorldCell(10, 10)).toBe(false);
  });

  it('widens sparse energy into a coloured falloff', () => {
    const { field, materials } = fixture();
    materials[10 * 21 + 10] = Material.PHOT;
    field.update(materials);
    expect(alphaAt(field, 3, 3)).toBeGreaterThan(alphaAt(field, 4, 3));
    expect(alphaAt(field, 4, 3)).toBeGreaterThan(alphaAt(field, 5, 3));
    expect(alphaAt(field, 5, 3)).toBeGreaterThan(0);
    expect(alphaAt(field, 6, 3)).toBe(0);
  });

  it('blends nearby energy colours and ignores ordinary matter', () => {
    const { field, materials } = fixture();
    materials[10 * 21 + 7] = Material.PHOT;
    materials[10 * 21 + 13] = Material.ELEC;
    materials[9 * 21 + 10] = Material.Water;
    field.update(materials);
    const middle = (3 * field.width + 3) * 4;
    expect(field.bytes[middle]).toBeGreaterThan(80);
    expect(field.bytes[middle + 2]).toBeGreaterThan(180);
    expect(field.bytes[middle + 3]).toBeGreaterThan(0);
  });

  it('stays within its explicit 612x384 CPU allocation budget', () => {
    const { field } = fixture(612, 384);
    expect(field.allocatedByteLength).toBe(1_357_824);
    expect(field.allocatedByteLength).toBeLessThan(1.5 * 1024 * 1024);
  });
});
