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
  setAqueousSurfaceReflectionEnabled: PixiFieldPresenter['setAqueousSurfaceReflectionEnabled'];
  setLiquidVolumeChromaEnabled: PixiFieldPresenter['setLiquidVolumeChromaEnabled'];
  setLiquidIdentityStylingEnabled: PixiFieldPresenter['setLiquidIdentityStylingEnabled'];
  setLiquidOpticalDepthEnabled: PixiFieldPresenter['setLiquidOpticalDepthEnabled'];
  setSolidOpticalDepthEnabled: PixiFieldPresenter['setSolidOpticalDepthEnabled'];
  setPowderBodyDepthEnabled: PixiFieldPresenter['setPowderBodyDepthEnabled'];
  setSurfaceContourLightingEnabled: PixiFieldPresenter['setSurfaceContourLightingEnabled'];
  setPhaseContactLightingEnabled: PixiFieldPresenter['setPhaseContactLightingEnabled'];
  setSolidFieldLightingEnabled: PixiFieldPresenter['setSolidFieldLightingEnabled'];
  setDenseBodyAmbientFillEnabled: PixiFieldPresenter['setDenseBodyAmbientFillEnabled'];
  setRoleMaterialStylingEnabled: PixiFieldPresenter['setRoleMaterialStylingEnabled'];
  setCellularMaterialStylingEnabled: PixiFieldPresenter['setCellularMaterialStylingEnabled'];
  setStructuralRigidStylingEnabled: PixiFieldPresenter['setStructuralRigidStylingEnabled'];
  setGeologicalSolidStylingEnabled: PixiFieldPresenter['setGeologicalSolidStylingEnabled'];
  setFrayForceStylingEnabled: PixiFieldPresenter['setFrayForceStylingEnabled'];
  setGbmbForceStylingEnabled: PixiFieldPresenter['setGbmbForceStylingEnabled'];
  setMechanismBodyStylingEnabled: PixiFieldPresenter['setMechanismBodyStylingEnabled'];
  setElectronicIdentityStylingEnabled: PixiFieldPresenter['setElectronicIdentityStylingEnabled'];
  setFieldProfileIdentityStylingEnabled: PixiFieldPresenter['setFieldProfileIdentityStylingEnabled'];
  setEarthenPowderStylingEnabled: PixiFieldPresenter['setEarthenPowderStylingEnabled'];
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
  setSpngStateStylingEnabled: PixiFieldPresenter['setSpngStateStylingEnabled'];
  setLcryStateStylingEnabled: PixiFieldPresenter['setLcryStateStylingEnabled'];
  setPipePresentationStylingEnabled: PixiFieldPresenter['setPipePresentationStylingEnabled'];
  setSwchStateStylingEnabled: PixiFieldPresenter['setSwchStateStylingEnabled'];
  setDlayStateStylingEnabled: PixiFieldPresenter['setDlayStateStylingEnabled'];
  setWifiStateStylingEnabled: PixiFieldPresenter['setWifiStateStylingEnabled'];
  setLavaAncestryStylingEnabled: PixiFieldPresenter['setLavaAncestryStylingEnabled'];
  setMoltenBodyOpticsEnabled: PixiFieldPresenter['setMoltenBodyOpticsEnabled'];
  setBotanicalIdentityStylingEnabled: PixiFieldPresenter['setBotanicalIdentityStylingEnabled'];
  setBotanicalLifecycleStylingEnabled: PixiFieldPresenter['setBotanicalLifecycleStylingEnabled'];
  setSparkStateStylingEnabled: PixiFieldPresenter['setSparkStateStylingEnabled'];
  setLiquidSilhouetteCohesionEnabled: PixiFieldPresenter['setLiquidSilhouetteCohesionEnabled'];
  setRenderStallHandler: PixiFieldPresenter['setRenderStallHandler'];
  forceEightXRenderStallForAudit: PixiFieldPresenter['forceEightXRenderStallForAudit'];
  setTransform: PixiFieldPresenter['setTransform'];
  waitForFirstFrame: PixiFieldPresenter['waitForFirstFrame'];
  enableWebGLPresentationTiming: PixiFieldPresenter['enableWebGLPresentationTiming'];
  requestWebGLPresentationTimingSample: PixiFieldPresenter['requestWebGLPresentationTimingSample'];
  getWebGLPresentationTiming: PixiFieldPresenter['getWebGLPresentationTiming'];
  webGLTimingRequested: boolean;
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
    renderFenceWatchdog: undefined,
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
      uAqueousSurfaceReflection: 1,
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
      uDenseBodyAmbientFill: 1,
      uRoleMaterialStyling: 1,
      uCellularMaterialStyling: 1,
      uStructuralRigidStyling: 1,
      uMechanismBodyStyling: 1,
      uElectronicIdentityStyling: 1,
      uEarthenPowderStyling: 1,
      uSensorMaterialStyling: 1,
      uUnusualPowderStyling: 1,
      uUnusualSolidStyling: 1,
      uLiquidSilhouetteCohesion: 1,
      uThermalMaterialStyling: 1,
      uEnergyCoreRelief: 0,
      uDeutStateStyling: 1,
      uSourceTargetStyling: 1,
      uFiltSpectrumStyling: 1,
      uLcryStateStyling: 1,
      uPipePresentationStyling: 1,
      uSwchStateStyling: 1,
      uDlayStateStyling: 1,
      uWifiStateStyling: 1,
      uMoltenBodyOptics: 1,
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

  it('keeps the optional GLSL blackbody ramp aligned with its CPU reference and out of 8x', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const reference = readFileSync(new URL('./blackbody-emission.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `', eightStart);

    expect(eightStart).toBeGreaterThanOrEqual(0);
    expect(normalStart).toBeGreaterThan(eightStart);
    expect(source.slice(eightStart, normalStart)).not.toContain('blackbodyHdrRadiance');
    expect(source.slice(normalStart)).toContain('temperatureByte * 25.6');
    expect(source.slice(normalStart)).toContain('smoothstep(28.0, 52.0, temperatureByte)');
    expect(source.slice(normalStart)).toContain('smoothstep(52.0, 255.0, temperatureByte)');
    expect(reference).toContain('semanticTemperatureKelvin(temperatureByte)');
    expect(reference).toContain('smoothstep(28, 52, temperatureByte)');
    expect(reference).toContain('smoothstep(52, 255, temperatureByte)');
    for (const coefficient of [
      '329.698727446', '-0.1332047592', '99.4708025861', '161.1195681661',
      '288.1221695283', '-0.0755148492', '138.5177312231', '305.0447927307',
    ]) {
      expect(source).toContain(coefficient);
      expect(reference).toContain(coefficient);
    }
    expect(source.match(/this\.uniforms\.uniforms\.uHDRVfx = 0;/g)).toHaveLength(2);
  });

  it('keeps opt-in field volume VFX on the normal HDR compositor only', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const canvasSource = readFileSync(new URL('./field-renderer.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const normalEnd = source.indexOf('`;\n\n/** Primary WebGL presentation', normalStart);
    const eight = source.slice(eightStart, normalStart);
    const normal = source.slice(normalStart, normalEnd);
    const gasBody = normal.indexOf('    // Dense reconstructed gas should read as one mixed volume');
    const gasStart = normal.lastIndexOf('  } else if (gasVolume > 0.5) {', gasBody);
    const energyStart = normal.lastIndexOf('  } else if (energyCore > 0.5) {', gasStart);
    const energy = normal.slice(energyStart, gasStart);
    const plasmaCoreVfxStart = energy.indexOf('    // E16:');
    const plasmaCoreVfxBranchStart = energy.indexOf(
      '    if (uPlasmaCoreVfx > 0.5', plasmaCoreVfxStart,
    );
    const plasmaCoreVfx = energy.slice(plasmaCoreVfxBranchStart);
    const liquidStart = normal.indexOf('  } else if (liquidVolume > 0.5) {', gasStart);
    const powderStart = normal.indexOf('    float powderVisualCohesion = 0.0;', liquidStart);
    const gas = normal.slice(gasStart, liquidStart);
    const liquid = normal.slice(liquidStart, powderStart);
    const powder = normal.slice(powderStart);
    const gasVfxStart = gas.indexOf('    if (uGasBodyVfx > 0.5)');
    const gasVfxEnd = gas.indexOf('    if (uGasIdentityStyling > 0.5)', gasVfxStart);
    const gasLightVfxStart = gas.indexOf('    // E13:');
    const gasLightVfxBranchStart = gas.indexOf(
      '    if (uGasLightVfx > 0.5', gasLightVfxStart,
    );
    const gasLightVfxEnd = gas.indexOf(
      "    // The atmosphere's existing cardinal field samples", gasLightVfxBranchStart,
    );
    const gasLightVfx = gas.slice(gasLightVfxBranchStart, gasLightVfxEnd);
    const gasCoreDepthVfxStart = gas.indexOf('      // E15:');
    const gasCoreDepthVfxBranchStart = gas.indexOf(
      '      if (uGasCoreDepthVfx > 0.5', gasCoreDepthVfxStart,
    );
    const gasCoreDepthVfxEnd = gas.indexOf('      // E25:', gasCoreDepthVfxBranchStart);
    const gasCoreDepthVfx = gas.slice(gasCoreDepthVfxBranchStart, gasCoreDepthVfxEnd);
    const liquidVfxStart = liquid.indexOf('        if (uLiquidBodyVfx > 0.5');
    const liquidVfxEnd = liquid.indexOf('    // E14:', liquidVfxStart);
    const liquidSolidMeniscusVfxStart = liquid.indexOf('    // E14:', liquidVfxEnd);
    const liquidSolidMeniscusVfxBranchStart = liquid.indexOf(
      '    if (uLiquidSolidMeniscusVfx > 0.5', liquidSolidMeniscusVfxStart,
    );
    const liquidSolidMeniscusVfxEnd = liquid.indexOf(
      '    // Twenty ordinary, unusual, metallic', liquidSolidMeniscusVfxBranchStart,
    );
    const liquidSolidMeniscusVfx = liquid.slice(
      liquidSolidMeniscusVfxBranchStart, liquidSolidMeniscusVfxEnd,
    );
    const powderVfxStart = powder.indexOf('        if (uVolumeVfx > 0.5');
    const powderVfxEnd = powder.indexOf('        // E05:', powderVfxStart);
    const powderBodyVfxStart = powder.indexOf('        if (uPowderBodyVfx > 0.5', powderVfxEnd);
    const powderBodyVfxEnd = powder.indexOf(
      '        // This is intentionally stricter than a generic settled-powder',
      powderBodyVfxStart,
    );
    const powderLightCarrierStart = powder.indexOf(
      '        powderLightBodyGate = powderBodyGate',
    );
    const powderLightCarrierEnd = powder.indexOf(
      '        // Rough granular bodies need a little more dense-core absorption',
      powderLightCarrierStart,
    );
    const powderLightVfxStart = powder.indexOf('    // E06:', powderBodyVfxEnd);
    const powderLightVfxEnd = powder.indexOf(
      '    color += fieldLightContribution;', powderLightVfxStart,
    );
    const powderSolidContactVfxStart = normal.indexOf('  // E09:');
    const powderSolidContactVfxBranchStart = normal.indexOf(
      '  if (uPowderSolidContactVfx > 0.5', powderSolidContactVfxStart,
    );
    const powderSolidContactVfxEnd = normal.indexOf(
      '  if (halo > 0.5', powderSolidContactVfxBranchStart,
    );
    const translucentEdgeVfxStart = normal.indexOf('      // E10:');
    const translucentEdgeVfxBranchStart = normal.indexOf(
      '      if (uTranslucentEdgeVfx > 0.5', translucentEdgeVfxStart,
    );
    const translucentEdgeVfxEnd = normal.indexOf(
      '      float translucentAlpha', translucentEdgeVfxBranchStart,
    );
    const gasVfx = gas.slice(gasVfxStart, gasVfxEnd);
    const liquidVfx = liquid.slice(liquidVfxStart, liquidVfxEnd);
    const powderVfx = powder.slice(powderVfxStart, powderVfxEnd);
    const powderBodyVfx = powder.slice(powderBodyVfxStart, powderBodyVfxEnd);
    const powderLightCarrier = powder.slice(powderLightCarrierStart, powderLightCarrierEnd);
    const powderLightVfx = powder.slice(powderLightVfxStart, powderLightVfxEnd);
    const powderSolidContactVfx = normal.slice(
      powderSolidContactVfxBranchStart, powderSolidContactVfxEnd,
    );
    const translucentEdgeVfx = normal.slice(translucentEdgeVfxBranchStart, translucentEdgeVfxEnd);
    const organicSubsurfaceVfxStart = normal.indexOf('  // E11:');
    const organicSubsurfaceVfxBranchStart = normal.indexOf(
      '  if (uOrganicSubsurfaceVfx > 0.5', organicSubsurfaceVfxStart,
    );
    const organicSubsurfaceVfxEnd = normal.indexOf(
      '  if (uHDRVfx > 0.5)', organicSubsurfaceVfxBranchStart,
    );
    const organicSubsurfaceVfx = normal.slice(
      organicSubsurfaceVfxBranchStart, organicSubsurfaceVfxEnd,
    );
    const wetSedimentVfxStart = normal.indexOf('    // E12:');
    const wetSedimentVfxBranchStart = normal.indexOf(
      '    if (uWetSedimentVfx > 0.5', wetSedimentVfxStart,
    );
    const wetSedimentVfxEnd = normal.indexOf('  // E09:', wetSedimentVfxBranchStart);
    const wetSedimentVfx = normal.slice(wetSedimentVfxBranchStart, wetSedimentVfxEnd);

    expect(eightStart).toBeGreaterThanOrEqual(0);
    expect(normalStart).toBeGreaterThan(eightStart);
    expect(normalEnd).toBeGreaterThan(normalStart);
    expect(gasBody).toBeGreaterThanOrEqual(0);
    expect(gasStart).toBeGreaterThanOrEqual(0);
    expect(liquidStart).toBeGreaterThan(gasStart);
    expect(powderStart).toBeGreaterThan(liquidStart);
    expect(normal).toContain('uniform float uVolumeVfx;');
    expect(normal).toContain('uniform float uGasBodyVfx;');
    expect(normal).toContain('uniform float uGasMotionVfx;');
    expect(normal).toContain('uniform float uGasLightVfx;');
    expect(normal).toContain('uniform float uGasCoreDepthVfx;');
    expect(normal).toContain('uniform float uPlasmaCoreVfx;');
    expect(normal).toContain('uniform float uLiquidBodyVfx;');
    expect(normal).toContain('uniform float uLiquidSolidMeniscusVfx;');
    expect(normal).toContain('uniform float uPowderBodyVfx;');
    expect(normal).toContain('uniform float uPowderLightVfx;');
    expect(normal).toContain('uniform float uPowderSolidContactVfx;');
    expect(normal).toContain('uniform float uTranslucentEdgeVfx;');
    expect(normal).toContain('uniform float uOrganicSubsurfaceVfx;');
    expect(normal).toContain('uniform float uWetSedimentVfx;');
    expect(eight).not.toContain('uVolumeVfx');
    expect(eight).not.toContain('uGasBodyVfx');
    expect(eight).not.toContain('uGasMotionVfx');
    expect(eight).not.toContain('uGasLightVfx');
    expect(eight).not.toContain('gasLightVfx');
    expect(canvasSource).not.toContain('gasLightVfx');
    expect(eight).not.toContain('uGasCoreDepthVfx');
    expect(eight).not.toContain('gasCoreDepthVfx');
    expect(canvasSource).not.toContain('gasCoreDepthVfx');
    expect(eight).not.toContain('uPlasmaCoreVfx');
    expect(eight).not.toContain('plasmaCoreVfx');
    expect(canvasSource).not.toContain('plasmaCoreVfx');
    expect(eight).not.toContain('uLiquidBodyVfx');
    expect(eight).not.toContain('uLiquidSolidMeniscusVfx');
    expect(eight).not.toContain('liquidSolidMeniscusVfx');
    expect(canvasSource).not.toContain('liquidSolidMeniscusVfx');
    expect(eight).not.toContain('uPowderBodyVfx');
    expect(eight).not.toContain('uPowderLightVfx');
    expect(eight).not.toContain('uPowderSolidContactVfx');
    expect(eight).not.toContain('powderSolidContactVfx');
    expect(eight).not.toContain('uTranslucentEdgeVfx');
    expect(eight).not.toContain('translucentEdgeVfx');
    expect(canvasSource).not.toContain('translucentEdgeVfx');
    expect(eight).not.toContain('uOrganicSubsurfaceVfx');
    expect(eight).not.toContain('organicSubsurfaceVfx');
    expect(canvasSource).not.toContain('organicSubsurfaceVfx');
    expect(eight).not.toContain('uWetSedimentVfx');
    expect(eight).not.toContain('wetSedimentVfx');
    expect(canvasSource).not.toContain('wetSedimentVfx');

    // Gas stays field-owned: its independent E04 selector reuses the
    // established mass/curvature/scatter scalars and never samples or assigns
    // support/opacity.
    expect(gas).toContain('if (uGasBodyVfx > 0.5)');
    expect(gas).toContain('gasShadeDensity');
    expect(gas).toContain('gasCurvature');
    expect(gas).toContain('gasForwardScatter');
    expect(gasVfxStart).toBeGreaterThanOrEqual(0);
    expect(gasVfxEnd).toBeGreaterThan(gasVfxStart);
    expect(gasVfx).toContain('sin(dot(fieldPosition');
    expect(gasVfx).toContain('gasVfxBodySupport');
    expect(normal).toContain('gasStyleState = texture(uAtmosphereStyleTexture, fieldUv)');
    expect(normal.match(/texture\(uAtmosphereStyleTexture/g)).toHaveLength(1);
    expect(normal).toContain('if (uGasIdentityStyling > 0.5 || uGasMotionVfx > 0.5)');
    expect(gasVfx).toContain('if (uGasMotionVfx > 0.5)');
    expect(gasVfx).toContain('floor(gasStyleState.gb * 255.0 + vec2(0.5))');
    expect(gasVfx).toContain('smoothstep(0.45, 0.75, gasStyleState.a)');
    expect(gasVfx).toContain('gasMotionOutward = -volumeSlope');
    expect(gasVfx).toContain('gasMotionBillowGradient');
    expect(gasVfx).toContain('gasMotionInteriorTone + gasMotionEdgeTone');
    expect(gasVfx).toContain('* max(gasMotionTone, 0.0) * (32.0 / 255.0)');
    expect(gasVfx).toContain('* vec3(-64.0, 28.0, 52.0) / 255.0');
    expect(gasVfx).toContain('gasMotionShadowBytes = material == 87.0 ? 40.0 : 32.0');

    // E13 consumes the existing propagated identity and already-derived scene
    // light values. It must never widen the style/emission sample conditions or
    // infer species from one semantic carrier inside a field-owned cloud.
    expect(gasLightVfxStart).toBeGreaterThanOrEqual(0);
    expect(gasLightVfxBranchStart).toBeGreaterThan(gasLightVfxStart);
    expect(gasLightVfxEnd).toBeGreaterThan(gasLightVfxBranchStart);
    expect(gasLightVfx).toContain('uGasFieldLighting > 0.5');
    expect(gasLightVfx).toContain('uGasIdentityStyling > 0.5');
    expect(gasLightVfx).toContain('wall < 0.5');
    expect(gasLightVfx).toContain('gasInterior > 0.5');
    expect(gasLightVfx).toContain('gasLightStyle - 1.0');
    expect(gasLightVfx).toContain('gasLightStyle - 10.0');
    expect(gasLightVfx).toContain('gasLightColor');
    expect(gasLightVfx).toContain('gasLightIncidence');
    expect(gasLightVfx).toContain('gasForwardScatter');
    expect(gasLightVfx).toContain('gasSpectralAbsorption');
    expect(gasLightVfx).not.toContain('texture(');
    expect(gasLightVfx).not.toContain('uTime');
    expect(gasLightVfx).not.toContain('gl_FragCoord');
    expect(gasLightVfx).not.toMatch(/\balpha\s*[+*]?=/);

    // E15 is a species-aware RGB grade over E04's already-live body values.
    // It cannot sample, animate, widen support, or leak into the compact 8x or
    // Canvas paths. Exact style guards keep foreign/emissive gases unchanged.
    expect(gasCoreDepthVfxStart).toBeGreaterThanOrEqual(0);
    expect(gasCoreDepthVfxBranchStart).toBeGreaterThan(gasCoreDepthVfxStart);
    expect(gasCoreDepthVfxEnd).toBeGreaterThan(gasCoreDepthVfxBranchStart);
    expect(gasCoreDepthVfx).toContain('uGasIdentityStyling > 0.5');
    expect(gasCoreDepthVfx).toContain('wall < 0.5');
    expect(gasCoreDepthVfx).toContain('!materialEmissive');
    expect(gasCoreDepthVfx).toContain('gasCoreStyle - 1.0');
    expect(gasCoreDepthVfx).toContain('gasCoreStyle - 4.0');
    expect(gasCoreDepthVfx).toContain('gasCoreStyle - 7.0');
    expect(gasCoreDepthVfx).toContain('gasVfxBodySupport');
    expect(gasCoreDepthVfx).toContain('cloudNeighbourMean');
    expect(gasCoreDepthVfx).toContain('atmosphereState.a');
    expect(gasCoreDepthVfx).toContain('gasVfxBillow');
    expect(gas).toContain('sin(dot(fieldPosition, vec2(0.055, 0.031)) + 0.80)');
    expect(gas).toContain('sin(dot(fieldPosition, vec2(-0.029, 0.081)) + 2.15)');
    expect(gas).toContain('sin(dot(fieldPosition, vec2(0.097, -0.043)) + 4.05)');
    expect(gas).toContain('gasVfxWaveA * 0.50 + gasVfxWaveB * 0.31 + gasVfxWaveC * 0.19');
    expect(gasCoreDepthVfx).toContain('opticalDepth');
    expect(gasCoreDepthVfx).not.toContain('texture(');
    expect(gasCoreDepthVfx).not.toContain('uTime');
    expect(gasCoreDepthVfx).not.toContain('gl_FragCoord');
    expect(gasCoreDepthVfx).not.toMatch(/\balpha\s*[+*]?=/);

    // E16 consumes only the exact Plasma core's already-live semantic and
    // emission-support evidence. It must not sample, animate, or alter topology,
    // and its owner/contact guards keep every control byte-identical.
    expect(energyStart).toBeGreaterThanOrEqual(0);
    expect(plasmaCoreVfxStart).toBeGreaterThanOrEqual(0);
    expect(plasmaCoreVfxBranchStart).toBeGreaterThan(plasmaCoreVfxStart);
    expect(plasmaCoreVfx).toContain('material == 20.0');
    expect(plasmaCoreVfx).toContain('surfaceOnly < 0.5');
    expect(plasmaCoreVfx).toContain('halo < 0.5');
    expect(plasmaCoreVfx).toContain('wall < 0.5');
    expect(plasmaCoreVfx).toContain('foreignMatterContact < 0.5');
    expect(plasmaCoreVfx).toContain('unlikeMaterialContact < 0.5');
    expect(plasmaCoreVfx).toContain('emissionState.a');
    expect(plasmaCoreVfx).toContain('cohesiveEnergy');
    expect(plasmaCoreVfx).toContain('plasmaMacroDepth');
    expect(plasmaCoreVfx).toContain('plasmaShellPocket');
    expect(plasmaCoreVfx).toContain('vec2(0.052, 0.031)');
    expect(plasmaCoreVfx).toContain('vec2(-0.028, 0.074)');
    expect(plasmaCoreVfx).not.toContain('texture(');
    expect(plasmaCoreVfx).not.toContain('uTime');
    expect(plasmaCoreVfx).not.toContain('gl_FragCoord');
    expect(plasmaCoreVfx).not.toMatch(/\balpha\s*[+*]?=/);
    expect(gasVfx).toContain('* max(-gasMotionTone, 0.0) * (gasMotionShadowBytes / 255.0)');
    expect(gasVfx).toContain('gasMotionSpeedBytes > 0.5');
    expect(gasVfx.indexOf('if (uGasMotionVfx > 0.5)'))
      .toBeLessThan(gasVfx.indexOf('vec2 gasMotionBytes ='));
    expect(gasVfx).toContain('), vec3(0.0), vec3(1.0));');
    expect(gasVfx).toContain('(vec3(1.12) - clamp(color, 0.0, 1.12))');
    expect(gasVfx).toContain('color -= clamp(color, 0.0, 1.0)');
    expect(gasVfx).not.toMatch(/sin\([^;\n]*uTime/);
    expect(gasVfx).not.toContain('texture(');
    expect(gasVfx).not.toContain('state.ba');
    expect(gasVfx).not.toMatch(/\balpha\s*[+*]?=/);

    // Liquid has an independent E03 selector but retains the pre-existing
    // species-safe connected-body guard. Its vertical Beer-Lambert core and
    // exposed Fresnel surface must remain RGB-only and sample-free.
    expect(liquid).toContain('dot(liquidSpeciesSlope, liquidSpeciesSlope) < 0.0025');
    expect(liquid).toContain('if (uLiquidBodyVfx > 0.5');
    expect(liquid).toContain('liquidFresnelContour');
    expect(liquid).toContain('liquidFresnelAbsorption');
    expect(liquidVfx).toContain('liquidOpticalDepth');
    expect(liquidVfx).toContain('color *= exp(');
    expect(liquidVfx).toContain('smoothstep(0.015, 0.16, topLip)');
    expect(liquidVfx).not.toContain('texture(');
    expect(liquidVfxStart).toBeGreaterThanOrEqual(0);
    expect(liquidVfxEnd).toBeGreaterThan(liquidVfxStart);
    expect(liquidVfx).not.toMatch(/\balpha\s*[+*]?=/);

    // E14 carries categorical cross-phase presence and a mixed-foreign
    // rejection bit out of occupancyShape's four existing
    // contact probes. Its selector-packed scale fallback is isolated to 1x
    // from the normal 2x/4x Hermite band and cannot widen semantic support.
    expect(normal).toContain('vec2 crossPhaseContact = vec2(0.0);');
    expect(normal).toContain('vec2 gridCell = floor(grid + vec2(0.001));');
    expect(normal).toContain('clamp(grid - gridCell, vec2(0.0), vec2(1.0))');
    expect(normal).toContain(
      'max(max(s00.z, s10.z), max(s01.z, s11.z)),',
    );
    expect(normal).toContain('s00.w * (1.0 - s00.z)');
    expect(normal).toContain('s10.w * (1.0 - s10.z)');
    expect(normal).toContain('s01.w * (1.0 - s01.z)');
    expect(normal).toContain('s11.w * (1.0 - s11.z)');
    expect(liquidSolidMeniscusVfxStart).toBeGreaterThan(liquidVfxStart);
    expect(liquidSolidMeniscusVfxBranchStart).toBeGreaterThan(liquidSolidMeniscusVfxStart);
    expect(liquidSolidMeniscusVfxEnd).toBeGreaterThan(liquidSolidMeniscusVfxBranchStart);
    expect(liquidSolidMeniscusVfx).toContain('material == 2.0');
    expect(liquidSolidMeniscusVfx).toContain('material == 8.0');
    expect(liquidSolidMeniscusVfx).toContain('material == 13.0');
    expect(liquidSolidMeniscusVfx).toContain('crossPhaseContact.x > 0.5');
    expect(liquidSolidMeniscusVfx).toContain('crossPhaseContact.y < 0.5');
    expect(liquidSolidMeniscusVfx).toContain('foreignMatterContact > 0.5');
    expect(liquidSolidMeniscusVfx).toContain('unlikeMaterialContact < 0.5');
    expect(liquidSolidMeniscusVfx).toContain('abs(phaseContactLight)');
    expect(liquidSolidMeniscusVfx).toContain('step(1.5, uLiquidSolidMeniscusVfx)');
    expect(liquidSolidMeniscusVfx).toContain('? phaseContactLight : -wetContactFallback');
    expect(source).toContain('value: liquidSolidMeniscusVfxEnabled ? outputScale : 0');
    expect(liquidSolidMeniscusVfx).toContain('liquidDepth > 0.30');
    expect(liquidSolidMeniscusVfx).toContain('wetContactKey');
    expect(liquidSolidMeniscusVfx).toContain('wetContactAbsorption');
    expect(liquidSolidMeniscusVfx).not.toContain('texture(');
    expect(liquidSolidMeniscusVfx).not.toContain('uTime');
    expect(liquidSolidMeniscusVfx).not.toContain('gl_FragCoord');
    expect(liquidSolidMeniscusVfx).not.toMatch(/\balpha\s*[+*]?=/);

    // Powder remains the temporally stable, dry Smooth-body-only path; Local,
    // Grains, moving powder, and suspension cannot gain an HDR body treatment.
    expect(powder).toContain('if (uVolumeVfx > 0.5');
    expect(powder).toContain('uPowderStyle > 1.5');
    expect(powder).toContain('powderBodyGate');
    expect(powder).toContain('powderSuspensionCohesion < 0.01');
    expect(powderVfxStart).toBeGreaterThanOrEqual(0);
    expect(powderVfxEnd).toBeGreaterThan(powderVfxStart);
    expect(powderVfx).not.toMatch(/\balpha\s*[+*]?=/);

    // E05 independently strengthens the already-proven stable body's signed
    // crown/pocket response while leaving the later grain cadence untouched.
    expect(powderBodyVfxStart).toBeGreaterThan(powderVfxEnd);
    expect(powderBodyVfxEnd).toBeGreaterThan(powderBodyVfxStart);
    expect(powderBodyVfx).toContain('powderBodyGate');
    expect(powderBodyVfx).toContain('powderDirectedSlope');
    expect(powderBodyVfx).toContain('powderBodyVolumeDepth');
    expect(powderBodyVfx).toContain('powderVfxPlaneA');
    expect(powderBodyVfx).toContain('powderVfxWorldFacet');
    expect(powderBodyVfx).toContain('powderVfxFacetBalance');
    expect(powderBodyVfx).toContain('powderVfxCrownResponse');
    expect(powderBodyVfx).toContain('powderVfxPocketResponse');
    expect(powderBodyVfx).toContain('powderSuspensionCohesion < 0.01');
    expect(powderBodyVfx).not.toContain('texture(');
    expect(powderBodyVfx).not.toContain('uTime');
    expect(powderBodyVfx).not.toContain('gl_FragCoord');
    expect(powderBodyVfx).not.toMatch(/\balpha\s*[+*]?=/);

    expect(powderLightCarrierStart).toBeGreaterThan(0);
    expect(powderLightCarrierStart).toBeLessThan(powderVfxStart);
    expect(powderLightCarrierEnd).toBeGreaterThan(powderLightCarrierStart);
    expect(powderLightCarrier).toContain('powderBodyGate');
    expect(powderLightCarrier).toContain('step(0.5, halo)');
    expect(powderLightCarrier).toContain('step(0.5, wall)');
    expect(powderLightCarrier).toContain('step(0.5, wallOnly)');
    expect(powderLightCarrier).toContain('step(0.5, emissionOnly)');
    expect(powderLightCarrier).toContain('step(0.01, powderSuspensionCohesion)');
    expect(powderLightCarrier).not.toContain('texture(');
    expect(powderLightCarrier).not.toMatch(/\balpha\s*[+*]?=/);

    // E06 recomposes the already-present centre emission contribution instead
    // of adding a powder sampler or touching any other phase. Its three live
    // scalars originate in the strict stable-body proof above.
    expect(powderLightVfxStart).toBeGreaterThan(powderBodyVfxEnd);
    expect(powderLightVfxEnd).toBeGreaterThan(powderLightVfxStart);
    expect(powderLightVfx).toContain('uPowderLightVfx > 0.5');
    expect(powderLightVfx).toContain('powderLightBodyGate > 0.001');
    expect(powderLightVfx).toContain('powderLightBodySlope');
    expect(powderLightVfx).toContain('powderLightBodyDepth');
    expect(powderLightVfx).toContain('mix(lightReach, sqrt(lightReach), 0.65)');
    expect(powderLightVfx).toContain('emissionState.rgb');
    expect(powderLightVfx).toContain('color / max(base, vec3(0.08))');
    expect(powderLightVfx).toContain('vec3(0.72), vec3(1.28)');
    expect(powderLightVfx).toContain('powderLightContribution = fieldLightContribution');
    expect(powderLightVfx).toContain('vividColor(emissionState.rgb, 1.10), vec3(0.0)');
    expect(powderLightVfx).not.toContain('texture(');
    expect(powderLightVfx).not.toContain('uTime');
    expect(powderLightVfx).not.toContain('gl_FragCoord');
    expect(powderLightVfx).not.toMatch(/\balpha\s*[+*]?=/);
    expect(normal.match(/texture\(\s*uEmissionTexture/g)).toHaveLength(7);

    // E09 decodes exact value 254 from the already-sampled presenter-owned
    // stability byte. The Canvas fallback retains ordinary settled value 255,
    // and the normal shader adds no contact sampler or output-scale branch.
    expect(normal).toContain('float powderSolidContactCell = 0.0;');
    expect(normal).toContain('abs(boundaryStability * 255.0 - 254.0)');
    expect(normal).toContain('boundaryStability + powderSolidContactCell * (1.0 / 255.0)');
    expect(normal).not.toContain('powderSolidContactLight');
    expect(source).toContain('const encodePowderSolidContact = this.outputScale < 8');
    expect(source).toContain(
      'Number(this.uniforms.uniforms.uPowderSolidContactVfx) > 0.5;',
    );
    expect(source).toContain('encodePowderSolidContact, walls,');
    const markWallDirtyStart = source.indexOf('  markWallDirty(index: number): void {');
    const markWallDirtyEnd = source.indexOf('\n  setContextLossHandler(', markWallDirtyStart);
    expect(markWallDirtyStart).toBeGreaterThan(0);
    expect(source.slice(markWallDirtyStart, markWallDirtyEnd)).toContain('this.chunks.markCell(index);');

    // E09 is a normal-detail, dry Smooth-body RGB occlusion. Its branch must
    // remain arithmetic-only over the carried contact/body scalars.
    expect(powderSolidContactVfxStart).toBeGreaterThan(powderLightVfxEnd);
    expect(powderSolidContactVfxBranchStart).toBeGreaterThan(powderSolidContactVfxStart);
    expect(powderSolidContactVfxEnd).toBeGreaterThan(powderSolidContactVfxBranchStart);
    expect(powderSolidContactVfx).toContain('uPowderSolidContactVfx > 0.5');
    expect(normal).toContain('float powderSolidContactBodyGate = 0.0;');
    expect(normal).toContain('powderSolidContactBodyGate = powderSolidContactCell');
    expect(normal).not.toContain('powderSolidContactBodyDepth');
    expect(powderSolidContactVfx).toContain('powderSolidContactBodyGate > 0.001');
    expect(powderSolidContactVfx).toContain('powderSolidPlaneA');
    expect(powderSolidContactVfx).toContain('powderSolidPlaneB');
    expect(powderSolidContactVfx).toContain('powderSolidDepth');
    expect(powderSolidContactVfx).toContain('5.0 / 255.0');
    expect(powderSolidContactVfx).not.toContain('texture(');
    expect(powderSolidContactVfx).not.toContain('uTime');
    expect(powderSolidContactVfx).not.toContain('gl_FragCoord');
    expect(powderSolidContactVfx).not.toMatch(/\b(?:alpha|support|sampler|resource|pass|target)\b/);

    // E10 remains exact-owner normal-WebGL arithmetic over the already-live
    // solid depth, body normal, Fresnel, and relief. Its band starts after the
    // protected first interior layer and fades before the deep core.
    expect(translucentEdgeVfxStart).toBeGreaterThan(0);
    expect(translucentEdgeVfxBranchStart).toBeGreaterThan(translucentEdgeVfxStart);
    expect(translucentEdgeVfxEnd).toBeGreaterThan(translucentEdgeVfxBranchStart);
    expect(translucentEdgeVfx).toContain('(material == 12.0 || material == 24.0)');
    expect(translucentEdgeVfx).toContain('solidOpticalDepth > 6.0 / 255.0');
    expect(translucentEdgeVfx).toContain('surfaceOnly < 0.5');
    expect(translucentEdgeVfx).toContain('wall < 0.5');
    expect(translucentEdgeVfx).toContain('18.0 / 255.0');
    expect(translucentEdgeVfx).toContain('66.0 / 255.0');
    expect(translucentEdgeVfx).toContain('solidKey');
    expect(translucentEdgeVfx).toContain('solidFresnel');
    expect(translucentEdgeVfx).not.toContain('texture(');
    expect(translucentEdgeVfx).not.toContain('uTime');
    expect(translucentEdgeVfx).not.toContain('gl_FragCoord');
    expect(translucentEdgeVfx).not.toMatch(/\b(?:alpha|support|sampler|resource|pass|target)\b/);

    // E11 is an exact WAX / state-proven hydrated-PLNT normal-WebGL layer.
    // It reuses the existing packed lifecycle state, solid depth, body normal,
    // Fresnel, and relief scalars while preserving topology and the compact 8x
    // shader's established register/resource contract.
    expect(organicSubsurfaceVfxStart).toBeGreaterThan(0);
    expect(organicSubsurfaceVfxBranchStart).toBeGreaterThan(organicSubsurfaceVfxStart);
    expect(organicSubsurfaceVfxEnd).toBeGreaterThan(organicSubsurfaceVfxBranchStart);
    expect(organicSubsurfaceVfx).toContain('(material == 27.0 || material == 10.0)');
    expect(organicSubsurfaceVfx).toContain('organicPlantPresent');
    expect(organicSubsurfaceVfx).toContain('abs(traits - 32.0) < 0.5');
    expect(organicSubsurfaceVfx).toContain('organicPlantHydration > 0.5');
    expect(organicSubsurfaceVfx).toContain('solidOpticalDepth > 6.0 / 255.0');
    expect(organicSubsurfaceVfx).toContain('18.0 / 255.0');
    expect(organicSubsurfaceVfx).toContain('72.0 / 255.0');
    expect(organicSubsurfaceVfx).toContain('organicSubsurfaceKey');
    expect(organicSubsurfaceVfx).toContain('organicSubsurfaceFresnel');
    expect(organicSubsurfaceVfx).toContain('(diffuse - 0.72) / 0.42');
    expect(organicSubsurfaceVfx).toContain('normal.z');
    expect(organicSubsurfaceVfx).not.toContain('texture(');
    expect(organicSubsurfaceVfx).not.toContain('uTime');
    expect(organicSubsurfaceVfx).not.toContain('gl_FragCoord');
    expect(organicSubsurfaceVfx).not.toMatch(
      /\b(?:alpha|support|sampler|resource|pass|target|outputScale)\b/,
    );

    // E12 is normal-WebGL arithmetic over the established suspension sample.
    // Exact Sand/Concrete/Clay RGB owners and exact semantic Water or matching
    // powder IDs are required. Powder reuses its live stability/bulk proof;
    // Water takes one guarded read from the existing settled-powder surface so
    // a moving powder phase cannot leave a styled stationary liquid phase.
    expect(wetSedimentVfxStart).toBeGreaterThan(0);
    expect(wetSedimentVfxBranchStart).toBeGreaterThan(wetSedimentVfxStart);
    expect(wetSedimentVfxEnd).toBeGreaterThan(wetSedimentVfxBranchStart);
    expect(wetSedimentVfx).toContain('vec3(215.0, 170.0, 104.0) / 255.0');
    expect(wetSedimentVfx).toContain('vec3(134.0, 131.0, 125.0) / 255.0');
    expect(wetSedimentVfx).toContain('vec3(184.0, 121.0, 85.0) / 255.0');
    expect(wetSedimentVfx).toContain('material == 1.0');
    expect(wetSedimentVfx).toContain('material == 26.0');
    expect(wetSedimentVfx).toContain('material == 28.0');
    expect(wetSedimentVfx).toContain('material == 2.0');
    expect(wetSedimentVfx).toContain('uPowderStyle > 1.5');
    expect(wetSedimentVfx).toContain('smoothstep(0.96, 1.0, boundaryStability)');
    expect(wetSedimentVfx).toContain('sedimentMotionStill');
    expect(wetSedimentVfx).toContain('smoothstep(0.42, 0.72, powderBulkDepth)');
    expect(wetSedimentVfx.match(/powderSurfaceShape\(fieldUv\)\.x/g)).toHaveLength(1);
    expect(wetSedimentVfx).toContain('sedimentPlaneA');
    expect(wetSedimentVfx).toContain('sedimentSheen');
    expect(wetSedimentVfx).not.toContain('texture(');
    expect(wetSedimentVfx).not.toContain('uTime');
    expect(wetSedimentVfx).not.toContain('gl_FragCoord');
    expect(wetSedimentVfx).not.toMatch(/\balpha\s*[+*]?=/);

    // Capability/initialization and first-render failures must turn every HDR
    // arithmetic family off before continuing with the single-pass scene.
    expect(source.match(/this\.uniforms\.uniforms\.uHDRVfx = 0;/g)).toHaveLength(2);
    expect(source.match(/this\.uniforms\.uniforms\.uVolumeVfx = 0;/g)).toHaveLength(2);
    expect(source.match(/this\.uniforms\.uniforms\.uGasBodyVfx = 0;/g)).toHaveLength(2);
    expect(source.match(/this\.uniforms\.uniforms\.uGasMotionVfx = 0;/g)).toHaveLength(2);
    expect(source.match(/this\.uniforms\.uniforms\.uGasLightVfx = 0;/g)).toHaveLength(2);
    expect(source.match(/this\.uniforms\.uniforms\.uGasCoreDepthVfx = 0;/g)).toHaveLength(2);
    expect(source.match(/this\.uniforms\.uniforms\.uSmokeSoftnessVfx = 0;/g)).toHaveLength(2);
    expect(source.match(/this\.uniforms\.uniforms\.uSmokeBillowDepthVfx = 0;/g)).toHaveLength(2);
    expect(source.match(/this\.uniforms\.uniforms\.uPlasmaCoreVfx = 0;/g)).toHaveLength(2);
    expect(source.match(/this\.uniforms\.uniforms\.uLiquidBodyVfx = 0;/g)).toHaveLength(2);
    expect(source.match(/this\.uniforms\.uniforms\.uLiquidSolidMeniscusVfx = 0;/g)).toHaveLength(2);
    expect(source.match(/this\.uniforms\.uniforms\.uPowderBodyVfx = 0;/g)).toHaveLength(2);
    expect(source.match(/this\.uniforms\.uniforms\.uPowderLightVfx = 0;/g)).toHaveLength(2);
    expect(source.match(/this\.uniforms\.uniforms\.uPowderSolidContactVfx = 0;/g)).toHaveLength(2);
    expect(source.match(/this\.uniforms\.uniforms\.uTranslucentEdgeVfx = 0;/g)).toHaveLength(2);
    expect(source.match(/this\.uniforms\.uniforms\.uOrganicSubsurfaceVfx = 0;/g)).toHaveLength(2);
    expect(source.match(/this\.uniforms\.uniforms\.uWetSedimentVfx = 0;/g)).toHaveLength(2);
    expect(source).toContain("get('volumeVfxAudit') === '1'");
    expect(source).toContain("get('gasBodyVfxAudit') === '1'");
    expect(source).toContain("get('gasMotionVfxAudit') === '1'");
    expect(source).toContain("get('gasLightVfxAudit') === '1'");
    expect(source).toContain("get('gasCoreDepthVfxAudit') === '1'");
    expect(source).toContain("get('smokeBillowDepthVfxAudit') === '1'");
    expect(source).toContain("get('plasmaCoreVfxAudit') === '1'");
    expect(source).toContain("get('liquidBodyVfxAudit') === '1'");
    expect(source).toContain("get('liquidSolidMeniscusVfxAudit') === '1'");
    expect(source).toContain("get('powderBodyVfxAudit') === '1'");
    expect(source).toContain("get('powderLightVfxAudit') === '1'");
    expect(source).toContain("get('powderSolidContactVfxAudit') === '1'");
    expect(source).toContain("get('translucentEdgeVfxAudit') === '1'");
    expect(source).toContain("get('organicSubsurfaceVfxAudit') === '1'");
    expect(source).toContain("get('wetSedimentVfxAudit') === '1'");
    expect(source).toContain('const gasBodyVfxEnabled = outputScale < 8');
    expect(source).toContain('const gasMotionVfxEnabled = outputScale < 8');
    expect(source).toMatch(
      /const gasLightVfxEnabled = outputScale < 8\s*&& resolveGasLightVfxEnabled\(renderLook\);/,
    );
    expect(source).toMatch(
      /const gasCoreDepthVfxEnabled = outputScale < 8\s*&& resolveGasCoreDepthVfxEnabled\(renderLook\);/,
    );
    expect(source).toMatch(
      /const plasmaCoreVfxEnabled = outputScale < 8\s*&& resolvePlasmaCoreVfxEnabled\(renderLook\);/,
    );
    expect(source).toContain('const liquidBodyVfxEnabled = outputScale < 8');
    expect(source).toMatch(
      /const liquidSolidMeniscusVfxEnabled = outputScale < 8\s*&& resolveLiquidSolidMeniscusVfxEnabled\(renderLook\);/,
    );
    expect(source).toContain('const powderBodyVfxEnabled = outputScale < 8');
    expect(source).toContain('const powderLightVfxEnabled = outputScale < 8');
    expect(source).toMatch(
      /const powderSolidContactVfxEnabled = outputScale < 8\s*&& resolvePowderSolidContactVfxEnabled\(renderLook\);/,
    );
    expect(source).toMatch(
      /const translucentEdgeVfxEnabled = outputScale < 8\s*&& resolveTranslucentEdgeVfxEnabled\(renderLook\);/,
    );
    expect(source).toMatch(
      /const organicSubsurfaceVfxEnabled = outputScale < 8\s*&& resolveOrganicSubsurfaceVfxEnabled\(renderLook\);/,
    );
    expect(source).toMatch(
      /const wetSedimentVfxEnabled = outputScale < 8\s*&& resolveWetSedimentVfxEnabled\(renderLook\);/,
    );
    expect(source).toContain('presenter.app.canvas.dataset.powderSolidContactVfx');
    expect(source).toContain("this.app.canvas.dataset.powderSolidContactVfx = 'inactive';");
    expect(source).toContain('presenter.app.canvas.dataset.translucentEdgeVfx');
    expect(source).toContain("this.app.canvas.dataset.translucentEdgeVfx = 'inactive';");
    expect(source).toContain('presenter.app.canvas.dataset.organicSubsurfaceVfx');
    expect(source).toContain("this.app.canvas.dataset.organicSubsurfaceVfx = 'inactive';");
    expect(source).toContain('presenter.app.canvas.dataset.wetSedimentVfx');
    expect(source).toContain("this.app.canvas.dataset.wetSedimentVfx = 'inactive';");
    expect(source).toContain('presenter.app.canvas.dataset.gasLightVfx');
    expect(source).toContain("this.app.canvas.dataset.gasLightVfx = 'inactive';");
    expect(source).toContain('presenter.app.canvas.dataset.gasCoreDepthVfx');
    expect(source).toContain("this.app.canvas.dataset.gasCoreDepthVfx = 'inactive';");
    expect(source).toContain('presenter.app.canvas.dataset.plasmaCoreVfx');
    expect(source).toContain("this.app.canvas.dataset.plasmaCoreVfx = 'inactive';");
    expect(source).toContain('presenter.app.canvas.dataset.liquidSolidMeniscusVfx');
    expect(source).toContain("this.app.canvas.dataset.liquidSolidMeniscusVfx = 'inactive';");
    const preserveDrawingBufferStart = source.indexOf('preserveDrawingBuffer:');
    const preserveDrawingBufferEnd = source.indexOf('resolution: outputScale', preserveDrawingBufferStart);
    const preserveDrawingBuffer = source.slice(preserveDrawingBufferStart, preserveDrawingBufferEnd);
    expect(preserveDrawingBufferStart).toBeGreaterThan(0);
    expect(preserveDrawingBufferEnd).toBeGreaterThan(preserveDrawingBufferStart);
    expect(preserveDrawingBuffer).toContain("get('powderSolidContactVfxAudit') === '1'");
    expect(preserveDrawingBuffer).toContain("get('translucentEdgeVfxAudit') === '1'");
    expect(preserveDrawingBuffer).toContain("get('organicSubsurfaceVfxAudit') === '1'");
    expect(preserveDrawingBuffer).toContain("get('wetSedimentVfxAudit') === '1'");
    expect(preserveDrawingBuffer).toContain("get('gasLightVfxAudit') === '1'");
    expect(preserveDrawingBuffer).toContain("get('gasCoreDepthVfxAudit') === '1'");
    expect(preserveDrawingBuffer).toContain("get('plasmaCoreVfxAudit') === '1'");
    expect(preserveDrawingBuffer).toContain("get('platinumBodyVfxAudit') === '1'");
    expect(preserveDrawingBuffer).toContain("get('liquidSolidMeniscusVfxAudit') === '1'");
  });

  it('keeps E17 opaque solid-body depth on bounded normal WebGL arithmetic', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const canvasSource = readFileSync(new URL('./field-renderer.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const normalEnd = source.indexOf('`;\n\n/** Primary WebGL presentation', normalStart);
    const eight = source.slice(eightStart, normalStart);
    const normal = source.slice(normalStart, normalEnd);
    const e17Start = normal.indexOf('    // E17:');
    const e17End = normal.indexOf('    // E18:', e17Start);
    const e17 = normal.slice(e17Start, e17End);

    expect(e17Start).toBeGreaterThanOrEqual(0);
    expect(e17End).toBeGreaterThan(e17Start);
    expect(normal).toContain('uniform float uSolidBodyVfx;');
    expect(eight).not.toContain('uSolidBodyVfx');
    expect(eight).not.toContain('solidBodyVfx');
    expect(canvasSource).not.toContain('solidBodyVfx');
    for (const owner of ['23.0', '78.0']) {
      expect(e17).toContain(`material == ${owner}`);
    }
    for (const unmeasuredOwner of ['22.0', '25.0', '67.0', '70.0', '73.0', '75.0', '82.0']) {
      expect(e17).not.toContain(`material == ${unmeasuredOwner}`);
    }
    expect(e17).toContain('optics == 8.0');
    expect(e17).toContain('surfaceOnly < 0.5');
    expect(e17).toContain('halo < 0.5');
    expect(e17).toContain('wall < 0.5');
    expect(e17).toContain('foreignMatterContact < 0.5');
    expect(e17).toContain('unlikeMaterialContact < 0.5');
    expect(e17).toContain('solidOpticalDepth > 6.0 / 255.0');
    expect(e17).toContain('solidReliefTone');
    expect(e17).toContain('solidKey');
    expect(e17).toContain('solidFill');
    expect(e17).toContain('solidFresnel');
    expect(e17).not.toContain('texture(');
    expect(e17).not.toContain('uTime');
    expect(e17).not.toContain('gl_FragCoord');
    expect(e17).not.toMatch(/\balpha\s*[+*]?=/);
    expect(source.match(/this\.uniforms\.uniforms\.uSolidBodyVfx = 0;/g)).toHaveLength(2);
    expect(source).toContain("get('solidBodyVfxAudit') === '1'");
    expect(source).toMatch(
      /const solidBodyVfxEnabled = outputScale < 8\s*&& resolveSolidBodyVfxEnabled\(renderLook\);/,
    );
    expect(source).toContain('presenter.app.canvas.dataset.solidBodyVfx');
    expect(source).toContain("this.app.canvas.dataset.solidBodyVfx = 'inactive';");
  });

  it('keeps E37 exact Metal/Water contact polish parented, compact, and RGB-only', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const canvasSource = readFileSync(new URL('./field-renderer.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const normalEnd = source.indexOf('`;\n\n/** Primary WebGL presentation', normalStart);
    const eight = source.slice(eightStart, normalStart);
    const normal = source.slice(normalStart, normalEnd);
    const e37Start = normal.indexOf('  // E37:');
    const e37End = normal.indexOf('  // Geological owners', e37Start);
    const e37 = normal.slice(e37Start, e37End);

    expect(e37Start).toBeGreaterThanOrEqual(0);
    expect(e37End).toBeGreaterThan(e37Start);
    expect(normal).toContain('uniform float uMetalWaterContactVfx;');
    expect(eight).not.toContain('uMetalWaterContactVfx');
    expect(eight).not.toContain('metalWaterContactVfx');
    expect(canvasSource).not.toContain('metalWaterContactVfx');
    expect(normal).toContain('abs(candidate - 2.0) < 0.5 ? 1.0 : 0.0');
    expect(normal).toContain('float packedForeignMatter = foreignMatter + exactWaterCandidate;');
    expect(normal.match(/contactSample\(/g)).toHaveLength(5);
    expect(e37).toContain('uMetalWaterContactVfx > 0.5');
    expect(e37).toContain('uSolidBodyVfx > 0.5');
    expect(e37).toContain('uLiquidSolidMeniscusVfx > 0.5');
    expect(e37).toContain('phaseContactOwner > 0.5');
    expect(e37).toContain('material == 23.0');
    expect(e37).toContain('foreignMatterContact > 1.5');
    expect(e37).toContain('crossPhaseContact.x > 0.5');
    expect(e37).toContain('crossPhaseContact.y < 0.5');
    expect(e37).toContain('unlikeMaterialContact < 0.5');
    expect(e37).toContain('liquidState.a > 0.25');
    expect(e37).toContain('vec3(92.0, 185.0, 200.0) / 255.0');
    expect(e37).toContain('1.0 - step(1.5, uMetalWaterContactVfx)');
    expect(e37).toContain('* (2.0 / 255.0)');
    expect(e37).toContain('max(phaseContactTone, 0.0)');
    expect(e37).toContain('max(-phaseContactTone, 0.0)');
    expect(e37).not.toContain('contactSample(');
    expect(e37).not.toContain('texture(');
    expect(e37).not.toContain('uTime');
    expect(e37).not.toContain('gl_FragCoord');
    expect(e37).not.toMatch(/\b(?:float|vec[234])\s+[A-Za-z_]/);
    expect(e37).not.toMatch(/\b(?:alpha|support)\s*[+*]?=/);
    expect(source).toContain('value: metalWaterContactVfxEnabled ? outputScale : 0');
    expect(source.match(/this\.uniforms\.uniforms\.uMetalWaterContactVfx = 0;/g)).toHaveLength(2);
    expect(source).toContain('presenter.app.canvas.dataset.metalWaterContactVfx');
    expect(source).toContain("this.app.canvas.dataset.metalWaterContactVfx = 'inactive';");
    expect(source).toContain("get('metalWaterContactVfxAudit') === '1'");
    expect(source).toMatch(
      /const metalWaterContactVfxEnabled = outputScale < 8\s*&& resolveMetalWaterContactVfxEnabled\(renderLook\);/,
    );
  });

  it('keeps E18 Platinum body optics exact-owner and normal-WebGL-only', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const canvasSource = readFileSync(new URL('./field-renderer.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const normalEnd = source.indexOf('`;\n\n/** Primary WebGL presentation', normalStart);
    const eight = source.slice(eightStart, normalStart);
    const normal = source.slice(normalStart, normalEnd);
    const e18Start = normal.indexOf('    // E18:');
    const e18End = normal.indexOf('    // E19:', e18Start);
    const e18 = normal.slice(e18Start, e18End);

    expect(e18Start).toBeGreaterThanOrEqual(0);
    expect(e18End).toBeGreaterThan(e18Start);
    expect(normal).toContain('uniform float uPlatinumBodyVfx;');
    expect(eight).not.toContain('uPlatinumBodyVfx');
    expect(eight).not.toContain('platinumBodyVfx');
    expect(canvasSource).not.toContain('platinumBodyVfx');
    expect(e18).toContain('material == 75.0');
    for (const protectedOwner of ['22.0', '23.0', '25.0', '67.0', '70.0', '73.0', '78.0', '82.0']) {
      expect(e18).not.toContain(`material == ${protectedOwner}`);
    }
    expect(e18).toContain('profile == 2.0');
    expect(e18).toContain('optics == 8.0');
    expect(e18).toContain('surfaceOnly < 0.5');
    expect(e18).toContain('halo < 0.5');
    expect(e18).toContain('wall < 0.5');
    expect(e18).toContain('foreignMatterContact < 0.5');
    expect(e18).toContain('unlikeMaterialContact < 0.5');
    expect(e18).toContain('solidOpticalDepth > 6.0 / 255.0');
    expect(e18).toContain('solidReliefTone');
    expect(e18).toContain('solidKey');
    expect(e18).toContain('solidFill');
    expect(e18).toContain('solidFresnel');
    expect(e18).toContain('solidEnvironment');
    expect(e18).not.toContain('texture(');
    expect(e18).not.toContain('uTime');
    expect(e18).not.toContain('gl_FragCoord');
    expect(e18).not.toMatch(/\balpha\s*[+*]?=/);
    expect(source.match(/this\.uniforms\.uniforms\.uPlatinumBodyVfx = 0;/g)).toHaveLength(2);
    expect(source).toContain("get('platinumBodyVfxAudit') === '1'");
    expect(source).toMatch(
      /const platinumBodyVfxEnabled = outputScale < 8\s*&& resolvePlatinumBodyVfxEnabled\(renderLook\);/,
    );
    expect(source).toContain('presenter.app.canvas.dataset.platinumBodyVfx');
    expect(source).toContain("this.app.canvas.dataset.platinumBodyVfx = 'inactive';");
  });

  it('keeps E19 Ceramic glaze exact-owner, normal-WebGL-only, and RGB-only', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const canvasSource = readFileSync(new URL('./field-renderer.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const normalEnd = source.indexOf('`;\n\n/** Primary WebGL presentation', normalStart);
    const eight = source.slice(eightStart, normalStart);
    const normal = source.slice(normalStart, normalEnd);
    const e19Start = normal.indexOf('    // E19:');
    const e19End = normal.indexOf('  }\n  if (uEnergyIdentityStyling', e19Start);
    const e19 = normal.slice(e19Start, e19End);
    const preserveDrawingBufferStart = source.indexOf('preserveDrawingBuffer:');
    const preserveDrawingBufferEnd = source.indexOf('resolution: outputScale', preserveDrawingBufferStart);
    const preserveDrawingBuffer = source.slice(preserveDrawingBufferStart, preserveDrawingBufferEnd);

    expect(e19Start).toBeGreaterThanOrEqual(0);
    expect(e19End).toBeGreaterThan(e19Start);
    expect(normal).toContain('uniform float uCeramicGlazeVfx;');
    expect(eight).not.toContain('uCeramicGlazeVfx');
    expect(eight).not.toContain('ceramicGlazeVfx');
    expect(canvasSource).not.toContain('ceramicGlazeVfx');
    expect(e19).toContain('material == 25.0');
    for (const protectedOwner of ['22.0', '23.0', '67.0', '70.0', '73.0', '75.0', '78.0', '82.0']) {
      expect(e19).not.toContain(`material == ${protectedOwner}`);
    }
    expect(e19).toContain('family == 0.0');
    expect(e19).toContain('profile == 2.0');
    expect(e19).toContain('optics == 8.0');
    expect(e19).toContain('!materialEmissive');
    expect(e19).toContain('traits < 0.5');
    expect(e19).toContain('surfaceOnly < 0.5');
    expect(e19).toContain('halo < 0.5');
    expect(e19).toContain('wall < 0.5');
    expect(e19).toContain('wallOnly < 0.5');
    expect(e19).toContain('emissionOnly < 0.5');
    expect(e19).toContain('granularSurface < 0.5');
    expect(e19).toContain('translucentSurface < 0.5');
    expect(e19).toContain('foreignMatterContact < 0.5');
    expect(e19).toContain('unlikeMaterialContact < 0.5');
    expect(e19).toContain('solidInterior > 0.001');
    expect(e19).toContain('solidOpticalDepth > 6.0 / 255.0');
    for (const optic of ['solidReliefTone', 'solidKey', 'solidFill', 'solidFresnel', 'solidEnvironment']) {
      expect(e19).toContain(optic);
    }
    expect(e19).not.toContain('texture(');
    expect(e19).not.toContain('fieldPosition');
    expect(e19).not.toContain('uTime');
    expect(e19).not.toContain('gl_FragCoord');
    expect(e19).not.toMatch(/\balpha\b/);
    expect(e19).not.toMatch(/\b(?:alpha|support|finalColor|semantic|material|profile|optics|wall)\s*(?:\+=|\*=|=(?!=))/);
    expect(source.match(/this\.uniforms\.uniforms\.uCeramicGlazeVfx = 0;/g)).toHaveLength(2);
    expect(source).toContain("get('ceramicGlazeVfxAudit') === '1'");
    expect(preserveDrawingBuffer).toContain("get('ceramicGlazeVfxAudit') === '1'");
    expect(source).toMatch(
      /const ceramicGlazeVfxEnabled = outputScale < 8\s*&& resolveCeramicGlazeVfxEnabled\(renderLook\);/,
    );
    expect(source).toContain('presenter.app.canvas.dataset.ceramicGlazeVfx');
    expect(source).toContain("this.app.canvas.dataset.ceramicGlazeVfx = 'inactive';");
  });

  it('keeps E20 botanical body recomposition exact-owner, normal-WebGL-only, and RGB-only', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const canvasSource = readFileSync(new URL('./field-renderer.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const normalEnd = source.indexOf('`;\n\n/** Primary WebGL presentation', normalStart);
    const eight = source.slice(eightStart, normalStart);
    const normal = source.slice(normalStart, normalEnd);
    const eligibilityStart = normal.indexOf('bool botanicalBodyOwner');
    const eligibilityEnd = normal.indexOf(' ? 1.0 : 0.0;', eligibilityStart) + ' ? 1.0 : 0.0;'.length;
    const eligibility = normal.slice(eligibilityStart, eligibilityEnd);
    const e20Start = normal.indexOf('      // E20:');
    const e20End = normal.indexOf('    } else if (radioactiveSurface', e20Start);
    const e20 = normal.slice(e20Start, e20End);
    const botanicalIdentityStart = normal.indexOf('    float botanicalIdentity =');
    const botanicalIdentityEnd = normal.indexOf(
      '    if (uBotanicalLifecycleStyling > 0.5', botanicalIdentityStart,
    );
    const botanicalIdentity = normal.slice(botanicalIdentityStart, botanicalIdentityEnd);
    const preserveDrawingBufferStart = source.indexOf('preserveDrawingBuffer:');
    const preserveDrawingBufferEnd = source.indexOf('resolution: outputScale', preserveDrawingBufferStart);
    const preserveDrawingBuffer = source.slice(preserveDrawingBufferStart, preserveDrawingBufferEnd);

    expect(eligibilityStart).toBeGreaterThanOrEqual(0);
    expect(eligibilityEnd).toBeGreaterThan(eligibilityStart);
    expect(e20Start).toBeGreaterThanOrEqual(0);
    expect(e20End).toBeGreaterThan(e20Start);
    expect(normal).toContain('uniform float uBotanicalBodyVfx;');
    expect(normal.match(/uBotanicalBodyVfx > 0\.5/g)).toHaveLength(1);
    expect(eight).not.toContain('uBotanicalBodyVfx');
    expect(eight).not.toContain('botanicalBodyVfx');
    expect(eight).not.toContain('botanicalBodyNoise');
    expect(canvasSource).not.toContain('botanicalBodyVfx');
    expect(eligibility).toContain('material == 9.0');
    expect(eligibility).toContain('material == 10.0');
    expect(eligibility).toContain('abs(traits - 96.0) < 0.5');
    expect(eligibility).toContain('abs(traits - 32.0) < 0.5');
    for (const guard of [
      'uSolidOpticalDepth > 0.5', 'solidOpticalDepth > 6.0 / 255.0',
      'solidInterior > 0.001', 'surfaceOnly < 0.5', 'halo < 0.5',
      'wall < 0.5', 'wallOnly < 0.5', 'emissionOnly < 0.5',
      '!materialEmissive', 'foreignMatterContact < 0.5', 'unlikeMaterialContact < 0.5',
    ]) expect(eligibility).toContain(guard);
    for (const existingValue of [
      'solidOpticalDepth', 'solidInterior', 'solidReliefTone', 'solidFresnel', 'solidEnvironment',
    ]) expect(e20).toContain(existingValue);
    // Every superseded carrier must retain its previous path for protected
    // walls, contacts, traits, emission, sparse stems, and selector-off frames.
    expect(normal).toMatch(
      /solidInterior > 0\.001 && surfaceOnly < 0\.5\s*&& botanicalBodyReplacement < 0\.5\) \{/,
    );
    expect(normal).toContain(
      'if (botanicalBodyReplacement < 0.5 && uSolidOpticalDepth > 0.5 && material == 10.0',
    );
    expect(normal).toMatch(
      /if \(material == 9\.0 && uSolidOpticalDepth > 0\.5[\s\S]*?surfaceOnly < 0\.5 && botanicalBodyReplacement < 0\.5\) \{/,
    );
    expect(normal).toContain('&& (material == 83.0 || botanicalBodyReplacement < 0.5)');
    expect(normal).toContain('if (botanicalBodyReplacement > 0.5) {\n        // E20 owns the deep exact body below.');
    expect(botanicalIdentity).toContain('if (botanicalBodyReplacement > 0.5) {');
    expect(botanicalIdentity).toContain('if (material == 9.0 && botanicalBodyReplacement > 0.5)');
    expect(botanicalIdentity).toContain(
      'material, fieldPosition, canopyFineIdentityGain, botanicalBodyReplacement',
    );
    expect(botanicalIdentity).not.toContain('uBotanicalBodyVfx > 0.5');
    expect(botanicalIdentity).not.toContain('foreignMatterContact < 0.5');
    expect(botanicalIdentity).not.toContain('unlikeMaterialContact < 0.5');
    expect(e20).toContain('botanicalBodyNoise');
    expect(e20).not.toContain('texture(');
    expect(e20).not.toContain('uTime');
    expect(e20).not.toContain('gl_FragCoord');
    expect(e20).not.toMatch(/\balpha\s*[+*]?=/);
    expect(source.match(/this\.uniforms\.uniforms\.uBotanicalBodyVfx = 0;/g)).toHaveLength(2);
    expect(source).toContain("get('botanicalBodyVfxAudit') === '1'");
    expect(preserveDrawingBuffer).toContain("get('botanicalBodyVfxAudit') === '1'");
    expect(source).toMatch(
      /const botanicalBodyVfxEnabled = outputScale < 8\s*&& resolveBotanicalBodyVfxEnabled\(renderLook\);/,
    );
    expect(source).toContain('presenter.app.canvas.dataset.botanicalBodyVfx');
    expect(source).toContain("this.app.canvas.dataset.botanicalBodyVfx = 'inactive';");
  });

  it('keeps E26 botanical mesostructure subordinate to E20 and resource-neutral', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const canvasSource = readFileSync(new URL('./field-renderer.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const normalEnd = source.indexOf('`;\n\n/** Primary WebGL presentation', normalStart);
    const eight = source.slice(eightStart, normalStart);
    const normal = source.slice(normalStart, normalEnd);
    const e20Start = normal.indexOf('      // E20:');
    const e20End = normal.indexOf('    } else if (radioactiveSurface', e20Start);
    const e20 = normal.slice(e20Start, e20End);
    const e26Start = e20.indexOf('        // E26');
    const preserveDrawingBufferStart = source.indexOf('preserveDrawingBuffer:');
    const preserveDrawingBufferEnd = source.indexOf(
      'resolution: outputScale', preserveDrawingBufferStart,
    );
    const preserveDrawingBuffer = source.slice(
      preserveDrawingBufferStart, preserveDrawingBufferEnd,
    );

    expect(e20Start).toBeGreaterThanOrEqual(0);
    expect(e20End).toBeGreaterThan(e20Start);
    expect(e26Start).toBeGreaterThanOrEqual(0);
    expect(normal).toContain('uniform float uBotanicalMesostructureVfx;');
    // E26 owns its body gate and both exact children repeat the same predicate
    // so an inconsistent child uniform cannot bypass its parent in GLSL.
    expect(normal.match(/uBotanicalMesostructureVfx > 0\.5/g)).toHaveLength(4);
    expect(eight).not.toContain('uBotanicalMesostructureVfx');
    expect(eight).not.toContain('botanicalMesostructureVfx');
    expect(canvasSource).not.toContain('botanicalMesostructureVfx');
    expect(e20.indexOf('if (botanicalBodyReplacement > 0.5)')).toBeLessThan(e26Start);
    expect(e20).toContain(
      'float botanicalMesostructure = uBotanicalMesostructureVfx > 0.5\n          ? botanicalDepth : 0.0;',
    );
    for (const establishedValue of [
      'botanicalDepth', 'botanicalMacro', 'botanicalCluster',
      'leafBoundary', 'barkBody', 'barkKnot',
    ]) expect(e20.slice(e26Start)).toContain(establishedValue);
    expect(e20.match(/botanicalBodyNoise\(/g)).toHaveLength(4);
    expect(e20).not.toContain('texture(');
    expect(e20).not.toContain('uTime');
    expect(e20).not.toContain('gl_FragCoord');
    expect(e20).not.toMatch(/\balpha\s*[+*]?=/);
    expect(source.match(/this\.uniforms\.uniforms\.uBotanicalMesostructureVfx = 0;/g))
      .toHaveLength(2);
    expect(source).toMatch(
      /const botanicalMesostructureVfxEnabled = outputScale < 8\s*&& resolveBotanicalMesostructureVfxEnabled\(renderLook\);/,
    );
    expect(source).toContain(
      'uBotanicalMesostructureVfx: {\n        value: botanicalMesostructureVfxEnabled ? 1 : 0',
    );
    expect(source).toContain("get('botanicalMesostructureVfxAudit') === '1'");
    expect(preserveDrawingBuffer).toContain(
      "get('botanicalMesostructureVfxAudit') === '1'",
    );
    expect(source).toContain('presenter.app.canvas.dataset.botanicalMesostructureVfx');
    expect(source).toContain(
      "this.app.canvas.dataset.botanicalMesostructureVfx = 'inactive';",
    );
  });

  it('keeps E28 botanical pigment subordinate to E26, exact-owner, and RGB-only', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const canvasSource = readFileSync(new URL('./field-renderer.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const normalEnd = source.indexOf('`;\n\n/** Primary WebGL presentation', normalStart);
    const eight = source.slice(eightStart, normalStart);
    const normal = source.slice(normalStart, normalEnd);
    const e20Start = normal.indexOf('      // E20:');
    const e20End = normal.indexOf('    } else if (radioactiveSurface', e20Start);
    const e20 = normal.slice(e20Start, e20End);
    const pigmentGate = e20.indexOf('        float botanicalPigment =');
    const plantFinish = e20.indexOf('          // E28:');
    const woodFinish = e20.indexOf('          // E28 keeps');
    const preserveDrawingBufferStart = source.indexOf('preserveDrawingBuffer:');
    const preserveDrawingBufferEnd = source.indexOf(
      'resolution: outputScale', preserveDrawingBufferStart,
    );
    const preserveDrawingBuffer = source.slice(
      preserveDrawingBufferStart, preserveDrawingBufferEnd,
    );

    expect(e20Start).toBeGreaterThanOrEqual(0);
    expect(e20End).toBeGreaterThan(e20Start);
    expect(pigmentGate).toBeGreaterThan(e20.indexOf('if (botanicalBodyReplacement > 0.5)'));
    expect(plantFinish).toBeGreaterThan(pigmentGate);
    expect(woodFinish).toBeGreaterThan(plantFinish);
    expect(normal).toContain('uniform float uBotanicalPigmentVfx;');
    expect(normal.match(/uBotanicalPigmentVfx > 0\.5/g)).toHaveLength(2);
    expect(eight).not.toContain('uBotanicalPigmentVfx');
    expect(eight).not.toContain('botanicalPigmentVfx');
    expect(canvasSource).not.toContain('botanicalPigmentVfx');
    expect(e20).toContain(
      'float botanicalPigment = uBotanicalMesostructureVfx > 0.5\n'
        + '            && uBotanicalPigmentVfx > 0.5\n'
        + '          ? botanicalDepth : 0.0;',
    );
    for (const establishedValue of [
      'botanicalDepth', 'botanicalMacro', 'botanicalCluster',
      'leafPigment', 'barkPlate', 'botanicalPigment',
    ]) expect(e20.slice(pigmentGate)).toContain(establishedValue);
    expect(e20).toContain('leafVein * 0.075');
    expect(e20).toContain('leafPigmentBody * 0.068 * botanicalPigment');
    expect(e20).toContain('vec3(-0.052, 0.022, -0.060) * leafPigmentBody');
    expect(e20).toContain('barkPigmentBody * 0.026 * botanicalPigment');
    expect(e20).toContain('vec3(0.085, -0.017, -0.052) * barkPigmentBody');
    expect(e20.match(/botanicalBodyNoise\(/g)).toHaveLength(4);
    expect(e20).not.toContain('texture(');
    expect(e20).not.toContain('uTime');
    expect(e20).not.toContain('gl_FragCoord');
    expect(e20).not.toMatch(/\balpha\s*[+*]?=/);
    expect(source.match(/this\.uniforms\.uniforms\.uBotanicalPigmentVfx = 0;/g))
      .toHaveLength(2);
    expect(source).toMatch(
      /const botanicalPigmentVfxEnabled = outputScale < 8\s*&& resolveBotanicalPigmentVfxEnabled\(renderLook\);/,
    );
    expect(source).toContain(
      'uBotanicalPigmentVfx: { value: botanicalPigmentVfxEnabled ? 1 : 0',
    );
    expect(preserveDrawingBuffer).toContain("get('botanicalPigmentVfxAudit') === '1'");
    expect(source).toContain('presenter.app.canvas.dataset.botanicalPigmentVfx');
    expect(source).toContain("this.app.canvas.dataset.botanicalPigmentVfx = 'inactive';");
  });

  it('keeps E32 PLNT lamina exact-owner/state, E28-dependent, normal-WebGL-only, and RGB-only', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const canvasSource = readFileSync(new URL('./field-renderer.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const normalEnd = source.indexOf('`;\n\n/** Primary WebGL presentation', normalStart);
    const eight = source.slice(eightStart, normalStart);
    const normal = source.slice(normalStart, normalEnd);
    const e32Start = normal.indexOf('          // E32: exact PLNT');
    const e32End = normal.indexOf('        } else {', e32Start);
    const e32 = normal.slice(e32Start, e32End);
    const preserveDrawingBufferStart = source.indexOf('preserveDrawingBuffer:');
    const preserveDrawingBufferEnd = source.indexOf(
      'resolution: outputScale', preserveDrawingBufferStart,
    );
    const preserveDrawingBuffer = source.slice(
      preserveDrawingBufferStart, preserveDrawingBufferEnd,
    );

    expect(e32Start).toBeGreaterThanOrEqual(0);
    expect(e32End).toBeGreaterThan(e32Start);
    expect(normal).toContain('uniform float uPlantLaminaVfx;');
    expect(normal.match(/uPlantLaminaVfx > 0\.5/g)).toHaveLength(1);
    expect(eight).not.toContain('uPlantLaminaVfx');
    expect(eight).not.toContain('plantLaminaVfx');
    expect(canvasSource).not.toContain('plantLaminaVfx');
    for (const guard of [
      'material == 10.0', 'botanicalBodyReplacement > 0.5',
      'uBotanicalMesostructureVfx > 0.5', 'uBotanicalPigmentVfx > 0.5',
      'uPlantLaminaVfx > 0.5', 'wallState.b', 'wallState.a', '32768.0',
    ]) expect(e32).toContain(guard);
    for (const establishedValue of [
      'botanicalDepth', 'leafPigmentBody', 'leafBody', 'leafVein', 'leafBoundary',
    ]) expect(e32).toContain(establishedValue);
    expect(e32).toContain('fieldPosition / 2.8');
    expect(e32.match(/botanicalBodyNoise\(/g)).toHaveLength(1);
    expect(e32).toContain('if (plantLamina > 0.001)');
    expect(e32).not.toContain('sin(');
    expect(e32).not.toContain('texture(');
    expect(e32).not.toContain('uTime');
    expect(e32).not.toContain('gl_FragCoord');
    expect(e32).not.toMatch(/\balpha\s*[+*]?=/);
    expect(source.match(/this\.uniforms\.uniforms\.uPlantLaminaVfx = 0;/g))
      .toHaveLength(2);
    expect(source).toMatch(
      /const plantLaminaVfxEnabled = outputScale < 8\s*&& resolvePlantLaminaVfxEnabled\(renderLook\);/,
    );
    expect(source).toContain(
      'uPlantLaminaVfx: { value: plantLaminaVfxEnabled ? 1 : 0',
    );
    expect(preserveDrawingBuffer).toContain("get('plantLaminaVfxAudit') === '1'");
    expect(source).toContain('presenter.app.canvas.dataset.plantLaminaVfx');
    expect(source).toContain("this.app.canvas.dataset.plantLaminaVfx = 'inactive';");
  });

  it('keeps E34 PLNT lobe depth subordinate to E32, normal-WebGL-only, and resource-neutral', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const canvasSource = readFileSync(new URL('./field-renderer.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const normalEnd = source.indexOf('`;\n\n/** Primary WebGL presentation', normalStart);
    const eight = source.slice(eightStart, normalStart);
    const normal = source.slice(normalStart, normalEnd);
    const e34Start = normal.indexOf("          // E34: E32's fine carrier");
    const e34End = normal.indexOf('        } else {', e34Start);
    const e34 = normal.slice(e34Start, e34End);
    const preserveDrawingBufferStart = source.indexOf('preserveDrawingBuffer:');
    const preserveDrawingBufferEnd = source.indexOf(
      'resolution: outputScale', preserveDrawingBufferStart,
    );
    const preserveDrawingBuffer = source.slice(
      preserveDrawingBufferStart, preserveDrawingBufferEnd,
    );

    expect(e34Start).toBeGreaterThanOrEqual(0);
    expect(e34End).toBeGreaterThan(e34Start);
    expect(normal).toContain('uniform float uPlantLobeDepthVfx;');
    expect(normal.match(/uPlantLobeDepthVfx > 0\.5/g)).toHaveLength(1);
    expect(eight).not.toContain('uPlantLobeDepthVfx');
    expect(eight).not.toContain('plantLobeDepthVfx');
    expect(canvasSource).not.toContain('plantLobeDepthVfx');
    expect(normal).toContain(
      'float plantLobeDepth = plantLamina > 0.001\n'
        + '              && uPlantLobeDepthVfx > 0.5\n'
        + '            ? botanicalDepth : 0.0;',
    );
    for (const establishedValue of [
      'leafLaminaBody', 'leafBoundary', 'leafLaminaSegment',
      'plantLobeDepth', 'solidEnvironment',
    ]) expect(e34).toContain(establishedValue);
    expect(e34).toContain('leafLobePocket * 0.92 + leafLobeVein * 0.52');
    expect(e34).toContain('leafLobeCrown * 0.145');
    expect(e34).not.toContain('botanicalBodyNoise(');
    expect(e34).not.toContain('sin(');
    expect(e34).not.toContain('texture(');
    expect(e34).not.toContain('uTime');
    expect(e34).not.toContain('gl_FragCoord');
    expect(e34).not.toMatch(/\balpha\s*[+*]?=/);
    expect(source.match(/this\.uniforms\.uniforms\.uPlantLobeDepthVfx = 0;/g))
      .toHaveLength(2);
    expect(source).toMatch(
      /const plantLobeDepthVfxEnabled = outputScale < 8\s*&& resolvePlantLobeDepthVfxEnabled\(renderLook\);/,
    );
    expect(source).toContain(
      'uPlantLobeDepthVfx: { value: plantLobeDepthVfxEnabled ? 1 : 0',
    );
    expect(preserveDrawingBuffer).toContain("get('plantLobeDepthVfxAudit') === '1'");
    expect(source).toContain('presenter.app.canvas.dataset.plantLobeDepthVfx');
    expect(source).toContain("this.app.canvas.dataset.plantLobeDepthVfx = 'inactive';");
  });

  it('keeps E36 PLNT canopy masses E34-dependent, exact-state, and resource-neutral', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const canvasSource = readFileSync(new URL('./field-renderer.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const normalEnd = source.indexOf('`;\n\n/** Primary WebGL presentation', normalStart);
    const eight = source.slice(eightStart, normalStart);
    const normal = source.slice(normalStart, normalEnd);
    const proofStart = normal.indexOf("          // Resolve E36's exact zero-state PLNT proof");
    const proofEnd = normal.indexOf('          color *= 1.0 - (leafPigmentPocket', proofStart);
    const finishStart = normal.indexOf('          // E36 is a strict E34 child', proofEnd);
    const finishEnd = normal.indexOf('        } else {', finishStart);
    const e36 = normal.slice(proofStart, proofEnd) + normal.slice(finishStart, finishEnd);
    const preserveDrawingBufferStart = source.indexOf('preserveDrawingBuffer:');
    const preserveDrawingBufferEnd = source.indexOf(
      'resolution: outputScale', preserveDrawingBufferStart,
    );
    const preserveDrawingBuffer = source.slice(
      preserveDrawingBufferStart, preserveDrawingBufferEnd,
    );

    expect(proofStart).toBeGreaterThanOrEqual(0);
    expect(proofEnd).toBeGreaterThan(proofStart);
    expect(finishStart).toBeGreaterThan(proofEnd);
    expect(finishEnd).toBeGreaterThan(finishStart);
    expect(normal).toContain('uniform float uPlantCanopyMassVfx;');
    expect(normal.match(/uPlantCanopyMassVfx > 0\.5/g)).toHaveLength(1);
    expect(eight).not.toContain('uPlantCanopyMassVfx');
    expect(eight).not.toContain('plantCanopyMassVfx');
    expect(canvasSource).not.toContain('plantCanopyMassVfx');
    for (const proof of [
      'botanicalBodyReplacement > 0.5', 'uPlantCanopyMassVfx > 0.5',
      'wallState.b', 'wallState.a', '32768.0', 'botanicalDepth',
    ]) expect(e36).toContain(proof);
    for (const establishedValue of [
      'botanicalMacro', 'leafBody', 'botanicalExistingRelief', 'leafBoundary',
      'leafLaminaCarrier', 'leafLobeVein', 'solidEnvironment',
    ]) expect(e36).toContain(establishedValue);
    expect(e36).toContain('leafVeinGain = 0.0');
    expect(e36).toContain('leafLaminaRibGain = 0.0');
    expect(e36).not.toContain('botanicalBodyNoise(');
    expect(e36).not.toContain('sin(');
    expect(e36).not.toContain('texture(');
    expect(e36).not.toContain('uTime');
    expect(e36).not.toContain('gl_FragCoord');
    expect(e36).not.toMatch(/\balpha\s*[+*]?=/);
    expect(source.match(/this\.uniforms\.uniforms\.uPlantCanopyMassVfx = 0;/g))
      .toHaveLength(2);
    expect(source).toMatch(
      /const plantCanopyMassVfxEnabled = outputScale < 8\s*&& resolvePlantCanopyMassVfxEnabled\(renderLook\);/,
    );
    expect(source).toContain(
      'uPlantCanopyMassVfx: { value: plantCanopyMassVfxEnabled ? 1 : 0',
    );
    expect(preserveDrawingBuffer).toContain("get('plantCanopyMassVfxAudit') === '1'");
    expect(source).toContain('presenter.app.canvas.dataset.plantCanopyMassVfx');
    expect(source).toContain("this.app.canvas.dataset.plantCanopyMassVfx = 'inactive';");
  });

  it('keeps E30 Wood bark relief exact-owner, normal-WebGL-only, and resource-neutral', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const canvasSource = readFileSync(new URL('./field-renderer.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const normalEnd = source.indexOf('`;\n\n/** Primary WebGL presentation', normalStart);
    const eight = source.slice(eightStart, normalStart);
    const normal = source.slice(normalStart, normalEnd);
    const e20Start = normal.indexOf('      // E20:');
    const e20End = normal.indexOf('    } else if (radioactiveSurface', e20Start);
    const e20 = normal.slice(e20Start, e20End);
    const e30Start = e20.indexOf('          // E30 interrupts');
    const e30End = e20.indexOf('          // E28 keeps', e30Start);
    const e30 = e20.slice(e30Start, e30End);
    const preserveDrawingBufferStart = source.indexOf('preserveDrawingBuffer:');
    const preserveDrawingBufferEnd = source.indexOf(
      'resolution: outputScale', preserveDrawingBufferStart,
    );
    const preserveDrawingBuffer = source.slice(
      preserveDrawingBufferStart, preserveDrawingBufferEnd,
    );

    expect(e20Start).toBeGreaterThanOrEqual(0);
    expect(e20End).toBeGreaterThan(e20Start);
    expect(e30Start).toBeGreaterThanOrEqual(0);
    expect(e30End).toBeGreaterThan(e30Start);
    expect(normal).toContain('uniform float uWoodBarkReliefVfx;');
    expect(normal.match(/uWoodBarkReliefVfx > 0\.5/g)).toHaveLength(1);
    expect(eight).not.toContain('uWoodBarkReliefVfx');
    expect(eight).not.toContain('woodBarkReliefVfx');
    expect(canvasSource).not.toContain('woodBarkReliefVfx');
    expect(e20.indexOf('if (botanicalBodyReplacement > 0.5)')).toBeLessThan(e30Start);
    expect(e30).toContain(
      'float woodBarkRelief = material == 9.0\n'
        + '              && uBotanicalMesostructureVfx > 0.5\n'
        + '              && uWoodBarkReliefVfx > 0.5\n'
        + '            ? botanicalDepth : 0.0;',
    );
    for (const establishedValue of [
      'botanicalDepth', 'botanicalCluster', 'barkWarp', 'barkPlateCrown',
      'barkPlatePocket', 'barkFissure', 'barkKnot',
    ]) expect(e30).toContain(establishedValue);
    expect(e30).toContain(
      'float barkSegmentEvidence = clamp(\n'
        + '            (botanicalCluster - 0.5) * 1.25\n'
        + '              + (botanicalMacro - 0.5) * 0.45\n'
        + '              + (barkWarp - 0.5) * 0.55 + barkPlate * 0.20,',
    );
    expect(e30).not.toContain('fieldPosition');
    expect(e30).not.toContain('botanicalBodyNoise(');
    expect(e30).not.toContain('sin(');
    expect(e30).not.toContain('texture(');
    expect(e30).not.toContain('uTime');
    expect(e30).not.toContain('gl_FragCoord');
    expect(e30).not.toMatch(/\balpha\s*[+*]?=/);
    expect(source.match(/this\.uniforms\.uniforms\.uWoodBarkReliefVfx = 0;/g))
      .toHaveLength(2);
    expect(source).toMatch(
      /const woodBarkReliefVfxEnabled = outputScale < 8\s*&& resolveWoodBarkReliefVfxEnabled\(renderLook\);/,
    );
    expect(source).toContain(
      'uWoodBarkReliefVfx: { value: woodBarkReliefVfxEnabled ? 1 : 0',
    );
    expect(preserveDrawingBuffer).toContain("get('woodBarkReliefVfxAudit') === '1'");
    expect(source).toContain('presenter.app.canvas.dataset.woodBarkReliefVfx');
    expect(source).toContain("this.app.canvas.dataset.woodBarkReliefVfx = 'inactive';");
  });

  it('keeps E35 Wood tannin volume subordinate to E28/E30, normal-WebGL-only, and RGB-only', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const canvasSource = readFileSync(new URL('./field-renderer.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const normalEnd = source.indexOf('`;\n\n/** Primary WebGL presentation', normalStart);
    const eight = source.slice(eightStart, normalStart);
    const normal = source.slice(normalStart, normalEnd);
    const e20Start = normal.indexOf('      // E20:');
    const e20End = normal.indexOf('    } else if (radioactiveSurface', e20Start);
    const e20 = normal.slice(e20Start, e20End);
    const e35Start = e20.indexOf("          // E35: E28's broad heartwood");
    const e35 = e20.slice(e35Start);
    const preserveDrawingBufferStart = source.indexOf('preserveDrawingBuffer:');
    const preserveDrawingBufferEnd = source.indexOf(
      'resolution: outputScale', preserveDrawingBufferStart,
    );
    const preserveDrawingBuffer = source.slice(
      preserveDrawingBufferStart, preserveDrawingBufferEnd,
    );

    expect(e20Start).toBeGreaterThanOrEqual(0);
    expect(e20End).toBeGreaterThan(e20Start);
    expect(e35Start).toBeGreaterThanOrEqual(0);
    expect(normal).toContain('uniform float uWoodTanninVfx;');
    expect(normal.match(/uWoodTanninVfx > 0\.5/g)).toHaveLength(1);
    expect(eight).not.toContain('uWoodTanninVfx');
    expect(eight).not.toContain('woodTanninVfx');
    expect(canvasSource).not.toContain('woodTanninVfx');
    expect(e35).toContain(
      'float woodTanninVolume = woodBarkRelief > 0.001\n'
        + '              && botanicalPigment > 0.001\n'
        + '              && uWoodTanninVfx > 0.5\n'
        + '            ? botanicalDepth : 0.0;',
    );
    for (const establishedValue of [
      'barkPigmentBody', 'barkSegmentEvidence', 'barkPlate',
      'barkSegmentedPocket', 'barkFissure', 'barkSegment',
      'barkPlateCrown', 'solidEnvironment', 'woodTanninVolume',
    ]) expect(e35).toContain(establishedValue);
    expect(e35).not.toContain('fieldPosition');
    expect(e35).not.toContain('botanicalBodyNoise(');
    expect(e35).not.toContain('sin(');
    expect(e35).not.toContain('texture(');
    expect(e35).not.toContain('uTime');
    expect(e35).not.toContain('gl_FragCoord');
    expect(e35).not.toMatch(/\balpha\s*[+*]?=/);
    expect(source.match(/this\.uniforms\.uniforms\.uWoodTanninVfx = 0;/g))
      .toHaveLength(2);
    expect(source).toMatch(
      /const woodTanninVfxEnabled = outputScale < 8\s*&& resolveWoodTanninVfxEnabled\(renderLook\);/,
    );
    expect(source).toContain(
      'uWoodTanninVfx: { value: woodTanninVfxEnabled ? 1 : 0',
    );
    expect(preserveDrawingBuffer).toContain("get('woodTanninVfxAudit') === '1'");
    expect(source).toContain('presenter.app.canvas.dataset.woodTanninVfx');
    expect(source).toContain("this.app.canvas.dataset.woodTanninVfx = 'inactive';");
  });

  it('keeps E21 thick-Glass transmission exact-owner, normal-WebGL-only, and RGB-only', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const canvasSource = readFileSync(new URL('./field-renderer.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const normalEnd = source.indexOf('`;\n\n/** Primary WebGL presentation', normalStart);
    const eight = source.slice(eightStart, normalStart);
    const normal = source.slice(normalStart, normalEnd);
    const eligibilityStart = normal.indexOf('float glassBodyWeight = uGlassBodyVfx');
    const eligibilityEnd = normal.indexOf('        : 0.0;', eligibilityStart)
      + '        : 0.0;'.length;
    const eligibility = normal.slice(eligibilityStart, eligibilityEnd);
    const e21Start = normal.indexOf('      // E21:');
    const e21End = normal.indexOf('      float exactPrismatic', e21Start);
    const e21 = normal.slice(e21Start, e21End);
    const handoffEnd = normal.indexOf('        } else if (material == 12.0) {', e21End);
    const handoff = normal.slice(eligibilityStart, handoffEnd);
    const preserveDrawingBufferStart = source.indexOf('preserveDrawingBuffer:');
    const preserveDrawingBufferEnd = source.indexOf('resolution: outputScale', preserveDrawingBufferStart);
    const preserveDrawingBuffer = source.slice(preserveDrawingBufferStart, preserveDrawingBufferEnd);

    expect(eligibilityStart).toBeGreaterThanOrEqual(0);
    expect(eligibilityEnd).toBeGreaterThan(eligibilityStart);
    expect(e21Start).toBeGreaterThanOrEqual(0);
    expect(e21End).toBeGreaterThan(e21Start);
    expect(handoffEnd).toBeGreaterThan(e21End);
    const translucentBranchStart = normal.lastIndexOf(
      '    if (translucentSurface > 0.5) {', eligibilityStart,
    );
    expect(translucentBranchStart).toBeGreaterThanOrEqual(0);
    expect(eligibilityStart).toBeGreaterThan(translucentBranchStart);
    expect(eligibilityEnd).toBeLessThan(e21Start);
    expect(normal).toContain('uniform float uGlassBodyVfx;');
    expect(normal.match(/uGlassBodyVfx > 0\.5/g)).toHaveLength(1);
    expect(eight).not.toContain('uGlassBodyVfx');
    expect(eight).not.toContain('glassBodyWeight');
    expect(canvasSource).not.toContain('glassBodyVfx');
    for (const guard of [
      'material == 24.0', 'family == 0.0', 'optics == 12.0', 'traits < 0.5',
      '!materialEmissive', 'uSolidOpticalDepth > 0.5',
      'solidOpticalDepth > 30.0 / 255.0', 'solidInterior > 0.001',
      'surfaceOnly < 0.5', 'halo < 0.5', 'wall < 0.5', 'wallOnly < 0.5',
      'emissionOnly < 0.5', 'foreignMatterContact < 0.5',
      'unlikeMaterialContact < 0.5',
    ]) expect(eligibility).toContain(guard);
    for (const existingValue of [
      'solidReliefTone', 'solidKey', 'solidFresnel', 'solidEnvironment',
    ]) expect(e21).toContain(existingValue);
    expect(eligibility).toContain('? smoothstep(30.0 / 255.0, 78.0 / 255.0, solidOpticalDepth) * solidInterior');
    expect(normal).toContain('float glassBodyDepth = glassBodyWeight;');
    expect(normal).toContain('vec3 glassPreLegacy = color;');
    expect(normal.match(/if \(glassBodyWeight > 0\.0\) \{/g)).toHaveLength(2);
    expect(normal).toContain('color = mix(glassPreLegacy, color, 1.0 - glassBodyWeight);');
    expect(normal).toContain('color *= 1.0 - solidDepth * 0.010 - valley * 0.70;');
    expect(normal).not.toContain('glassLegacyWeight');
    expect(e21).not.toContain('texture(');
    expect(e21).not.toContain('uTime');
    expect(e21).not.toContain('gl_FragCoord');
    expect(e21).not.toMatch(/\balpha\s*[+*]?=/);
    expect(handoff).not.toContain('texture(');
    expect(handoff).not.toContain('uTime');
    expect(handoff).not.toContain('gl_FragCoord');
    expect(handoff).not.toMatch(/\balpha\s*[+*]?=/);
    expect(source.match(/this\.uniforms\.uniforms\.uGlassBodyVfx = 0;/g)).toHaveLength(2);
    expect(source).toContain("get('glassBodyVfxAudit') === '1'");
    expect(preserveDrawingBuffer).toContain("get('glassBodyVfxAudit') === '1'");
    expect(source).toMatch(
      /const glassBodyVfxEnabled = outputScale < 8\s*&& resolveGlassBodyVfxEnabled\(renderLook\);/,
    );
    expect(source).toContain('presenter.app.canvas.dataset.glassBodyVfx');
    expect(source).toContain("this.app.canvas.dataset.glassBodyVfx = 'inactive';");
  });

  it('keeps E22/E38 Oil body optics exact-owner, parented, normal-WebGL-only, and RGB-only', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const canvasSource = readFileSync(new URL('./field-renderer.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const normalEnd = source.indexOf('`;\n\n/** Primary WebGL presentation', normalStart);
    const eight = source.slice(eightStart, normalStart);
    const normal = source.slice(normalStart, normalEnd);
    const e22Start = normal.indexOf('          // E22:');
    const e22End = normal.indexOf('    // E14:', e22Start);
    const e22 = normal.slice(e22Start, e22End);
    const parentStart = normal.lastIndexOf(
      '    if (liquidOnly < 0.5 && halo < 0.5', e22Start,
    );
    const parent = normal.slice(parentStart, e22End);
    const preserveDrawingBufferStart = source.indexOf('preserveDrawingBuffer:');
    const preserveDrawingBufferEnd = source.indexOf(
      'resolution: outputScale', preserveDrawingBufferStart,
    );
    const preserveDrawingBuffer = source.slice(
      preserveDrawingBufferStart, preserveDrawingBufferEnd,
    );

    expect(e22Start).toBeGreaterThanOrEqual(0);
    expect(e22End).toBeGreaterThan(e22Start);
    expect(parentStart).toBeGreaterThanOrEqual(0);
    expect(normal).toContain('uniform float uOilBodyVfx;');
    expect(normal).toContain('uniform float uOilVolumeFinishVfx;');
    expect(normal.match(/uOilBodyVfx > 0\.5/g)).toHaveLength(1);
    expect(eight).not.toContain('uOilBodyVfx');
    expect(eight).not.toContain('uOilVolumeFinishVfx');
    expect(eight).not.toContain('oilBodyWeight');
    expect(canvasSource).not.toContain('oilBodyVfx');
    expect(e22).toContain('uOilBodyVfx > 0.5 && material == 8.0 && optics == 2.0');
    expect(e22).toContain('uOilVolumeFinishVfx > 0.5');
    expect(e22).toContain('30.0 / 255.0, 78.0 / 255.0, liquidOpticalDepth');
    expect(e22).toContain('(broadSheen - 0.5) * (causticWave - 0.5) * 3.10');
    expect(e22).toContain('step(3.5, shape.w) * (1.0 - exposedLiquidSide)');
    expect(e22).toContain('smoothstep(0.025, 0.50, max(oilBodyRoll, 0.0))');
    for (const existingValue of [
      'liquidVfxBody', 'liquidFresnelContour', 'broadSheen',
      'liquidMacroRelief', 'reflectedEnvironment', 'caustic',
    ]) expect(e22).toContain(existingValue);
    for (const guard of [
      'liquidOnly < 0.5', 'halo < 0.5', 'wall < 0.5', 'family == 2.0',
      'traits < 0.5', '!materialEmissive', 'molten < 0.5',
      'foreignMatterContact < 0.5', 'unlikeMaterialContact < 0.5',
      'dot(liquidSpeciesSlope, liquidSpeciesSlope) < 0.0004',
      'uLiquidBodyVfx > 0.5', 'surfaceOnly < 0.5', 'emissionOnly < 0.5',
    ]) expect(parent).toContain(guard);
    expect(e22).not.toContain('texture(');
    expect(e22).not.toContain('uTime');
    expect(e22).not.toContain('sin(');
    expect(e22).not.toContain('gl_FragCoord');
    expect(e22).not.toMatch(/\balpha\s*[+*]?=/);
    expect(source.match(/this\.uniforms\.uniforms\.uOilBodyVfx = 0;/g)).toHaveLength(2);
    expect(source.match(/this\.uniforms\.uniforms\.uOilVolumeFinishVfx = 0;/g)).toHaveLength(2);
    expect(source).toContain("get('oilBodyVfxAudit') === '1'");
    expect(preserveDrawingBuffer).toContain("get('oilBodyVfxAudit') === '1'");
    expect(source).toMatch(
      /const oilBodyVfxEnabled = outputScale < 8\s*&& resolveOilBodyVfxEnabled\(renderLook\);/,
    );
    expect(source).toMatch(
      /const oilVolumeFinishVfxEnabled = outputScale < 8\s*&& resolveOilVolumeFinishVfxEnabled\(renderLook\);/,
    );
    expect(source).toContain('presenter.app.canvas.dataset.oilBodyVfx');
    expect(source).toContain('presenter.app.canvas.dataset.oilVolumeFinishVfx');
    expect(source).toContain("this.app.canvas.dataset.oilBodyVfx = 'inactive';");
    expect(source).toContain("this.app.canvas.dataset.oilVolumeFinishVfx = 'inactive';");
  });

  it('keeps E39 Acid body optics exact-owner, E03-dependent, normal-WebGL-only, and RGB-only', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const canvasSource = readFileSync(new URL('./field-renderer.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const normalEnd = source.indexOf('`;\n\n/** Primary WebGL presentation', normalStart);
    const eight = source.slice(eightStart, normalStart);
    const normal = source.slice(normalStart, normalEnd);
    const e39Start = normal.indexOf('          // E39:');
    const e39End = normal.indexOf('    // E14:', e39Start);
    const e39 = normal.slice(e39Start, e39End);
    const parentStart = normal.lastIndexOf(
      '    if (liquidOnly < 0.5 && halo < 0.5', e39Start,
    );
    const parent = normal.slice(parentStart, e39End);
    const preserveDrawingBufferStart = source.indexOf('preserveDrawingBuffer:');
    const preserveDrawingBufferEnd = source.indexOf(
      'resolution: outputScale', preserveDrawingBufferStart,
    );
    const preserveDrawingBuffer = source.slice(
      preserveDrawingBufferStart, preserveDrawingBufferEnd,
    );

    expect(e39Start).toBeGreaterThanOrEqual(0);
    expect(e39End).toBeGreaterThan(e39Start);
    expect(parentStart).toBeGreaterThanOrEqual(0);
    expect(normal).toContain('uniform float uAcidBodyVfx;');
    expect(normal.match(/uAcidBodyVfx > 0\.5/g)).toHaveLength(1);
    expect(eight).not.toContain('uAcidBodyVfx');
    expect(eight).not.toContain('acidBodyWeight');
    expect(canvasSource).not.toContain('acidBodyVfx');
    expect(e39).toContain('material == 13.0 && optics == 3.0');
    expect(e39).not.toContain('material == 16.0');
    expect(e39).not.toContain('uLiquidVolumeChroma > 0.5');
    expect(e39).toContain('30.0 / 255.0, 78.0 / 255.0, liquidOpticalDepth');
    expect(e39).toContain('(broadSheen - 0.5) * (causticWave - 0.5) * -3.35');
    expect(e39).toContain('vec3(0.42, 1.00, 0.58)');
    for (const existingValue of [
      'liquidVfxBody', 'liquidFresnelContour', 'broadSheen', 'causticWave',
      'liquidMacroRelief', 'reflectedEnvironment', 'liquidNeighbourMean',
      'liquidSpeciesSlope', 'shape.w', 'exposedLiquidSide',
    ]) expect(e39).toContain(existingValue);
    for (const guard of [
      'liquidOnly < 0.5', 'halo < 0.5', 'wall < 0.5', 'family == 2.0',
      'traits < 0.5', '!materialEmissive', 'molten < 0.5',
      'foreignMatterContact < 0.5', 'unlikeMaterialContact < 0.5',
      'dot(liquidSpeciesSlope, liquidSpeciesSlope) < 0.0004',
      'uLiquidBodyVfx > 0.5', 'surfaceOnly < 0.5', 'emissionOnly < 0.5',
    ]) expect(parent).toContain(guard);
    expect(e39).not.toContain('texture(');
    expect(e39).not.toContain('uTime');
    expect(e39).not.toContain('sin(');
    expect(e39).not.toContain('gl_FragCoord');
    expect(e39).not.toMatch(/\balpha\s*[+*]?=/);
    expect(source.match(/this\.uniforms\.uniforms\.uAcidBodyVfx = 0;/g)).toHaveLength(2);
    expect(source).toContain("get('acidBodyVfxAudit') === '1'");
    expect(preserveDrawingBuffer).toContain("get('acidBodyVfxAudit') === '1'");
    expect(source).toMatch(
      /const acidBodyVfxEnabled = outputScale < 8\s*&& resolveAcidBodyVfxEnabled\(renderLook\);/,
    );
    expect(source).toContain('presenter.app.canvas.dataset.acidBodyVfx');
    expect(source).toContain("this.app.canvas.dataset.acidBodyVfx = 'inactive';");
  });

  it('keeps E40 sooty-powder optics exact-owner, E05-dependent, normal-WebGL-only, and RGB-only', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const canvasSource = readFileSync(new URL('./field-renderer.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const normalEnd = source.indexOf('`;\n\n/** Primary WebGL presentation', normalStart);
    const eight = source.slice(eightStart, normalStart);
    const normal = source.slice(normalStart, normalEnd);
    const e40Start = normal.indexOf('          // E40:');
    const e40End = normal.indexOf(
      '        // This is intentionally stricter than a generic settled-powder', e40Start,
    );
    const e40 = normal.slice(e40Start, e40End);
    const parentStart = normal.lastIndexOf(
      '        if (uPowderBodyVfx > 0.5', e40Start,
    );
    const parent = normal.slice(parentStart, e40End);
    const powderScopeStart = normal.lastIndexOf('    if (family == 4.0)', e40Start);
    const powderScope = normal.slice(powderScopeStart, e40End);
    const preserveStart = source.indexOf('preserveDrawingBuffer:');
    const preserveEnd = source.indexOf('resolution: outputScale', preserveStart);
    const preserve = source.slice(preserveStart, preserveEnd);

    expect(e40Start).toBeGreaterThanOrEqual(0);
    expect(e40End).toBeGreaterThan(e40Start);
    expect(parentStart).toBeGreaterThanOrEqual(0);
    expect(powderScopeStart).toBeGreaterThanOrEqual(0);
    expect(normal).toContain('uniform float uSootyPowderBodyVfx;');
    expect(normal.match(/uSootyPowderBodyVfx > 0\.5/g)).toHaveLength(1);
    expect(eight).not.toContain('uSootyPowderBodyVfx');
    expect(eight).not.toContain('sootyBodyCrown');
    expect(canvasSource).not.toContain('sootyPowderBodyVfx');
    expect(e40).toContain('optics == 14.0');
    expect(e40).toContain('material == 14.0 || material == 217.0');
    expect(e40).toContain('powderBodyGate');
    expect(e40).toContain('powderBodyVolumeDepth');
    expect(e40).toContain('powderVfxFacetBalance');
    expect(parent).toContain('uPowderBodyVfx > 0.5');
    expect(parent).toContain('powderSuspensionCohesion < 0.01');
    for (const guard of [
      'family == 4.0', 'uPowderStyle > 1.5', 'surfaceOnly < 0.5',
      'traits < 0.5', '!materialEmissive', 'halo < 0.5', 'wall < 0.5',
      'wallOnly < 0.5', 'emissionOnly < 0.5',
      'step(224.0 / 255.0, boundaryStability)', 'step(5.5, widePowderShape.w)',
    ]) expect(powderScope).toContain(guard);
    expect(e40).not.toContain('texture(');
    expect(e40).not.toContain('uTime');
    expect(e40).not.toContain('sin(');
    expect(e40).not.toContain('gl_FragCoord');
    expect(e40).not.toMatch(/\balpha\s*[+*]?=/);
    expect(source).toMatch(
      /const sootyPowderBodyVfxEnabled = outputScale < 8\s*&& resolveSootyPowderBodyVfxEnabled\(renderLook\);/,
    );
    expect(source.match(/this\.uniforms\.uniforms\.uSootyPowderBodyVfx = 0;/g))
      .toHaveLength(2);
    expect(source).toContain('presenter.app.canvas.dataset.sootyPowderBodyVfx');
    expect(source).toContain("this.app.canvas.dataset.sootyPowderBodyVfx = 'inactive';");
    expect(preserve).toContain("get('sootyPowderBodyVfxAudit') === '1'");
  });

  it('keeps E41 DEUT concentration-volume exact-owner, trait-aware, normal-WebGL-only, and RGB-only', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const canvasSource = readFileSync(new URL('./field-renderer.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const normalEnd = source.indexOf('`;\n\n/** Primary WebGL presentation', normalStart);
    const eight = source.slice(eightStart, normalStart);
    const normal = source.slice(normalStart, normalEnd);
    const e41Start = normal.indexOf('    // E41:');
    const e41End = normal.indexOf('    if (uGelHydrationStyling > 0.5', e41Start);
    const e41 = normal.slice(e41Start, e41End);
    const preserveStart = source.indexOf('preserveDrawingBuffer:');
    const preserveEnd = source.indexOf('resolution: outputScale', preserveStart);
    const preserve = source.slice(preserveStart, preserveEnd);

    expect(e41Start).toBeGreaterThanOrEqual(0);
    expect(e41End).toBeGreaterThan(e41Start);
    expect(normal).toContain('uniform float uDeutBodyVfx;');
    expect(normal.match(/uDeutBodyVfx > 0\.5/g)).toHaveLength(1);
    expect(eight).not.toContain('uDeutBodyVfx');
    expect(eight).not.toContain('deutBodyRelief');
    expect(canvasSource).not.toContain('deutBodyVfx');
    for (const guard of [
      'material == 100.0', 'optics == 1.0', 'traits == 16.0',
      'liquidOnly < 0.5', 'halo < 0.5', 'surfaceOnly < 0.5', 'wall < 0.5',
      'emissionOnly < 0.5', 'family == 2.0', '!materialEmissive', 'molten < 0.5',
      'foreignMatterContact < 0.5', 'unlikeMaterialContact < 0.5',
      'dot(liquidSpeciesSlope, liquidSpeciesSlope) < 0.0004',
      'shape.w > 3.5', 'exposedLiquidSide < 0.5',
      'liquidDepth > 0.48', 'liquidNeighbourMean > 0.56',
    ]) expect(e41).toContain(guard);
    expect(e41).toContain('30.0 / 255.0, 78.0 / 255.0, liquidOpticalDepth');
    expect(e41).toContain('(deutBodyConcentration - 240.0) / 5760.0');
    expect(e41).toContain('sqrt(deutBodyOrdinary) * 0.28');
    expect(e41).toContain('float deutBodyPresent = step(0.5, deutBodyConcentration);');
    expect(e41).toContain('deutBodyCrown * deutBodyPresent');
    expect(e41).toContain('(deutBodyPocket + deutBodyCore) * deutBodyPresent');
    expect(e41).toContain('fract(fieldPosition / vec2(24.0, 16.0))');
    expect(e41).toContain('(fieldPosition.x + fieldPosition.y) / 48.0');
    expect(e41).not.toContain('broadSheen');
    expect(e41).not.toContain('causticWave');
    expect(e41).not.toContain('liquidMacroRelief');
    expect(e41).toContain('wallState.b * 255.0');
    expect(e41).toContain('wallState.a * 255.0');
    expect(e41).not.toContain('uLiquidBodyVfx');
    expect(e41).not.toContain('texture(');
    expect(e41).not.toContain('uTime');
    expect(e41).not.toContain('sin(');
    expect(e41).not.toContain('gl_FragCoord');
    expect(e41).not.toMatch(/\balpha\s*[+*]?=/);
    expect(source).toMatch(
      /const deutBodyVfxEnabled = outputScale < 8\s*&& resolveDeutBodyVfxEnabled\(renderLook\);/,
    );
    expect(source.match(/this\.uniforms\.uniforms\.uDeutBodyVfx = 0;/g)).toHaveLength(2);
    expect(source).toContain('presenter.app.canvas.dataset.deutBodyVfx');
    expect(source).toContain("this.app.canvas.dataset.deutBodyVfx = 'inactive';");
    expect(preserve).toContain("get('deutBodyVfxAudit') === '1'");
  });

  it('keeps E23 ROCK roughness exact-owner, E17-dependent, normal-WebGL-only, and RGB-only', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const canvasSource = readFileSync(new URL('./field-renderer.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const normalEnd = source.indexOf('`;\n\n/** Primary WebGL presentation', normalStart);
    const eight = source.slice(eightStart, normalStart);
    const normal = source.slice(normalStart, normalEnd);
    const e23Start = normal.indexOf('    // E23:');
    const e23End = normal.indexOf('    color = mix(', e23Start);
    const e23 = normal.slice(e23Start, e23End);

    expect(e23Start).toBeGreaterThanOrEqual(0);
    expect(e23End).toBeGreaterThan(e23Start);
    expect(normal).toContain('uniform float uRockRoughnessVfx;');
    // E23 owns its two gloss/body gates and the E29 child repeats the parent
    // predicate locally so an inconsistent child uniform cannot revive it.
    expect(normal.match(/uRockRoughnessVfx > 0\.5/g)).toHaveLength(3);
    expect(eight).not.toContain('uRockRoughnessVfx');
    expect(eight).not.toContain('rockRoughness');
    expect(canvasSource).not.toContain('rockRoughnessVfx');
    for (const guard of [
      'material == 78.0', 'family == 0.0', 'profile == 2.0', 'optics == 8.0',
      'traits < 0.5', '!materialEmissive', 'surfaceOnly < 0.5', 'halo < 0.5',
      'wall < 0.5', 'wallOnly < 0.5', 'emissionOnly < 0.5',
      'granularSurface < 0.5', 'translucentSurface < 0.5',
      'foreignMatterContact < 0.5', 'unlikeMaterialContact < 0.5',
      'solidInterior > 0.001', 'solidOpticalDepth > 6.0 / 255.0',
    ]) expect(e23).toContain(guard);
    expect(e23).toContain('rockMicroGlint');
    expect(e23).toContain('rockBroadGloss');
    expect(e23).toContain('rockEnvironmentGloss');
    expect(e23).toContain('mix(1.0, 0.52, rockRoughness)');
    expect(e23).toContain('mix(1.0, 0.18, rockRoughness)');
    expect(e23).toContain('mix(1.0, 0.32, rockRoughness)');
    expect(normal).toContain('solidBodyKey *= mix(1.0, 0.42, solidBodyDepth);');
    expect(e23).not.toContain('texture(');
    expect(e23).not.toContain('uTime');
    expect(e23).not.toContain('gl_FragCoord');
    expect(e23).not.toMatch(/\balpha\s*[+*]?=/);
    expect(source.match(/this\.uniforms\.uniforms\.uRockRoughnessVfx = 0;/g))
      .toHaveLength(2);
    expect(source).toContain("get('rockRoughnessVfxAudit') === '1'");
    expect(source).toMatch(
      /const rockRoughnessVfxEnabled = outputScale < 8\s*&& resolveRockRoughnessVfxEnabled\(renderLook\);/,
    );
    expect(source).toContain('presenter.app.canvas.dataset.rockRoughnessVfx');
    expect(source).toContain("this.app.canvas.dataset.rockRoughnessVfx = 'inactive';");
  });

  it('keeps E29 ROCK mesostructure subordinate, smooth, and resource-neutral', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const canvasSource = readFileSync(new URL('./field-renderer.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const normalEnd = source.indexOf('`;\n\n/** Primary WebGL presentation', normalStart);
    const eight = source.slice(eightStart, normalStart);
    const normal = source.slice(normalStart, normalEnd);
    const e17Start = normal.indexOf('    // E17:');
    const e29Start = normal.indexOf('      // E29:');
    const e29End = normal.indexOf('    // E18:', e29Start);
    const e29 = normal.slice(e29Start, e29End);
    const preserveDrawingBufferStart = source.indexOf('preserveDrawingBuffer:');
    const preserveDrawingBufferEnd = source.indexOf(
      'resolution: outputScale', preserveDrawingBufferStart,
    );
    const preserveDrawingBuffer = source.slice(
      preserveDrawingBufferStart, preserveDrawingBufferEnd,
    );

    expect(e17Start).toBeGreaterThanOrEqual(0);
    expect(e29Start).toBeGreaterThan(e17Start);
    expect(e29End).toBeGreaterThan(e29Start);
    expect(normal).toContain('uniform float uRockMesostructureVfx;');
    expect(normal.match(/uRockMesostructureVfx > 0\.5/g)).toHaveLength(1);
    expect(eight).not.toContain('uRockMesostructureVfx');
    expect(eight).not.toContain('rockMesostructureVfx');
    expect(canvasSource).not.toContain('rockMesostructureVfx');
    for (const parent of [
      'uSolidBodyVfx > 0.5', 'uRockRoughnessVfx > 0.5',
      'uGeologicalSolidStyling > 0.5', 'uSolidOpticalDepth > 0.5',
      'uRockMesostructureVfx > 0.5',
      'material == 78.0', 'profile == 2.0', '? rockRoughness : 0.0',
    ]) expect(e29).toContain(parent);
    for (const reused of [
      'botanicalBodyNoise(', 'fieldPosition / 3.5', 'solidBodyRelief',
      'rockLaminaMask = smoothstep(0.20, 0.85, abs(rockFacet))',
      'rockLamina = sin(', 'rockFacet * 2.20',
      'rockLamina * 0.28 * rockLaminaMask',
      'rockFacetCrown', 'rockFacetPocket', 'rockMesostructure',
    ]) expect(e29).toContain(reused);
    expect(e29.match(/botanicalBodyNoise\(/g)).toHaveLength(1);
    expect(e29).not.toContain('texture(');
    expect(e29).not.toContain('uTime');
    expect(e29).not.toContain('gl_FragCoord');
    expect(e29).not.toMatch(/\balpha\s*[+*]?=/);
    expect(source.match(/this\.uniforms\.uniforms\.uRockMesostructureVfx = 0;/g))
      .toHaveLength(2);
    expect(source).toMatch(
      /const rockMesostructureVfxEnabled = outputScale < 8\s*&& resolveRockMesostructureVfxEnabled\(renderLook\);/,
    );
    expect(source).toContain(
      'uRockMesostructureVfx: { value: rockMesostructureVfxEnabled ? 1 : 0',
    );
    expect(preserveDrawingBuffer).toContain("get('rockMesostructureVfxAudit') === '1'");
    expect(source).toContain('presenter.app.canvas.dataset.rockMesostructureVfx');
    expect(source).toContain("this.app.canvas.dataset.rockMesostructureVfx = 'inactive';");
  });

  it('keeps E24 Water recomposition exact-owner, E03-dependent, normal-WebGL-only, and RGB-only', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const canvasSource = readFileSync(new URL('./field-renderer.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const normalEnd = source.indexOf('`;\n\n/** Primary WebGL presentation', normalStart);
    const eight = source.slice(eightStart, normalStart);
    const normal = source.slice(normalStart, normalEnd);
    const carrierStart = normal.indexOf('    // E24 first removes');
    const bodyStart = normal.indexOf('          // E24:', carrierStart);
    const bodyEnd = normal.indexOf('          // E22:', bodyStart);
    const carrier = normal.slice(carrierStart, bodyStart);
    const body = normal.slice(bodyStart, bodyEnd);

    expect(carrierStart).toBeGreaterThanOrEqual(0);
    expect(bodyStart).toBeGreaterThan(carrierStart);
    expect(bodyEnd).toBeGreaterThan(bodyStart);
    expect(normal).toContain('uniform float uWaterBodyVfx;');
    expect(eight).not.toContain('uWaterBodyVfx');
    expect(eight).not.toContain('waterBodyRecompose');
    expect(canvasSource).not.toContain('waterBodyVfx');
    for (const guard of [
      'uWaterBodyVfx > 0.5', 'material == 2.0', 'optics == 1.0',
      'liquidOnly < 0.5', 'halo < 0.5', 'surfaceOnly < 0.5',
      'wall < 0.5', 'emissionOnly < 0.5', 'family == 2.0',
      'traits < 0.5', '!materialEmissive', 'molten < 0.5',
      'foreignMatterContact < 0.5', 'unlikeMaterialContact < 0.5',
      'dot(liquidSpeciesSlope, liquidSpeciesSlope) < 0.0004',
      'shape.w > 2.5',
      'liquidDepth > 0.48', 'liquidNeighbourMean > 0.56',
    ]) expect(carrier).toContain(guard);
    expect(carrier).toContain('30.0 / 255.0, 78.0 / 255.0, liquidOpticalDepth');
    expect(carrier).toContain('inheritedLiquidCarrier *= mix(1.0, 0.50, waterBodyRecompose);');
    expect(body).toContain('(broadSheen - 0.5) * (causticWave - 0.5) * 3.25');
    expect(body).toContain('waterCausticLine * waterCausticLine');
    expect(body).toContain('waterBodyCrown * 0.160 + waterCausticFilament * 0.008');
    expect(body).toContain('vec3(0.042, 0.030, 0.016)');
    expect(`${carrier}\n${body}`).not.toContain('texture(');
    expect(`${carrier}\n${body}`).not.toMatch(/\balpha\s*[+*]?=/);
    expect(source.match(/this\.uniforms\.uniforms\.uWaterBodyVfx = 0;/g)).toHaveLength(2);
    expect(source).toContain("get('waterBodyVfxAudit') === '1'");
    expect(source).toMatch(
      /const waterBodyVfxEnabled = outputScale < 8\s*&& resolveWaterBodyVfxEnabled\(renderLook\);/,
    );
    expect(source).toContain('presenter.app.canvas.dataset.waterBodyVfx');
    expect(source).toContain("this.app.canvas.dataset.waterBodyVfx = 'inactive';");
  });

  it('keeps E25 Noble Gas billows exact-style, E04-dependent, normal-WebGL-only, and RGB-only', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const canvasSource = readFileSync(new URL('./field-renderer.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const normalEnd = source.indexOf('`;\n\n/** Primary WebGL presentation', normalStart);
    const eight = source.slice(eightStart, normalStart);
    const normal = source.slice(normalStart, normalEnd);
    const e25Start = normal.indexOf('      // E25:');
    const e25End = normal.indexOf('      // E07:', e25Start);
    const e25 = normal.slice(e25Start, e25End);

    expect(eightStart).toBeGreaterThanOrEqual(0);
    expect(normalStart).toBeGreaterThan(eightStart);
    expect(normalEnd).toBeGreaterThan(normalStart);
    expect(e25Start).toBeGreaterThanOrEqual(0);
    expect(e25End).toBeGreaterThan(e25Start);
    expect(normal).toContain('uniform float uNobleGasBillowVfx;');
    expect(eight).not.toContain('uNobleGasBillowVfx');
    expect(eight).not.toContain('nobleGasBillowVfx');
    expect(canvasSource).not.toContain('nobleGasBillowVfx');
    for (const guard of [
      'uNobleGasBillowVfx > 0.5', 'uGasIdentityStyling > 0.5',
      'wall < 0.5', '!materialEmissive',
      'floor(gasStyleState.r * 255.0 + 0.5)',
      'abs(nobleBillowStyle - 7.0)', 'nobleBillowOwner > 0.5',
    ]) expect(e25).toContain(guard);
    for (const establishedFieldScalar of [
      'gasVfxBodySupport', 'cloudNeighbourMean',
      'gasVfxBillow', 'gasDirectionalRelief', 'gasCurvature',
      'gasCrown', 'gasPocket',
    ]) expect(e25).toContain(establishedFieldScalar);
    expect(e25).toContain('smoothstep(0.12, 0.38, atmosphereState.a)');
    expect(e25).toContain('smoothstep(0.78, 0.98, atmosphereState.a) * 0.52');
    expect(e25).not.toContain('texture(');
    expect(e25).not.toContain('uTime');
    expect(e25).not.toContain('gl_FragCoord');
    expect(e25).not.toMatch(/\balpha\s*[+*]?=/);
    expect(e25).not.toMatch(/\b(?:atmosphereState|finalColor)\.a\s*[+*]?=/);
    expect(source.match(/this\.uniforms\.uniforms\.uNobleGasBillowVfx = 0;/g))
      .toHaveLength(2);
    expect(source).toMatch(
      /const nobleGasBillowVfxEnabled = outputScale < 8\s*&& resolveNobleGasBillowVfxEnabled\(renderLook\);/,
    );
    expect(source).toContain('uNobleGasBillowVfx: { value: nobleGasBillowVfxEnabled ? 1 : 0');
    expect(source).toContain('presenter.app.canvas.dataset.nobleGasBillowVfx');
    expect(source).toContain("this.app.canvas.dataset.nobleGasBillowVfx = 'inactive';");
    const preserveDrawingBufferStart = source.indexOf('preserveDrawingBuffer:');
    const preserveDrawingBufferEnd = source.indexOf(
      'resolution: outputScale', preserveDrawingBufferStart,
    );
    const preserveDrawingBuffer = source.slice(
      preserveDrawingBufferStart, preserveDrawingBufferEnd,
    );
    expect(preserveDrawingBufferStart).toBeGreaterThan(0);
    expect(preserveDrawingBufferEnd).toBeGreaterThan(preserveDrawingBufferStart);
    expect(preserveDrawingBuffer).toContain("get('nobleGasBillowVfxAudit') === '1'");
  });

  it('keeps E42 Hydrogen transmission exact-style, E04-dependent, normal-WebGL-only, and RGB-only', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const canvasSource = readFileSync(new URL('./field-renderer.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const normalEnd = source.indexOf('`;\n\n/** Primary WebGL presentation', normalStart);
    const eight = source.slice(eightStart, normalStart);
    const normal = source.slice(normalStart, normalEnd);
    const e42Start = normal.indexOf('      // E42:');
    const e42End = normal.indexOf('      // E44:', e42Start);
    const e42 = normal.slice(e42Start, e42End);
    const parentStart = normal.lastIndexOf('    if (uGasBodyVfx > 0.5)', e42Start);
    const preserveStart = source.indexOf('preserveDrawingBuffer:');
    const preserveEnd = source.indexOf('resolution: outputScale', preserveStart);
    const preserve = source.slice(preserveStart, preserveEnd);

    expect(eightStart).toBeGreaterThanOrEqual(0);
    expect(normalStart).toBeGreaterThan(eightStart);
    expect(normalEnd).toBeGreaterThan(normalStart);
    expect(e42Start).toBeGreaterThanOrEqual(0);
    expect(e42End).toBeGreaterThan(e42Start);
    expect(parentStart).toBeGreaterThanOrEqual(0);
    expect(normal).toContain('uniform float uHydrogenBodyVfx;');
    expect(normal.match(/uHydrogenBodyVfx > 0\.5/g)).toHaveLength(1);
    expect(eight).not.toContain('uHydrogenBodyVfx');
    expect(eight).not.toContain('hydrogenBodyPhase');
    expect(canvasSource).not.toContain('hydrogenBodyVfx');
    for (const guard of [
      'uHydrogenBodyVfx > 0.5', 'uGasIdentityStyling > 0.5',
      'wall < 0.5', '!materialEmissive',
      'floor(gasStyleState.r * 255.0 + 0.5)',
      'abs(hydrogenBodyStyle - 5.0)', 'hydrogenBodyOwner > 0.5',
    ]) expect(e42).toContain(guard);
    for (const establishedFieldScalar of [
      'gasVfxBodySupport', 'cloudNeighbourMean', 'atmosphereState.a',
      'gasVfxBillow', 'gasVfxWaveC', 'gasDirectionalRelief', 'gasCurvature',
      'gasCrown', 'gasPocket',
    ]) expect(e42).toContain(establishedFieldScalar);
    expect(e42).not.toContain('texture(');
    expect(e42).not.toContain('uTime');
    expect(e42).not.toContain('sin(');
    expect(e42).not.toContain('gl_FragCoord');
    expect(e42).not.toMatch(/\balpha\s*[+*]?=/);
    expect(source).toMatch(
      /const hydrogenBodyVfxEnabled = outputScale < 8\s*&& resolveHydrogenBodyVfxEnabled\(renderLook\);/,
    );
    expect(source.match(/this\.uniforms\.uniforms\.uHydrogenBodyVfx = 0;/g))
      .toHaveLength(2);
    expect(source).toContain(
      'uHydrogenBodyVfx: { value: hydrogenBodyVfxEnabled ? 1 : 0',
    );
    expect(source).toContain('presenter.app.canvas.dataset.hydrogenBodyVfx');
    expect(source).toContain("this.app.canvas.dataset.hydrogenBodyVfx = 'inactive';");
    expect(preserve).toContain("get('hydrogenBodyVfxAudit') === '1'");
  });

  it('keeps E44 Carbon Dioxide volume exact-style, E04-dependent, normal-WebGL-only, and RGB-only', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const canvasSource = readFileSync(new URL('./field-renderer.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const normalEnd = source.indexOf('`;\n\n/** Primary WebGL presentation', normalStart);
    const eight = source.slice(eightStart, normalStart);
    const normal = source.slice(normalStart, normalEnd);
    const e44Start = normal.indexOf('      // E44:');
    const e44End = normal.indexOf('      // E27:', e44Start);
    const e44 = normal.slice(e44Start, e44End);
    const parentStart = normal.lastIndexOf('    if (uGasBodyVfx > 0.5)', e44Start);
    const preserveStart = source.indexOf('preserveDrawingBuffer:');
    const preserveEnd = source.indexOf('resolution: outputScale', preserveStart);
    const preserve = source.slice(preserveStart, preserveEnd);

    expect(eightStart).toBeGreaterThanOrEqual(0);
    expect(normalStart).toBeGreaterThan(eightStart);
    expect(normalEnd).toBeGreaterThan(normalStart);
    expect(e44Start).toBeGreaterThanOrEqual(0);
    expect(e44End).toBeGreaterThan(e44Start);
    expect(parentStart).toBeGreaterThanOrEqual(0);
    expect(normal).toContain('uniform float uCarbonDioxideBodyVfx;');
    expect(normal.match(/uCarbonDioxideBodyVfx > 0\.5/g)).toHaveLength(1);
    expect(eight).not.toContain('uCarbonDioxideBodyVfx');
    expect(eight).not.toContain('carbonDioxideBodyPhase');
    expect(canvasSource).not.toContain('carbonDioxideBodyVfx');
    for (const guard of [
      'uCarbonDioxideBodyVfx > 0.5', 'uGasIdentityStyling > 0.5',
      'wall < 0.5', '!materialEmissive',
      'floor(gasStyleState.r * 255.0 + 0.5)',
      'abs(carbonDioxideBodyStyle - 6.0)', 'carbonDioxideBodyOwner > 0.5',
    ]) expect(e44).toContain(guard);
    for (const establishedFieldScalar of [
      'gasVfxBodySupport', 'cloudNeighbourMean', 'atmosphereState.a',
      'gasVfxBillow', 'gasVfxWaveC', 'gasDirectionalRelief', 'gasCurvature',
      'gasCrown', 'gasPocket', 'opticalDepth',
    ]) expect(e44).toContain(establishedFieldScalar);
    expect(e44).not.toContain('texture(');
    expect(e44).not.toContain('uTime');
    expect(e44).not.toContain('sin(');
    expect(e44).not.toContain('gl_FragCoord');
    expect(e44).not.toMatch(/\balpha\s*[+*]?=/);
    expect(source).toMatch(
      /const carbonDioxideBodyVfxEnabled = outputScale < 8\s*&& resolveCarbonDioxideBodyVfxEnabled\(renderLook\);/,
    );
    expect(source.match(/this\.uniforms\.uniforms\.uCarbonDioxideBodyVfx = 0;/g))
      .toHaveLength(2);
    expect(source).toContain(
      'uCarbonDioxideBodyVfx: {\n        value: carbonDioxideBodyVfxEnabled ? 1 : 0',
    );
    expect(source).toContain('presenter.app.canvas.dataset.carbonDioxideBodyVfx');
    expect(source).toContain("this.app.canvas.dataset.carbonDioxideBodyVfx = 'inactive';");
    expect(preserve).toContain("get('carbonDioxideBodyVfxAudit') === '1'");
  });

  it('keeps E31 Noble Gas prism exact-style, E25-dependent, normal-WebGL-only, and RGB-only', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const canvasSource = readFileSync(new URL('./field-renderer.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const normalEnd = source.indexOf('`;\n\n/** Primary WebGL presentation', normalStart);
    const eight = source.slice(eightStart, normalStart);
    const normal = source.slice(normalStart, normalEnd);
    const e31Start = normal.indexOf('      // E31 gives exact Noble Gas');
    const e31End = normal.indexOf('      // E07:', e31Start);
    const e31 = normal.slice(e31Start, e31End);
    const preserveDrawingBufferStart = source.indexOf('preserveDrawingBuffer:');
    const preserveDrawingBufferEnd = source.indexOf(
      'resolution: outputScale', preserveDrawingBufferStart,
    );
    const preserveDrawingBuffer = source.slice(
      preserveDrawingBufferStart, preserveDrawingBufferEnd,
    );

    expect(eightStart).toBeGreaterThanOrEqual(0);
    expect(normalStart).toBeGreaterThan(eightStart);
    expect(normalEnd).toBeGreaterThan(normalStart);
    expect(e31Start).toBeGreaterThanOrEqual(0);
    expect(e31End).toBeGreaterThan(e31Start);
    expect(normal).toContain('uniform float uNobleGasPrismVfx;');
    expect(normal.match(/uNobleGasPrismVfx > 0\.5/g)).toHaveLength(1);
    expect(eight).not.toContain('uNobleGasPrismVfx');
    expect(eight).not.toContain('nobleGasPrismVfx');
    expect(canvasSource).not.toContain('nobleGasPrismVfx');
    for (const guard of [
      'uNobleGasPrismVfx > 0.5', 'uNobleGasBillowVfx > 0.5',
      'uGasIdentityStyling > 0.5', 'wall < 0.5', '!materialEmissive',
      'floor(gasStyleState.r * 255.0 + 0.5)',
      'abs(noblePrismStyle - 7.0)', 'noblePrismOwner > 0.5',
    ]) expect(e31).toContain(guard);
    for (const establishedInput of [
      'gasVfxBodySupport', 'cloudNeighbourMean', 'atmosphereState.a',
      'gasVfxBillow', 'gasVfxWaveC', 'gasDirectionalRelief',
    ]) expect(e31).toContain(establishedInput);
    expect(e31).toContain('gasVfxBillow * 0.30 + gasVfxWaveC * 0.70');
    expect(e31).not.toContain('fieldPosition');
    expect(e31).not.toContain('gasVfxWaveA');
    expect(e31).not.toContain('gasVfxWaveB');
    expect(e31).not.toContain('sin(');
    expect(e31).not.toContain('texture(');
    expect(e31).not.toContain('uTime');
    expect(e31).not.toContain('gl_FragCoord');
    expect(e31).not.toMatch(/\balpha\s*[+*]?=/);
    expect(e31).not.toMatch(/\b(?:atmosphereState|finalColor)\.a\s*[+*]?=/);
    expect(source.match(/this\.uniforms\.uniforms\.uNobleGasPrismVfx = 0;/g))
      .toHaveLength(2);
    expect(source).toMatch(
      /const nobleGasPrismVfxEnabled = outputScale < 8\s*&& resolveNobleGasPrismVfxEnabled\(renderLook\);/,
    );
    expect(source).toContain(
      'uNobleGasPrismVfx: { value: nobleGasPrismVfxEnabled ? 1 : 0',
    );
    expect(source).toContain('presenter.app.canvas.dataset.nobleGasPrismVfx');
    expect(source).toContain("this.app.canvas.dataset.nobleGasPrismVfx = 'inactive';");
    expect(preserveDrawingBuffer).toContain("get('nobleGasPrismVfxAudit') === '1'");
  });

  it('keeps E27 Smoke softness exact-style, E04-dependent, normal-WebGL-only, and RGB-only', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const canvasSource = readFileSync(new URL('./field-renderer.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const normalEnd = source.indexOf('`;\n\n/** Primary WebGL presentation', normalStart);
    const eight = source.slice(eightStart, normalStart);
    const normal = source.slice(normalStart, normalEnd);
    const e27Start = normal.indexOf('      // E27:');
    const e27End = normal.indexOf('      // E25:', e27Start);
    const e27 = normal.slice(e27Start, e27End);

    expect(eightStart).toBeGreaterThanOrEqual(0);
    expect(normalStart).toBeGreaterThan(eightStart);
    expect(normalEnd).toBeGreaterThan(normalStart);
    expect(e27Start).toBeGreaterThanOrEqual(0);
    expect(e27End).toBeGreaterThan(e27Start);
    expect(normal).toContain('uniform float uSmokeSoftnessVfx;');
    expect(eight).not.toContain('uSmokeSoftnessVfx');
    expect(eight).not.toContain('smokeSoftnessVfx');
    expect(canvasSource).not.toContain('smokeSoftnessVfx');
    for (const guard of [
      'uSmokeSoftnessVfx > 0.5', 'uGasIdentityStyling > 0.5',
      'wall < 0.5', '!materialEmissive',
      'floor(gasStyleState.r * 255.0 + 0.5)',
      'abs(smokeSoftnessStyle - 1.0)',
    ]) expect(e27).toContain(guard);
    for (const establishedFieldScalar of [
      'gasVfxBodySupport', 'cloudNeighbourMean', 'atmosphereState.a',
      'gasVfxBillow', 'gasVfxWaveC', 'gasDirectionalRelief', 'gasCurvature',
      'gasVfxCrown', 'gasPocket',
    ]) expect(e27).toContain(establishedFieldScalar);
    expect(e27).not.toContain('foreignMatterContact');
    expect(e27).not.toContain('unlikeMaterialContact');
    expect(e27).not.toContain('texture(');
    expect(e27).not.toContain('uTime');
    expect(e27).not.toContain('gl_FragCoord');
    expect(e27).not.toMatch(/\balpha\s*[+*]?=/);
    expect(e27).not.toMatch(/\b(?:atmosphereState|finalColor)\.a\s*[+*]?=/);
    expect(source.match(/this\.uniforms\.uniforms\.uSmokeSoftnessVfx = 0;/g))
      .toHaveLength(2);
    expect(source).toMatch(
      /const smokeSoftnessVfxEnabled = outputScale < 8\s*&& resolveSmokeSoftnessVfxEnabled\(renderLook\);/,
    );
    expect(source).toContain('uSmokeSoftnessVfx: { value: smokeSoftnessVfxEnabled ? 1 : 0');
    expect(source).toContain('presenter.app.canvas.dataset.smokeSoftnessVfx');
    expect(source).toContain("this.app.canvas.dataset.smokeSoftnessVfx = 'inactive';");
    const preserveDrawingBufferStart = source.indexOf('preserveDrawingBuffer:');
    const preserveDrawingBufferEnd = source.indexOf(
      'resolution: outputScale', preserveDrawingBufferStart,
    );
    const preserveDrawingBuffer = source.slice(
      preserveDrawingBufferStart, preserveDrawingBufferEnd,
    );
    expect(preserveDrawingBuffer).toContain("get('smokeSoftnessVfxAudit') === '1'");
  });

  it('keeps E33 Smoke billow depth exact-style, E27-dependent, normal-WebGL-only, and RGB-only', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const canvasSource = readFileSync(new URL('./field-renderer.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const normalEnd = source.indexOf('`;\n\n/** Primary WebGL presentation', normalStart);
    const eight = source.slice(eightStart, normalStart);
    const normal = source.slice(normalStart, normalEnd);
    const e27Start = normal.indexOf('      // E27:');
    const e33Start = normal.indexOf('        // E33:', e27Start);
    const e33End = normal.indexOf('      // E25:', e33Start);
    const e33Parent = normal.slice(e27Start, e33End);
    const e33 = normal.slice(e33Start, e33End);
    const preserveDrawingBufferStart = source.indexOf('preserveDrawingBuffer:');
    const preserveDrawingBufferEnd = source.indexOf(
      'resolution: outputScale', preserveDrawingBufferStart,
    );
    const preserveDrawingBuffer = source.slice(
      preserveDrawingBufferStart, preserveDrawingBufferEnd,
    );

    expect(eightStart).toBeGreaterThanOrEqual(0);
    expect(normalStart).toBeGreaterThan(eightStart);
    expect(normalEnd).toBeGreaterThan(normalStart);
    expect(e27Start).toBeGreaterThanOrEqual(0);
    expect(e33Start).toBeGreaterThan(e27Start);
    expect(e33End).toBeGreaterThan(e33Start);
    expect(normal).toContain('uniform float uSmokeBillowDepthVfx;');
    expect(normal.match(/uSmokeBillowDepthVfx > 0\.5/g)).toHaveLength(1);
    expect(eight).not.toContain('uSmokeBillowDepthVfx');
    expect(eight).not.toContain('smokeBillowDepthVfx');
    expect(canvasSource).not.toContain('smokeBillowDepthVfx');
    for (const parentGuard of [
      'uSmokeSoftnessVfx > 0.5', 'uGasIdentityStyling > 0.5',
      'wall < 0.5', '!materialEmissive',
      'floor(gasStyleState.r * 255.0 + 0.5)',
      'abs(smokeSoftnessStyle - 1.0)', 'smokeSoftnessOwner',
    ]) expect(e33Parent).toContain(parentGuard);
    for (const establishedInput of [
      'uSmokeBillowDepthVfx > 0.5', 'smokeSoftnessMacroFold',
      'gasVfxBillow', 'gasDirectionalRelief', 'gasVfxBodySupport',
      'cloudNeighbourMean', 'atmosphereState.a',
    ]) expect(e33).toContain(establishedInput);
    expect(e33).toContain('smoothstep(0.20, 0.56, cloudNeighbourMean)');
    expect(e33).toContain('smoothstep(0.34, 0.72, atmosphereState.a)');
    expect(e33).not.toContain('gasVfxWaveA');
    expect(e33).not.toContain('gasVfxWaveB');
    expect(e33).not.toContain('sin(');
    expect(e33).not.toContain('cos(');
    expect(e33).not.toMatch(/\bnoise\b/i);
    expect(e33).not.toContain('texture(');
    expect(e33).not.toContain('uTime');
    expect(e33).not.toContain('gl_FragCoord');
    expect(e33).not.toMatch(/\balpha\s*[+*]?=/);
    expect(e33).not.toMatch(/\b(?:atmosphereState|finalColor)\.a\s*[+*]?=/);
    expect(source.match(/this\.uniforms\.uniforms\.uSmokeBillowDepthVfx = 0;/g))
      .toHaveLength(2);
    expect(source).toMatch(
      /const smokeBillowDepthVfxEnabled = outputScale < 8\s*&& resolveSmokeBillowDepthVfxEnabled\(renderLook\);/,
    );
    expect(source).toContain(
      'uSmokeBillowDepthVfx: { value: smokeBillowDepthVfxEnabled ? 1 : 0',
    );
    expect(preserveDrawingBuffer).toContain("get('smokeBillowDepthVfxAudit') === '1'");
    expect(source).toContain('presenter.app.canvas.dataset.smokeBillowDepthVfx');
    expect(source).toContain("this.app.canvas.dataset.smokeBillowDepthVfx = 'inactive';");
  });

  it('routes E08 liquid surfaces through existing normal-scale HDR resources only', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const hdrCreateStart = source.indexOf('const hdr = HDRVfxPipeline.create(');
    const hdrCreateEnd = source.indexOf(');', hdrCreateStart);
    const hdrCreate = source.slice(hdrCreateStart, hdrCreateEnd);
    const startupDatasetStart = source.indexOf(
      'presenter.app.canvas.dataset.renderLook =',
      hdrCreateEnd,
    );
    const startupDatasetEnd = source.indexOf(
      'if (presenter.hdrPipelineInfo.reason)',
      startupDatasetStart,
    );
    const startupDataset = source.slice(startupDatasetStart, startupDatasetEnd);
    const runtimeFallbackStart = source.indexOf(
      "this.app.canvas.dataset.hdrPipelineReason = 'runtime-error';",
    );
    const runtimeFallbackEnd = source.indexOf(
      'delete this.app.canvas.dataset.bloomBacking;',
      runtimeFallbackStart,
    );
    const runtimeFallback = source.slice(runtimeFallbackStart, runtimeFallbackEnd);
    const eight = source.slice(eightStart, normalStart);

    expect(eightStart).toBeGreaterThanOrEqual(0);
    expect(normalStart).toBeGreaterThan(eightStart);
    expect(source).toContain('resolveLiquidSurfaceVfxEnabled');
    expect(source).toMatch(
      /const liquidSurfaceVfxEnabled = outputScale < 8\s*&& resolveLiquidSurfaceVfxEnabled\(renderLook\);/,
    );

    expect(hdrCreateStart).toBeGreaterThan(normalStart);
    expect(hdrCreateEnd).toBeGreaterThan(hdrCreateStart);
    for (const existingResource of [
      'this.fieldSource', 'this.wallSource', 'this.liquidSource',
    ]) expect(hdrCreate).toContain(existingResource);
    expect(hdrCreate).toContain('liquidSurfaceVfxEnabled');

    expect(startupDatasetStart).toBeGreaterThan(hdrCreateEnd);
    expect(startupDatasetEnd).toBeGreaterThan(startupDatasetStart);
    expect(startupDataset).toMatch(
      /presenter\.app\.canvas\.dataset\.liquidSurfaceVfx\s*=[\s\S]*?\? 'active' : 'inactive';/,
    );
    expect(runtimeFallbackStart).toBeGreaterThan(startupDatasetEnd);
    expect(runtimeFallbackEnd).toBeGreaterThan(runtimeFallbackStart);
    expect(runtimeFallback).toContain(
      "this.app.canvas.dataset.liquidSurfaceVfx = 'inactive';",
    );
    expect(source).toContain("get('liquidSurfaceVfxAudit') === '1'");

    // E08 is an optional HDR composite over existing textures. The protected
    // direct 8x semantic shader must not gain its selector or a parallel
    // screen-space branch merely because a normal-scale URL requests it.
    expect(eight).not.toContain('uLiquidSurfaceVfx');
    expect(eight).not.toContain('liquidSurfaceVfx');
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

  it('defers an 8x timing request until the in-flight presentation fence signals', () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const fence = {} as WebGLSync;
    const gl = {
      TIMEOUT_EXPIRED: 0x911b,
      clientWaitSync: vi.fn(() => 0x911b),
    } as unknown as WebGL2RenderingContext;
    const presenter = presenterHarness();
    Object.assign(presenter, {
      outputScale: 8,
      webGLTimingEnabled: true,
      renderFence: fence,
      renderFencePoll: 0,
      app: { ...presenter.app, renderer: { gl } },
    });

    expect(presenter.requestWebGLPresentationTimingSample()).toBe(false);
    expect(presenter.webGLTimingRequested).toBe(false);
    expect(presenter.app.render).not.toHaveBeenCalled();
  });

  it('forces a stale normal-scale GPU timer query only for the explicit audit sample', () => {
    const query = {} as WebGLQuery;
    const extension = { TIME_ELAPSED_EXT: 0x88bf, GPU_DISJOINT_EXT: 0x8fbb };
    const gl = {
      QUERY_RESULT_AVAILABLE: 0x8867,
      getExtension: vi.fn(() => extension),
      createQuery: vi.fn(() => query),
      beginQuery: vi.fn(),
      endQuery: vi.fn(),
      flush: vi.fn(),
      finish: vi.fn(),
      getParameter: vi.fn(() => false),
      getQueryParameter: vi.fn(() => false),
      deleteQuery: vi.fn(),
    } as unknown as WebGL2RenderingContext;
    const presenter = presenterHarness();
    Object.assign(presenter.app, { renderer: { gl } });
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(100)
      .mockReturnValue(2_101);

    presenter.enableWebGLPresentationTiming();
    expect(presenter.requestWebGLPresentationTimingSample()).toBe(true);

    expect(presenter.getWebGLPresentationTiming()).toMatchObject({
      source: 'gpu-finish', sequence: 1, usableSamples: 1, discardedSamples: 0,
    });
    expect(gl.finish).toHaveBeenCalledOnce();
    expect(gl.deleteQuery).toHaveBeenCalledWith(query);
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
    expect(liquid).toContain('float aqueousSurfaceReflection = aqueous * topLip');
    expect(liquid).toContain('vec3(0.30, 0.74, 1.00) * aqueousSurfaceReflection;');
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
    const blockEnd = source.indexOf('    if (uGasBodyVfx > 0.5)', blockStart);
    const block = source.slice(blockStart, blockEnd);

    expect(helperStart).toBeGreaterThan(0);
    expect(helperEnd).toBeGreaterThan(helperStart);
    expect(blockStart).toBeGreaterThan(0);
    expect(blockEnd).toBeGreaterThan(blockStart);
    expect(block).toContain('(volumeSlope.x + volumeSlope.y) * 0.5882353');
    expect(block).toContain('gasCurvature * 0.125');
    expect(block).toContain('float gasVolumeExposure = clamp(');
    expect(block).toContain('gasDirectionalRelief * 0.075 + gasCurvature * 0.035');
    expect(block).toContain('(1.0 - opticalDepth * 0.30) * uGasVolumeChroma;');
    expect(block).toContain('color *= 1.0 + gasVolumeExposure;');
    expect(block).toContain('* uGasVolumeChroma');
    expect(helpers).toContain('dot(source, vec3(0.2126, 0.7152, 0.0722))');
    expect(helpers).toContain('vec3(0.88) - hue * 0.43');
    expect(`${helpers}${block}`).not.toContain('texture(');
    expect(`${helpers}${block}`).not.toMatch(/\balpha\s*[+*]?=/);
    expect(`${helpers}${block}`).not.toMatch(/\b(?:sin|pow|normalize|length)\s*\(/);
  });

  it('keeps normal-WebGL gas chroma out of the composed alpha assignment', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const blockStart = source.indexOf('    float particleAlpha = smoothstep(0.08, 0.72, density)');
    const blockEnd = source.indexOf('    // Beer-like optical depth keeps the core saturated', blockStart);
    const block = source.slice(blockStart, blockEnd);

    expect(blockStart).toBeGreaterThan(0);
    expect(blockEnd).toBeGreaterThan(blockStart);
    expect(block).toContain('alpha = cloudOnly > 0.5');
    expect(block).toContain('float semanticAccentOwnership = 1.0 - smoothstep(0.020, 0.160, atmosphereState.a);');
    expect(block).toContain('particleAlpha * semanticAccentShare * semanticAccentOwnership');
    expect(block).not.toContain('uGasVolumeChroma');
    expect(block).not.toContain('texture(');
  });

  it('bounds connected WebGL liquid-contour cohesion without new sampling', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `');
    const blockStart = source.indexOf('    if (uLiquidSilhouetteCohesion > 0.5', normalStart);
    const blockEnd = source.indexOf('    alpha = smoothstep(', blockStart);
    const block = source.slice(blockStart, blockEnd);

    expect(normalStart).toBeGreaterThan(0);
    expect(blockStart).toBeGreaterThan(0);
    expect(blockEnd).toBeGreaterThan(blockStart);
    expect(block).toContain('float liquidAirContour = adjacentLiquidSupport * exposedLiquidSide;');
    expect(block).toContain('float liquidCohesionStrength = mix(');
    expect(block).toContain('0.82, 0.96, smoothstep(0.56, 0.78, liquidNeighbourMean)');
    expect(block).toContain('liquidAirContour * liquidCohesionStrength');
    expect(block).not.toContain('texture(');
    expect(block).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('keeps WebGL gas forward scatter field-owned and RGB-only', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const blockStart = source.indexOf('    // A field-owned mid-density scatter band');
    const blockEnd = source.indexOf('    color *= 1.0 + gasCrown', blockStart);
    const block = source.slice(blockStart, blockEnd);

    expect(blockStart).toBeGreaterThan(0);
    expect(blockEnd).toBeGreaterThan(blockStart);
    expect(block).toContain('float gasForwardScatter = opticalDepth * (1.0 - opticalDepth)');
    expect(block).toContain('(0.085 + cleanGas * 0.020 - sootyGas * 0.008)');
    expect(block).toContain('vec3 gasForwardColor');
    expect(block).toContain('(vec3(1.0) - clamp(color, 0.0, 1.0))');
    expect(block).not.toContain('texture(');
    expect(block).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('keeps near-black WARP gas visible through an exact-owner RGB floor', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `');
    const gasStart = source.indexOf('    // Dense reconstructed gas should read as one mixed volume', normalStart);
    const gasEnd = source.indexOf('  } else if (liquidVolume > 0.5) {', gasStart);
    const gas = source.slice(gasStart, gasEnd);
    const warpStart = gas.indexOf('    // Native WARP is deliberately near-black');
    const warp = gas.slice(warpStart);
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);

    expect(gasStart).toBeGreaterThan(normalStart);
    expect(gasEnd).toBeGreaterThan(gasStart);
    expect(warpStart).toBeGreaterThan(0);
    expect(warp).toContain('if (material == 114.0) color = max(color, vec3(0.115, 0.075, 0.155));');
    expect(warp).not.toMatch(/\balpha\s*[+*]?=/);
    expect(eight).toContain('if (material == 114.0 && family == 1.0) color = max(color, vec3(0.115, 0.075, 0.155));');
  });

  it('keeps dense WebGL wet sediment shared, field-owned, and RGB-only', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const blockStart = source.indexOf('    // Dense field-proven suspension has settled enough');
    const blockEnd = source.indexOf('  if (halo > 0.5', blockStart);
    const block = source.slice(blockStart, blockEnd);

    expect(blockStart).toBeGreaterThan(0);
    expect(blockEnd).toBeGreaterThan(blockStart);
    expect(source).toContain('float suspensionSemanticBody = smoothstep(0.62, 0.90, density);');
    expect(source).toContain('float suspensionFieldBody = smoothstep(0.24, 0.68, suspensionState.a);');
    expect(source).toContain('float suspensionBody = max(suspensionSemanticBody, suspensionFieldBody);');
    expect(block).toContain('float sedimentCompaction = smoothstep(0.18, 0.82, suspensionState.a);');
    expect(block).toContain('float wetSedimentBias = mix(0.44, 0.52, sedimentCompaction);');
    expect(block).toContain('mix(liquidState.rgb, suspensionState.rgb, wetSedimentBias)');
    expect(block).toContain('clamp(currentLuma - wetLuma, -4.0 / 255.0, 4.0 / 255.0)');
    expect(block).not.toContain('texture(');
    expect(block).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('keeps normal-WebGL gas field light on the existing field sample', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const blockStart = source.indexOf('    float gasLightReach = smoothstep(0.002, 0.42, emissionState.a);');
    const blockEnd = source.indexOf('    // The atmosphere\'s existing cardinal field samples', blockStart);
    const block = source.slice(blockStart, blockEnd);

    expect(blockStart).toBeGreaterThan(0);
    expect(blockEnd).toBeGreaterThan(blockStart);
    expect(block).toContain('* (1.0 - opticalDepth * 0.48) * uGasFieldLighting;');
    expect(block).not.toContain('gasLightShape');
    expect(block.match(/texture\(\s*uEmissionTexture/g)).toHaveLength(1);
    expect(block).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('softens only field-proven dense WebGL gas colour seams before identity accents', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const start = source.indexOf('    vec3 gasMixture = mix(');
    const end = source.indexOf('    float gasCurvature =', start);
    const block = source.slice(start, end);

    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(block).toContain('float gasInteriorScatter = gasInterior * smoothstep(0.10, 0.60, gasShadeDensity);');
    expect(block).toContain('float gasBaseLuminance = dot(gasBase, vec3(0.2126, 0.7152, 0.0722));');
    expect(block).toContain('float gasNeutralMix = gasInteriorScatter * 0.085;');
    expect(block).toContain('gasBase = mix(gasBase, vec3(gasBaseLuminance), gasNeutralMix);');
    expect(block).not.toContain('texture(');
    expect(block).not.toMatch(/\balpha\s*[+*]?=/);
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

  it('uses one propagated style sample, one shared motif sample, and RGB-only dense species depth without changing gas support', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const rich = source.slice(source.indexOf('const FIELD_FRAGMENT = `'));
    const helperStart = rich.indexOf('vec3 gasIdentityVolumeDelta(');
    const helperEnd = rich.indexOf('float liquidVolumeChromaResponse', helperStart);
    const blockStart = rich.indexOf('    if (uGasIdentityStyling > 0.5) {');
    const blockEnd = rich.indexOf('  } else if (liquidVolume > 0.5)', blockStart);
    const helper = rich.slice(helperStart, helperEnd);
    const block = rich.slice(blockStart, blockEnd);

    expect(helperStart).toBeGreaterThan(0);
    expect(helperEnd).toBeGreaterThan(helperStart);
    expect(blockStart).toBeGreaterThan(0);
    expect(blockEnd).toBeGreaterThan(blockStart);
    expect(helper).toContain('texture(uGasIdentityMotifTexture, motifUv)');
    expect(helper).toContain('float volumeOwnership = smoothstep(0.12, 0.48, density);');
    expect(helper).toContain('float denseMotifScale = mix(0.30, 0.045, volumeOwnership);');
    expect(helper).toContain('(style > 3.5 && style < 4.5) ? 1.0 : 0.0');
    expect(helper).toContain('float motifScale = oxygenLegacy > 0.5 ? 0.34 + oxygenLegacyVolume * 0.66 : denseMotifScale;');
    expect(helper).toContain('vec3 bodyDepth = gasIdentityBodyDelta(style, density);');
    expect(helper).toContain('motif * motifScale + vec3(fieldRelief) + bodyDepth');
    const bodyStart = rich.indexOf('vec3 gasIdentityBodyDelta(float style, float density) {');
    const bodyEnd = rich.indexOf('float liquidVolumeChromaResponse', bodyStart);
    const body = rich.slice(bodyStart, bodyEnd);
    expect(bodyStart).toBeGreaterThan(helperStart);
    expect(bodyEnd).toBeGreaterThan(bodyStart);
    expect(body).toContain('smoothstep(0.10, 0.70, density)');
    expect(body).toContain('vec3(-4.0, -4.0, -3.0) * support');
    expect(body).toContain('vec3(-1.0, 2.0, 4.0) * support');
    expect(body).not.toMatch(/\btexture\s*\(/);
    expect(block).toContain('floor(gasStyleState.r * 255.0 + 0.5)');
    expect(block).not.toContain('texture(uAtmosphereStyleTexture, fieldUv)');
    expect(block).toContain('color += gasIdentityVolumeDelta(');
    expect(source).toContain('resource: this.fieldSet.atmosphere.styleBytes');
    const styleSourceStart = source.indexOf('this.atmosphereStyleSource = new BufferImageSource({');
    const styleSourceEnd = source.indexOf('});', styleSourceStart);
    const styleSource = source.slice(styleSourceStart, styleSourceEnd);
    expect(styleSourceStart).toBeGreaterThan(0);
    expect(styleSource).toContain("format: 'rgba8unorm'");
    expect(styleSource).toContain("alphaMode: 'no-premultiply-alpha'");
    expect(styleSource).toContain("scaleMode: 'nearest'");
    expect(source).toContain('this.atmosphereStyleSource.update();');
    expect(source).toContain('gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)');
    expect(source.indexOf('gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)'))
      .toBeLessThan(source.indexOf('this.app.render();', source.indexOf('private renderApplicationNow')));
    expect(`${helper}${body}${block}`).not.toMatch(/\balpha\s*[+*]?=/);
    expect(`${helper}${body}${block}`).not.toContain('uTime');
    expect(`${helper}${body}${block}`).not.toMatch(/\b(?:sin|pow|normalize|length)\s*\(/);
  });

  it('keeps Noble Gas volume chroma violet through the existing identity sample', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const rich = source.slice(source.indexOf('const FIELD_FRAGMENT = `'));
    const helperStart = rich.indexOf('vec3 gasIdentityVolumeChroma(float style, float response) {');
    const helperEnd = rich.indexOf('float liquidVolumeChromaResponse', helperStart);
    const helper = rich.slice(helperStart, helperEnd);
    const blockStart = rich.indexOf('    if (uGasIdentityStyling > 0.5) {');
    const blockEnd = rich.indexOf('  } else if (liquidVolume > 0.5)', blockStart);
    const block = rich.slice(blockStart, blockEnd);

    expect(helper).toContain('style > 6.5 && style < 7.5');
    expect(helper).toContain('smoothstep(0.005, 0.030, abs(response))');
    expect(helper).toContain('vec3(0.045, -0.052, 0.052) * violetStrength');
    expect(helper).not.toMatch(/\btexture\s*\(/);
    expect(helper).not.toMatch(/\balpha\s*[+*]?=/);
    expect(block).toContain('uGasVolumeChroma > 0.5 && gasIdentityStyle > 6.5');
    expect(block).toContain('float gasIdentityChromaSupport = smoothstep(0.012, 0.030, atmosphereState.a);');
    expect(block).toContain('vec3 nobleGasChroma = gasIdentityVolumeChroma(gasIdentityStyle, gasChroma)');
    expect(block).toContain('* gasIdentityChromaSupport;');
    expect(block).toContain('max(nobleGasChroma, vec3(0.0))');
    expect(block).toContain('min(nobleGasChroma, vec3(0.0))');
  });

  it('keeps true-8x Noble Gas chroma compact, violet, and density-gated', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const compact = source.slice(
      source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `'),
      source.indexOf('const FIELD_FRAGMENT = `'),
    );
    const helperStart = compact.indexOf('vec3 gasIdentityEightXChroma(float style, float density) {');
    const helperEnd = compact.indexOf('vec3 liquidEightXMeniscusKey', helperStart);
    const helper = compact.slice(helperStart, helperEnd);

    expect(helperStart).toBeGreaterThan(0);
    expect(helperEnd).toBeGreaterThan(helperStart);
    expect(helper).toContain('style > 6.5 && style < 7.5');
    expect(helper).toContain('vec3(0.014, -0.009, 0.016) * density');
    expect(helper).not.toMatch(/\btexture\s*\(/);
    expect(helper).not.toMatch(/\balpha\s*[+*]?=/);
    expect(compact).toContain('uGasVolumeChroma * gasIdentityEightXChroma(gasIdentityStyle, atmosphere.a)');
    expect(compact).toContain('uGasVolumeChroma * gasIdentityEightXChroma(gasIdentityStyle, gasDensity)');
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

  it('keeps liquid optical depth independently live when volume chroma is off', () => {
    const presenter = presenterHarness();

    presenter.setLiquidVolumeChromaEnabled(false);
    presenter.setLiquidOpticalDepthEnabled(false);
    expect(presenter.uniforms.uniforms.uLiquidVolumeChroma).toBe(0);
    expect(presenter.uniforms.uniforms.uLiquidOpticalDepth).toBe(0);

    presenter.setLiquidOpticalDepthEnabled(true);
    expect(presenter.uniforms.uniforms.uLiquidVolumeChroma).toBe(0);
    expect(presenter.uniforms.uniforms.uLiquidOpticalDepth).toBe(1);
  });

  it('keeps liquid volume depth RGB-only and reuses the existing auxiliary resource', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const helperStart = source.indexOf('float liquidVolumeChromaResponse(');
    const helperEnd = source.indexOf('vec3 vividColor', helperStart);
    const helpers = source.slice(helperStart, helperEnd);
    const blockStart = source.indexOf('// Family-coloured chroma and vertical optical depth');
    const blockEnd = source.indexOf('  } else {', blockStart);
    const block = source.slice(blockStart, blockEnd);

    expect(helperStart).toBeGreaterThan(0);
    expect(helperEnd).toBeGreaterThan(helperStart);
    expect(blockStart).toBeGreaterThan(0);
    expect(blockEnd).toBeGreaterThan(blockStart);
    expect(block).toContain('if (liquidOnly < 0.5 && halo < 0.5');
    expect(block).toContain('molten < 0.5 && foreignMatterContact < 0.5');
    expect(block).toContain('unlikeMaterialContact < 0.5');
    expect(block).toContain('liquidDepth > 0.38 && liquidNeighbourMean > 0.48');
    expect(block).toContain('dot(liquidSpeciesSlope, liquidSpeciesSlope) < 0.0025');
    expect(block).toContain('liquidDepth, volumeSlope, liquidDensity, liquidNeighbourMean');
    expect(block).toContain('if (uLiquidVolumeChroma > 0.5)');
    expect(block).toContain('if (uLiquidOpticalDepth > 0.5)');
    expect(block).toContain('applyLiquidVolumeChroma(color, liquidVolumeChroma, optics)');
    expect(block).toContain('applyLiquidOpticalDepth(color, optics, liquidOpticalDepth)');
    expect(helpers).toContain('vec3 liquidVolumeShadow(float optics)');
    expect(helpers).toContain('vec3 applyLiquidOpticalDepth(');
    expect(helpers).toContain('0.14 + 0.025 * smoothstep(0.42, 0.86, columnDepth)');
    expect(source).toContain('liquidOpticalDepth = boundaryStabilityAt(fieldUv)');
    expect(source).toMatch(/writeVerticalOpticalDepth\(\s*materials, this\.boundaryStabilityBytes, walls,\s*\)/);
    expect(source).toContain('if (boundaryTextureDirty) this.boundaryStabilitySource.update()');
    expect(source.match(/boundaryStabilitySource\.update\(\)/g)).toHaveLength(1);
    expect(`${helpers}${block}`).not.toContain('texture(');
    expect(`${helpers}${block}`).not.toMatch(/\balpha\s*[+*]?=/);
    expect(`${helpers}${block}`).not.toMatch(/\b(?:sin|pow|normalize|length)\s*\(/);
    const richFragment = source.slice(source.indexOf('const FIELD_FRAGMENT'));
    expect(richFragment.match(/texture\(uLiquidTexture/g)).toHaveLength(5);
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

  it('styles exact ordinary, unusual, metallic, cryogenic, and radioactive liquids with bounded RGB arithmetic', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const helperStart = source.indexOf('vec3 liquidMaterialIdentityDelta(');
    const helperEnd = source.indexOf('vec3 botanicalIdentityDelta', helperStart);
    const helper = source.slice(helperStart, helperEnd);
    const blockStart = source.indexOf('// Twenty ordinary, unusual, metallic, cryogenic, and radioactive liquids retain a world-anchored material signature');
    const blockEnd = source.indexOf('  } else {', blockStart);
    const block = source.slice(blockStart, blockEnd);
    const ids = [...helper.matchAll(/material == (\d+)\.0/g)].map((match) => Number(match[1]));
    const dispatchStart = helper.indexOf('  if (material == 36.0 || material == 95.0)');
    const commonSetup = helper.slice(helper.indexOf(') {') + 3, dispatchStart);

    expect(helperStart).toBeGreaterThan(0);
    expect(helperEnd).toBeGreaterThan(helperStart);
    expect(blockStart).toBeGreaterThan(0);
    expect(blockEnd).toBeGreaterThan(blockStart);
    expect(dispatchStart).toBeGreaterThan(0);
    expect([...new Set(ids)]).toEqual([
      36, 95, 37, 58, 34, 35, 38, 54, 55, 56, 57, 59, 60, 61, 62, 202, 207, 100, 102, 104,
    ]);
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
    for (const material of ['36.0', '37.0', '58.0', '95.0']) {
      expect(block).toContain(`material == ${material}`);
    }
    expect(block).toContain('|| material == 38.0 || (material >= 54.0 && material <= 57.0)');
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

  it('restores public metallic, cryogenic, and radioactive liquid identities in compact true-8x WebGL', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const helperStart = source.indexOf('vec3 liquidIdentityEightXDelta(', eightStart);
    const helperEnd = source.indexOf('// Device sensors need a legible visual vocabulary', helperStart);
    const blockStart = source.indexOf('// Public unusual, metallic, cryogenic, and phase-product liquids need a visual grammar', helperStart);
    const blockEnd = source.indexOf('  // The shared suspension field is powder-authored', blockStart);
    const helper = source.slice(helperStart, helperEnd);
    const block = source.slice(blockStart, blockEnd);

    expect(eightStart).toBeGreaterThan(0);
    expect(helperStart).toBeGreaterThan(eightStart);
    expect(helperEnd).toBeGreaterThan(helperStart);
    expect(blockStart).toBeGreaterThan(helperStart);
    expect(blockEnd).toBeGreaterThan(blockStart);
    expect(source.slice(eightStart, helperStart)).toContain('uniform float uLiquidIdentityStyling;');
    for (const motif of ['seed', 'diagonal', 'ribbon', 'fold', 'slopeLight', 'hue']) {
      expect(helper).toContain(motif);
    }
    expect(helper).toContain('return clamp(identity * support, vec3(-0.055), vec3(0.055));');
    expect(block).toContain('uLiquidIdentityStyling > 0.5 && !materialEmissive');
    expect(block).toContain('liquidSpeciesDifference < 0.035');
    for (const material of ['36.0', '37.0', '58.0', '95.0']) {
      expect(block).toContain(`material == ${material}`);
    }
    expect(block).toContain('|| material == 38.0 || (material >= 54.0 && material <= 57.0)');
    expect(block).toContain('|| (material >= 59.0 && material <= 62.0)');
    expect(block).toContain('|| material == 100.0 || material == 102.0 || material == 104.0');
    expect(block).toContain('|| material == 202.0 || material == 207.0');
    expect(block).toContain('liquidIdentityEightXDelta(material, grid, density, depth, liquidSlope)');
    expect(`${helper}${block}`).not.toContain('texture(');
    expect(`${helper}${block}`).not.toMatch(/\balpha\s*[+*]?=/);
    expect(`${helper}${block}`).not.toMatch(/\b(?:sin|pow|length)\s*\(/);
    expect(`${helper}${block}`).not.toContain('uTime');
  });

  it('keeps WAX and MWAX on one bounded 32-cell grammar in compact true-8x WebGL', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const helperStart = eight.indexOf('vec3 waxEightXIdentityDelta(');
    const helperEnd = eight.indexOf('// The normal path has a richer fourteen-material liquid grammar.', helperStart);
    const solidStart = eight.indexOf('vec3 unusualSolidEightXDelta(', helperEnd);
    const solidEnd = eight.indexOf('bool solidEightXGranular(', solidStart);
    const liquidStart = eight.indexOf('// Public unusual, metallic, cryogenic, and phase-product liquids need a visual grammar');
    const liquidEnd = eight.indexOf('  // The shared suspension field is powder-authored', liquidStart);
    const helper = eight.slice(helperStart, helperEnd);
    const solid = eight.slice(solidStart, solidEnd);
    const liquid = eight.slice(liquidStart, liquidEnd);

    expect(helperStart).toBeGreaterThan(0);
    expect(helperEnd).toBeGreaterThan(helperStart);
    for (const motif of ['mod(floor(worldPosition), 32.0)', 'bloom', 'raisedRidge', 'recessedFold', 'waxJoint']) {
      expect(helper).toContain(motif);
    }
    expect(helper).toContain('if (phase > 0.5) support *= 0.48 + depth * 0.52;');
    expect(solid).toContain('style == 1.0) return waxEightXIdentityDelta(0.0, position, density, 1.0);');
    expect(liquid).toContain('material == 59.0 && traits < 0.5');
    expect(liquid).toContain('waxEightXIdentityDelta(1.0, grid, density, depth)');
    expect(`${helper}${solid}${liquid}`).not.toContain('texture(');
    expect(`${helper}${solid}${liquid}`).not.toContain('uTime');
    expect(`${helper}${solid}${liquid}`).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('keeps true-8x analytic body lighting independent of expensive probes', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    expect(source).toContain("uHighQuality: {\n        value: matchMedia('(min-width: 800px)').matches && outputScale < 8 ? 1 : 0");
    expect(source).toContain("uAnalyticLightingQuality: {\n        value: matchMedia('(min-width: 800px)').matches || outputScale === 8 ? 1 : 0");
    expect(source).toContain('mix(1.45, 1.15, uAnalyticLightingQuality)');
    expect(source).toContain('if (uHighQuality > 0.5)');
  });

  it('reuses the existing centre emission sample for RGB-only true-8x gas scatter', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);

    expect(eightStart).toBeGreaterThan(0);
    expect(eightEnd).toBeGreaterThan(eightStart);
    expect(eight).toContain('uniform float uGasFieldLighting;');
    expect(eight.match(/texture\(uEmissionTexture, uv\)/g)).toHaveLength(1);
    expect(eight).toContain('float gasFieldScatter = uGasFieldLighting * smoothstep(0.002, 0.42, emission.a);');
    expect(eight).toContain('emission.rgb * gasFieldScatter * gasShell * 0.035');
    expect(eight).toContain('emission.rgb * gasFieldScatter * (0.018 + gasShell * 0.030)');
    expect(eight).toContain('foreground = vec4(gas * atmosphere.a * 0.42, atmosphere.a * 0.42);');
    expect(eight).toContain('float alpha = family == 1.0 ? smoothstep(0.006, 0.26, density) * 0.48');
  });

  it('restores true-8x gas volume relief from cardinal atmosphere alpha only', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const helperStart = eight.indexOf('vec3 gasEightXVolumeRelief(');
    const helperEnd = eight.indexOf('// The direct 8x compositor cannot carry', helperStart);
    const emptyStart = eight.indexOf('else if (atmosphere.a > 0.004) {');
    const semanticStart = eight.indexOf('if (family == 1.0) {');
    const semanticEnd = eight.indexOf('  else if (family == 2.0)', semanticStart);
    const helper = eight.slice(helperStart, helperEnd);
    const empty = eight.slice(emptyStart, semanticStart);
    const semantic = eight.slice(semanticStart, semanticEnd);

    expect(helperStart).toBeGreaterThan(0);
    expect(helperEnd).toBeGreaterThan(helperStart);
    expect(eight).toContain('uniform vec2 uAtmosphereTexel;');
    expect(helper).toContain('float neighbourMean = (left + right + top + bottom) * 0.25;');
    expect(helper).toContain('float curvature = clamp((density - neighbourMean) * 8.0, -1.0, 1.0);');
    expect(helper).toContain('return vec3(0.060, 0.076, 0.108) * key');
    expect(`${helper}${empty}${semantic}`).not.toContain('uTime');
    expect(`${helper}${empty}${semantic}`).not.toMatch(/\balpha\s*[+*]?=/);
    for (const branch of [empty, semantic]) {
      expect(branch).toContain('if (uGasFieldLighting > 0.5)');
      expect(branch.match(/texture\(uAtmosphereTexture/g)).toHaveLength(4);
      expect(branch).toContain('gasEightXVolumeRelief(');
      expect(branch).toMatch(/texture\(uAtmosphereTexture,[\s\S]*?\)\.a/);
      expect(branch).not.toMatch(/texture\(uAtmosphereTexture,[\s\S]*?\)\.rgb/);
    }
  });

  it('keeps true-8x dense gas identity on the R channel of the existing packed style field', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const helperStart = eight.indexOf('vec3 gasIdentityEightXDelta(');
    const helperEnd = eight.indexOf('void main()', helperStart);
    const emptyStart = eight.indexOf('else if (atmosphere.a > 0.004) {');
    const semanticStart = eight.indexOf('if (family == 1.0) {');
    const semanticEnd = eight.indexOf('  else if (family == 2.0)', semanticStart);
    const helper = eight.slice(helperStart, helperEnd);
    const empty = eight.slice(emptyStart, semanticStart);
    const semantic = eight.slice(semanticStart, semanticEnd);

    expect(helperStart).toBeGreaterThan(0);
    expect(helperEnd).toBeGreaterThan(helperStart);
    expect(eight).toContain('uniform sampler2D uAtmosphereStyleTexture;');
    expect(eight).toContain('uniform float uGasIdentityStyling;');
    expect(helper).toContain('smoothstep(0.10, 0.70, density)');
    expect(helper).toContain('vec3(3.0, -2.0, 3.75)');
    expect(helper).toContain('style > 6.5 && style < 7.5');
    expect(helper).not.toContain('texture(');
    expect(empty).toContain('if (uGasIdentityStyling > 0.5)');
    expect(semantic).toContain('if (uGasIdentityStyling > 0.5)');
    expect(`${empty}${semantic}`.match(/texture\(uAtmosphereStyleTexture, uv\)/g)).toHaveLength(2);
    expect(eight).not.toContain('texture(uGasIdentityMotifTexture');
    expect(`${helper}${empty}${semantic}`).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('restores static Field-profile identities for true-8x special and force bodies', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const helperStart = eight.indexOf('vec3 fieldProfileEightXDelta(');
    const helperEnd = eight.indexOf('// Temperature is already packed into the centre semantic sample', helperStart);
    const applicationStart = eight.indexOf('// Restore the normal compositor\'s Field-profile material language');
    const applicationEnd = eight.indexOf('// A few exact TPT projections', applicationStart);
    const helper = eight.slice(helperStart, helperEnd);
    const application = eight.slice(applicationStart, applicationEnd);

    expect(eightStart).toBeGreaterThan(0);
    expect(eightEnd).toBeGreaterThan(eightStart);
    expect(helperStart).toBeGreaterThan(0);
    expect(helperEnd).toBeGreaterThan(helperStart);
    expect(applicationStart).toBeGreaterThan(helperEnd);
    expect(applicationEnd).toBeGreaterThan(applicationStart);
    expect(eight).toContain('float profile = floor(style.g * 255.0 + 0.5);');
    for (const owner of ['132.0', '130.0', '131.0', '125.0', '128.0', '133.0', '129.0', '134.0']) {
      expect(helper).toContain(`material == ${owner}`);
    }
    for (const motif of ['fieldBand', 'fieldCross', 'apertureCore', 'apertureRing', 'tronRail', 'portalKey']) {
      expect(helper).toContain(motif);
    }
    expect(application).toContain('if (uFieldProfileIdentityStyling > 0.5');
    expect(application).toContain('family == 0.0 && profile == 6.0 && optics < 0.5 && !materialEmissive');
    expect(application).toContain('fieldProfileEightXDelta(material, grid, density)');
    expect(`${helper}${application}`).not.toContain('texture(');
    expect(`${helper}${application}`).not.toContain('uTime');
    expect(`${helper}${application}`).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('keeps true-8x Energy core relief static, RGB-only, and sample-free', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const start = eight.indexOf('// True 8x keeps Energy\'s dense-core relief static');
    const end = eight.indexOf('  if (family == 4.0) {', start);
    const block = eight.slice(start, end);

    expect(eightStart).toBeGreaterThan(0);
    expect(eightEnd).toBeGreaterThan(eightStart);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(eight).toContain('uniform float uEnergyCoreRelief;');
    expect(eight).toContain('uniform float uEnergyIdentityStyling;');
    expect(block).toContain('float denseEnergy = smoothstep(0.12, 0.48, emission.a)');
    expect(block).toContain('float energyRelief = (energyLobe - 0.5) * 0.14 * denseEnergy;');
    expect(block).toContain('color *= 1.0 + energyRelief * uEnergyCoreRelief;');
    const helperStart = eight.indexOf('vec3 energyEightXIdentityDelta(');
    const helperEnd = eight.indexOf('// The direct 8x compositor cannot carry', helperStart);
    const helper = eight.slice(helperStart, helperEnd);
    expect(helperStart).toBeGreaterThan(0);
    expect(helperEnd).toBeGreaterThan(helperStart);
    for (const material of [4, 20, 101, 103, 106, 107, 110, 197, 200]) {
      expect(helper).toContain(`material == ${material}.0`);
    }
    expect(block).toContain('energyEightXIdentityDelta(material, energyCell)');
    expect(block).toContain('* (1.0 - denseEnergy * 0.65) * uEnergyIdentityStyling;');
    expect(block).not.toContain('texture(');
    expect(block).not.toContain('uTime');
    expect(block).not.toMatch(/\b(?:sin|pow|normalize)\s*\(/);
    expect(block).not.toMatch(/\balpha\s*[+*]?=/);
    expect(helper).not.toContain('texture(');
    expect(helper).not.toContain('uTime');
    expect(helper).not.toMatch(/\balpha\s*[+*]?=/);
    expect(eight.match(/texture\(uEmissionTexture, uv\)/g)).toHaveLength(1);
  });

  it('keeps true-8x Smooth, Local, and Grains powder semantics distinct and field-compatible', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const projectionStart = eight.indexOf('// A direct 8x mesh normally returns immediately for semantic Empty.');
    const projectionEnd = eight.indexOf('  // True 8x already needs this centre emission sample', projectionStart);
    const modeStart = eight.indexOf('float semanticDensity = density;');
    const modeEnd = eight.indexOf('  // Preserve exact material coverage before a liquid/gas volume', modeStart);
    const projection = eight.slice(projectionStart, projectionEnd);
    const modes = eight.slice(modeStart, modeEnd);

    expect(projectionStart).toBeGreaterThan(0);
    expect(projectionEnd).toBeGreaterThan(projectionStart);
    expect(modeStart).toBeGreaterThan(0);
    expect(modeEnd).toBeGreaterThan(modeStart);
    expect(eight).toContain('uniform sampler2D uPowderSurfaceTexture;');
    expect(eight).toContain('uniform float uPowderSurfaceActive;');
    expect(eight).toContain('vec4 powderSurfaceEightXShape(vec2 uv)');
    expect(projection).toContain('uPowderStyle > 1.5 && uPowderSurfaceActive > 0.5');
    expect(projection).toContain('wallState.g > 0.5');
    expect(projection).toContain('float family10 = candidate10 > 0.5');
    expect(projection).toContain('candidate10 < 0.5 || family10 == 4.0');
    expect(projection).toContain('candidate01 < 0.5 || family01 == 4.0');
    expect(projection).toContain('candidate11 < 0.5 || family11 == 4.0');
    expect(projection).toContain('candidateFamily == 4.0 && compatible > 0.5');
    expect(modes).toContain('if (uPowderStyle < 0.5)');
    expect(modes).toContain('density = same(uv, material);');
    expect(modes).toContain('else if (uPowderStyle < 1.5)');
    expect(modes).toContain('float grainDistance = length(fract(grid + 0.5) - 0.5 - grainCentre);');
    expect(modes).toContain('else if (uPowderSurfaceActive > 0.5)');
    expect(modes).toContain('density = mix(density, smoothPowderShape.x, powderFieldBlend);');
    expect(modes).not.toContain('uTime');
    expect(modes).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('retains the normal powder 2x2 interior facet cadence at true 8x without new resources', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const powderStart = eight.indexOf('  if (family == 4.0) {');
    const powderEnd = eight.indexOf('  // Deep rigid bodies reuse', powderStart);
    const powder = eight.slice(powderStart, powderEnd);
    const facetStart = powder.indexOf('vec2 powderSubcell = floor(fract(grid) * 2.0);');
    const facetEnd = powder.indexOf('    // Smooth, supported powder retains', facetStart);
    const facet = powder.slice(facetStart, facetEnd);

    expect(powderStart).toBeGreaterThan(0);
    expect(powderEnd).toBeGreaterThan(powderStart);
    expect(facetStart).toBeGreaterThan(0);
    expect(facetEnd).toBeGreaterThan(facetStart);
    expect(facet).toContain('floor(grid) * 2.0 + powderSubcell');
    expect(facet).toContain('float powderFacetRetention = uPowderStyle > 1.5 ? 0.99 : 1.0;');
    expect(facet).toContain('float powderFacetGain = optics == 13.0 ? 1.12');
    expect(facet).toContain('float powderFacetInterior = uPowderStyle > 1.5');
    expect(facet).toContain('(1.0 - step(0.001, powderFieldBlend))');
    expect(facet).toContain('traits < 0.5 && !materialEmissive');
    expect(facet).toContain('color *= 1.0 + powderFacet * 0.24');
    expect(facet).not.toContain('texture(');
    expect(facet).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('keeps true-8x explosive-powder identity exact-owner, RGB-only, and resource-free', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const helperStart = eight.indexOf('float explosivePowderEightXStyle(');
    const helperEnd = eight.indexOf('bool solidEightXGranular(', helperStart);
    const branchStart = eight.indexOf('if (uExplosivePowderStyling > 0.5', helperStart);
    const branchEnd = eight.indexOf('    // Common Earth/mineral piles retain', branchStart);
    const helper = eight.slice(helperStart, helperEnd);
    const branch = eight.slice(branchStart, branchEnd);

    expect(helperStart).toBeGreaterThan(0);
    expect(helperEnd).toBeGreaterThan(helperStart);
    expect(branchStart).toBeGreaterThan(0);
    expect(branchEnd).toBeGreaterThan(branchStart);
    expect(eight).toContain('uniform float uExplosivePowderStyling;');
    for (const material of [14, 30, 31, 33, 94, 96]) {
      expect(helper).toContain(`material == ${material}.0`);
    }
    expect(helper).toContain('material >= 84.0 && material <= 86.0');
    expect(helper).toContain('material >= 88.0 && material <= 92.0');
    expect(branch).toContain('uExplosivePowderStyling > 0.5 && traits < 0.5 && !materialEmissive');
    expect(branch).toContain('explosivePowderEightXDelta(material, grid, density)');
    expect(`${helper}${branch}`).not.toContain('texture(');
    expect(`${helper}${branch}`).not.toContain('uTime');
    expect(`${helper}${branch}`).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('keeps true-8x unusual-powder identity Smooth-only, RGB-only, and resource-free', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const helperStart = eight.indexOf('float unusualPowderEightXStyle(');
    const helperEnd = eight.indexOf('// Device sensors need a legible visual vocabulary', helperStart);
    const branchStart = eight.indexOf('if (uUnusualPowderStyling > 0.5', helperStart);
    const branchEnd = eight.indexOf('  }\n  // Deep rigid bodies reuse', branchStart);
    const helper = eight.slice(helperStart, helperEnd);
    const branch = eight.slice(branchStart, branchEnd);
    const materials = [43, 44, 45, 46, 47, 48, 49, 51, 198, 217];

    expect(helperStart).toBeGreaterThan(0);
    expect(helperEnd).toBeGreaterThan(helperStart);
    expect(branchStart).toBeGreaterThan(0);
    expect(branchEnd).toBeGreaterThan(branchStart);
    expect(eight).toContain('uniform float uUnusualPowderStyling;');
    for (const material of materials) expect(helper).toContain(`material == ${material}.0`);
    expect(branch).toContain('uUnusualPowderStyling > 0.5 && uPowderStyle > 1.5');
    expect(branch).toContain('unusualPowderEightXStyle(material) > 0.5');
    expect(branch).toContain('traits < 0.5 && !materialEmissive');
    expect(branch).toContain('unusualPowderEightXDelta(material, grid, density)');
    expect(`${helper}${branch}`).not.toContain('texture(');
    expect(`${helper}${branch}`).not.toContain('uTime');
    expect(`${helper}${branch}`).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('keeps true-8x earthen-powder identity Smooth-only, RGB-only, and resource-free', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const helperStart = eight.indexOf('float earthenPowderEightXStyle(');
    const helperEnd = eight.indexOf('// These ten native powders carry distinct', helperStart);
    const branchStart = eight.indexOf('if (uEarthenPowderStyling > 0.5', helperStart);
    const branchEnd = eight.indexOf('    // The more unusual loose materials', branchStart);
    const helper = eight.slice(helperStart, helperEnd);
    const branch = eight.slice(branchStart, branchEnd);
    const materials = [6, 21, 26, 28];

    expect(helperStart).toBeGreaterThan(0);
    expect(helperEnd).toBeGreaterThan(helperStart);
    expect(branchStart).toBeGreaterThan(0);
    expect(branchEnd).toBeGreaterThan(branchStart);
    expect(eight).toContain('uniform float uEarthenPowderStyling;');
    for (const material of materials) expect(helper).toContain(`material == ${material}.0`);
    expect(branch).toContain('uEarthenPowderStyling > 0.5 && uPowderStyle > 1.5');
    expect(branch).toContain('earthenPowderEightXStyle(material) > 0.5');
    expect(branch).toContain('traits < 0.5 && !materialEmissive');
    expect(branch).toContain('earthenPowderEightXDelta(material, grid, density)');
    expect(`${helper}${branch}`).not.toContain('texture(');
    expect(`${helper}${branch}`).not.toContain('uTime');
    expect(`${helper}${branch}`).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('keeps true-8x semantic role accents static, RGB-only, and resource-free', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const helperStart = eight.indexOf('float roleEightXTrait(');
    const helperEnd = eight.indexOf('vec3 liquidEightXMeniscusKey(', helperStart);
    const branchStart = eight.indexOf('// Static semantic-role accents preserve');
    const branchEnd = eight.indexOf('  if (uSourceTargetStyling > 0.5', branchStart);
    const helper = eight.slice(helperStart, helperEnd);
    const branch = eight.slice(branchStart, branchEnd);

    expect(helperStart).toBeGreaterThan(0);
    expect(helperEnd).toBeGreaterThan(helperStart);
    expect(branchStart).toBeGreaterThan(0);
    expect(branchEnd).toBeGreaterThan(branchStart);
    expect(eight).toContain('uniform float uRoleMaterialStyling;');
    for (const mask of [1, 2, 4, 8]) expect(helper).toContain(`roleEightXTrait(traits, ${mask}.0)`);
    expect(helper).toContain('fract(position / 24.0) - 0.5');
    expect(helper).toContain('smoothstep(0.08, 0.72, density)');
    expect(branch).toContain('uRoleMaterialStyling > 0.5 && traits > 0.5 && !materialEmissive');
    expect(branch).toContain('roleEightXDelta(');
    expect(branch).toContain('uv * uFieldSize, density');
    expect(`${helper}${branch}`).not.toContain('texture(');
    expect(`${helper}${branch}`).not.toContain('uTime');
    expect(`${helper}${branch}`).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('restores true-8x thermal material styling from the live semantic temperature byte only', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const helperStart = eight.indexOf('float thermalEightXOpticsGain(');
    const helperEnd = eight.indexOf('vec3 liquidEightXMeniscusKey(', helperStart);
    const branchStart = eight.indexOf('// Solid and powder temperature is already encoded in semantic.g.');
    const branchEnd = eight.indexOf('// A few exact TPT projections', branchStart);
    const helper = eight.slice(helperStart, helperEnd);
    const branch = eight.slice(branchStart, branchEnd);

    expect(helperStart).toBeGreaterThan(0);
    expect(helperEnd).toBeGreaterThan(helperStart);
    expect(branchStart).toBeGreaterThan(0);
    expect(branchEnd).toBeGreaterThan(branchStart);
    expect(eight).toContain('uniform float uThermalMaterialStyling;');
    expect(helper).toContain('smoothstep(1.0, 7.0, 11.0 - temperatureByte)');
    expect(helper).toContain('smoothstep(2.0, 55.0, temperatureByte - 11.0)');
    expect(helper).toContain('thermalEightXOpticsGain(optics) / 255.0');
    expect(branch).toContain('uThermalMaterialStyling > 0.5 && !materialEmissive && traits < 0.5');
    expect(branch).toContain('material != 3.0 && (family == 0.0 || family == 4.0)');
    expect(branch).toContain('floor(semantic.g * 255.0 + 0.5)');
    expect(branch).toContain('abs(temperatureByte - 11.0) > 1.0');
    expect(branch).toContain('thermalEightXDelta(temperatureByte, optics)');
    expect(`${helper}${branch}`).not.toContain('texture(');
    expect(`${helper}${branch}`).not.toContain('uTime');
    expect(`${helper}${branch}`).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('keeps true-8x sensor glyphs exact-owner, RGB-only, and resource-free', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const helperStart = eight.indexOf('float sensorEightXStyle(');
    const helperEnd = eight.indexOf('// LIFE projections carry', helperStart);
    const branchStart = eight.indexOf('// Sensor glyphs are an exact device-owner overlay.');
    const branchEnd = eight.indexOf('// True 8x deliberately reuses the centre emission sample', branchStart);
    const helper = eight.slice(helperStart, helperEnd);
    const branch = eight.slice(branchStart, branchEnd);

    expect(helperStart).toBeGreaterThan(0);
    expect(helperEnd).toBeGreaterThan(helperStart);
    expect(branchStart).toBeGreaterThan(0);
    expect(branchEnd).toBeGreaterThan(branchStart);
    expect(eight).toContain('uniform float uSensorMaterialStyling;');
    expect(helper).toContain('material >= 164.0 && material <= 170.0');
    expect(branch).toContain('uSensorMaterialStyling > 0.5 && family == 0.0');
    expect(branch).toContain('sensorEightXStyle(material) > 0.5');
    expect(branch).toContain('traits < 0.5 && !materialEmissive');
    expect(branch).toContain('sensorEightXDelta(material, grid, density)');
    expect(`${helper}${branch}`).not.toContain('texture(');
    expect(`${helper}${branch}`).not.toContain('uTime');
    expect(`${helper}${branch}`).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('keeps true-8x construction-rigid identity exact-owner, RGB-only, and resource-free', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const helperStart = eight.indexOf('float structuralRigidEightXStyle(');
    const helperEnd = eight.indexOf('// LIFE projections carry', helperStart);
    const branchStart = eight.indexOf('// Construction solids add their material-local finish');
    const branchEnd = eight.indexOf('// True 8x deliberately reuses the centre emission sample', branchStart);
    const helper = eight.slice(helperStart, helperEnd);
    const branch = eight.slice(branchStart, branchEnd);
    const materials = [22, 23, 25, 67, 70, 73, 82];

    expect(helperStart).toBeGreaterThan(0);
    expect(helperEnd).toBeGreaterThan(helperStart);
    expect(branchStart).toBeGreaterThan(0);
    expect(branchEnd).toBeGreaterThan(branchStart);
    expect(eight).toContain('uniform float uStructuralRigidStyling;');
    for (const material of materials) expect(helper).toContain(`material == ${material}.0`);
    for (const material of [23, 67, 70, 73, 82]) {
      expect(helper).toContain(`material == ${material}.0`);
    }
    expect(helper).toContain('vec3 structuralMetalEightXBodyDelta(');
    expect(branch).toContain('uStructuralRigidStyling > 0.5 && family == 0.0');
    expect(branch).toContain('structuralRigidEightXStyle(material) > 0.5');
    expect(branch).toContain('traits < 0.5 && !materialEmissive');
    expect(branch).toContain('structuralRigidEightXDelta(material, grid, density)');
    expect(`${helper}${branch}`).not.toContain('texture(');
    expect(`${helper}${branch}`).not.toContain('uTime');
    expect(`${helper}${branch}`).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('keeps geological Coal/ROCK core optics depth-proven, RGB-only, and resource-free', () => {
    const presenter = presenterHarness();
    presenter.setGeologicalSolidStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uGeologicalSolidStyling).toBe(0);
    expect(presenter.app.render).toHaveBeenCalledOnce();

    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const directStart = eight.indexOf('vec3 geologicalSolidEightXDelta(');
    const directEnd = eight.indexOf('// Transport, actuator, and storage devices', directStart);
    const normalStart = source.indexOf('// Normal WebGL counterpart of the direct geological body grammar.');
    const normalEnd = source.indexOf('// Native transport and actuator bodies', normalStart);
    const normalBranchStart = source.indexOf(
      'if (uGeologicalSolidStyling > 0.5 && family == 0.0', normalStart,
    );
    const normalBranchEnd = source.indexOf('// Static role accents cross phase boundaries', normalBranchStart);
    const direct = eight.slice(directStart, directEnd);
    const normal = source.slice(normalStart, normalEnd);

    expect(directStart).toBeGreaterThan(0);
    expect(directEnd).toBeGreaterThan(directStart);
    expect(normalStart).toBeGreaterThan(0);
    expect(normalEnd).toBeGreaterThan(normalStart);
    expect(normalBranchStart).toBeGreaterThan(0);
    expect(normalBranchEnd).toBeGreaterThan(normalBranchStart);
    for (const material of [19, 78]) {
      expect(direct).toContain(`material == ${material}.0`);
      expect(normal).toContain(`material == ${material}.0`);
    }
    expect(eight).toContain('uniform float uGeologicalSolidStyling;');
    expect(source).toContain('uGeologicalSolidStyling: { value: 1, type: \'f32\' }');
    const normalContract = normal + source.slice(normalBranchStart, normalBranchEnd);
    expect(normalContract).toContain('solidOpticalDepth > 6.0 / 255.0) {');
    expect(eight).toContain('depth > 6.0 / 255.0 && q00 * q10 * q01 * q11 > 0.5');
    expect(`${direct}${normalContract}`).not.toContain('texture(');
    expect(`${direct}${normalContract}`).not.toContain('uTime');
    expect(`${direct}${normalContract}`).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('keeps FRAY force identity exact-owner, RGB-only, and resource-free in both shaders', () => {
    const presenter = presenterHarness();
    presenter.setFrayForceStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uFrayForceStyling).toBe(0);
    expect(presenter.app.render).toHaveBeenCalledOnce();

    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const directStart = eight.indexOf('vec3 frayForceEightXDelta(');
    const directEnd = eight.indexOf('// Transport, actuator, and storage devices', directStart);
    const normalStart = source.indexOf('vec3 frayForceIdentityDelta(');
    const normalEnd = source.indexOf('// Native transport and actuator bodies', normalStart);
    const directBranch = eight.indexOf('if (uFrayForceStyling > 0.5 && material == 118.0');
    const normalBranch = source.indexOf('if (uFrayForceStyling > 0.5 && material == 118.0', normalStart);
    const direct = eight.slice(directStart, directEnd);
    const normal = source.slice(normalStart, normalEnd);
    const branches = eight.slice(directBranch, directBranch + 360)
      + source.slice(normalBranch, normalBranch + 420);

    expect(directStart).toBeGreaterThan(0);
    expect(directEnd).toBeGreaterThan(directStart);
    expect(normalStart).toBeGreaterThan(0);
    expect(normalEnd).toBeGreaterThan(normalStart);
    expect(directBranch).toBeGreaterThan(0);
    expect(normalBranch).toBeGreaterThan(0);
    expect(eight).toContain('uniform float uFrayForceStyling;');
    expect(source).toContain('uFrayForceStyling: { value: 1, type: \'f32\' }');
    expect(`${direct}${normal}${branches}`).toContain('material == 118.0');
    expect(`${direct}${normal}${branches}`).not.toContain('texture(');
    expect(`${direct}${normal}${branches}`).not.toContain('uTime');
    expect(`${direct}${normal}${branches}`).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('keeps GBMB containment identity exact-owner and never infers unavailable gravity', () => {
    const presenter = presenterHarness();
    presenter.setGbmbForceStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uGbmbForceStyling).toBe(0);
    expect(presenter.app.render).toHaveBeenCalledOnce();

    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const directStart = eight.indexOf('vec3 gbmbForceEightXDelta(');
    const directEnd = eight.indexOf('// Transport, actuator, and storage devices', directStart);
    const normalStart = source.indexOf('vec3 gbmbForceIdentityDelta(');
    const normalEnd = source.indexOf('// Native transport and actuator bodies', normalStart);
    const directBranch = eight.indexOf('if (uGbmbForceStyling > 0.5 && material == 120.0');
    const normalBranch = source.indexOf('if (uGbmbForceStyling > 0.5 && material == 120.0', normalStart);
    const direct = eight.slice(directStart, directEnd);
    const normal = source.slice(normalStart, normalEnd);
    const branches = eight.slice(directBranch, directBranch + 300)
      + source.slice(normalBranch, normalBranch + 420);

    expect(directStart).toBeGreaterThan(0);
    expect(directEnd).toBeGreaterThan(directStart);
    expect(normalStart).toBeGreaterThan(0);
    expect(normalEnd).toBeGreaterThan(normalStart);
    expect(directBranch).toBeGreaterThan(0);
    expect(normalBranch).toBeGreaterThan(0);
    expect(eight).toContain('uniform float uGbmbForceStyling;');
    expect(source).toContain('uGbmbForceStyling: { value: 1, type: \'f32\' }');
    expect(`${direct}${normal}${branches}`).toContain('material == 120.0');
    expect(`${direct}${normal}${branches}`).not.toContain('texture(');
    expect(`${direct}${normal}${branches}`).not.toContain('uTime');
    expect(`${direct}${normal}${branches}`).not.toContain('uGravity');
    expect(`${direct}${normal}${branches}`).not.toContain('velocity');
    expect(`${direct}${normal}${branches}`).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('keeps true-8x transport hardware exact-owner, RGB-only, and resource-free', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const helperStart = eight.indexOf('float mechanismEightXStyle(');
    const helperEnd = eight.indexOf('// Broad metallic bodies need a different read', helperStart);
    const branchStart = eight.indexOf('// Transport/actuator hardware spans force, powered, and ordinary-solid');
    const branchEnd = eight.indexOf('// Construction solids add their material-local finish', branchStart);
    const helper = eight.slice(helperStart, helperEnd);
    const branch = eight.slice(branchStart, branchEnd);
    const materials = [117, 119, 121, 122, 123, 155, 160, 161, 162, 163];

    expect(helperStart).toBeGreaterThan(0);
    expect(helperEnd).toBeGreaterThan(helperStart);
    expect(branchStart).toBeGreaterThan(0);
    expect(branchEnd).toBeGreaterThan(branchStart);
    expect(eight).toContain('uniform float uMechanismBodyStyling;');
    for (const material of materials) expect(helper).toContain(`material == ${material}.0`);
    expect(branch).toContain('uMechanismBodyStyling > 0.5 && mechanismEightXStyle(material) > 0.5');
    expect(branch).toContain('mechanismEightXStyle(material) > 0.5');
    expect(branch).toContain('&& !materialEmissive');
    expect(branch).toContain('mechanismEightXDelta(material, grid, density)');
    expect(`${helper}${branch}`).not.toContain('texture(');
    expect(`${helper}${branch}`).not.toContain('uTime');
    expect(`${helper}${branch}`).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('keeps true-8x native control electronics exact-owner, RGB-only, and resource-free', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const helperStart = eight.indexOf('float electronicEightXStyle(');
    const helperEnd = eight.indexOf('// Broad metallic bodies need a different read', helperStart);
    const branchStart = eight.indexOf('// Control electronics span powered, force, and ordinary Device records');
    const branchEnd = eight.indexOf('// Construction solids add their material-local finish', branchStart);
    const helper = eight.slice(helperStart, helperEnd);
    const branch = eight.slice(branchStart, branchEnd);
    const materials = [135, 136, 138, 139, 140, 141, 142, 143, 144, 145,
      146, 147, 149, 150, 151, 152, 153, 154, 156, 157];

    expect(helperStart).toBeGreaterThan(0);
    expect(helperEnd).toBeGreaterThan(helperStart);
    expect(branchStart).toBeGreaterThan(0);
    expect(branchEnd).toBeGreaterThan(branchStart);
    expect(eight).toContain('uniform float uElectronicIdentityStyling;');
    for (const material of materials) expect(helper).toContain(`material == ${material}.0`);
    for (const excluded of [137, 148, 155, 158, 159, 160, 161, 162, 163]) {
      expect(helper).not.toContain(`material == ${excluded}.0`);
    }
    expect(branch).toContain('uElectronicIdentityStyling > 0.5 && electronicEightXStyle(material) > 0.5');
    expect(branch).toContain('&& !materialEmissive');
    expect(branch).toContain('electronicEightXDelta(material, grid, density)');
    expect(`${helper}${branch}`).not.toContain('texture(');
    expect(`${helper}${branch}`).not.toContain('uTime');
    expect(`${helper}${branch}`).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('keeps true-8x LIFE-preset identity exact-owner, RGB-only, and resource-free', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const helperStart = eight.indexOf('vec3 cellularIdentityEightXDelta(');
    const helperEnd = eight.indexOf('bool solidEightXGranular(', helperStart);
    const branchStart = eight.indexOf('// The normal path already gives every PT_LIFE ctype');
    const branchEnd = eight.indexOf('// True 8x deliberately reuses the centre emission sample', branchStart);
    const helper = eight.slice(helperStart, helperEnd);
    const branch = eight.slice(branchStart, branchEnd);

    expect(helperStart).toBeGreaterThan(0);
    expect(helperEnd).toBeGreaterThan(helperStart);
    expect(branchStart).toBeGreaterThan(0);
    expect(branchEnd).toBeGreaterThan(branchStart);
    expect(eight).toContain('uniform float uCellularMaterialStyling;');
    expect(helper).toContain('float preset = material - 171.0;');
    expect(helper).toContain('preset > 23.5');
    expect(helper).toContain('smoothstep(0.08, 0.72, density)');
    expect(branch).toContain('uCellularMaterialStyling > 0.5 && family == 0.0');
    expect(branch).toContain('material >= 171.0 && material <= 194.0');
    expect(branch).toContain('cellularIdentityEightXDelta(material, grid, density)');
    expect(`${helper}${branch}`).not.toContain('texture(');
    expect(`${helper}${branch}`).not.toContain('uTime');
    expect(`${helper}${branch}`).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('keeps true-8x uncommon-solid identity exact-owner, RGB-only, and resource-free', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const helperStart = eight.indexOf('float unusualSolidEightXStyle(');
    const helperEnd = eight.indexOf('bool solidEightXGranular(', helperStart);
    const branchStart = eight.indexOf('// Restore the normal composer\'s uncommon-solid identity family');
    const branchEnd = eight.indexOf('// True 8x deliberately reuses the centre emission sample', branchStart);
    const helper = eight.slice(helperStart, helperEnd);
    const branch = eight.slice(branchStart, branchEnd);
    const materials = [27, 68, 74, 76, 77, 79, 80, 196, 203, 204, 206, 208, 209, 210, 211, 212, 216];

    expect(helperStart).toBeGreaterThan(0);
    expect(helperEnd).toBeGreaterThan(helperStart);
    expect(branchStart).toBeGreaterThan(0);
    expect(branchEnd).toBeGreaterThan(branchStart);
    expect(eight).toContain('uniform float uUnusualSolidStyling;');
    for (const material of materials) expect(helper).toContain(`material == ${material}.0`);
    expect(branch).toContain('uUnusualSolidStyling > 0.5 && family == 0.0');
    expect(branch).toContain('unusualSolidEightXStyle(material) > 0.5');
    expect(branch).toContain('(traits < 0.5 || material == 216.0) && !materialEmissive');
    expect(branch).toContain('unusualSolidEightXDelta(material, grid, density)');
    expect(`${helper}${branch}`).not.toContain('texture(');
    expect(`${helper}${branch}`).not.toContain('uTime');
    expect(`${helper}${branch}`).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('converges normal WebGL dense Energy toward its existing emission field only', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `');
    const start = source.indexOf('  } else if (energyCore > 0.5) {', normalStart);
    const end = source.indexOf('  } else if (gasVolume > 0.5) {', start);
    const block = source.slice(start, end);

    expect(normalStart).toBeGreaterThan(0);
    expect(start).toBeGreaterThan(normalStart);
    expect(end).toBeGreaterThan(start);
    expect(block).toContain('float cohesiveEnergy = denseEnergyField * smoothstep(0.18, 0.66, density);');
    expect(block).toContain('float energyFieldChroma = cohesiveEnergy * (0.08 + core * 0.08) * uEnergyCoreRelief;');
    expect(block).toContain('vec3 cohesiveEnergyBase = mix(energyBase, emissionState.rgb, energyFieldChroma);');
    expect(block).toContain('1.0 + flowWave * 0.022 + pulse * 0.018,\n      // Once the shared emission field proves a dense body, its broad flow is\n      // the only remaining carrier variation. This is RGB-only: semantic\n      // alpha, sparse-particle topology, and field support remain unchanged.\n      cohesiveEnergy');
    expect(block).toContain('color = cohesiveEnergyBase * (1.05 + core * 0.48 + heat * 0.30) * cohesiveCarrierDetail;');
    expect(block).toContain('alpha = mix(semanticAlpha, cohesiveAlpha, cohesiveEnergy * 0.72);');
    expect(block).not.toContain('texture(');
  });

  it('keeps saturated normal-WebGL Energy hue through its bounded shoulder', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `');
    const start = source.indexOf('vec3 toneMapEnergy(vec3 radiance) {', normalStart);
    const end = source.indexOf('vec3 energyIdentityDelta(', start);
    const helper = source.slice(start, end);

    expect(start).toBeGreaterThan(normalStart);
    expect(end).toBeGreaterThan(start);
    expect(helper).toContain('float peak = max(max(radiance.r, radiance.g), radiance.b);');
    expect(helper).toContain('if (peak <= knee) return radiance;');
    expect(helper).toContain('float mappedPeak = knee + (ceiling - knee) * (peak - knee) / (peak - knee + shoulder);');
    expect(helper).toContain('return radiance * (mappedPeak / peak);');
    expect(helper).not.toContain('vec3 excess =');
    expect(helper).not.toContain('vec3 mapped =');
  });

  it('keeps true-8x deep solid body optics interior-only, RGB-only, and resource-free', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const helperStart = eight.indexOf('bool solidEightXGranular(');
    const helperEnd = eight.indexOf('void main()', helperStart);
    const start = eight.indexOf('// Deep rigid bodies reuse the existing exact-species occupancy');
    const end = eight.indexOf('// Compact Device bodies retain', start);
    const helper = eight.slice(helperStart, helperEnd);
    const block = eight.slice(start, end);

    expect(helperStart).toBeGreaterThan(0);
    expect(helperEnd).toBeGreaterThan(helperStart);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(eight).toContain('uniform float uSolidOpticalDepth;');
    expect(helper).toContain('optics == 7.0 || optics == 13.0 || optics == 14.0 || optics == 15.0');
    expect(helper).toContain('vec3 solidEightXBodyKey(float optics)');
    expect(helper).toContain('vec3 solidEightXBodyShadow(float optics)');
    expect(block).toContain('uSolidOpticalDepth > 0.5 && !materialEmissive');
    expect(block).toContain('depth > 6.0 / 255.0 && q00 * q10 * q01 * q11 > 0.5 && density > 0.76');
    expect(block).toContain('linearThickness * (1.4 - linearThickness * 0.4)');
    expect(block).toContain('bodyTriangle * bodyTriangle * (3.0 - bodyTriangle * 2.0)');
    expect(block).toContain('solidEightXBodyKey(optics)');
    expect(block).toContain('solidEightXBodyShadow(optics)');
    expect(block).toContain('optics == 11.0 ? 4.0 / 255.0 : 14.0 / 255.0');
    expect(block).toContain('optics == 11.0 ? 16.0 / 255.0 : 10.0 / 255.0');
    expect(block).toContain('if (material == 9.0) {');
    expect(block).toContain('float woodGrain = 0.5 + 0.5 * sin(');
    expect(block).toContain('float woodRidge = smoothstep(0.64, 0.94, woodGrain);');
    expect(block).toContain('float woodPocket = 1.0 - smoothstep(0.28, 0.58, woodGrain);');
    expect(block).toContain('if (material == 10.0) {');
    expect(block).toContain('float canopyCrown = max(0.0, bodyResponse) * 2.0;');
    expect(block).toContain('float canopyPocket = max(0.0, -bodyResponse) * 2.0;');
    expect(block).toContain('vec3 canopyNormal = vec3(-canopySlope * 0.58, 1.0);');
    expect(block).toContain('float canopySheen = (0.008 + canopySpecular * 0.030) * depthT;');
    expect(block).toContain('float canopyCluster = mod(floor(grid.x / 3.0) * 17.0');
    expect(block).toContain('float canopyClusterVein = 1.0 - step(0.5, mod(');
    expect(`${helper}${block}`).not.toContain('texture(');
    expect(`${helper}${block}`).not.toContain('uTime');
    expect(`${helper}${block}`).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('keeps depth-proven Wood, Plant, and Vine body optics RGB-only in normal WebGL', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `');
    const start = source.indexOf('    } else if (organicSurface > 0.5 || (optics < 0.5 && profile == 3.0)) {', normalStart);
    const end = source.indexOf('    } else if (radioactiveSurface > 0.5 || (optics < 0.5 && profile == 4.0)) {', start);
    const block = source.slice(start, end);

    expect(normalStart).toBeGreaterThan(0);
    expect(start).toBeGreaterThan(normalStart);
    expect(end).toBeGreaterThan(start);
    expect(block).toContain('if (material == 9.0 && uSolidOpticalDepth > 0.5');
    expect(block).toContain('solidOpticalDepth > 6.0 / 255.0 && solidInterior > 0.001');
    expect(block).toContain('float woodGrain = 0.5 + 0.5 * fibre;');
    expect(block).toContain('float woodRelief = clamp(solidReliefTone * 255.0 / 6.0, -1.0, 1.0) * woodDepth;');
    expect(block).toContain('float organicMicroGain = material == 10.0 ? 0.055 : 1.0;');
    expect(block).toContain('float organicBaseline = material == 10.0 ? 1.0 : 0.95;');
    expect(block).toContain('* interiorMicroGain * organicMicroGain;');
    expect(block).toContain('(material == 9.0 || material == 10.0 || material == 83.0)');
    expect(block).toContain('float organicDepth = smoothstep(6.0 / 255.0, 42.0 / 255.0, solidOpticalDepth);');
    expect(block).toContain('float organicRelief = clamp(solidReliefTone * 255.0 / 6.0, -1.0, 1.0)');
    expect(block).toContain('float organicGrazing = smoothstep(0.018, 0.18, solidFresnel);');
    expect(block).toContain('solidEnvironment * (0.050 + organicGrazing * 0.11)');
    expect(block).toContain('surfaceOnly < 0.5');
    expect(block).not.toContain('texture(');
    expect(block).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('keeps E43 exact-radioactive-Solid, depth-proven, state-independent, and normal-WebGL-only', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const canvasSource = readFileSync(new URL('./field-renderer.ts', import.meta.url), 'utf8');
    const browserGate = readFileSync(
      new URL('../../scripts/verify-browser-input.mjs', import.meta.url), 'utf8',
    );
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `');
    const start = source.indexOf('    } else if (radioactiveSurface > 0.5 || (optics < 0.5 && profile == 4.0)) {', normalStart);
    const end = source.indexOf('    } else if (deviceSurface > 0.5 || (optics < 0.5 && profile == 5.0)) {', start);
    const eight = source.slice(eightStart, normalStart);
    const block = source.slice(start, end);
    const e43Start = block.indexOf('      // E43:');
    const e43 = block.slice(e43Start);
    const preserveStart = source.indexOf('preserveDrawingBuffer:');
    const preserveEnd = source.indexOf('resolution: outputScale', preserveStart);
    const preserve = source.slice(preserveStart, preserveEnd);

    expect(eightStart).toBeGreaterThanOrEqual(0);
    expect(normalStart).toBeGreaterThan(0);
    expect(start).toBeGreaterThan(normalStart);
    expect(end).toBeGreaterThan(start);
    expect(e43Start).toBeGreaterThanOrEqual(0);
    expect(e43).toContain('bool radioactiveSolidBodyOwner = material == 105.0 || material == 113.0;');
    for (const guard of [
      'uRadioactiveSolidBodyVfx > 0.5', 'uSolidBodyVfx > 0.5',
      'uEnergyIdentityStyling > 0.5', 'uSolidOpticalDepth > 0.5',
      'family == 0.0', 'profile == 4.0', 'optics == 11.0',
      'abs(traits - 16.0) < 0.5', 'surfaceOnly < 0.5',
      'halo < 0.5', 'wall < 0.5', 'wallOnly < 0.5',
      'emissionOnly < 0.5', '!materialEmissive',
      'foreignMatterContact < 0.5', 'unlikeMaterialContact < 0.5',
      'solidOpticalDepth > 6.0 / 255.0', 'solidInterior > 0.001',
    ]) expect(e43).toContain(guard);
    for (const establishedScalar of [
      'botanicalBodyNoise', 'radioactiveSolidMacro', 'radioactiveSolidFacet',
      'radioactiveSolidDepth', 'radioactiveSolidCore',
    ]) expect(e43).toContain(establishedScalar);
    for (const stripedCarrier of [
      'solidReliefTone', 'solidKey', 'solidFill', 'solidFresnel', 'solidEnvironment',
    ]) expect(e43).not.toContain(stripedCarrier);
    for (const rejectedOwner of ['99.0', '108.0', '109.0', '111.0', '112.0']) {
      expect(e43).not.toContain(`material == ${rejectedOwner}`);
    }
    expect(e43).not.toContain('wallState');
    expect(e43).not.toContain('texture(');
    expect(e43).not.toContain('uTime');
    expect(e43).not.toContain('sin(');
    expect(e43).not.toContain('gl_FragCoord');
    expect(e43).not.toMatch(/\balpha\s*[+*]?=/);
    expect(eight).not.toContain('uRadioactiveSolidBodyVfx');
    expect(eight).not.toContain('radioactiveSolidBodyOwner');
    expect(canvasSource).not.toContain('radioactiveSolidBodyVfx');
    expect(source).toMatch(
      /const radioactiveSolidBodyVfxEnabled = outputScale < 8\s*&& resolveRadioactiveSolidBodyVfxEnabled\(renderLook\);/,
    );
    expect(source).toContain(
      'uRadioactiveSolidBodyVfx: {\n        value: radioactiveSolidBodyVfxEnabled ? 1 : 0',
    );
    expect(source.match(/this\.uniforms\.uniforms\.uRadioactiveSolidBodyVfx = 0;/g))
      .toHaveLength(2);
    expect(source).toContain('presenter.app.canvas.dataset.radioactiveSolidBodyVfx');
    expect(source).toContain("this.app.canvas.dataset.radioactiveSolidBodyVfx = 'inactive';");
    expect(preserve).toContain("get('radioactiveSolidBodyVfxAudit') === '1'");
    for (const probe of [
      'ISZSCore', 'ISZSCrown', 'ISZSPocket', 'VIBRCore', 'VIBRCrown', 'VIBRPocket',
    ]) expect(browserGate).toContain(`${probe}: Object.freeze({`);
    expect(browserGate).toContain('inRange(sample.signedMean, acceptance.signedMean)');
    expect(browserGate).toContain('sample.rgbPeak === 0');
    expect(browserGate).toContain('disabledRawControls, enabledRawControls, repeatedRawControls');
    expect(browserGate).toContain('radioactiveSolidBodyVfxStateSeparation');
    expect(browserGate).toContain('audit.prepareRadioactiveSolidBodyVfxFixture();');
    expect(browserGate).toContain('radioactiveSolidBodyVfxFixtureReady(cdp, fixture)');
    expect(browserGate).toContain('radioactiveSolidBodyVfxStateDigest(cdp, fixture)');
  });

  it('gives only deep settled radioactive powders an RGB-only Smooth body', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `');
    const start = source.indexOf('// Radioactive powders carry native traits, so the ordinary trait-free', normalStart);
    const end = source.indexOf('      float grainOffsetY =', start);
    const block = source.slice(start, end);

    expect(start).toBeGreaterThan(normalStart);
    expect(end).toBeGreaterThan(start);
    for (const material of ['99.0', '108.0', '109.0', '111.0', '112.0']) {
      expect(block).toContain(`material == ${material}`);
    }
    expect(block).toContain('uEnergyIdentityStyling > 0.5 && uPowderBodyDepth > 0.5');
    expect(block).toContain('uPowderStyle > 1.5 && !materialEmissive');
    expect(block).toContain('smoothstep(224.0 / 255.0, 1.0, boundaryStability)');
    expect(block).toContain('smoothstep(0.66, 0.94, widePowderShape.x)');
    expect(block).toContain('smoothstep(5.5, 8.5, widePowderShape.w)');
    expect(block).toContain('surfaceOnly < 0.5 && halo < 0.5 && wall < 0.5');
    expect(block).not.toContain('texture(');
    expect(block).not.toContain('uTime');
    expect(block).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('gives true-8x rigid contours bounded Hermite curvature without new samples', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const helperStart = eight.indexOf('float solidEightXCurvatureGain(');
    const helperEnd = eight.indexOf('vec3 solidEightXBodyKey', helperStart);
    const blockStart = eight.indexOf('// Derive an intrinsic contour curvature', helperEnd);
    const blockEnd = eight.indexOf('    bool deepSolidBody =', blockStart);
    const helper = eight.slice(helperStart, helperEnd);
    const block = eight.slice(blockStart, blockEnd);

    expect(eightStart).toBeGreaterThan(0);
    expect(eightEnd).toBeGreaterThan(eightStart);
    expect(helperStart).toBeGreaterThan(0);
    expect(helperEnd).toBeGreaterThan(helperStart);
    expect(blockStart).toBeGreaterThan(helperEnd);
    expect(blockEnd).toBeGreaterThan(blockStart);
    expect(eight).toContain('uniform float uSolidCurvatureDepth;');
    expect(helper).toContain('if (solidEightXGranular(optics)) return 0.0;');
    expect(helper).toContain('if (optics == 8.0 || optics == 19.0) return 1.25;');
    expect(block).toContain('uSolidCurvatureDepth > 0.5 && !materialEmissive');
    expect(block).toContain('vec2 hermite = blend * blend * (3.0 - 2.0 * blend);');
    expect(block).toContain('vec2 hermiteSlope = 6.0 * blend * (1.0 - blend);');
    expect(block).toContain('vec2 hermiteCurve = 6.0 - 12.0 * blend;');
    expect(block).toContain('contourDxx * contourDy * contourDy');
    expect(block).toContain('- 2.0 * contourDx * contourDy * contourDxy');
    expect(block).toContain('+ contourDyy * contourDx * contourDx');
    expect(block).toContain('color *= 1.0 + curvatureResponse;');
    expect(block).not.toContain('texture(');
    expect(block).not.toMatch(/\balpha\s*[+*]?=/);
    expect(block).not.toMatch(/\b(?:pow|normalize)\s*\(/);
  });

  it('restores true-8x translucent rigid alpha, environment shell, and field transmission without a new sample', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const start = eight.indexOf('// TranslucentRigid is the intentional presentation-alpha exception.');
    const end = eight.indexOf('// Compact Device bodies retain', start);
    const alphaStart = eight.indexOf('  float alpha = family == 1.0', start);
    const alphaEnd = eight.indexOf('  if (material == 114.0)', alphaStart);
    const block = eight.slice(start, end);
    const alpha = eight.slice(alphaStart, alphaEnd);

    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(alphaStart).toBeGreaterThan(end);
    expect(alphaEnd).toBeGreaterThan(alphaStart);
    expect(eight).toContain('uniform float uTranslucentFieldTransmission;');
    expect(eight).toContain('uniform float uTranslucentLensShell;');
    expect(block).toContain('family == 0.0 && optics == 12.0 && traits < 0.5 && !materialEmissive');
    expect(block).toContain('q00 * q10 * q01 * q11');
    expect(block).toContain('uTranslucentLensShell > 0.5');
    expect(block).toContain('vec3 crystalNormal = vec3(-translucentSlope * 0.76, 1.0);');
    expect(block).toContain('crystalSpecular *= crystalSpecular;');
    expect(block).toContain('float crystalFresnel = 1.0 - crystalNormal.z;');
    expect(block).toContain('vec3 crystalEnvironment = mix(');
    for (const material of [12, 24, 68, 74, 76, 77]) {
      expect(block).toContain(`material == ${material}.0`);
    }
    expect(block).toContain('float crystalCoreAbsorption = 0.010;');
    expect(block).toContain('float crystalRimGain = 1.0;');
    expect(block).toContain('float crystalEnvironmentGain = 0.045;');
    expect(block).toContain('float glassVolume = smoothstep(6.0 / 255.0, 42.0 / 255.0, depth)');
    expect(block).toContain('color *= vec3(1.0) - vec3(0.080, 0.035, 0.010) * glassVolume;');
    expect(block).toContain('color *= mix(1.0, 0.81, glassVolume);');
    expect(block).toContain('float glassPhase = fract((floor(grid.x) * 2.0 + floor(grid.y) * 3.0');
    expect(block).toContain('+ material * 0.17) / 96.0);');
    expect(block).toContain('float glassCrown = smoothstep(0.62, 0.94, glassLobe);');
    expect(block).toContain('float glassPocket = 1.0 - smoothstep(0.20, 0.50, glassLobe);');
    expect(block).toContain('color *= 1.0 - translucentDepth * crystalCoreAbsorption;');
    expect(block).toContain('shellRim * crystalRimGain');
    expect(block).toContain('* crystalEnvironmentGain;');
    expect(block).toContain('uTranslucentFieldTransmission > 0.5');
    expect(block).toContain('emission.rgb * transmissionTint * transmittedReach * transmittedWeight');
    expect(block).not.toContain('texture(');
    expect(block).not.toMatch(/\balpha\s*[+*]?=/);
    expect(block).not.toMatch(/\b(?:pow|normalize)\s*\(/);
    expect(alpha).toContain('float translucentAlpha = (material == 12.0 || material == 24.0)');
    expect(alpha).toContain('alpha *= translucentAlpha;');
  });

  it('gates true-8x liquid neighbour probes to ordinary liquid bodies', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const start = eight.indexOf('if (family == 2.0 && optics != 4.0) {');
    const end = eight.indexOf('// The shared suspension field is powder-authored', start);
    const block = eight.slice(start, end);

    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(block).toContain('float liquidMaterialLeft = materialAt(');
    expect(block).toContain('float liquidSameLeft = 1.0 - step(0.5, abs(liquidMaterialLeft - material));');
    expect(block).toContain('float liquidCore = liquidSameLeft * liquidSameRight * liquidSameTop * liquidSameBottom;');
    expect(block).toContain('texture(uLiquidTexture, uv - vec2(uTexel.x, 0.0))');
    expect(block).toContain('float liquidSpeciesDifference = max(');
    expect(block).toContain('if (material == 2.0 && optics == 1.0 && traits < 0.5 && !materialEmissive');
    expect(block).toContain('density > 0.72 && liquidSpeciesDifference < 0.035');
    expect(block).toContain('color *= 0.74;');
    expect(block).toContain('if (material == 8.0 && optics == 2.0 && traits < 0.5 && !materialEmissive');
    expect(block).toContain('color *= 0.50;');
    expect(eight.slice(0, start)).not.toContain('float liquidMaterialLeft = materialAt(');
    expect(eight.slice(0, start)).not.toContain('float liquidSpeciesDifference = max(');
    // Empty-space reconstruction still needs exactly the one centre field read.
    expect(eight.match(/texture\(uLiquidTexture, uv\)/g)).toHaveLength(1);
  });

  it('restores true-8x liquid-air cohesion with an alpha-only trim and no extra samples', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const start = eight.indexOf('// The normal WebGL path reduces only an ordinary, connected liquid-air');
    const end = eight.indexOf('    if (liquidCore > 0.5', start);
    const block = eight.slice(start, end);
    const alphaStart = eight.indexOf('  float alpha = family == 1.0');
    const alphaEnd = eight.indexOf('  vec4 foreground =', alphaStart);
    const alpha = eight.slice(alphaStart, alphaEnd);
    const packedStart = eight.indexOf('  bool needsPackedState =');
    const packedEnd = eight.indexOf('  float sourceTarget =', packedStart);
    const packed = eight.slice(packedStart, packedEnd);

    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(eight).toContain('uniform float uLiquidSilhouetteCohesion;');
    expect(eight).toContain('float liquidCohesionAlphaScale = 1.0;');
    expect(eight).toContain('bool nativeWallForLiquidCohesion = uNativeWallsActive > 0.5');
    expect(block).toContain('float liquidForeignContact = max(');
    expect(block).toContain('adjacentLiquidSupport * exposedLiquidSide * 0.65');
    expect(block).toContain('min(liquid.a, liquidNeighbourMean) * 0.45');
    expect(block).toContain('clamp(liquidSilhouetteDensity / max(density, 0.001), 0.0, 1.0)');
    expect(block).not.toContain('texture(');
    expect(packed).toContain('|| nativeWallForLiquidCohesion || nativeWallForLiquidSurfaceContour;');
    expect(alpha).toContain('uNativeWallsActive < 0.5 || nativeWall < 0.5');
    expect(alpha).toContain('alpha *= liquidCohesionAlphaScale;');
    expect(eight.match(/texture\(uLiquidTexture, uv - vec2\(uTexel\.x, 0\.0\)\)/g)).toHaveLength(1);
    expect(eight.match(/texture\(uLiquidTexture, uv \+ vec2\(uTexel\.x, 0\.0\)\)/g)).toHaveLength(1);
    // Empty-wall, packed-state, and translucent-backdrop composition retain
    // their three guarded reads; settled Smooth powder additionally reuses the
    // packed exterior-air G byte to reject authored internal holes.
    expect(eight).toContain('uPowderSurfaceActive > 0.5');
    expect(eight).toContain('wallState.g > 0.5');
    expect(eight.match(/texture\(uWallTexture, uv\)/g)).toHaveLength(4);
  });

  it('restores true-8x wet-sediment cohesion with one guarded RGB-only field sample', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const start = eight.indexOf('// The shared suspension field is powder-authored');
    const end = eight.indexOf('// A few exact TPT projections', start);
    const block = eight.slice(start, end);

    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(eight).toContain('uniform sampler2D uSuspensionTexture;');
    expect(eight).toContain('uniform float uSuspensionActive;');
    expect(block).toContain('uSuspensionActive > 0.5 && uPowderStyle > 1.5');
    expect(block).toContain('family == 4.0 && solidEightXGranular(optics)');
    expect(block).toContain('family == 2.0 && optics == 1.0');
    expect(block.match(/texture\(uSuspensionTexture, uv\)/g)).toHaveLength(1);
    expect(block).toContain('float suspensionSemanticBody = smoothstep(0.62, 0.90, density);');
    expect(block).toContain('float suspensionFieldBody = smoothstep(0.24, 0.68, suspensionState.a);');
    expect(block).toContain('float suspensionBody = max(suspensionSemanticBody, suspensionFieldBody);');
    expect(block).toContain('mix(0.44, 0.52, sedimentCompaction)');
    expect(block).toContain('clamp(currentLuma - wetLuma, -4.0 / 255.0, 4.0 / 255.0)');
    expect(block).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('keeps native walls separate and composited in the direct true-8x mesh', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const emptyStart = eight.indexOf('if (material < 0.5) {');
    const emptyEnd = eight.indexOf('  vec4 style = texture(uStyleTexture', emptyStart);
    const empty = eight.slice(emptyStart, emptyEnd);
    const finalStart = eight.lastIndexOf('  vec4 foreground = vec4(clamp(color');
    const final = eight.slice(finalStart);

    expect(eight).toContain('uniform sampler2D uWallTexture;');
    expect(eight).toContain('uniform float uNativeWallsActive;');
    expect(eight).toContain('vec3 wallEightXColor(float wall)');
    expect(eight).toContain('vec4 compositeEightXWallBackdrop');
    expect(empty).toContain('if (uNativeWallsActive > 0.5)');
    expect(empty).toContain('texture(uWallTexture, uv)');
    expect(empty).toContain('compositeEightXWallBackdrop(\n        foreground, wall, uv * uFieldSize, 0.0, vec2(0.0)\n      )');
    expect(finalStart).toBeGreaterThan(0);
    expect(final).toContain('uNativeWallsActive > 0.5 && alpha < 0.999');
    expect(final).toContain('texture(uWallTexture, uv)');
    expect(final).toContain('compositeEightXWallBackdrop(\n      foreground, nativeWall, uv * uFieldSize, refractedMaterial, refractedBoundarySlope\n    )');
    expect(eight).not.toContain('wallAt(');
    expect(source).toContain('private nativeWallsActive = false;');
    expect(source).toContain('!this.nativeWallsHydrated || wallRectangles.length');
    expect(source).toContain('uNativeWallsActive = this.nativeWallsActive ? 1 : 0');
  });

  it('restores exact Glass/Ice native-wall refraction at true 8x without a new sample', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const helperStart = eight.indexOf('float refractedEightXWallPattern(');
    const helperEnd = eight.indexOf('vec4 compositeEightXWallBackdrop(', helperStart);
    const helper = eight.slice(helperStart, helperEnd);
    const finalStart = eight.lastIndexOf('  if (uNativeWallsActive > 0.5 && alpha < 0.999) {');
    const final = eight.slice(finalStart);

    expect(helperStart).toBeGreaterThan(0);
    expect(helperEnd).toBeGreaterThan(helperStart);
    expect(finalStart).toBeGreaterThan(0);
    expect(eight).toContain('uniform float uTranslucentBackdropRefraction;');
    expect(helper).toContain('if (material == 24.0)');
    expect(helper).toContain('wallEightXPattern(wall, cell + sign(boundarySlope) * 3.0 * hasBoundary)');
    expect(helper).toContain('wallEightXPattern(wall, cell + offset) * 0.68');
    expect(helper).not.toContain('texture(');
    expect(final).toContain('float exactRefractor = material == 12.0 || material == 24.0 ? 1.0 : 0.0;');
    expect(final).toContain('uTranslucentBackdropRefraction * exactRefractor');
    expect(final).toContain('step(0.5, nativeWall) * material;');
    expect(final).toContain('refractedBoundarySlope');
    expect(final).not.toMatch(/\balpha\s*[+*]?=/);
    expect(eight.match(/texture\(uWallTexture, uv\)/g)).toHaveLength(4);
  });

  it('reuses true-8x liquid field samples for bounded RGB-only connected meniscus lighting', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const start = eight.indexOf('// The compact renderer already owns these exact four field samples');
    const end = eight.indexOf('  // The shared suspension field is powder-authored', start);
    const block = eight.slice(start, end);

    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(eight).toContain('uniform float uLiquidFieldLighting;');
    expect(block).toContain('bool connectedBodyLiquid = optics == 1.0 || optics == 2.0 || optics == 3.0');
    expect(block).toContain('|| optics == 16.0 || optics == 17.0 || optics == 18.0;');
    expect(block).toContain('uLiquidFieldLighting > 0.5 && liquidSpeciesDifference < 0.035');
    expect(block).toContain('|| uSurfaceContourLighting > 0.5)');
    expect(block).toContain('&& connectedBodyLiquid && traits < 0.5 && !materialEmissive');
    expect(block).toContain('&& liquidSpeciesDifference < 0.035');
    expect(block).toContain('liquidLeft.a + liquidRight.a + liquidTop.a + liquidBottom.a');
    expect(block).toContain('liquidEightXMeniscusKey(optics)');
    expect(block).toContain('liquidEightXMeniscusShadow(optics)');
    expect(block).toContain('if (uAqueousSurfaceReflection > 0.5 && optics == 1.0) {');
    expect(block).toContain('float aqueousTopReflection = max(0.0, liquidSlope.y) * airFacingRim');
    expect(block).toContain('* meniscusKey * aqueousTopReflection;');
    expect(eight).toContain('if (optics == 16.0) return vec3(0.70, 0.92, 1.00); // Cryogenic');
    expect(eight).toContain('if (optics == 17.0) return vec3(1.00, 0.98, 0.94); // Metallic');
    expect(eight).toContain('return vec3(0.82, 0.92, 1.00); // Viscous');
    expect(block).not.toContain('texture(');
    expect(block).not.toContain('uTime');
    expect(block).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('restores true-8x exposed-liquid emission reflection through existing light and wall state', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const liquidStart = eight.indexOf('  float liquidCohesionAlphaScale = 1.0;');
    const reflectionStart = eight.indexOf('// Normal WebGL reflects the shared compact emission field', liquidStart);
    const reflectionEnd = eight.indexOf('      }\n      // Normal WebGL\'s Surface control', reflectionStart);
    const packedStart = eight.indexOf('  bool needsPackedState =');
    const packedEnd = eight.indexOf('  if (uSourceTargetStyling > 0.5', packedStart);
    const reflection = eight.slice(reflectionStart, reflectionEnd);
    const packed = eight.slice(packedStart, packedEnd);

    expect(reflectionStart).toBeGreaterThan(liquidStart);
    expect(reflectionEnd).toBeGreaterThan(reflectionStart);
    expect(eight).toContain('float liquidEmissionReflectionStrength = 0.0;');
    expect(reflection).toContain('uSurfaceContourLighting > 0.5 && liquidForeignContact < 0.5');
    expect(reflection).toContain('density > 0.08 && density < 0.92 && emission.a > 0.002');
    expect(reflection).toContain('float liquidAirLeft = 1.0 - step(0.5, liquidMaterialLeft);');
    expect(reflection).toContain('float validatedLiquidAir = max(');
    expect(reflection).toContain('smoothstep(0.16, 0.66, liquidLeft.a)');
    expect(reflection).toContain('liquidEmissionReflectionStrength = emissionReach * validatedLiquidAir * airFacingRim');
    expect(reflection).not.toContain('texture(');
    expect(reflection).not.toContain('uTime');
    expect(reflection).not.toMatch(/\balpha\s*[+*]?=/);
    expect(packed).toContain('liquidEmissionReflectionStrength > 0.0001');
    expect(packed).toContain('* emission.rgb * liquidEmissionReflectionStrength');
    expect(packed).toContain('uNativeWallsActive < 0.5 || nativeWall < 0.5');
    expect(eight.match(/texture\(uWallTexture, uv\)/g)).toHaveLength(4);
  });

  it('keeps true-8x Device bodies arithmetic-only and RGB-only', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const start = eight.indexOf('// Compact Device bodies retain');
    const end = eight.indexOf('// The centre liquid field remains live', start);
    const block = eight.slice(start, end);

    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(block).toContain('family == 0.0 && optics == 10.0');
    expect(block).toContain('float bus =');
    expect(block).toContain('float terminal =');
    expect(block).toContain('vec3(3.0, 8.0, 11.0)');
    expect(block).not.toContain('texture(');
    expect(block).not.toContain('uTime');
    expect(block).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('keeps true-8x ACEL/DCEL activity RGB-only and reuses packed state', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const start = eight.indexOf('// ACEL/DCEL retain their native active bit');
    const end = eight.indexOf('  if (uVibrStateStyling > 0.5', start);
    const block = eight.slice(start, end);

    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(eight).toContain('uniform float uForceActivityStyling;');
    expect(eight).toContain('bool forceOwner = material == 115.0 || material == 116.0;');
    expect(block).toContain('uForceActivityStyling > 0.5 && forceOwner');
    expect(block).toContain('mod(floor(sourceTarget), 2.0) >= 0.5');
    expect(block).toContain('vec3(16.0, 11.0, -4.0) / 255.0');
    expect(block).toContain('vec3(3.0, 10.0, 16.0) / 255.0');
    expect(block).not.toContain('texture(');
    expect(block).not.toMatch(/\balpha\s*[+*]?=/);
    expect(block).not.toContain('uTime');
  });

  it('restores exact radioactive body identities at true 8x without new resources', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const helperStart = eight.indexOf('vec3 radioactiveBodyIdentityEightXDelta(');
    const helperEnd = eight.indexOf('bool solidEightXGranular(', helperStart);
    const helper = eight.slice(helperStart, helperEnd);
    const start = eight.indexOf('// The direct mesh skips normal-WebGL\'s general radioactive branch at 8x.');
    const end = eight.indexOf('  if (uVibrStateStyling > 0.5', start);
    const block = eight.slice(start, end);

    expect(helperStart).toBeGreaterThan(0);
    expect(helperEnd).toBeGreaterThan(helperStart);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(eight).toContain('bool radioactiveIdentityOwner = material == 99.0 || material == 105.0 || material == 108.0');
    expect(eight).toContain('uniform float uEnergyIdentityStyling;');
    expect(block).toContain('uEnergyIdentityStyling > 0.5 && radioactiveIdentityOwner');
    expect(block).toContain('radioactiveBodyIdentityEightXDelta(material, uv * uFieldSize)');
    for (const material of ['99.0', '105.0', '108.0', '109.0', '111.0', '112.0', '113.0']) {
      expect(helper).toContain(`material == ${material}`);
    }
    expect(helper).not.toContain('texture(');
    expect(helper).not.toContain('uTime');
    expect(block).not.toContain('texture(');
    expect(block).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('takes one exact-owner-gated packed-state sample at true 8x', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const start = eight.indexOf('bool sourceOwner =');
    const end = eight.indexOf('  if (uSourceTargetStyling > 0.5 && sourceOwner', start);
    const block = eight.slice(start, end);

    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(block).toContain('bool forceOwner = material == 115.0 || material == 116.0;');
    expect(block).toContain('bool vibrOwner = material == 99.0 || material == 113.0;');
    expect(block).toContain('bool deutOwner = material == 100.0;');
    expect(block).toContain('bool lavaAncestryOwner = material == 11.0 && family == 2.0 && !materialEmissive;');
    expect(block).toContain('bool botanicalLifecycleOwner = material == 50.0 || material == 10.0;');
    expect(block).toContain('bool needsPackedState =');
    expect(block).toContain('uForceActivityStyling > 0.5 && forceOwner');
    expect(block).toContain('uBotanicalLifecycleStyling > 0.5 && botanicalLifecycleOwner');
    expect(block).toContain('vec4 packedState = texture(uWallTexture, uv);');
    expect(block.match(/texture\(uWallTexture, uv\)/g)).toHaveLength(1);
    // Native-wall composition owns two additional guarded samples in the
    // direct shader; exact-owner state decoding itself still consumes one.
    expect(block).toContain('float sourceTarget = 0.0;');
    expect(block).toContain('float nativeWall = 0.0;');
  });

  it('restores native Lava ancestry at true 8x through the shared state word only', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const helperStart = eight.indexOf('float lavaAncestryEightXFamily(');
    const helperEnd = eight.indexOf('bool solidEightXGranular(', helperStart);
    const helper = eight.slice(helperStart, helperEnd);
    const start = eight.indexOf('// Native Lava ancestry is visible only on its exact liquid owner.');
    const end = eight.indexOf('  // True 8x keeps botanical state', start);
    const block = eight.slice(start, end);

    expect(helperStart).toBeGreaterThan(0);
    expect(helperEnd).toBeGreaterThan(helperStart);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(eight).toContain('uniform float uLavaAncestryStyling;');
    expect(eight).toContain('uLavaAncestryStyling > 0.5 && lavaAncestryOwner');
    expect(helper).toContain('mod(floor(packedState / 256.0), 2.0) < 0.5');
    expect(helper).toContain('float origin = mod(packedState, 256.0);');
    expect(helper).toContain('lavaAncestryEightXFamily(origin)');
    expect(helper).not.toContain('texture(');
    expect(block).toContain('nativeWall < 0.5');
    expect(block).toContain('lavaAncestryEightXDelta(sourceTarget, uv * uFieldSize)');
    expect(block).not.toMatch(/\balpha\s*[+*]?=/);
    expect(block).not.toContain('texture(');
  });

  it('keeps true-8x botanical identity and native lifecycle state RGB-only and resource-free', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const start = eight.indexOf('// True 8x keeps botanical state on the existing packed B/A word.');
    const end = eight.indexOf('  float alpha = family == 1.0', start);
    const block = eight.slice(start, end);

    expect(eightStart).toBeGreaterThan(0);
    expect(eightEnd).toBeGreaterThan(eightStart);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(eight).toContain('uniform float uBotanicalIdentityStyling;');
    expect(eight).toContain('uniform float uBotanicalLifecycleStyling;');
    expect(block).toContain('uBotanicalIdentityStyling > 0.5 || uBotanicalLifecycleStyling > 0.5');
    expect(block).toContain('material == 9.0');
    expect(block).toContain('material == 10.0');
    expect(block).toContain('material == 50.0');
    expect(block).toContain('material == 52.0');
    expect(block).toContain('material == 83.0');
    expect(block).toContain('material == 50.0 && sourceTarget > 0.5');
    expect(block).toContain('material == 10.0 && sourceTarget >= 32768.0');
    expect(block).toContain('mod(sourceTarget, 2.0) >= 0.5');
    expect(block).toContain('float paletteIndex = cyan * 4.0 + magenta * 2.0 + yellow;');
    expect(block).not.toContain('texture(');
    expect(block).not.toContain('uWallTexture');
    expect(block).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('keeps true-8x premultiplied output independent of semantic texture alpha mode', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    expect(source).toContain('uFieldTexture: this.fieldSource');
    expect(source).toContain('new Mesh({ geometry, shader, texture: Texture.WHITE })');
    expect(source).not.toContain('new Mesh({ geometry, shader, texture: fieldTexture })');
    expect(source).toContain('vec3 premultiplied = clamp(color, 0.0, 1.35) * alpha;');
  });

  it('initializes every direct-8x mesh source before its first semantic upload', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const directMeshStart = source.indexOf('if (outputScale === 8)');
    const directMeshEnd = source.indexOf('} else {', directMeshStart);
    const directMesh = source.slice(directMeshStart, directMeshEnd);

    expect(directMeshStart).toBeGreaterThan(0);
    expect(directMeshEnd).toBeGreaterThan(directMeshStart);
    expect(source).toContain('vFieldCoord = aUV;');
    for (const textureSource of [
      'this.fieldSource', 'this.wallSource', 'this.photonStateSource',
      'this.atmosphereSource', 'this.atmosphereStyleSource', 'gasIdentityMotifSource',
      'this.emissionSource', 'this.liquidSource', 'this.boundaryStabilitySource',
      'this.powderSurfaceSource', 'this.suspensionSource',
      'paletteTexture.source', 'styleTexture.source',
    ]) expect(directMesh).toContain(textureSource);
    expect(directMesh).toContain('textureSystem.texture?.initSource(source)');
    expect(directMesh).toContain('fragment: FIELD_EIGHT_X_FRAGMENT');
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

  it('restores the global surface-contour control at true 8x without changing support', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const helperStart = eight.indexOf('vec3 applySurfaceContourEightX(');
    const helperEnd = eight.indexOf('void main()', helperStart);
    const helper = eight.slice(helperStart, helperEnd);
    const powderStart = eight.indexOf('// Smooth, supported powder retains a coloured stable edge.');
    const powderEnd = eight.indexOf('  // Deep rigid bodies reuse', powderStart);
    const powder = eight.slice(powderStart, powderEnd);
    const solidStart = eight.indexOf('// Restore the global family-coloured surface-contour control');
    const solidEnd = eight.indexOf('    // Derive an intrinsic contour curvature', solidStart);
    const solid = eight.slice(solidStart, solidEnd);

    expect(helperStart).toBeGreaterThan(0);
    expect(helperEnd).toBeGreaterThan(helperStart);
    expect(eight).toContain('uniform float uSurfaceContourLighting;');
    expect(powder).toContain('smoothstep(1.0, 2.0, q00 + q10 + q01 + q11)');
    expect(powder).toContain('uSurfaceContourLighting > 0.5 && uPowderStyle > 1.5');
    expect(powder).toContain('applySurfaceContourEightX(color, density, powderSlope, optics, 1.0, 0.0)');
    expect(solid).toContain('color, density, solidSurfaceSlope, optics, 0.0, solidAirFacing');
    expect(`${helper}${powder}${solid}`).not.toContain('texture(');
    expect(`${helper}${powder}${solid}`).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('adds a bounded true-8x solid shell cue from the four live semantic owners', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const helperStart = eight.indexOf('float solidEightXShellSpecularGain');
    const helperEnd = eight.indexOf('void main()', helperStart);
    const helper = eight.slice(helperStart, helperEnd);
    const ownerStart = eight.indexOf('  float material00 = materialAt(origin);');
    const ownerEnd = eight.indexOf('  float density =', ownerStart);
    const owners = eight.slice(ownerStart, ownerEnd);
    const solidStart = eight.indexOf('// Restore the global family-coloured surface-contour control');
    const solidEnd = eight.indexOf('    // Derive an intrinsic contour curvature', solidStart);
    const solid = eight.slice(solidStart, solidEnd);

    expect(helperStart).toBeGreaterThan(0);
    expect(ownerStart).toBeGreaterThan(0);
    expect(solidStart).toBeGreaterThan(0);
    expect(helper).toContain('float solidEightXShellSpecularGain(float optics)');
    expect(helper).toContain('powder < 0.5 && solidAirFacing > 0.5');
    expect(helper).toContain('vec3 shellNormal = vec3(-slope * 0.72, 1.0);');
    expect(helper).toContain('specular *= specular;');
    expect(helper).toContain('float fresnel = 1.0 - shellNormal.z;');
    for (const suffix of ['00', '10', '01', '11']) {
      expect(owners).toContain(`float material${suffix} = materialAt(`);
      expect(owners).toContain(`1.0 - step(0.5, material${suffix})`);
    }
    expect(owners).toContain('float solidAirFacing = max(');
    expect(solid).toContain('solidSurfaceSlope, optics, 0.0, solidAirFacing');
    expect(`${helper}${owners}${solid}`).not.toMatch(/\balpha\s*[+*]?=/);
    expect(`${helper}${owners}${solid}`).not.toContain('uTime');
  });

  it('restores true-8x liquid Surface contours through the existing wall-state read only', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const liquidStart = eight.indexOf('  float liquidCohesionAlphaScale = 1.0;');
    const liquidEnd = eight.indexOf('  // The shared suspension field is powder-authored', liquidStart);
    const liquid = eight.slice(liquidStart, liquidEnd);
    const packedStart = eight.indexOf('  bool needsPackedState =');
    const packedEnd = eight.indexOf('  if (uSourceTargetStyling > 0.5', packedStart);
    const packed = eight.slice(packedStart, packedEnd);

    expect(liquidStart).toBeGreaterThan(0);
    expect(liquidEnd).toBeGreaterThan(liquidStart);
    expect(liquid).toContain('float liquidSurfaceContourKeyStrength = 0.0;');
    expect(liquid).toContain('float liquidSurfaceContourShadowStrength = 0.0;');
    expect(liquid).toContain('bool nativeWallForLiquidSurfaceContour = uNativeWallsActive > 0.5');
    expect(liquid).toContain('uSurfaceContourLighting > 0.5 && liquidForeignContact < 0.5');
    expect(liquid).toContain('vec2 liquidSemanticSlope = vec2(');
    expect(liquid).toContain('float liquidSemanticContour = smoothstep(0.05, 0.31, semanticDensity)');
    expect(liquid).toContain('float liquidSemanticSupport = smoothstep(1.5, 3.0, q00 + q10 + q01 + q11);');
    expect(liquid).toContain('max(liquidSurfaceRim, liquidSemanticContour * liquidSemanticSupport)');
    expect(liquid).toContain('float liquidSurfaceConnected = smoothstep(1.5, 3.0, liquidSupportCount)');
    expect(liquid).toContain('smoothstep(0.20, 0.78, liquid.a)');
    expect(liquid).toContain('float liquidSurfaceRim = (1.0 - smoothstep(0.38, 0.88, liquidNeighbourMean))');
    expect(liquid).toContain('liquidSurfaceContourKeyStrength = liquidContourShell');
    expect(liquid).toContain('liquidSurfaceContourShadowStrength = liquidContourShell');
    expect(liquid.match(/texture\(uLiquidTexture, uv [-+] vec2\(/g)).toHaveLength(4);
    expect(liquid).not.toMatch(/\balpha\s*[+*]?=/);
    expect(packed).toContain('|| nativeWallForLiquidCohesion || nativeWallForLiquidSurfaceContour;');
    expect(packed).toContain('uNativeWallsActive < 0.5 || nativeWall < 0.5');
    expect(packed).toContain('liquidContourKey * liquidSurfaceContourKeyStrength');
    expect(packed).toContain('liquidContourShadow * liquidSurfaceContourShadowStrength');
    expect(eight.match(/texture\(uWallTexture, uv\)/g)).toHaveLength(4);
    expect(eight).toContain('float semanticDensity = density;');
  });

  it('restores true-8x SPRK host and life styling through the existing packed-state read', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const helperStart = eight.indexOf('float sparkEightXHostFamily(');
    const helperEnd = eight.indexOf('bool solidEightXGranular(', helperStart);
    const helper = eight.slice(helperStart, helperEnd);
    const packedStart = eight.indexOf('  bool needsPackedState =');
    const packedEnd = eight.indexOf('  float sourceTarget =', packedStart);
    const packed = eight.slice(packedStart, packedEnd);
    const applicationStart = eight.indexOf('  if (uSparkStateStyling > 0.5 && sparkOwner) {');
    const applicationEnd = eight.indexOf('  // True 8x keeps botanical state', applicationStart);
    const application = eight.slice(applicationStart, applicationEnd);

    expect(helperStart).toBeGreaterThan(0);
    expect(helperEnd).toBeGreaterThan(helperStart);
    expect(applicationStart).toBeGreaterThan(0);
    expect(applicationEnd).toBeGreaterThan(applicationStart);
    expect(eight).toContain('uniform float uSparkStateStyling;');
    expect(eight).toContain('bool sparkOwner = material == 148.0;');
    expect(packed).toContain('|| (uSparkStateStyling > 0.5 && sparkOwner)');
    expect(helper).toContain('if (packedState < 32768.0) return vec3(0.0);');
    expect(helper).toContain('float host = mod(packedState, 256.0);');
    expect(helper).toContain('mod(floor(packedState / 256.0), 128.0)');
    expect(helper).toContain('float sparkEightXHostFamily(float host)');
    expect(helper).toContain('vec3 sparkStateEightXDelta(float packedState, vec2 position, vec3 sourceColor)');
    expect(application).toContain('color += sparkStateEightXDelta(sourceTarget, uv * uFieldSize, color);');
    expect(helper).not.toContain('texture(');
    expect(helper).not.toContain('uTime');
    expect(helper).not.toMatch(/\balpha\s*[+*]?=/);
    expect(eight.match(/texture\(uWallTexture, uv\)/g)).toHaveLength(4);
  });

  it('restores true-8x POLO lifecycle styling through the existing packed-state read', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const helperStart = eight.indexOf('vec3 poloStateEightXDelta(');
    const helperEnd = eight.indexOf('bool solidEightXGranular(', helperStart);
    const helper = eight.slice(helperStart, helperEnd);
    const packedStart = eight.indexOf('  bool needsPackedState =');
    const packedEnd = eight.indexOf('  float sourceTarget =', packedStart);
    const packed = eight.slice(packedStart, packedEnd);
    const applicationStart = eight.indexOf('  if (uPoloStateStyling > 0.5 && poloOwner) {');
    const applicationEnd = eight.indexOf('  // True 8x keeps botanical state', applicationStart);
    const application = eight.slice(applicationStart, applicationEnd);

    expect(helperStart).toBeGreaterThan(0);
    expect(helperEnd).toBeGreaterThan(helperStart);
    expect(applicationStart).toBeGreaterThan(0);
    expect(applicationEnd).toBeGreaterThan(applicationStart);
    expect(eight).toContain('uniform float uPoloStateStyling;');
    expect(eight).toContain('bool poloOwner = material == 109.0;');
    expect(packed).toContain('|| (uPoloStateStyling > 0.5 && poloOwner)');
    expect(helper).toContain('mod(floor(packedState / 2048.0), 2.0) < 0.5');
    expect(helper).toContain('float emissions = mod(packedState, 8.0);');
    expect(helper).toContain('mod(floor(packedState / 8.0), 16.0)');
    expect(helper).toContain('mod(floor(packedState / 128.0), 16.0)');
    expect(helper).toContain('return clamp(delta, vec3(-16.0), vec3(16.0)) / 255.0;');
    expect(application).toContain('color += poloStateEightXDelta(sourceTarget, uv * uFieldSize);');
    expect(helper).not.toContain('texture(');
    expect(helper).not.toContain('uTime');
    expect(helper).not.toMatch(/\balpha\s*[+*]?=/);
    expect(eight.match(/texture\(uWallTexture, uv\)/g)).toHaveLength(4);
  });

  it('restores true-8x SPNG and GEL hydration through one packed-state read', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const helperStart = eight.indexOf('vec3 hydrationStateEightXDelta(');
    const helperEnd = eight.indexOf('bool solidEightXGranular(', helperStart);
    const helper = eight.slice(helperStart, helperEnd);
    const packedStart = eight.indexOf('  bool needsPackedState =');
    const packedEnd = eight.indexOf('  float sourceTarget =', packedStart);
    const packed = eight.slice(packedStart, packedEnd);
    const applicationStart = eight.indexOf('  if ((uSpngStateStyling > 0.5 && spngOwner)');
    const applicationEnd = eight.indexOf('  // True 8x keeps botanical state', applicationStart);
    const application = eight.slice(applicationStart, applicationEnd);

    expect(helperStart).toBeGreaterThan(0);
    expect(helperEnd).toBeGreaterThan(helperStart);
    expect(applicationStart).toBeGreaterThan(0);
    expect(applicationEnd).toBeGreaterThan(applicationStart);
    expect(eight).toContain('uniform float uSpngStateStyling;');
    expect(eight).toContain('uniform float uGelHydrationStyling;');
    expect(eight).toContain('uniform float uQuartzCrystalStateStyling;');
    expect(eight).toContain('bool spngOwner = material == 81.0;');
    expect(eight).toContain('bool gelOwner = material == 56.0;');
    expect(eight).toContain('bool quartzCrystalOwner = material == 29.0 || material == 76.0;');
    expect(packed).toContain('|| (uSpngStateStyling > 0.5 && spngOwner)');
    expect(packed).toContain('|| (uGelHydrationStyling > 0.5 && gelOwner)');
    expect(packed).toContain('|| (uQuartzCrystalStateStyling > 0.5 && quartzCrystalOwner)');
    expect(helper).toContain('mod(floor(packedState / 64.0), 2.0) < 0.5');
    expect(helper).toContain('float hydration = min(50.0, mod(packedState, 64.0));');
    expect(helper).toContain('if (hydration < 0.5) return vec3(0.0);');
    expect(helper).toContain('float soakedCore = smoothstep(0.45, 1.0, moisture);');
    expect(helper).toContain('delta += vec3(-9.0, -6.0, -2.0) * soakedCore;');
    expect(helper).toContain('return clamp(delta * moisture, vec3(-28.0), vec3(20.0)) / 255.0;');
    expect(helper).toContain('if (material == 56.0) {');
    expect(helper).toContain('float hydration = min(100.0, mod(packedState, 128.0));');
    expect(helper).toContain('return clamp(delta, vec3(-124.0), vec3(124.0)) / 255.0;');
    expect(application).toContain('color += hydrationStateEightXDelta(material, sourceTarget, uv * uFieldSize);');
    expect(eight).toContain('vec3 quartzCrystalStateEightXDelta(float material, float packedState)');
    expect(eight).toContain('color += quartzCrystalStateEightXDelta(material, sourceTarget);');
    expect(helper).not.toContain('texture(');
    expect(helper).not.toContain('uTime');
    expect(helper).not.toMatch(/\balpha\s*[+*]?=/);
    expect(eight.match(/texture\(uWallTexture, uv\)/g)).toHaveLength(4);
  });

  it('projects native FILT spectrum through the existing packed state in both WebGL compositors', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `', eightEnd);
    const normalEnd = source.indexOf('`;\n\n/** Primary WebGL presentation', normalStart);
    const normal = source.slice(normalStart, normalEnd);
    const eightHelperStart = eight.indexOf('vec3 filtSpectrumEightXDelta(');
    const eightHelperEnd = eight.indexOf('// These exact radioactive powders', eightHelperStart);
    const eightHelper = eight.slice(eightHelperStart, eightHelperEnd);
    const packedStart = eight.indexOf('  bool needsPackedState =');
    const packedEnd = eight.indexOf('  float sourceTarget =', packedStart);
    const packed = eight.slice(packedStart, packedEnd);

    expect(eightHelperStart).toBeGreaterThan(0);
    expect(eightHelperEnd).toBeGreaterThan(eightHelperStart);
    expect(eight).toContain('uniform float uFiltSpectrumStyling;');
    expect(eight).toContain('bool filtOwner = material == 69.0;');
    expect(packed).toContain('|| (uFiltSpectrumStyling > 0.5 && filtOwner)');
    expect(eight).toContain('color += filtSpectrumEightXDelta(');
    expect(eightHelper).toContain('if (packedState < 32768.0) return vec3(0.0);');
    expect(eightHelper).toContain('mod(floor(packedState / 4096.0), 8.0)');
    expect(eightHelper).toContain('floor(temperatureNormalized * 255.0 + 0.5)');
    expect(eightHelper).toContain('(65536.0 / 255.0 / 10.0)');
    expect(eightHelper).toContain('min(band + 5.0, 30.0) - max(band, 18.0)');
    expect(eightHelper).not.toContain('texture(');
    expect(eightHelper).not.toMatch(/\balpha\s*[+*]?=/);
    expect(eight.match(/texture\(uWallTexture, uv\)/g)).toHaveLength(4);

    expect(normal).toContain('uniform float uFiltSpectrumStyling;');
    expect(normal).toContain('vec3 filtSpectrumDelta(vec3 color, vec2 stateBytes, float temperatureNormalized)');
    expect(normal).toContain('if (uFiltSpectrumStyling > 0.5 && material == 69.0');
    expect(normal).toContain('color += filtSpectrumDelta(color, wallState.ba,');
    expect(normal).toContain('color += filtSpectrumDelta(color, wallState.ba, materialTemperature);');
    expect(normal).toContain('floor(temperatureNormalized * 255.0 + 0.5)');
    expect(normal).toContain('(65536.0 / 255.0 / 10.0)');
    expect(normal).not.toContain('uFiltSpectrumTexture');
  });

  it('projects native LCRY charge brightness through the existing packed state in both WebGL compositors', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `', eightEnd);
    const normalEnd = source.indexOf('`;\n\n/** Primary WebGL presentation', normalStart);
    const normal = source.slice(normalStart, normalEnd);
    const packedStart = eight.indexOf('  bool needsPackedState =');
    const packedEnd = eight.indexOf('  float sourceTarget =', packedStart);
    const packed = eight.slice(packedStart, packedEnd);

    expect(eight).toContain('uniform float uLcryStateStyling;');
    expect(eight).toContain('bool lcryOwner = material == 157.0;');
    expect(eight).toContain('vec3 lcryStateEightXDelta(vec3 color, float packedState)');
    expect(eight).toContain('if (packedState < 32768.0) return vec3(0.0);');
    expect(eight).toContain('float gray = 80.0 + brightness * 16.0;');
    expect(packed).toContain('|| (uLcryStateStyling > 0.5 && lcryOwner)');
    expect(eight).toContain('color += lcryStateEightXDelta(color, sourceTarget);');
    expect(eight.match(/texture\(uWallTexture, uv\)/g)).toHaveLength(4);

    expect(normal).toContain('uniform float uLcryStateStyling;');
    expect(normal).toContain('vec3 lcryStateDelta(vec3 color, vec2 stateBytes)');
    expect(normal).toContain('if (uLcryStateStyling > 0.5 && material == 157.0');
    expect(normal).toContain('color += lcryStateDelta(color, wallState.ba);');
    expect(normal).not.toContain('uLcryStateTexture');
  });

  it('projects PIPE/PPIP carriage and routing through the existing packed state in both WebGL compositors', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `', eightEnd);
    const normalEnd = source.indexOf('`;\n\n/** Primary WebGL presentation', normalStart);
    const normal = source.slice(normalStart, normalEnd);
    const packedStart = eight.indexOf('  bool needsPackedState =');
    const packedEnd = eight.indexOf('  float sourceTarget =', packedStart);
    const packed = eight.slice(packedStart, packedEnd);

    expect(eight).toContain('uniform float uPipePresentationStyling;');
    expect(eight).toContain('bool pipeOwner = material == 121.0 || material == 160.0;');
    expect(eight).toContain('vec3 pipePresentationEightXDelta(vec3 color, float material, float packedState)');
    expect(eight).toContain('mod(floor(packedState / 2048.0), 2.0) > 0.5');
    expect(packed).toContain('|| (uPipePresentationStyling > 0.5 && pipeOwner)');
    expect(eight).toContain('color += pipePresentationEightXDelta(color, material, sourceTarget);');
    expect(eight.match(/texture\(uWallTexture, uv\)/g)).toHaveLength(4);

    expect(normal).toContain('uniform float uPipePresentationStyling;');
    expect(normal).toContain('vec3 pipePresentationDelta(vec3 color, float material, vec2 stateBytes)');
    expect(normal).toContain('if (uPipePresentationStyling > 0.5 && (material == 121.0 || material == 160.0)');
    expect(normal).toContain('color += pipePresentationDelta(color, material, wallState.ba);');
    expect(normal).not.toContain('uPipePresentationTexture');
  });

  it('projects native SWCH conducting state through the existing packed state in both WebGL compositors', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `', eightEnd);
    const normalEnd = source.indexOf('`;\n\n/** Primary WebGL presentation', normalStart);
    const normal = source.slice(normalStart, normalEnd);
    const packedStart = eight.indexOf('  bool needsPackedState =');
    const packedEnd = eight.indexOf('  float sourceTarget =', packedStart);
    const packed = eight.slice(packedStart, packedEnd);

    expect(eight).toContain('uniform float uSwchStateStyling;');
    expect(eight).toContain('bool swchOwner = material == 149.0;');
    expect(eight).toContain('vec3 swchStateEightXDelta(vec3 color, float packedState)');
    expect(eight).toContain('bool present = packedState >= 32768.0;');
    expect(eight).toContain('bool on = mod(packedState, 2.0) > 0.5;');
    expect(packed).toContain('|| (uSwchStateStyling > 0.5 && swchOwner)');
    expect(eight).toContain('color += swchStateEightXDelta(color, sourceTarget);');
    expect(eight.match(/texture\(uWallTexture, uv\)/g)).toHaveLength(4);

    expect(normal).toContain('uniform float uSwchStateStyling;');
    expect(normal).toContain('vec3 swchStateDelta(vec3 color, vec2 stateBytes)');
    expect(normal).toContain('if (uSwchStateStyling > 0.5 && material == 149.0');
    expect(normal).toContain('color += swchStateDelta(color, wallState.ba);');
    expect(normal).not.toContain('uSwchStateTexture');
  });

  it('projects native DLAY countdown through the existing packed state and temperature in both WebGL compositors', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `', eightEnd);
    const normalEnd = source.indexOf('`;\n\n/** Primary WebGL presentation', normalStart);
    const normal = source.slice(normalStart, normalEnd);
    const packedStart = eight.indexOf('  bool needsPackedState =');
    const packedEnd = eight.indexOf('  float sourceTarget =', packedStart);
    const packed = eight.slice(packedStart, packedEnd);

    expect(eight).toContain('uniform float uDlayStateStyling;');
    expect(eight).toContain('bool dlayOwner = material == 154.0;');
    expect(eight).toContain('vec3 dlayCountdownEightXDelta(vec3 color, float packedState, float temperatureNormalized)');
    expect(eight).toContain('float countdown = mod(packedState, 32768.0);');
    expect(eight).toContain('if (packedState < 32768.0) return vec3(0.0);');
    expect(packed).toContain('|| (uDlayStateStyling > 0.5 && dlayOwner)');
    expect(eight).toContain('if (uDlayStateStyling > 0.5 && dlayOwner && nativeWall < 0.5)');
    expect(eight.match(/texture\(uWallTexture, uv\)/g)).toHaveLength(4);

    expect(normal).toContain('uniform float uDlayStateStyling;');
    expect(normal).toContain('vec3 dlayCountdownDelta(vec3 color, vec2 stateBytes, float temperatureNormalized)');
    expect(normal).toContain('if (uDlayStateStyling > 0.5 && material == 154.0');
    expect(normal).toContain('color += dlayCountdownDelta(color, wallState.ba, materialTemperature);');
    expect(normal).toContain('(65536.0 / 255.0 / 10.0)');
    expect(normal).not.toContain('uDlayStateTexture');
  });

  it('projects native WIFI channel/activity through the existing packed state in both WebGL compositors', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `', eightEnd);
    const normalEnd = source.indexOf('`;\n\n/** Primary WebGL presentation', normalStart);
    const normal = source.slice(normalStart, normalEnd);
    const packedStart = eight.indexOf('  bool needsPackedState =');
    const packedEnd = eight.indexOf('  float sourceTarget =', packedStart);
    const packed = eight.slice(packedStart, packedEnd);

    expect(eight).toContain('uniform float uWifiStateStyling;');
    expect(eight).toContain('bool wifiOwner = material == 152.0;');
    expect(eight).toContain('vec3 wifiStateEightXDelta(vec3 color, float packedState)');
    expect(eight).toContain('if (packedState < 32768.0) return vec3(0.0);');
    expect(eight).toContain('float channel = min(100.0, mod(packedState, 128.0)) / 100.0;');
    expect(packed).toContain('|| (uWifiStateStyling > 0.5 && wifiOwner)');
    expect(eight).toContain('if (uWifiStateStyling > 0.5 && wifiOwner && nativeWall < 0.5)');
    expect(eight.match(/texture\(uWallTexture, uv\)/g)).toHaveLength(4);

    expect(normal).toContain('uniform float uWifiStateStyling;');
    expect(normal).toContain('vec3 wifiStateDelta(vec3 color, vec2 stateBytes)');
    expect(normal).toContain('if (uWifiStateStyling > 0.5 && material == 152.0');
    expect(normal).toContain('color += wifiStateDelta(color, wallState.ba);');
    expect(normal).not.toContain('uWifiStateTexture');
  });

  it('projects native STOR reservoir state through the existing packed state in both WebGL compositors', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `', eightEnd);
    const normalEnd = source.indexOf('`;\n\n/** Primary WebGL presentation', normalStart);
    const normal = source.slice(normalStart, normalEnd);
    const packedStart = eight.indexOf('  bool needsPackedState =');
    const packedEnd = eight.indexOf('  float sourceTarget =', packedStart);
    const packed = eight.slice(packedStart, packedEnd);

    expect(eight).toContain('uniform float uStorStateStyling;');
    expect(eight).toContain('bool storOwner = material == 163.0;');
    expect(eight).toContain('vec3 storStateEightXDelta(vec3 color, float packedState)');
    expect(eight).toContain('bool loaded = mod(floor(packedState / 256.0), 2.0) > 0.5;');
    expect(eight).toContain('bool cooldown = mod(floor(packedState / 512.0), 2.0) > 0.5;');
    expect(packed).toContain('|| (uStorStateStyling > 0.5 && storOwner)');
    expect(eight).toContain('color += storStateEightXDelta(color, sourceTarget);');
    expect(eight.match(/texture\(uWallTexture, uv\)/g)).toHaveLength(4);

    expect(normal).toContain('uniform float uStorStateStyling;');
    expect(normal).toContain('vec3 storStateDelta(vec3 color, vec2 stateBytes)');
    expect(normal).toContain('if (uStorStateStyling > 0.5 && material == 163.0');
    expect(normal).toContain('color += storStateDelta(color, wallState.ba);');
    expect(normal).not.toContain('uStorStateTexture');
  });

  it('restores independent PHOT spectrum after true-8x matter and wall composition', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const start = eight.indexOf('  // Native PHOT lives in an independent plane');
    const end = eight.indexOf('  finalColor = foreground;', start);
    const block = eight.slice(start, end);

    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(eight).toContain('uniform sampler2D uPhotonStateTexture;');
    expect(eight).toContain('uniform float uPhotonActive;');
    expect(block).toContain('if (uPhotonActive > 0.5)');
    expect(block).toContain('texture(uPhotonStateTexture, uv)');
    expect(block).toContain('if (photonHigh >= 128.0)');
    expect(block).toContain('foreground.rgb = mix(foreground.rgb, photonSpectrum * foreground.a, photonAmount);');
    expect(block).not.toMatch(/\balpha\s*[+*]?=/);
    expect(block).not.toContain('material ==');
  });

  it('keeps Smooth powder body depth calm, gated, bounded, and topology-neutral', () => {
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
    expect(block).toContain('(optics == 7.0 ? 0.006 * powderBodyVolumeDepth : 0.0)');
    expect(block).toContain('-0.080, 0.085');
    expect(block).not.toContain('texture(');
    expect(block).not.toMatch(/\balpha\s*[+*]?=/);
    expect(block).not.toMatch(/\b(?:sin|pow|normalize|length|sqrt)\s*\(/);
    expect(source.match(/texture\(uPowderSurfaceTexture/g)).toHaveLength(2);
    // Stable Smooth powder retains almost all mineral variation at normal
    // detail; Local/Grains still carry their full diagnostic cell detail.
    expect(source).toContain('float settledMineralRetention = max(powderVisualCohesion, stablePowderMineral)');
    expect(source).toContain('float smoothContourTransfer = boundaryStability * powderSurfaceBlend;');
    expect(source).toContain('float smoothContourAlpha = smoothstep(0.36, 0.64, widePowderShape.x);');
    expect(source).toContain('heapAlpha = mix(heapAlpha, smoothContourAlpha, smoothContourTransfer);');
    expect(source).toContain('float powderContourTextureRetention = 1.0;');
    expect(source).toContain('powderContourTextureRetention = 1.0 - smoothContourTransfer');
    expect(source).toContain('color *= mix(1.0, powderMineralFactor, powderContourTextureRetention);');
    expect(source).toContain('mix(1.0, 1.70, settledMineralRetention)');
    expect(source).toContain('float detailEstimate = min(');
    expect(source).toContain('(gl_FragCoord.x + 0.5) / max(fieldPosition.x, 0.5)');
    expect(source).toContain('float lowDetailShoulder = 1.0 - smoothstep(1.15, 2.25, detailEstimate);');
    expect(source).toContain('float lowDetailTaper = 1.0 - smoothstep(2.25, 4.0, detailEstimate);');
    expect(source).toContain('float fourXMineralRecovery = smoothstep(2.75, 4.0, detailEstimate);');
    expect(source).toContain('float fourXSmoothCalm = fourXMineralRecovery');
    expect(source).toContain('* step(1.5, uPowderStyle) * stablePowderMineral;');
    expect(source).toContain('float lowDetailMineralGain = 1.0 + 0.85 * lowDetailTaper');
    expect(source).toContain('+ 0.90 * fourXMineralRecovery * (1.0 - 0.70 * fourXSmoothCalm);');
    expect(source).toContain('mix(1.0, 1.20, settledMineralRetention)');
    expect(source).toContain('float broadPowderPigmentDamping = 1.0 - smoothstep(');
    expect(source).toContain('0.72, 0.98, powderVisualCohesion');
    expect(source).toContain(') * 0.14;');
    expect(source).toContain('cellGrainRetention * broadPowderPigmentDamping');
    expect(source).toContain('float deepPowderBody = smoothstep(0.86, 0.98, powderVisualCohesion);');
    expect(source).toContain('float deepStoneBody = material == 21.0 ? deepPowderBody : 0.0;');
    expect(source).toContain('float settledGrainCeiling = mix(8.0, 2.70, deepStoneBody);');
    expect(source).toContain('cellGrainRetention = min(cellGrainRetention, settledGrainCeiling);');
    expect(source).toContain('float settledPowderColorCalm = step(1.5, uPowderStyle)');
    expect(source).toContain('smoothstep(2.5, 3.5, shape.w);');
    expect(source).toContain('min(cellGrainRetention, 1.20), settledPowderColorCalm * 0.85');
    expect(source).toContain('powderBodyBase, settledPowderColorCalm * commonEarthenPowder * 0.42');
    expect(source).toContain('float deepPowderChromaDamping = mix(1.0, 0.78, deepStoneBody);');
    expect(source).toContain('float fourXMicroRetention = 1.0 - 0.45 * fourXSmoothCalm;');
    expect(source).toContain('+ fourXMicroRetention * (');
    expect(source).toContain('color += base * grain * vec3(0.178, 0.044, -0.112)');
    expect(source).toContain('* stablePowderMineral * lowDetailMineralGain * powderContourTextureRetention');
    expect(source).toContain('* broadPowderPigmentDamping * deepPowderChromaDamping;');
    expect(source).toContain('uPowderStyle < 1.5 ? 0.044 : 0.085');
    expect(source).toContain('float powderDetailCalibration = material == 1.0 && uPowderStyle > 1.5');
    expect(source).toContain('if (material == 1.0 && uPowderStyle > 1.5 && traits < 0.5 && !materialEmissive)');
    expect(source).toContain('float organicMicroFibre = material == 10.0 ? fibre * 0.32 + pores * 0.68 : fibre;');
    expect(source).toContain('organicMicroFibre * 0.042 + pores * 0.024');
    expect(source).toContain('max(0.0, organicMicroFibre) * 0.018');
    expect(source).toContain('float sandInteriorExposure = q00 * q10 * q01 * q11');
    expect(source).toContain('* smoothstep(0.72, 0.95, semanticDensity);');
    expect(source).toContain('color = max(color - vec3(50.0, 45.0, 27.0) / 255.0 * sandInteriorExposure, vec3(0.0));');
    expect(source).toContain('float sandInteriorPigment = (powderGrain * 0.365 + powderFacet * 0.285)');
    expect(source).toContain('if (family == 4.0 && uPowderStyle > 1.5 && powderFieldBlend > 0.001)');
    expect(source).toContain('density = smoothstep(0.04, 0.96, density);');
  });

  it('coalesces only auxiliary powder settling between true-8x semantic frames', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    expect(source).toContain('private semanticTextureMutationPending = true;');
    expect(source).toContain('this.semanticTextureMutationPending = true;\n    this.chunks.markCell(index);');
    expect(source).toContain('const hasExternalPresentationMutation = this.semanticTextureMutationPending');
    expect(source).toContain('this.semanticTextureMutationPending = false;');
    expect(source).toContain('if (this.outputScale === 8 && this.boundaryEvolutionPending');
    expect(source).toContain('&& !hasExternalPresentationMutation) return;');
  });

  it('calms only deep 4x sensor lattices while preserving the separate glyph and true-8x path', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, normalStart);
    const normal = source.slice(normalStart);
    const deviceStart = normal.indexOf('} else if (deviceSurface > 0.5');
    const deviceEnd = normal.indexOf('} else if (organicSurface > 0.5', deviceStart);
    const device = normal.slice(deviceStart, deviceEnd);

    expect(device).toContain('float fourXDeviceCalm = smoothstep(2.75, 4.0, deviceDetailEstimate)');
    expect(device).toContain('* (material >= 164.0 && material <= 170.0 ? 1.0 : 0.0)');
    expect(device).toContain('* sensorPanelCore;');
    expect(device).toContain('* mix(1.0, 0.38, fourXDeviceCalm);');
    expect(device).toContain('vec2 sensorTile = fract(fieldPosition / 24.0) - 0.5;');
    expect(device).toContain('sensorGlyph');
    expect(eight).not.toContain('fourXDeviceCalm');
    expect(eight).not.toContain('fourXSmoothCalm');
  });

  it('lets settled mixed powders share only their broad Smooth exterior proof', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const start = source.indexOf('float powderSurfaceBulkSupport(');
    const end = source.indexOf('vec3 discreteShape', start);
    const helper = source.slice(start, end);

    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(helper).toContain('float powderSurfaceBulkSupport(vec2 uv, float material)');
    expect(helper).toContain('smoothstep(0.18, 0.42, powderSurfaceShape(uv).x)');
    expect(helper).toContain('powderSurfaceBulkSupport(cell + vec2(0.0, uTexel.y), material)');
    expect(helper).toContain('powderSurfaceBulkSupport(cell + vec2(0.0, uTexel.y * 2.0), material)');
    expect(helper).toContain('powderSurfaceBulkSupport(anchor - vec2(uTexel.x, 0.0), material)');
    expect(source).toContain('powderBulkDepth = powderSurfaceBulkDepth(fieldUv, material, surfaceOnly);');
  });

  it('keeps settled Sand/Stone/Concrete/Clay mesostrata dry, Smooth-only, RGB-only, and resource-free', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const eightHelperStart = eight.indexOf('vec3 settledPowderMesostrataEightXDelta(');
    const eightHelperEnd = eight.indexOf('// These ten native powders carry distinct', eightHelperStart);
    const eightBranchStart = eight.indexOf('// Apply dry mineral compaction after the retained packed-wall state');
    const eightBranchEnd = eight.indexOf('  if ((liquidSurfaceContourKeyStrength', eightBranchStart);
    const normalHelperStart = source.lastIndexOf('vec3 settledPowderMesostrataDelta(');
    const normalHelperEnd = source.indexOf('// As with the powder helper', normalHelperStart);
    const normalGateStart = source.indexOf('// Sand, Stone, Clay, and Concrete receive a small slope-aligned compaction');
    const normalGateEnd = source.indexOf('float grainOffsetY', normalGateStart);
    const eightHelper = eight.slice(eightHelperStart, eightHelperEnd);
    const eightBranch = eight.slice(eightBranchStart, eightBranchEnd);
    const normal = source.slice(normalHelperStart, normalHelperEnd)
      + source.slice(normalGateStart, normalGateEnd);

    expect(eightHelperStart).toBeGreaterThan(0);
    expect(eightHelperEnd).toBeGreaterThan(eightHelperStart);
    expect(eightBranchStart).toBeGreaterThan(0);
    expect(eightBranchEnd).toBeGreaterThan(eightBranchStart);
    expect(normalHelperStart).toBeGreaterThan(0);
    expect(normalGateStart).toBeGreaterThan(0);
    for (const material of [1, 21, 26, 28]) {
      expect(eightHelper).toContain(`material == ${material}.0`);
      expect(normal).toContain(`material == ${material}.0`);
    }
    expect(normal).toContain('powderMesostrataStrength = uPowderMesostrataStyling * powderBodyGate * mesostrataOwner');
    expect(normal).toContain('powderSuspensionCohesion');
    expect(normal).toContain('(1.0 - step(0.5, wall))');
    expect(eightBranch).toContain('uPowderStyle > 1.5');
    expect(eightBranch).toContain('powderWetMix <= 0.001');
    expect(eightBranch).toContain('nativeWall < 0.5');
    expect(eightBranch).toContain('depth * q00 * q10 * q01 * q11');
    expect(eightHelper).toContain('vec3(15.0, 7.0, -8.0)');
    expect(eightBranch).toContain('(0.72 + mesostrataCore * 0.28)');
    expect(eight).toContain('uNativeWallsActive > 0.5 && uPowderMesostrataStyling > 0.5');
    expect(`${eightHelper}${eightBranch}${normal}`).not.toContain('texture(');
    expect(`${eightHelper}${eightBranch}${normal}`).not.toContain('uTime');
    expect(`${eightHelper}${eightBranch}${normal}`).not.toMatch(/\balpha\s*[+*]?=/);
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
    const coreStart = source.indexOf('float coreDepth = smoothstep(6.0 / 255.0, 42.0 / 255.0, solidOpticalDepth)');
    const coreEnd = source.indexOf('// The bilinear solid field peaks below one for isolated', coreStart);
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `');
    const shadingStart = source.indexOf('float linearThickness', normalStart);
    const shadingEnd = source.indexOf('// Reuse the semantic Hermite normal', shadingStart);
    const sample = source.slice(sampleStart, sampleEnd);
    const core = source.slice(coreStart, coreEnd);
    const shading = source.slice(shadingStart, shadingEnd);

    expect(sampleStart).toBeGreaterThan(0);
    expect(sample).toContain('solidOpticalDepth = boundaryStabilityAt(fieldUv)');
    expect(sample).not.toContain('uSolidOpticalDepthTexture');
    expect(coreStart).toBeGreaterThan(0);
    expect(coreEnd).toBeGreaterThan(coreStart);
    expect(core).toContain('solidDeepInteriorMicroGain(optics, profile)');
    expect(source).toContain('profile == 2.0)) return 0.34;');
    expect(source).toContain('float staticSolidIdentityGain = 1.0;');
    expect(core).toContain('staticSolidIdentityGain = mix(1.0, 0.66, coreDepth * solidInterior);');
    expect(core).not.toContain('texture(');
    expect(core).not.toMatch(/\balpha\s*[+*]?=/);
    expect(normalStart).toBeGreaterThan(0);
    expect(shading).toContain('(solidOpticalDepth * 255.0 - 6.0) / 249.0');
    expect(shading).toContain('thicknessAbsorption');
    expect(shading).toContain('solidBodyMacroKey(optics)');
    expect(shading).toContain('solidBodyMacroShadow(optics)');
    expect(shading).toContain('solidReliefTone * 255.0 / macroStrength');
    expect(shading).toContain('float macroKeyGain = optics == 11.0 ? 0.15 : 0.72;');
    expect(shading).toContain('float macroShadowGain = optics == 11.0 ? 1.60 : 1.0;');
    expect(shading).toContain('solidBodyMacroKey(optics) * macroResponse * macroGain * macroKeyGain');
    expect(shading).toContain('surfaceOnly < 0.5');
    expect(shading).not.toContain('texture(');
    expect(shading).not.toMatch(/\balpha\s*[+*]?=/);
    expect(source).not.toContain('uSolidOpticalDepthTexture');
    expect(source.match(/this\.boundaryStabilitySource\.update\(\)/g)).toHaveLength(1);
  });

  it('extends the sample-free translucent lens shell to every crystalline rigid material', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    // Both WebGL compositors intentionally cover the complete crystalline
    // family. The compact path relies on its already-live density/slope state
    // rather than the normal shader's broader body-relief vocabulary.
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const compactSource = source.slice(eightStart, eightEnd);
    const compactStart = compactSource.indexOf('// TranslucentRigid is the intentional presentation-alpha exception.');
    const compactEnd = compactSource.indexOf('// Compact Device bodies retain', compactStart);
    const compact = compactSource.slice(compactStart, compactEnd);
    const start = source.indexOf('if (uTranslucentLensShell > 0.5', normalStart);
    const end = source.indexOf('      float translucentAlpha =', start);
    const shell = source.slice(start, end);

    expect(normalStart).toBeGreaterThan(0);
    expect(compactStart).toBeGreaterThan(0);
    expect(compactEnd).toBeGreaterThan(compactStart);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    for (const material of [12, 24, 68, 74, 76, 77]) {
      expect(shell).toContain(`material == ${material}.0`);
      expect(compact).toContain(`material == ${material}.0`);
    }
    expect(shell).toContain('solidReliefTone');
    expect(shell).toContain('solidDepth');
    expect(shell).toContain('solidFresnel');
    expect(shell).toContain('float glassCore = smoothstep(0.28, 0.90, solidDepth);');
    expect(shell).toContain('float glassGrazing = smoothstep(0.018, 0.18, solidFresnel);');
    expect(shell).toContain('vec3 glassReflection = solidEnvironment');
    expect(shell).toContain('float iceCore = smoothstep(0.22, 0.88, solidDepth);');
    expect(shell).toContain('float iceGrazing = smoothstep(0.018, 0.18, solidFresnel);');
    expect(shell).toContain('vec3 iceReflection = solidEnvironment');
    expect(shell).not.toContain('texture(');
    expect(shell).not.toMatch(/\balpha\s*[+*]?=/);
    expect(compact).toContain('crystalCoreAbsorption');
    expect(compact).toContain('crystalRimGain');
    expect(compact).toContain('crystalEnvironmentGain');
    expect(compact).not.toContain('texture(');
    expect(compact).not.toMatch(/\balpha\s*[+*]?=/);
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
    const end = source.indexOf('// Keep the exact low-frequency Earth/mineral powder grammar', start);
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
    expect(block).toContain('emissionState.rgb / max(emissionHuePeak, 0.0001)');
    expect(block).toContain('mix(vec3(1.0), emissionKeySpectrum, 0.34)');
    expect(block).not.toContain('texture(');
    expect(block).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('adds a bounded field-gated corona to cohesive WebGL energy bodies', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const normal = source.slice(source.indexOf('const FIELD_FRAGMENT = `'));
    const start = normal.indexOf('float energyCorona = cohesiveEnergy * edge');
    const end = normal.indexOf('  } else if (gasVolume > 0.5) {', start);
    const block = normal.slice(start, end);

    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(block).toContain('smoothstep(0.96, 1.12, diffuse) * 0.035');
    expect(block).toContain('mix(vec3(1.0, 0.68, 0.36), vec3(0.62, 0.86, 1.0), radioactiveCarrier)');
    expect(block).toContain('* energyCorona * uEnergyCoreRelief;');
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

  it('keeps the dense body ambient fill normal-WebGL-only and independently toggleable', () => {
    const presenter = presenterHarness();

    presenter.configurePresentation(
      true, true, true, true, true, true, true, true, true, 'smooth',
    );
    expect(presenter.uniforms.uniforms.uDenseBodyAmbientFill).toBe(1);
    expect(presenter.app.render).not.toHaveBeenCalled();

    presenter.setDenseBodyAmbientFillEnabled(false);
    expect(presenter.uniforms.uniforms.uDenseBodyAmbientFill).toBe(0);
    expect(presenter.app.render).toHaveBeenCalledOnce();
  });

  it('keeps dense-body ambient fill RGB-only and inside the normal WebGL compositor', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `');
    const normalEnd = source.indexOf('export class PixiFieldPresenter', normalStart);
    const normal = source.slice(normalStart, normalEnd);
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const liquidStart = normal.indexOf('// Dense, ordinary liquid can retain');
    const liquidEnd = normal.indexOf('  } else {', liquidStart);
    const solidStart = normal.indexOf('// The same bounded hue-preserving ambient lift');
    const solidEnd = normal.indexOf('  }\n  if (uEnergyIdentityStyling', solidStart);
    const bodyBlocks = `${normal.slice(liquidStart, liquidEnd)}${normal.slice(solidStart, solidEnd)}`;

    expect(normal).toContain('uniform float uDenseBodyAmbientFill;');
    expect(liquidStart).toBeGreaterThan(0);
    expect(solidStart).toBeGreaterThan(0);
    expect(bodyBlocks).toContain('family == 2.0');
    expect(bodyBlocks).toContain('liquidOnly < 0.5 && halo < 0.5 && surfaceOnly < 0.5 && wall < 0.5');
    expect(bodyBlocks).toContain('foreignMatterContact < 0.5 && unlikeMaterialContact < 0.5');
    expect(bodyBlocks).toContain('liquidDepth > 0.48 && liquidNeighbourMean > 0.56');
    expect(bodyBlocks).toContain('family == 0.0 && granularSurface < 0.5');
    expect(bodyBlocks).toContain('translucentSurface < 0.5 && surfaceOnly < 0.5 && halo < 0.5 && wall < 0.5');
    expect(bodyBlocks).toContain('solidInterior > 0.001 && solidOpticalDepth > 6.0 / 255.0');
    expect(bodyBlocks).toContain('min(5.0 / 255.0');
    expect(bodyBlocks).toContain('color *= 1.0 +');
    expect(bodyBlocks).not.toContain('texture(');
    expect(bodyBlocks).not.toMatch(/\balpha\s*[+*]?=/);
    expect(eight).not.toContain('uDenseBodyAmbientFill');
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

  it('redraws the independent native LCRY charge-brightness toggle', () => {
    const presenter = presenterHarness();

    presenter.setLcryStateStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uLcryStateStyling).toBe(0);
    expect(presenter.app.render).toHaveBeenCalledOnce();

    presenter.setLcryStateStylingEnabled(true);
    expect(presenter.uniforms.uniforms.uLcryStateStyling).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledTimes(2);
  });

  it('redraws the independent native PIPE/PPIP presentation toggle', () => {
    const presenter = presenterHarness();

    presenter.setPipePresentationStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uPipePresentationStyling).toBe(0);
    expect(presenter.app.render).toHaveBeenCalledOnce();

    presenter.setPipePresentationStylingEnabled(true);
    expect(presenter.uniforms.uniforms.uPipePresentationStyling).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledTimes(2);
  });

  it('redraws the independent native SWCH conducting-state toggle', () => {
    const presenter = presenterHarness();

    presenter.setSwchStateStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uSwchStateStyling).toBe(0);
    expect(presenter.app.render).toHaveBeenCalledOnce();

    presenter.setSwchStateStylingEnabled(true);
    expect(presenter.uniforms.uniforms.uSwchStateStyling).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledTimes(2);
  });

  it('redraws the native DLAY countdown toggle', () => {
    const presenter = presenterHarness();

    presenter.setDlayStateStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uDlayStateStyling).toBe(0);
    expect(presenter.app.render).toHaveBeenCalledOnce();

    presenter.setDlayStateStylingEnabled(true);
    expect(presenter.uniforms.uniforms.uDlayStateStyling).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledTimes(2);
  });

  it('redraws the native WIFI state toggle', () => {
    const presenter = presenterHarness();

    presenter.setWifiStateStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uWifiStateStyling).toBe(0);
    expect(presenter.app.render).toHaveBeenCalledOnce();

    presenter.setWifiStateStylingEnabled(true);
    expect(presenter.uniforms.uniforms.uWifiStateStyling).toBe(1);
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

  it('redraws the independent native SPNG-hydration toggle', () => {
    const presenter = presenterHarness();

    presenter.setSpngStateStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uSpngStateStyling).toBe(0);
    expect(presenter.app.render).toHaveBeenCalledOnce();

    presenter.setSpngStateStylingEnabled(true);
    expect(presenter.uniforms.uniforms.uSpngStateStyling).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledTimes(2);
  });

  it('keeps SPNG hydration arithmetic-only, bounded, and exact-owner guarded', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const start = source.indexOf('vec3 spongeHydrationDelta');
    const end = source.indexOf('vec3 deutStateDelta', start);
    const block = source.slice(start, end);

    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(block).toContain('material != 81.0');
    expect(block).toContain('packedState / 64.0');
    expect(block).toContain('min(50.0, mod(packedState, 64.0))');
    expect(block).toContain('clamp(delta * moisture, vec3(-20.0), vec3(20.0))');
    expect(block).not.toContain('texture(');
    expect(block).not.toContain('uTime');
  });

  it('redraws the independent native Lava-ancestry toggle', () => {
    const presenter = presenterHarness();

    presenter.setLavaAncestryStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uLavaAncestryStyling).toBe(0);
    expect(presenter.app.render).toHaveBeenCalledOnce();

    presenter.setLavaAncestryStylingEnabled(true);
    expect(presenter.uniforms.uniforms.uLavaAncestryStyling).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledTimes(2);
  });

  it('keeps WebGL-only molten body optics independently switchable and resource-bounded', () => {
    const presenter = presenterHarness();
    presenter.setMoltenBodyOpticsEnabled(false);
    expect(presenter.uniforms.uniforms.uMoltenBodyOptics).toBe(0);
    presenter.setMoltenBodyOpticsEnabled(true);
    expect(presenter.uniforms.uniforms.uMoltenBodyOptics).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledTimes(2);

    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const eightStartBlock = eight.indexOf('// Lava is deliberately outside the shared liquid contour/reconstruction');
    const eightEndBlock = eight.indexOf('  if (family == 4.0) {', eightStartBlock);
    const eightBlock = eight.slice(eightStartBlock, eightEndBlock);
    const normalStart = source.indexOf('// Lava\'s wide glow is deliberately left to the shared emission field');
    const normalEnd = source.indexOf('    // Family-coloured chroma and vertical optical depth', normalStart);
    const normalBlock = source.slice(normalStart, normalEnd);

    expect(eightStartBlock).toBeGreaterThan(0);
    expect(eightEndBlock).toBeGreaterThan(eightStartBlock);
    expect(normalStart).toBeGreaterThan(0);
    expect(normalEnd).toBeGreaterThan(normalStart);
    expect(source).toContain('uniform float uMoltenBodyOptics;');
    expect(eightBlock).toContain('uMoltenBodyOptics > 0.5 && family == 2.0 && material == 11.0');
    expect(eightBlock).toContain('q00 * q10 * q01 * q11');
    expect(eightBlock).toContain('lavaRibbon');
    expect(eightBlock).not.toContain('texture(');
    expect(eightBlock).not.toContain('uTime');
    expect(eightBlock).not.toMatch(/\balpha\s*[+*]?=/);
    expect(normalBlock).toContain('uMoltenBodyOptics > 0.5 && uLiquidFieldLighting > 0.5');
    expect(normalBlock).toContain('foreignMatterContact < 0.5 && unlikeMaterialContact < 0.5');
    expect(normalBlock).not.toContain('texture(');
    expect(normalBlock).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('keeps true-8x mineral powder colour on a live palette binding', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    const start = eight.indexOf('// Keep the normal compositor\'s chromatic mineral vocabulary at true 8x');
    const end = eight.indexOf('// Smooth, supported powder retains a coloured stable edge.', start);
    const block = eight.slice(start, end);

    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(block).toContain('color += palette.rgb * powderGrain');
    expect(block).not.toContain('color += base * powderGrain');
  });

  it('keeps the WebGL-only aqueous surface shoulder independently switchable', () => {
    const presenter = presenterHarness();
    presenter.setAqueousSurfaceReflectionEnabled(false);
    expect(presenter.uniforms.uniforms.uAqueousSurfaceReflection).toBe(0);
    presenter.setAqueousSurfaceReflectionEnabled(true);
    expect(presenter.uniforms.uniforms.uAqueousSurfaceReflection).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledTimes(2);

    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const eightEnd = source.indexOf('const FIELD_FRAGMENT = `', eightStart);
    const normalStart = source.indexOf('// Water\'s broad body needs a continuous, sky-facing top shoulder');
    const normalEnd = source.indexOf('color -= color * liquidFresnelGate', normalStart);
    const eight = source.slice(eightStart, eightEnd);
    const normal = source.slice(normalStart, normalEnd);

    expect(source).toContain('uniform float uAqueousSurfaceReflection;');
    expect(eight).toContain('uAqueousSurfaceReflection > 0.5 && optics == 1.0');
    expect(normal).toContain('uAqueousSurfaceReflection > 0.5 && aqueous > 0.5');
    expect(normal).toContain('vec3(0.30, 0.74, 1.00) * aqueousSurfaceReflection');
    expect(eight).toContain('float aqueousCoreVolume = fieldInterior * (1.0 - airFacingRim) * connected;');
    expect(eight).toContain('vec3(0.020, 0.0075, 0.000) * aqueousCoreVolume');
    expect(eight).toContain('float aqueousCoreGlaze = aqueousCoreVolume * (0.018 + keyLight * 0.030);');
    expect(normal).toContain('material == 2.0 && liquidOnly < 0.5 && halo < 0.5 && wall < 0.5');
    expect(normal).toContain('foreignMatterContact < 0.5');
    expect(normal).toContain('unlikeMaterialContact < 0.5');
    expect(normal).toContain('dot(liquidSpeciesSlope, liquidSpeciesSlope) < 0.0025');
    expect(normal).toContain('liquidDepth > 0.48 && liquidNeighbourMean > 0.56');
    expect(normal).toContain('smoothstep(0.56, 0.86, liquidNeighbourMean)');
    expect(normal).toContain('vec3(0.082, 0.050, 0.024) * aqueousCoreVolume');
    expect(normal).toContain('* (0.010 + broadSheen * 0.014 + caustic * 0.008)');
    expect(normal).toContain('if (uLiquidVolumeChroma > 0.5 && material == 13.0');
    expect(normal).not.toContain('if (uLiquidVolumeChroma > 0.5 && material == 16.0');
    expect(normal).toContain('float acidCoreVolume = liquidDepth * (1.0 - liquidFresnelContour)');
    expect(normal).toContain('vec3(0.28, -0.15, 0.65) * acidCoreGlaze');
    expect(normal).not.toContain('texture(');
    expect(normal).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('keeps typed-Lava ancestry arithmetic-only, bounded, and exact-owner guarded', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const start = source.indexOf('float lavaAncestryFamily');
    const end = source.indexOf('vec3 vibrStateDelta', start);
    const block = source.slice(start, end);

    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(block).toContain('material != 11.0');
    expect(block).toContain('packedState / 256.0');
    expect(block).toContain('float origin = mod(packedState, 256.0)');
    expect(block).toContain('origin == 1.0');
    expect(block).toContain('origin == 30.0');
    expect(block).toContain('origin == 46.0');
    expect(block).toContain('origin == 72.0');
    expect(block).toContain('origin == 143.0');
    expect(block).toContain('origin == 112.0');
    expect(block).toContain('clamp(key * gain, vec3(-16.0), vec3(16.0))');
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
    expect(cellularBlock).toContain('float junctionCoordinate = motif < 0.5');
    expect(cellularBlock).toContain('float junction = step(18.5, cellularRadiusSquared)');
    expect(cellularBlock).not.toMatch(/texture\s*\(/);
    expect(cellularBlock).not.toMatch(/\balpha\s*[+*]?=/);
    expect(source).toContain('if (cellularSurface > 0.5 && surfaceOnly > 0.5) alpha = 0.0;');
  });

  it('seeds, redraws, and bounds structural rigid styling to authoritative RGB arithmetic', () => {
    const presenter = presenterHarness();

    presenter.setStructuralRigidStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uStructuralRigidStyling).toBe(0);
    expect(presenter.app.render).toHaveBeenCalledOnce();

    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const start = source.indexOf('// As with the powder helper, keep construction-body identity');
    const end = source.indexOf('vec3 vibrStateDelta(', start);
    const structuralBlock = source.slice(start, end);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(source).toContain('uniform float uStructuralRigidStyling;');
    expect(source).toContain('uStructuralRigidStyling > 0.5 && surfaceOnly < 0.5');
    expect(source).toContain('traits < 0.5 && !materialEmissive');
    expect(structuralBlock).toContain('vec3 structuralRigidIdentityDelta(float material, vec2 position)');
    expect(structuralBlock).toContain('float structuralRigidDeepIdentityGain(float material)');
    expect(structuralBlock).toContain('vec3 structuralMetalBodyDelta(');
    expect(structuralBlock).toContain('if (material == 22.0)');
    expect(structuralBlock).toContain('if (material == 23.0) return 0.22;');
    expect(structuralBlock).toContain('if (material == 82.0)');
    expect(structuralBlock).not.toMatch(/texture\s*\(/);
    expect(structuralBlock).not.toMatch(/\balpha\s*[+*]?=/);
    expect(source).toContain('float structuralIdentityGain = 1.0;');
    expect(source).toContain('structuralRigidDeepIdentityGain(material), structuralDepth * solidInterior');
    expect(source).toContain('structuralMetalBodyDelta(\n            material, fieldPosition, structuralDepth, structuralRelief\n          )');
    expect(source).toContain('structuralIdentityGain = min(structuralIdentityGain, staticSolidIdentityGain);');
    expect(source).toContain('structuralRigidIdentityDelta(material, fieldPosition)\n          * structuralIdentityGain');
  });

  it('seeds and redraws the canonical-WebGL mechanism body layer', () => {
    const presenter = presenterHarness();

    presenter.setMechanismBodyStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uMechanismBodyStyling).toBe(0);
    expect(presenter.app.render).toHaveBeenCalledOnce();

    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const start = source.indexOf('// Native transport and actuator bodies sit beneath later role/thermal decals.');
    const end = source.indexOf('float structuralRigidDeepIdentityGain(', start);
    const mechanismBlock = source.slice(start, end);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(source).toContain('uniform float uMechanismBodyStyling;');
    expect(source).toContain('uMechanismBodyStyling > 0.5 && mechanismBodyStyle(material) > 0.5');
    expect(mechanismBlock).toContain('vec3 mechanismBodyIdentityDelta(float material, vec2 position)');
    expect(mechanismBlock).toContain('float mechanismBodyStyle(float material)');
    for (const material of [117, 119, 121, 122, 123, 155, 160, 161, 162, 163]) {
      expect(mechanismBlock).toContain(`material == ${material}.0`);
    }
    expect(mechanismBlock).not.toMatch(/texture\s*\(/);
    expect(mechanismBlock).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('keeps LIGH and THDR discharge identities exact, RGB-only, and scale-neutral', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `');
    const eight = source.slice(eightStart, normalStart);
    const normal = source.slice(normalStart);
    const normalHelperStart = normal.indexOf('vec3 electricDischargeIdentityDelta(');
    const normalHelperEnd = normal.indexOf('vec3 radioactiveBodyIdentityDelta(', normalHelperStart);
    expect(normalHelperStart).toBeGreaterThan(0);
    expect(normalHelperEnd).toBeGreaterThan(normalHelperStart);
    const normalHelper = normal.slice(normalHelperStart, normalHelperEnd);
    expect(normalHelper).toContain('material == 93.0');
    expect(normalHelper).toContain('material == 97.0');
    expect(normalHelper).not.toContain('texture(');
    expect(normalHelper).not.toContain('uTime');
    expect(normalHelper).not.toMatch(/\balpha\s*[+*]?=/);
    expect(eight).toContain('uEnergyIdentityStyling > 0.5 && (material == 93.0 || material == 97.0)');
    expect(eight).toContain('material == 93.0 ? 4.0');
    expect(eight).toContain('material == 97.0 ? 1.0 : traits');
    expect(eight.match(/roleEightXDelta\(/g)).toHaveLength(2);
    expect(normal).toContain('electricDischargeIdentityDelta(material, fieldPosition)');
    for (const shader of [eight, normal]) {
      expect(shader).toContain('uEnergyIdentityStyling > 0.5');
      expect(shader).toContain('(material == 93.0 || material == 97.0)');
    }
  });

  it('seeds and redraws the canonical-WebGL electronics identity layer', () => {
    const presenter = presenterHarness();

    presenter.setElectronicIdentityStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uElectronicIdentityStyling).toBe(0);
    expect(presenter.app.render).toHaveBeenCalledOnce();

    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const start = source.indexOf('// Exact native control electronics retain a legible body grammar');
    const end = source.indexOf('float structuralRigidDeepIdentityGain(', start);
    const electronicsBlock = source.slice(start, end);
    const materials = [135, 136, 138, 139, 140, 141, 142, 143, 144, 145,
      146, 147, 149, 150, 151, 152, 153, 154, 156, 157];
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(source).toContain('uniform float uElectronicIdentityStyling;');
    expect(source).toContain('uElectronicIdentityStyling > 0.5 && electronicBodyStyle(material) > 0.5');
    expect(electronicsBlock).toContain('vec3 electronicBodyIdentityDelta(float material, vec2 position)');
    expect(electronicsBlock).toContain('float electronicBodyStyle(float material)');
    for (const material of materials) expect(electronicsBlock).toContain(`material == ${material}.0`);
    for (const excluded of [137, 148, 155, 158, 159, 160, 161, 162, 163]) {
      expect(electronicsBlock).not.toContain(`material == ${excluded}.0`);
    }
    expect(electronicsBlock).not.toMatch(/texture\s*\(/);
    expect(electronicsBlock).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('keeps normal and true-8x Field-profile identities on one RGB-only switch', () => {
    const presenter = presenterHarness();

    presenter.setFieldProfileIdentityStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uFieldProfileIdentityStyling).toBe(0);
    expect(presenter.app.render).toHaveBeenCalledOnce();

    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const eightStart = source.indexOf('const FIELD_EIGHT_X_FRAGMENT = `');
    const normalStart = source.indexOf('const FIELD_FRAGMENT = `');
    const eight = source.slice(eightStart, normalStart);
    const helperStart = source.indexOf('// Exact default-optics Field bodies need more than the generic animated wave');
    const helperEnd = source.indexOf('float structuralRigidDeepIdentityGain(', helperStart);
    const normalHelper = source.slice(helperStart, helperEnd);
    expect(eight).toContain('uniform float uFieldProfileIdentityStyling;');
    expect(eight).toContain('uFieldProfileIdentityStyling > 0.5');
    expect(source.slice(normalStart)).toContain('uniform float uFieldProfileIdentityStyling;');
    expect(source).toContain('uFieldProfileIdentityStyling: { value: 1, type: \'f32\' }');
    expect(source).toContain('uFieldProfileIdentityStyling > 0.5 && family == 0.0 && profile == 6.0');
    expect(normalHelper).toContain('vec3 fieldProfileIdentityDelta(float material, vec2 position)');
    for (const owner of [125, 128, 129, 130, 131, 132, 133, 134]) {
      expect(normalHelper).toContain(`material == ${owner}.0`);
    }
    expect(normalHelper).not.toMatch(/texture\s*\(/);
    expect(normalHelper).not.toContain('uTime');
    expect(normalHelper).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('seeds and redraws the independent earthen powder identity layer', () => {
    const presenter = presenterHarness();

    presenter.setEarthenPowderStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uEarthenPowderStyling).toBe(0);
    expect(presenter.app.render).toHaveBeenCalledOnce();

    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const start = source.indexOf('// Keep the exact low-frequency Earth/mineral powder grammar');
    const end = source.indexOf('vec3 vibrStateDelta(', start);
    const earthenBlock = source.slice(start, end);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(source).toContain('uniform float uEarthenPowderStyling;');
    expect(source).toContain('uEarthenPowderStyling: { value: 1, type: \'f32\' }');
    expect(source).toContain('uEarthenPowderStyling > 0.5\n        && (material == 6.0 || material == 21.0 || material == 26.0 || material == 28.0)');
    expect(earthenBlock).toContain('vec3 earthenPowderIdentityDelta(float material, vec2 position)');
    expect(earthenBlock).toContain('if (material == 6.0)');
    expect(earthenBlock).toContain('if (material == 28.0)');
    expect(earthenBlock).not.toMatch(/texture\s*\(/);
    expect(earthenBlock).not.toMatch(/\balpha\s*[+*]?=/);
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
    expect(source).toContain('float sensorPanelCore = 0.0;');
    expect(source).toContain('solidOpticalDepth > 6.0 / 255.0 && solidInterior > 0.001');
    expect(source).toContain('float circuitInteriorGain = mix(1.0, 0.26, sensorPanelCore)');
    expect(source).toContain('* mix(1.0, 0.38, fourXDeviceCalm);');
    expect(source).toContain('* interiorMicroGain * circuitInteriorGain;');
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
    expect(sensorBlock).toContain('float sensorPanelRelief = clamp(solidReliefTone * 255.0 / 6.0, -1.0, 1.0)');
    expect(sensorBlock).toContain('float sensorPanelGrazing = smoothstep(0.018, 0.18, solidFresnel) * sensorPanelCore;');
    expect(sensorBlock).toContain('sensorPanelPocket * 0.62 + (1.0 - sensorPanelGrazing) * 0.045');
    expect(sensorBlock).toContain('sensorPanelCrown * 0.098 + sensorPanelGrazing * 0.052');
    expect(sensorBlock).toContain('float sensorGlyphGain = mix(1.0, 0.36, sensorPanelCore);');
    expect(sensorBlock).toContain('float sensorBezelGain = mix(1.0, 0.42, sensorPanelCore);');
    expect(sensorBlock).toContain('sensorBezel * 0.030 * sensorBezelGain');
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
    const start = source.indexOf('// Thirteen distinct native powders share the existing deterministic grain');
    const end = source.indexOf('      color *= 1.0 + powderMacroRelief;', start);
    const unusualBlock = source.slice(start, end);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(source).toContain('uniform float uUnusualPowderStyling;');
    expect(unusualBlock).toContain('uUnusualPowderStyling > 0.5 && unusualPowder > 0.5');
    expect(unusualBlock).toContain('family == 4.0 && traits < 0.5 && !materialEmissive');
    expect(unusualBlock).toContain('surfaceOnly < 0.5 && halo < 0.5 && wall < 0.5');
    expect(unusualBlock).toContain('wallOnly < 0.5 && emissionOnly < 0.5');
    for (const material of [7, 18, 29, 43, 44, 45, 46, 47, 48, 49, 51, 198, 217]) {
      expect(unusualBlock).toContain(`material == ${material}.0`);
    }
    expect(unusualBlock).toContain('// SALT: warm cubic cleavages remain sparse across a settled crystal body.');
    expect(unusualBlock).toContain('// SNOW: cool, soft flake intersections keep the powder light but legible.');
    expect(unusualBlock).toContain('// PQRT: lilac angular planes establish a baseline beneath native crystal state.');
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
    for (const motif of [
      'ring', 'axial', 'vein', 'canopyFacet', 'canopyCross', 'canopyCrown', 'canopyPocket', 'strand',
      'node', 'husk', 'embryo', 'cellRim', 'bud',
    ]) {
      expect(helper).toContain(motif);
    }
    expect(helper).toContain('vec3 leafVein = vec3(leaf * 1.5 - vein * 3.0, leaf * 3.5 + vein * 6.0,');
    expect(helper).toContain('leaf - vein * 2.5) * plantFineGain;');
    expect(helper).toContain('float material, vec2 position, float plantFineGain, float bodyReplacement');
    expect(helper).toContain('if (bodyReplacement > 0.5 && plantFineGain < 0.2)');
    expect(helper).toContain('clamp(delta, vec3(-12.0), vec3(12.0)) / 255.0');
    expect(helper).not.toContain('texture(');
    expect(helper).not.toContain('uTime');
    expect(helper).not.toMatch(/\balpha\s*[+*]?=/);
    expect(source).toContain('botanicalIdentity > 0.5 && uBotanicalIdentityStyling > 0.5');
    expect(source).toContain('float canopyFineIdentityGain = 1.0;');
    expect(source).toContain('material == 10.0 && uSolidOpticalDepth > 0.5');
    expect(source).toContain('wallOnly < 0.5 && emissionOnly < 0.5');
    expect(source).toContain('canopyFineIdentityGain = mix(1.0, 0.42, canopyFineBody);');
    expect(source).toContain(
      'material, fieldPosition, canopyFineIdentityGain, botanicalBodyReplacement',
    );
    const canopyStart = source.indexOf('// PLNT has native topology and lifecycle cues below;');
    const canopyEnd = source.indexOf('// Reuse the semantic Hermite normal', canopyStart);
    const canopy = source.slice(canopyStart, canopyEnd);
    expect(canopyStart).toBeGreaterThan(0);
    expect(canopyEnd).toBeGreaterThan(canopyStart);
    expect(canopy).toContain('material == 10.0');
    expect(canopy).toContain('solidOpticalDepth > 6.0 / 255.0');
    expect(canopy).toContain('solidInterior > 0.001');
    expect(canopy).toContain('solidReliefTone * 255.0 / 6.0');
    expect(canopy).toContain('float canopySheen = (0.009 + specular * 0.036) * canopyDepth;');
    expect(canopy).toContain('vividColor(color, 1.10)');
    expect(canopy).toContain('float canopyCluster = mod(floor(fieldPosition.x / 3.0) * 17.0');
    expect(canopy).toContain('float canopyClusterVein = 1.0 - step(0.5, mod(');
    expect(canopy).not.toContain('texture(');
    expect(canopy).not.toMatch(/\balpha\s*[+*]?=/);
  });

  it('decodes native SEED/PLNT lifecycle state with sample-free RGB-only arithmetic', () => {
    const presenter = presenterHarness();
    presenter.setBotanicalLifecycleStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uBotanicalLifecycleStyling).toBe(0);
    expect(presenter.app.render).toHaveBeenCalledOnce();
    presenter.app.render.mockClear();
    presenter.setBotanicalLifecycleStylingEnabled(true);
    expect(presenter.uniforms.uniforms.uBotanicalLifecycleStyling).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledOnce();

    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const start = source.indexOf('vec3 botanicalLifecycleDelta(');
    const end = source.indexOf('float thermalOpticsGain', start);
    const helper = source.slice(start, end);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(source).toContain('uniform float uBotanicalLifecycleStyling;');
    expect(helper).toContain('material == 50.0');
    expect(helper).toContain('material != 10.0');
    expect(helper).toContain('packedState / 32768.0');
    expect(helper).toContain('packedState / 4096.0');
    expect(helper).toContain('packedState / 16384.0');
    expect(helper).toContain('if (tree < 0.5) return vec3(0.0);');
    expect(helper).toContain('vec3(-64.0 / 255.0)');
    expect(helper).not.toMatch(/texture\s*\(/);
    expect(helper).not.toContain('uTime');
    expect(helper).not.toMatch(/\balpha\s*[+*]?=/);
    expect(source).toContain(
      'color += botanicalLifecycleDelta(material, wallState.ba, fieldPosition, color);',
    );
  });

  it('decodes exact SPRK host and life with sample-free RGB-only arithmetic', () => {
    const presenter = presenterHarness();
    presenter.setSparkStateStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uSparkStateStyling).toBe(0);
    expect(presenter.app.render).toHaveBeenCalledOnce();
    presenter.app.render.mockClear();
    presenter.setSparkStateStylingEnabled(true);
    expect(presenter.uniforms.uniforms.uSparkStateStyling).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledOnce();

    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const start = source.indexOf('float sparkHostFamily(');
    const end = source.indexOf('float thermalOpticsGain', start);
    const helper = source.slice(start, end);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(source).toContain('uniform float uSparkStateStyling;');
    expect(helper).toContain('material != 148.0');
    expect(helper).toContain('packedState / 32768.0');
    expect(helper).toContain('mod(packedState, 256.0)');
    expect(helper).toContain('mod(floor(packedState / 256.0), 128.0)');
    expect(helper).not.toContain('153.0');
    expect(helper).not.toMatch(/texture\s*\(/);
    expect(helper).not.toContain('uTime');
    expect(helper).not.toMatch(/\balpha\s*[+*]?=/);
    expect(source).toContain(
      'color += sparkStateDelta(material, wallState.ba, fieldPosition, color);',
    );
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
    const start = source.indexOf('// Seventeen uncommon solids layer one static identity');
    const end = source.indexOf('    if (uThermalMaterialStyling > 0.5', start);
    const unusualSolidBlock = source.slice(start, end);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(source).toContain('uniform float uUnusualSolidStyling;');
    expect(unusualSolidBlock).toContain('uUnusualSolidStyling > 0.5 && unusualSolid > 0.5');
    expect(unusualSolidBlock).toContain('family == 0.0 && !materialEmissive');
    expect(unusualSolidBlock).toContain('surfaceOnly < 0.5 && halo < 0.5 && wall < 0.5');
    expect(unusualSolidBlock).toContain('wallOnly < 0.5 && emissionOnly < 0.5 && (traits < 0.5 || material == 216.0)');
    for (const material of [27, 68, 74, 76, 77, 79, 80, 196, 203, 204, 206, 208, 209, 210, 211, 212, 216]) {
      expect(unusualSolidBlock).toContain(`material == ${material}.0`);
    }
    expect(unusualSolidBlock).toContain('// LOLZ: a static face/ribbon lattice');
    expect(unusualSolidBlock).toContain('// LOVE: paired lobes and a tapered point');
    expect(unusualSolidBlock).toContain('// SPAWN/SPAWN2: distinct primary/secondary beacon rings');
    expect(unusualSolidBlock).toContain('// BIZRS: angular prismatic facets split cool and warm reflections.');
    expect(unusualSolidBlock).toContain('// RSSS/PSTS: native solid products retain their liquid family\'s exact');
    expect(unusualSolidBlock).toContain('// SHLD1-4: one coherent shell gains progressively nested armour bands.');
    expect(unusualSolidBlock).toContain('// VRSS: the same family capsid is carried by the rigid solid body.');
    expect(unusualSolidBlock).toContain('// WAX: crystalline blooms and cooling lamellae share MWAX\'s topology.');
    expect(unusualSolidBlock).toContain('crystallineSolidIdentityDelta(material, fieldPosition)');
    expect(unusualSolidBlock).toContain('virusFamilyIdentityDelta(2.0, fieldPosition)');
    expect(unusualSolidBlock).toContain('solidDepth');
    expect(unusualSolidBlock).toContain('vec3 unusualSolidBase = color;');
    expect(unusualSolidBlock).toContain('mix(unusualSolidBase, color, staticSolidIdentityGain)');
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

  it('keeps true-8x solid field lighting RGB-only on already-live shader state', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const start = source.indexOf('// True 8x deliberately reuses the centre emission sample');
    const end = source.indexOf('// TranslucentRigid is the intentional presentation-alpha exception.', start);
    const compactBlock = source.slice(start, end);

    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(compactBlock).toContain('uSolidFieldLighting > 0.5 && family == 0.0 && traits < 0.5');
    expect(compactBlock).toContain('!materialEmissive && optics != 12.0 && material != 3.0');
    expect(compactBlock).toContain('q00 * q10 * q01 * q11');
    expect(compactBlock).toContain('emission.a > 0.002');
    expect(compactBlock).toContain('color += (vec3(1.0) - clamp(color, 0.0, 1.0))');
    expect(compactBlock).not.toContain('texture(');
    expect(compactBlock).not.toMatch(/\b(?:finalColor|alpha)\s*[+*]?=/);
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
    expect(cohesionBlock).toContain('float liquidCohesionStrength = mix(');
    expect(cohesionBlock).toContain('0.82, 0.96, smoothstep(0.56, 0.78, liquidNeighbourMean)');
    expect(cohesionBlock).toContain('liquidAirContour * liquidCohesionStrength');
    expect(cohesionBlock).not.toContain('texture(');
    expect(cohesionBlock).not.toMatch(/\bcolor\s*[+*]?=/);
    expect(contactBlock.match(/materialAt\(/g)).toHaveLength(1);
    expect(contactBlock.match(/texture\(/g)).toHaveLength(1);
    expect(resourcesBlock).not.toContain('uLiquidSilhouetteCohesion');
    expect(source).not.toContain('sampler2D uLiquidSilhouetteCohesion');
  });

  it('keeps the bounded live unlike-liquid interface relief in the final body colour', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const bodyStart = source.indexOf('    color = liquidBase * mix(1.24, depthTransmission, liquidDepth)');
    const bodyEnd = source.indexOf('    float liquidFresnelStrength =', bodyStart);
    const bodyBlock = source.slice(bodyStart, bodyEnd);

    expect(bodyStart).toBeGreaterThan(0);
    expect(bodyEnd).toBeGreaterThan(bodyStart);
    expect(bodyBlock).toContain('color *= 1.0 + liquidMacroRelief + liquidInterfaceRelief;');
    expect(bodyBlock).not.toContain('liquidInterfaceRelief *');
  });

  it('keeps WebGL water sheen oblique, restrained, and resource-free', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const start = source.indexOf('// Keep broad-liquid light legible at normal zoom');
    const end = source.indexOf('    float liquidInterfaceRelief =', start);
    const block = source.slice(start, end);

    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(block).toContain('fieldPosition.x * 0.031 + fieldPosition.y * 0.023');
    expect(block).toContain('fieldPosition.y * 0.043 - fieldPosition.x * 0.019');
    expect(block).toContain('fieldPosition.x * 0.061 + fieldPosition.y * 0.021');
    expect(block).toContain('float macroSheenGain = 0.040 + aqueous * 0.095');
    expect(block).toContain('float macroCausticGain = 0.035 + aqueous * 0.105');
    expect(block).not.toContain('texture(');
    expect(block).not.toMatch(/\b(?:alpha|density|support)\s*[+*]?=/);
  });

  it('keeps Oil\'s capped unlike-liquid rim after final body composition', () => {
    const source = readFileSync(new URL('./pixi-field-presenter.ts', import.meta.url), 'utf8');
    const bodyStart = source.indexOf('    color = liquidBase * mix(1.24, depthTransmission, liquidDepth)');
    const bodyEnd = source.indexOf('    float liquidFresnelStrength =', bodyStart);
    const bodyBlock = source.slice(bodyStart, bodyEnd);

    expect(bodyBlock).toContain('&& oily > 0.5)');
    expect(bodyBlock).toContain('float oilInterfaceRim = min(');
    expect(bodyBlock).toContain(
      '0.052, min(abs(liquidInterfaceRelief), 0.12) * liquidDepth * 0.85',
    );
    expect(bodyBlock).toContain('* liquidFresnelKey * oilInterfaceRim;');
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

    // The queued mutation was consumed by the one follow-up draw. A later
    // fence completion must retire it rather than resubmitting an unchanged
    // 15M-fragment frame forever.
    scheduled?.(performance.now());
    expect(presenter.app.render).toHaveBeenCalledTimes(2);
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

  it('recovers a promoted 8x fence at the deadline even when rAF stops', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 41));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const fence = {} as WebGLSync;
    const gl = {
      SYNC_GPU_COMMANDS_COMPLETE: 0x9117,
      fenceSync: vi.fn(() => fence),
      deleteSync: vi.fn(),
      flush: vi.fn(),
    };
    const stalled = vi.fn();
    const presenter = presenterHarness();
    Object.assign(presenter, {
      outputScale: 8,
      firstFrameReady: true,
      destroyed: false,
      contextLost: false,
      app: { ...presenter.app, renderer: { gl } },
    });
    presenter.setRenderStallHandler(stalled);

    presenter.setGasFieldLightingEnabled(true);

    expect(gl.fenceSync).toHaveBeenCalledOnce();
    expect(stalled).not.toHaveBeenCalled();
    vi.advanceTimersByTime(WEBGL_EIGHT_X_FRAME_STALL_MS - 1);
    expect(stalled).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    expect(gl.deleteSync).toHaveBeenCalledWith(fence);
    expect(stalled).toHaveBeenCalledOnce();
    expect(presenter.app.render).toHaveBeenCalledOnce();
  });

  it('cancels the promoted 8x watchdog when its fence releases normally', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 43));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const fence = {} as WebGLSync;
    const gl = {
      SYNC_GPU_COMMANDS_COMPLETE: 0x9117,
      fenceSync: vi.fn(() => fence),
      deleteSync: vi.fn(),
      flush: vi.fn(),
    };
    const stalled = vi.fn();
    const presenter = presenterHarness();
    Object.assign(presenter, {
      outputScale: 8,
      firstFrameReady: true,
      destroyed: false,
      contextLost: false,
      app: { ...presenter.app, renderer: { gl } },
    });
    presenter.setRenderStallHandler(stalled);

    presenter.setGasFieldLightingEnabled(true);
    (presenter as unknown as { releaseRenderFence(): void }).releaseRenderFence();
    vi.advanceTimersByTime(WEBGL_EIGHT_X_FRAME_STALL_MS);

    expect(gl.deleteSync).toHaveBeenCalledWith(fence);
    expect(stalled).not.toHaveBeenCalled();
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

  it('retries an ordinary true-8x fence with the non-blocking flush bit', () => {
    const fence = {} as WebGLSync;
    const gl = {
      TIMEOUT_EXPIRED: 0x911b,
      CONDITION_SATISFIED: 0x911c,
      SYNC_FLUSH_COMMANDS_BIT: 0x00000001,
      clientWaitSync: vi.fn()
        .mockReturnValueOnce(0x911b)
        .mockReturnValueOnce(0x911c),
      deleteSync: vi.fn(),
    };
    const presenter = presenterHarness();
    Object.assign(presenter, {
      outputScale: 8,
      firstFrameReady: true,
      renderFence: fence,
      app: { ...presenter.app, renderer: { gl } },
    });

    expect((presenter as unknown as { prepareEightXRender(): boolean }).prepareEightXRender()).toBe(true);
    expect(gl.clientWaitSync).toHaveBeenNthCalledWith(1, fence, 0, 0);
    expect(gl.clientWaitSync).toHaveBeenNthCalledWith(2, fence, gl.SYNC_FLUSH_COMMANDS_BIT, 0);
    expect(gl.deleteSync).toHaveBeenCalledWith(fence);
  });
});
