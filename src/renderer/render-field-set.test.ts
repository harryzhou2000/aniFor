import { describe, expect, it } from 'vitest';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { RenderPhase } from './render-profile';
import { createRenderLookups, RenderFieldSet } from './render-field-set';

describe('shared render field set', () => {
  it('packs canonical phase, color, and emission lookups', () => {
    const lookup = createRenderLookups(ALL_MATERIALS);
    expect(lookup.liquidByMaterial[Material.Water]).toBe(1);
    expect(lookup.gasByMaterial[Material.Oxygen]).toBe(1);
    expect(lookup.emissiveByMaterial[Material.PHOT]).toBe(1);
    expect(lookup.styleBytes[Material.Water * 4]).toBe(RenderPhase.Liquid);
    expect(Array.from(lookup.colorByMaterial.slice(Material.Acid * 3, Material.Acid * 3 + 3))).toEqual([0xd3, 0x5e, 0xe8]);
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
    expect(fields.liquid.bytes[2 * 4]).toBeGreaterThan(0);
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
    expect(fields.allocatedByteLength).toBeLessThan(8_200_000);
  });
});
