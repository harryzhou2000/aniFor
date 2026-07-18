import { describe, expect, it } from 'vitest';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { applyWallLabScene, wallLabRequested } from './wall-lab-scene';

class WallLabBackend extends DeterministicBackend {
  readonly wallCells = new Uint8Array(this.width * this.height);

  paintWall(x: number, y: number, wall: number): void {
    const left = Math.floor(x / 4) * 4;
    const top = Math.floor(y / 4) * 4;
    for (let py = top; py < Math.min(this.height, top + 4); py++) {
      for (let px = left; px < Math.min(this.width, left + 4); px++) this.wallCells[py * this.width + px] = wall;
    }
  }
}

describe('native wall lab scene', () => {
  it('is selected only by its explicit query', () => {
    expect(wallLabRequested('?scene=wall-lab')).toBe(true);
    expect(wallLabRequested('?scene=render-lab')).toBe(false);
    expect(wallLabRequested('')).toBe(false);
  });

  it('builds deterministic wall plates independently from particle material', () => {
    const first = new WallLabBackend(612, 384);
    const second = new WallLabBackend(612, 384);
    applyWallLabScene(first);
    applyWallLabScene(second);

    expect(first.wallCells).toEqual(second.wallCells);
    expect(first.cells()).toEqual(second.cells());
    expect(first.wallCells.filter(Boolean).length).toBeGreaterThan(100_000);
    expect(first.cells().filter(Boolean).length).toBeGreaterThan(40_000);
    expect(first.wallCells.reduce((count, wall, index) => (
      count + Number(wall !== 0 && first.cells()[index] !== 0)
    ), 0)).toBeGreaterThan(40_000);
    expect(new Set(first.wallCells).size).toBe(11);
  });

  it('rejects a backend that cannot represent native walls', () => {
    expect(() => applyWallLabScene(new DeterministicBackend(612, 384))).toThrow(/wall painting support/);
  });
});
