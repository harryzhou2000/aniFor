import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
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
    expect(simulation.velocity()).toHaveLength(612 * 384 * 2);
    expect(simulation.consumeDirtyCells().length).toBeGreaterThan(0);
  });

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
