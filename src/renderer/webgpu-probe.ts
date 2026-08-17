/**
 * An explicitly opt-in readiness probe for the future compute presentation
 * path. It never selects a renderer, allocates a presentation surface, or
 * competes with the canonical WebGL context: a returned device is immediately
 * released after its adapter/device pair has proven usable.
 */
export type WebGPUProbeStatus = 'unavailable' | 'no-adapter' | 'ready' | 'device-error'
  | 'compute-ready' | 'compute-error';

export interface WebGPUProbeResult {
  readonly status: WebGPUProbeStatus;
  readonly label: 'WebGPU unavailable' | 'WebGPU adapter unavailable' | 'WebGPU ready'
    | 'WebGPU device error' | 'WebGPU compute ready' | 'WebGPU compute error';
}

interface WebGPUBufferLike {
  destroy?(): void;
  getMappedRange(): ArrayBuffer;
  mapAsync(mode: number): Promise<void>;
  unmap(): void;
}
interface WebGPUComputePassLike {
  setPipeline(pipeline: unknown): void;
  setBindGroup(index: number, bindGroup: unknown): void;
  dispatchWorkgroups(x: number): void;
  end(): void;
}
interface WebGPUCommandEncoderLike {
  beginComputePass(): WebGPUComputePassLike;
  copyBufferToBuffer(source: WebGPUBufferLike, sourceOffset: number,
    destination: WebGPUBufferLike, destinationOffset: number, size: number): void;
  finish(): unknown;
}
interface WebGPUQueueLike {
  writeBuffer(buffer: WebGPUBufferLike, offset: number, data: ArrayBufferView): void;
  submit(commandBuffers: readonly unknown[]): void;
  onSubmittedWorkDone?(): Promise<void>;
}
interface WebGPUDeviceLike {
  readonly queue: WebGPUQueueLike;
  destroy?(): void;
  createShaderModule(descriptor: { readonly code: string }): unknown;
  createComputePipeline(descriptor: { readonly layout: 'auto'; readonly compute: {
    readonly module: unknown; readonly entryPoint: string;
  } }): { getBindGroupLayout(index: number): unknown };
  createBuffer(descriptor: { readonly size: number; readonly usage: number }): WebGPUBufferLike;
  createBindGroup(descriptor: { readonly layout: unknown; readonly entries: readonly {
    readonly binding: number; readonly resource: { readonly buffer: WebGPUBufferLike };
  }[] }): unknown;
  createCommandEncoder(): WebGPUCommandEncoderLike;
}
interface WebGPUAdapterLike { requestDevice(): Promise<WebGPUDeviceLike> }
interface WebGPULike { requestAdapter(): Promise<WebGPUAdapterLike | null> }

function webGPU(): WebGPULike | undefined {
  return (navigator as Navigator & { gpu?: WebGPULike }).gpu;
}

export function webGPUProbeRequested(search = globalThis.location?.search ?? ''): boolean {
  return new URLSearchParams(search).get('webgpuProbe') === '1';
}

export function webGPUComputeProbeRequested(search = globalThis.location?.search ?? ''): boolean {
  return new URLSearchParams(search).get('webgpuComputeProbe') === '1';
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

/**
 * One executable compute-path receipt for the future volume-field pipeline.
 * It runs a 32-sample five-tap density smoothing pass and checks a readback;
 * no current renderer texture, canvas, or field is imported into this probe.
 */
export async function probeWebGPUCompute(): Promise<WebGPUProbeResult> {
  const gpu = webGPU();
  if (!gpu) return { status: 'unavailable', label: 'WebGPU unavailable' };
  let device: WebGPUDeviceLike | undefined;
  const buffers: WebGPUBufferLike[] = [];
  try {
    const adapter = await gpu.requestAdapter();
    if (!adapter) return { status: 'no-adapter', label: 'WebGPU adapter unavailable' };
    device = await adapter.requestDevice();
    const samples = Float32Array.from({ length: 32 }, (_, index) => index % 2);
    const bytes = samples.byteLength;
    // WebGPU numeric flags: MAP_READ=1, COPY_SRC=4, COPY_DST=8, STORAGE=128.
    const source = device.createBuffer({ size: bytes, usage: 8 | 128 });
    const smoothed = device.createBuffer({ size: bytes, usage: 4 | 128 });
    const readback = device.createBuffer({ size: bytes, usage: 1 | 8 });
    buffers.push(source, smoothed, readback);
    device.queue.writeBuffer(source, 0, samples);
    const module = device.createShaderModule({ code: `
      @group(0) @binding(0) var<storage, read> source: array<f32>;
      @group(0) @binding(1) var<storage, read_write> smoothed: array<f32>;
      @compute @workgroup_size(32)
      fn smoothDensity(@builtin(global_invocation_id) id: vec3<u32>) {
        let index = id.x;
        if (index >= 32u) { return; }
        let left2 = source[select(index - 2u, 0u, index < 2u)];
        let left1 = source[select(index - 1u, 0u, index < 1u)];
        let right1 = source[min(31u, index + 1u)];
        let right2 = source[min(31u, index + 2u)];
        smoothed[index] = (left2 + 4.0 * left1 + 6.0 * source[index]
          + 4.0 * right1 + right2) / 16.0;
      }
    ` });
    const pipeline = device.createComputePipeline({
      layout: 'auto', compute: { module, entryPoint: 'smoothDensity' },
    });
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: source } },
        { binding: 1, resource: { buffer: smoothed } },
      ],
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(1);
    pass.end();
    encoder.copyBufferToBuffer(smoothed, 0, readback, 0, bytes);
    device.queue.submit([encoder.finish()]);
    await device.queue.onSubmittedWorkDone?.();
    await readback.mapAsync(1);
    const values = new Float32Array(readback.getMappedRange().slice(0));
    readback.unmap();
    if (!Number.isFinite(values[16]) || values[16] < 0.20 || values[16] > 0.80) {
      throw new Error('Unexpected WebGPU density smoothing readback');
    }
    return { status: 'compute-ready', label: 'WebGPU compute ready' };
  } catch {
    return { status: 'compute-error', label: 'WebGPU compute error' };
  } finally {
    for (const buffer of buffers) try { buffer.destroy?.(); } catch { /* release best effort */ }
    try { device?.destroy?.(); } catch { /* release best effort */ }
  }
}
