import { describe, expect, it } from "vitest";
import { createFrameScheduler, TICK_DURATION_WINDOW } from "../../src/app";

function fakeFrames() {
  let next = 0; let pending: { id: number; callback: (time: number) => void } | undefined;
  return {
    request: (callback: (time: number) => void) => { const id = next++; pending = { id, callback }; return id; },
    cancel: (id: number) => { if (pending?.id === id) pending = undefined; },
    run: (time: number) => { const current = pending; pending = undefined; current?.callback(time); }
  };
}

function visibility() {
  const listeners = new Set<() => void>();
  return { addEventListener: (_: string, listener: EventListenerOrEventListenerObject) => listeners.add(listener as () => void), removeEventListener: (_: string, listener: EventListenerOrEventListenerObject) => listeners.delete(listener as () => void), fire: () => listeners.forEach(listener => listener()), size: () => listeners.size };
}

describe("fixed scheduler", () => {
  it("clamps at 250ms, caps at four, and retains fractional remainder", () => {
    const frames = fakeFrames(); let ticks = 0;
    const scheduler = createFrameScheduler({ onTick: () => { ticks++; return true; }, onRender: () => {}, requestFrame: frames.request, cancelFrame: frames.cancel, isHidden: () => false });
    scheduler.start(); frames.run(0); frames.run(250); expect(ticks).toBe(4); expect(scheduler.diagnostics.droppedTicks).toBe(3);
    frames.run(250 + 1000 / 60); expect(ticks).toBe(4); frames.run(250 + 1000 / 60 + 20); expect(ticks).toBe(5);
  });

  it("is frame-schedule independent at normal cadence", () => {
    const run = (times: number[]) => { const frames = fakeFrames(); let ticks = 0; const scheduler = createFrameScheduler({ onTick: () => { ticks++; return true; }, onRender: () => {}, requestFrame: frames.request, cancelFrame: frames.cancel, isHidden: () => false }); scheduler.start(); times.forEach(time => frames.run(time)); return { ticks, diagnostics: scheduler.diagnostics }; };
    expect(run([0, 16.666, 33.333, 50, 66.666]).ticks).toBe(run([0, 8, 17, 29, 41, 53, 66.666]).ticks);
    expect(run([0, 16.666, 33.333, 50, 66.666]).diagnostics.catchUpCapHits).toBe(0);
  });

  it("resets on hidden visibility changes, pause/resume, and disposes cleanly", () => {
    const frames = fakeFrames(); const target = visibility(); let hidden = false; let ticks = 0;
    const scheduler = createFrameScheduler({ onTick: () => { ticks++; return true; }, onRender: () => {}, requestFrame: frames.request, cancelFrame: frames.cancel, isHidden: () => hidden, visibilityTarget: target });
    scheduler.start(); frames.run(0); frames.run(30); hidden = true; target.fire(); frames.run(10000); hidden = false; target.fire(); frames.run(10010); expect(ticks).toBe(0);
    scheduler.setPaused(true); frames.run(20000); scheduler.step(); expect(ticks).toBe(1); scheduler.setPaused(false); frames.run(20010); expect(ticks).toBe(1);
    scheduler.stop(); expect(target.size()).toBe(0); frames.run(30000);
  });

  it("keeps only the bounded diagnostic duration window", () => {
    const frames = fakeFrames(); let ticks = 0;
    const scheduler = createFrameScheduler({ onTick: () => { ticks++; return true; }, onRender: () => {}, requestFrame: frames.request, cancelFrame: frames.cancel, isHidden: () => false });
    scheduler.start(); frames.run(0);
    for (let index = 1; index <= TICK_DURATION_WINDOW + 10; index += 1) frames.run(index * 40);
    expect(ticks).toBeGreaterThan(TICK_DURATION_WINDOW);
    expect(scheduler.diagnostics.tickDurations).toHaveLength(TICK_DURATION_WINDOW);
  });
});
