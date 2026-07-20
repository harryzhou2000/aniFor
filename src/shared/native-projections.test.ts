import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderOptics } from '../renderer/render-optics';
import { renderPhase, renderProfile, RenderPhase, RenderProfile } from '../renderer/render-profile';
import { renderTraits, RenderTrait } from '../renderer/render-traits';
import { ALL_MATERIALS, MATERIALS, Material, NATIVE_PROJECTIONS } from './materials';

const PROJECTION_CASES = [
  ['BIZRG', Material.BIZRG], ['BIZRS', Material.BIZRS], ['BRAY', Material.BRAY],
  ['DYST', Material.DYST], ['E116', Material.E116], ['EMBR', Material.EMBR],
  ['FIGH', Material.FIGH], ['FRZW', Material.FRZW], ['LOLZ', Material.LOLZ],
  ['LOVE', Material.LOVE], ['MORT', Material.MORT], ['PSTS', Material.PSTS],
  ['RFGL', Material.RFGL], ['SHLD2', Material.SHLD2], ['SHLD3', Material.SHLD3],
  ['SHLD4', Material.SHLD4], ['SPAWN', Material.SPAWN], ['SPAWN2', Material.SPAWN2],
  ['STKM', Material.STKM], ['STKM2', Material.STKM2], ['VRSG', Material.VRSG],
  ['VRSS', Material.VRSS],
] as const;

const byId = new Map(ALL_MATERIALS.map((material) => [material.id, material]));

describe('native-only render projections', () => {
  it('pins 22 contiguous byte identities without exposing a lossy brush mapping', () => {
    expect(NATIVE_PROJECTIONS.map(({ id }) => id)).toEqual(
      Array.from({ length: 22 }, (_, index) => 195 + index),
    );
    const selectable = new Set(MATERIALS.map(({ id }) => id));
    for (const [, id] of PROJECTION_CASES) {
      expect(byId.get(id)?.selectable).toBe(false);
      expect(selectable.has(id)).toBe(false);
    }

    const adapter = readFileSync(new URL('../../native/tpt/tpt_adapter.cpp', import.meta.url), 'utf8');
    const brushMapping = adapter.slice(adapter.indexOf('int ToPowderType'), adapter.indexOf('bool IsConfiguredSourceType'));
    const renderMapping = adapter.slice(adapter.indexOf('uint8_t ToStillroomType'), adapter.indexOf('void ExtractFields'));
    for (const [nativeName, id] of PROJECTION_CASES) {
      expect(renderMapping).toContain(`case PT_${nativeName}: return ${id};`);
      expect(brushMapping).not.toContain(`PT_${nativeName}`);
    }
  });

  it('gives every identity a distinguishable stable visual signature', () => {
    const signatures = NATIVE_PROJECTIONS.map((material) => [
      material.color,
      renderPhase(material),
      renderProfile(material.category),
      renderOptics(material),
      renderTraits(material),
    ].join(':'));
    expect(new Set(signatures).size).toBe(NATIVE_PROJECTIONS.length);
  });

  it('projects native physical states and surface families explicitly', () => {
    for (const id of [Material.BIZRG, Material.MORT, Material.VRSG]) {
      expect(renderPhase(byId.get(id)!)).toBe(RenderPhase.Gas);
    }
    for (const id of [Material.FRZW, Material.RFGL]) {
      expect(renderPhase(byId.get(id)!)).toBe(RenderPhase.Liquid);
    }
    for (const id of [Material.BRAY, Material.EMBR]) {
      expect(renderPhase(byId.get(id)!)).toBe(RenderPhase.Energy);
      expect(renderTraits(byId.get(id)!)).toBe(RenderTrait.Carrier);
    }
    for (const id of [Material.DYST, Material.E116]) {
      const material = byId.get(id)!;
      expect(renderPhase(material)).toBe(RenderPhase.Powder);
      expect(renderProfile(material.category)).toBe(RenderProfile.Granular);
    }
    for (const id of [Material.FIGH, Material.STKM, Material.STKM2]) {
      const material = byId.get(id)!;
      expect(renderPhase(material)).toBe(RenderPhase.Solid);
      expect(renderProfile(material.category)).toBe(RenderProfile.Organic);
      expect(renderTraits(material)).toBe(RenderTrait.Organic);
    }
    for (const id of [Material.LOLZ, Material.LOVE, Material.SPAWN, Material.SPAWN2]) {
      const material = byId.get(id)!;
      expect(renderPhase(material)).toBe(RenderPhase.Solid);
      expect(renderProfile(material.category)).toBe(RenderProfile.Field);
    }
    for (const id of [Material.BIZRS, Material.PSTS, Material.SHLD2, Material.SHLD3, Material.SHLD4, Material.VRSS]) {
      const material = byId.get(id)!;
      expect(renderPhase(material)).toBe(RenderPhase.Solid);
      expect(renderProfile(material.category)).toBe(RenderProfile.Rigid);
    }
    expect(renderTraits(byId.get(Material.VRSG)!)).toBe(RenderTrait.Organic);
    expect(renderTraits(byId.get(Material.VRSS)!)).toBe(RenderTrait.Organic);
  });
});
