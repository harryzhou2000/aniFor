import type { Material } from '../shared/materials';

export interface DirtyCell {
  readonly index: number;
  readonly material: Material;
}

export interface DirtyWallCell {
  readonly index: number;
  readonly wall: number;
}

export interface SimulationBackend {
  readonly width: number;
  readonly height: number;
  readonly name: string;
  step(): void;
  paint(x: number, y: number, material: Material, radius: number): void;
  erase(x: number, y: number, radius: number): void;
  clear(): void;
  cells(): Uint8Array;
  temperature?(): Uint16Array;
  pressure?(): Float32Array;
  velocity?(): Int8Array;
  walls?(): Uint8Array;
  paintWall?(x: number, y: number, wall: number, radius: number): void;
  eraseWall?(x: number, y: number, radius: number): void;
  consumeDirtyCells(): readonly DirtyCell[];
  consumeDirtyWalls?(): readonly DirtyWallCell[];
  /** Raw TPT save bytes when the active backend supports native file exchange. */
  saveFile?(): Uint8Array;
  /** Load raw TPT save bytes without routing them through text/base64 storage. */
  loadFile?(bytes: Uint8Array): void;
  saveWorld(): string;
  loadWorld(serialized: string): void;
}
