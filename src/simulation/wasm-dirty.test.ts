import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { WasmBackend } from './wasm-backend';

const originalFetch = globalThis.fetch;

describe('WASM dirty-cell contract', () => {
  beforeAll(() => {
    const artifact = new URL('../../public/wasm/powder_core.wasm', import.meta.url);
    globalThis.fetch = async () => new Response(readFileSync(artifact), {
      headers: { 'content-type': 'application/wasm' },
    });
  });
  afterAll(() => { globalThis.fetch = originalFetch; });

  it('reports only changed cells and consumes each change once', async () => {
    const simulation = await WasmBackend.load('test://powder');
    simulation.paint(20, 10, Material.Sand, 0);
    expect(simulation.consumeDirtyCells()).toEqual([{ index: 10 * simulation.width + 20, material: Material.Sand }]);
    expect(simulation.consumeDirtyCells()).toEqual([]);

    simulation.step();
    const changed = simulation.consumeDirtyCells();
    expect(changed).toHaveLength(2);
    expect(changed.map((cell) => cell.material).sort()).toEqual([Material.Empty, Material.Sand]);
  });
});
