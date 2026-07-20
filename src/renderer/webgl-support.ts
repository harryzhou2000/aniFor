export interface WebGLCapabilities {
  readonly supported: boolean;
  readonly maxRenderbufferSize: number;
  readonly maxViewportWidth: number;
  readonly maxViewportHeight: number;
  readonly maxTextureSize: number;
}

const UNSUPPORTED_WEBGL: WebGLCapabilities = {
  supported: false,
  maxRenderbufferSize: 0,
  maxViewportWidth: 0,
  maxViewportHeight: 0,
  maxTextureSize: 0,
};

/**
 * Probes the limits that bound the root presentation target, then explicitly
 * releases the short-lived context so Pixi can create the only live context.
 */
export function probeWebGLCapabilities(): WebGLCapabilities {
  const probe = document.createElement('canvas');
  const context = probe.getContext('webgl2') ?? probe.getContext('webgl');
  if (!context || context.isContextLost()) return UNSUPPORTED_WEBGL;
  try {
    const maxRenderbufferSize = Number(context.getParameter(context.MAX_RENDERBUFFER_SIZE));
    const maxTextureSize = Number(context.getParameter(context.MAX_TEXTURE_SIZE));
    const viewport = context.getParameter(context.MAX_VIEWPORT_DIMS) as ArrayLike<number> | null;
    const maxViewportWidth = Number(viewport?.[0]);
    const maxViewportHeight = Number(viewport?.[1]);
    if (![maxRenderbufferSize, maxViewportWidth, maxViewportHeight, maxTextureSize]
      .every((value) => Number.isFinite(value) && value >= 1)) return UNSUPPORTED_WEBGL;
    return {
      supported: true,
      maxRenderbufferSize: Math.floor(maxRenderbufferSize),
      maxViewportWidth: Math.floor(maxViewportWidth),
      maxViewportHeight: Math.floor(maxViewportHeight),
      maxTextureSize: Math.floor(maxTextureSize),
    };
  } catch {
    return UNSUPPORTED_WEBGL;
  } finally {
    try { context.getExtension('WEBGL_lose_context')?.loseContext(); }
    catch { /* an incomplete implementation will be discarded with the probe */ }
  }
}

export function supportsWebGL(): boolean { return probeWebGLCapabilities().supported; }

/** Diagnostic override for exercising the compatibility renderer in real browsers. */
export function forceCanvas2D(search = globalThis.location?.search ?? ''): boolean {
  return new URLSearchParams(search).get('renderer') === 'canvas2d';
}
