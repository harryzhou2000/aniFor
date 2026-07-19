import { describe, expect, it } from 'vitest';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { renderPhase, renderProfile, RenderPhase, RenderProfile } from './render-profile';
import { renderOptics, RenderOptics } from './render-optics';
import { hasRenderTrait, renderTraits, RenderTrait } from './render-traits';
import {
  applyRenderLabScene, RENDER_LAB_ENERGY_SAMPLES, RENDER_LAB_STYLE_SAMPLES, renderLabRequested,
} from './render-lab-scene';

describe('render lab scene', () => {
  it('is selected only by the explicit query', () => {
    expect(renderLabRequested('?scene=render-lab')).toBe(true);
    expect(renderLabRequested('?scene=other')).toBe(false);
    expect(renderLabRequested('')).toBe(false);
  });

  it('builds a deterministic atlas with representative material families', () => {
    const first = new DeterministicBackend(612, 384);
    const second = new DeterministicBackend(612, 384);
    applyRenderLabScene(first);
    applyRenderLabScene(second);
    expect(first.cells()).toEqual(second.cells());

    const counts = new Uint32Array(256);
    for (const material of first.cells()) counts[material]++;
    expect(counts[Material.Sand]).toBeGreaterThan(8_000);
    expect(counts[Material.Water]).toBeGreaterThan(8_000);
    expect(counts[Material.Smoke]).toBeGreaterThan(1_000);
    expect(counts[Material.Oxygen]).toBeGreaterThan(700);
    expect(counts[Material.NobleGas]).toBeGreaterThan(400);
    expect(counts[Material.FOG]).toBeGreaterThan(500);
    expect(counts[Material.CFLM]).toBeGreaterThan(450);
    expect(counts[Material.Metal]).toBeGreaterThan(500);
    expect(counts[Material.PLUT]).toBeGreaterThan(500);
    expect(counts[Material.CONV]).toBeGreaterThan(500);
    expect(counts[Material.CLNE]).toBeGreaterThan(500);
    expect(counts[Material.PRTI]).toBeGreaterThan(500);
    expect(counts[Material.ACEL]).toBeGreaterThan(500);
    expect(counts[Material.Fire]).toBeGreaterThan(500);
    expect(counts[Material.ELEC]).toBeGreaterThan(500);
    expect(counts[Material.Plasma]).toBeGreaterThan(500);
    expect(counts[Material.PHOT]).toBeGreaterThan(500);
    expect(counts[Material.GRVT]).toBeGreaterThan(500);
    expect(counts[Material.LIFE_GOL]).toBeGreaterThan(500);
    expect(counts[Material.PCLN]).toBeGreaterThan(500);
    expect(counts[Material.DTEC]).toBeGreaterThan(500);
    expect(counts[Material.URAN]).toBeGreaterThan(500);
    expect(counts[Material.VIBR]).toBeGreaterThan(500);
  });

  it('exercises every non-neutral styled family plus an energy phase', () => {
    const profiles = new Set(RENDER_LAB_STYLE_SAMPLES.map((id) => {
      const material = ALL_MATERIALS.find((candidate) => candidate.id === id)!;
      return renderProfile(material.category);
    }));
    expect(profiles).toEqual(new Set([
      RenderProfile.Neutral,
      RenderProfile.Granular,
      RenderProfile.Rigid,
      RenderProfile.Organic,
      RenderProfile.Radioactive,
      RenderProfile.Device,
      RenderProfile.Field,
    ]));
    expect(RENDER_LAB_ENERGY_SAMPLES).toHaveLength(5);
    for (const id of RENDER_LAB_ENERGY_SAMPLES) {
      const material = ALL_MATERIALS.find((candidate) => candidate.id === id)!;
      expect(renderPhase(material)).toBe(RenderPhase.Energy);
      expect(RENDER_LAB_STYLE_SAMPLES).toContain(id);
    }
    const optics = new Set(RENDER_LAB_STYLE_SAMPLES.map((id) => {
      const material = ALL_MATERIALS.find((candidate) => candidate.id === id)!;
      return renderOptics(material);
    }));
    for (const opticalClass of [
      RenderOptics.RoughGranular,
      RenderOptics.SmoothRigid,
      RenderOptics.Organic,
      RenderOptics.Device,
      RenderOptics.Radioactive,
      RenderOptics.TranslucentRigid,
    ]) expect(optics.has(opticalClass)).toBe(true);
    for (const trait of [
      RenderTrait.Emitter, RenderTrait.Sink, RenderTrait.Channel, RenderTrait.Force,
      RenderTrait.Radioactive, RenderTrait.Organic, RenderTrait.Fibrous, RenderTrait.Carrier,
    ]) {
      expect(RENDER_LAB_STYLE_SAMPLES.some((id) => {
        const material = ALL_MATERIALS.find((candidate) => candidate.id === id)!;
        return hasRenderTrait(renderTraits(material), trait);
      })).toBe(true);
    }
  });
});
