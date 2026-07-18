import { describe, expect, it } from 'vitest';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { Material } from '../shared/materials';
import { applyRenderLabScene, renderLabRequested } from './render-lab-scene';

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
    expect(counts[Material.Metal]).toBeGreaterThan(1_000);
    expect(counts[Material.DEUT]).toBeGreaterThan(1_000);
    expect(counts[Material.NEUT]).toBeGreaterThan(1_000);
  });
});
