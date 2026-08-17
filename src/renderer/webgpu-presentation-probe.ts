/**
 * A deliberately isolated WebGPU presentation capability probe.
 *
 * The canonical semantic renderer is still GLSL/WebGL2, so selecting Pixi's
 * WebGPU preference would not be an honest fallback: it cannot consume the
 * current custom shader program. This probe instead validates the smallest
 * useful future seam—adapter, device, canvas configuration, and one submitted
 * clear pass—without touching the live canvas, renderer resources, or WebGL
 * recovery path.
 */
export type WebGpuPresentationProbeStatus =
  | 'unsupported'
  | 'adapter-unavailable'
  | 'context-unavailable'
  | 'configured'
  | 'failed';

export interface WebGpuPresentationProbeResult {
  readonly status: WebGpuPresentationProbeStatus;
  readonly detail?: string;
}

/**
 * Performs no scene rendering and never changes the application canvas. It is
 * exposed only behind `?webgpuProbe=1` so a browser can report whether a future
 * WebGPU renderer has a real presentation foothold rather than merely feature
 * detection.
 */
export async function probeWebGpuPresentation(): Promise<WebGpuPresentationProbeResult> {
  if (typeof document === 'undefined' || typeof navigator === 'undefined') {
    return { status: 'unsupported', detail: 'browser APIs unavailable' };
  }
  const gpu = navigator.gpu;
  if (!gpu) return { status: 'unsupported', detail: 'navigator.gpu unavailable' };

  try {
    const adapter = await gpu.requestAdapter();
    if (!adapter) return { status: 'adapter-unavailable' };
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgpu') as GPUCanvasContext | null;
    if (!context) return { status: 'context-unavailable' };
    const device = await adapter.requestDevice();
    context.configure({ device, format: gpu.getPreferredCanvasFormat(), alphaMode: 'premultiplied' });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        clearValue: { r: 0.04, g: 0.08, b: 0.12, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    pass.end();
    device.queue.submit([encoder.finish()]);
    context.unconfigure?.();
    return { status: 'configured' };
  } catch (error) {
    return { status: 'failed', detail: error instanceof Error ? error.name : 'unknown error' };
  }
}
