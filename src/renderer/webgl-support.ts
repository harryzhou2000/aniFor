export interface WebGLCapabilities {
  readonly supported: boolean;
  readonly maxRenderbufferSize: number;
  readonly maxViewportWidth: number;
  readonly maxViewportHeight: number;
  readonly maxTextureSize: number;
  /** True for software rasterizers whose 15M-fragment 8x frame is not interactive. */
  readonly softwareRenderer: boolean;
}

const UNSUPPORTED_WEBGL: WebGLCapabilities = {
  supported: false,
  maxRenderbufferSize: 0,
  maxViewportWidth: 0,
  maxViewportHeight: 0,
  maxTextureSize: 0,
  softwareRenderer: false,
};

const CAPABILITIES_SESSION_KEY = 'anifor-webgl-capabilities-v2';

function cachedWebGLCapabilities(): WebGLCapabilities | undefined {
  try {
    const raw = sessionStorage.getItem(CAPABILITIES_SESSION_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<WebGLCapabilities>;
    const values = [
      parsed.maxRenderbufferSize, parsed.maxViewportWidth,
      parsed.maxViewportHeight, parsed.maxTextureSize,
    ];
    if (parsed.supported !== true || typeof parsed.softwareRenderer !== 'boolean'
      || !values.every((value) => typeof value === 'number'
        && Number.isInteger(value) && value >= 1)) return undefined;
    return {
      supported: true,
      maxRenderbufferSize: parsed.maxRenderbufferSize!,
      maxViewportWidth: parsed.maxViewportWidth!,
      maxViewportHeight: parsed.maxViewportHeight!,
      maxTextureSize: parsed.maxTextureSize!,
      softwareRenderer: parsed.softwareRenderer,
    };
  } catch {
    // Private browsing and non-browser tests may not expose session storage.
    return undefined;
  }
}

function cacheWebGLCapabilities(capabilities: WebGLCapabilities): void {
  if (!capabilities.supported) return;
  try { sessionStorage.setItem(CAPABILITIES_SESSION_KEY, JSON.stringify(capabilities)); }
  catch { /* the next document can safely probe again */ }
}

/**
 * Probes the limits that bound the root presentation target, then explicitly
 * releases the short-lived context so Pixi can create the only live context.
 * A tab-session cache prevents rapid Detail navigation from accumulating those
 * transient probe contexts while Chrome releases them asynchronously.
 */
export function probeWebGLCapabilities(): WebGLCapabilities {
  const cached = cachedWebGLCapabilities();
  if (cached) return cached;
  const probe = document.createElement('canvas');
  // The presenter uses WebGL2 fenceSync/clientWaitSync for bounded promotion,
  // latest-wins frame scheduling, and 8x stall recovery. A WebGL1 context could
  // draw some shaders but cannot satisfy that lifecycle contract, so reject it
  // here instead of timing out after allocating the candidate renderer.
  const context = probe.getContext('webgl2');
  if (!context || context.isContextLost()) return UNSUPPORTED_WEBGL;
  try {
    const maxRenderbufferSize = Number(context.getParameter(context.MAX_RENDERBUFFER_SIZE));
    const maxTextureSize = Number(context.getParameter(context.MAX_TEXTURE_SIZE));
    const viewport = context.getParameter(context.MAX_VIEWPORT_DIMS) as ArrayLike<number> | null;
    const maxViewportWidth = Number(viewport?.[0]);
    const maxViewportHeight = Number(viewport?.[1]);
    if (![maxRenderbufferSize, maxViewportWidth, maxViewportHeight, maxTextureSize]
      .every((value) => Number.isFinite(value) && value >= 1)) return UNSUPPORTED_WEBGL;
    const rendererInfo = context.getExtension('WEBGL_debug_renderer_info');
    let renderer = '';
    try {
      if (rendererInfo && Number.isInteger(rendererInfo.UNMASKED_RENDERER_WEBGL)) {
        renderer = String(context.getParameter(rendererInfo.UNMASKED_RENDERER_WEBGL) ?? '');
      }
    } catch { /* privacy-restricted debug metadata means unknown hardware */ }
    const capabilities = {
      supported: true,
      maxRenderbufferSize: Math.floor(maxRenderbufferSize),
      maxViewportWidth: Math.floor(maxViewportWidth),
      maxViewportHeight: Math.floor(maxViewportHeight),
      maxTextureSize: Math.floor(maxTextureSize),
      softwareRenderer: /swiftshader|llvmpipe|software(?:\s+rasterizer|\s+renderer)?/i.test(renderer),
    };
    cacheWebGLCapabilities(capabilities);
    return capabilities;
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
