import { describe, expect, it } from 'vitest';
import { ALL_MATERIALS, Material } from '../shared/materials';
import {
  applyCanvasReconstructedSuspensionStyle,
  applyCanvasSemanticSuspensionStyle,
  applyCanvasSuspensionStyle,
} from './canvas-suspension-style';
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

    const centroid = (pixels: Uint8ClampedArray, material: Material): number[] => {
      const total = [0, 0, 0];
      let count = 0;
      for (let y = 2; y <= 5; y++) for (let x = 2; x <= 5; x++) {
        const index = y * 8 + x;
        if (materials[index] !== material) continue;
        const pixel = index * 4;
        total[0] += pixels[pixel];
        total[1] += pixels[pixel + 1];
        total[2] += pixels[pixel + 2];
        count++;
      }
      return total.map((value) => value / count);
    };
    const distance = (left: number[], right: number[]): number => Math.hypot(
      left[0] - right[0], left[1] - right[1], left[2] - right[2],
    );
    const beforeDistance = distance(
      centroid(baseBefore, Material.Sand), centroid(liquidBefore, Material.Water),
    );
    const afterDistance = distance(
      centroid(base, Material.Sand), centroid(liquid, Material.Water),
    );
    // This tiny 4x4 checker includes the sparse knee; even there the semantic
    // phase contrast must fall substantially without flattening it completely.
    expect(afterDistance).toBeLessThan(beforeDistance * 0.6);
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

  it('rejects non-aqueous, trait-bearing, and stale semantic liquid pixels', () => {
    const { fields, liquid } = fixture();
    const index = 2 * 8 + 3;
    const pixel = index * 4;
    const before = new Uint8ClampedArray([91, 72, 38, 210]);
    for (const material of [Material.Oil, Material.Acid, Material.Lava]) {
      const target = before.slice();
      applyCanvasSemanticSuspensionStyle(
        target, 0, material, 3, 2,
        fields.lookups.styleBytes, fields.lookups.paletteBytes,
        fields.suspension, fields.liquid.bytes,
      );
      expect(target).toEqual(before);
    }

    const styledTarget = liquid.slice();
    const traitStyles = fields.lookups.styleBytes.slice();
    traitStyles[Material.Water * 4 + 3] = 1;
    applyCanvasSemanticSuspensionStyle(
      styledTarget, pixel, Material.Water, 3, 2,
      traitStyles, fields.lookups.paletteBytes, fields.suspension,
      fields.liquid.bytes,
    );
    expect(styledTarget).toEqual(liquid);

    const staleDensity = fields.liquid.bytes.slice();
    staleDensity[pixel] ^= 1;
    const staleTarget = liquid.slice();
    applyCanvasSemanticSuspensionStyle(
      staleTarget, pixel, Material.Water, 3, 2,
      fields.lookups.styleBytes, fields.lookups.paletteBytes,
      fields.suspension, staleDensity,
    );
    expect(staleTarget).toEqual(liquid);
  });

  it('limits the post-reconstruction pass to aqueous and reconstructed Empty liquid RGB', () => {
    const { fields, materials, liquid } = fixture();
    const emptyIndex = 3 * 8 + 3;
    materials[emptyIndex] = Material.Empty;
    const emptyPixel = emptyIndex * 4;
    liquid.set([42, 126, 194, 160], emptyPixel);
    const before = liquid.slice();
    const waterPixel = (2 * 8 + 3) * 4;

    applyCanvasReconstructedSuspensionStyle(
      liquid, materials, fields.lookups.styleBytes, fields.lookups.paletteBytes,
      fields.suspension, fields.liquid.bytes, 'smooth',
    );

    expect(Array.from(liquid.slice(emptyPixel, emptyPixel + 3)))
      .not.toEqual(Array.from(before.slice(emptyPixel, emptyPixel + 3)));
    expect(Array.from(liquid.slice(waterPixel, waterPixel + 3)))
      .not.toEqual(Array.from(before.slice(waterPixel, waterPixel + 3)));
    for (let index = 0; index < materials.length; index++) {
      const pixel = index * 4;
      expect(liquid[pixel + 3]).toBe(before[pixel + 3]);
      if (materials[index] !== Material.Empty && materials[index] !== Material.Water) {
        expect(liquid.slice(pixel, pixel + 4)).toEqual(before.slice(pixel, pixel + 4));
      }
    }
  });
});
