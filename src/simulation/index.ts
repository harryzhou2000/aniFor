import { DeterministicBackend } from './deterministic-backend';
import { PowderToyBackend } from './powder-toy-backend';
import type { SimulationBackend } from './types';
import { WasmBackend } from './wasm-backend';

// The UI depends only on SimulationBackend. A future Powder Toy module can be
// selected here without leaking its memory layout into rendering or controls.
export async function createSimulation(): Promise<SimulationBackend> {
  try {
    return await PowderToyBackend.load();
  } catch {
    // Keep the compact legacy core available for older static artifacts.
  }
  try {
    return await WasmBackend.load();
  } catch {
    return new DeterministicBackend();
  }
}

export type { SimulationBackend } from './types';
