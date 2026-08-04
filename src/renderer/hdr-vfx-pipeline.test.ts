import { describe, expect, it } from 'vitest';
import { probeHDRPipelineSupport } from './hdr-vfx-pipeline';

class FakeWebGL2Context {
  readonly MAX_DRAW_BUFFERS = 0x8824;
  readonly MAX_COLOR_ATTACHMENTS = 0x8cdf;
  readonly FRAMEBUFFER_BINDING = 0x8ca6;
  readonly TEXTURE_BINDING_2D = 0x8069;
  readonly TEXTURE_2D = 0x0de1;
  readonly TEXTURE_MIN_FILTER = 0x2801;
  readonly TEXTURE_MAG_FILTER = 0x2800;
  readonly NEAREST = 0x2600;
  readonly RGBA16F = 0x881a;
  readonly FRAMEBUFFER = 0x8d40;
  readonly COLOR_ATTACHMENT0 = 0x8ce0;
  readonly FRAMEBUFFER_COMPLETE = 0x8cd5;

  readonly previousTexture = { kind: 'previous-texture' };
  readonly previousFramebuffer = { kind: 'previous-framebuffer' };
  readonly createdTexture = { kind: 'created-texture' };
  readonly createdFramebuffer = { kind: 'created-framebuffer' };
  readonly deletedTextures: unknown[] = [];
  readonly deletedFramebuffers: unknown[] = [];
  readonly textureBindings: unknown[] = [];
  readonly framebufferBindings: unknown[] = [];
  extensions = new Set<string>(['EXT_color_buffer_float']);
  maxDrawBuffers = 4;
  maxColorAttachments = 4;
  framebufferStatus = this.FRAMEBUFFER_COMPLETE;

  getParameter(parameter: number): unknown {
    if (parameter === this.MAX_DRAW_BUFFERS) return this.maxDrawBuffers;
    if (parameter === this.MAX_COLOR_ATTACHMENTS) return this.maxColorAttachments;
    if (parameter === this.FRAMEBUFFER_BINDING) return this.previousFramebuffer;
    if (parameter === this.TEXTURE_BINDING_2D) return this.previousTexture;
    return null;
  }

  getExtension(name: string): object | null { return this.extensions.has(name) ? {} : null; }
  createTexture(): unknown { return this.createdTexture; }
  createFramebuffer(): unknown { return this.createdFramebuffer; }
  bindTexture(_target: number, texture: unknown): void { this.textureBindings.push(texture); }
  texParameteri(): void { /* probe-only fake */ }
  texStorage2D(): void { /* probe-only fake */ }
  bindFramebuffer(_target: number, framebuffer: unknown): void {
    this.framebufferBindings.push(framebuffer);
  }
  framebufferTexture2D(): void { /* probe-only fake */ }
  checkFramebufferStatus(): number { return this.framebufferStatus; }
  deleteTexture(texture: unknown): void { this.deletedTextures.push(texture); }
  deleteFramebuffer(framebuffer: unknown): void { this.deletedFramebuffers.push(framebuffer); }
}

function withFakeWebGL2<T>(run: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'WebGL2RenderingContext');
  Object.defineProperty(globalThis, 'WebGL2RenderingContext', {
    configurable: true,
    value: FakeWebGL2Context,
  });
  try {
    return run();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'WebGL2RenderingContext', descriptor);
    else delete (globalThis as { WebGL2RenderingContext?: unknown }).WebGL2RenderingContext;
  }
}

function probe(context: FakeWebGL2Context) {
  return withFakeWebGL2(() => probeHDRPipelineSupport(context as unknown as WebGL2RenderingContext));
}

describe('HDR VFX capability gate', () => {
  it('fails closed without an actual WebGL2 presenter context', () => {
    expect(probeHDRPipelineSupport(undefined)).toEqual({
      supported: false,
      reason: 'not-webgl2',
      maxDrawBuffers: 0,
      maxColorAttachments: 0,
    });
  });

  it('rejects a WebGL2 context without float color attachments', () => {
    const context = new FakeWebGL2Context();
    context.extensions.clear();

    expect(probe(context)).toEqual({
      supported: false,
      reason: 'float-color-unavailable',
      maxDrawBuffers: 4,
      maxColorAttachments: 4,
    });
    expect(context.deletedTextures).toEqual([]);
    expect(context.deletedFramebuffers).toEqual([]);
  });

  it('rejects insufficient MRT limits before allocating probe attachments', () => {
    const context = new FakeWebGL2Context();
    context.maxDrawBuffers = 1;

    expect(probe(context)).toEqual({
      supported: false,
      reason: 'mrt-unavailable',
      maxDrawBuffers: 1,
      maxColorAttachments: 4,
    });
    expect(context.deletedTextures).toEqual([]);
    expect(context.deletedFramebuffers).toEqual([]);
  });

  it('rejects an incomplete float framebuffer and restores caller bindings', () => {
    const context = new FakeWebGL2Context();
    context.framebufferStatus = 0;

    expect(probe(context)).toEqual({
      supported: false,
      reason: 'float-framebuffer-incomplete',
      maxDrawBuffers: 4,
      maxColorAttachments: 4,
    });
    expect(context.framebufferBindings).toEqual([
      context.createdFramebuffer,
      context.previousFramebuffer,
    ]);
    expect(context.textureBindings).toEqual([
      context.createdTexture,
      context.previousTexture,
    ]);
    expect(context.deletedFramebuffers).toEqual([context.createdFramebuffer]);
    expect(context.deletedTextures).toEqual([context.createdTexture]);
  });

  it('accepts a complete float framebuffer and releases temporary attachments', () => {
    const context = new FakeWebGL2Context();

    expect(probe(context)).toEqual({
      supported: true,
      maxDrawBuffers: 4,
      maxColorAttachments: 4,
    });
    expect(context.framebufferBindings.at(-1)).toBe(context.previousFramebuffer);
    expect(context.textureBindings.at(-1)).toBe(context.previousTexture);
    expect(context.deletedFramebuffers).toEqual([context.createdFramebuffer]);
    expect(context.deletedTextures).toEqual([context.createdTexture]);
  });
});
