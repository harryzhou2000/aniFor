import { describe, expect, it } from "vitest";
import { createSandboxController } from "../../src/app";
import { MaterialId } from "../../src/simulation/contracts";

const intent = (tool: "sand" | "eraser", x = 4) => ({ tool, radius: 1, points: [{ x, y: 4 }] });

describe("application timeline", () => {
  it("paints immediately while paused and assigns frozen monotonic commands", () => {
    const app = createSandboxController();
    app.dispatch({ type: "pause", paused: true });
    app.paint(intent("sand"));
    const saved = app.snapshot();
    expect(saved.world.material[4 * 256 + 4]).toBe(MaterialId.Sand);
    expect(saved.nextSequence).toBe(1);
    app.paint(intent("eraser", 5));
    expect(app.snapshot().nextSequence).toBe(2);
  });

  it("drains snapshots, restores sequence, and clears without changing timeline state", () => {
    const app = createSandboxController({ seed: 17 });
    app.dispatch({ type: "pause", paused: true });
    app.paint(intent("sand"));
    const before = app.snapshot();
    app.step();
    app.restore(before);
    expect(app.snapshot()).toEqual(before);
    app.clear();
    const cleared = app.snapshot();
    expect(cleared.world.tick).toBe(before.world.tick);
    expect(cleared.world.seed).toBe(before.world.seed);
    expect(cleared.world.randomState).toBe(before.world.randomState);
    expect(cleared.nextSequence).toBe(before.nextSequence);
    expect(cleared.world.material.every((value) => value === MaterialId.Empty)).toBe(true);
  });

  it("drops late/future ingress and validates restored sequence", () => {
    const app = createSandboxController();
    app.dispatch({ type: "paint", command: { type: "paint", targetTick: 99, sequence: 4, brush: { x: 2, y: 2, radius: 0, material: MaterialId.Sand } } });
    expect(app.snapshot().nextSequence).toBe(0);
    expect(() => app.restore({ world: app.snapshot().world, nextSequence: -1 })).toThrow();
    const snapshot = app.snapshot();
    app.restore({ world: snapshot.world, nextSequence: 7 });
    app.dispatch({ type: "pause", paused: true }); app.paint(intent("sand"));
    expect(app.snapshot().nextSequence).toBe(8);
  });

  it("accepts only the next dispatch sequence and rejects exhaustion", () => {
    const app = createSandboxController();
    const command = (sequence: number, targetTick = 0) => ({ type: "paint" as const, targetTick, sequence, brush: { x: 9, y: 9, radius: 0, material: MaterialId.Wall } });
    app.dispatch({ type: "paint", command: command(0) });
    expect(app.snapshot().nextSequence).toBe(1);
    const unchanged = app.snapshot();
    app.dispatch({ type: "paint", command: command(0) });
    app.dispatch({ type: "paint", command: command(2) });
    app.dispatch({ type: "paint", command: command(1, 1) });
    expect(app.snapshot()).toEqual(unchanged);
    const exhausted = app.snapshot();
    app.restore({ world: exhausted.world, nextSequence: Number.MAX_SAFE_INTEGER });
    app.dispatch({ type: "paint", command: command(Number.MAX_SAFE_INTEGER) });
    expect(app.snapshot().nextSequence).toBe(Number.MAX_SAFE_INTEGER);
  });
});
