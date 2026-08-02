import { afterEach, describe, expect, it, vi } from 'vitest';
import { forceCanvas2D, probeWebGLCapabilities, supportsWebGL } from './webgl-support';

describe('WebGL capability probe', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reports root-target limits and releases its temporary context', () => {
    const loseContext = vi.fn();
    const context = {
      MAX_RENDERBUFFER_SIZE: 0x84e8,
      MAX_VIEWPORT_DIMS: 0x0d3a,
      MAX_TEXTURE_SIZE: 0x0d33,
      isContextLost: vi.fn(() => false),
      getParameter: vi.fn((parameter: number) => {
        if (parameter === 0x84e8) return 8192;
        if (parameter === 0x0d33) return 4096;
        return new Int32Array([8192, 4096]);
      }),
      getExtension: vi.fn(() => ({ loseContext })),
    };
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({ getContext: vi.fn(() => context) })),
    });

    expect(probeWebGLCapabilities()).toEqual({
      supported: true,
      maxRenderbufferSize: 8192,
      maxViewportWidth: 8192,
      maxViewportHeight: 4096,
      maxTextureSize: 4096,
    });
    expect(loseContext).toHaveBeenCalledOnce();
  });

  it('rejects missing and malformed implementations', () => {
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({ getContext: vi.fn(() => null) })),
    });
    expect(supportsWebGL()).toBe(false);

    const loseContext = vi.fn();
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({
        getContext: vi.fn(() => ({
          MAX_RENDERBUFFER_SIZE: 0x84e8,
          MAX_VIEWPORT_DIMS: 0x0d3a,
          MAX_TEXTURE_SIZE: 0x0d33,
          isContextLost: () => false,
          getParameter: () => 0,
          getExtension: () => ({ loseContext }),
        })),
      })),
    });
    expect(probeWebGLCapabilities().supported).toBe(false);
    expect(loseContext).toHaveBeenCalledOnce();
  });

  it('rejects a WebGL1-only implementation before presenter promotion', () => {
    const webGL1 = { isContextLost: () => false };
    const getContext = vi.fn((kind: string) => kind === 'webgl' ? webGL1 : null);
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({ getContext })),
    });

    expect(probeWebGLCapabilities().supported).toBe(false);
    expect(getContext).toHaveBeenCalledOnce();
    expect(getContext).toHaveBeenCalledWith('webgl2');
  });

  it('reuses verified limits within a tab session without creating another probe context', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    });
    const context = {
      MAX_RENDERBUFFER_SIZE: 0x84e8,
      MAX_VIEWPORT_DIMS: 0x0d3a,
      MAX_TEXTURE_SIZE: 0x0d33,
      isContextLost: () => false,
      getParameter: (parameter: number) => {
        if (parameter === 0x84e8) return 8192;
        if (parameter === 0x0d33) return 4096;
        return new Int32Array([8192, 4096]);
      },
      getExtension: () => ({ loseContext: () => undefined }),
    };
    const createElement = vi.fn(() => ({ getContext: vi.fn(() => context) }));
    vi.stubGlobal('document', { createElement });

    expect(probeWebGLCapabilities().supported).toBe(true);
    expect(probeWebGLCapabilities().supported).toBe(true);
    expect(createElement).toHaveBeenCalledOnce();
  });
});

describe('renderer diagnostics', () => {
  it('forces Canvas2D only for the explicit query override', () => {
    expect(forceCanvas2D('?renderer=canvas2d')).toBe(true);
    expect(forceCanvas2D('?renderer=webgl')).toBe(false);
    expect(forceCanvas2D('')).toBe(false);
  });
});
