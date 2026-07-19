import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import {
  RENDER_LAB_AMBIENT_TEMPERATURE, RenderLabBackend,
} from './render-lab-backend';

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

  it('keeps a static bounded temperature fixture and restores ambient on clear', () => {
    const simulation = new RenderLabBackend(8, 6);
    expect(simulation.presentationFieldsDynamic).toBe(false);
    expect([...simulation.temperature()]).toEqual(
      new Array(8 * 6).fill(RENDER_LAB_AMBIENT_TEMPERATURE),
    );

    simulation.setFixtureTemperatureRect(2, 1, 3, 2, 1200);
    simulation.setFixtureTemperatureRect(-20, -20, 2, 2, 18000);
    for (let y = 0; y < simulation.height; y++) for (let x = 0; x < simulation.width; x++) {
      expect(simulation.temperature()[y * simulation.width + x]).toBe(
        x >= 2 && x < 5 && y >= 1 && y < 3 ? 1200 : RENDER_LAB_AMBIENT_TEMPERATURE,
      );
    }

    simulation.clear();
    expect([...simulation.temperature()]).toEqual(
      new Array(8 * 6).fill(RENDER_LAB_AMBIENT_TEMPERATURE),
    );
  });
});
