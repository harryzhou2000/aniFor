import { DeterministicBackend } from './deterministic-backend';
import { PowderToyBackend } from './powder-toy-backend';
import type { SimulationBackend } from './types';
import { WasmBackend } from './wasm-backend';

// The UI depends only on SimulationBackend. A future Powder Toy module can be
// selected here without leaking its memory layout into rendering or controls.
export async function createSimulation(options: { readonly renderLab?: boolean } = {}): Promise<SimulationBackend> {
  if (options.renderLab) return new DeterministicBackend(612, 384);
  try {
    return await loadWithin(PowderToyBackend.load(), 7000, 'Powder Toy startup timed out');
  } catch {
    // Keep the compact legacy core available for older static artifacts.
  }
  try {
    return await loadWithin(WasmBackend.load(), 3500, 'Compatibility core startup timed out');
  } catch {
    return new DeterministicBackend();
  }
}

export type { SimulationBackend } from './types';

function loadWithin<T>(promise: Promise<T>, milliseconds: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let finished = false;
    const timeout = globalThis.setTimeout(() => {
      finished = true;
      reject(new Error(message));
    }, milliseconds);
    promise.then((value) => {
      if (finished) return;
      finished = true;
      globalThis.clearTimeout(timeout);
      resolve(value);
    }, (error: unknown) => {
      if (finished) return;
      finished = true;
      globalThis.clearTimeout(timeout);
      reject(error);
    });
  });
}
