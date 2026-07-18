import { describe, expect, it } from 'vitest';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { renderPhase, renderProfile, RenderPhase, RenderProfile } from './render-profile';
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
    expect(counts[Material.Metal]).toBeGreaterThan(500);
    expect(counts[Material.PLUT]).toBeGreaterThan(500);
    expect(counts[Material.SPRK]).toBeGreaterThan(500);
    expect(counts[Material.ACEL]).toBeGreaterThan(500);
    expect(counts[Material.Fire]).toBeGreaterThan(500);
    expect(counts[Material.ELEC]).toBeGreaterThan(500);
    expect(counts[Material.Plasma]).toBeGreaterThan(500);
    expect(counts[Material.PHOT]).toBeGreaterThan(500);
    expect(counts[Material.NEUT]).toBeGreaterThan(500);
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
  });
});
