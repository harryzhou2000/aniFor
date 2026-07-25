import type { DirtyWallCell } from './types';
import { DeterministicBackend } from './deterministic-backend';
import { ROOM_TEMPERATURE_DECIKELVIN } from '../shared/temperature';

export const RENDER_LAB_AMBIENT_TEMPERATURE = ROOM_TEMPERATURE_DECIKELVIN;

/**
 * Deterministic screenshot backend with a TPT-shaped independent wall plane.
 * Native walls occupy 4x4 world-cell blocks; particles remain independently
 * paintable so the render lab can prove compositing and transmission semantics.
 */
export class RenderLabBackend extends DeterministicBackend {
  readonly presentationFieldsDynamic = false;
  private readonly wallWorld: Uint8Array;
  private readonly temperatureWorld: Uint16Array;
  private readonly presentationStateWorld: Uint16Array;
  private readonly photonStateWorld: Uint16Array;
  private readonly dirtyWalls = new Set<number>();

  constructor(width = 612, height = 384) {
    super(width, height);
    this.wallWorld = new Uint8Array(width * height);
    this.temperatureWorld = new Uint16Array(width * height);
    this.presentationStateWorld = new Uint16Array(width * height);
    this.photonStateWorld = new Uint16Array(width * height);
    this.temperatureWorld.fill(RENDER_LAB_AMBIENT_TEMPERATURE);
  }

  walls(): Uint8Array { return this.wallWorld; }
  temperature(): Uint16Array { return this.temperatureWorld; }
  /** Renderer-facing native-state projection used only by paused render-lab fixtures. */
  presentationState(): Uint16Array { return this.presentationStateWorld; }
  /** Independent PHOT spectrum projection, allowed to coexist with any matter owner. */
  photonState(): Uint16Array { return this.photonStateWorld; }

  /** Sets an immutable diagnostic temperature region before the paused scene is presented. */
  setFixtureTemperatureRect(
    x: number, y: number, width: number, height: number, temperature: number,
  ): void {
    if (width <= 0 || height <= 0) return;
    const left = Math.max(0, Math.floor(x));
    const top = Math.max(0, Math.floor(y));
    const right = Math.min(this.width, Math.ceil(x + width));
    const bottom = Math.min(this.height, Math.ceil(y + height));
    if (right <= left || bottom <= top) return;
    const value = Math.max(0, Math.min(0xFFFF, Math.round(temperature)));
    for (let py = top; py < bottom; py++) {
      this.temperatureWorld.fill(value, py * this.width + left, py * this.width + right);
    }
  }

  /** Sets one bounded diagnostic native-state region without changing matter ownership. */
  setFixturePresentationStateRect(
    x: number, y: number, width: number, height: number, state: number,
  ): void {
    if (width <= 0 || height <= 0) return;
    const left = Math.max(0, Math.floor(x));
    const top = Math.max(0, Math.floor(y));
    const right = Math.min(this.width, Math.ceil(x + width));
    const bottom = Math.min(this.height, Math.ceil(y + height));
    if (right <= left || bottom <= top) return;
    const value = Math.max(0, Math.min(0xFFFF, Math.round(state)));
    for (let py = top; py < bottom; py++) {
      this.presentationStateWorld.fill(value, py * this.width + left, py * this.width + right);
    }
  }

  setFixturePresentationState(x: number, y: number, state: number): void {
    this.setFixturePresentationStateRect(x, y, 1, 1, state);
  }

  /** Sets a bounded PHOT spectrum projection without changing matter ownership. */
  setFixturePhotonStateRect(
    x: number, y: number, width: number, height: number, state: number,
  ): void {
    if (width <= 0 || height <= 0) return;
    const left = Math.max(0, Math.floor(x));
    const top = Math.max(0, Math.floor(y));
    const right = Math.min(this.width, Math.ceil(x + width));
    const bottom = Math.min(this.height, Math.ceil(y + height));
    if (right <= left || bottom <= top) return;
    const value = Math.max(0, Math.min(0xFFFF, Math.round(state)));
    for (let py = top; py < bottom; py++) {
      this.photonStateWorld.fill(value, py * this.width + left, py * this.width + right);
    }
  }

  setFixturePhotonState(x: number, y: number, state: number): void {
    this.setFixturePhotonStateRect(x, y, 1, 1, state);
  }

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
    this.temperatureWorld?.fill(RENDER_LAB_AMBIENT_TEMPERATURE);
    this.presentationStateWorld?.fill(0);
    this.photonStateWorld?.fill(0);
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
