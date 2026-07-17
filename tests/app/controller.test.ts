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

  it("captures one defensive recovery snapshot and restores it exactly", () => {
    const app = createSandboxController({ seed: 31 });
    app.dispatch({ type: "pause", paused: true });
    app.paint(intent("sand", 12));
    const beforeClear = app.snapshot();
    app.clear();
    expect(app.canRecover).toBe(true);
    app.paint(intent("eraser", 12));
    app.step();
    expect(app.recover()).toBe(true);
    expect(app.snapshot()).toEqual(beforeClear);
    expect(app.canRecover).toBe(false);
    expect(app.recover()).toBe(false);
  });

  it("replaces the recovery slot and preserves the cleared timeline", () => {
    const app = createSandboxController({ seed: 43 });
    app.dispatch({ type: "pause", paused: true });
    app.paint(intent("sand", 20));
    app.step();
    const firstClearSource = app.snapshot();
    app.clear();
    app.paint(intent("sand", 21));
    const replacement = app.snapshot();
    app.clear();
    expect(app.canRecover).toBe(true);
    expect(app.recover()).toBe(true);
    expect(app.snapshot()).toEqual(replacement);
    expect(app.snapshot()).not.toEqual(firstClearSource);
    expect(app.snapshot().world.material[4 * 256 + 21]).toBe(MaterialId.Sand);
  });

  it("keeps recovery ownership isolated from later engine state and pending work", () => {
    const app = createSandboxController({ seed: 57 });
    app.dispatch({ type: "pause", paused: true });
    app.paint(intent("sand", 30));
    const saved = app.snapshot();
    app.clear();
    app.dispatch({ type: "paint", command: { type: "paint", targetTick: 999, sequence: saved.nextSequence, brush: { x: 31, y: 4, radius: 0, material: MaterialId.Wall } } });
    app.paint(intent("sand", 32));
    const afterClearWork = app.snapshot();
    expect(afterClearWork.world.material[4 * 256 + 32]).toBe(MaterialId.Sand);
    expect(app.recover()).toBe(true);
    expect(app.snapshot()).toEqual(saved);
  });

  it("atomically replaces the timeline and recovers the prior one", () => {
    const app = createSandboxController({ seed: 71 });
    app.dispatch({ type: "pause", paused: true });
    app.paint(intent("sand", 40));
    const prior = app.snapshot();
    const incomingWorld = {
      ...prior.world,
      tick: 12,
      material: prior.world.material.slice(),
      lifetime: prior.world.lifetime.slice()
    };
    incomingWorld.material[41 * 256 + 41] = MaterialId.Wall;
    const incoming = { world: incomingWorld, nextSequence: 22 };
    expect(app.replaceWithRecovery(incoming)).toBe(true);
    expect(app.snapshot()).toEqual(incoming);
    expect(app.canRecover).toBe(true);
    expect(app.recover()).toBe(true);
    expect(app.snapshot()).toEqual(prior);
    expect(app.canRecover).toBe(false);
  });

  it("rejects corrupt worlds and invalid sequences without changing state or recovery", () => {
    const app = createSandboxController({ seed: 73 });
    app.dispatch({ type: "pause", paused: true });
    app.paint(intent("sand", 50));
    app.clear();
    const before = app.snapshot();
    const corruptWorld = { ...before.world, material: before.world.material.slice(), lifetime: before.world.lifetime.slice() };
    corruptWorld.material[0] = 99;
    expect(app.replaceWithRecovery({ world: corruptWorld, nextSequence: 4 })).toBe(false);
    expect(app.snapshot()).toEqual(before);
    expect(app.canRecover).toBe(true);
    expect(app.replaceWithRecovery({ world: before.world, nextSequence: -1 })).toBe(false);
    expect(app.snapshot()).toEqual(before);
    expect(app.canRecover).toBe(true);
  });

  it("replaces an existing recovery slot and owns incoming arrays defensively", () => {
    const app = createSandboxController({ seed: 79 });
    app.dispatch({ type: "pause", paused: true });
    app.paint(intent("sand", 60));
    app.clear();
    app.paint(intent("sand", 61));
    const incoming = app.snapshot();
    const incomingMaterial = incoming.world.material;
    expect(app.replaceWithRecovery(incoming)).toBe(true);
    incomingMaterial[62 * 256 + 62] = MaterialId.Fire;
    expect(app.snapshot().world.material[62 * 256 + 62]).toBe(MaterialId.Empty);
    expect(app.recover()).toBe(true);
    expect(app.snapshot().world.material[4 * 256 + 61]).toBe(MaterialId.Sand);
    expect(app.snapshot().world.material[4 * 256 + 50]).toBe(MaterialId.Empty);
  });
});
