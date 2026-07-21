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
  const styles = new Uint8Array(256);
  styles[Material.Smoke] = 1;
  styles[Material.Oxygen] = 4;
  return {
    field: new AtmosphereField(width, height, gas, colors, styles),
    materials: new Uint8Array(width * height),
  };
}

function alphaAt(field: AtmosphereField, x: number, y: number): number {
  return field.bytes[(y * field.width + x) * 4 + 3];
}

function styleAt(field: AtmosphereField, x: number, y: number): number {
  return field.styleBytes[y * field.width + x];
}

describe('atmosphere field', () => {
  it('stays within its explicit 612x384 CPU allocation budget', () => {
    const { field } = fixture(612, 384);
    expect(field.allocatedByteLength).toBe(3_172_680);
    expect(field.allocatedByteLength).toBeLessThan(3.1 * 1024 * 1024);
  });

  it('widens a sparse gas cell into a soft bounded volume', () => {
    const { field, materials } = fixture();
    materials[10 * 20 + 10] = Material.Smoke;
    field.update(materials);

    expect(alphaAt(field, 5, 5)).toBeGreaterThan(alphaAt(field, 6, 5));
    expect(alphaAt(field, 6, 5)).toBeGreaterThan(alphaAt(field, 7, 5));
    expect(alphaAt(field, 7, 5)).toBeGreaterThan(0);
    expect(alphaAt(field, 8, 5)).toBe(0);
    for (let index = 0; index < field.styleBytes.length; index++) {
      expect(field.styleBytes[index]).toBe(field.bytes[index * 4 + 3] > 0 ? 1 : 0);
    }
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

  it('propagates a deterministic dominant identity across the same soft support', () => {
    const { field, materials } = fixture();
    materials[10 * 20 + 8] = Material.Smoke;
    materials[10 * 20 + 9] = Material.Smoke;
    materials[10 * 20 + 12] = Material.Oxygen;
    field.update(materials);

    expect(styleAt(field, 4, 5)).toBe(1);
    expect(styleAt(field, 5, 5)).toBe(1);
    expect(styleAt(field, 6, 5)).toBe(4);
    for (let index = 0; index < field.styleBytes.length; index++) {
      if (field.bytes[index * 4 + 3] === 0) expect(field.styleBytes[index]).toBe(0);
    }
  });

  it('keeps an exactly balanced local mixture visually neutral', () => {
    const { field, materials } = fixture(8, 8);
    materials[2 * 8 + 2] = Material.Oxygen;
    materials[2 * 8 + 3] = Material.Smoke;
    field.update(materials);
    expect(styleAt(field, 1, 1)).toBe(0);
  });

  it('neutralizes categorical identity near non-gas contacts without changing volume', () => {
    const reference = fixture();
    const contacted = fixture();
    for (let y = 8; y <= 11; y++) for (let x = 4; x <= 11; x++) {
      reference.materials[y * 20 + x] = Material.Smoke;
      contacted.materials[y * 20 + x] = Material.Smoke;
    }
    for (let y = 8; y <= 11; y++) for (let x = 12; x <= 15; x++) {
      contacted.materials[y * 20 + x] = Material.Water;
    }

    reference.field.update(reference.materials);
    contacted.field.update(contacted.materials);

    expect(contacted.field.bytes).toEqual(reference.field.bytes);
    expect(styleAt(contacted.field, 3, 5)).toBe(1);
    expect(styleAt(contacted.field, 4, 5)).toBe(0);
    expect(styleAt(contacted.field, 5, 5)).toBe(0);
    expect(styleAt(contacted.field, 6, 5)).toBe(0);
  });

  it('treats native walls as categorical blockers without changing gas volume', () => {
    const reference = fixture();
    const walled = fixture();
    const walls = new Uint8Array(20 * 20);
    for (let y = 8; y <= 11; y++) for (let x = 4; x <= 11; x++) {
      reference.materials[y * 20 + x] = Material.Smoke;
      walled.materials[y * 20 + x] = Material.Smoke;
    }
    for (let y = 8; y <= 11; y++) for (let x = 12; x <= 15; x++) {
      walls[y * 20 + x] = 1;
    }

    reference.field.update(reference.materials);
    walled.field.update(walled.materials, walls);

    expect(walled.field.bytes).toEqual(reference.field.bytes);
    expect(styleAt(walled.field, 3, 5)).toBe(1);
    expect(styleAt(walled.field, 4, 5)).toBe(0);
    expect(walled.field.mayHaveIdentityNearWorldIndex(10 * 20 + 12)).toBe(true);
    expect(walled.field.mayHaveIdentityNearWorldIndex(-1)).toBe(false);
  });

  it('rejects a wall field with the wrong geometry', () => {
    const { field, materials } = fixture();
    expect(() => field.update(materials, new Uint8Array(materials.length - 1)))
      .toThrow('Atmosphere wall field size mismatch');
  });

  it('ignores liquids and powders', () => {
    const { field, materials } = fixture();
    materials[10 * 20 + 10] = Material.Water;
    materials[10 * 20 + 11] = Material.Sand;
    field.update(materials);
    expect(field.bytes.some(Boolean)).toBe(false);
  });
});
