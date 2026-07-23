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
  setGasIdentityStylingEnabled: PixiFieldPresenter['setGasIdentityStylingEnabled'];
  setEmissionVolumeChromaEnabled: PixiFieldPresenter['setEmissionVolumeChromaEnabled'];
  setLiquidVolumeChromaEnabled: PixiFieldPresenter['setLiquidVolumeChromaEnabled'];
  setLiquidIdentityStylingEnabled: PixiFieldPresenter['setLiquidIdentityStylingEnabled'];
  setLiquidOpticalDepthEnabled: PixiFieldPresenter['setLiquidOpticalDepthEnabled'];
  setSolidOpticalDepthEnabled: PixiFieldPresenter['setSolidOpticalDepthEnabled'];
  setPowderBodyDepthEnabled: PixiFieldPresenter['setPowderBodyDepthEnabled'];
  setSurfaceContourLightingEnabled: PixiFieldPresenter['setSurfaceContourLightingEnabled'];
  setPhaseContactLightingEnabled: PixiFieldPresenter['setPhaseContactLightingEnabled'];
  setSolidFieldLightingEnabled: PixiFieldPresenter['setSolidFieldLightingEnabled'];
  setRoleMaterialStylingEnabled: PixiFieldPresenter['setRoleMaterialStylingEnabled'];
  setCellularMaterialStylingEnabled: PixiFieldPresenter['setCellularMaterialStylingEnabled'];
  setSensorMaterialStylingEnabled: PixiFieldPresenter['setSensorMaterialStylingEnabled'];
  setUnusualPowderStylingEnabled: PixiFieldPresenter['setUnusualPowderStylingEnabled'];
  setExplosivePowderStylingEnabled: PixiFieldPresenter['setExplosivePowderStylingEnabled'];
  setUnusualSolidStylingEnabled: PixiFieldPresenter['setUnusualSolidStylingEnabled'];
  setEnergyIdentityStylingEnabled: PixiFieldPresenter['setEnergyIdentityStylingEnabled'];
  setVibrStateStylingEnabled: PixiFieldPresenter['setVibrStateStylingEnabled'];
  setDeutStateStylingEnabled: PixiFieldPresenter['setDeutStateStylingEnabled'];
  setSourceTargetStylingEnabled: PixiFieldPresenter['setSourceTargetStylingEnabled'];
  setForceActivityStylingEnabled: PixiFieldPresenter['setForceActivityStylingEnabled'];
  setPoloStateStylingEnabled: PixiFieldPresenter['setPoloStateStylingEnabled'];
  setBotanicalIdentityStylingEnabled: PixiFieldPresenter['setBotanicalIdentityStylingEnabled'];
  setLiquidSilhouetteCohesionEnabled: PixiFieldPresenter['setLiquidSilhouetteCohesionEnabled'];
  setRenderStallHandler: PixiFieldPresenter['setRenderStallHandler'];
  forceEightXRenderStallForAudit: PixiFieldPresenter['forceEightXRenderStallForAudit'];
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
    renderFencePoll: 0,
    renderQueued: false,
    renderFenceStallForcedForAudit: false,
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
      uGasIdentityStyling: 1,
      uEmissionVolumeChroma: 1,
      uLiquidFieldLighting: 1,
      uLiquidVolumeChroma: 1,
      uLiquidIdentityStyling: 1,
      uLiquidOpticalDepth: 1,
      uSolidOpticalDepth: 1,
      uTranslucentFieldTransmission: 0,
      uTranslucentBackdropRefraction: 1,
      uSolidContactDepth: 0,
      uTranslucentLensShell: 1,
      uSolidCurvatureDepth: 0,
      uSurfaceContourLighting: 1,
      uPhaseContactLighting: 1,
      uSolidFieldLighting: 1,
      uRoleMaterialStyling: 1,
      uCellularMaterialStyling: 1,
      uSensorMaterialStyling: 1,
      uUnusualPowderStyling: 1,
      uUnusualSolidStyling: 1,
      uLiquidSilhouetteCohesion: 1,
      uThermalMaterialStyling: 1,
      uEnergyCoreRelief: 0,
      uDeutStateStyling: 1,
      uSourceTargetStyling: 1,
      uPowderStyle: powderRenderStyleValue('grains'),
      uPowderBodyDepth: 1,
    });
    expect(presenter.app.render).not.toHaveBeenCalled();
  });

  it('decodes native presentation state from existing wall B/A channels', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');

    expect(source).toContain('float packedState = floor(stateBytes.x * 255.0 + 0.5)');
    expect(source).toContain('+ floor(stateBytes.y * 255.0 + 0.5) * 256.0;');
    expect(source).toContain('packPresentationStateRect(');
    expect(source).not.toContain('uPresentationStateTexture');
    expect(source).not.toContain('sampler2D uPresentationState');
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

  it('gates the liquid Fresnel shell with the shared RGB-only contour uniform', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const liquidStart = source.indexOf('  } else if (liquidVolume > 0.5)');
    const liquidEnd = source.indexOf('  } else {', liquidStart);
    const liquid = source.slice(liquidStart, liquidEnd);

    expect(liquidStart).toBeGreaterThan(0);
    expect(liquidEnd).toBeGreaterThan(liquidStart);
    expect(liquid).toContain('edgeTint');
    expect(liquid).toContain('reflectedEnvironment');
    expect(liquid).toContain('(1.0 - liquidOnly) * (1.0 - molten)');
    expect(liquid).toContain('step(1.5, shape.w)');
    expect(liquid).toContain('liquidFresnelKey');
    expect(liquid).toContain('liquidFresnelShadow');
    expect(liquid).toContain('liquidFresnelContour');
    expect(liquid).toContain('liquidFresnelInnerContour');
    expect(liquid).toContain('liquidFresnelAbsorption');
    expect(liquid).toContain('liquidFresnelAbsorptionResponse');
    expect(liquid).toContain('liquidFresnelStrength');
    expect(liquid).toContain('float cryogenic = optics == 16.0');
    expect(liquid).toContain('float metallicLiquid = optics == 17.0');
    expect(liquid).toContain('float viscousLiquid = optics == 18.0');
    expect(liquid).not.toMatch(/uSurfaceContourLighting[^;]*\balpha\b/);
  });

  it('rejects concave powder projection while preserving exterior smoothing', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const nearbyStart = source.indexOf('vec4 nearbySurface(');
    const nearbyEnd = source.indexOf('float nearbyPowderStability(', nearbyStart);
    const projectionStart = source.indexOf('if (surfaceOnly > 0.5 && family == 4.0');
    const projectionEnd = source.indexOf('float density = shape.x;', projectionStart);

    expect(nearbyStart).toBeGreaterThan(0);
    expect(nearbyEnd).toBeGreaterThan(nearbyStart);
    expect(source.slice(nearbyStart, nearbyEnd)).toContain('solidSamples');
    expect(source.slice(projectionStart, projectionEnd)).toContain('projectedSurfaceSamples > 2.5');
    expect(source.slice(projectionStart, projectionEnd)).toContain('shape.w < 2.5');
    expect(source.slice(projectionStart, projectionEnd)).toContain('exteriorPowderAir < 0.5');
    expect(source).toContain('float granularOptics(float optics)');
    expect(source).toContain('if (family == 4.0) {');
    expect(source).toContain('(family == 0.0 || family == 2.0 || family == 4.0)');
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
    const helperEnd = source.indexOf('vec3 gasIdentityVolumeDelta', helperStart);
    const helpers = source.slice(helperStart, helperEnd);
    const blockStart = source.indexOf("// The atmosphere's existing cardinal field samples");
    const blockEnd = source.indexOf('    if (uGasIdentityStyling > 0.5)', blockStart);
    const block = source.slice(blockStart, blockEnd);

    expect(helperStart).toBeGreaterThan(0);
    expect(helperEnd).toBeGreaterThan(helperStart);
    expect(blockStart).toBeGreaterThan(0);
    expect(blockEnd).toBeGreaterThan(blockStart);
    expect(block).toContain('(volumeSlope.x + volumeSlope.y) * 0.5882353');
    expect(block).toContain('gasCurvature * 0.125');
    expect(block).toContain('* uGasVolumeChroma');
    expect(helpers).toContain('dot(source, vec3(0.2126, 0.7152, 0.0722))');
    expect(helpers).toContain('vec3(0.88) - hue * 0.43');
    expect(`${helpers}${block}`).not.toContain('texture(');
    expect(`${helpers}${block}`).not.toMatch(/\balpha\s*[+*]?=/);
    expect(`${helpers}${block}`).not.toMatch(/\b(?:sin|pow|normalize|length)\s*\(/);
  });

  it('seeds and redraws optional-last gas identity volume styling', () => {
    const presenter = presenterHarness();

    presenter.configurePresentation(
      true, true, true, true, true, true, true, true, true, 'smooth',
      true, true, true, true, true, true, true, true, true, true,
      true, true, true, true, true, true, false,
    );
    expect(presenter.uniforms.uniforms.uGasIdentityStyling).toBe(0);
    expect(presenter.app.render).not.toHaveBeenCalled();

    presenter.setGasIdentityStylingEnabled(true);
    expect(presenter.uniforms.uniforms.uGasIdentityStyling).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledOnce();
  });

  it('uses one propagated style sample and one shared motif sample without changing gas support', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const helperStart = source.indexOf('vec3 gasIdentityVolumeDelta(');
    const helperEnd = source.indexOf('float liquidVolumeChromaResponse', helperStart);
    const blockStart = source.indexOf('    if (uGasIdentityStyling > 0.5) {');
    const blockEnd = source.indexOf('  } else if (liquidVolume > 0.5)', blockStart);
    const helper = source.slice(helperStart, helperEnd);
    const block = source.slice(blockStart, blockEnd);

    expect(helperStart).toBeGreaterThan(0);
    expect(helperEnd).toBeGreaterThan(helperStart);
    expect(blockStart).toBeGreaterThan(0);
    expect(blockEnd).toBeGreaterThan(blockStart);
    expect(helper).toContain('texture(uGasIdentityMotifTexture, motifUv)');
    expect(block).toContain('texture(uAtmosphereStyleTexture, fieldUv)');
    expect(block).toContain('color += gasIdentityVolumeDelta(');
    expect(source).toContain('resource: this.fieldSet.atmosphere.styleBytes');
    expect(source).toContain("format: 'r8unorm'");
    expect(source).toContain('this.atmosphereStyleSource.update();');
    expect(source).toContain('gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)');
    expect(source.indexOf('gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)'))
      .toBeLessThan(source.indexOf('this.app.render();', source.indexOf('private renderApplicationNow')));
    expect(`${helper}${block}`).not.toMatch(/\balpha\s*[+*]?=/);
    expect(`${helper}${block}`).not.toContain('uTime');
    expect(`${helper}${block}`).not.toMatch(/\b(?:sin|pow|normalize|length)\s*\(/);
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

  it('keeps liquid volume depth RGB-only and reuses the existing auxiliary resource', () => {
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
    expect(block).toContain('liquidOpticalDepth');
    expect(source).toContain('liquidOpticalDepth = boundaryStabilityAt(fieldUv)');
    expect(source).toContain('writeVerticalOpticalDepth(materials, this.boundaryStabilityBytes)');
    expect(source).toContain('if (boundaryTextureDirty) this.boundaryStabilitySource.update()');
    expect(source.match(/boundaryStabilitySource\.update\(\)/g)).toHaveLength(1);
    expect(`${helpers}${block}`).not.toContain('texture(');
    expect(`${helpers}${block}`).not.toMatch(/\balpha\s*[+*]?=/);
    expect(`${helpers}${block}`).not.toMatch(/\b(?:sin|pow|normalize|length)\s*\(/);
    expect(source.match(/texture\(uLiquidTexture/g)).toHaveLength(5);
    expect(source).not.toContain('sampler2D uLiquidVolumeChroma');
    expect(source).not.toContain('sampler2D uLiquidOpticalDepth');
  });

  it('seeds and redraws optional-last liquid material identity styling', () => {
    const presenter = presenterHarness();

    presenter.configurePresentation(
      true, true, true, true, true, true, true, true, true, 'smooth',
      true, true, true, true, true, true, true, true, true, true,
      true, true, true, true, true, false,
    );
    expect(presenter.uniforms.uniforms.uLiquidIdentityStyling).toBe(0);
    expect(presenter.app.render).not.toHaveBeenCalled();

    presenter.setLiquidIdentityStylingEnabled(true);
    expect(presenter.uniforms.uniforms.uLiquidIdentityStyling).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledOnce();
  });

  it('styles exactly fourteen authoritative unusual/radioactive liquids with bounded RGB arithmetic', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const helperStart = source.indexOf('vec3 liquidMaterialIdentityDelta(');
    const helperEnd = source.indexOf('vec3 botanicalIdentityDelta', helperStart);
    const helper = source.slice(helperStart, helperEnd);
    const blockStart = source.indexOf('// Fourteen unusual/radioactive liquids retain a world-anchored material signature');
    const blockEnd = source.indexOf('  } else {', blockStart);
    const block = source.slice(blockStart, blockEnd);
    const ids = [...helper.matchAll(/material == (\d+)\.0/g)].map((match) => Number(match[1]));
    const dispatchStart = helper.indexOf('  if (material == 38.0)');
    const commonSetup = helper.slice(helper.indexOf(') {') + 3, dispatchStart);

    expect(helperStart).toBeGreaterThan(0);
    expect(helperEnd).toBeGreaterThan(helperStart);
    expect(blockStart).toBeGreaterThan(0);
    expect(blockEnd).toBeGreaterThan(blockStart);
    expect(dispatchStart).toBeGreaterThan(0);
    expect(ids).toEqual([38, 54, 55, 56, 57, 59, 60, 61, 62, 202, 207, 100, 102, 104]);
    for (const motif of [
      'thinFilm', 'prism', 'bubbles', 'foldCrease',
      'ringBand', 'waxFamilyIdentityDelta', 'pasteResistFamilyIdentityDelta',
      'virusFamilyIdentityDelta',
      'frost', 'ribbon', 'deepBand', 'shear', 'outerRing',
    ]) expect(helper).toContain(motif);
    expect(commonSetup).toContain('smoothstep(0.08, 0.72, density)');
    expect(commonSetup).toContain('(0.45 + depth * 0.55)');
    expect(commonSetup).not.toMatch(/\b(?:fract|floor|abs|clamp)\s*\(/);
    expect(commonSetup).not.toMatch(/\b(?:tile|Saw|Fold|slopeKey)/);
    expect(helper).toContain('return clamp(identity * support, vec3(-0.055), vec3(0.055));');
    expect(block).toContain('uLiquidIdentityStyling > 0.5 && liquidOnly < 0.5 && halo < 0.5');
    expect(block).toContain('surfaceOnly < 0.5 && wall < 0.5 && emissionOnly < 0.5');
    expect(block).toContain('family == 2.0 && !materialEmissive');
    expect(block).toContain('(material == 38.0 || (material >= 54.0 && material <= 57.0)');
    expect(block).toContain('|| (material >= 59.0 && material <= 62.0)');
    expect(block).toContain('|| material == 100.0 || material == 102.0');
    expect(block).toContain('|| material == 104.0 || material == 202.0 || material == 207.0');
    expect(block).not.toContain('material == 54.0 || material == 55.0');
    expect(block).toContain('semanticSlope + volumeSlope');
    expect(`${helper}${block}`).not.toContain('texture(');
    expect(`${helper}${block}`).not.toMatch(/\balpha\s*[+*]?=/);
    expect(`${helper}${block}`).not.toMatch(/\b(?:sin|pow)\s*\(/);
    expect(`${helper}${block}`).not.toContain('uTime');
    expect(source).not.toContain('sampler2D uLiquidIdentityStyling');
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
    const helperEnd = source.indexOf('vec3 gasIdentityVolumeDelta', helperStart);
    const helpers = source.slice(helperStart, helperEnd);
    const solidStart = source.indexOf('// Reuse the semantic Hermite normal as a small family-coloured');
    const solidEnd = source.indexOf('// Give an authoritative opaque solid a coloured response', solidStart);
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
    const start = source.indexOf('// Stable two-dimensional bulk gets a coherent');
    const end = source.indexOf('float grainOffsetY', start);
    const block = source.slice(start, end);

    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(block).toContain('uPowderBodyDepth * powderBulkDepth');
    expect(block).toContain('step(224.0 / 255.0, boundaryStability)');
    expect(block).toContain('step(0.66, widePowderShape.x)');
    expect(block).toContain('step(5.5, widePowderShape.w)');
    expect(block).toContain('powderDirectedSlope * powderBodyDirectionalGain');
    expect(block).not.toContain('powderMacroRelief * 0.35');
    expect(block).toContain('(widePowderShape.w - 5.5) / 3.5');
    expect(block).toContain('powderBodySupportDepth * 0.88');
    expect(block).toContain('mix(0.030, -0.052, powderBodyVolumeDepth)');
    expect(block).toContain('-0.080, 0.085');
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

  it('keeps solid optical thickness on the existing phase-local byte and RGB-only', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const sampleStart = source.indexOf('// Solid thickness is the third phase-exclusive occupant');
    const sampleEnd = source.indexOf('if (family == 4.0 && boundaryStability', sampleStart);
    const shadingStart = source.indexOf('if (uSolidOpticalDepth > 0.5');
    const shadingEnd = source.indexOf('// Reuse the semantic Hermite normal', shadingStart);
    const sample = source.slice(sampleStart, sampleEnd);
    const shading = source.slice(shadingStart, shadingEnd);

    expect(sampleStart).toBeGreaterThan(0);
    expect(sample).toContain('solidOpticalDepth = boundaryStabilityAt(fieldUv)');
    expect(sample).not.toContain('uSolidOpticalDepthTexture');
    expect(shading).toContain('(solidOpticalDepth * 255.0 - 6.0) / 249.0');
    expect(shading).toContain('thicknessAbsorption');
    expect(shading).toContain('solidBodyMacroKey(optics)');
    expect(shading).toContain('solidBodyMacroShadow(optics)');
    expect(shading).toContain('solidReliefTone * 255.0 / macroStrength');
    expect(shading).toContain('surfaceOnly < 0.5');
    expect(shading).not.toContain('texture(');
    expect(shading).not.toMatch(/\balpha\s*[+*]?=/);
    expect(source).not.toContain('uSolidOpticalDepthTexture');
    expect(source.match(/this\.boundaryStabilitySource\.update\(\)/g)).toHaveLength(1);
  });

  it('seeds and redraws solid optical depth independently', () => {
    const presenter = presenterHarness();
    presenter.configurePresentation(
      true, true, true, true, true, true, true, true, true, 'smooth',
      true, true, true, true, true, true, true, true, true, false,
    );
    expect(presenter.uniforms.uniforms.uSolidOpticalDepth).toBe(0);
    expect(presenter.app.render).not.toHaveBeenCalled();

    presenter.setSolidOpticalDepthEnabled(true);
    expect(presenter.uniforms.uniforms.uSolidOpticalDepth).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledOnce();
  });

  it('redraws when audit emission volume chroma changes', () => {
    const presenter = presenterHarness();

    presenter.setEmissionVolumeChromaEnabled(false);
    expect(presenter.uniforms.uniforms.uEmissionVolumeChroma).toBe(0);
    expect(presenter.app.render).toHaveBeenCalledOnce();

    presenter.setEmissionVolumeChromaEnabled(true);
    expect(presenter.uniforms.uniforms.uEmissionVolumeChroma).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledTimes(2);
  });

  it('hydrates disabled emission volume chroma without an intermediate frame', () => {
    const presenter = presenterHarness();

    presenter.configurePresentation(
      true, true, true, true, true, true, true, true, true, 'smooth',
      true, true, true, true, true, true, true, false,
    );

    expect(presenter.uniforms.uniforms.uEmissionVolumeChroma).toBe(0);
    expect(presenter.app.render).not.toHaveBeenCalled();
  });

  it('redraws exact energy identity styling and keeps its shader block RGB-only', () => {
    const presenter = presenterHarness();
    presenter.setEnergyIdentityStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uEnergyIdentityStyling).toBe(0);
    presenter.setEnergyIdentityStylingEnabled(true);
    expect(presenter.uniforms.uniforms.uEnergyIdentityStyling).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledTimes(2);

    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const start = source.indexOf('vec3 energyIdentityDelta(');
    const end = source.indexOf('vec3 radioactiveBodyIdentityDelta(', start);
    const block = source.slice(start, end);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(source).toContain('uniform float uEnergyIdentityStyling;');
    expect(block).not.toContain('texture(');
    expect(block).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('styles exactly seven authoritative radioactive bodies without GPU samples', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const start = source.indexOf('vec3 radioactiveBodyIdentityDelta(');
    const end = source.indexOf('vec3 vibrStateDelta(', start);
    const block = source.slice(start, end);
    const ids = [...block.matchAll(/material == (\d+)\.0/g)].map((match) => Number(match[1]));
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(ids).toEqual([99, 108, 109, 111, 112, 105, 113]);
    expect(block).not.toContain('texture(');
    expect(block).not.toMatch(/\b(?:sin|pow|normalize|length)\s*\(/);
    expect(block).not.toMatch(/\balpha\s*[+*]?=/);
    expect(source).toContain('radioactiveBodyIdentityDelta(material, fieldPosition)');
    expect(source).toContain('* uEnergyIdentityStyling;');
  });

  it('decodes VIBR/BVBR native state from the existing wall sample with RGB-only arithmetic', () => {
    const presenter = presenterHarness();
    presenter.setVibrStateStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uVibrStateStyling).toBe(0);
    presenter.setVibrStateStylingEnabled(true);
    expect(presenter.uniforms.uniforms.uVibrStateStyling).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledTimes(2);

    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const start = source.indexOf('vec3 vibrStateDelta(');
    const end = source.indexOf('vec3 deutStateDelta(', start);
    const block = source.slice(start, end);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(block).toContain('float packedState = floor(stateBytes.x * 255.0 + 0.5)');
    expect(block).toContain('+ floor(stateBytes.y * 255.0 + 0.5) * 256.0;');
    expect(block).toContain('material != 99.0 && material != 113.0');
    expect(block).toContain('mod(packedState, 128.0)');
    expect(block).toContain('floor(packedState / 32768.0)');
    expect(block).not.toContain('texture(');
    expect(block).not.toMatch(/\b(?:sin|pow|normalize|length)\s*\(/);
    expect(block).not.toMatch(/\balpha\s*[+*]?=/);
    expect(source).toContain('vibrStateDelta(material, wallState.ba, fieldPosition)');
    expect(source).toContain('* uVibrStateStyling;');
  });

  it('decodes exact DEUT concentration from the shared state sample with RGB-only arithmetic', () => {
    const presenter = presenterHarness();
    presenter.setDeutStateStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uDeutStateStyling).toBe(0);
    presenter.setDeutStateStylingEnabled(true);
    expect(presenter.uniforms.uniforms.uDeutStateStyling).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledTimes(2);

    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const start = source.indexOf('vec3 deutStateDelta(');
    const end = source.indexOf('vec3 sourceTargetDelta(', start);
    const block = source.slice(start, end);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(block).toContain('material != 100.0');
    expect(block).toContain('+ floor(stateBytes.y * 255.0 + 0.5) * 256.0;');
    expect(block).toContain('(concentration - 240.0) / 5760.0');
    expect(block).not.toContain('texture(');
    expect(block).not.toMatch(/\b(?:sin|pow|normalize|length)\s*\(/);
    expect(block).not.toMatch(/\balpha\s*[+*]?=/);
    expect(source).toContain('deutStateDelta(material, wallState.ba, fieldPosition)');
    expect(source).toContain('uDeutStateStyling > 0.5 && material == 100.0');
  });

  it('decodes exact configured-source targets with sample-free RGB-only arithmetic', () => {
    const presenter = presenterHarness();
    presenter.setSourceTargetStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uSourceTargetStyling).toBe(0);
    presenter.setSourceTargetStylingEnabled(true);
    expect(presenter.uniforms.uniforms.uSourceTargetStyling).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledTimes(2);

    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const start = source.indexOf('vec3 sourceTargetDelta(');
    const end = source.indexOf('vec4 contactSample(', start);
    const block = source.slice(start, end);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    for (const owner of [124, 126, 127, 137, 158, 159]) {
      expect(block).toContain(`material == ${owner}.0`);
    }
    expect(block).toContain('(target >= 1.0 && target <= 170.0) || target == 217.0');
    expect(block).toContain('target == material');
    expect(block).toContain('+ floor(stateBytes.y * 255.0 + 0.5) * 256.0;');
    expect(block).not.toContain('texture(');
    expect(block).not.toMatch(/\b(?:sin|pow|normalize|length)\s*\(/);
    expect(block).not.toMatch(/\balpha\s*[+*]?=/);
    expect(source).toContain('sourceTargetDelta(material, wallState.ba, fieldPosition)');
    expect(source).toContain('* uSourceTargetStyling;');
  });

  it('keeps emission volume shading RGB-only and reuses existing aura samples', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const start = source.indexOf('// Reuse the four aura samples already needed');
    const end = source.indexOf('} else if (energyCore > 0.5)', start);
    const block = source.slice(start, end);

    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(block).toContain('uEmissionVolumeChroma');
    expect(block).toContain('emissionNeighbourMean');
    expect(block).not.toContain('texture(');
    expect(block).not.toMatch(/\balpha\s*[+*]?=/);
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

  it('seeds and redraws optional-last semantic role styling', () => {
    const presenter = presenterHarness();

    presenter.configurePresentation(
      true, true, true, true, true, true, true, true, true, 'smooth',
      true, true, true, true, true, true, true, true, true, true, false,
    );
    expect(presenter.uniforms.uniforms.uRoleMaterialStyling).toBe(0);
    expect(presenter.app.render).not.toHaveBeenCalled();

    presenter.setRoleMaterialStylingEnabled(true);
    expect(presenter.uniforms.uniforms.uRoleMaterialStyling).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledOnce();
  });

  it('redraws the independent explosive-powder identity toggle', () => {
    const presenter = presenterHarness();

    presenter.setExplosivePowderStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uExplosivePowderStyling).toBe(0);
    expect(presenter.app.render).toHaveBeenCalledOnce();

    presenter.setExplosivePowderStylingEnabled(true);
    expect(presenter.uniforms.uniforms.uExplosivePowderStyling).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledTimes(2);
  });

  it('redraws the independent native force-activity toggle', () => {
    const presenter = presenterHarness();

    presenter.setForceActivityStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uForceActivityStyling).toBe(0);
    expect(presenter.app.render).toHaveBeenCalledOnce();

    presenter.setForceActivityStylingEnabled(true);
    expect(presenter.uniforms.uniforms.uForceActivityStyling).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledTimes(2);
  });

  it('keeps ACEL/DCEL activity arithmetic-only and exact-owner guarded', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const start = source.indexOf('vec3 forceActivityDelta');
    const end = source.indexOf('vec3 deutStateDelta', start);
    const block = source.slice(start, end);

    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(block).toContain('material != 115.0 && material != 116.0');
    expect(block).toContain('mod(floor(packedState), 2.0)');
    expect(block).not.toContain('texture(');
    expect(block).not.toContain('uTime');
  });

  it('redraws the independent native POLO-state toggle', () => {
    const presenter = presenterHarness();

    presenter.setPoloStateStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uPoloStateStyling).toBe(0);
    expect(presenter.app.render).toHaveBeenCalledOnce();

    presenter.setPoloStateStylingEnabled(true);
    expect(presenter.uniforms.uniforms.uPoloStateStyling).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledTimes(2);
  });

  it('keeps POLO lifecycle state arithmetic-only, bounded, and exact-owner guarded', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const start = source.indexOf('vec3 poloStateDelta');
    const end = source.indexOf('vec3 deutStateDelta', start);
    const block = source.slice(start, end);

    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(block).toContain('material != 109.0');
    expect(block).toContain('packedState / 2048.0');
    expect(block).toContain('clamp(delta, vec3(-16.0), vec3(16.0))');
    expect(block).not.toContain('texture(');
    expect(block).not.toContain('uTime');
  });

  it('keeps explosive-powder identity arithmetic-only and RGB-only', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const start = source.indexOf('// Fourteen native explosive powders');
    const end = source.indexOf('      color *= 1.0 + powderMacroRelief;', start);
    const block = source.slice(start, end);

    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    for (const material of [14, 30, 31, 33, 84, 85, 86, 88, 89, 90, 91, 92, 94, 96]) {
      expect(block).toContain(`material == ${material}.0`);
    }
    expect(block).not.toContain('texture(');
    expect(block).not.toMatch(/\balpha\s*[+*]?=/);
    expect(block).not.toContain('uTime');
  });

  it('keeps role glyphs RGB-only and off reconstructed support', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const start = source.indexOf('// Static role accents cross phase boundaries');
    const end = source.indexOf('  float emission = energyCore > 0.5', start);
    const roleBlock = source.slice(start, end);

    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(source).toContain('uniform float uRoleMaterialStyling;');
    expect(roleBlock).toContain('&& surfaceOnly < 0.5');
    expect(roleBlock).toContain('uRoleMaterialStyling > 0.5');
    expect(roleBlock).not.toMatch(/texture\s*\(/);
    expect(roleBlock).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('seeds, redraws, and bounds cellular styling to RGB-only authoritative LIFE matter', () => {
    const presenter = presenterHarness();

    presenter.configurePresentation(
      true, true, true, true, true, true, true, true, true, 'smooth',
      true, true, true, true, true, true, true, true, true, true, true, false,
    );
    expect(presenter.uniforms.uniforms.uCellularMaterialStyling).toBe(0);
    expect(presenter.app.render).not.toHaveBeenCalled();

    presenter.setCellularMaterialStylingEnabled(true);
    expect(presenter.uniforms.uniforms.uCellularMaterialStyling).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledOnce();

    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const start = source.indexOf('// Static ctype-derived colony motifs');
    const end = source.indexOf('    } else if (smoothSurface > 0.5', start);
    const cellularBlock = source.slice(start, end);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(source).toContain('uniform float uCellularMaterialStyling;');
    expect(source).toContain('float smoothSurface = optics == 8.0 || optics == 19.0 ? 1.0 : 0.0;');
    expect(source).toContain('if (optics == 8.0 || optics == 19.0) return vec3(2.0, 1.0, 7.0);');
    expect(source).toContain('if (optics == 8.0 || optics == 19.0) {\n        thicknessGain = 23.0;');
    expect(cellularBlock).toContain('uCellularMaterialStyling > 0.5 && surfaceOnly < 0.5');
    expect(cellularBlock).not.toMatch(/texture\s*\(/);
    expect(cellularBlock).not.toMatch(/\balpha\s*[+*]?=/);
    expect(source).toContain('if (cellularSurface > 0.5 && surfaceOnly > 0.5) alpha = 0.0;');
  });

  it('seeds, redraws, and bounds sensor morphology to RGB-only authoritative sensor matter', () => {
    const presenter = presenterHarness();

    presenter.configurePresentation(
      true, true, true, true, true, true, true, true, true, 'smooth',
      true, true, true, true, true, true, true, true, true, true, true, true, false,
    );
    expect(presenter.uniforms.uniforms.uSensorMaterialStyling).toBe(0);
    expect(presenter.app.render).not.toHaveBeenCalled();

    presenter.setSensorMaterialStylingEnabled(true);
    expect(presenter.uniforms.uniforms.uSensorMaterialStyling).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledOnce();

    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const start = source.indexOf('// The seven native sensor bodies share one stable 24-cell instrument');
    const end = source.indexOf('    } else if (profile == 6.0)', start);
    const sensorBlock = source.slice(start, end);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(source).toContain('uniform float uSensorMaterialStyling;');
    expect(sensorBlock).toContain('uSensorMaterialStyling > 0.5 && material >= 164.0 && material <= 170.0');
    expect(sensorBlock).toContain('fieldPosition / 24.0');
    expect(sensorBlock).toContain('material == 164.0');
    expect(sensorBlock).toContain('material == 165.0');
    expect(sensorBlock).toContain('material == 166.0');
    expect(sensorBlock).toContain('material == 167.0');
    expect(sensorBlock).toContain('material == 168.0');
    expect(sensorBlock).toContain('material == 169.0');
    expect(sensorBlock).toContain('// DTEC: crosshair.');
    expect(sensorBlock).toContain('// INVIS: iris.');
    expect(sensorBlock).toContain('// LDTC: scan lines and sweep.');
    expect(sensorBlock).toContain('// LSNS: waveform.');
    expect(sensorBlock).toContain('// PSNS: pressure rings.');
    expect(sensorBlock).toContain('// TSNS: thermometer.');
    expect(sensorBlock).toContain('// VSNS: vector arrow.');
    expect(sensorBlock).toContain('surfaceOnly < 0.5 && halo < 0.5 && wall < 0.5');
    expect(sensorBlock).not.toMatch(/texture\s*\(/);
    expect(sensorBlock).not.toMatch(/\balpha\s*[+*]?=/);
    expect(sensorBlock).not.toContain('uTime');
  });

  it('seeds, redraws, and bounds unusual powder identities to granular RGB arithmetic', () => {
    const presenter = presenterHarness();

    presenter.configurePresentation(
      true, true, true, true, true, true, true, true, true, 'smooth',
      true, true, true, true, true, true, true, true, true, true, true, true, true, false,
    );
    expect(presenter.uniforms.uniforms.uUnusualPowderStyling).toBe(0);
    expect(presenter.app.render).not.toHaveBeenCalled();

    presenter.setUnusualPowderStylingEnabled(true);
    expect(presenter.uniforms.uniforms.uUnusualPowderStyling).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledOnce();

    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const start = source.indexOf('// Ten unusual native powders share the existing deterministic grain');
    const end = source.indexOf('      color *= 1.0 + powderMacroRelief;', start);
    const unusualBlock = source.slice(start, end);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(source).toContain('uniform float uUnusualPowderStyling;');
    expect(unusualBlock).toContain('uUnusualPowderStyling > 0.5 && unusualPowder > 0.5');
    expect(unusualBlock).toContain('family == 4.0 && traits < 0.5 && !materialEmissive');
    expect(unusualBlock).toContain('surfaceOnly < 0.5 && halo < 0.5 && wall < 0.5');
    expect(unusualBlock).toContain('wallOnly < 0.5 && emissionOnly < 0.5');
    for (const material of [43, 44, 45, 46, 47, 48, 49, 51, 198, 217]) {
      expect(unusualBlock).toContain(`material == ${material}.0`);
    }
    expect(unusualBlock).toContain('// ANAR: pale feather shafts with restrained barbs.');
    expect(unusualBlock).toContain('// BGLA: cool angular glass splinters.');
    expect(unusualBlock).toContain('// BREC: dark PCB fragments crossed by copper traces and pads.');
    expect(unusualBlock).toContain('// BRMT: oxidized plates with dark seams and muted patina.');
    expect(unusualBlock).toContain('// FRZZ: compact frost stars cut into the loose crystal field.');
    expect(unusualBlock).toContain('// GRAV: bands align to the already sampled particle velocity.');
    expect(unusualBlock).toContain('// SAWD: warm fibres run in staggered longitudinal bundles.');
    expect(unusualBlock).toContain('// SLCN: crossed cleavage planes catch a cold edge light.');
    expect(unusualBlock).toContain('// DYST: dead-colony clumps retain sparse ochre islands.');
    expect(unusualBlock).toContain('// BCOL: fractured carbon with sparse warm mineral inclusions.');
    expect(unusualBlock).toContain('normalize(velocity)');
    expect(unusualBlock).not.toMatch(/texture\s*\(/);
    expect(unusualBlock).not.toMatch(/\balpha\s*[+*]?=/);
    expect(unusualBlock).not.toContain('uTime');
    expect(unusualBlock).not.toContain('sin(');
  });

  it('seeds, redraws, and aligns exact botanical identity with bounded RGB arithmetic', () => {
    const presenter = presenterHarness();
    presenter.setBotanicalIdentityStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uBotanicalIdentityStyling).toBe(0);
    expect(presenter.app.render).toHaveBeenCalledOnce();
    presenter.app.render.mockClear();
    presenter.setBotanicalIdentityStylingEnabled(true);
    expect(presenter.uniforms.uniforms.uBotanicalIdentityStyling).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledOnce();

    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const start = source.indexOf('vec3 botanicalIdentityDelta(');
    const end = source.indexOf('vec3 vividColor', start);
    const helper = source.slice(start, end);
    const ids = [...helper.matchAll(/material == (\d+)\.0/g)].map((match) => Number(match[1]));
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(ids).toEqual([9, 10, 83, 50, 52]);
    for (const motif of ['ring', 'axial', 'vein', 'strand', 'node', 'husk', 'embryo', 'cellRim', 'bud']) {
      expect(helper).toContain(motif);
    }
    expect(helper).toContain('clamp(delta, vec3(-12.0), vec3(12.0)) / 255.0');
    expect(helper).not.toContain('texture(');
    expect(helper).not.toContain('uTime');
    expect(helper).not.toMatch(/\balpha\s*[+*]?=/);
    expect(source).toContain('botanicalIdentity > 0.5 && uBotanicalIdentityStyling > 0.5');
    expect(source).toContain('color += botanicalIdentityDelta(material, fieldPosition);');
  });

  it('seeds, redraws, and bounds unusual solid identities to authoritative RGB arithmetic', () => {
    const presenter = presenterHarness();

    presenter.configurePresentation(
      true, true, true, true, true, true, true, true, true, 'smooth',
      true, true, true, true, true, true, true, true, true, true, true, true, true, true, false,
    );
    expect(presenter.uniforms.uniforms.uUnusualSolidStyling).toBe(0);
    expect(presenter.app.render).not.toHaveBeenCalled();

    presenter.setUnusualSolidStylingEnabled(true);
    expect(presenter.uniforms.uniforms.uUnusualSolidStyling).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledOnce();

    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const start = source.indexOf('// Thirteen uncommon solids layer one static identity');
    const end = source.indexOf('    if (uThermalMaterialStyling > 0.5', start);
    const unusualSolidBlock = source.slice(start, end);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(source).toContain('uniform float uUnusualSolidStyling;');
    expect(unusualSolidBlock).toContain('uUnusualSolidStyling > 0.5 && unusualSolid > 0.5');
    expect(unusualSolidBlock).toContain('family == 0.0 && !materialEmissive');
    expect(unusualSolidBlock).toContain('surfaceOnly < 0.5 && halo < 0.5 && wall < 0.5');
    expect(unusualSolidBlock).toContain('wallOnly < 0.5 && emissionOnly < 0.5');
    for (const material of [27, 68, 74, 76, 77, 79, 80, 196, 206, 208, 209, 210, 216]) {
      expect(unusualSolidBlock).toContain(`material == ${material}.0`);
    }
    expect(unusualSolidBlock).toContain('// BIZRS: angular prismatic facets split cool and warm reflections.');
    expect(unusualSolidBlock).toContain('// RSSS/PSTS: native solid products retain their liquid family\'s exact');
    expect(unusualSolidBlock).toContain('// SHLD1-4: one coherent shell gains progressively nested armour bands.');
    expect(unusualSolidBlock).toContain('// VRSS: the same family capsid is carried by the rigid solid body.');
    expect(unusualSolidBlock).toContain('// WAX: crystalline blooms and cooling lamellae share MWAX\'s topology.');
    expect(unusualSolidBlock).toContain('crystallineSolidIdentityDelta(material, fieldPosition)');
    expect(unusualSolidBlock).toContain('virusFamilyIdentityDelta(2.0, fieldPosition)');
    expect(unusualSolidBlock).toContain('solidDepth');
    expect(unusualSolidBlock).not.toMatch(/texture\s*\(/);
    expect(unusualSolidBlock).not.toMatch(/\balpha\s*[+*]?=/);
    expect(unusualSolidBlock).not.toContain('uTime');
    expect(unusualSolidBlock).not.toContain('sin(');
  });

  it('uses one sample-free 16-cell virus grammar across liquid and solid phases', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const start = source.indexOf('vec3 virusFamilyIdentityDelta(');
    const end = source.indexOf('vec3 liquidMaterialIdentityDelta(', start);
    const helper = source.slice(start, end);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(helper).toContain('mod(floor(worldPosition), 16.0)');
    expect(helper).toContain('membrane');
    expect(helper).toContain('capsid');
    expect(helper).toContain('attachment');
    expect(helper).not.toContain('texture(');
    expect(helper).not.toContain('uTime');
    expect(source).toContain('identity = virusFamilyIdentityDelta(0.0, worldPosition);');
    expect(source).toContain('color += virusFamilyIdentityDelta(2.0, fieldPosition);');
    expect(source).toContain('virusFamily < 0.5');
  });

  it('uses one sample-free 32-cell wax grammar across solid and liquid phases', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const start = source.indexOf('vec3 waxFamilyIdentityDelta(');
    const end = source.indexOf('vec3 crystallineSolidIdentityDelta(', start);
    const helper = source.slice(start, end);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(helper).toContain('mod(floor(worldPosition), 32.0)');
    expect(helper).toContain('lamella');
    expect(helper).toContain('bloom');
    expect(helper).toContain('waxJoint');
    expect(helper).not.toContain('texture(');
    expect(helper).not.toContain('uTime');
    expect(source).toContain('identity = waxFamilyIdentityDelta(1.0, worldPosition);');
    expect(source).toContain('color += waxFamilyIdentityDelta(0.0, fieldPosition);');
  });

  it('uses sample-free 32-cell crystalline grammars for exact solid projections', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const start = source.indexOf('vec3 crystallineSolidIdentityDelta(');
    const end = source.indexOf('vec3 pasteResistFamilyIdentityDelta(', start);
    const helper = source.slice(start, end);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(helper).toContain('mod(floor(worldPosition), 32.0)');
    for (const material of [68, 74, 76]) {
      expect(helper).toContain(`material == ${material}.0`);
    }
    for (const motif of ['fracture', 'frostLip', 'risingFacet', 'fallingFacet',
      'prismEdge', 'cleavage', 'spine', 'branch', 'node', 'tip']) {
      expect(helper).toContain(motif);
    }
    expect(helper).not.toContain('texture(');
    expect(helper).not.toContain('uTime');
    expect(helper).not.toContain('sin(');
    expect(helper).not.toMatch(/\balpha\s*[+*]?=/);
    expect(source).toContain('color += crystallineSolidIdentityDelta(material, fieldPosition);');
  });

  it('uses two sample-free 32-cell grammars across paste and resist phases', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const start = source.indexOf('vec3 pasteResistFamilyIdentityDelta(');
    const end = source.indexOf('vec3 liquidMaterialIdentityDelta(', start);
    const helper = source.slice(start, end);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(helper).toContain('mod(floor(worldPosition), 32.0)');
    for (const motif of ['layer', 'seam', 'pocket', 'rising', 'falling', 'node', 'junction']) {
      expect(helper).toContain(motif);
    }
    expect(helper).not.toContain('texture(');
    expect(helper).not.toContain('uTime');
    expect(helper).not.toContain('sin(');
    expect(helper).not.toMatch(/\balpha\s*[+*]?=/);
    expect(source).toContain('identity = pasteResistFamilyIdentityDelta(0.0, 1.0, worldPosition);');
    expect(source).toContain('identity = pasteResistFamilyIdentityDelta(1.0, 1.0, worldPosition);');
    expect(source).toContain('material == 206.0 ? 0.0 : 1.0, 0.0, fieldPosition');
  });

  it('keeps contour and thick-body solid field light bounded behind strict eligibility', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const start = source.indexOf('// Give an authoritative opaque solid a coloured response');
    const end = source.indexOf('    if (!materialEmissive && surfaceOnly < 0.5)', start);
    const solidFieldBlock = source.slice(start, end);

    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(source).toContain('uniform float uSolidFieldLighting;');
    expect(solidFieldBlock).toContain('uSolidFieldLighting > 0.5 && family == 0.0 && halo < 0.5');
    expect(solidFieldBlock).toContain('surfaceOnly < 0.5 && wall < 0.5 && material != 3.0');
    expect(solidFieldBlock).toContain('!materialEmissive && optics != 12.0');
    expect(solidFieldBlock).toContain('traits < 0.5 && density > 0.08 && density < 0.92');
    expect(solidFieldBlock).toContain('solidOpticalDepth > 6.0 / 255.0');
    expect(solidFieldBlock).toContain('solidBodyFieldTraitEligibility(traits) > 0.5');
    expect(source).toContain('float solidBodyFieldTraitEligibility(float traits)');
    expect(source).toContain('mod(floor(traits / 128.0), 2.0)');
    expect(solidFieldBlock).toContain('solidBodyFieldExposure(');
    expect(solidFieldBlock).toContain('12.0 / 255.0');
    expect(solidFieldBlock).toContain('emissionState.a * surfaceLightGain(profile) * bodyExposure');
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

  it('lets the explicit browser audit exercise the production 8x stall branch', () => {
    let scheduled: FrameRequestCallback | undefined;
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      scheduled = callback;
      return 31;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const healthyFence = {} as WebGLSync;
    const fence = {} as WebGLSync;
    const gl = {
      SYNC_GPU_COMMANDS_COMPLETE: 0x9117,
      fenceSync: vi.fn(() => fence),
      deleteSync: vi.fn(),
    };
    const stalled = vi.fn();
    const presenter = presenterHarness();
    Object.assign(presenter, {
      outputScale: 8,
      firstFrameReady: true,
      renderFence: healthyFence,
      renderFenceStartedAt: performance.now(),
      app: { ...presenter.app, renderer: { gl } },
    });
    presenter.setRenderStallHandler(stalled);

    expect(presenter.forceEightXRenderStallForAudit()).toBe(true);
    expect(gl.fenceSync).toHaveBeenCalledWith(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    expect(gl.deleteSync).toHaveBeenNthCalledWith(1, healthyFence);
    expect(gl.deleteSync).toHaveBeenCalledTimes(1);
    expect(stalled).not.toHaveBeenCalled();

    scheduled?.(performance.now());

    expect(gl.deleteSync).toHaveBeenNthCalledWith(2, fence);
    expect(stalled).toHaveBeenCalledOnce();

    Object.assign(presenter, { outputScale: 4 });
    expect(presenter.forceEightXRenderStallForAudit()).toBe(false);
  });
});
