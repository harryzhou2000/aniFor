import { describe, expect, it } from 'vitest';
import { MATERIALS, Material } from '../shared/materials';
import { PowderToyBackend } from './powder-toy-backend';

const moduleArtifact = new URL('../../public/wasm/stillroom_core.js', import.meta.url);

describe('direct Powder Toy backend', () => {
  it('loads the pinned 612x384 engine and exposes rendering fields', async () => {
    const simulation = await PowderToyBackend.load(moduleArtifact.href);
    expect([simulation.width, simulation.height]).toEqual([612, 384]);
    expect(simulation.name).toContain('direct WebAssembly');

    simulation.paint(300, 40, Material.Sand, 0);
    simulation.paint(302, 40, Material.Water, 0);
    for (let index = 0; index < 30; index++) simulation.step();

    const cells = simulation.cells();
    expect(cells.filter((value) => value !== Material.Empty)).toHaveLength(2);
    expect(simulation.temperature()).toHaveLength(612 * 384);
    const pressure = simulation.pressure();
    expect(pressure).toHaveLength(612 * 384);
    expect(Array.from(pressure).every(Number.isFinite)).toBe(true);
    expect(simulation.velocity()).toHaveLength(612 * 384 * 2);
    expect(simulation.consumeDirtyCells().length).toBeGreaterThan(0);
  });

  it('projects every expanded material as its stable frontend ID', async () => {
    const simulation = await PowderToyBackend.load(moduleArtifact.href);
    const materials = MATERIALS.map(({ id }) => id);
    const y = 120;
    materials.forEach((material, index) => simulation.paint(30 + index * 15, y, material, 0));
    const cells = simulation.cells();
    materials.forEach((material, index) => expect(cells[y * simulation.width + 30 + index * 15]).toBe(material));
  });

  it('exposes changing native air pressure', async () => {
    const simulation = await PowderToyBackend.load(moduleArtifact.href);
    for (let y = 170; y < 190; y++) simulation.paint(305, y, Material.C4, 10);
    for (let y = 170; y < 190; y++) simulation.paint(289, y, Material.Fire, 0);
    for (let index = 0; index < 90; index++) simulation.step();
    simulation.cells();
    let peakPressure = 0;
    for (const pressure of simulation.pressure()) peakPressure = Math.max(peakPressure, Math.abs(pressure));
    expect(peakPressure).toBeGreaterThan(0.01);
  });

  it('settles water without air-driven ejection', async () => {
    const simulation = await PowderToyBackend.load(moduleArtifact.href);
    const floorY = 220;
    for (let x = 30; x < simulation.width - 30; x += 2) simulation.paint(x, floorY, Material.Wall, 1);
    const centerY = 155;
    const radius = 12;
    simulation.paint(Math.floor(simulation.width / 2), centerY, Material.Water, radius);
    for (let index = 0; index < 180; index++) simulation.step();
    const cells = simulation.cells();
    const velocity = simulation.velocity();
    let waterCount = 0;
    let airborne = 0;
    let maxVerticalSpeed = 0;
    for (let index = 0; index < cells.length; index++) {
      if (cells[index] !== Material.Water) continue;
      waterCount++;
      if (Math.floor(index / simulation.width) < floorY - 30) airborne++;
      maxVerticalSpeed = Math.max(maxVerticalSpeed, Math.abs(velocity[index * 2 + 1]));
    }
    expect(waterCount).toBeGreaterThan(400);
    expect(airborne).toBeLessThanOrEqual(5);
    expect(maxVerticalSpeed).toBeLessThanOrEqual(48);
  }, 15000);

  it('restores full native state for deterministic continuation', async () => {
    const source = await PowderToyBackend.load(moduleArtifact.href);
    source.paint(120, 80, Material.Wall, 3);
    source.paint(120, 40, Material.Sand, 4);
    source.paint(150, 42, Material.Water, 4);
    source.paint(180, 100, Material.Fire, 2);
    for (let index = 0; index < 40; index++) source.step();

    const saved = source.saveWorld();
    expect(saved.startsWith('tpt3.')).toBe(true);
    const restored = await PowderToyBackend.load(moduleArtifact.href);
    source.loadWorld(saved);
    restored.loadWorld(saved);
    expect(restored.cells()).toEqual(source.cells());
    expect(restored.temperature()).toEqual(source.temperature());
    expect(restored.velocity()).toEqual(source.velocity());

    for (let index = 0; index < 15; index++) { source.step(); restored.step(); }
    expect(restored.cells()).toEqual(source.cells());
    expect(restored.temperature()).toEqual(source.temperature());
    expect(restored.velocity()).toEqual(source.velocity());
  }, 15000);
});
