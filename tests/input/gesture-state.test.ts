import { describe, expect, it } from "vitest";
import { PointerGestureState } from "../../src/input/gesture-state";
import { rasterLine } from "../../src/input/raster";
import { rasterizeSegment } from "../../src/simulation/raster";

describe("input raster seam", () => {
  it("uses the authoritative deterministic segment rasterizer", () => {
    const from = { x: 2, y: 7 }; const to = { x: 8, y: 3 };
    expect(rasterLine(from, to)).toEqual(rasterizeSegment(from, to));
  });
});

describe("pointer gesture state", () => {
  it("cancels paint when a second pointer arrives and cannot resume it until all release", () => {
    const state = new PointerGestureState();
    expect(state.begin(1, { x: 10, y: 10 })).toBe("paint");
    expect(state.begin(2, { x: 30, y: 10 })).toBe("cancel-paint");
    expect(state.currentMode).toBe("gesture");
    state.end(2);
    expect(state.move(1, { x: 11, y: 10 })).toBeNull();
    state.end(1);
    expect(state.currentMode).toBe("idle");
    expect(state.begin(3, { x: 5, y: 5 })).toBe("paint");
  });

  it("emits only direct pan and pinch deltas without inertia", () => {
    const state = new PointerGestureState();
    state.begin(1, { x: 0, y: 0 }); state.begin(2, { x: 10, y: 0 });
    expect(state.move(2, { x: 20, y: 0 })).toEqual({ oldCenter: { x: 5, y: 0 }, center: { x: 10, y: 0 }, oldDistance: 10, distance: 20 });
    state.end(2);
    expect(state.move(1, { x: 30, y: 0 })).toBeNull();
  });

  it("clears all active ownership on cancellation", () => {
    const state = new PointerGestureState();
    state.begin(1, { x: 1, y: 1 }); state.begin(2, { x: 2, y: 2 });
    expect(state.cancel()).toEqual([1, 2]);
    expect(state.currentMode).toBe("idle");
  });

  it("rebases without a camera jump when one finger is replaced", () => {
    const state = new PointerGestureState();
    state.begin(1, { x: 10, y: 10 }); state.begin(2, { x: 30, y: 10 });
    state.move(2, { x: 32, y: 10 });
    state.cancel(2); // pointercancel/lostcapture rebase the surviving contact.
    state.begin(3, { x: 50, y: 30 });
    expect(state.move(1, { x: 10, y: 10 })).toEqual({ oldCenter: { x: 30, y: 20 }, center: { x: 30, y: 20 }, oldDistance: Math.hypot(40, 20), distance: Math.hypot(40, 20) });
  });

  it("rebases when a third finger is added or removed", () => {
    const state = new PointerGestureState();
    state.begin(1, { x: 0, y: 0 }); state.begin(2, { x: 20, y: 0 });
    state.move(2, { x: 24, y: 0 });
    state.begin(3, { x: 80, y: 50 });
    expect(state.move(1, { x: 0, y: 0 })).toEqual({ oldCenter: { x: 12, y: 0 }, center: { x: 12, y: 0 }, oldDistance: 24, distance: 24 });
    state.end(1);
    expect(state.move(2, { x: 24, y: 0 })).toEqual({ oldCenter: { x: 52, y: 25 }, center: { x: 52, y: 25 }, oldDistance: Math.hypot(56, 50), distance: Math.hypot(56, 50) });
  });
});
