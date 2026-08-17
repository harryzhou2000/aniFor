/**
 * An explicitly opt-in readiness probe for the future compute presentation
 * path. It never selects a renderer, allocates a presentation surface, or
 * competes with the canonical WebGL context: a returned device is immediately
 * released after its adapter/device pair has proven usable.
 */
export type WebGPUProbeStatus = 'unavailable' | 'no-adapter' | 'ready' | 'device-error';

export interface WebGPUProbeResult {
  readonly status: WebGPUProbeStatus;
  readonly label: 'WebGPU unavailable' | 'WebGPU adapter unavailable' | 'WebGPU ready' | 'WebGPU device error';
}

interface WebGPUDeviceLike { destroy?(): void }
interface WebGPUAdapterLike { requestDevice(): Promise<WebGPUDeviceLike> }
interface WebGPULike { requestAdapter(): Promise<WebGPUAdapterLike | null> }

function webGPU(): WebGPULike | undefined {
  return (navigator as Navigator & { gpu?: WebGPULike }).gpu;
}

export function webGPUProbeRequested(search = globalThis.location?.search ?? ''): boolean {
  return new URLSearchParams(search).get('webgpuProbe') === '1';
}

export async function probeWebGPU(): Promise<WebGPUProbeResult> {
  const gpu = webGPU();
  if (!gpu) return { status: 'unavailable', label: 'WebGPU unavailable' };
  try {
    const adapter = await gpu.requestAdapter();
    if (!adapter) return { status: 'no-adapter', label: 'WebGPU adapter unavailable' };
    const device = await adapter.requestDevice();
    try { device.destroy?.(); } catch { /* device lifetime is advisory for a probe */ }
    return { status: 'ready', label: 'WebGPU ready' };
  } catch {
    return { status: 'device-error', label: 'WebGPU device error' };
  }
}
