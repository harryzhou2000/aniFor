import { describe, expect, it } from 'vitest';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { hasRenderTrait, renderTraits, RenderTrait } from './render-traits';

function traits(id: Material): number {
  const material = ALL_MATERIALS.find((candidate) => candidate.id === id);
  if (!material) throw new Error(`Missing material ${id}`);
  return renderTraits(material);
}

function idsFor(trait: RenderTrait): Material[] {
  return ALL_MATERIALS
    .filter((material) => hasRenderTrait(renderTraits(material), trait))
    .map(({ id }) => id);
}

describe('static render traits', () => {
  it('composes source, sink, channel, and force roles', () => {
    expect(traits(Material.CLNE)).toBe(RenderTrait.Emitter);
    expect(traits(Material.CONV)).toBe(RenderTrait.Emitter | RenderTrait.Sink);
    expect(traits(Material.PRTI)).toBe(RenderTrait.Sink | RenderTrait.Channel);
    expect(traits(Material.PRTO)).toBe(RenderTrait.Emitter | RenderTrait.Channel);
    expect(traits(Material.NBHL)).toBe(RenderTrait.Sink | RenderTrait.Force);
  });

  it('keeps passive force-category structures out of the actuator role', () => {
    expect(hasRenderTrait(traits(Material.ACEL), RenderTrait.Force)).toBe(true);
    expect(hasRenderTrait(traits(Material.FRME), RenderTrait.Force)).toBe(false);
    expect(hasRenderTrait(traits(Material.PIPE), RenderTrait.Force)).toBe(false);
    expect(hasRenderTrait(traits(Material.PSTN), RenderTrait.Force)).toBe(true);
  });

  it('keeps every role assignment explicit and exhaustive', () => {
    expect(idsFor(RenderTrait.Emitter)).toEqual([
      Material.FRAY, Material.BCLN, Material.CLNE, Material.CONV, Material.NWHL,
      Material.PRTO, Material.WHOL, Material.ARAY, Material.BTRY, Material.CRAY,
      Material.DRAY, Material.ETRD, Material.TESC, Material.PBCN, Material.PCLN,
    ]);
    expect(idsFor(RenderTrait.Sink)).toEqual([
      Material.SING, Material.BHOL, Material.CONV, Material.NBHL, Material.PRTI,
      Material.VOID, Material.PVOD, Material.STOR,
    ]);
    expect(idsFor(RenderTrait.Channel)).toEqual([
      Material.PIPE, Material.PRTI, Material.PRTO, Material.WIFI, Material.PPIP, Material.STOR,
    ]);
    expect(idsFor(RenderTrait.Force)).toEqual([
      Material.GRVT, Material.SING, Material.ACEL, Material.DCEL, Material.DMG,
      Material.FRAY, Material.GBMB, Material.PSTN, Material.RPEL, Material.BHOL,
      Material.NBHL, Material.NWHL, Material.WHOL, Material.GPMP, Material.PUMP,
    ]);
    expect(idsFor(RenderTrait.Radioactive)).toEqual([
      Material.AMTR, Material.BVBR, Material.DEUT, Material.ELEC, Material.EXOT,
      Material.GRVT, Material.ISOZ, Material.ISZS, Material.NEUT, Material.PHOT,
      Material.PLUT, Material.POLO, Material.PROT, Material.SING, Material.URAN,
      Material.VIBR, Material.WARP,
    ]);
    expect(idsFor(RenderTrait.Organic)).toEqual([
      Material.Wood, Material.Plant, Material.SEED, Material.YEST, Material.VINE,
    ]);
    expect(idsFor(RenderTrait.Fibrous)).toEqual([Material.Wood, Material.VINE]);
    expect(idsFor(RenderTrait.Carrier)).toEqual([
      Material.CFLM, Material.LIGH, Material.THDR, Material.ELEC, Material.GRVT,
      Material.NEUT, Material.PHOT, Material.PROT, Material.SPRK,
    ]);
  });

  it('marks every explicitly emissive cross-phase material as a carrier', () => {
    for (const material of ALL_MATERIALS) {
      if (!material.emissive) continue;
      expect(hasRenderTrait(renderTraits(material), RenderTrait.Carrier), material.name).toBe(true);
    }
  });

  it('distinguishes organic fibres and radioactive carriers', () => {
    expect(traits(Material.Wood)).toBe(RenderTrait.Organic | RenderTrait.Fibrous);
    expect(traits(Material.Plant)).toBe(RenderTrait.Organic);
    expect(traits(Material.PHOT)).toBe(RenderTrait.Radioactive | RenderTrait.Carrier);
    expect(traits(Material.PLUT)).toBe(RenderTrait.Radioactive);
  });

  it('fits every projected material in one byte and leaves ordinary matter unmarked', () => {
    expect(traits(Material.Water)).toBe(0);
    expect(traits(Material.Sand)).toBe(0);
    for (const material of ALL_MATERIALS) {
      expect(renderTraits(material)).toBeGreaterThanOrEqual(0);
      expect(renderTraits(material)).toBeLessThanOrEqual(255);
    }
  });
});
