import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { AtmosphereField } from './atmosphere-field';

function fixture(width = 20, height = 20): { field: AtmosphereField; materials: Uint8Array } {
  const gas = new Uint8Array(256);
  gas[Material.Smoke] = 1;
  gas[Material.Oxygen] = 1;
  const colors = new Uint8Array(256 * 3);
  colors.set([160, 165, 172], Material.Smoke * 3);
  colors.set([90, 155, 235], Material.Oxygen * 3);
  return { field: new AtmosphereField(width, height, gas, colors), materials: new Uint8Array(width * height) };
}

function alphaAt(field: AtmosphereField, x: number, y: number): number {
  return field.bytes[(y * field.width + x) * 4 + 3];
}

describe('atmosphere field', () => {
  it('stays within its explicit 612x384 CPU allocation budget', () => {
    const { field } = fixture(612, 384);
    expect(field.allocatedByteLength).toBe(3_055_104);
    expect(field.allocatedByteLength).toBeLessThan(3 * 1024 * 1024);
  });

  it('widens a sparse gas cell into a soft bounded volume', () => {
    const { field, materials } = fixture();
    materials[10 * 20 + 10] = Material.Smoke;
    field.update(materials);

    expect(alphaAt(field, 5, 5)).toBeGreaterThan(alphaAt(field, 6, 5));
    expect(alphaAt(field, 6, 5)).toBeGreaterThan(alphaAt(field, 7, 5));
    expect(alphaAt(field, 7, 5)).toBeGreaterThan(0);
    expect(alphaAt(field, 8, 5)).toBe(0);
  });

  it('merges nearby sparse gas cells and blends their colour', () => {
    const { field, materials } = fixture();
    materials[10 * 20 + 8] = Material.Smoke;
    materials[10 * 20 + 12] = Material.Oxygen;
    field.update(materials);

    const middle = (5 * field.width + 5) * 4;
    expect(field.bytes[middle + 3]).toBeGreaterThan(0);
    expect(field.bytes[middle]).toBeGreaterThan(90);
    expect(field.bytes[middle + 2]).toBeGreaterThan(172);
  });

  it('ignores liquids and powders', () => {
    const { field, materials } = fixture();
    materials[10 * 20 + 10] = Material.Water;
    materials[10 * 20 + 11] = Material.Sand;
    field.update(materials);
    expect(field.bytes.some(Boolean)).toBe(false);
  });
});
