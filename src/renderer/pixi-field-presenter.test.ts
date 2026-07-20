import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { PixiFieldPresenter } from './pixi-field-presenter';
import { powderRenderStyleValue } from './powder-render-style';
import { WEBGL_EIGHT_X_FRAME_STALL_MS } from './render-resolution';

interface PresenterHarness {
  readonly uniforms: { readonly uniforms: Record<string, number> };
  readonly app: {
    readonly canvas: { readonly style: { transform: string }; readonly dataset: Record<string, string> };
    readonly render: ReturnType<typeof vi.fn>;
    readonly renderer?: { readonly gl: Partial<WebGL2RenderingContext> };
  };
  configurePresentation: PixiFieldPresenter['configurePresentation'];
  setGasFieldLightingEnabled: PixiFieldPresenter['setGasFieldLightingEnabled'];
  setGasVolumeChromaEnabled: PixiFieldPresenter['setGasVolumeChromaEnabled'];
  setLiquidVolumeChromaEnabled: PixiFieldPresenter['setLiquidVolumeChromaEnabled'];
  setPowderBodyDepthEnabled: PixiFieldPresenter['setPowderBodyDepthEnabled'];
  setSurfaceContourLightingEnabled: PixiFieldPresenter['setSurfaceContourLightingEnabled'];
  setPhaseContactLightingEnabled: PixiFieldPresenter['setPhaseContactLightingEnabled'];
  setSolidFieldLightingEnabled: PixiFieldPresenter['setSolidFieldLightingEnabled'];
  setLiquidSilhouetteCohesionEnabled: PixiFieldPresenter['setLiquidSilhouetteCohesionEnabled'];
  setRenderStallHandler: PixiFieldPresenter['setRenderStallHandler'];
  setTransform: PixiFieldPresenter['setTransform'];
  waitForFirstFrame: PixiFieldPresenter['waitForFirstFrame'];
  enableWebGLPresentationTiming: PixiFieldPresenter['enableWebGLPresentationTiming'];
  requestWebGLPresentationTimingSample: PixiFieldPresenter['requestWebGLPresentationTimingSample'];
  getWebGLPresentationTiming: PixiFieldPresenter['getWebGLPresentationTiming'];
  webGLTimingSequence: number;
}

function presenterHarness(): PresenterHarness {
  const presenter = Object.create(PixiFieldPresenter.prototype) as PresenterHarness;
  Object.assign(presenter, {
    uniforms: { uniforms: {} },
    app: {
      canvas: { style: { transform: '' }, dataset: {} },
      render: vi.fn(),
    },
    firstFrameReady: false,
    firstFrameFailed: false,
    firstFrameWaiters: new Set(),
    outputScale: 2,
    destroyed: false,
    contextLost: false,
    webGLTimingEnabled: false,
    webGLTimingRequested: false,
    webGLTimingSamples: [],
    webGLTimingDiscarded: 0,
    webGLTimingSequence: 0,
    webGLTimingFenceStartedAt: 0,
    webGLTimingFencePoll: 0,
  });
  return presenter;
}

describe('Pixi presenter startup configuration', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('seeds all presentation uniforms without submitting intermediate frames', () => {
    const presenter = presenterHarness();

    presenter.configurePresentation(
      false, true, false, true, false, true, false, true, false, 'grains',
    );

    expect(presenter.uniforms.uniforms).toMatchObject({
      uGasFieldLighting: 0,
      uGasVolumeChroma: 1,
      uLiquidFieldLighting: 1,
      uLiquidVolumeChroma: 1,
      uTranslucentFieldTransmission: 0,
      uTranslucentBackdropRefraction: 1,
      uSolidContactDepth: 0,
      uTranslucentLensShell: 1,
      uSolidCurvatureDepth: 0,
      uSurfaceContourLighting: 1,
      uPhaseContactLighting: 1,
      uSolidFieldLighting: 1,
      uLiquidSilhouetteCohesion: 1,
      uThermalMaterialStyling: 1,
      uEnergyCoreRelief: 0,
      uPowderStyle: powderRenderStyleValue('grains'),
      uPowderBodyDepth: 1,
    });
    expect(presenter.app.render).not.toHaveBeenCalled();
  });

  it('advances fallback presentation timing only after its GPU fence signals', () => {
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const fence = {} as WebGLSync;
    const gl = {
      SYNC_GPU_COMMANDS_COMPLETE: 0x9117,
      TIMEOUT_EXPIRED: 0x911b,
      WAIT_FAILED: 0x911d,
      ALREADY_SIGNALED: 0x911a,
      CONDITION_SATISFIED: 0x911c,
      getExtension: vi.fn(() => null),
      fenceSync: vi.fn(() => fence),
      flush: vi.fn(),
      clientWaitSync: vi.fn()
        .mockReturnValueOnce(0x911b)
        .mockReturnValue(0x911a),
      deleteSync: vi.fn(),
    } as unknown as WebGL2RenderingContext;
    const presenter = presenterHarness();
    Object.assign(presenter.app, { renderer: { gl } });

    presenter.enableWebGLPresentationTiming();
    expect(presenter.getWebGLPresentationTiming()?.source).toBe('gpu-fence');
    expect(presenter.requestWebGLPresentationTimingSample()).toBe(true);
    expect(presenter.app.render).toHaveBeenCalledOnce();
    expect(presenter.webGLTimingSequence).toBe(0);

    callbacks.shift()?.(0);
    expect(presenter.webGLTimingSequence).toBe(0);
    callbacks.shift()?.(16);

    const timing = presenter.getWebGLPresentationTiming();
    expect(timing?.source).toBe('gpu-fence');
    expect(timing?.sequence).toBe(1);
    expect(timing?.usableSamples).toBe(1);
    expect(gl.deleteSync).toHaveBeenCalledWith(fence);
  });

  it('bounds an unsignalled audit fence and accepts the next completed sample', () => {
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const fences = [{} as WebGLSync, {} as WebGLSync];
    const gl = {
      SYNC_GPU_COMMANDS_COMPLETE: 0x9117,
      TIMEOUT_EXPIRED: 0x911b,
      WAIT_FAILED: 0x911d,
      ALREADY_SIGNALED: 0x911a,
      CONDITION_SATISFIED: 0x911c,
      getExtension: vi.fn(() => null),
      fenceSync: vi.fn().mockReturnValueOnce(fences[0]).mockReturnValue(fences[1]),
      flush: vi.fn(),
      clientWaitSync: vi.fn().mockReturnValue(0x911a),
      deleteSync: vi.fn(),
    } as unknown as WebGL2RenderingContext;
    const presenter = presenterHarness();
    Object.assign(presenter.app, { renderer: { gl } });
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(10_001)
      .mockReturnValue(10_002);

    presenter.enableWebGLPresentationTiming();
    expect(presenter.requestWebGLPresentationTimingSample()).toBe(true);
    callbacks.shift()?.(0);
    let timing = presenter.getWebGLPresentationTiming();
    expect(timing).toMatchObject({
      source: 'gpu-fence', sequence: 1, usableSamples: 0, discardedSamples: 1,
    });
    expect(gl.deleteSync).toHaveBeenCalledWith(fences[0]);

    expect(presenter.requestWebGLPresentationTimingSample()).toBe(true);
    callbacks.shift()?.(16);
    timing = presenter.getWebGLPresentationTiming();
    expect(timing).toMatchObject({
      source: 'gpu-fence', sequence: 2, usableSamples: 1, discardedSamples: 1,
    });
    expect(gl.deleteSync).toHaveBeenCalledWith(fences[1]);
  });

  it('seeds and redraws the audit-settable surface contour light', () => {
    const presenter = presenterHarness();

    presenter.configurePresentation(
      true, true, true, true, true, true, true, true, true, 'smooth', false,
    );
    expect(presenter.uniforms.uniforms.uSurfaceContourLighting).toBe(0);
    expect(presenter.app.render).not.toHaveBeenCalled();

    presenter.setSurfaceContourLightingEnabled(true);
    expect(presenter.uniforms.uniforms.uSurfaceContourLighting).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledOnce();
  });

  it('seeds and redraws optional-last gas volume chroma', () => {
    const presenter = presenterHarness();

    presenter.configurePresentation(
      true, true, true, true, true, true, true, true, true, 'smooth',
      true, true, true, true, false,
    );
    expect(presenter.uniforms.uniforms.uGasVolumeChroma).toBe(0);
    expect(presenter.app.render).not.toHaveBeenCalled();

    presenter.setGasVolumeChromaEnabled(true);
    expect(presenter.uniforms.uniforms.uGasVolumeChroma).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledOnce();
  });

  it('keeps gas volume chroma arithmetic-only and RGB-only', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const helperStart = source.indexOf('float gasVolumeChromaResponse(');
    const helperEnd = source.indexOf('vec3 vividColor', helperStart);
    const helpers = source.slice(helperStart, helperEnd);
    const blockStart = source.indexOf("// The atmosphere's existing cardinal field samples");
    const blockEnd = source.indexOf('  } else if (liquidVolume > 0.5)', blockStart);
    const block = source.slice(blockStart, blockEnd);

    expect(helperStart).toBeGreaterThan(0);
    expect(helperEnd).toBeGreaterThan(helperStart);
    expect(blockStart).toBeGreaterThan(0);
    expect(blockEnd).toBeGreaterThan(blockStart);
    expect(block).toContain('(volumeSlope.x + volumeSlope.y) * 0.5882353');
    expect(block).toContain('gasCurvature * 0.125');
    expect(block).toContain('* uGasVolumeChroma');
    expect(`${helpers}${block}`).not.toContain('texture(');
    expect(`${helpers}${block}`).not.toMatch(/\balpha\s*[+*]?=/);
    expect(`${helpers}${block}`).not.toMatch(/\b(?:sin|pow|normalize|length)\s*\(/);
  });

  it('seeds and redraws optional-last liquid volume chroma', () => {
    const presenter = presenterHarness();

    presenter.configurePresentation(
      true, true, true, true, true, true, true, true, true, 'smooth',
      true, true, true, true, true, false,
    );
    expect(presenter.uniforms.uniforms.uLiquidVolumeChroma).toBe(0);
    expect(presenter.app.render).not.toHaveBeenCalled();

    presenter.setLiquidVolumeChromaEnabled(true);
    expect(presenter.uniforms.uniforms.uLiquidVolumeChroma).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledOnce();
  });

  it('keeps liquid volume chroma arithmetic-only, RGB-only, and resource-free', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const helperStart = source.indexOf('float liquidVolumeChromaResponse(');
    const helperEnd = source.indexOf('vec3 vividColor', helperStart);
    const helpers = source.slice(helperStart, helperEnd);
    const blockStart = source.indexOf('// Family-coloured absorption and reflection');
    const blockEnd = source.indexOf('  } else {', blockStart);
    const block = source.slice(blockStart, blockEnd);

    expect(helperStart).toBeGreaterThan(0);
    expect(helperEnd).toBeGreaterThan(helperStart);
    expect(blockStart).toBeGreaterThan(0);
    expect(blockEnd).toBeGreaterThan(blockStart);
    expect(block).toContain('uLiquidVolumeChroma > 0.5 && liquidOnly < 0.5');
    expect(block).toContain('molten < 0.5 && foreignMatterContact < 0.5');
    expect(block).toContain('unlikeMaterialContact < 0.5');
    expect(block).toContain('liquidDepth > 0.38 && liquidNeighbourMean > 0.48');
    expect(block).toContain('dot(liquidSpeciesSlope, liquidSpeciesSlope) < 0.0025');
    expect(block).toContain('liquidDepth, volumeSlope, liquidDensity, liquidNeighbourMean');
    expect(`${helpers}${block}`).not.toContain('texture(');
    expect(`${helpers}${block}`).not.toMatch(/\balpha\s*[+*]?=/);
    expect(`${helpers}${block}`).not.toMatch(/\b(?:sin|pow|normalize|length)\s*\(/);
    expect(source.match(/texture\(uLiquidTexture/g)).toHaveLength(5);
    expect(source).not.toContain('sampler2D uLiquidVolumeChroma');
  });

  it('keeps true-8x analytic body lighting independent of expensive probes', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    expect(source).toContain("uHighQuality: {\n        value: matchMedia('(min-width: 800px)').matches && outputScale < 8 ? 1 : 0");
    expect(source).toContain("uAnalyticLightingQuality: {\n        value: matchMedia('(min-width: 800px)').matches || outputScale === 8 ? 1 : 0");
    expect(source).toContain('mix(1.45, 1.15, uAnalyticLightingQuality)');
    expect(source).toContain('if (uHighQuality > 0.5)');
  });

  it('keeps true-8x premultiplied output independent of semantic texture alpha mode', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    expect(source).toContain('uFieldTexture: this.fieldSource');
    expect(source).toContain('new Mesh({ geometry, shader, texture: Texture.WHITE })');
    expect(source).not.toContain('new Mesh({ geometry, shader, texture: fieldTexture })');
    expect(source).toContain('vec3 premultiplied = clamp(color, 0.0, 1.35) * alpha;');
  });

  it('keeps chromatic surface depth arithmetic-only and RGB-only', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const helperStart = source.indexOf('vec3 surfaceChromaKey');
    const helperEnd = source.indexOf('vec3 vividColor', helperStart);
    const helpers = source.slice(helperStart, helperEnd);
    const solidStart = source.indexOf('// Reuse the semantic Hermite normal as a small family-coloured');
    const solidEnd = source.indexOf('// Give only an authoritative opaque solid contour', solidStart);
    const solid = source.slice(solidStart, solidEnd);
    const powderStart = source.indexOf('float powderContourChroma = localPowderShape.x');
    const powderEnd = source.indexOf('} else if (smoothSurface', powderStart);
    const powder = source.slice(powderStart, powderEnd);

    expect(helperStart).toBeGreaterThan(0);
    expect(helperEnd).toBeGreaterThan(helperStart);
    expect(helpers).toContain('return color + (vec3(1.0) - color)');
    expect(helpers).not.toContain('texture(');
    expect(solid).toContain('surfaceChromaResponse(density, shape.yz, optics)');
    expect(powder).toContain('localPowderShape.x < 0.92');
    expect(powder).toContain('density, widePowderShape.yz, optics');
    expect(powder).toContain('* powderChromaCohesion * uSurfaceContourLighting');
    expect(powder).toContain('powderContourChroma + powderBodyChroma');
    expect(`${solid}${powder}`).not.toMatch(/\balpha\s*[+*]?=/);
    expect(`${solid}${powder}`).not.toContain('texture(');
  });

  it('keeps Smooth powder body depth gated, bounded, and topology-neutral', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const start = source.indexOf('// Stable two-dimensional bulk gets a restrained');
    const end = source.indexOf('float grainOffsetY', start);
    const block = source.slice(start, end);

    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(block).toContain('uPowderBodyDepth * powderBulkDepth');
    expect(block).toContain('step(224.0 / 255.0, boundaryStability)');
    expect(block).toContain('step(0.66, widePowderShape.x)');
    expect(block).toContain('step(5.5, widePowderShape.w)');
    expect(block).toContain('powderDirectedRelief * 0.35');
    expect(block).not.toContain('powderMacroRelief * 0.35');
    expect(block).toContain('-0.035, 0.040');
    expect(block).not.toContain('texture(');
    expect(block).not.toMatch(/\balpha\s*[+*]?=/);
    expect(block).not.toMatch(/\b(?:sin|pow|normalize|length|sqrt)\s*\(/);
    expect(source.match(/texture\(uPowderSurfaceTexture/g)).toHaveLength(1);
  });

  it('redraws when audit powder body depth changes', () => {
    const presenter = presenterHarness();

    presenter.setPowderBodyDepthEnabled(false);
    expect(presenter.uniforms.uniforms.uPowderBodyDepth).toBe(0);
    expect(presenter.app.render).toHaveBeenCalledOnce();

    presenter.setPowderBodyDepthEnabled(true);
    expect(presenter.uniforms.uniforms.uPowderBodyDepth).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledTimes(2);
  });

  it('hydrates disabled powder body depth without an intermediate frame', () => {
    const presenter = presenterHarness();

    presenter.configurePresentation(
      true, true, true, true, true, true, true, true, true, 'smooth',
      true, true, true, true, true, true, false,
    );

    expect(presenter.uniforms.uniforms.uPowderBodyDepth).toBe(0);
    expect(presenter.app.render).not.toHaveBeenCalled();
  });

  it('seeds and redraws optional-last cross-phase contact lighting', () => {
    const presenter = presenterHarness();

    presenter.configurePresentation(
      true, true, true, true, true, true, true, true, true, 'smooth', true, false,
    );
    expect(presenter.uniforms.uniforms.uSurfaceContourLighting).toBe(1);
    expect(presenter.uniforms.uniforms.uPhaseContactLighting).toBe(0);
    expect(presenter.app.render).not.toHaveBeenCalled();

    presenter.setPhaseContactLightingEnabled(true);
    expect(presenter.uniforms.uniforms.uPhaseContactLighting).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledOnce();
  });

  it('seeds and redraws optional-last solid field lighting', () => {
    const presenter = presenterHarness();

    presenter.configurePresentation(
      true, true, true, true, true, true, true, true, true, 'smooth', true, true, false,
    );
    expect(presenter.uniforms.uniforms.uPhaseContactLighting).toBe(1);
    expect(presenter.uniforms.uniforms.uSolidFieldLighting).toBe(0);
    expect(presenter.app.render).not.toHaveBeenCalled();

    presenter.setSolidFieldLightingEnabled(true);
    expect(presenter.uniforms.uniforms.uSolidFieldLighting).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledOnce();
  });

  it('keeps the solid field-light probe bounded behind strict contour eligibility', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const start = source.indexOf('// Give only an authoritative opaque solid contour');
    const end = source.indexOf('    if (!materialEmissive && surfaceOnly < 0.5)', start);
    const solidFieldBlock = source.slice(start, end);

    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(source).toContain('uniform float uSolidFieldLighting;');
    expect(solidFieldBlock).toContain('uSolidFieldLighting > 0.5 && family == 0.0 && halo < 0.5');
    expect(solidFieldBlock).toContain('surfaceOnly < 0.5 && wall < 0.5 && material != 3.0');
    expect(solidFieldBlock).toContain('traits < 0.5 && !materialEmissive && optics != 12.0');
    expect(solidFieldBlock).toContain('density > 0.08 && density < 0.92');
    expect(solidFieldBlock).toContain('if (uHighQuality > 0.5)');
    expect(solidFieldBlock.match(/texture\(\s*uEmissionTexture/g)).toHaveLength(1);
    expect(solidFieldBlock).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('seeds and redraws optional-last liquid silhouette cohesion', () => {
    const presenter = presenterHarness();

    presenter.configurePresentation(
      true, true, true, true, true, true, true, true, true, 'smooth',
      true, true, true, false,
    );
    expect(presenter.uniforms.uniforms.uSolidFieldLighting).toBe(1);
    expect(presenter.uniforms.uniforms.uLiquidSilhouetteCohesion).toBe(0);
    expect(presenter.app.render).not.toHaveBeenCalled();

    presenter.setLiquidSilhouetteCohesionEnabled(true);
    expect(presenter.uniforms.uniforms.uLiquidSilhouetteCohesion).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledOnce();
  });

  it('coheres only connected ordinary liquid-air contours with existing samples', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const start = source.indexOf('// Semantic density previously won every liquid fringe');
    const end = source.indexOf('    alpha = smoothstep(', start);
    const cohesionBlock = source.slice(start, end);
    const contactStart = source.indexOf('vec4 contactSample(');
    const contactEnd = source.indexOf('\n}\nvec4 occupancyShape(', contactStart) + 2;
    const contactBlock = source.slice(contactStart, contactEnd);
    const resourcesStart = source.indexOf('    const resources = {');
    const resourcesEnd = source.indexOf('    };', resourcesStart);
    const resourcesBlock = source.slice(resourcesStart, resourcesEnd);

    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(source).toContain('uniform float uLiquidSilhouetteCohesion;');
    expect(source).toContain('float liquidSupportTop = step(0.68, liquidTop.a);');
    expect(cohesionBlock).toContain('liquidOnly < 0.5 && halo < 0.5');
    expect(cohesionBlock).toContain('family == 2.0 && wall < 0.5 && traits < 0.5 && !materialEmissive');
    expect(cohesionBlock).toContain('molten < 0.5 && foreignMatterContact < 0.5 && unlikeMaterialContact < 0.5');
    expect(cohesionBlock).toContain('density > 0.08 && density < 0.92');
    expect(cohesionBlock).toContain('adjacentLiquidSupport * exposedLiquidSide');
    expect(cohesionBlock).toContain('min(\n        volume, max(density * 0.65, min(liquidDensity, liquidNeighbourMean) * 0.45)');
    expect(cohesionBlock).not.toContain('texture(');
    expect(cohesionBlock).not.toMatch(/\bcolor\s*[+*]?=/);
    expect(contactBlock.match(/materialAt\(/g)).toHaveLength(1);
    expect(contactBlock.match(/texture\(/g)).toHaveLength(1);
    expect(resourcesBlock).not.toContain('uLiquidSilhouetteCohesion');
    expect(source).not.toContain('sampler2D uLiquidSilhouetteCohesion');
  });

  it('keeps CSS camera transforms render-free while public style toggles redraw', () => {
    const presenter = presenterHarness();

    presenter.setTransform(1.25, 12, -8);
    expect(presenter.app.canvas.style.transform).toBe('translate3d(12px, -8px, 0) scale(1.25)');
    expect(presenter.app.render).not.toHaveBeenCalled();

    presenter.setGasFieldLightingEnabled(true);
    expect(presenter.app.render).toHaveBeenCalledOnce();
  });

  it('coalesces true-8x redraws while one GPU fence remains in flight', () => {
    let status = 0x911b; // TIMEOUT_EXPIRED
    let scheduled: FrameRequestCallback | undefined;
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      scheduled = callback;
      return 17;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const firstFence = {} as WebGLSync;
    const secondFence = {} as WebGLSync;
    const gl = {
      ALREADY_SIGNALED: 0x911a,
      TIMEOUT_EXPIRED: 0x911b,
      CONDITION_SATISFIED: 0x911c,
      WAIT_FAILED: 0x911d,
      SYNC_GPU_COMMANDS_COMPLETE: 0x9117,
      clientWaitSync: vi.fn(() => status),
      fenceSync: vi.fn()
        .mockReturnValueOnce(firstFence)
        .mockReturnValueOnce(secondFence),
      deleteSync: vi.fn(),
      flush: vi.fn(),
    };
    const presenter = presenterHarness();
    Object.assign(presenter, {
      outputScale: 8,
      renderFencePoll: 0,
      destroyed: false,
      contextLost: false,
      app: { ...presenter.app, renderer: { gl } },
    });

    presenter.setGasFieldLightingEnabled(true);
    presenter.setGasFieldLightingEnabled(false);

    expect(presenter.app.render).toHaveBeenCalledOnce();
    expect(gl.fenceSync).toHaveBeenCalledOnce();
    expect(scheduled).toBeTypeOf('function');

    status = gl.CONDITION_SATISFIED;
    scheduled?.(performance.now());

    expect(presenter.app.render).toHaveBeenCalledTimes(2);
    expect(gl.deleteSync).toHaveBeenCalledWith(firstFence);
    expect(gl.fenceSync).toHaveBeenCalledTimes(2);
  });

  it('does not declare true 8x ready until its first GPU fence completes', async () => {
    let status = 0x911b; // TIMEOUT_EXPIRED
    let scheduled: FrameRequestCallback | undefined;
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      scheduled = callback;
      return 29;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const gl = {
      ALREADY_SIGNALED: 0x911a,
      TIMEOUT_EXPIRED: 0x911b,
      CONDITION_SATISFIED: 0x911c,
      WAIT_FAILED: 0x911d,
      SYNC_GPU_COMMANDS_COMPLETE: 0x9117,
      clientWaitSync: vi.fn(() => status),
      fenceSync: vi.fn(() => ({} as WebGLSync)),
      deleteSync: vi.fn(),
      flush: vi.fn(),
    };
    const presenter = presenterHarness();
    Object.assign(presenter, {
      outputScale: 8,
      renderFencePoll: 0,
      destroyed: false,
      contextLost: false,
      app: { ...presenter.app, renderer: { gl } },
    });

    presenter.setGasFieldLightingEnabled(true);
    let settled = false;
    const ready = presenter.waitForFirstFrame(1_000).then((value) => {
      settled = true;
      return value;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    status = gl.CONDITION_SATISFIED;
    scheduled?.(performance.now());

    await expect(ready).resolves.toBe(true);
    expect(presenter.app.render).toHaveBeenCalledOnce();
    expect(gl.deleteSync).toHaveBeenCalledOnce();
  });

  it('recovers a post-promotion 8x fence that never signals context loss', () => {
    vi.spyOn(performance, 'now').mockReturnValue(WEBGL_EIGHT_X_FRAME_STALL_MS + 101);
    const fence = {} as WebGLSync;
    const gl = {
      ALREADY_SIGNALED: 0x911a,
      TIMEOUT_EXPIRED: 0x911b,
      CONDITION_SATISFIED: 0x911c,
      WAIT_FAILED: 0x911d,
      clientWaitSync: vi.fn(() => 0x911b),
      deleteSync: vi.fn(),
    };
    const stalled = vi.fn();
    const presenter = presenterHarness();
    Object.assign(presenter, {
      outputScale: 8,
      renderFencePoll: 0,
      renderFence: fence,
      renderFenceStartedAt: 100,
      firstFrameReady: true,
      destroyed: false,
      contextLost: false,
      app: { ...presenter.app, renderer: { gl } },
    });
    presenter.setRenderStallHandler(stalled);

    presenter.setGasFieldLightingEnabled(true);

    expect(stalled).toHaveBeenCalledOnce();
    expect(gl.deleteSync).toHaveBeenCalledWith(fence);
    expect(gl.clientWaitSync).not.toHaveBeenCalled();
    expect(presenter.app.render).not.toHaveBeenCalled();
  });
});
