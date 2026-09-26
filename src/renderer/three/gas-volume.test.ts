import { describe, expect, it } from 'vitest';
import { Material } from '../../shared/materials';
import { GasVolume } from './gas-volume';

describe('studio gas reconstruction', () => {
  it('reconstructs and clears native gas without changing cells or intercepting edits', () => {
    const gas = new GasVolume(24, 20);
    const cells = new Uint8Array(24 * 20), walls = cells.slice();
    cells[10 * 24 + 12] = Material.Steam;
    const original = cells.slice();
    gas.update(cells, walls);
    expect(gas.mesh.visible).toBe(true);
    const texture = gas.mesh.material.uniforms.densityMap.value;
    expect(texture.image.data.some((v: number, i: number) => i % 4 === 3 && v > 0)).toBe(true);
    expect(cells).toEqual(original);
    const hits: never[] = [];
    gas.mesh.raycast(undefined!, hits);
    expect(hits).toEqual([]);
    walls[10 * 24 + 12] = 1;
    gas.update(cells, walls);
    expect(gas.mesh.visible).toBe(false);
    walls.fill(0); cells.fill(Material.Sand);
    gas.update(cells, walls);
    expect(gas.mesh.visible).toBe(false);
    cells.fill(Material.Empty);
    gas.update(cells, walls);
    expect(gas.mesh.visible).toBe(false);
    gas.dispose();
  });
});
