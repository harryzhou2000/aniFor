import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { RenderLabBackend } from './render-lab-backend';

describe('RenderLabBackend', () => {
  it('keeps native-shaped walls independent from particles and reports dirty blocks', () => {
    const simulation = new RenderLabBackend(12, 8);
    expect(simulation.consumeDirtyWalls()).toEqual([]);
    simulation.paint(5, 3, Material.Glass, 0);
    simulation.paintWall(5, 3, 6, 0);

    expect(simulation.cells()[3 * 12 + 5]).toBe(Material.Glass);
    expect(simulation.walls()[3 * 12 + 5]).toBe(6);
    expect(simulation.walls().filter((wall) => wall === 6)).toHaveLength(16);
    expect(simulation.consumeDirtyWalls()).toHaveLength(16);
    expect(simulation.consumeDirtyWalls()).toEqual([]);
  });

  it('clears both semantic planes without coupling them', () => {
    const simulation = new RenderLabBackend(8, 8);
    simulation.paint(1, 1, Material.Ice, 0);
    simulation.paintWall(1, 1, 10, 0);
    simulation.clear();
    expect(simulation.cells().some(Boolean)).toBe(false);
    expect(simulation.walls().some(Boolean)).toBe(false);
  });
});
