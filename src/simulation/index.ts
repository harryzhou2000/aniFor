import { PowderToyBackend } from './powder-toy-backend';
import { RenderLabBackend } from './render-lab-backend';
import type { SimulationBackend } from './types';

// Ordinary worlds always use native TPT. A slow hosted download must never
// silently select a different solver or seed/autosave a smaller legacy world.
export async function createSimulation(options: { readonly renderLab?: boolean } = {}): Promise<SimulationBackend> {
  if (options.renderLab) return new RenderLabBackend(612, 384);
  return loadWithin(PowderToyBackend.load(), 30000, 'Native TPT took too long to load. Reload to retry.');
}

export type {
  NativeSign, NativeSignDraft, NativeSignJustification, SimulationBackend,
} from './types';

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
