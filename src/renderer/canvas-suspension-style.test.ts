import { describe, expect, it } from 'vitest';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { applyCanvasSuspensionStyle } from './canvas-suspension-style';
import { RenderFieldSet } from './render-field-set';

function fixture(): {
  fields: RenderFieldSet;
  materials: Uint8Array;
  base: Uint8ClampedArray;
  liquid: Uint8ClampedArray;
} {
  const width = 8;
  const height = 8;
  const materials = new Uint8Array(width * height).fill(Material.Water);
  for (let y = 2; y <= 5; y++) for (let x = 2; x <= 5; x++) {
    if ((x + y) % 2 === 0) materials[y * width + x] = Material.Sand;
  }
  const fields = new RenderFieldSet(width, height, ALL_MATERIALS);
  fields.liquid.update(materials);
  fields.updateSuspension(materials);
  const base = new Uint8ClampedArray(width * height * 4);
  const liquid = new Uint8ClampedArray(base.length);
  for (let index = 0; index < materials.length; index++) {
    const pixel = index * 4;
    if (materials[index] === Material.Sand) {
      base.set([216, 166, 70, 255], pixel);
    } else {
      liquid.set([32, 132, 206, 190], pixel);
    }
  }
  return { fields, materials, base, liquid };
}

describe('Canvas suspension styling', () => {
  it('coheres supported powder and liquid RGB without changing either alpha plane', () => {
    const { fields, materials, base, liquid } = fixture();
    expect(fields.suspension.hasSuspension).toBe(true);
    const baseBefore = base.slice();
    const liquidBefore = liquid.slice();
    applyCanvasSuspensionStyle(
      base, liquid, materials, fields.lookups.styleBytes, fields.lookups.paletteBytes,
      fields.suspension, fields.liquid.bytes, 'smooth',
    );
    let changedBase = false;
    let changedLiquid = false;
    for (let pixel = 0; pixel < base.length; pixel += 4) {
      changedBase ||= base[pixel] !== baseBefore[pixel]
        || base[pixel + 1] !== baseBefore[pixel + 1]
        || base[pixel + 2] !== baseBefore[pixel + 2];
      changedLiquid ||= liquid[pixel] !== liquidBefore[pixel]
        || liquid[pixel + 1] !== liquidBefore[pixel + 1]
        || liquid[pixel + 2] !== liquidBefore[pixel + 2];
      expect(base[pixel + 3]).toBe(baseBefore[pixel + 3]);
      expect(liquid[pixel + 3]).toBe(liquidBefore[pixel + 3]);
    }
    expect(changedBase).toBe(true);
    expect(changedLiquid).toBe(true);
  });

  it('is an exact no-op for the Grains and Local reference styles', () => {
    for (const style of ['grains', 'local'] as const) {
      const { fields, materials, base, liquid } = fixture();
      const baseBefore = base.slice();
      const liquidBefore = liquid.slice();
      applyCanvasSuspensionStyle(
        base, liquid, materials, fields.lookups.styleBytes, fields.lookups.paletteBytes,
        fields.suspension, fields.liquid.bytes, style,
      );
      expect(base).toEqual(baseBefore);
      expect(liquid).toEqual(liquidBefore);
    }
  });
});
