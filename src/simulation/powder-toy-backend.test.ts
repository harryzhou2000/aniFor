import { describe, expect, it } from 'vitest';
import { ALL_MATERIALS, Material } from '../shared/materials';
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
    expect(simulation.walls()).toHaveLength(612 * 384);
    expect(simulation.consumeDirtyWalls()).toEqual([]);
    simulation.paintWall(340, 120, 8, 0);
    expect(simulation.walls()[120 * simulation.width + 340]).toBe(8);
    expect(simulation.cells()[120 * simulation.width + 340]).toBe(Material.Empty);
    const dirtyWalls = simulation.consumeDirtyWalls();
    expect(dirtyWalls).toHaveLength(16);
    expect(dirtyWalls.every(({ wall }) => wall === 8)).toBe(true);
  });

  it('projects every expanded material as its stable frontend ID', async () => {
    const simulation = await PowderToyBackend.load(moduleArtifact.href);
    const materials = ALL_MATERIALS.map(({ id }) => id);
    const point = (index: number) => ({ x: 24 + (index % 32) * 18, y: 24 + Math.floor(index / 32) * 28 });
    materials.forEach((material, index) => {
      const { x, y } = point(index);
      // SPRK is a brush operation on an existing conductor, not a free particle.
      if (material === Material.SPRK) simulation.paint(x, y, Material.Metal, 0);
      simulation.paint(x, y, material, 0);
    });
    const cells = simulation.cells();
    materials.forEach((material, index) => {
      const { x, y } = point(index);
      expect(cells[y * simulation.width + x]).toBe(material);
    });
  });

  it('projects native reaction-only phase products', async () => {
    const simulation = await PowderToyBackend.load(moduleArtifact.href);
    simulation.paint(272, 190, Material.Water, 15);
    simulation.paint(304, 190, Material.Lava, 15);
    for (let index = 0; index < 180; index++) simulation.step();

    const cells = simulation.cells();
    expect(cells).toContain(Material.Steam);
  }, 15000);

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

  it('uses the native wall field as a physical particle barrier', async () => {
    const simulation = await PowderToyBackend.load(moduleArtifact.href);
    const floorY = 220;
    for (let x = 190; x <= 422; x += 4) simulation.paintWall(x, floorY, 8, 0);
    simulation.paint(306, 150, Material.Sand, 9);

    for (let index = 0; index < 180; index++) simulation.step();
    const cells = simulation.cells();
    let sandAboveWall = 0;
    let sandBelowWall = 0;
    for (let index = 0; index < cells.length; index++) {
      if (cells[index] !== Material.Sand) continue;
      const y = Math.floor(index / simulation.width);
      if (y < floorY) sandAboveWall++;
      if (y >= floorY + 4) sandBelowWall++;
    }
    expect(sandAboveWall).toBeGreaterThan(100);
    expect(sandBelowWall).toBe(0);
  }, 15000);

  it('grows native plants from seeds supplied with soil and water', async () => {
    const simulation = await PowderToyBackend.load(moduleArtifact.href);
    for (let x = 250; x < 360; x++) {
      for (let y = 250; y < 254; y++) simulation.paint(x, y, Material.Wall, 0);
    }
    for (let x = 260; x < 350; x++) {
      for (let y = 242; y < 250; y++) simulation.paint(x, y, Material.Sand, 0);
    }
    for (let x = 270; x < 295; x++) {
      for (let y = 225; y < 241; y++) simulation.paint(x, y, Material.Water, 0);
    }
    for (let x = 305; x <= 325; x += 5) simulation.paint(x, 241, Material.SEED, 0);

    for (let index = 0; index < 900; index++) simulation.step();
    const grownCells = simulation.cells().filter((material) => material === Material.Wood || material === Material.Plant);
    expect(grownCells.length).toBeGreaterThan(50);
  }, 15000);

  it('restores full native state for deterministic continuation', async () => {
    const source = await PowderToyBackend.load(moduleArtifact.href);
    source.paint(120, 80, Material.Wall, 3);
    source.paint(120, 40, Material.Sand, 4);
    source.paint(150, 42, Material.Water, 4);
    source.paint(180, 100, Material.Fire, 2);
    source.paintWall(210, 120, 8, 8);
    for (let index = 0; index < 40; index++) source.step();

    const file = source.saveFile();
    expect(new TextDecoder().decode(file.slice(0, 4))).toBe('OPS1');
    const saved = source.saveWorld();
    expect(saved.startsWith('tpt3.')).toBe(true);
    const restored = await PowderToyBackend.load(moduleArtifact.href);
    source.loadWorld(saved);
    restored.loadFile(file);
    expect(restored.cells()).toEqual(source.cells());
    expect(restored.temperature()).toEqual(source.temperature());
    expect(restored.velocity()).toEqual(source.velocity());
    expect(restored.walls()).toEqual(source.walls());

    for (let index = 0; index < 15; index++) { source.step(); restored.step(); }
    expect(restored.cells()).toEqual(source.cells());
    expect(restored.temperature()).toEqual(source.temperature());
    expect(restored.velocity()).toEqual(source.velocity());
    expect(restored.walls()).toEqual(source.walls());
  }, 15000);

  it('keeps the active world when a native file is rejected', async () => {
    const simulation = await PowderToyBackend.load(moduleArtifact.href);
    simulation.paint(240, 180, Material.Wall, 6);
    const before = simulation.cells().slice();
    const corrupt = simulation.saveFile().slice(0, 24);
    expect(() => simulation.loadFile(corrupt)).toThrow('Corrupt world');
    expect(simulation.cells()).toEqual(before);
  });
});
