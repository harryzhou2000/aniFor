import { describe, expect, it } from "vitest";
import { MaterialId, WORLD_HEIGHT, WORLD_WIDTH, type WorldSnapshot } from "../../src/simulation/contracts";
import { FIRE_LIFETIME, SMOKE_LIFETIME, SandboxSimulation } from "../../src/simulation/engine";
import { createHalfOccupiedFixture } from "../../src/simulation/fixture";
import { worldHash } from "../../src/simulation/hash";
import { rasterizeCircle, rasterizeSegment } from "../../src/simulation/raster";

const paint = (x: number, y: number, material: MaterialId, sequence = 0, targetTick = 0, radius = 0) => ({ type: "paint" as const, targetTick, sequence, brush: { x, y, radius, material } });
const cell = (x: number, y: number) => y * WORLD_WIDTH + x;
function patchedSnapshot(simulation: SandboxSimulation, edit: (material: Uint8Array, lifetime: Uint16Array) => void, state?: number, seed?: number): WorldSnapshot {
  const base = simulation.snapshot();
  const material = base.material.slice();
  const lifetime = base.lifetime.slice();
  edit(material, lifetime);
  return { ...base, material, lifetime, ...(state === undefined ? {} : { randomState: state }), ...(seed === undefined ? {} : { seed }) };
}

describe("deterministic simulation", () => {
  it("uses smoke, fire, sand, water passes and prevents double updates", () => {
    const simulation = new SandboxSimulation(4);
    simulation.applyCommands([paint(10, 10, MaterialId.Sand), paint(14, 10, MaterialId.Fire, 2)]);
    const setup = patchedSnapshot(simulation, (material, lifetime) => {
      material[cell(12, 10)] = MaterialId.Smoke;
      lifetime[cell(12, 10)] = SMOKE_LIFETIME;
    });
    simulation.restore(setup);
    simulation.advanceTick();
    const view = simulation.view();
    expect(view.material[cell(10, 11)]).toBe(MaterialId.Sand);
    expect([cell(12, 9), cell(11, 9), cell(13, 9)].some(index => view.material[index] === MaterialId.Smoke)).toBe(true);
    expect(view.material[cell(14, 9)]).toBe(MaterialId.Fire);
  });

  it("swaps sand through water and marks both occupants", () => {
    const simulation = new SandboxSimulation(1);
    simulation.applyCommands([
      paint(20, 10, MaterialId.Sand), paint(20, 11, MaterialId.Water, 1),
      paint(19, 10, MaterialId.Wall, 2), paint(21, 10, MaterialId.Wall, 3)
    ]);
    simulation.advanceTick();
    expect(simulation.view().material[cell(20, 11)]).toBe(MaterialId.Sand);
    expect(simulation.view().material[cell(20, 10)]).toBe(MaterialId.Water);
  });

  it("allows a later pass to fill an expired smoke or fire vacancy", () => {
    const simulation = new SandboxSimulation(3);
    const setup = patchedSnapshot(simulation, (material, lifetime) => {
      material[cell(30, 11)] = MaterialId.Smoke; lifetime[cell(30, 11)] = 1;
      material[cell(30, 10)] = MaterialId.Sand;
      material[cell(40, 11)] = MaterialId.Fire; lifetime[cell(40, 11)] = 1;
      material[cell(40, 10)] = MaterialId.Sand;
    }, 0x80000000);
    simulation.restore(setup);
    simulation.advanceTick();
    expect(simulation.view().material[cell(30, 11)]).toBe(MaterialId.Sand);
    expect(simulation.view().material[cell(40, 11)]).toBe(MaterialId.Sand);
  });

  it("clears a moved source marker and preserves first-writer-wins", () => {
    const vacancy = new SandboxSimulation(2);
    const vacancySetup = patchedSnapshot(vacancy, (material, lifetime) => {
      material[cell(30, 11)] = MaterialId.Smoke; lifetime[cell(30, 11)] = 2;
      material[cell(30, 10)] = MaterialId.Wall;
      material[cell(31, 11)] = MaterialId.Wall;
      material[cell(29, 11)] = MaterialId.Water;
      material[cell(29, 12)] = MaterialId.Wall;
    }, 2);
    vacancy.restore(vacancySetup);
    vacancy.advanceTick();
    expect(vacancy.view().material[cell(31, 10)]).toBe(MaterialId.Smoke);
    expect(vacancy.view().material[cell(30, 11)]).toBe(MaterialId.Water);

    const contention = new SandboxSimulation(256);
    const contentionSetup = patchedSnapshot(contention, (material) => {
      material[cell(29, 10)] = MaterialId.Sand;
      material[cell(31, 10)] = MaterialId.Sand;
      material[cell(29, 11)] = MaterialId.Wall;
      material[cell(31, 11)] = MaterialId.Wall;
    }, 256);
    contention.restore(contentionSetup);
    contention.advanceTick();
    expect(contention.view().material[cell(30, 11)]).toBe(MaterialId.Sand);
    expect(contention.view().material[cell(32, 11)]).toBe(MaterialId.Sand);
  });

  it("water chooses furthest contiguous space and only then tries opposite", () => {
    const simulation = new SandboxSimulation(2);
    simulation.applyCommands([paint(30, 10, MaterialId.Water), paint(30, 11, MaterialId.Wall, 1)]);
    simulation.advanceTick();
    const view = simulation.view();
    expect(view.material[cell(33, 10)]).toBe(MaterialId.Water);

    const opposite = new SandboxSimulation(2);
    opposite.applyCommands([paint(40, 10, MaterialId.Water), paint(40, 11, MaterialId.Wall, 1), paint(41, 10, MaterialId.Wall, 2)]);
    opposite.advanceTick();
    expect(opposite.view().material[cell(37, 10)]).toBe(MaterialId.Water);
  });

  it("defers fire-produced smoke and expires smoke by lifetime", () => {
    const simulation = new SandboxSimulation(5);
    const snapshot = patchedSnapshot(simulation, (material, lifetime) => {
      material[cell(40, 40)] = MaterialId.Fire;
      lifetime[cell(40, 40)] = 1;
    }, 2);
    simulation.restore(snapshot);
    simulation.advanceTick();
    expect(simulation.view().material[cell(40, 40)]).toBe(MaterialId.Smoke);
    expect(simulation.view().material[cell(40, 39)]).not.toBe(MaterialId.Smoke);

    const smoke = patchedSnapshot(simulation, (material, lifetime) => {
      material[cell(50, 50)] = MaterialId.Smoke;
      lifetime[cell(50, 50)] = 1;
    });
    simulation.restore(smoke);
    simulation.advanceTick();
    expect(simulation.view().material[cell(50, 50)]).toBe(MaterialId.Empty);

    const expires = new SandboxSimulation(5);
    const expiresSnapshot = patchedSnapshot(expires, (material, lifetime) => {
      material[cell(55, 55)] = MaterialId.Fire;
      lifetime[cell(55, 55)] = 1;
    }, 0x80000000);
    expires.restore(expiresSnapshot);
    expires.advanceTick();
    expect(expires.view().material[cell(55, 55)]).toBe(MaterialId.Empty);
  });

  it("reports lifetime-only changes for blocked fire and smoke", () => {
    const simulation = new SandboxSimulation(21);
    const setup = patchedSnapshot(simulation, (material, lifetime) => {
      const blocked = (x: number, y: number) => { material[cell(x, y)] = MaterialId.Wall; lifetime[cell(x, y)] = 0; };
      material[cell(80, 80)] = MaterialId.Fire; lifetime[cell(80, 80)] = 2;
      material[cell(120, 80)] = MaterialId.Smoke; lifetime[cell(120, 80)] = 2;
      for (const [x, y] of [[80, 79], [79, 79], [81, 79], [120, 79], [119, 79], [121, 79]]) blocked(x, y);
    });
    simulation.restore(setup);
    expect(simulation.advanceTick().changed).toBe(true);
    expect(simulation.view().lifetime[cell(80, 80)]).toBe(1);
    expect(simulation.view().lifetime[cell(120, 80)]).toBe(1);
  });

  it("rejects invalid snapshots with explicit material and lifetime rules", () => {
    const simulation = new SandboxSimulation();
    const unknown = patchedSnapshot(simulation, material => { material[0] = 9; });
    expect(() => simulation.restore(unknown)).toThrow();
    const staticLifetime = patchedSnapshot(simulation, (material, lifetime) => { material[0] = MaterialId.Wall; lifetime[0] = 1; });
    expect(() => simulation.restore(staticLifetime)).toThrow();
    const fireLifetime = patchedSnapshot(simulation, (material, lifetime) => { material[0] = MaterialId.Fire; lifetime[0] = FIRE_LIFETIME + 1; });
    expect(() => simulation.restore(fireLifetime)).toThrow();
    const smokeLifetime = patchedSnapshot(simulation, (material, lifetime) => { material[0] = MaterialId.Smoke; lifetime[0] = SMOKE_LIFETIME + 1; });
    expect(() => simulation.restore(smokeLifetime)).toThrow();
    const badState = patchedSnapshot(simulation, () => undefined, -1);
    expect(() => simulation.restore(badState)).toThrow();
  });

  it("rejects late/future commands and applies sequence order deterministically", () => {
    const simulation = new SandboxSimulation();
    expect(simulation.applyCommands([paint(1, 1, MaterialId.Wall, 0, -1)]).changed).toBe(false);
    expect(simulation.applyCommands([paint(1, 1, MaterialId.Wall, 0, 1)]).changed).toBe(false);
    simulation.applyCommands([paint(2, 2, MaterialId.Water, 2), paint(2, 2, MaterialId.Sand, 1)]);
    expect(simulation.view().material[cell(2, 2)]).toBe(MaterialId.Water);
    expect(simulation.applyCommands([paint(2, 2, MaterialId.Water, 2)]).changed).toBe(false);
  });

  it("protects snapshots, resumes equivalently, and reports unchanged work", () => {
    const simulation = new SandboxSimulation(8);
    expect(simulation.applyCommands([]).changed).toBe(false);
    expect(simulation.advanceTick().changed).toBe(false);
    simulation.applyCommands([paint(60, 20, MaterialId.Sand, 0, 1), paint(61, 20, MaterialId.Water, 1, 1), paint(62, 20, MaterialId.Fire, 2, 1)]);
    const saved = simulation.snapshot();
    saved.material[cell(60, 20)] = MaterialId.Empty;
    expect(simulation.view().material[cell(60, 20)]).toBe(MaterialId.Sand);
    const resumed = new SandboxSimulation();
    const restoreInput = simulation.snapshot();
    resumed.restore(restoreInput);
    const changedInput = { ...restoreInput, material: restoreInput.material.slice() };
    changedInput.material[cell(60, 20)] = MaterialId.Empty;
    expect(resumed.view().material[cell(60, 20)]).toBe(MaterialId.Sand);
    for (let i = 0; i < 10; i++) { simulation.advanceTick(); resumed.advanceTick(); }
    expect(worldHash(resumed.snapshot())).toBe(worldHash(simulation.snapshot()));
  });

  it("restoring a used engine clears its movement markers", () => {
    const source = new SandboxSimulation(17);
    source.applyCommands([paint(70, 21, MaterialId.Sand), paint(70, 22, MaterialId.Wall, 1)]);
    const saved = source.snapshot();

    const used = new SandboxSimulation(999);
    used.applyCommands([paint(70, 20, MaterialId.Sand), paint(70, 22, MaterialId.Wall, 1)]);
    used.advanceTick();
    used.restore(saved);
    const fresh = new SandboxSimulation(0);
    fresh.restore(saved);
    used.advanceTick();
    fresh.advanceTick();
    expect(worldHash(used.snapshot())).toBe(worldHash(fresh.snapshot()));
  });

  it("keeps material/lifetime invariants and provides an exact half fixture", () => {
    const simulation = createHalfOccupiedFixture(12);
    const initial = simulation.snapshot();
    expect(initial.material.reduce((count, material) => count + (material !== MaterialId.Empty ? 1 : 0), 0)).toBe(WORLD_WIDTH * WORLD_HEIGHT / 2);
    for (let i = 0; i < 20; i++) simulation.advanceTick();
    const view = simulation.view();
    for (let i = 0; i < view.material.length; i++) {
      if (view.material[i] === MaterialId.Empty || view.material[i] === MaterialId.Wall || view.material[i] === MaterialId.Sand || view.material[i] === MaterialId.Water) expect(view.lifetime[i]).toBe(0);
      else expect(view.lifetime[i]).toBeGreaterThan(0);
    }
  });

  it("clips brushes and has deterministic line rasterization", () => {
    expect(rasterizeCircle(0, 0, 2, 4, 4).every(point => point.x >= 0 && point.y >= 0 && point.x < 4 && point.y < 4)).toBe(true);
    expect(rasterizeSegment({ x: 0, y: 0 }, { x: 3, y: 2 })).toEqual([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 2 }]);
  });

  it("hashes the complete snapshot, including random identity", () => {
    const simulation = new SandboxSimulation(0x12345678);
    simulation.applyCommands([paint(7, 8, MaterialId.Sand), paint(9, 8, MaterialId.Fire, 1)]);
    simulation.advanceTick();
    const snapshot = simulation.snapshot();
    expect(worldHash(snapshot)).toBe("633be55b");
    const alteredState = { ...snapshot, randomState: (snapshot.randomState + 1) >>> 0 };
    const alteredSeed = { ...snapshot, seed: (snapshot.seed + 1) >>> 0 };
    expect(worldHash(alteredState)).not.toBe(worldHash(snapshot));
    expect(worldHash(alteredSeed)).not.toBe(worldHash(snapshot));
    const laterTick = { ...snapshot, tick: snapshot.tick + 2 ** 32 };
    expect(worldHash(laterTick)).not.toBe(worldHash(snapshot));
  });
});
