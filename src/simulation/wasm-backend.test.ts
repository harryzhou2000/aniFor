import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { WasmBackend } from './wasm-backend';

const originalFetch = globalThis.fetch;
const artifact = new URL('../../public/wasm/powder_core.wasm', import.meta.url);

describe('WasmBackend artifact', () => {
  beforeEach(() => {
    globalThis.fetch = async () => new Response(readFileSync(artifact), {
      headers: { 'content-type': 'application/wasm' },
    });
  });
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('loads the compiled C++ ABI and simulates gravity', async () => {
    const simulation = await WasmBackend.load('test://powder');
    expect([simulation.width, simulation.height, simulation.name]).toEqual([160, 100, 'C++ WebAssembly core']);
    simulation.paint(80, 4, Material.Sand, 0);
    for (let i = 0; i < 110; i++) simulation.step();
    expect(simulation.cells()[99 * simulation.width + 80]).toBe(Material.Sand);
  });

  it('restores tick state for deterministic continuation', async () => {
    const source = await WasmBackend.load('test://powder');
    source.paint(80, 8, Material.Sand, 4);
    source.paint(70, 30, Material.Water, 3);
    source.paint(95, 70, Material.Fire, 2);
    for (let i = 0; i < 40; i++) source.step();

    const restored = await WasmBackend.load('test://powder');
    restored.loadWorld(source.saveWorld());
    for (let i = 0; i < 30; i++) { source.step(); restored.step(); }

    expect(restored.cells()).toEqual(source.cells());
  });
});
