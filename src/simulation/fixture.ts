import { MaterialId, WORLD_HEIGHT, WORLD_WIDTH } from "./contracts";
import { SandboxSimulation } from "./engine";

/** Deterministic, half-occupied input for integration benchmarks. */
export function createHalfOccupiedFixture(seed = 1): SandboxSimulation {
  const simulation = new SandboxSimulation(seed);
  const snapshot = simulation.snapshot();
  // Every even row is occupied: 96 * 256 = exactly half of the world.
  for (let y = 0; y < WORLD_HEIGHT; y++) {
    if ((y & 1) !== 0) continue;
    for (let x = 0; x < WORLD_WIDTH; x++) {
      const index = y * WORLD_WIDTH + x;
      snapshot.material[index] = (x + y) % 3 === 0 ? MaterialId.Sand : (x & 1) === 0 ? MaterialId.Water : MaterialId.Wall;
      snapshot.temperature[index] = 200;
    }
  }
  simulation.restore(snapshot);
  return simulation;
}
