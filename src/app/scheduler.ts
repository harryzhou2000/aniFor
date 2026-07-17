export interface SchedulerDiagnostics {
  readonly catchUpCapHits: number;
  readonly droppedTicks: number;
  readonly tickDurations: readonly number[];
}

export interface FrameSchedulerOptions {
  readonly tickMs?: number;
  readonly maxTicksPerFrame?: number;
  readonly now?: () => number;
  readonly requestFrame?: (callback: (time: number) => void) => number;
  readonly cancelFrame?: (handle: number) => void;
  readonly isHidden?: () => boolean;
  readonly visibilityTarget?: Pick<EventTarget, "addEventListener" | "removeEventListener">;
  readonly onTick: () => boolean;
  readonly onRender: () => void;
}

export interface FrameScheduler {
  readonly diagnostics: SchedulerDiagnostics;
  readonly paused: boolean;
  start(): void;
  stop(): void;
  setPaused(paused: boolean): void;
  step(): void;
  invalidate(): void;
}

export const TICK_DURATION_WINDOW = 1024;

const browserRequest = (callback: (time: number) => void): number => requestAnimationFrame(callback);
const browserCancel = (handle: number): void => cancelAnimationFrame(handle);

export function createFrameScheduler(options: FrameSchedulerOptions): FrameScheduler {
  const tickMs = options.tickMs ?? 1000 / 30;
  const maxTicks = options.maxTicksPerFrame ?? 4;
  const now = options.now ?? (() => performance.now());
  const request = options.requestFrame ?? browserRequest;
  const cancel = options.cancelFrame ?? browserCancel;
  const hidden = options.isHidden ?? (() => document.hidden);
  const visibilityTarget = options.visibilityTarget ?? (typeof document === "undefined" ? undefined : document);
  let accumulator = 0;
  let timestamp: number | null = null;
  let handle: number | null = null;
  let running = false;
  let paused = false;
  let capHits = 0;
  let dropped = 0;
  const durations: number[] = [];
  const resetTimestamp = (): void => { timestamp = null; };
  const onVisibilityChange = (): void => { resetTimestamp(); };

  const render = (): void => options.onRender();
  const frame = (time: number): void => {
    handle = null;
    if (!running) return;
    if (paused || hidden()) {
      timestamp = null;
      handle = request(frame);
      return;
    }
    if (timestamp === null) timestamp = time;
    const elapsed = Math.min(250, Math.max(0, time - timestamp));
    timestamp = time;
    accumulator += elapsed;
    let changed = false;
    let ticks = 0;
    while (accumulator >= tickMs && ticks < maxTicks) {
      const started = now();
      changed = options.onTick() || changed;
      durations.push(Math.max(0, now() - started));
      if (durations.length > TICK_DURATION_WINDOW) durations.shift();
      accumulator -= tickMs;
      ticks++;
    }
    if (ticks === maxTicks && accumulator >= tickMs) {
      const whole = Math.floor(accumulator / tickMs);
      accumulator -= whole * tickMs;
      dropped += whole;
      capHits++;
    }
    if (changed) render();
    handle = request(frame);
  };
  const scheduler: FrameScheduler = {
    get diagnostics(): SchedulerDiagnostics { return { catchUpCapHits: capHits, droppedTicks: dropped, tickDurations: durations.slice() }; },
    get paused(): boolean { return paused; },
    start(): void {
      if (running) return;
      running = true; resetTimestamp();
      visibilityTarget?.addEventListener("visibilitychange", onVisibilityChange);
      render(); handle = request(frame);
    },
    stop(): void {
      running = false; resetTimestamp(); accumulator = 0;
      visibilityTarget?.removeEventListener("visibilitychange", onVisibilityChange);
      if (handle !== null) { cancel(handle); handle = null; }
    },
    setPaused(next): void { if (paused === next) return; paused = next; timestamp = null; if (!next) render(); },
    step(): void { if (!paused) return; if (options.onTick()) render(); },
    invalidate(): void { render(); }
  };
  return scheduler;
}
