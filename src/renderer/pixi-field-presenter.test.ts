import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  digestFramebufferAlpha,
  PixiFieldPresenter,
  type WebGLCompletedFrameReceipt,
  type WebGLFramebufferAlphaReadback,
} from './pixi-field-presenter';
import { powderRenderStyleValue } from './powder-render-style';
import {
  WEBGL_COMPLETED_FRAME_RECEIPT_TIMEOUT_MS,
  WEBGL_EIGHT_X_FRAME_STALL_MS, type FieldOutputScale,
} from './render-resolution';
import { Material } from '../shared/materials';
import { RenderPhase } from './render-profile';
import { DirtyChunkGrid } from './dirty-chunk-grid';
import { updateBoundaryStabilityRect } from './boundary-stability-field';
import { PowderSurfaceField } from './powder-surface-field';
import { RenderFieldDirtyLane } from './render-field-set';

interface PresenterHarness {
  readonly uniforms: { readonly uniforms: Record<string, number> };
  readonly app: {
    readonly canvas: {
      readonly style: { transform: string };
      readonly dataset: Record<string, string>;
      readonly width: number;
      readonly height: number;
    };
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
  setPowderRenderStyle: PixiFieldPresenter['setPowderRenderStyle'];
  setSurfaceContourLightingEnabled: PixiFieldPresenter['setSurfaceContourLightingEnabled'];
  setPhaseContactLightingEnabled: PixiFieldPresenter['setPhaseContactLightingEnabled'];
  setSolidFieldLightingEnabled: PixiFieldPresenter['setSolidFieldLightingEnabled'];
  setDenseBodyAmbientFillEnabled: PixiFieldPresenter['setDenseBodyAmbientFillEnabled'];
  setPhotonMetalIrradianceVfxEnabled: PixiFieldPresenter['setPhotonMetalIrradianceVfxEnabled'];
  setCeramicBlackbodyVfxEnabled: PixiFieldPresenter['setCeramicBlackbodyVfxEnabled'];
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
  setBaseStateStylingEnabled: PixiFieldPresenter['setBaseStateStylingEnabled'];
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
  setPlantCanopyInterlockVfxEnabled: PixiFieldPresenter['setPlantCanopyInterlockVfxEnabled'];
  setPlantCanopyHierarchyVfxEnabled: PixiFieldPresenter['setPlantCanopyHierarchyVfxEnabled'];
  setPlantCanopyFoliageVfxEnabled: PixiFieldPresenter['setPlantCanopyFoliageVfxEnabled'];
  setRockWeatheredFacetVfxEnabled: PixiFieldPresenter['setRockWeatheredFacetVfxEnabled'];
  setIszsCrystalHierarchyVfxEnabled: PixiFieldPresenter['setIszsCrystalHierarchyVfxEnabled'];
  setSparkStateStylingEnabled: PixiFieldPresenter['setSparkStateStylingEnabled'];
  setLiquidSilhouetteCohesionEnabled: PixiFieldPresenter['setLiquidSilhouetteCohesionEnabled'];
  setRenderStallHandler: PixiFieldPresenter['setRenderStallHandler'];
  forceEightXRenderStallForAudit: PixiFieldPresenter['forceEightXRenderStallForAudit'];
  setTransform: PixiFieldPresenter['setTransform'];
  waitForFirstFrame: PixiFieldPresenter['waitForFirstFrame'];
  enableWebGLPresentationTiming: PixiFieldPresenter['enableWebGLPresentationTiming'];
  requestWebGLPresentationTimingSample: PixiFieldPresenter['requestWebGLPresentationTimingSample'];
  getWebGLPresentationTiming: PixiFieldPresenter['getWebGLPresentationTiming'];
  requestWebGLCompletedFrameReceipt: PixiFieldPresenter['requestWebGLCompletedFrameReceipt'];
  runWithNextWebGLCompletedFrameReceipt:
    PixiFieldPresenter['runWithNextWebGLCompletedFrameReceipt'];
  runWithNextWebGLCompletedFrameReceiptAndFramebufferAlphaReadback:
    PixiFieldPresenter['runWithNextWebGLCompletedFrameReceiptAndFramebufferAlphaReadback'];
  getWebGLCompletedFrameReceipt: PixiFieldPresenter['getWebGLCompletedFrameReceipt'];
  requestWebGLFramebufferAlphaReadback: PixiFieldPresenter['requestWebGLFramebufferAlphaReadback'];
  getWebGLFramebufferAlphaReadback: PixiFieldPresenter['getWebGLFramebufferAlphaReadback'];
  webGLTimingRequested: boolean;
  webGLTimingSequence: number;
  presentationSubmission: number;
  completedFrameTicketSequence: number;
  completedFrameFencePoll: number;
  completedFrameFenceWatchdog: ReturnType<typeof setTimeout> | undefined;
  framebufferAlphaReadbackTicketSequence: number;
  framebufferAlphaReadbackPoll: number;
  framebufferAlphaReadbackWatchdog: ReturnType<typeof setTimeout> | undefined;
  framebufferAlphaReadbackBuffer: WebGLBuffer | undefined;
  framebufferAlphaReadbackBufferByteLength: number;
  renderFenceSubmission: number;
}

function presenterHarness(outputScale = 2): PresenterHarness {
  const presenter = Object.create(PixiFieldPresenter.prototype) as PresenterHarness;
  Object.assign(presenter, {
    uniforms: { uniforms: {} },
    app: {
      canvas: { style: { transform: '' }, dataset: {}, width: 2, height: 1 },
      render: vi.fn(),
    },
    firstFrameReady: false,
    firstFrameFailed: false,
    firstFrameWaiters: new Set(),
    outputScale,
    destroyed: false,
    contextLost: false,
    webGLTimingEnabled: false,
    webGLTimingRequested: false,
    webGLTimingSamples: [],
    webGLTimingDiscarded: 0,
    webGLTimingSequence: 0,
    webGLTimingQueryPoll: 0,
    webGLTimingPendingAdaptive: false,
    webGLTimingFenceStartedAt: 0,
    webGLTimingFencePoll: 0,
    presentationSubmission: 0,
    completedFrameTicketSequence: 0,
    completedFrameFencePoll: 0,
    completedFrameFenceWatchdog: undefined,
    framebufferAlphaReadbackTicketSequence: 0,
    framebufferAlphaReadbackPoll: 0,
    framebufferAlphaReadbackWatchdog: undefined,
    framebufferAlphaReadbackBuffer: undefined,
    framebufferAlphaReadbackBufferByteLength: 0,
    renderFencePoll: 0,
    renderFenceWatchdog: undefined,
    renderFenceSubmission: 0,
    renderQueued: false,
    renderFenceStallForcedForAudit: false,
  });
  return presenter;
}

// Appearance is reviewed in the running browser (audit:field). These unit
// tests cover uploads, controls, GPU completion, recovery, and resource lifetime.
// Do not freeze shader formulas, local variable names, or texture sample counts.
describe('Pixi presenter behavior', () => {
  it('maps each v7-owned field lane to its exact upload without an intermediate render', () => {
    const drainActivationOwned = vi.fn(() => (
      RenderFieldDirtyLane.Atmosphere
        | RenderFieldDirtyLane.Liquid
        | RenderFieldDirtyLane.Emission
        | RenderFieldDirtyLane.Suspension
    ));
    const atmosphereSource = { update: vi.fn() };
    const atmosphereStyleSource = { update: vi.fn() };
    const liquidSource = { update: vi.fn() };
    const liquidOpticsSource = { update: vi.fn() };
    const emissionSource = { update: vi.fn() };
    const longRangeEmissionSource = { update: vi.fn() };
    const suspensionSource = { update: vi.fn() };
    const writeVerticalOpticalDepth = vi.fn();
    const renderApplication = vi.fn();
    const presenter = Object.create(PixiFieldPresenter.prototype) as unknown as {
      fieldSet: {
        drainActivationOwned: typeof drainActivationOwned;
        liquid: { writeVerticalOpticalDepth: typeof writeVerticalOpticalDepth };
        suspension: { hasSuspension: boolean };
      };
      atmosphereSource: typeof atmosphereSource;
      atmosphereStyleSource: typeof atmosphereStyleSource;
      liquidSource: typeof liquidSource;
      liquidOpticsSource: typeof liquidOpticsSource;
      emissionSource: typeof emissionSource;
      longRangeEmissionSource?: typeof longRangeEmissionSource;
      suspensionSource: typeof suspensionSource;
      boundaryStabilityBytes: Uint8Array;
      liquidOpticalDepthHydrated: boolean;
      atmosphereMotionHydrated: boolean;
      uniforms: { uniforms: Record<string, number> };
      renderApplication: typeof renderApplication;
      drainFixtureActivationVolumeFields(
        owner: number, materials: Uint8Array, scheduleTime: number, walls: Uint8Array | undefined,
        velocities: Int8Array | undefined, temperatures: Uint16Array | undefined, gasMotionActive: boolean,
      ): boolean;
    };
    Object.assign(presenter, {
      fieldSet: {
        drainActivationOwned,
        liquid: { writeVerticalOpticalDepth },
        suspension: { hasSuspension: true },
      },
      atmosphereSource,
      atmosphereStyleSource,
      liquidSource,
      liquidOpticsSource,
      emissionSource,
      longRangeEmissionSource,
      suspensionSource,
      boundaryStabilityBytes: new Uint8Array(16),
      liquidOpticalDepthHydrated: false,
      atmosphereMotionHydrated: false,
      uniforms: { uniforms: {} },
      renderApplication,
    });

    expect(presenter.drainFixtureActivationVolumeFields(
      7, new Uint8Array(16), 100, undefined, undefined, undefined, true,
    )).toBe(true);
    expect(drainActivationOwned).toHaveBeenCalledOnce();
    expect(drainActivationOwned).toHaveBeenLastCalledWith(
      7, expect.any(Uint8Array), 100, undefined, undefined, undefined,
    );
    for (const source of [
      atmosphereSource, atmosphereStyleSource, liquidSource, liquidOpticsSource,
      emissionSource, longRangeEmissionSource, suspensionSource,
    ]) expect(source.update).toHaveBeenCalledOnce();
    expect(writeVerticalOpticalDepth).toHaveBeenCalledOnce();
    expect(presenter.atmosphereMotionHydrated).toBe(true);
    expect(presenter.uniforms.uniforms.uSuspensionActive).toBe(1);
    expect(renderApplication).not.toHaveBeenCalled();
  });

  it('keeps v6, owner-zero, and true-8x work on the ordinary volume cadence', () => {
    const presenter = Object.create(PixiFieldPresenter.prototype) as unknown as {
      fixtureActivationCaptureOwner: number;
      fixtureActivationSubmissionOwner: number;
      fixtureActivationSubmissionBaseline: number;
      fixtureActivationDrainVolumeFieldsOwner: number;
      fixtureActivationFramebufferAlphaReadbackOwner: number;
      fixtureActivationFullSemanticRepackOwner: number;
      fixtureActivationFullWallRepackOwner: number;
      fixtureActivationFramebufferAlphaReadback?: unknown;
      presentationSubmission: number;
      beginFixtureActivationPresentationWork(owner: number, drain?: boolean, fullRepack?: boolean): void;
    };
    Object.assign(presenter, { presentationSubmission: 4 });
    presenter.beginFixtureActivationPresentationWork(7);
    expect(presenter.fixtureActivationDrainVolumeFieldsOwner).toBe(0);
    presenter.beginFixtureActivationPresentationWork(8, true);
    expect(presenter.fixtureActivationDrainVolumeFieldsOwner).toBe(8);
    presenter.beginFixtureActivationPresentationWork(9, true, true);
    expect(presenter.fixtureActivationFullSemanticRepackOwner).toBe(9);
    expect(presenter.fixtureActivationFullWallRepackOwner).toBe(0);
  });

  it('coalesces only activation-owned wall dirt behind its required full repacks', () => {
    const semanticMarkCell = vi.fn();
    const wallMarkCell = vi.fn();
    const presenter = Object.create(PixiFieldPresenter.prototype) as any;
    Object.assign(presenter, {
      chunks: { markCell: semanticMarkCell },
      wallChunks: { markCell: wallMarkCell },
      fieldSet: { markAtmosphereBlockerDirty: vi.fn() },
      fixtureActivationCaptureOwner: 11,
      fixtureActivationFullSemanticRepackOwner: 11,
      fixtureActivationFullWallRepackOwner: 0,
      semanticTextureMutationPending: false,
      powderSurfaceDirty: false,
      solidOpticalDepthDirty: false,
    });

    presenter.markWallDirty(37);
    expect(semanticMarkCell).not.toHaveBeenCalled();
    expect(wallMarkCell).not.toHaveBeenCalled();
    expect(presenter.fixtureActivationFullWallRepackOwner).toBe(11);
    expect(presenter.fieldSet.markAtmosphereBlockerDirty).toHaveBeenCalledWith(37, 11);
    expect(presenter.fixtureActivationSemanticOwner).toBe(11);
    expect(presenter.fixtureActivationBoundaryOwner).toBe(11);
    expect(presenter.fixtureActivationPowderOwner).toBe(11);
    expect(presenter.fixtureActivationSolidOwner).toBe(11);
    expect(presenter.powderSurfaceDirty).toBe(true);
    expect(presenter.solidOpticalDepthDirty).toBe(true);

    presenter.fixtureActivationCaptureOwner = 0;
    presenter.markWallDirty(38);
    expect(semanticMarkCell).toHaveBeenCalledWith(38);
    expect(wallMarkCell).toHaveBeenCalledWith(38);
  });

  it('restores both full dirt grids when an activation transaction rejects', () => {
    const semanticMarkAll = vi.fn();
    const wallMarkAll = vi.fn();
    const presenter = Object.create(PixiFieldPresenter.prototype) as any;
    Object.assign(presenter, {
      chunks: { markAll: semanticMarkAll },
      wallChunks: { markAll: wallMarkAll },
      fixtureActivationDrainVolumeFieldsOwner: 13,
      fixtureActivationFullSemanticRepackOwner: 13,
      fixtureActivationFullWallRepackOwner: 13,
    });

    presenter.cancelFixtureActivationDrainedWork(13);
    expect(semanticMarkAll).toHaveBeenCalledOnce();
    expect(wallMarkAll).toHaveBeenCalledOnce();
    expect(presenter.fixtureActivationFullSemanticRepackOwner).toBe(0);
    expect(presenter.fixtureActivationFullWallRepackOwner).toBe(0);
  });

  it('skips only activation-owned chunk dirt when a full semantic repack is reserved', () => {
    const markCell = vi.fn();
    const markDirty = vi.fn();
    const presenter = Object.create(PixiFieldPresenter.prototype) as any;
    Object.assign(presenter, {
      fieldBytes: new Uint8Array(8),
      chunks: { markCell },
      fieldSet: {
        markDirty,
        lookups: { styleBytes: new Uint8Array(1024) },
      },
      fixtureActivationCaptureOwner: 7,
      fixtureActivationFullSemanticRepackOwner: 7,
      semanticTextureMutationPending: false,
      powderSurfaceDirty: false,
      solidOpticalDepthDirty: false,
    });

    presenter.markDirty(1, Material.Water);
    expect(markCell).not.toHaveBeenCalled();
    expect(markDirty).toHaveBeenCalledWith(Material.Empty, Material.Water, 1, 7);
    expect(presenter.semanticTextureMutationPending).toBe(true);

    presenter.fixtureActivationCaptureOwner = 0;
    presenter.markDirty(1, Material.Water);
    expect(markCell).toHaveBeenCalledWith(1);
  });

  it('ignores preexisting dirt but waits for every activation-owned successor lane', () => {
    const presenter = Object.create(PixiFieldPresenter.prototype) as unknown as {
      semanticTextureMutationPending: boolean;
      boundaryEvolutionPending: boolean;
      powderSurfaceDirty: boolean;
      solidOpticalDepthDirty: boolean;
      presentationSubmission: number;
      fixtureActivationSubmissionOwner: number;
      fixtureActivationSubmissionBaseline: number;
      fixtureActivationSemanticOwner: number;
      fixtureActivationBoundaryOwner: number;
      fixtureActivationPowderOwner: number;
      fixtureActivationSolidOwner: number;
      fixtureActivationDynamicOwner: number;
      fieldSet: { hasPendingRefreshFor(owner: number): boolean };
      fixtureActivationPresentationSettled(owner: number): boolean;
    };
    Object.assign(presenter, {
      semanticTextureMutationPending: true,
      boundaryEvolutionPending: true,
      powderSurfaceDirty: true,
      solidOpticalDepthDirty: true,
      presentationSubmission: 4,
      fixtureActivationSubmissionOwner: 7,
      fixtureActivationSubmissionBaseline: 3,
      fixtureActivationSemanticOwner: 0,
      fixtureActivationBoundaryOwner: 0,
      fixtureActivationPowderOwner: 0,
      fixtureActivationSolidOwner: 0,
      fixtureActivationDynamicOwner: 0,
      fieldSet: { hasPendingRefreshFor: () => false },
    });
    expect(presenter.fixtureActivationPresentationSettled(7)).toBe(true);
    for (const pending of [
      'fixtureActivationSemanticOwner', 'fixtureActivationBoundaryOwner',
      'fixtureActivationPowderOwner', 'fixtureActivationSolidOwner',
      'fixtureActivationDynamicOwner',
    ] as const) {
      presenter[pending] = 7;
      expect(presenter.fixtureActivationPresentationSettled(7)).toBe(false);
      presenter[pending] = 0;
    }
    presenter.fieldSet.hasPendingRefreshFor = (owner) => owner === 7;
    expect(presenter.fixtureActivationPresentationSettled(7)).toBe(false);
    presenter.fieldSet.hasPendingRefreshFor = () => false;
    presenter.presentationSubmission = 3;
    expect(presenter.fixtureActivationPresentationSettled(7)).toBe(false);
  });

  it('converges v2-owned powder stability byte-exactly without intermediate submissions', () => {
    const width = 7;
    const height = 7;
    const materials = new Uint8Array(width * height);
    materials.fill(Material.Sand, width + 1, materials.length - width - 1);
    const velocities = new Int8Array(materials.length * 2);
    const styles = new Uint8Array(256 * 4);
    styles[Material.Sand * 4] = RenderPhase.Powder;
    const rect = { x: 0, y: 0, width, height };
    const conventional = new Uint8Array(materials.length);
    const conventionalOwners = new Uint8Array(materials.length);
    for (let pass = 0; pass < 8; pass++) updateBoundaryStabilityRect(
      conventional, conventionalOwners, materials, velocities, styles, width, rect,
    );

    const chunks = new DirtyChunkGrid(width, height, width, 0);
    chunks.markAll();
    const renderApplication = vi.fn();
    const presenter = Object.create(PixiFieldPresenter.prototype) as unknown as {
      boundaryStabilityBytes: Uint8Array;
      boundaryStabilityOwners: Uint8Array;
      chunks: DirtyChunkGrid;
      boundaryDirtyMarker: { markCell(index: number): void };
      fixtureActivationBoundaryOwner: number;
      fixtureActivationPowderOwner: number;
      fixtureActivationBoundaryConsumptionOwner: number;
      boundaryEvolutionPending: boolean;
      fieldSet: { lookups: { styleBytes: Uint8Array } };
      fieldSource: { width: number };
      convergeFixtureActivationBoundary(
        owner: number, materials: Uint8Array, velocities: Int8Array | undefined,
        walls: Uint8Array | undefined, encodeContact: boolean,
      ): boolean;
      renderApplication(): void;
    };
    Object.assign(presenter, {
      boundaryStabilityBytes: new Uint8Array(materials.length),
      boundaryStabilityOwners: new Uint8Array(materials.length),
      chunks,
      fixtureActivationBoundaryOwner: 7,
      fixtureActivationPowderOwner: 7,
      fixtureActivationBoundaryConsumptionOwner: 7,
      boundaryEvolutionPending: false,
      fieldSet: { lookups: { styleBytes: styles } },
      fieldSource: { width },
      renderApplication,
    });
    presenter.boundaryDirtyMarker = {
      markCell(index) {
        presenter.fixtureActivationBoundaryOwner = 7;
        presenter.fixtureActivationPowderOwner = 7;
        presenter.boundaryEvolutionPending = true;
        chunks.markCell(index);
      },
    };
    for (const dirty of chunks.consume()) updateBoundaryStabilityRect(
      presenter.boundaryStabilityBytes, presenter.boundaryStabilityOwners,
      materials, velocities, styles, width, dirty, presenter.boundaryDirtyMarker,
    );

    expect(presenter.convergeFixtureActivationBoundary(
      7, materials, velocities, undefined, false,
    )).toBe(true);
    expect(presenter.boundaryStabilityBytes).toEqual(conventional);
    expect(presenter.boundaryStabilityOwners).toEqual(conventionalOwners);
    expect(presenter.fixtureActivationBoundaryOwner).toBe(0);
    expect(renderApplication).not.toHaveBeenCalled();

    const conventionalPowder = new PowderSurfaceField(width, height, styles);
    const drainedPowder = new PowderSurfaceField(width, height, styles);
    conventionalPowder.update(materials, conventional);
    drainedPowder.update(materials, presenter.boundaryStabilityBytes);
    expect(drainedPowder.bytes).toEqual(conventionalPowder.bytes);
    expect(drainedPowder.exteriorAirBytes).toEqual(conventionalPowder.exteriorAirBytes);

    const ownerZeroBytes = new Uint8Array(materials.length);
    presenter.boundaryStabilityBytes = ownerZeroBytes;
    presenter.fixtureActivationBoundaryOwner = 0;
    chunks.markAll();
    expect(presenter.convergeFixtureActivationBoundary(
      0, materials, velocities, undefined, false,
    )).toBe(false);
    expect(ownerZeroBytes.every((value) => value === 0)).toBe(true);
    expect(chunks.consume()).toHaveLength(1);
  });

  it('can seed a retained Visual Lab choice without submitting an unhydrated frame', () => {
    const setVisualLabState = vi.fn();
    const renderApplication = vi.fn();
    const presenter = Object.create(PixiFieldPresenter.prototype) as {
      visualLabState: Readonly<{
        domain: 'gas'; domainCode: 3; variant: 0 | 1 | 2; target: number; gain: number;
      }>;
      hdrVfxPipeline: { setVisualLabState(state: unknown): void };
      hdrPipelineInfo: { active: boolean };
      outputScale: FieldOutputScale;
      app: { canvas: { dataset: Record<string, string> } };
      renderApplication(): void;
      setVisualLabVariant: PixiFieldPresenter['setVisualLabVariant'];
    };
    Object.assign(presenter, {
      visualLabState: Object.freeze({
        domain: 'gas', domainCode: 3, variant: 0, target: 1, gain: 1,
      }),
      hdrVfxPipeline: { setVisualLabState },
      hdrPipelineInfo: { active: true },
      outputScale: 2,
      app: { canvas: { dataset: {} } },
      renderApplication,
    });

    presenter.setVisualLabVariant(2, false);
    expect(setVisualLabState).toHaveBeenCalledOnce();
    expect(renderApplication).not.toHaveBeenCalled();
    expect(presenter.app.canvas.dataset).toMatchObject({
      visualLab: 'active', visualLabDomain: 'gas', visualLabVariant: '2',
      visualLabTarget: '1', visualLabGain: '1',
    });

    presenter.setVisualLabVariant(1);
    expect(renderApplication).toHaveBeenCalledOnce();
  });

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

  it("updates ceramic blackbody vfx controls and requests the appropriate redraw", () => {
    const presenter = presenterHarness();
    presenter.uniforms.uniforms.uCeramicGlazeVfx = 1;
    presenter.uniforms.uniforms.uHDRVfx = 1;
    presenter.setCeramicBlackbodyVfxEnabled(true);
    expect(presenter.uniforms.uniforms.uCeramicGlazeVfx).toBe(2);
    expect(presenter.app.canvas.dataset.ceramicBlackbodyVfx).toBe('active');
    expect(presenter.app.render).toHaveBeenCalledOnce();
    presenter.app.render.mockClear();
    presenter.setCeramicBlackbodyVfxEnabled(false);
    expect(presenter.uniforms.uniforms.uCeramicGlazeVfx).toBe(1);
    expect(presenter.app.canvas.dataset.ceramicBlackbodyVfx).toBe('inactive');
    expect(presenter.app.render).toHaveBeenCalledOnce();
    presenter.app.render.mockClear();
    presenter.uniforms.uniforms.uHDRVfx = 0;
    presenter.setCeramicBlackbodyVfxEnabled(true);
    expect(presenter.uniforms.uniforms.uCeramicGlazeVfx).toBe(1);
    expect(presenter.app.canvas.dataset.ceramicBlackbodyVfx).toBe('inactive');
    expect(presenter.app.render).toHaveBeenCalledOnce();
    const eightPresenter = presenterHarness(8);
    eightPresenter.uniforms.uniforms.uCeramicGlazeVfx = 0;
    eightPresenter.uniforms.uniforms.uHDRVfx = 0;
    eightPresenter.setCeramicBlackbodyVfxEnabled(true);
    expect(eightPresenter.uniforms.uniforms.uCeramicGlazeVfx).toBe(0);
    expect(eightPresenter.app.canvas.dataset.ceramicBlackbodyVfx).toBe('inactive');
    expect(eightPresenter.app.render).not.toHaveBeenCalled();
  });

  it("updates plant canopy interlock vfx controls and requests the appropriate redraw", () => {
    const presenter = presenterHarness();
    presenter.uniforms.uniforms.uPlantCanopyTissueVfx = 1;
    presenter.setPlantCanopyInterlockVfxEnabled(true);
    expect(presenter.uniforms.uniforms.uPlantCanopyInterlockVfx).toBe(1);
    expect(presenter.app.canvas.dataset.plantCanopyInterlockVfx).toBe('active');
    expect(presenter.app.render).toHaveBeenCalledOnce();
    presenter.app.render.mockClear();
    presenter.setPlantCanopyInterlockVfxEnabled(false);
    expect(presenter.uniforms.uniforms.uPlantCanopyInterlockVfx).toBe(0);
    expect(presenter.app.canvas.dataset.plantCanopyInterlockVfx).toBe('inactive');
    expect(presenter.app.render).toHaveBeenCalledOnce();
    presenter.app.render.mockClear();
    presenter.uniforms.uniforms.uPlantCanopyTissueVfx = 0;
    presenter.setPlantCanopyInterlockVfxEnabled(true);
    expect(presenter.uniforms.uniforms.uPlantCanopyInterlockVfx).toBe(0);
    expect(presenter.app.canvas.dataset.plantCanopyInterlockVfx).toBe('inactive');
    expect(presenter.app.render).not.toHaveBeenCalled();
    presenter.uniforms.uniforms.uPlantCanopyTissueVfx = 1;
    Object.assign(presenter, { outputScale: 8 });
    presenter.setPlantCanopyInterlockVfxEnabled(true);
    expect(presenter.uniforms.uniforms.uPlantCanopyInterlockVfx).toBe(0);
    expect(presenter.app.canvas.dataset.plantCanopyInterlockVfx).toBe('inactive');
    expect(presenter.app.render).not.toHaveBeenCalled();
  });

  it("updates plant canopy hierarchy vfx controls and requests the appropriate redraw", () => {
    const presenter = presenterHarness();
    presenter.uniforms.uniforms.uPlantCanopyInterlockVfx = 1;
    presenter.setPlantCanopyHierarchyVfxEnabled(true);
    expect(presenter.uniforms.uniforms.uPlantCanopyHierarchyVfx).toBe(1);
    expect(presenter.app.canvas.dataset.plantCanopyHierarchyVfx).toBe('active');
    expect(presenter.app.render).toHaveBeenCalledOnce();
    presenter.app.render.mockClear();
    presenter.setPlantCanopyHierarchyVfxEnabled(false);
    expect(presenter.uniforms.uniforms.uPlantCanopyHierarchyVfx).toBe(0);
    expect(presenter.app.canvas.dataset.plantCanopyHierarchyVfx).toBe('inactive');
    expect(presenter.app.render).toHaveBeenCalledOnce();
    presenter.app.render.mockClear();
    presenter.uniforms.uniforms.uPlantCanopyInterlockVfx = 0;
    presenter.setPlantCanopyHierarchyVfxEnabled(true);
    expect(presenter.uniforms.uniforms.uPlantCanopyHierarchyVfx).toBe(0);
    expect(presenter.app.canvas.dataset.plantCanopyHierarchyVfx).toBe('inactive');
    expect(presenter.app.render).not.toHaveBeenCalled();
    presenter.uniforms.uniforms.uPlantCanopyInterlockVfx = 1;
    Object.assign(presenter, { outputScale: 8 });
    presenter.setPlantCanopyHierarchyVfxEnabled(true);
    expect(presenter.uniforms.uniforms.uPlantCanopyHierarchyVfx).toBe(0);
    expect(presenter.app.canvas.dataset.plantCanopyHierarchyVfx).toBe('inactive');
    expect(presenter.app.render).not.toHaveBeenCalled();
  });

  it("updates plant canopy foliage vfx controls and requests the appropriate redraw", () => {
    const presenter = presenterHarness();
    presenter.uniforms.uniforms.uPlantCanopyHierarchyVfx = 1;
    presenter.setPlantCanopyFoliageVfxEnabled(true);
    expect(presenter.uniforms.uniforms.uPlantCanopyFoliageVfx).toBe(1);
    expect(presenter.app.canvas.dataset.plantCanopyFoliageVfx).toBe('active');
    expect(presenter.app.render).toHaveBeenCalledOnce();
    presenter.app.render.mockClear();
    presenter.setPlantCanopyFoliageVfxEnabled(false);
    expect(presenter.uniforms.uniforms.uPlantCanopyFoliageVfx).toBe(0);
    expect(presenter.app.canvas.dataset.plantCanopyFoliageVfx).toBe('inactive');
    expect(presenter.app.render).toHaveBeenCalledOnce();
    presenter.app.render.mockClear();
    presenter.uniforms.uniforms.uPlantCanopyHierarchyVfx = 0;
    presenter.setPlantCanopyFoliageVfxEnabled(true);
    expect(presenter.uniforms.uniforms.uPlantCanopyFoliageVfx).toBe(0);
    expect(presenter.app.canvas.dataset.plantCanopyFoliageVfx).toBe('inactive');
    expect(presenter.app.render).not.toHaveBeenCalled();
    presenter.uniforms.uniforms.uPlantCanopyHierarchyVfx = 1;
    Object.assign(presenter, { outputScale: 8 });
    presenter.setPlantCanopyFoliageVfxEnabled(true);
    expect(presenter.uniforms.uniforms.uPlantCanopyFoliageVfx).toBe(0);
    expect(presenter.app.canvas.dataset.plantCanopyFoliageVfx).toBe('inactive');
    expect(presenter.app.render).not.toHaveBeenCalled();
  });

  it("updates rock weathered facet vfx controls and requests the appropriate redraw", () => {
    const presenter = presenterHarness();
    presenter.uniforms.uniforms.uRockMesostructureVfx = 1;
    presenter.setRockWeatheredFacetVfxEnabled(true);
    expect(presenter.uniforms.uniforms.uRockWeatheredFacetVfx).toBe(1);
    expect(presenter.app.canvas.dataset.rockWeatheredFacetVfx).toBe('active');
    expect(presenter.app.render).toHaveBeenCalledOnce();
    presenter.app.render.mockClear();
    presenter.setRockWeatheredFacetVfxEnabled(false);
    expect(presenter.uniforms.uniforms.uRockWeatheredFacetVfx).toBe(0);
    expect(presenter.app.canvas.dataset.rockWeatheredFacetVfx).toBe('inactive');
    expect(presenter.app.render).toHaveBeenCalledOnce();
    presenter.app.render.mockClear();
    presenter.uniforms.uniforms.uRockMesostructureVfx = 0;
    presenter.setRockWeatheredFacetVfxEnabled(true);
    expect(presenter.uniforms.uniforms.uRockWeatheredFacetVfx).toBe(0);
    expect(presenter.app.canvas.dataset.rockWeatheredFacetVfx).toBe('inactive');
    expect(presenter.app.render).not.toHaveBeenCalled();
    presenter.uniforms.uniforms.uRockMesostructureVfx = 1;
    Object.assign(presenter, { outputScale: 8 });
    presenter.setRockWeatheredFacetVfxEnabled(true);
    expect(presenter.uniforms.uniforms.uRockWeatheredFacetVfx).toBe(0);
    expect(presenter.app.canvas.dataset.rockWeatheredFacetVfx).toBe('inactive');
    expect(presenter.app.render).not.toHaveBeenCalled();
  });

  it("updates iszs crystal hierarchy vfx controls and requests the appropriate redraw", () => {
    const presenter = presenterHarness();
    presenter.uniforms.uniforms.uIszsCrystallineVfx = 1;
    presenter.setIszsCrystalHierarchyVfxEnabled(true);
    expect(presenter.uniforms.uniforms.uIszsCrystalHierarchyVfx).toBe(1);
    expect(presenter.app.canvas.dataset.iszsCrystalHierarchyVfx).toBe('active');
    expect(presenter.app.render).toHaveBeenCalledOnce();
    presenter.app.render.mockClear();
    presenter.setIszsCrystalHierarchyVfxEnabled(false);
    expect(presenter.uniforms.uniforms.uIszsCrystalHierarchyVfx).toBe(0);
    expect(presenter.app.canvas.dataset.iszsCrystalHierarchyVfx).toBe('inactive');
    expect(presenter.app.render).toHaveBeenCalledOnce();
    presenter.app.render.mockClear();
    presenter.uniforms.uniforms.uIszsCrystallineVfx = 0;
    presenter.setIszsCrystalHierarchyVfxEnabled(true);
    expect(presenter.uniforms.uniforms.uIszsCrystalHierarchyVfx).toBe(0);
    expect(presenter.app.canvas.dataset.iszsCrystalHierarchyVfx).toBe('inactive');
    expect(presenter.app.render).not.toHaveBeenCalled();
    presenter.uniforms.uniforms.uIszsCrystallineVfx = 1;
    Object.assign(presenter, { outputScale: 8 });
    presenter.setIszsCrystalHierarchyVfxEnabled(true);
    expect(presenter.uniforms.uniforms.uIszsCrystalHierarchyVfx).toBe(0);
    expect(presenter.app.canvas.dataset.iszsCrystalHierarchyVfx).toBe('inactive');
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

  it('completes a normal receipt only after its non-blocking presentation fence signals', () => {
    let status = 0x911b; // TIMEOUT_EXPIRED
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const fence = {} as WebGLSync;
    const gl = {
      SYNC_GPU_COMMANDS_COMPLETE: 0x9117,
      SYNC_FLUSH_COMMANDS_BIT: 0x00000001,
      TIMEOUT_EXPIRED: 0x911b,
      WAIT_FAILED: 0x911d,
      ALREADY_SIGNALED: 0x911a,
      CONDITION_SATISFIED: 0x911c,
      fenceSync: vi.fn(() => fence),
      flush: vi.fn(),
      clientWaitSync: vi.fn(() => status),
      deleteSync: vi.fn(),
    } as unknown as WebGL2RenderingContext;
    const presenter = presenterHarness();
    Object.assign(presenter.app, { renderer: { gl } });

    const ticket = presenter.requestWebGLCompletedFrameReceipt();

    expect(ticket).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledOnce();
    expect(gl.fenceSync).toHaveBeenCalledWith(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    expect(gl.flush).toHaveBeenCalledOnce();
    expect(presenter.getWebGLCompletedFrameReceipt(ticket!)).toMatchObject({
      ticket: 1, submission: 1, state: 'pending',
    });
    expect(gl.clientWaitSync).toHaveBeenCalledWith(fence, gl.SYNC_FLUSH_COMMANDS_BIT, 0);

    status = gl.CONDITION_SATISFIED;

    expect(presenter.getWebGLCompletedFrameReceipt(ticket!)).toMatchObject({
      ticket: 1, submission: 1, state: 'completed',
    });
    expect(gl.deleteSync).toHaveBeenCalledWith(fence);
  });

  it('arms selector-owned proof before one presentation without adding another render', () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const fence = {} as WebGLSync;
    const gl = {
      SYNC_GPU_COMMANDS_COMPLETE: 0x9117,
      SYNC_FLUSH_COMMANDS_BIT: 0x00000001,
      TIMEOUT_EXPIRED: 0x911b,
      WAIT_FAILED: 0x911d,
      ALREADY_SIGNALED: 0x911a,
      CONDITION_SATISFIED: 0x911c,
      fenceSync: vi.fn(() => fence),
      flush: vi.fn(),
      clientWaitSync: vi.fn(() => 0x911a),
      deleteSync: vi.fn(),
    } as unknown as WebGL2RenderingContext;
    const presenter = presenterHarness();
    Object.assign(presenter.app, { renderer: { gl } });

    const ticket = presenter.runWithNextWebGLCompletedFrameReceipt(() => {
      expect(presenter.getWebGLCompletedFrameReceipt(1)).toMatchObject({
        ticket: 1, submission: 1, state: 'pending',
      });
      presenter.setPowderRenderStyle('grains');
    });

    expect(ticket).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledOnce();
    expect(gl.fenceSync).toHaveBeenCalledOnce();
    expect(presenter.getWebGLCompletedFrameReceipt(ticket!)).toMatchObject({
      ticket: 1, submission: 1, state: 'completed',
    });
  });

  it('prearms selector-owned alpha transfer for the exact receipt submission', () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const receiptFence = {} as WebGLSync;
    const readbackFence = {} as WebGLSync;
    const buffer = {} as WebGLBuffer;
    const gl = {
      PIXEL_PACK_BUFFER: 0x88eb,
      STREAM_READ: 0x88e1,
      RGBA: 0x1908,
      UNSIGNED_BYTE: 0x1401,
      SYNC_GPU_COMMANDS_COMPLETE: 0x9117,
      SYNC_FLUSH_COMMANDS_BIT: 1,
      TIMEOUT_EXPIRED: 0x911b,
      WAIT_FAILED: 0x911d,
      ALREADY_SIGNALED: 0x911a,
      CONDITION_SATISFIED: 0x911c,
      createBuffer: vi.fn(() => buffer),
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),
      readPixels: vi.fn(),
      getBufferSubData: vi.fn(),
      fenceSync: vi.fn()
        .mockReturnValueOnce(receiptFence)
        .mockReturnValueOnce(readbackFence),
      flush: vi.fn(),
      clientWaitSync: vi.fn(() => 0x911b),
      deleteSync: vi.fn(),
      deleteBuffer: vi.fn(),
    } as unknown as WebGL2RenderingContext;
    const presenter = presenterHarness();
    Object.assign(presenter.app, { renderer: { gl } });

    const transaction = presenter.runWithNextWebGLCompletedFrameReceiptAndFramebufferAlphaReadback(() => {
      presenter.setPowderRenderStyle('grains');
    });

    expect(transaction).toEqual({
      receiptTicket: 1,
      framebufferAlphaReadbackTicket: 1,
      submission: 1,
    });
    expect(presenter.app.render).toHaveBeenCalledOnce();
    expect(gl.readPixels).toHaveBeenCalledWith(0, 0, 2, 1, gl.RGBA, gl.UNSIGNED_BYTE, 0);
    expect(presenter.getWebGLCompletedFrameReceipt(1)).toMatchObject({ submission: 1, state: 'pending' });
    expect(presenter.getWebGLFramebufferAlphaReadback(1)).toMatchObject({ submission: 1, state: 'pending' });
  });

  it('fails both selector-owned proof reservations when the selector submits twice', () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const gl = {
      PIXEL_PACK_BUFFER: 0x88eb,
      STREAM_READ: 0x88e1,
      RGBA: 0x1908,
      UNSIGNED_BYTE: 0x1401,
      SYNC_GPU_COMMANDS_COMPLETE: 0x9117,
      SYNC_FLUSH_COMMANDS_BIT: 1,
      TIMEOUT_EXPIRED: 0x911b,
      WAIT_FAILED: 0x911d,
      ALREADY_SIGNALED: 0x911a,
      CONDITION_SATISFIED: 0x911c,
      createBuffer: vi.fn(() => ({} as WebGLBuffer)),
      bindBuffer: vi.fn(), bufferData: vi.fn(), readPixels: vi.fn(), getBufferSubData: vi.fn(),
      fenceSync: vi.fn(() => ({} as WebGLSync)), flush: vi.fn(),
      clientWaitSync: vi.fn(() => 0x911b), deleteSync: vi.fn(), deleteBuffer: vi.fn(),
    } as unknown as WebGL2RenderingContext;
    const presenter = presenterHarness();
    Object.assign(presenter.app, { renderer: { gl } });

    expect(presenter.runWithNextWebGLCompletedFrameReceiptAndFramebufferAlphaReadback(() => {
      presenter.setPowderRenderStyle('local');
      presenter.setPowderRenderStyle('grains');
    })).toBeUndefined();
    expect(presenter.getWebGLCompletedFrameReceipt(1)).toMatchObject({ state: 'superseded' });
    expect(presenter.getWebGLFramebufferAlphaReadback(1)).toMatchObject({ state: 'failed' });
  });

  it('submits one selector-owned proof when an unchanged selector does not redraw', () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const gl = {
      SYNC_GPU_COMMANDS_COMPLETE: 0x9117,
      SYNC_FLUSH_COMMANDS_BIT: 1,
      TIMEOUT_EXPIRED: 0x911b,
      WAIT_FAILED: 0x911d,
      ALREADY_SIGNALED: 0x911a,
      CONDITION_SATISFIED: 0x911c,
      fenceSync: vi.fn(() => ({} as WebGLSync)), flush: vi.fn(),
      clientWaitSync: vi.fn(() => 0x911a), deleteSync: vi.fn(),
    } as unknown as WebGL2RenderingContext;
    const presenter = presenterHarness();
    Object.assign(presenter.app, { renderer: { gl } });

    expect(presenter.runWithNextWebGLCompletedFrameReceipt(() => {})).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledOnce();
    expect(presenter.getWebGLCompletedFrameReceipt(1)).toMatchObject({
      submission: 1, state: 'completed',
    });
  });

  it('fails selector-owned proof when its action throws or submits twice', () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const gl = {
      SYNC_GPU_COMMANDS_COMPLETE: 0x9117,
      SYNC_FLUSH_COMMANDS_BIT: 1,
      TIMEOUT_EXPIRED: 0x911b,
      WAIT_FAILED: 0x911d,
      ALREADY_SIGNALED: 0x911a,
      CONDITION_SATISFIED: 0x911c,
      fenceSync: vi.fn(() => ({} as WebGLSync)), flush: vi.fn(),
      clientWaitSync: vi.fn(() => 0x911b), deleteSync: vi.fn(),
    } as unknown as WebGL2RenderingContext;
    const presenter = presenterHarness();
    Object.assign(presenter.app, { renderer: { gl } });

    expect(() => presenter.runWithNextWebGLCompletedFrameReceipt(() => {
      throw new Error('selector failed');
    })).toThrow('selector failed');
    expect(presenter.getWebGLCompletedFrameReceipt(1)).toMatchObject({ state: 'failed' });

    expect(presenter.runWithNextWebGLCompletedFrameReceipt(() => {
      presenter.setPowderRenderStyle('local');
      presenter.setPowderRenderStyle('grains');
    })).toBeUndefined();
    expect(presenter.getWebGLCompletedFrameReceipt(2)).toMatchObject({ state: 'superseded' });
    expect(presenter.app.render).toHaveBeenCalledTimes(2);
  });

  it('preserves the historical framebuffer-alpha digest grammar', () => {
    expect(digestFramebufferAlpha(new Uint8Array([
      10, 20, 30, 0,
      40, 50, 60, 255,
    ]))).toEqual({
      hash: 3547842867,
      supportHash: 292984781,
      alphaSum: 255,
      nonzero: 1,
    });
  });

  it('owns the packed visual-evidence digest after WebGL promotion', () => {
    const field = (alpha: readonly number[]) => {
      const bytes = new Uint8Array(alpha.length * 4);
      alpha.forEach((value, index) => { bytes[index * 4 + 3] = value; });
      return { bytes, width: 2, height: 2 };
    };
    const presenter = Object.create(PixiFieldPresenter.prototype) as unknown as {
      width: number;
      height: number;
      fieldSet: {
        atmosphere: ReturnType<typeof field>;
        liquid: ReturnType<typeof field>;
        emission: ReturnType<typeof field>;
        powderSurface: ReturnType<typeof field>;
      };
      visualCaptureEvidenceDigest(plane: 'liquid-alpha'): {
        hash: number; supportHash: number; alphaSum: number; nonzero: number;
      };
    };
    Object.assign(presenter, {
      width: 2,
      height: 2,
      fieldSet: {
        atmosphere: field([0, 0, 0, 0]),
        liquid: field([0, 1, 127, 255]),
        emission: field([0, 0, 0, 0]),
        powderSurface: field([0, 0, 0, 0]),
      },
    });
    expect(presenter.visualCaptureEvidenceDigest('liquid-alpha')).toEqual({
      hash: 3645862276, supportHash: 1872260184, alphaSum: 383, nonzero: 3,
    });
  });

  it('reuses a bounded CPU readback destination and clears it on teardown', () => {
    const presenter = Object.create(PixiFieldPresenter.prototype) as unknown as {
      framebufferAlphaReadbackScratch?: Uint8Array;
      framebufferAlphaReadbackDestination(byteLength: number): Uint8Array;
      releaseFramebufferAlphaReadbackScratch(): void;
    };
    const first = presenter.framebufferAlphaReadbackDestination(8);
    expect(presenter.framebufferAlphaReadbackDestination(8)).toBe(first);
    const resized = presenter.framebufferAlphaReadbackDestination(12);
    expect(resized).not.toBe(first);
    expect(resized).toHaveLength(12);
    presenter.releaseFramebufferAlphaReadbackScratch();
    expect(presenter.framebufferAlphaReadbackScratch).toBeUndefined();
  });

  it('completes a pixel-pack framebuffer-alpha transfer without a synchronous readback', () => {
    let status = 0x911b; // TIMEOUT_EXPIRED
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const buffer = {} as WebGLBuffer;
    const fence = {} as WebGLSync;
    const rgba = new Uint8Array([10, 20, 30, 0, 40, 50, 60, 255]);
    const gl = {
      PIXEL_PACK_BUFFER: 0x88eb,
      STREAM_READ: 0x88e1,
      RGBA: 0x1908,
      UNSIGNED_BYTE: 0x1401,
      SYNC_GPU_COMMANDS_COMPLETE: 0x9117,
      SYNC_FLUSH_COMMANDS_BIT: 0x00000001,
      TIMEOUT_EXPIRED: 0x911b,
      WAIT_FAILED: 0x911d,
      ALREADY_SIGNALED: 0x911a,
      CONDITION_SATISFIED: 0x911c,
      createBuffer: vi.fn(() => buffer),
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),
      readPixels: vi.fn(),
      getBufferSubData: vi.fn((_target, _offset, destination: Uint8Array) => destination.set(rgba)),
      deleteBuffer: vi.fn(),
      fenceSync: vi.fn(() => fence),
      flush: vi.fn(),
      clientWaitSync: vi.fn(() => status),
      deleteSync: vi.fn(),
    } as unknown as WebGL2RenderingContext;
    const presenter = presenterHarness();
    Object.assign(presenter.app, { renderer: { gl } });
    presenter.presentationSubmission = 1;

    const ticket = presenter.requestWebGLFramebufferAlphaReadback();

    expect(ticket).toBe(1);
    expect(presenter.app.render).not.toHaveBeenCalled();
    expect(gl.readPixels).toHaveBeenCalledWith(0, 0, 2, 1, gl.RGBA, gl.UNSIGNED_BYTE, 0);
    expect(gl.getBufferSubData).not.toHaveBeenCalled();
    expect(presenter.getWebGLFramebufferAlphaReadback(ticket!)).toMatchObject({
      ticket: 1, submission: 1, state: 'pending',
    });

    status = gl.CONDITION_SATISFIED;
    expect(presenter.getWebGLFramebufferAlphaReadback(ticket!)).toMatchObject({
      ticket: 1,
      submission: 1,
      state: 'completed',
      digest: digestFramebufferAlpha(rgba),
    });
    expect(gl.getBufferSubData).toHaveBeenCalledOnce();
    expect(gl.deleteSync).toHaveBeenCalledWith(fence);
    expect(gl.deleteBuffer).not.toHaveBeenCalled();
  });

  it('prearms one v6 activation-owned framebuffer transfer on its exact final submission', () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const buffer = {} as WebGLBuffer;
    const fence = {} as WebGLSync;
    let status = 0x911b; // TIMEOUT_EXPIRED
    const gl = {
      PIXEL_PACK_BUFFER: 0x88eb,
      STREAM_READ: 0x88e1,
      RGBA: 0x1908,
      UNSIGNED_BYTE: 0x1401,
      SYNC_GPU_COMMANDS_COMPLETE: 0x9117,
      SYNC_FLUSH_COMMANDS_BIT: 1,
      TIMEOUT_EXPIRED: 0x911b,
      WAIT_FAILED: 0x911d,
      ALREADY_SIGNALED: 0x911a,
      CONDITION_SATISFIED: 0x911c,
      createBuffer: vi.fn(() => buffer),
      bindBuffer: vi.fn(), bufferData: vi.fn(), readPixels: vi.fn(),
      getBufferSubData: vi.fn(), deleteBuffer: vi.fn(),
      fenceSync: vi.fn(() => fence), flush: vi.fn(),
      clientWaitSync: vi.fn(() => status), deleteSync: vi.fn(),
    } as unknown as WebGL2RenderingContext;
    const presenter = presenterHarness() as unknown as {
      app: { canvas: { width: number; height: number }; renderer?: { gl: WebGL2RenderingContext } };
      presentationSubmission: number;
      fixtureActivationFramebufferAlphaReadbackOwner: number;
      fixtureActivationSubmissionOwner: number;
      fixtureActivationSubmissionBaseline: number;
      fixtureActivationSemanticOwner: number;
      fixtureActivationBoundaryOwner: number;
      fixtureActivationPowderOwner: number;
      fixtureActivationSolidOwner: number;
      fixtureActivationDynamicOwner: number;
      fieldSet: { hasPendingRefreshFor(owner: number): boolean };
      armFixtureActivationFramebufferAlphaReadback(submission: number): void;
      requestWebGLCompletedFrameReceipt(): number | undefined;
      getWebGLCompletedFrameReceipt(ticket: number): WebGLCompletedFrameReceipt | undefined;
      requestWebGLFramebufferAlphaReadback(): number | undefined;
      getWebGLFramebufferAlphaReadback(ticket: number): WebGLFramebufferAlphaReadback | undefined;
      releaseFramebufferAlphaReadbackBuffer(): void;
    };
    presenter.app.renderer = { gl };
    Object.assign(presenter, {
      presentationSubmission: 8,
      fixtureActivationFramebufferAlphaReadbackOwner: 17,
      fixtureActivationSubmissionOwner: 17,
      fixtureActivationSubmissionBaseline: 7,
      fixtureActivationSemanticOwner: 0,
      fixtureActivationBoundaryOwner: 0,
      fixtureActivationPowderOwner: 0,
      fixtureActivationSolidOwner: 0,
      fixtureActivationDynamicOwner: 0,
      fieldSet: { hasPendingRefreshFor: () => false },
    });

    presenter.armFixtureActivationFramebufferAlphaReadback(8);

    // Both ordinary public requests consume proofs prearmed on the exact same
    // activation submission rather than rendering or reading it again.
    expect(presenter.requestWebGLCompletedFrameReceipt()).toBe(1);
    expect(presenter.getWebGLCompletedFrameReceipt(1)).toMatchObject({
      ticket: 1, submission: 8, state: 'pending',
    });
    expect(presenter.requestWebGLFramebufferAlphaReadback()).toBe(1);
    expect(presenter.getWebGLFramebufferAlphaReadback(1)).toMatchObject({
      ticket: 1, submission: 8, state: 'pending',
    });
    expect(gl.createBuffer).toHaveBeenCalledOnce();
    expect(gl.readPixels).toHaveBeenCalledOnce();
    expect(gl.fenceSync).toHaveBeenCalledTimes(2);

    // The activation ticket is one-shot. Once it has served the readiness
    // snapshot, an ordinary later caller gets a new current-frame transfer.
    status = gl.CONDITION_SATISFIED;
    expect(presenter.getWebGLFramebufferAlphaReadback(1)).toMatchObject({ state: 'completed' });
    expect(presenter.requestWebGLFramebufferAlphaReadback()).toBe(2);
    expect(gl.createBuffer).toHaveBeenCalledOnce();
    expect(gl.bufferData).toHaveBeenCalledOnce();

    // A later serial ticket at a new backing size retains the PBO object but
    // replaces its storage exactly once. Presenter teardown owns deletion.
    expect(presenter.getWebGLFramebufferAlphaReadback(2)).toMatchObject({ state: 'completed' });
    presenter.app.canvas.width = 3;
    expect(presenter.requestWebGLFramebufferAlphaReadback()).toBe(3);
    expect(gl.createBuffer).toHaveBeenCalledOnce();
    expect(gl.bufferData).toHaveBeenCalledTimes(2);
    expect(presenter.getWebGLFramebufferAlphaReadback(3)).toMatchObject({ state: 'completed' });
    presenter.releaseFramebufferAlphaReadbackBuffer();
    presenter.releaseFramebufferAlphaReadbackBuffer();
    expect(gl.deleteBuffer).toHaveBeenCalledOnce();
    expect(gl.deleteBuffer).toHaveBeenCalledWith(buffer);
  });

  it('does not prearm incomplete, owner-zero, or true-8x activation work', () => {
    const createBuffer = vi.fn(() => ({} as WebGLBuffer));
    const makePresenter = (outputScale: number, owner: number, semanticOwner: number) => {
      const presenter = presenterHarness(outputScale) as unknown as {
        app: { renderer?: { gl: WebGL2RenderingContext } };
        presentationSubmission: number;
        fixtureActivationFramebufferAlphaReadbackOwner: number;
        fixtureActivationSubmissionOwner: number;
        fixtureActivationSubmissionBaseline: number;
        fixtureActivationSemanticOwner: number;
        fixtureActivationBoundaryOwner: number;
        fixtureActivationPowderOwner: number;
        fixtureActivationSolidOwner: number;
        fixtureActivationDynamicOwner: number;
        fieldSet: { hasPendingRefreshFor(owner: number): boolean };
        armFixtureActivationFramebufferAlphaReadback(submission: number): void;
      };
      presenter.app.renderer = { gl: {
        createBuffer, getBufferSubData: vi.fn(), fenceSync: vi.fn(), clientWaitSync: vi.fn(),
      } as unknown as WebGL2RenderingContext };
      Object.assign(presenter, {
        presentationSubmission: 4,
        fixtureActivationFramebufferAlphaReadbackOwner: owner,
        fixtureActivationSubmissionOwner: owner,
        fixtureActivationSubmissionBaseline: 3,
        fixtureActivationSemanticOwner: semanticOwner,
        fixtureActivationBoundaryOwner: 0,
        fixtureActivationPowderOwner: 0,
        fixtureActivationSolidOwner: 0,
        fixtureActivationDynamicOwner: 0,
        fieldSet: { hasPendingRefreshFor: () => false },
      });
      return presenter;
    };

    makePresenter(2, 9, 9).armFixtureActivationFramebufferAlphaReadback(4);
    makePresenter(2, 0, 0).armFixtureActivationFramebufferAlphaReadback(4);
    makePresenter(8, 9, 0).armFixtureActivationFramebufferAlphaReadback(4);

    expect(createBuffer).not.toHaveBeenCalled();
  });

  it('prearms activation readback only after the ordinary normal-scale fence/PBO hooks', () => {
    const calls: string[] = [];
    const presenter = Object.create(PixiFieldPresenter.prototype) as unknown as {
      outputScale: number;
      webGLTimingFence: undefined;
      renderFence: undefined;
      renderQueued: boolean;
      presentationSubmission: number;
      pollWebGLTimingFence(): void;
      renderApplicationNow(): void;
      armCompletedFrameFence(submission: number): void;
      armFramebufferAlphaReadback(submission: number): void;
      armFixtureActivationFramebufferAlphaReadback(submission: number): void;
      renderApplication(): void;
    };
    Object.assign(presenter, {
      app: { renderer: {} },
      outputScale: 2,
      webGLTimingFence: undefined,
      renderFence: undefined,
      renderQueued: false,
      presentationSubmission: 0,
      pollWebGLTimingFence: () => undefined,
      renderApplicationNow: () => {
        presenter.presentationSubmission = 12;
        calls.push('render');
      },
      armCompletedFrameFence: (submission: number) => calls.push(`receipt:${submission}`),
      armFramebufferAlphaReadback: (submission: number) => calls.push(`pbo:${submission}`),
      armFixtureActivationFramebufferAlphaReadback: (submission: number) => calls.push(`activation:${submission}`),
    });

    presenter.renderApplication();

    expect(calls).toEqual(['render', 'receipt:12', 'pbo:12', 'activation:12']);
  });

  it('arms exactly one PBO readPixels/fence through the complete v6 render path', () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const gl = {
      PIXEL_PACK_BUFFER: 0x88eb,
      STREAM_READ: 0x88e1,
      RGBA: 0x1908,
      UNSIGNED_BYTE: 0x1401,
      SYNC_GPU_COMMANDS_COMPLETE: 0x9117,
      SYNC_FLUSH_COMMANDS_BIT: 1,
      TIMEOUT_EXPIRED: 0x911b,
      WAIT_FAILED: 0x911d,
      ALREADY_SIGNALED: 0x911a,
      CONDITION_SATISFIED: 0x911c,
      createBuffer: vi.fn(() => ({} as WebGLBuffer)),
      bindBuffer: vi.fn(), bufferData: vi.fn(), readPixels: vi.fn(),
      getBufferSubData: vi.fn(), deleteBuffer: vi.fn(),
      fenceSync: vi.fn(() => ({} as WebGLSync)), flush: vi.fn(),
      clientWaitSync: vi.fn(() => 0x911b), deleteSync: vi.fn(),
    } as unknown as WebGL2RenderingContext;
    const presenter = presenterHarness() as unknown as {
      app: { renderer?: { gl: WebGL2RenderingContext } };
      presentationSubmission: number;
      fixtureActivationFramebufferAlphaReadbackOwner: number;
      fixtureActivationSubmissionOwner: number;
      fixtureActivationSubmissionBaseline: number;
      fixtureActivationSemanticOwner: number;
      fixtureActivationBoundaryOwner: number;
      fixtureActivationPowderOwner: number;
      fixtureActivationSolidOwner: number;
      fixtureActivationDynamicOwner: number;
      fieldSet: { hasPendingRefreshFor(owner: number): boolean };
      pollWebGLTimingFence(): void;
      renderApplicationNow(): void;
      armCompletedFrameFence(submission: number): void;
      renderApplication(): void;
    };
    presenter.app.renderer = { gl };
    Object.assign(presenter, {
      presentationSubmission: 7,
      fixtureActivationFramebufferAlphaReadbackOwner: 4,
      fixtureActivationSubmissionOwner: 4,
      fixtureActivationSubmissionBaseline: 7,
      fixtureActivationSemanticOwner: 0,
      fixtureActivationBoundaryOwner: 0,
      fixtureActivationPowderOwner: 0,
      fixtureActivationSolidOwner: 0,
      fixtureActivationDynamicOwner: 0,
      fieldSet: { hasPendingRefreshFor: () => false },
      pollWebGLTimingFence: () => undefined,
      renderApplicationNow: () => { presenter.presentationSubmission = 8; },
      armCompletedFrameFence: () => undefined,
    });

    presenter.renderApplication();

    expect(gl.createBuffer).toHaveBeenCalledOnce();
    expect(gl.readPixels).toHaveBeenCalledOnce();
    // One presentation backpressure fence and one transfer fence. The receipt
    // shares the presentation owner instead of submitting another frame.
    expect(gl.fenceSync).toHaveBeenCalledTimes(2);
  });

  it('leaves unsupported and true-8x framebuffer-alpha requests on the direct fallback', () => {
    const presenter = presenterHarness();
    expect(presenter.requestWebGLFramebufferAlphaReadback()).toBeUndefined();

    const eightX = presenterHarness(8);
    Object.assign(eightX.app, { renderer: { gl: {
      createBuffer: vi.fn(), getBufferSubData: vi.fn(),
      fenceSync: vi.fn(), clientWaitSync: vi.fn(),
    } } });
    expect(eightX.requestWebGLFramebufferAlphaReadback()).toBeUndefined();
  });

  it('fails a framebuffer-alpha readback when a later presentation supersedes its submission', () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const buffer = {} as WebGLBuffer;
    const fence = {} as WebGLSync;
    const gl = {
      PIXEL_PACK_BUFFER: 0x88eb,
      STREAM_READ: 0x88e1,
      RGBA: 0x1908,
      UNSIGNED_BYTE: 0x1401,
      SYNC_GPU_COMMANDS_COMPLETE: 0x9117,
      SYNC_FLUSH_COMMANDS_BIT: 1,
      TIMEOUT_EXPIRED: 0x911b,
      WAIT_FAILED: 0x911d,
      ALREADY_SIGNALED: 0x911a,
      CONDITION_SATISFIED: 0x911c,
      createBuffer: vi.fn(() => buffer),
      bindBuffer: vi.fn(), bufferData: vi.fn(), readPixels: vi.fn(),
      getBufferSubData: vi.fn(), deleteBuffer: vi.fn(),
      fenceSync: vi.fn(() => fence), flush: vi.fn(),
      clientWaitSync: vi.fn(() => 0x911b), deleteSync: vi.fn(),
    } as unknown as WebGL2RenderingContext;
    const presenter = presenterHarness();
    Object.assign(presenter.app, { renderer: { gl } });
    presenter.presentationSubmission = 1;
    const ticket = presenter.requestWebGLFramebufferAlphaReadback()!;

    presenter.setGasFieldLightingEnabled(true);

    expect(presenter.getWebGLFramebufferAlphaReadback(ticket)).toMatchObject({
      ticket, submission: 1, state: 'failed',
    });
    expect(gl.getBufferSubData).not.toHaveBeenCalled();
    expect(gl.deleteSync).toHaveBeenCalledWith(fence);
    expect(gl.deleteBuffer).not.toHaveBeenCalled();
  });

  it('supersedes a completed-frame receipt when a later full presentation submits', () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const fence = {} as WebGLSync;
    const gl = {
      SYNC_GPU_COMMANDS_COMPLETE: 0x9117,
      SYNC_FLUSH_COMMANDS_BIT: 0x00000001,
      TIMEOUT_EXPIRED: 0x911b,
      WAIT_FAILED: 0x911d,
      ALREADY_SIGNALED: 0x911a,
      CONDITION_SATISFIED: 0x911c,
      fenceSync: vi.fn(() => fence),
      flush: vi.fn(),
      clientWaitSync: vi.fn(() => 0x911a),
      deleteSync: vi.fn(),
    } as unknown as WebGL2RenderingContext;
    const presenter = presenterHarness();
    Object.assign(presenter.app, { renderer: { gl } });

    const ticket = presenter.requestWebGLCompletedFrameReceipt();
    expect(presenter.getWebGLCompletedFrameReceipt(ticket!)).toMatchObject({ state: 'completed' });
    presenter.setGasFieldLightingEnabled(true);

    expect(presenter.app.render).toHaveBeenCalledTimes(2);
    expect(presenter.getWebGLCompletedFrameReceipt(ticket!)).toMatchObject({
      ticket: 1, submission: 1, state: 'superseded',
    });
    expect(gl.fenceSync).toHaveBeenCalledOnce();
    expect(gl.deleteSync).toHaveBeenCalledWith(fence);
  });

  it('retains a bounded superseded receipt when a successor ticket submits', () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const fences = [{} as WebGLSync, {} as WebGLSync];
    const gl = {
      SYNC_GPU_COMMANDS_COMPLETE: 0x9117,
      SYNC_FLUSH_COMMANDS_BIT: 0x00000001,
      TIMEOUT_EXPIRED: 0x911b,
      WAIT_FAILED: 0x911d,
      ALREADY_SIGNALED: 0x911a,
      CONDITION_SATISFIED: 0x911c,
      fenceSync: vi.fn().mockReturnValueOnce(fences[0]).mockReturnValueOnce(fences[1]),
      flush: vi.fn(),
      clientWaitSync: vi.fn(() => 0x911a),
      deleteSync: vi.fn(),
    } as unknown as WebGL2RenderingContext;
    const presenter = presenterHarness();
    Object.assign(presenter.app, { renderer: { gl } });

    const first = presenter.requestWebGLCompletedFrameReceipt()!;
    expect(presenter.getWebGLCompletedFrameReceipt(first)).toMatchObject({ state: 'completed' });
    const second = presenter.requestWebGLCompletedFrameReceipt()!;

    expect(second).toBe(2);
    expect(presenter.getWebGLCompletedFrameReceipt(first)).toMatchObject({
      ticket: 1, submission: 1, state: 'superseded',
    });
    expect(presenter.getWebGLCompletedFrameReceipt(second)).toMatchObject({
      ticket: 2, submission: 2, state: 'completed',
    });
  });

  it('fences only after the final HDR presentation returns', () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const order: string[] = [];
    const fence = {} as WebGLSync;
    const gl = {
      SYNC_GPU_COMMANDS_COMPLETE: 0x9117,
      SYNC_FLUSH_COMMANDS_BIT: 0x00000001,
      TIMEOUT_EXPIRED: 0x911b,
      WAIT_FAILED: 0x911d,
      ALREADY_SIGNALED: 0x911a,
      CONDITION_SATISFIED: 0x911c,
      fenceSync: vi.fn(() => { order.push('fence'); return fence; }),
      flush: vi.fn(),
      clientWaitSync: vi.fn(() => 0x911a),
      deleteSync: vi.fn(),
    } as unknown as WebGL2RenderingContext;
    const presenter = presenterHarness();
    Object.assign(presenter, {
      hdrVfxPipeline: { render: () => { order.push('hdr-composite'); } },
      app: { ...presenter.app, renderer: { gl } },
    });

    const ticket = presenter.requestWebGLCompletedFrameReceipt()!;
    expect(order).toEqual(['hdr-composite', 'fence']);
    expect(presenter.app.render).not.toHaveBeenCalled();
    expect(presenter.getWebGLCompletedFrameReceipt(ticket)).toMatchObject({ state: 'completed' });
  });

  it('fails a receipt when its fence cannot be created or a wait reports failure', () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const noFence = {
      SYNC_GPU_COMMANDS_COMPLETE: 0x9117,
      SYNC_FLUSH_COMMANDS_BIT: 0x00000001,
      WAIT_FAILED: 0x911d,
      fenceSync: vi.fn(() => null),
      clientWaitSync: vi.fn(),
    } as unknown as WebGL2RenderingContext;
    const noFencePresenter = presenterHarness();
    Object.assign(noFencePresenter.app, { renderer: { gl: noFence } });

    const failedToCreate = noFencePresenter.requestWebGLCompletedFrameReceipt();
    expect(noFencePresenter.getWebGLCompletedFrameReceipt(failedToCreate!)).toMatchObject({
      state: 'failed',
    });

    const fence = {} as WebGLSync;
    const waitFailed = {
      SYNC_GPU_COMMANDS_COMPLETE: 0x9117,
      SYNC_FLUSH_COMMANDS_BIT: 0x00000001,
      TIMEOUT_EXPIRED: 0x911b,
      WAIT_FAILED: 0x911d,
      ALREADY_SIGNALED: 0x911a,
      CONDITION_SATISFIED: 0x911c,
      fenceSync: vi.fn(() => fence),
      flush: vi.fn(),
      clientWaitSync: vi.fn(() => 0x911d),
      deleteSync: vi.fn(),
    } as unknown as WebGL2RenderingContext;
    const waitFailedPresenter = presenterHarness();
    Object.assign(waitFailedPresenter.app, { renderer: { gl: waitFailed } });

    const failedWait = waitFailedPresenter.requestWebGLCompletedFrameReceipt();
    expect(waitFailedPresenter.getWebGLCompletedFrameReceipt(failedWait!)).toMatchObject({
      state: 'failed',
    });
    expect(waitFailed.deleteSync).toHaveBeenCalledWith(fence);
  });

  it('fails an unsignalled normal receipt at its watchdog deadline', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const fence = {} as WebGLSync;
    const gl = {
      SYNC_GPU_COMMANDS_COMPLETE: 0x9117,
      SYNC_FLUSH_COMMANDS_BIT: 0x00000001,
      TIMEOUT_EXPIRED: 0x911b,
      WAIT_FAILED: 0x911d,
      ALREADY_SIGNALED: 0x911a,
      CONDITION_SATISFIED: 0x911c,
      fenceSync: vi.fn(() => fence),
      flush: vi.fn(),
      clientWaitSync: vi.fn(() => 0x911b),
      deleteSync: vi.fn(),
    } as unknown as WebGL2RenderingContext;
    const presenter = presenterHarness();
    Object.assign(presenter.app, { renderer: { gl } });

    const ticket = presenter.requestWebGLCompletedFrameReceipt();
    vi.advanceTimersByTime(WEBGL_COMPLETED_FRAME_RECEIPT_TIMEOUT_MS - 1);
    expect(presenter.getWebGLCompletedFrameReceipt(ticket!)).toMatchObject({ state: 'pending' });
    vi.advanceTimersByTime(1);

    expect(presenter.getWebGLCompletedFrameReceipt(ticket!)).toMatchObject({ state: 'failed' });
    expect(gl.deleteSync).toHaveBeenCalledWith(fence);
    vi.useRealTimers();
  });

  it('uses the sole true-8x render fence for a receipt after first-frame readiness', () => {
    let scheduled: FrameRequestCallback | undefined;
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      scheduled = callback;
      return 1;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const fence = {} as WebGLSync;
    const gl = {
      SYNC_GPU_COMMANDS_COMPLETE: 0x9117,
      SYNC_FLUSH_COMMANDS_BIT: 0x00000001,
      TIMEOUT_EXPIRED: 0x911b,
      WAIT_FAILED: 0x911d,
      ALREADY_SIGNALED: 0x911a,
      CONDITION_SATISFIED: 0x911c,
      fenceSync: vi.fn(() => fence),
      flush: vi.fn(),
      clientWaitSync: vi.fn(() => 0x911a),
      deleteSync: vi.fn(),
    } as unknown as WebGL2RenderingContext;
    const presenter = presenterHarness(8);
    Object.assign(presenter, {
      firstFrameReady: true,
      app: { ...presenter.app, renderer: { gl } },
    });

    const ticket = presenter.requestWebGLCompletedFrameReceipt();

    expect(ticket).toBe(1);
    expect(presenter.getWebGLCompletedFrameReceipt(ticket!)).toMatchObject({ state: 'pending' });
    expect(gl.fenceSync).toHaveBeenCalledTimes(1);
    expect(scheduled).toBeTypeOf('function');

    scheduled?.(0);

    expect(presenter.getWebGLCompletedFrameReceipt(ticket!)).toMatchObject({
      ticket: 1, submission: 1, state: 'completed',
    });
    expect(gl.fenceSync).toHaveBeenCalledTimes(1);
    expect(gl.deleteSync).toHaveBeenCalledWith(fence);
  });

  it('fails an attached true-8x receipt before replacing its fence for forced recovery', () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const receiptFence = {} as WebGLSync;
    const forcedFence = {} as WebGLSync;
    const gl = {
      SYNC_GPU_COMMANDS_COMPLETE: 0x9117,
      SYNC_FLUSH_COMMANDS_BIT: 0x00000001,
      TIMEOUT_EXPIRED: 0x911b,
      WAIT_FAILED: 0x911d,
      ALREADY_SIGNALED: 0x911a,
      CONDITION_SATISFIED: 0x911c,
      fenceSync: vi.fn()
        .mockReturnValueOnce(receiptFence)
        .mockReturnValueOnce(forcedFence),
      flush: vi.fn(),
      clientWaitSync: vi.fn(() => 0x911b),
      deleteSync: vi.fn(),
    } as unknown as WebGL2RenderingContext;
    const presenter = presenterHarness(8);
    Object.assign(presenter, {
      firstFrameReady: true,
      app: { ...presenter.app, renderer: { gl } },
    });

    const ticket = presenter.requestWebGLCompletedFrameReceipt()!;
    expect(presenter.forceEightXRenderStallForAudit()).toBe(true);

    expect(presenter.getWebGLCompletedFrameReceipt(ticket)).toMatchObject({ state: 'failed' });
    expect(gl.deleteSync).toHaveBeenCalledWith(receiptFence);
    expect(gl.fenceSync).toHaveBeenCalledTimes(2);
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
      .mockReturnValueOnce(30_001)
      .mockReturnValue(30_002);

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

  it("updates geological solid styling controls and requests the appropriate redraw", () => {
    const presenter = presenterHarness();
    presenter.setGeologicalSolidStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uGeologicalSolidStyling).toBe(0);
    expect(presenter.app.render).toHaveBeenCalledOnce();
  });

  it("updates fray force styling controls and requests the appropriate redraw", () => {
    const presenter = presenterHarness();
    presenter.setFrayForceStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uFrayForceStyling).toBe(0);
    expect(presenter.app.render).toHaveBeenCalledOnce();
  });

  it('keeps GBMB containment identity exact-owner and never infers unavailable gravity', () => {
    const presenter = presenterHarness();
    presenter.setGbmbForceStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uGbmbForceStyling).toBe(0);
    expect(presenter.app.render).toHaveBeenCalledOnce();
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

  it("updates energy identity styling controls and requests the appropriate redraw", () => {
    const presenter = presenterHarness();
    presenter.setEnergyIdentityStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uEnergyIdentityStyling).toBe(0);
    presenter.setEnergyIdentityStylingEnabled(true);
    expect(presenter.uniforms.uniforms.uEnergyIdentityStyling).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledTimes(2);
  });

  it("updates vibr state styling controls and requests the appropriate redraw", () => {
    const presenter = presenterHarness();
    presenter.setVibrStateStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uVibrStateStyling).toBe(0);
    presenter.setVibrStateStylingEnabled(true);
    expect(presenter.uniforms.uniforms.uVibrStateStyling).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledTimes(2);
  });

  it("updates deut state styling controls and requests the appropriate redraw", () => {
    const presenter = presenterHarness();
    presenter.setDeutStateStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uDeutStateStyling).toBe(0);
    presenter.setDeutStateStylingEnabled(true);
    expect(presenter.uniforms.uniforms.uDeutStateStyling).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledTimes(2);
  });

  it("updates source target styling controls and requests the appropriate redraw", () => {
    const presenter = presenterHarness();
    presenter.setSourceTargetStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uSourceTargetStyling).toBe(0);
    presenter.setSourceTargetStylingEnabled(true);
    expect(presenter.uniforms.uniforms.uSourceTargetStyling).toBe(1);
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

  it('keeps the dense body ambient fill normal-WebGL-only and independently toggleable', () => {
    const presenter = presenterHarness();

    presenter.configurePresentation(
      true, true, true, true, true, true, true, true, true, 'smooth',
    );
    expect(presenter.uniforms.uniforms.uDenseBodyAmbientFill).toBe(1);
    expect(presenter.app.canvas.dataset.denseBodyAmbientFill).toBe('active');
    expect(presenter.app.render).not.toHaveBeenCalled();

    presenter.setDenseBodyAmbientFillEnabled(false);
    expect(presenter.uniforms.uniforms.uDenseBodyAmbientFill).toBe(0);
    expect(presenter.app.canvas.dataset.denseBodyAmbientFill).toBe('inactive');
    expect(presenter.app.render).toHaveBeenCalledOnce();
  });

  it('keeps the dense body ambient selector inactive and render-free at true 8x', () => {
    const presenter = presenterHarness(8);

    presenter.configurePresentation(
      true, true, true, true, true, true, true, true, true, 'smooth',
    );
    expect(presenter.uniforms.uniforms.uDenseBodyAmbientFill).toBe(0);
    expect(presenter.app.canvas.dataset.denseBodyAmbientFill).toBe('inactive');

    presenter.setDenseBodyAmbientFillEnabled(true);
    expect(presenter.uniforms.uniforms.uDenseBodyAmbientFill).toBe(0);
    expect(presenter.app.canvas.dataset.denseBodyAmbientFill).toBe('inactive');
    expect(presenter.app.render).not.toHaveBeenCalled();
  });

  it('toggles photon/Metal irradiance only in normal WebGL and submits one frame', () => {
    const presenter = presenterHarness();
    presenter.uniforms.uniforms.uSolidBodyVfx = 1;
    presenter.uniforms.uniforms.uPhotonMetalIrradianceVfx = 1;

    presenter.setPhotonMetalIrradianceVfxEnabled(false);
    expect(presenter.uniforms.uniforms.uPhotonMetalIrradianceVfx).toBe(0);
    expect(presenter.app.canvas.dataset.photonMetalIrradianceVfx).toBe('inactive');
    expect(presenter.app.render).toHaveBeenCalledOnce();

    presenter.setPhotonMetalIrradianceVfxEnabled(true);
    expect(presenter.uniforms.uniforms.uPhotonMetalIrradianceVfx).toBe(1);
    expect(presenter.app.canvas.dataset.photonMetalIrradianceVfx).toBe('active');
    expect(presenter.app.render).toHaveBeenCalledTimes(2);
  });

  it('keeps photon/Metal irradiance inactive and render-free at true 8x', () => {
    const presenter = presenterHarness(8);
    presenter.uniforms.uniforms.uSolidBodyVfx = 1;
    presenter.uniforms.uniforms.uPhotonMetalIrradianceVfx = 0;

    presenter.setPhotonMetalIrradianceVfxEnabled(true);

    expect(presenter.uniforms.uniforms.uPhotonMetalIrradianceVfx).toBe(0);
    expect(presenter.app.canvas.dataset.photonMetalIrradianceVfx).toBe('inactive');
    expect(presenter.app.render).not.toHaveBeenCalled();
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

  it('redraws the independent native SPNG-hydration toggle', () => {
    const presenter = presenterHarness();

    presenter.setSpngStateStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uSpngStateStyling).toBe(0);
    expect(presenter.app.render).toHaveBeenCalledOnce();

    presenter.setSpngStateStylingEnabled(true);
    expect(presenter.uniforms.uniforms.uSpngStateStyling).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledTimes(2);
  });

  it('redraws the independent native BASE-state toggle', () => {
    const presenter = presenterHarness();

    presenter.setBaseStateStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uBaseStateStyling).toBe(0);
    expect(presenter.app.render).toHaveBeenCalledOnce();

    presenter.setBaseStateStylingEnabled(true);
    expect(presenter.uniforms.uniforms.uBaseStateStyling).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledTimes(2);
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

  it("updates molten body optics controls and requests the appropriate redraw", () => {
    const presenter = presenterHarness();
    presenter.setMoltenBodyOpticsEnabled(false);
    expect(presenter.uniforms.uniforms.uMoltenBodyOptics).toBe(0);
    presenter.setMoltenBodyOpticsEnabled(true);
    expect(presenter.uniforms.uniforms.uMoltenBodyOptics).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledTimes(2);
  });

  it('keeps the WebGL-only aqueous surface shoulder independently switchable', () => {
    const presenter = presenterHarness();
    presenter.setAqueousSurfaceReflectionEnabled(false);
    expect(presenter.uniforms.uniforms.uAqueousSurfaceReflection).toBe(0);
    presenter.setAqueousSurfaceReflectionEnabled(true);
    expect(presenter.uniforms.uniforms.uAqueousSurfaceReflection).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledTimes(2);
  });

  it("updates cellular material styling controls and requests the appropriate redraw", () => {
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
  });

  it("updates structural rigid styling controls and requests the appropriate redraw", () => {
    const presenter = presenterHarness();
    presenter.setStructuralRigidStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uStructuralRigidStyling).toBe(0);
    expect(presenter.app.render).toHaveBeenCalledOnce();
  });

  it('seeds and redraws the canonical-WebGL mechanism body layer', () => {
    const presenter = presenterHarness();
    presenter.setMechanismBodyStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uMechanismBodyStyling).toBe(0);
    expect(presenter.app.render).toHaveBeenCalledOnce();
  });

  it('seeds and redraws the canonical-WebGL electronics identity layer', () => {
    const presenter = presenterHarness();
    presenter.setElectronicIdentityStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uElectronicIdentityStyling).toBe(0);
    expect(presenter.app.render).toHaveBeenCalledOnce();
  });

  it("updates field profile identity styling controls and requests the appropriate redraw", () => {
    const presenter = presenterHarness();
    presenter.setFieldProfileIdentityStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uFieldProfileIdentityStyling).toBe(0);
    expect(presenter.app.render).toHaveBeenCalledOnce();
  });

  it('seeds and redraws the independent earthen powder identity layer', () => {
    const presenter = presenterHarness();
    presenter.setEarthenPowderStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uEarthenPowderStyling).toBe(0);
    expect(presenter.app.render).toHaveBeenCalledOnce();
  });

  it("updates sensor material styling controls and requests the appropriate redraw", () => {
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
  });

  it("updates unusual powder styling controls and requests the appropriate redraw", () => {
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
  });

  it("updates botanical identity styling controls and requests the appropriate redraw", () => {
    const presenter = presenterHarness();
    presenter.setBotanicalIdentityStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uBotanicalIdentityStyling).toBe(0);
    expect(presenter.app.render).toHaveBeenCalledOnce();
    presenter.app.render.mockClear();
    presenter.setBotanicalIdentityStylingEnabled(true);
    expect(presenter.uniforms.uniforms.uBotanicalIdentityStyling).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledOnce();
  });

  it("updates botanical lifecycle styling controls and requests the appropriate redraw", () => {
    const presenter = presenterHarness();
    presenter.setBotanicalLifecycleStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uBotanicalLifecycleStyling).toBe(0);
    expect(presenter.app.render).toHaveBeenCalledOnce();
    presenter.app.render.mockClear();
    presenter.setBotanicalLifecycleStylingEnabled(true);
    expect(presenter.uniforms.uniforms.uBotanicalLifecycleStyling).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledOnce();
  });

  it("updates spark state styling controls and requests the appropriate redraw", () => {
    const presenter = presenterHarness();
    presenter.setSparkStateStylingEnabled(false);
    expect(presenter.uniforms.uniforms.uSparkStateStyling).toBe(0);
    expect(presenter.app.render).toHaveBeenCalledOnce();
    presenter.app.render.mockClear();
    presenter.setSparkStateStylingEnabled(true);
    expect(presenter.uniforms.uniforms.uSparkStateStyling).toBe(1);
    expect(presenter.app.render).toHaveBeenCalledOnce();
  });

  it("updates unusual solid styling controls and requests the appropriate redraw", () => {
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

  it('keeps CSS camera transforms render-free while public style toggles redraw', () => {
    const presenter = presenterHarness();

    presenter.setTransform(1.25, 12, -8);
    expect(presenter.app.canvas.style.transform).toBe('translate3d(12px, -8px, 0) scale(1.25)');
    expect(presenter.app.render).not.toHaveBeenCalled();

    presenter.setGasFieldLightingEnabled(true);
    expect(presenter.app.render).toHaveBeenCalledOnce();
  });

  it.each([1, 2, 4, 8])('coalesces %sx redraws while one GPU fence remains in flight', (scale) => {
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
      outputScale: scale,
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

  it.each([1, 2, 4, 8])('does not declare %sx ready until its first GPU fence completes', async (scale) => {
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
      outputScale: scale,
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

    expect((presenter as unknown as { prepareRenderFrame(): boolean }).prepareRenderFrame()).toBe(true);
    expect(gl.clientWaitSync).toHaveBeenNthCalledWith(1, fence, 0, 0);
    expect(gl.clientWaitSync).toHaveBeenNthCalledWith(2, fence, gl.SYNC_FLUSH_COMMANDS_BIT, 0);
    expect(gl.deleteSync).toHaveBeenCalledWith(fence);
  });

  it('attempts every strict teardown step and surfaces all release failures', () => {
    const hdrFailure = new Error('HDR targets survived');
    const appFailure = new Error('Pixi application survived');
    const remove = vi.fn();
    const sceneDestroy = vi.fn();
    const presenter = Object.create(PixiFieldPresenter.prototype) as unknown as {
      destroyed: boolean;
      contextLossHandler?: () => void;
      renderStallHandler?: () => void;
      resolveFirstFrame(ready: boolean): void;
      removeContextLossListener(): void;
      releaseRenderFence(): void;
      releaseWebGLTimingQuery(): void;
      releaseWebGLTimingFence(): void;
      hdrVfxPipeline?: { destroy(): void };
      app: {
        canvas: {
          getContext(kind: string): null;
          remove(): void;
        };
        destroy(): void;
      };
      scene: { destroy(options: { children: boolean }): void };
      destroyForAudit(): void;
    };
    Object.assign(presenter, {
      destroyed: false,
      contextLossHandler: vi.fn(),
      renderStallHandler: vi.fn(),
      resolveFirstFrame: vi.fn(),
      removeContextLossListener: vi.fn(),
      releaseRenderFence: vi.fn(),
      releaseWebGLTimingQuery: vi.fn(),
      releaseWebGLTimingFence: vi.fn(),
      hdrVfxPipeline: { destroy: () => { throw hdrFailure; } },
      app: {
        canvas: { getContext: () => null, remove },
        destroy: () => { throw appFailure; },
      },
      scene: { destroy: sceneDestroy },
    });

    let thrown: unknown;
    try { presenter.destroyForAudit(); }
    catch (error) { thrown = error; }
    expect(thrown).toBeInstanceOf(AggregateError);
    expect([...(thrown as AggregateError).errors]).toEqual([hdrFailure, appFailure]);
    expect(remove).toHaveBeenCalledOnce();
    expect(sceneDestroy).toHaveBeenCalledWith({ children: true });
    expect(presenter.destroyed).toBe(true);
    expect(presenter.contextLossHandler).toBeUndefined();
    expect(presenter.renderStallHandler).toBeUndefined();
  });
});
