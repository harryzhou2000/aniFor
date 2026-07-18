import type { Material } from '../shared/materials';
import type { SimulationToolId } from './simulation-tools';

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
  /** Atomically place a native TPT source with its ctype target. */
  paintConfiguredSource?(x: number, y: number, source: Material, target: Material, radius: number): number;
  /** Ask the native element rules whether a source/target ctype pair is valid. */
  canConfigureSource?(source: Material, target: Material): boolean;
  /** Read the projected ctype target of a native source at one world cell. */
  configuredSourceTargetAt?(x: number, y: number): Material | undefined;
  /** Apply a native simulation tool. Vector tools use deltaX/deltaY as the drag vector. */
  applySimulationTool?(tool: SimulationToolId, x: number, y: number, radius: number, deltaX?: number, deltaY?: number): void;
  consumeDirtyCells(): readonly DirtyCell[];
  consumeDirtyWalls?(): readonly DirtyWallCell[];
  /** Raw TPT save bytes when the active backend supports native file exchange. */
  saveFile?(): Uint8Array;
  /** Load raw TPT save bytes without routing them through text/base64 storage. */
  loadFile?(bytes: Uint8Array): void;
  saveWorld(): string;
  loadWorld(serialized: string): void;
}
