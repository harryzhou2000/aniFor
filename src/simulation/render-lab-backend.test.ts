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

  it('owns a bounded 16-bit presentation-state plane independent from matter and walls', () => {
    const simulation = new RenderLabBackend(8, 6);
    expect(simulation.presentationState()).toHaveLength(8 * 6);
    expect(simulation.presentationState().byteLength).toBe(8 * 6 * Uint16Array.BYTES_PER_ELEMENT);
    expect(simulation.presentationState().some(Boolean)).toBe(false);

    simulation.paint(3, 2, Material.VIBR, 0);
    simulation.paintWall(3, 2, 6, 0);
    simulation.setFixturePresentationStateRect(2, 1, 3, 2, 0x9234);
    simulation.setFixturePresentationState(-10, -10, 0xFFFF);
    simulation.setFixturePresentationState(7, 5, 0x1FFFF);

    for (let y = 0; y < simulation.height; y++) for (let x = 0; x < simulation.width; x++) {
      const expected = x === 7 && y === 5 ? 0xFFFF
        : x >= 2 && x < 5 && y >= 1 && y < 3 ? 0x9234 : 0;
      expect(simulation.presentationState()[y * simulation.width + x]).toBe(expected);
    }
    expect(simulation.cells()[2 * simulation.width + 3]).toBe(Material.VIBR);
    expect(simulation.walls()[2 * simulation.width + 3]).toBe(6);

    simulation.clear();
    expect(simulation.presentationState().some(Boolean)).toBe(false);
  });

  it('updates retained presentation state without changing material ownership or dirty particles', () => {
    const simulation = new RenderLabBackend(8, 6);
    const x = 3;
    const y = 2;
    const index = y * simulation.width + x;
    simulation.consumeDirtyCells();
    simulation.paint(x, y, Material.VIBR, 0);
    expect(simulation.consumeDirtyCells()).toEqual([{ index, material: Material.VIBR }]);

    simulation.setFixturePresentationState(x, y, 0x9234);

    expect(simulation.presentationState()[index]).toBe(0x9234);
    expect(simulation.cells()[index]).toBe(Material.VIBR);
    expect(simulation.consumeDirtyCells()).toEqual([]);
  });

  it('keeps the independent PHOT plane co-located with matter rather than reusing owner state', () => {
    const simulation = new RenderLabBackend(8, 6);
    simulation.paint(3, 2, Material.Water, 0);
    simulation.paintWall(3, 2, 6, 0);
    simulation.setFixturePresentationState(3, 2, 0x1234);
    simulation.setFixturePhotonState(3, 2, 0x8A3C);
    simulation.setFixturePhotonStateRect(4, 2, 2, 1, 0x8000);

    const index = 2 * simulation.width + 3;
    expect(simulation.cells()[index]).toBe(Material.Water);
    expect(simulation.walls()[index]).toBe(6);
    expect(simulation.presentationState()[index]).toBe(0x1234);
    expect(simulation.photonState()[index]).toBe(0x8A3C);
    expect(simulation.photonState()[2 * simulation.width + 4]).toBe(0x8000);

    simulation.clear();
    expect(simulation.photonState().some(Boolean)).toBe(false);
  });
});
