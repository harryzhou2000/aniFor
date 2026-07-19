import { describe, expect, it } from 'vitest';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { renderPhase, renderProfile, RenderPhase } from './render-profile';
import { createRenderLookups, RenderFieldSet } from './render-field-set';
import { renderOptics, RenderOptics } from './render-optics';
import { renderTraits, RenderTrait } from './render-traits';

describe('shared render field set', () => {
  it('packs canonical phase, color, and emission lookups', () => {
    const lookup = createRenderLookups(ALL_MATERIALS);
    expect(lookup.liquidByMaterial[Material.Water]).toBe(1);
    expect(lookup.gasByMaterial[Material.Oxygen]).toBe(1);
    expect(lookup.emissiveByMaterial[Material.PHOT]).toBe(1);
    expect(lookup.styleBytes[Material.Water * 4]).toBe(RenderPhase.Liquid);
    expect(lookup.paletteBytes[Material.Water * 4 + 3]).toBe(RenderOptics.Aqueous);
    expect(lookup.styleBytes[Material.PRTI * 4 + 3]).toBe(RenderTrait.Sink | RenderTrait.Channel);
    expect(Array.from(lookup.colorByMaterial.slice(Material.Acid * 3, Material.Acid * 3 + 3))).toEqual([0xd3, 0x5e, 0xe8]);
    expect(Array.from(lookup.styleBytes.slice(0, 4))).toEqual([0, 0, 0, 0]);
  });

  it('packs a complete render identity for every projected material', () => {
    const lookup = createRenderLookups(ALL_MATERIALS);
    expect(ALL_MATERIALS).toHaveLength(194);
    expect(new Set(ALL_MATERIALS.map(({ id }) => id)).size).toBe(194);
    for (const material of ALL_MATERIALS) {
      const palette = material.id * 4;
      const color = Number.parseInt(material.color.slice(1), 16);
      expect(Array.from(lookup.paletteBytes.slice(palette, palette + 4))).toEqual([
        color >>> 16, (color >>> 8) & 0xff, color & 0xff, renderOptics(material),
      ]);
      expect(lookup.styleBytes[palette]).toBe(renderPhase(material));
      expect(lookup.styleBytes[palette + 1]).toBe(renderProfile(material.category));
      expect(lookup.styleBytes[palette + 3]).toBe(renderTraits(material));
      expect(lookup.gasByMaterial[material.id]).toBe(Number(renderPhase(material) === RenderPhase.Gas));
      expect(lookup.liquidByMaterial[material.id]).toBe(Number(renderPhase(material) === RenderPhase.Liquid));
      expect(lookup.emissiveByMaterial[material.id]).toBe(Number(
        material.emissive === true || renderPhase(material) === RenderPhase.Energy,
      ));
    }
  });

  it('stages atmosphere, liquid, and emission reconstruction over separate frames', () => {
    const width = 8;
    const height = 6;
    const materials = new Uint8Array(width * height);
    materials[1] = Material.Smoke;
    materials[2] = Material.Water;
    materials[3] = Material.PHOT;
    const fields = new RenderFieldSet(width, height, ALL_MATERIALS);
    expect(fields.updateNext(materials, 0)).toBe('atmosphere');
    expect(fields.updateNext(materials, 1)).toBe('liquid');
    expect(fields.updateNext(materials, 2)).toBe('emission');
    expect(fields.updateNext(materials, 3)).toBeUndefined();
    expect(fields.atmosphere.bytes.some(Boolean)).toBe(true);
    expect(fields.liquid.bytes[2 * 4 + 3]).toBeGreaterThan(0);
    expect(fields.emission.bytes.some(Boolean)).toBe(true);
  });

  it('redirties only fields affected by a material transition', () => {
    const materials = new Uint8Array(16);
    const fields = new RenderFieldSet(4, 4, ALL_MATERIALS);
    fields.updateNext(materials, 0);
    fields.updateNext(materials, 1);
    fields.updateNext(materials, 2);
    fields.markDirty(Material.Empty, Material.Water);
    expect(fields.updateNext(materials, 100)).toBe('liquid');
    expect(fields.updateNext(materials, 101)).toBeUndefined();
  });

  it('keeps shared field memory bounded at the native world size', () => {
    const fields = new RenderFieldSet(612, 384, ALL_MATERIALS);
    const lookupBytes = fields.lookups.paletteBytes.byteLength
      + fields.lookups.styleBytes.byteLength
      + fields.lookups.gasByMaterial.byteLength
      + fields.lookups.liquidByMaterial.byteLength
      + fields.lookups.emissiveByMaterial.byteLength
      + fields.lookups.colorByMaterial.byteLength;
    expect(lookupBytes).toBe(3_584);
    expect(fields.allocatedByteLength).toBeLessThan(11_300_000);
  });
});
