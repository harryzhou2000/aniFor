import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { DeterministicBackend } from './deterministic-backend';

describe('DeterministicBackend', () => {
  it('settles sand under gravity', () => {
    const simulation = new DeterministicBackend(12, 12);
    simulation.paint(6, 2, Material.Sand, 0);
    for (let i = 0; i < 12; i++) simulation.step();
    expect(simulation.cells()[11 * 12 + 6]).toBe(Material.Sand);
  });

  it('replays identical inputs deterministically', () => {
    const a = new DeterministicBackend(20, 20);
    const b = new DeterministicBackend(20, 20);
    for (const simulation of [a, b]) {
      simulation.paint(10, 4, Material.Sand, 3);
      simulation.paint(7, 8, Material.Water, 2);
      for (let i = 0; i < 30; i++) simulation.step();
    }
    expect(a.cells()).toEqual(b.cells());
  });

  it('round-trips serialized worlds', () => {
    const source = new DeterministicBackend(16, 10);
    source.paint(5, 5, Material.Wall, 3);
    const restored = new DeterministicBackend(16, 10);
    restored.loadWorld(source.saveWorld());
    expect(restored.cells()).toEqual(source.cells());
  });
});
