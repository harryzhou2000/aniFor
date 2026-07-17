export const WORLD_WIDTH = 256;
export const WORLD_HEIGHT = 192;
export const RULESET_VERSION = 2;

export enum MaterialId {
  Empty = 0,
  Wall = 1,
  Sand = 2,
  Water = 3,
  Fire = 4,
  Smoke = 5,
  Oil = 6,
  Wood = 7,
  Steam = 8,
  Ice = 9,
  Acid = 10
}

export interface GridPoint {
  readonly x: number;
  readonly y: number;
}

export interface BrushData {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly material?: MaterialId;
}

export interface PaintCommand {
  readonly type: "paint";
  readonly targetTick: number;
  readonly sequence: number;
  readonly brush: BrushData & { readonly material: MaterialId };
}

export interface EraseCommand {
  readonly type: "erase";
  readonly targetTick: number;
  readonly sequence: number;
  readonly brush: BrushData;
}

export type SimulationCommand = PaintCommand | EraseCommand;

export interface SimulationView {
  readonly width: typeof WORLD_WIDTH;
  readonly height: typeof WORLD_HEIGHT;
  readonly tick: number;
  readonly material: Readonly<Uint8Array>;
  readonly lifetime: Readonly<Uint16Array>;
  readonly temperature: Readonly<Int16Array>;
}

export interface WorldSnapshot {
  readonly rulesetVersion: typeof RULESET_VERSION;
  readonly width: typeof WORLD_WIDTH;
  readonly height: typeof WORLD_HEIGHT;
  readonly tick: number;
  readonly seed: number;
  readonly randomState: number;
  readonly material: Uint8Array;
  readonly lifetime: Uint16Array;
  readonly temperature: Int16Array;
}

export interface Simulation {
  applyCommands(commands: readonly SimulationCommand[]): { readonly changed: boolean };
  advanceTick(): { readonly changed: boolean };
  snapshot(): WorldSnapshot;
  restore(snapshot: WorldSnapshot): void;
  view(): SimulationView;
}
