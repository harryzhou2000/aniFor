import { createSimulation } from "../simulation/engine";
import { MaterialId, type Simulation, type SimulationCommand } from "../simulation/contracts";
import type { AppIntent, AppView, AuthoritativeSnapshot } from "./contracts";
import type { PaintIntent } from "../input";
import { createFrameScheduler, type FrameScheduler, type FrameSchedulerOptions } from "./scheduler";

export interface SandboxController {
  readonly simulation: Simulation;
  readonly scheduler: FrameScheduler;
  readonly paused: boolean;
  readonly canRecover: boolean;
  view(): AppView;
  paint(intent: PaintIntent): void;
  dispatch(intent: AppIntent): void;
  drain(): boolean;
  step(): void;
  snapshot(): AuthoritativeSnapshot;
  restore(snapshot: AuthoritativeSnapshot): void;
  replaceWithRecovery(incoming: AuthoritativeSnapshot): boolean;
  clear(): void;
  recover(): boolean;
  dispose(): void;
}

export interface SandboxControllerOptions {
  readonly seed?: number;
  readonly simulation?: Simulation;
  readonly scheduler?: Omit<FrameSchedulerOptions, "onTick" | "onRender">;
  readonly onRender?: (view: AppView) => void;
  readonly onAdvance?: () => void;
}

export function createSandboxController(options: SandboxControllerOptions = {}): SandboxController {
  const simulation = options.simulation ?? createSimulation(options.seed);
  let paused = false;
  let nextSequence = 0;
  let queue: SimulationCommand[] = [];
  let recovery: AuthoritativeSnapshot | null = null;
  let disposed = false;
  const render = (): void => options.onRender?.({ simulation: simulation.view(), paused });
  const drain = (): boolean => {
    if (queue.length === 0) return false;
    const result = simulation.applyCommands(queue);
    queue = [];
    return result.changed;
  };
  const tick = (): boolean => {
    const changed = drain();
    const advanced = simulation.advanceTick();
    options.onAdvance?.();
    return advanced.changed || changed;
  };
  const scheduler = createFrameScheduler({ ...options.scheduler, onTick: tick, onRender: render });
  const paint = (intent: PaintIntent): void => {
    const targetTick = simulation.view().tick;
    const radius = Math.max(0, Math.round(intent.radius));
    for (const point of intent.points) {
      if (nextSequence >= Number.MAX_SAFE_INTEGER) throw new Error("Command sequence exhausted.");
      const sequence = nextSequence++;
      const command = intent.tool === "eraser"
        ? { type: "erase" as const, targetTick, sequence, brush: Object.freeze({ x: Math.round(point.x), y: Math.round(point.y), radius }) }
        : { type: "paint" as const, targetTick, sequence, brush: Object.freeze({ x: Math.round(point.x), y: Math.round(point.y), radius, material: toolMaterial(intent.tool) }) };
      queue.push(Object.freeze(command));
    }
    if (drain()) render();
  };
  const clear = (): void => {
    drain();
    const world = simulation.snapshot();
    recovery = cloneAuthoritative({ world, nextSequence });
    world.material.fill(MaterialId.Empty);
    world.lifetime.fill(0);
    simulation.restore(world);
    queue = [];
    render();
  };
  const recover = (): boolean => {
    if (recovery === null) return false;
    const stored = recovery;
    simulation.restore(stored.world);
    nextSequence = stored.nextSequence;
    queue = [];
    recovery = null;
    render();
    return true;
  };
  const replaceWithRecovery = (incoming: AuthoritativeSnapshot): boolean => {
    if (!validAuthoritativeSnapshot(incoming)) return false;
    drain();
    const current = cloneAuthoritative({ world: simulation.snapshot(), nextSequence });
    try {
      simulation.restore(incoming.world);
    } catch {
      return false;
    }
    recovery = current;
    nextSequence = incoming.nextSequence;
    queue = [];
    render();
    return true;
  };
  const dispatch = (intent: AppIntent): void => {
    if (intent.type === "paint" || intent.type === "erase") {
      if (intent.command.targetTick !== simulation.view().tick ||
          !Number.isSafeInteger(intent.command.sequence) || intent.command.sequence < 0 ||
          intent.command.sequence !== nextSequence || nextSequence >= Number.MAX_SAFE_INTEGER) return;
      nextSequence += 1;
      queue.push(Object.freeze(intent.command));
      if (drain()) render();
      return;
    }
    if (intent.type === "pause") { paused = intent.paused; scheduler.setPaused(paused); render(); return; }
    clear();
  };
  const controller: SandboxController = {
    simulation, scheduler,
    get paused(): boolean { return paused; },
    get canRecover(): boolean { return recovery !== null; },
    view: () => ({ simulation: simulation.view(), paused }),
    paint, dispatch, drain,
    step(): void { if (paused) scheduler.step(); },
    snapshot(): AuthoritativeSnapshot { drain(); return { world: simulation.snapshot(), nextSequence }; },
    restore(snapshot): void {
      if (!Number.isSafeInteger(snapshot.nextSequence) || snapshot.nextSequence < 0) throw new Error("Invalid sequence state");
      simulation.restore(snapshot.world); nextSequence = snapshot.nextSequence; queue = []; render();
    },
    clear, recover, replaceWithRecovery,
    dispose(): void { if (!disposed) { disposed = true; scheduler.stop(); } }
  };
  return controller;
}

function validAuthoritativeSnapshot(snapshot: AuthoritativeSnapshot): boolean {
  if (!snapshot || !Number.isSafeInteger(snapshot.nextSequence) || snapshot.nextSequence < 0) return false;
  try {
    // Validate through an isolated engine so no live state, queue, or recovery slot is touched.
    createSimulation(snapshot.world.seed).restore(snapshot.world);
    return true;
  } catch {
    return false;
  }
}

function cloneAuthoritative(snapshot: AuthoritativeSnapshot): AuthoritativeSnapshot {
  return {
    nextSequence: snapshot.nextSequence,
    world: {
      ...snapshot.world,
      material: snapshot.world.material.slice(),
      lifetime: snapshot.world.lifetime.slice()
    }
  };
}

function toolMaterial(tool: PaintIntent["tool"]): MaterialId {
  return ({ wall: MaterialId.Wall, sand: MaterialId.Sand, water: MaterialId.Water, fire: MaterialId.Fire } as const)[tool as "wall" | "sand" | "water" | "fire"];
}

export { createFrameScheduler } from "./scheduler";
