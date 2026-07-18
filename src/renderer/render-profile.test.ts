import { describe, expect, it } from 'vitest';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { receivesSurfaceLight, renderPhase, renderProfile, RenderPhase, RenderProfile } from './render-profile';

describe('render profiles', () => {
  it('groups toolbox categories into stable visual surface families', () => {
    expect(renderProfile('powders')).toBe(RenderProfile.Granular);
    expect(renderProfile('explosives')).toBe(RenderProfile.Granular);
    expect(renderProfile('solids')).toBe(RenderProfile.Rigid);
    expect(renderProfile('life')).toBe(RenderProfile.Organic);
    expect(renderProfile('radioactive')).toBe(RenderProfile.Radioactive);
    expect(renderProfile('electronics')).toBe(RenderProfile.Device);
    expect(renderProfile('powered')).toBe(RenderProfile.Device);
    expect(renderProfile('sensors')).toBe(RenderProfile.Device);
    expect(renderProfile('force')).toBe(RenderProfile.Field);
    expect(renderProfile('automata')).toBe(RenderProfile.Neutral);
  });

  it('leaves fluid and atmospheric phase styling neutral', () => {
    expect(renderProfile('liquids')).toBe(RenderProfile.Neutral);
    expect(renderProfile('gases')).toBe(RenderProfile.Neutral);
    expect(renderProfile('energy')).toBe(RenderProfile.Neutral);
    expect(renderPhase({ category: 'automata' })).toBe(RenderPhase.Solid);
  });

  it('keeps physical state independent from toolbox grouping', () => {
    expect(renderPhase({ category: 'liquids' })).toBe(RenderPhase.Liquid);
    expect(renderPhase({ category: 'gases' })).toBe(RenderPhase.Gas);
    expect(renderPhase({ category: 'explosives', phase: 'liquid' })).toBe(RenderPhase.Liquid);
    expect(renderPhase({ category: 'radioactive', phase: 'gas' })).toBe(RenderPhase.Gas);
    expect(renderPhase({ category: 'electronics', phase: 'energy' })).toBe(RenderPhase.Energy);
    expect(renderPhase(ALL_MATERIALS.find(({ id }) => id === Material.Nitro)!)).toBe(RenderPhase.Liquid);
    expect(renderPhase(ALL_MATERIALS.find(({ id }) => id === Material.DEUT)!)).toBe(RenderPhase.Liquid);
    expect(renderPhase(ALL_MATERIALS.find(({ id }) => id === Material.WARP)!)).toBe(RenderPhase.Gas);
    expect(renderPhase(ALL_MATERIALS.find(({ id }) => id === Material.SPRK)!)).toBe(RenderPhase.Solid);
    expect(ALL_MATERIALS.find(({ id }) => id === Material.SPRK)?.emissive).toBe(true);
    expect(renderPhase(ALL_MATERIALS.find(({ id }) => id === Material.CFLM)!)).toBe(RenderPhase.Gas);
    expect(renderPhase(ALL_MATERIALS.find(({ id }) => id === Material.THDR)!)).toBe(RenderPhase.Powder);
  });

  it('lights coherent matter surfaces without treating volumes as opaque', () => {
    expect(receivesSurfaceLight(RenderPhase.Solid)).toBe(true);
    expect(receivesSurfaceLight(RenderPhase.Powder)).toBe(true);
    expect(receivesSurfaceLight(RenderPhase.Field)).toBe(true);
    expect(receivesSurfaceLight(RenderPhase.Liquid)).toBe(false);
    expect(receivesSurfaceLight(RenderPhase.Gas)).toBe(false);
    expect(receivesSurfaceLight(RenderPhase.Energy)).toBe(false);
  });
});
