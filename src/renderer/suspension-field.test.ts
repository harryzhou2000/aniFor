import { describe, expect, it } from 'vitest';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { createRenderLookups } from './render-field-set';
import { LiquidDensityField } from './liquid-density-field';
import { SuspensionField } from './suspension-field';

const lookups = createRenderLookups(ALL_MATERIALS);

describe('SuspensionField', () => {
  it('uses half-resolution bounded storage and reports output changes', () => {
    const width = 7;
    const height = 5;
    const { materials, liquid } = submergedPowder(width, height, Material.Water, Material.Sand);
    const field = createField(width, height);

    expect(field.width).toBe(4);
    expect(field.height).toBe(3);
    expect(field.allocatedByteLength).toBe(field.width * field.height * 10);
    expect(field.update(materials, liquid.bytes)).toBe(true);
    expect(field.update(materials, liquid.bytes)).toBe(false);
    expect(field.hasSuspension).toBe(true);

    materials.fill(Material.Water);
    liquid.update(materials);
    expect(field.update(materials, liquid.bytes)).toBe(true);
    expect(field.hasSuspension).toBe(false);
    expect(field.bytes.some(Boolean)).toBe(false);
    expect(field.update(materials, liquid.bytes)).toBe(false);
  });

  it('preserves one exact powder hue across a tight one-half-cell cluster', () => {
    const width = 12;
    const height = 12;
    const { materials, liquid } = submergedPowder(width, height, Material.Water, Material.Sand, 5, 5);
    const field = createField(width, height);
    field.update(materials, liquid.bytes);
    const canonical = paletteColor(Material.Sand);
    const seedX = Math.floor(5 / 2);
    const seedY = Math.floor(5 / 2);
    let visible = 0;

    for (let y = 0; y < field.height; y++) for (let x = 0; x < field.width; x++) {
      const pixel = (y * field.width + x) * 4;
      if (field.bytes[pixel + 3] === 0) continue;
      visible++;
      expect(Array.from(field.bytes.slice(pixel, pixel + 3))).toEqual(canonical);
      expect(Math.abs(x - seedX)).toBeLessThanOrEqual(1);
      expect(Math.abs(y - seedY)).toBeLessThanOrEqual(1);
    }
    expect(visible).toBeGreaterThan(1);
    expect(visible).toBeLessThanOrEqual(9);
  });

  it('rejects dry, oily, molten, and ambiguous unlike-liquid support', () => {
    const width = 8;
    const height = 8;
    const dryMaterials = new Uint8Array(width * height);
    dryMaterials[3 * width + 3] = Material.Sand;
    const dryLiquid = liquidField(width, height, dryMaterials);
    expectUpdatedEmpty(createField(width, height), dryMaterials, dryLiquid.bytes);

    for (const liquidMaterial of [Material.Oil, Material.Lava]) {
      const scene = submergedPowder(width, height, liquidMaterial, Material.Sand);
      expectUpdatedEmpty(createField(width, height), scene.materials, scene.liquid.bytes);
    }

    const mixed = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      mixed[y * width + x] = x < 4 ? Material.Water : Material.Oil;
    }
    mixed[3 * width + 3] = Material.Sand;
    const mixedLiquid = liquidField(width, height, mixed);
    expectUpdatedEmpty(createField(width, height), mixed, mixedLiquid.bytes);
  });

  it('rejects trait-bearing, emissive, and non-granular powder identities', () => {
    const width = 8;
    const height = 8;
    const scene = submergedPowder(width, height, Material.Water, Material.Sand);
    const styleBytes = lookups.styleBytes.slice();
    const paletteBytes = lookups.paletteBytes.slice();
    const offset = Material.Sand * 4;

    styleBytes[offset + 3] = 1;
    expectUpdatedEmpty(
      new SuspensionField(width, height, styleBytes, paletteBytes),
      scene.materials, scene.liquid.bytes,
    );
    styleBytes[offset + 3] = 0;
    styleBytes[offset + 2] = 255;
    expectUpdatedEmpty(
      new SuspensionField(width, height, styleBytes, paletteBytes),
      scene.materials, scene.liquid.bytes,
    );
    styleBytes[offset + 2] = 0;
    paletteBytes[offset + 3] = 0;
    expectUpdatedEmpty(
      new SuspensionField(width, height, styleBytes, paletteBytes),
      scene.materials, scene.liquid.bytes,
    );
  });

  it('rejects native-wall cells and stale or weak liquid support bytes', () => {
    const width = 8;
    const height = 8;
    const powderX = 3;
    const powderY = 3;
    const scene = submergedPowder(
      width, height, Material.Water, Material.Sand, powderX, powderY,
    );
    const walls = new Uint8Array(width * height);
    walls[powderY * width + powderX] = 1;
    expectUpdatedEmpty(createField(width, height), scene.materials, scene.liquid.bytes, walls);

    walls.fill(0);
    const powderPixel = (powderY * width + powderX) * 4;
    scene.liquid.bytes[powderPixel + 3] = 63;
    expectUpdatedEmpty(createField(width, height), scene.materials, scene.liquid.bytes, walls);
    scene.liquid.bytes[powderPixel + 3] = 255;
    scene.liquid.bytes[powderPixel] ^= 1;
    expectUpdatedEmpty(createField(width, height), scene.materials, scene.liquid.bytes, walls);
  });

  it('keeps unlike powder clusters exclusive instead of blending their hues', () => {
    const width = 14;
    const height = 10;
    const materials = new Uint8Array(width * height).fill(Material.Water);
    materials[5 * width + 5] = Material.Sand;
    materials[5 * width + 8] = Material.Salt;
    const liquid = liquidField(width, height, materials);
    const field = createField(width, height);
    field.update(materials, liquid.bytes);
    const sand = paletteColor(Material.Sand).join(',');
    const salt = paletteColor(Material.Salt).join(',');
    let sandSeen = false;
    let saltSeen = false;

    for (let index = 0; index < field.width * field.height; index++) {
      const pixel = index * 4;
      if (field.bytes[pixel + 3] === 0) continue;
      const color = Array.from(field.bytes.slice(pixel, pixel + 3)).join(',');
      expect([sand, salt]).toContain(color);
      sandSeen ||= color === sand;
      saltSeen ||= color === salt;
    }
    expect(sandSeen).toBe(true);
    expect(saltSeen).toBe(true);
    expect(field.bytes[(2 * field.width + 3) * 4 + 3]).toBe(0);
  });

  it('validates semantic, liquid, and wall plane sizes', () => {
    const field = createField(4, 4);
    expect(() => field.update(new Uint8Array(15), new Uint8Array(64))).toThrow(
      'Suspension field size mismatch',
    );
    expect(() => field.update(new Uint8Array(16), new Uint8Array(63))).toThrow(
      'Suspension field size mismatch',
    );
    expect(() => field.update(
      new Uint8Array(16), new Uint8Array(64), new Uint8Array(15),
    )).toThrow('Suspension field size mismatch');
  });
});

function createField(width: number, height: number): SuspensionField {
  return new SuspensionField(width, height, lookups.styleBytes, lookups.paletteBytes);
}

function liquidField(width: number, height: number, materials: Uint8Array): LiquidDensityField {
  const field = new LiquidDensityField(
    width, height, lookups.liquidByMaterial, lookups.colorByMaterial,
  );
  field.update(materials);
  return field;
}

function submergedPowder(
  width: number,
  height: number,
  liquidMaterial: Material,
  powderMaterial: Material,
  powderX = Math.floor(width / 2),
  powderY = Math.floor(height / 2),
): { materials: Uint8Array; liquid: LiquidDensityField } {
  const materials = new Uint8Array(width * height).fill(liquidMaterial);
  materials[powderY * width + powderX] = powderMaterial;
  return { materials, liquid: liquidField(width, height, materials) };
}

function paletteColor(material: Material): number[] {
  const offset = material * 4;
  return Array.from(lookups.paletteBytes.slice(offset, offset + 3));
}

function expectUpdatedEmpty(
  field: SuspensionField,
  materials: Uint8Array,
  liquidBytes: Uint8Array,
  walls?: Uint8Array,
): void {
  expect(field.update(materials, liquidBytes, walls)).toBe(false);
  expect(field.hasSuspension).toBe(false);
  expect(field.bytes.some(Boolean)).toBe(false);
}
