import type {
  EraseCommand,
  GridPoint,
  PaintCommand,
  SimulationCommand,
  SimulationView,
  WorldSnapshot
} from "../simulation/contracts";

export interface AuthoritativeSnapshot {
  readonly world: WorldSnapshot;
  readonly nextSequence: number;
}

export type AppIntent =
  | { readonly type: "paint"; readonly command: PaintCommand }
  | { readonly type: "erase"; readonly command: EraseCommand }
  | { readonly type: "pause"; readonly paused: boolean }
  | { readonly type: "clear" };

export interface Camera {
  screenToCell(screenX: number, screenY: number): GridPoint;
  zoomAt(screenX: number, screenY: number, factor: number): void;
  panBy(deltaX: number, deltaY: number): void;
}

export interface AppView {
  readonly simulation: SimulationView;
  readonly paused: boolean;
}

export type QueuedCommand = SimulationCommand;
