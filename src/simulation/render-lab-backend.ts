import type { DirtyWallCell } from './types';
import { DeterministicBackend } from './deterministic-backend';

/**
 * Deterministic screenshot backend with a TPT-shaped independent wall plane.
 * Native walls occupy 4x4 world-cell blocks; particles remain independently
 * paintable so the render lab can prove compositing and transmission semantics.
 */
export class RenderLabBackend extends DeterministicBackend {
  private readonly wallWorld: Uint8Array;
  private readonly dirtyWalls = new Set<number>();

  constructor(width = 612, height = 384) {
    super(width, height);
    this.wallWorld = new Uint8Array(width * height);
  }

  walls(): Uint8Array { return this.wallWorld; }

  paintWall(x: number, y: number, wall: number, radius: number): void {
    const blockRadius = Math.max(0, Math.ceil(radius / 4));
    const blockX = Math.floor(x / 4);
    const blockY = Math.floor(y / 4);
    for (let offsetY = -blockRadius; offsetY <= blockRadius; offsetY++) {
      for (let offsetX = -blockRadius; offsetX <= blockRadius; offsetX++) {
        if (offsetX * offsetX + offsetY * offsetY > blockRadius * blockRadius) continue;
        this.setWallBlock(blockX + offsetX, blockY + offsetY, wall);
      }
    }
  }

  eraseWall(x: number, y: number, radius: number): void { this.paintWall(x, y, 0, radius); }

  consumeDirtyWalls(): readonly DirtyWallCell[] {
    const result = Array.from(this.dirtyWalls, (index) => ({ index, wall: this.wallWorld[index] }));
    this.dirtyWalls.clear();
    return result;
  }

  override clear(): void {
    super.clear();
    if (!this.wallWorld) return;
    for (let index = 0; index < this.wallWorld.length; index++) {
      if (this.wallWorld[index] === 0) continue;
      this.wallWorld[index] = 0;
      this.dirtyWalls.add(index);
    }
  }

  private setWallBlock(blockX: number, blockY: number, wall: number): void {
    const left = blockX * 4;
    const top = blockY * 4;
    if (left >= this.width || top >= this.height || left + 4 <= 0 || top + 4 <= 0) return;
    for (let y = Math.max(0, top); y < Math.min(this.height, top + 4); y++) {
      for (let x = Math.max(0, left); x < Math.min(this.width, left + 4); x++) {
        const index = y * this.width + x;
        if (this.wallWorld[index] === wall) continue;
        this.wallWorld[index] = wall;
        this.dirtyWalls.add(index);
      }
    }
  }
}
