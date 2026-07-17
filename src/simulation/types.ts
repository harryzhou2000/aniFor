import type { Material } from '../shared/materials';

export interface DirtyCell {
  readonly index: number;
  readonly material: Material;
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
  velocity?(): Int8Array;
  consumeDirtyCells(): readonly DirtyCell[];
  saveWorld(): string;
  loadWorld(serialized: string): void;
}
