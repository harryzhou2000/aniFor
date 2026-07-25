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

/** Native ACEL/DCEL latest-update activity flag in the owner-multiplexed state word. */
export const FORCE_ACTIVITY_PRESENTATION_STATE = {
  activeMask: 0x0001,
} as const;

/**
 * Exact native POLO lifecycle state in the owner-multiplexed presentation word.
 * Default POLO is already visibly radioactive upstream, so `presentMask` keeps
 * every authoritative owner distinct from the all-zero non-POLO state.
 */
export const POLO_PRESENTATION_STATE = {
  emissionMask: 0x0007,
  emissionMaximum: 5,
  cooldownShift: 3,
  cooldownMask: 0x0078,
  cooldownMaximum: 15,
  protonDoseShift: 7,
  protonDoseMask: 0x0780,
  protonDoseMaximum: 10,
  presentMask: 0x0800,
  reservedMask: 0xf000,
} as const;

/** Exact native SPNG absorbed-fluid reservoir in the owner-multiplexed state word. */
export const SPNG_PRESENTATION_STATE = {
  hydrationMask: 0x003f,
  hydrationMaximum: 50,
  presentMask: 0x0040,
  reservedMask: 0xff80,
} as const;

/** Exact native LAVA ctype ancestry in the owner-multiplexed presentation word. */
export const LAVA_PRESENTATION_STATE = {
  originMask: 0x00ff,
  presentMask: 0x0100,
  reservedMask: 0xfe00,
} as const;

/**
 * Native SPRK host identity and countdown in the owner-multiplexed state word.
 * The exact public host occupies the low byte; zero means the native ctype is
 * absent or cannot round-trip through the public material ABI. `presentMask`
 * therefore remains authoritative even when `hostMask` is zero.
 */
export const SPRK_PRESENTATION_STATE = {
  hostMask: 0x00ff,
  lifeShift: 8,
  lifeMask: 0x7f00,
  lifeMaximum: 0x7f,
  presentMask: 0x8000,
} as const;

/**
 * Exact native SEED hydration and supported-soil germination state.
 * Material.SEED is the owner guard, so an authoritative dry dormant seed is
 * intentionally the all-zero word.
 */
export const SEED_PRESENTATION_STATE = {
  waterMask: 0x00ff,
  waterMaximum: 0xff,
  germinationShift: 8,
  germinationMask: 0xff00,
  germinationMaximum: 0xff,
} as const;

/**
 * Compact native PLNT tree genome, hydration, and active-growth state.
 * The low twelve bits retain ctype's tree/phase/direction/inherited-colour
 * layout exactly; hydration is classified from its native eight-bit water
 * reservoir. `presentMask` distinguishes every exact PLNT owner.
 */
export const PLNT_PRESENTATION_STATE = {
  treeMask: 0x0001,
  phaseShift: 1,
  phaseMask: 0x0006,
  directionShift: 3,
  directionMask: 0x0038,
  inheritedColourShift: 6,
  inheritedColourMask: 0x0fc0,
  hydrationClassShift: 12,
  hydrationClassMask: 0x3000,
  activeGrowthMask: 0x4000,
  presentMask: 0x8000,
} as const;

/** Exact public material IDs whose native particles retain a configured ctype target. */
export const CONFIGURED_SOURCE_MATERIAL_IDS = [124, 126, 127, 137, 158, 159] as const;

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
