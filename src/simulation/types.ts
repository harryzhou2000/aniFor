import type { Material } from '../shared/materials';
import type { SimulationToolId } from './simulation-tools';

/** Stable bit layout of the native VIBR/BVBR presentation-state word. */
export const VIBR_PRESENTATION_STATE = {
  chargeMask: 0x007f,
  countdownShift: 7,
  countdownMask: 0x7f80,
  alternateModeMask: 0x8000,
} as const;

/** Exact native DEUT concentration stored in the owner-multiplexed state word. */
export const DEUT_PRESENTATION_STATE = {
  defaultConcentration: 10,
  glowThreshold: 240,
  canonicalElectronMaximum: 6000,
  reactionYieldSaturation: 17000,
  maximumConcentration: 0xffff,
} as const;

/** Exact public material IDs whose native particles retain a configured ctype target. */
export const CONFIGURED_SOURCE_MATERIAL_IDS = [124, 126, 127, 158, 159] as const;

export interface DirtyCell {
  readonly index: number;
  readonly material: Material;
}

export interface DirtyWallCell {
  readonly index: number;
  readonly wall: number;
}

/** Native TPT sign pointer alignment. `None` is retained for imported saves. */
export type NativeSignJustification = 0 | 1 | 2 | 3;

export interface NativeSign {
  readonly index: number;
  readonly x: number;
  readonly y: number;
  readonly justification: NativeSignJustification;
  /** Authoritative text serialized into OPS saves. */
  readonly text: string;
  /** Native TPT expansion of placeholders such as `{p}`, `{temp}`, and `{type}`. */
  readonly displayText: string;
}

export interface NativeSignDraft {
  readonly x: number;
  readonly y: number;
  readonly justification: NativeSignJustification;
  readonly text: string;
}

export interface SimulationBackend {
  readonly width: number;
  readonly height: number;
  readonly name: string;
  /** Whether temperature/velocity may change without a material dirty-cell update. */
  readonly presentationFieldsDynamic?: boolean;
  step(): void;
  paint(x: number, y: number, material: Material, radius: number): void;
  erase(x: number, y: number, radius: number): void;
  clear(): void;
  cells(): Uint8Array;
  temperature?(): Uint16Array;
  /** Packed native presentation state refreshed by the same extraction as `cells()`. */
  presentationState?(): Uint16Array;
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
  /** Place one of TPT's native built-in LIFE presets without treating it as a generic element ID. */
  paintLifePreset?(x: number, y: number, preset: number, radius: number): number;
  /** Apply a native simulation tool. Vector tools use deltaX/deltaY as the drag vector. */
  applySimulationTool?(tool: SimulationToolId, x: number, y: number, radius: number, deltaX?: number, deltaY?: number): void;
  /** Snapshot native annotations without projecting them into particle or wall fields. */
  signs?(): readonly NativeSign[];
  /** Create a sign, or replace the native sign at `index`; returns its native index or -1. */
  upsertSign?(sign: NativeSignDraft, index?: number): number;
  /** Remove one native sign by index. */
  removeSign?(index: number): boolean;
  consumeDirtyCells(): readonly DirtyCell[];
  consumeDirtyWalls?(): readonly DirtyWallCell[];
  /** Raw TPT save bytes when the active backend supports native file exchange. */
  saveFile?(): Uint8Array;
  /** Load raw TPT save bytes without routing them through text/base64 storage. */
  loadFile?(bytes: Uint8Array): void;
  saveWorld(): string;
  loadWorld(serialized: string): void;
}
