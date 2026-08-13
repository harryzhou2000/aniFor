import { ALL_MATERIALS, Material } from '../shared/materials';
import type { VisualCaptureEvidencePlane } from '../shared/visual-capture-static-contract.js';
import type { SimulationBackend } from '../simulation';
import { clientToViewport, ViewTransform, type Point, type ViewState } from './view-transform';
import { clientToVisualViewport, contentBoxFromBounds, viewportToClient } from './client-coordinate-map';
import type {
  PixiFieldPresenter, WebGLCompletedFrameReceipt, WebGLFramebufferAlphaReadback,
  WebGLPresentationTiming,
} from './pixi-field-presenter';
import type { VisualLabVariant } from './visual-lab';
import {
  digestVisualCaptureEvidenceAlpha,
  readVisualCaptureEvidenceAlpha,
  type VisualCaptureEvidenceDigest,
} from './visual-capture-evidence';
import {
  backingSize, CANVAS_FALLBACK_DIMENSION_BUDGET, CANVAS_FALLBACK_PIXEL_BUDGET,
  resolveFieldOutputScale, safeDeviceWebGLOutputScale, safeWebGLOutputScale,
  webGLPromotionTimeout, type FieldOutputScale,
} from './render-resolution';
import {
  canvasAtmosphereAlphaAtWorldCell, canvasGasSemanticAccentAlpha, shadeCanvasAtmosphere,
} from './canvas-atmosphere-relief';
import { canvasLocalEmissionAlpha, shadeCanvasEmissionVolume } from './canvas-emission-style';
import { shadeCanvasOpticalVolume } from './canvas-optics-style';
import {
  createLiquidSurfaceScratch, reconstructLiquidSurface, type LiquidSurfaceScratch,
} from './canvas-liquid-surface';
import {
  applyCanvasLiquidBodyOptics,
  applyCanvasLiquidInterfaceMeniscus,
  applyCanvasLiquidMacroCaustic,
  applyCanvasLiquidMacroSheen,
  applyCanvasLiquidOpticalDepth,
  applyCanvasLiquidVolumeChroma,
  canvasLiquidBodySupport, canvasLiquidCausticPhase, canvasLiquidCausticWave,
  canvasLiquidContourScale, canvasLiquidMacroWave,
  canvasLiquidVolumeChromaResponse,
  canvasLiquidEmissionExposure, canvasLiquidFieldRelief,
  canvasLiquidEmissionSurfaceExposure, canvasLiquidSpeciesRelief, canvasLiquidSurfaceExposure,
} from './canvas-liquid-light';
import { applyCanvasLiquidIdentityStyle } from './canvas-liquid-identity-style';
import { applyCanvasBaseStateStyle } from './canvas-base-state-style';
import { applyCanvasGelHydrationStyle } from './canvas-gel-hydration-style';
import { applyCanvasFiltSpectrumStyle } from './canvas-filt-spectrum-style';
import { applyCanvasQuartzCrystalStateStyle } from './canvas-quartz-crystal-state-style';
import { applyCanvasLcryStateStyle } from './canvas-lcry-state-style';
import { applyCanvasPipePresentationStyle } from './canvas-pipe-state-style';
import { applyCanvasStorStateStyle } from './canvas-stor-state-style';
import { applyCanvasSwchStateStyle } from './canvas-swch-state-style';
import { applyCanvasDlayCountdownStyle } from './canvas-dlay-countdown-style';
import { applyCanvasWifiStateStyle } from './canvas-wifi-state-style';
import { shadeCanvasEnergy } from './canvas-energy-style';
import { shadeCanvasMaterial } from './canvas-material-style';
import { shadeCanvasCellularMaterial } from './canvas-cellular-style';
import { applyCanvasEarthenPowderStyle } from './canvas-earthen-powder-style';
import { applyCanvasCrystallinePowderStyle } from './canvas-crystalline-powder-style';
import {
  applyCanvasStructuralRigidBulkOptics,
  applyCanvasStructuralRigidStyle,
} from './canvas-structural-rigid-style';
import { applyCanvasGeologicalSolidCoreOptics } from './canvas-geological-solid-style';
import { applyCanvasThermalCatalyticRigidCoreOptics } from './canvas-thermal-catalytic-rigid-style';
import { applyCanvasGooSolidCoreOptics } from './canvas-goo-solid-style';
import { applyCanvasSensorMorphology } from './canvas-sensor-style';
import { applyCanvasUnusualPowderStyle } from './canvas-unusual-powder-style';
import { applyCanvasExplosivePowderStyle } from './canvas-explosive-powder-style';
import {
  applyCanvasElectronicBodyIdentityStyle,
  applyCanvasMechanismBodyIdentityStyle,
} from './canvas-device-identity-style';
import { applyCanvasFieldProfileIdentityStyle } from './canvas-field-profile-identity-style';
import { applyCanvasElectricDischargeStyle } from './canvas-electric-discharge-style';
import {
  applyCanvasUnusualSolidMorphology,
  isCanvasNativeSpecialSolidMaterial,
} from './canvas-unusual-solid-style';
import { applyCanvasSpongeMorphology } from './canvas-sponge-style';
import { applyCanvasBotanicalMorphology, applyCanvasPlantCanopyVolume } from './canvas-botanical-style';
import { applyCanvasBotanicalLifecycleStyle } from './canvas-botanical-lifecycle-style';
import { applyCanvasSparkStateStyle } from './canvas-spark-state-style';
import {
  applyCanvasReconstructedSuspensionStyle, applyCanvasSemanticSuspensionStyle,
} from './canvas-suspension-style';
import {
  applyCanvasPowderBulkStyle, canvasPowderBulkDepth,
} from './canvas-powder-bulk-style';
import {
  applicableCanvasRenderTraits, applyCanvasRenderTraits, CANVAS_RENDER_TRAIT_CLOCK_SIZE,
  updateCanvasRenderTraitClock,
} from './canvas-render-traits';
import {
  CANVAS_TRANSLUCENT_FIELD_GAIN, canvasTranslucentFieldExposure, lightCanvasSurface,
  canvasSolidBodyFieldExposure, canvasSolidFieldLightingGain, sampleCanvasFieldAlpha,
} from './canvas-surface-light';
import { reconstructSolidSurface } from './canvas-solid-surface';
import {
  writeCanvasLiquidRefractedWallPixel, writeCanvasRefractedWallPixel,
  writeCanvasWallPixel,
} from './canvas-wall-style';
import {
  applyCanvasSolidBodyOptics, applyCanvasTranslucentCaustic,
  applyCanvasTranslucentLensShell,
  canvasSolidInteriorCohesion, canvasSolidRelief,
} from './canvas-solid-relief';
import { RenderFieldSet } from './render-field-set';
import { RenderOptics } from './render-optics';
import { receivesSurfaceLight, renderPhase, RenderPhase, RenderProfile } from './render-profile';
import { semanticRenderHeat } from './semantic-field';
import { compositePixel } from './rgba-composite';
import { forceCanvas2D, probeWebGLCapabilities } from './webgl-support';
import {
  contourLight, isMaterialBulkInterior, materialNeighbourMask, neighbourDensity,
} from './volumetric-field';
import { updateBoundaryStabilityRect } from './boundary-stability-field';
import {
  CANVAS_CONTOUR_CHUNK_SIZE, CANVAS_CONTOUR_OUTPUT_SCALE, CanvasPhaseContourScratch,
} from './canvas-phase-contour';
import { DirtyChunkGrid } from './dirty-chunk-grid';
import { POWDER_SURFACE_REFRESH_INTERVAL } from './powder-surface-field';
import type { PowderRenderStyle } from './powder-render-style';
import { receivesThermalMaterialStyle, thermalMaterialDelta } from './thermal-material-style';
import { writeSolidOpticalDepth } from './solid-optical-depth-field';
import { applyCanvasVibrStateStyle } from './canvas-vibr-state-style';
import { applyCanvasDeutStateStyle } from './canvas-deut-state-style';
import { applyCanvasForceActivityStyle } from './canvas-force-activity-style';
import { applyCanvasFrayForceStyle } from './canvas-fray-force-style';
import { applyCanvasGbmbForceStyle } from './canvas-gbmb-force-style';
import { applyCanvasPoloStateStyle } from './canvas-polo-state-style';
import { applyCanvasSpongeHydrationStyle } from './canvas-sponge-hydration-style';
import { applyCanvasLavaAncestryStyle } from './canvas-lava-ancestry-style';
import { applyCanvasPhotonSpectrumStyle } from './photon-spectrum-state';
import {
  applyCanvasSourceTargetStyle, isConfiguredSourceMaterial,
} from './canvas-source-target-style';

const FRAME_INTERVAL = 1000 / 30;
export const DYNAMIC_FIELD_REFRESH_INTERVAL = 1000 / 12;

export interface RendererBackendInfo {
  readonly backend: 'webgl' | 'canvas2d';
  readonly label: 'WebGL' | 'Canvas 2D';
  readonly reason?: 'forced' | 'webgl-unavailable' | 'webgl-starting' | 'webgl-timeout'
    | 'webgl-error' | 'webgl-context-lost';
  readonly requestedOutputScale?: FieldOutputScale;
  readonly outputScale?: FieldOutputScale;
}

export interface CanvasPresentationTiming {
  readonly sequence: number;
  readonly durationMs: number;
  /** Optional audit-only breakdown; production leaves timing disabled. */
  readonly fieldMs?: number;
  readonly materialMs?: number;
  readonly contourMs?: number;
  readonly compositeMs?: number;
  readonly rebuiltField?: 'atmosphere' | 'liquid' | 'emission';
  /** Count of field/accent planes uploaded during this Canvas presentation. */
  readonly volumePlaneUploads: number;
  /** Count of full-output volume composites during this Canvas presentation. */
  readonly volumePlaneComposites: number;
}

/**
 * Browser-audit-only counts of accepted presentation passes.  This stays
 * backend neutral: WebGL timing requests deliberately submit frames, so they
 * cannot be used to observe an idle renderer without perturbing it.
 */
export interface PresentationRefreshAudit {
  readonly sequence: number;
  /** Accepted full state-plane refreshes (temperature/velocity/native state). */
  readonly dynamicSequence: number;
}

export type FixtureActivationPresentationGenerationState =
  'pending' | 'completed' | 'failed';

/** Audit-only proof that one post-activation FieldRenderer presentation ran. */
export interface FixtureActivationPresentationGeneration {
  readonly ticket: number;
  readonly generation: number;
  readonly state: FixtureActivationPresentationGenerationState;
}

interface MutableFixtureActivationPresentationGeneration {
  ticket: number;
  generation: number;
  state: FixtureActivationPresentationGenerationState;
  completionScope: 'global-quiescence' | 'activation-owned-work' | 'activation-owned-drained-work';
}

const FIXTURE_ACTIVATION_PRESENTATION_HISTORY = 4;

/** Exact CPU evidence for the field that owns reconstructed gas support. */
export interface AtmosphereSupportAudit {
  readonly nonzero: number;
  readonly alphaSum: number;
  readonly signature: number;
}

/** Exact CPU evidence for the shared powder-in-aqueous suspension field. */
export interface SuspensionSupportAudit {
  readonly active: boolean;
  readonly nonzero: number;
  readonly alphaSum: number;
  readonly signature: number;
}

/**
 * Continuous native state (temperature, velocity, ctype projections, photons)
 * needs a bounded refresh while the simulation steps. A queued state mutation
 * still gets exactly one coherent presentation while the simulation is paused.
 */
export function dynamicFieldRefreshDue(
  time: number, lastRefresh: number, continuouslyEnabled: boolean, queued = false,
): boolean {
  return queued || (continuouslyEnabled && time - lastRefresh >= DYNAMIC_FIELD_REFRESH_INTERVAL);
}

/**
 * Separates backend capability from its continuous-clock opt-in: render labs
 * can remain static yet still explicitly publish one changed native state.
 */
export function dynamicPresentationRefreshDue(
  time: number,
  lastRefresh: number,
  hasPresentation: boolean,
  continuouslyDynamic: boolean,
  simulationRunning: boolean,
  invalidated: boolean,
): boolean {
  return hasPresentation && dynamicFieldRefreshDue(
    time, lastRefresh, simulationRunning && continuouslyDynamic, invalidated,
  );
}

interface ProjectedRenderInfo { readonly color: number; readonly phase: RenderPhase; readonly emissive: boolean }
const PROJECTED_RENDER_INFO: Array<ProjectedRenderInfo | undefined> = [];
for (const material of ALL_MATERIALS) {
  PROJECTED_RENDER_INFO[material.id] = {
    color: Number.parseInt(material.color.slice(1), 16),
    phase: renderPhase(material),
    emissive: material.emissive === true || renderPhase(material) === RenderPhase.Energy,
  };
}

/**
 * Coalesces independent layout signals into one post-layout update. The frame
 * can change before its ResizeObserver callback arrives, so callers also feed
 * window, visual-viewport, and compact-media changes through this scheduler.
 */
export function createAnimationFrameCoalescer(
  callback: () => void,
  requestFrame: (frame: FrameRequestCallback) => number = requestAnimationFrame,
): () => void {
  let pending = false;
  return () => {
    if (pending) return;
    pending = true;
    requestFrame(() => {
      pending = false;
      callback();
    });
  };
}

/** Continuous field renderer: one shaded texel per native Powder Toy cell. */
export class MaterialRenderer {
  private readonly surface = document.createElement('canvas');
  private readonly liquidSurface = document.createElement('canvas');
  private readonly smokeSurface = document.createElement('canvas');
  private readonly fireSurface = document.createElement('canvas');
  private readonly atmosphereSurface = document.createElement('canvas');
  private readonly emissionSurface = document.createElement('canvas');
  private readonly fallbackSurface = document.createElement('canvas');
  private readonly contourSurface = document.createElement('canvas');
  private readonly contourChunkSurface = document.createElement('canvas');
  private readonly rendered: Uint8Array;
  private readonly renderedWalls?: Uint8Array;
  private readonly styledColor = new Float32Array(3);
  private readonly thermalDelta = new Float32Array(3);
  private readonly energyGlowColor = new Float32Array(3);
  private readonly traitClock = new Int32Array(CANVAS_RENDER_TRAIT_CLOCK_SIZE);
  private readonly boundaryStability: Uint8Array;
  private readonly boundaryStabilityOwners: Uint8Array;
  private readonly requestedOutputScale: FieldOutputScale;
  private readonly outputScale: FieldOutputScale;
  private readonly webGLOutputScale: FieldOutputScale;
  private readonly webGLAvailable: boolean;
  private readonly contourScratch: CanvasPhaseContourScratch;
  private readonly contourChunks: DirtyChunkGrid;
  private resizeSourcesInstalled = false;
  private resizeObserver?: ResizeObserver;
  private resizePoll?: number;
  private resizeListener?: () => void;
  private resizeMedia?: MediaQueryList;
  private viewportWidth = 0;
  private viewportHeight = 0;
  private readonly boundaryDirtyMarker = {
    markCell: (index: number): void => {
      this.contourChunks.markCell(index);
      this.powderSurfaceDirty = true;
      this.boundaryEvolutionPending = true;
      const owner = this.fixtureActivationBoundaryConsumptionOwner;
      if (owner > 0) {
        this.fixtureActivationBoundaryOwner = owner;
        this.fixtureActivationPowderOwner = owner;
      }
    },
  };
  private presenter?: PixiFieldPresenter;
  /** Bounded follow-up cadence while a slow powder owner evolves 0 -> 255. */
  private boundaryEvolutionPending = false;
  private readonly view: ViewTransform;
  private basePixels?: ImageData;
  private liquidPixels?: ImageData;
  private smokePixels?: ImageData;
  private atmospherePixels?: ImageData;
  private emissionPixels?: ImageData;
  private liquidSurfaceScratch?: LiquidSurfaceScratch;
  /** Last uploaded non-empty state for offscreen volume/accent planes. */
  private atmosphereSurfaceActive = false;
  private emissionSurfaceActive = false;
  private smokeSurfaceActive = false;
  private fireSurfaceActive = false;
  private context!: CanvasRenderingContext2D;
  private liquidContext!: CanvasRenderingContext2D;
  private smokeContext!: CanvasRenderingContext2D;
  private fireContext!: CanvasRenderingContext2D;
  private atmosphereContext!: CanvasRenderingContext2D;
  private emissionContext!: CanvasRenderingContext2D;
  private fallbackContext!: CanvasRenderingContext2D;
  private contourContext!: CanvasRenderingContext2D;
  private contourChunkContext!: CanvasRenderingContext2D;
  private contourChunkPixels?: ImageData;
  private firePixels?: ImageData;
  private fallbackFields?: RenderFieldSet;
  private backend: RendererBackendInfo = { backend: 'canvas2d', label: 'Canvas 2D', reason: 'webgl-starting' };
  private lastDraw = -Infinity;
  private lastDynamicFieldRefresh = -Infinity;
  private lastPowderSurfaceRefresh = -Infinity;
  private lastSolidOpticalDepthRefresh = -Infinity;
  private changed = true;
  /** Game owns stepping; renderer uses this only to suppress idle state repacks. */
  private simulationRunning = true;
  /** Coalesced state-only native mutation requiring one full semantic snapshot. */
  private dynamicPresentationInvalidated = false;
  private powderSurfaceDirty = true;
  private solidOpticalDepthDirty = true;
  private canvasLiquidOpticalDepthHydrated = false;
  private gasFieldLightingEnabled = true;
  private gasVolumeChromaEnabled = true;
  private gasIdentityStylingEnabled = true;
  private emissionVolumeChromaEnabled = true;
  private liquidFieldLightingEnabled = true;
  private liquidSilhouetteCohesionEnabled = true;
  private liquidVolumeChromaEnabled = true;
  private liquidOpticalDepthEnabled = true;
  private solidOpticalDepthEnabled = true;
  private translucentFieldTransmissionEnabled = true;
  private translucentBackdropRefractionEnabled = true;
  private solidContactDepthEnabled = true;
  private translucentLensShellEnabled = true;
  private solidCurvatureDepthEnabled = true;
  private surfaceContourLightingEnabled = true;
  private solidFieldLightingEnabled = true;
  private denseBodyAmbientFillEnabled = true;
  private roleMaterialStylingEnabled = true;
  private cellularMaterialStylingEnabled = true;
  private structuralRigidStylingEnabled = true;
  private geologicalSolidStylingEnabled = true;
  private thermalCatalyticRigidStylingEnabled = true;
  private gooSolidStylingEnabled = true;
  private frayForceStylingEnabled = true;
  private gbmbForceStylingEnabled = true;
  private mechanismBodyStylingEnabled = true;
  private electronicIdentityStylingEnabled = true;
  private fieldProfileIdentityStylingEnabled = true;
  private earthenPowderStylingEnabled = true;
  private powderMesostrataStylingEnabled = true;
  private sensorMaterialStylingEnabled = true;
  private unusualPowderStylingEnabled = true;
  private explosivePowderStylingEnabled = true;
  private unusualSolidStylingEnabled = true;
  private liquidIdentityStylingEnabled = true;
  private phaseContactLightingEnabled = true;
  private thermalMaterialStylingEnabled = true;
  private energyCoreReliefEnabled = true;
  private energyIdentityStylingEnabled = true;
  private vibrStateStylingEnabled = true;
  private deutStateStylingEnabled = true;
  private baseStateStylingEnabled = true;
  private sourceTargetStylingEnabled = true;
  private forceActivityStylingEnabled = true;
  private poloStateStylingEnabled = true;
  private spngStateStylingEnabled = true;
  private gelHydrationStylingEnabled = true;
  private filtSpectrumStylingEnabled = true;
  private quartzCrystalStateStylingEnabled = true;
  private lcryStateStylingEnabled = true;
  private pipePresentationStylingEnabled = true;
  private storStateStylingEnabled = true;
  private swchStateStylingEnabled = true;
  private dlayStateStylingEnabled = true;
  private wifiStateStylingEnabled = true;
  private lavaAncestryStylingEnabled = true;
  // Canonical WebGL body optics only. Canvas deliberately remains a safe,
  // semantically equivalent fallback instead of carrying every advanced look.
  private moltenBodyOpticsEnabled = true;
  private aqueousSurfaceReflectionEnabled = true;
  private botanicalIdentityStylingEnabled = true;
  private botanicalLifecycleStylingEnabled = true;
  private sparkStateStylingEnabled = true;
  private powderBodyDepthEnabled = true;
  private powderRenderStyle: PowderRenderStyle = 'smooth';
  private gasFieldLightingDirty = false;
  private gasVolumeChromaDirty = false;
  private gasIdentityStylingDirty = false;
  private canvasPresentationTimingEnabled = false;
  private canvasPresentationTiming?: CanvasPresentationTiming;
  private webGLPresentationTimingEnabled = false;
  private presentationRefreshAuditEnabled = false;
  private presentationRefreshAudit?: PresentationRefreshAudit;
  private fixtureActivationTicketSequence = 0;
  private fixtureActivationPresentationGeneration = 0;
  private fixtureActivationPresentation?: MutableFixtureActivationPresentationGeneration;
  private fixtureActivationPresentations?: Map<number, MutableFixtureActivationPresentationGeneration>;
  private fixtureActivationCaptureOwner = 0;
  private fixtureActivationDynamicOwner = 0;
  private fixtureActivationBoundaryOwner = 0;
  private fixtureActivationPowderOwner = 0;
  private fixtureActivationSolidOwner = 0;
  private fixtureActivationBoundaryConsumptionOwner = 0;
  /** Latest same-page A/B choice, retained across asynchronous WebGL startup. */
  private desiredVisualLabVariant?: VisualLabVariant;
  /** Latest shared material-lighting choice, retained across WebGL startup. */
  private desiredMaterialLightingVariant?: 0 | 1 | 2;
  // Detail navigation creates a fresh page with a different-sized WebGL
  // backing. Relinquish the outgoing presenter before that navigation so its
  // colour target cannot contend with the next true-8x candidate.
  private disposed = false;

  constructor(private readonly host: HTMLElement, private readonly simulation: SimulationBackend) {
    this.requestedOutputScale = resolveFieldOutputScale();
    const forcedCanvas = forceCanvas2D();
    const webGLCapabilities = forcedCanvas ? undefined : probeWebGLCapabilities();
    this.webGLAvailable = webGLCapabilities?.supported === true;
    this.webGLOutputScale = webGLCapabilities?.supported
      ? safeDeviceWebGLOutputScale(
        simulation.width, simulation.height, this.requestedOutputScale, webGLCapabilities,
      )
      : 1;
    // A true 8x WebGL target already approaches 60 MiB. Keep its temporary
    // compatibility view at 2x so cold promotion does not also retain two 4x
    // Canvas colour targets. Explicit forced-Canvas mode remains a true 8x
    // diagnostic; ordinary 1x/2x/4x requests use the bounded fallback policy.
    const fallbackRequestedScale = !forcedCanvas && this.requestedOutputScale === 8
      ? 2 : this.requestedOutputScale;
    this.outputScale = forcedCanvas ? this.requestedOutputScale : safeWebGLOutputScale(
      simulation.width, simulation.height, fallbackRequestedScale,
      CANVAS_FALLBACK_PIXEL_BUDGET, CANVAS_FALLBACK_DIMENSION_BUDGET,
    );
    this.contourScratch = new CanvasPhaseContourScratch(
      this.outputScale === 1 ? CANVAS_CONTOUR_OUTPUT_SCALE : this.outputScale,
    );
    this.rendered = new Uint8Array(simulation.width * simulation.height);
    this.boundaryStability = new Uint8Array(this.rendered.length);
    this.boundaryStabilityOwners = new Uint8Array(this.rendered.length);
    this.contourChunks = new DirtyChunkGrid(simulation.width, simulation.height, CANVAS_CONTOUR_CHUNK_SIZE, 1);
    this.contourChunks.markAll();
    if (simulation.walls) this.renderedWalls = new Uint8Array(simulation.walls());
    this.view = new ViewTransform(simulation.width, simulation.height);
  }

  async init(): Promise<void> {
    const forcedCanvas = forceCanvas2D();
    const webglAvailable = !forcedCanvas && this.webGLAvailable;
    if (webglAvailable) {
      this.setBackend({ backend: 'canvas2d', label: 'Canvas 2D', reason: 'webgl-starting' });
      this.initFallback();
    } else {
      this.setBackend({
        backend: 'canvas2d', label: 'Canvas 2D', reason: forcedCanvas ? 'forced' : 'webgl-unavailable',
      });
      this.initFallback();
    }
    this.resize();
    this.installResizeSources();
    if (webglAvailable) {
      // Keep the compatibility Canvas mounted, but do not make WebGL promotion
      // depend on an animation frame. A just-replaced high-detail page can keep
      // rAF behind outstanding GPU work long enough to consume the entire 8x
      // promotion window before Pixi is even asked to create its context.
      window.setTimeout(() => {
        if (this.disposed) return;
        void this.promoteLatePresenter(this.createWebGLPresenter());
      }, 0);
    }
  }

  /**
   * Releases a presenter that will not be reused. This is intentionally not a
   * fallback transition: callers use it only while the document is leaving or
   * Detail navigation is replacing the whole renderer.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.failFixtureActivationPresentationGeneration();
    this.clearResizeSources();
    const presenter = this.presenter;
    this.presenter = undefined;
    try { presenter?.destroy(); }
    catch { /* a document teardown may already have invalidated WebGL */ }
  }

  /**
   * Lets the browser observe an explicitly lost outgoing context before a
   * Detail navigation asks it to allocate a differently sized backing.
   */
  disposeForNavigation(): Promise<void> {
    this.dispose();
    return new Promise((resolve) => globalThis.setTimeout(resolve, 100));
  }

  /**
   * Audit-only counterpart whose acknowledgement proves renderer release.
   * Canonical WebGL evidence still requires strict presenter destruction; an
   * explicitly forced Canvas diagnostic has no presenter and may acknowledge
   * only its own bounded fallback disposal.
   */
  async disposeForAudit(): Promise<void> {
    if (this.disposed) throw new Error('Renderer was already disposed before strict audit teardown');
    this.disposed = true;
    this.failFixtureActivationPresentationGeneration();
    this.clearResizeSources();
    const presenter = this.presenter;
    this.presenter = undefined;
    let failure: Error | undefined;
    try {
      if (presenter) presenter.destroyForAudit();
      else if (this.backend?.backend !== 'canvas2d' || this.backend.reason !== 'forced') {
        throw new Error('Strict audit teardown requires an active WebGL presenter');
      }
    } catch (error) {
      failure = error instanceof Error ? error : new Error(String(error));
    }
    await new Promise((resolve) => globalThis.setTimeout(resolve, 100));
    if (failure) throw failure;
  }

  /** Keeps the camera transform current even if host ResizeObserver delivery lags. */
  private installResizeSources(): void {
    if (this.resizeSourcesInstalled) return;
    this.resizeSourcesInstalled = true;
    const resize = (): void => this.resize();
    this.resizeListener = resize;
    this.resizeObserver = new ResizeObserver(resize);
    this.resizeObserver.observe(this.host);
    window.addEventListener('resize', resize, { passive: true });
    window.visualViewport?.addEventListener('resize', resize, { passive: true });
    this.resizeMedia = window.matchMedia('(max-width: 680px)');
    this.resizeMedia.addEventListener('change', resize);
    // Background tabs and some embedded browsers may defer both rAF and
    // ResizeObserver delivery. A low-frequency dimension-only check closes
    // that gap without touching the fixed backing store when geometry matches.
    this.resizePoll = window.setInterval(() => {
      if (this.disposed) return;
      if (this.host.clientWidth !== this.viewportWidth || this.host.clientHeight !== this.viewportHeight) {
        this.resize();
      }
    }, 250);
  }

  private clearResizeSources(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    if (this.resizePoll !== undefined) window.clearInterval(this.resizePoll);
    this.resizePoll = undefined;
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
      window.visualViewport?.removeEventListener('resize', this.resizeListener);
      this.resizeMedia?.removeEventListener('change', this.resizeListener);
    }
    this.resizeListener = undefined;
    this.resizeMedia = undefined;
  }

  render(time: number, visualTime = time): void {
    // Detail/page navigation intentionally disposes the outgoing presenter
    // before the document is replaced. A queued game rAF may still arrive in
    // the bounded hand-off interval; rendering into released Canvas/WebGL
    // fields is neither meaningful nor safe.
    if (this.disposed) return;
    // Responsive layout can settle between ResizeObserver delivery and the
    // next presentation (notably after the toolbox establishes its desktop
    // grid height). Reconcile that bounded geometry drift before mapping input
    // or presenting, without allocating or resizing the fixed backing store.
    if (this.host.clientWidth !== this.viewportWidth || this.host.clientHeight !== this.viewportHeight) {
      this.resize();
    }
    if (time - this.lastDraw < FRAME_INTERVAL) return;
    for (const cell of this.simulation.consumeDirtyCells()) {
      const previous = this.rendered[cell.index];
      if (previous === cell.material) continue;
      this.rendered[cell.index] = cell.material;
      const fallbackFields = this.fallbackFields;
      fallbackFields?.markDirty(previous, cell.material, cell.index);
      this.contourChunks.markCell(cell.index);
      if (fallbackFields) {
        const previousPhase = fallbackFields.lookups.styleBytes[previous * 4];
        const nextPhase = fallbackFields.lookups.styleBytes[cell.material * 4];
        if (previousPhase === RenderPhase.Solid || previousPhase === RenderPhase.Powder
          || nextPhase === RenderPhase.Solid || nextPhase === RenderPhase.Powder
          || powderAirBlocker(previous, previousPhase) !== powderAirBlocker(cell.material, nextPhase)) {
          this.powderSurfaceDirty = true;
        }
        if (previousPhase === RenderPhase.Solid || nextPhase === RenderPhase.Solid) {
          this.solidOpticalDepthDirty = true;
        }
      }
      this.presenter?.markDirty(cell.index, cell.material);
      this.changed = true;
    }
    for (const cell of this.simulation.consumeDirtyWalls?.() ?? []) {
      if (!this.renderedWalls) break;
      if (this.renderedWalls[cell.index] === cell.wall) continue;
      this.renderedWalls[cell.index] = cell.wall;
      this.fallbackFields?.markAtmosphereBlockerDirty(cell.index);
      this.presenter?.markWallDirty(cell.index);
      this.contourChunks.markCell(cell.index);
      this.powderSurfaceDirty = true;
      this.solidOpticalDepthDirty = true;
      this.changed = true;
    }
    const hasDynamicPresentation = Boolean(
      this.simulation.temperature || this.simulation.velocity || this.simulation.presentationState
        || this.simulation.photonState,
    );
    // A paused render-lab deliberately opts out of recurring state sampling,
    // but an explicit load/tool/audit invalidation must still produce one
    // coherent snapshot of its temperature or presentation plane.
    const continuousDynamicFields = hasDynamicPresentation
      && this.simulation.presentationFieldsDynamic !== false;
    const refreshDynamicFields = dynamicPresentationRefreshDue(
      time, this.lastDynamicFieldRefresh, hasDynamicPresentation,
      continuousDynamicFields, this.simulationRunning, this.dynamicPresentationInvalidated,
    );
    const powderRefreshDue = this.powderSurfaceDirty
      && time - this.lastPowderSurfaceRefresh >= POWDER_SURFACE_REFRESH_INTERVAL;
    const boundaryEvolutionDue = !this.presenter && this.boundaryEvolutionPending
      && time - this.lastPowderSurfaceRefresh >= POWDER_SURFACE_REFRESH_INTERVAL;
    const solidDepthRefreshDue = this.solidOpticalDepthDirty
      && time - this.lastSolidOpticalDepthRefresh >= POWDER_SURFACE_REFRESH_INTERVAL;
    const visualRefreshDue = this.presenter?.visualRefreshDue(time)
      ?? ((this.fallbackFields?.due(time) ?? false) || powderRefreshDue || solidDepthRefreshDue);
    if (!this.changed && !refreshDynamicFields && !visualRefreshDue && !boundaryEvolutionDue) return;
    if (refreshDynamicFields) {
      this.lastDynamicFieldRefresh = time;
      this.dynamicPresentationInvalidated = false;
    } else if (!hasDynamicPresentation) {
      // A legacy backend cannot later surface a queued native-state mutation.
      this.dynamicPresentationInvalidated = false;
    }
    this.changed = false;
    this.lastDraw = time;
    if (this.presentationRefreshAuditEnabled) {
      const previous = this.presentationRefreshAudit;
      this.presentationRefreshAudit = {
        sequence: (previous?.sequence ?? 0) + 1,
        dynamicSequence: (previous?.dynamicSequence ?? 0) + Number(refreshDynamicFields),
      };
    }
    try {
      this.drawField(time, visualTime, refreshDynamicFields);
      if (refreshDynamicFields
        && this.fixtureActivationDynamicOwner === (this.fixtureActivationPresentation?.ticket ?? 0)) {
        this.fixtureActivationDynamicOwner = 0;
      }
      if (this.fixtureActivationPresentationSettled(this.fixtureActivationPresentation)) {
        this.completeFixtureActivationPresentationGeneration();
      }
    } catch (error) {
      this.failFixtureActivationPresentationGeneration();
      throw error;
    }
  }

  getViewState(): ViewState { return this.view.snapshot(); }

  /**
   * Stops the periodic 12 Hz native-state repack while a game is paused. Each
   * transition still queues one frame, so the final stepped state and resumed
   * state are never left behind in the semantic/presentation textures.
   */
  setSimulationRunning(running: boolean): void {
    if (running === this.simulationRunning) return;
    this.simulationRunning = running;
    this.dynamicPresentationInvalidated = true;
  }

  /** Queues one semantic snapshot for a native mutation that retained material IDs. */
  invalidateDynamicPresentation(): void {
    this.dynamicPresentationInvalidated = true;
  }

  /**
   * Reserves one audit-only generation before a typed fixture activation.
   * Completion belongs only to the next successful FieldRenderer draw; this
   * never fences the GPU or changes production scheduling when unused.
   */
  runWithNextFixtureActivationPresentationGeneration(
    activate: () => void,
  ): number | undefined {
    return this.runWithFixtureActivationPresentationGeneration(activate, 'global-quiescence');
  }

  /** V2 audit primitive: waits only work causally dirtied by this activation. */
  runWithNextFixtureActivationWorkGeneration(
    activate: () => void,
  ): number | undefined {
    return this.runWithFixtureActivationPresentationGeneration(activate, 'activation-owned-work');
  }

  /** V7 audit primitive: converges only owned volume fields before one final submission. */
  runWithNextFixtureActivationDrainedWorkGeneration(
    activate: () => void,
  ): number | undefined {
    return this.runWithFixtureActivationPresentationGeneration(activate, 'activation-owned-drained-work');
  }

  private runWithFixtureActivationPresentationGeneration(
    activate: () => void,
    completionScope: MutableFixtureActivationPresentationGeneration['completionScope'],
  ): number | undefined {
    if (typeof activate !== 'function') {
      throw new TypeError('Fixture activation must be a function');
    }
    if (this.disposed || this.presenter?.isContextLost()) return undefined;
    if (this.fixtureActivationPresentation?.state === 'pending') return undefined;
    if (!Number.isSafeInteger(this.fixtureActivationTicketSequence)
      || this.fixtureActivationTicketSequence >= Number.MAX_SAFE_INTEGER
      || !Number.isSafeInteger(this.fixtureActivationPresentationGeneration)
      || this.fixtureActivationPresentationGeneration >= Number.MAX_SAFE_INTEGER) {
      return undefined;
    }
    const ticket = this.fixtureActivationTicketSequence + 1;
    const presentation: MutableFixtureActivationPresentationGeneration = {
      ticket,
      generation: this.fixtureActivationPresentationGeneration + 1,
      state: 'pending',
      completionScope,
    };
    this.fixtureActivationTicketSequence = ticket;
    this.fixtureActivationPresentation = presentation;
    const history = this.fixtureActivationPresentations ??= new Map();
    history.set(ticket, presentation);
    while (history.size > FIXTURE_ACTIVATION_PRESENTATION_HISTORY) {
      const oldest = history.keys().next().value as number | undefined;
      if (oldest === undefined) break;
      history.delete(oldest);
    }
    const owned = completionScope !== 'global-quiescence';
    const drainOwnedVolumeFields = completionScope === 'activation-owned-drained-work';
    this.fixtureActivationCaptureOwner = owned ? ticket : 0;
    if (owned) this.presenter?.beginFixtureActivationPresentationWork(ticket, drainOwnedVolumeFields);
    try {
      activate();
    } catch (error) {
      this.fixtureActivationCaptureOwner = 0;
      if (drainOwnedVolumeFields) this.presenter?.cancelFixtureActivationDrainedWork(ticket);
      if (owned) this.presenter?.endFixtureActivationPresentationWork(ticket);
      this.failFixtureActivationPresentationGeneration();
      throw error;
    }
    this.fixtureActivationCaptureOwner = 0;
    this.fixtureActivationDynamicOwner = owned ? ticket : 0;
    if (owned) this.presenter?.endFixtureActivationPresentationWork(ticket);
    // Synchronous rendering from an activation callback is outside this closed
    // transaction; it cannot be accepted retrospectively as the requested
    // next presentation.
    if (presentation.state !== 'pending') {
      presentation.state = 'failed';
      return undefined;
    }
    this.dynamicPresentationInvalidated = true;
    this.changed = true;
    return ticket;
  }

  getFixtureActivationPresentationGeneration(
    ticket: number,
  ): FixtureActivationPresentationGeneration | undefined {
    if (!Number.isSafeInteger(ticket) || ticket <= 0) return undefined;
    const presentation = this.fixtureActivationPresentations?.get(ticket);
    if (!presentation) return undefined;
    return Object.freeze({
      ticket: presentation.ticket,
      generation: presentation.generation,
      state: presentation.state,
    });
  }

  private completeFixtureActivationPresentationGeneration(): void {
    const presentation = this.fixtureActivationPresentation;
    if (!presentation || presentation.state !== 'pending') return;
    this.fixtureActivationPresentationGeneration = presentation.generation;
    presentation.state = 'completed';
  }

  private fixtureActivationPresentationSettled(
    presentation: MutableFixtureActivationPresentationGeneration | undefined,
  ): boolean {
    if (!presentation || presentation.state !== 'pending') return false;
    if (presentation.completionScope === 'global-quiescence') {
      if (this.presenter) return this.presenter.fixtureActivationPresentationGloballySettled();
      return !this.boundaryEvolutionPending
        && !this.powderSurfaceDirty
        && !this.solidOpticalDepthDirty
        && !(this.fallbackFields?.hasPendingRefresh ?? false);
    }
    const owner = presentation.ticket;
    if (this.presenter) return this.presenter.fixtureActivationPresentationSettled(owner);
    return this.fixtureActivationDynamicOwner !== owner
      && this.fixtureActivationBoundaryOwner !== owner
      && this.fixtureActivationPowderOwner !== owner
      && this.fixtureActivationSolidOwner !== owner
      && !(this.fallbackFields?.hasPendingRefreshFor(owner) ?? false);
  }

  private failFixtureActivationPresentationGeneration(): void {
    const presentation = this.fixtureActivationPresentation;
    if (presentation?.state === 'pending') presentation.state = 'failed';
  }

  /**
   * Reconciles an audit fixture that authored the backend's raw material plane
   * directly. Normal simulation and brush mutations retain the incremental
   * dirty-cell path; this bounded full scan exists only so diagnostic fixtures
   * cannot leave the presenter texture behind their semantic cells.
   */
  synchronizeFixtureMaterialPlane(): void {
    const owner = this.fixtureActivationCaptureOwner;
    const cells = this.simulation.cells();
    if (cells.length !== this.rendered.length) throw new Error('Fixture material plane size mismatch');
    for (let index = 0; index < cells.length; index++) {
      const material = cells[index];
      const previous = this.rendered[index];
      if (previous === material) continue;
      this.rendered[index] = material;
      const fallbackFields = this.fallbackFields;
      fallbackFields?.markDirty(previous, material, index, owner);
      this.contourChunks.markCell(index);
      if (fallbackFields) {
        const previousPhase = fallbackFields.lookups.styleBytes[previous * 4];
        const nextPhase = fallbackFields.lookups.styleBytes[material * 4];
        if (previousPhase === RenderPhase.Solid || previousPhase === RenderPhase.Powder
          || nextPhase === RenderPhase.Solid || nextPhase === RenderPhase.Powder
          || powderAirBlocker(previous, previousPhase) !== powderAirBlocker(material, nextPhase)) {
          this.powderSurfaceDirty = true;
          if (owner > 0) {
            this.fixtureActivationBoundaryOwner = owner;
            this.fixtureActivationPowderOwner = owner;
          }
        }
        if (previousPhase === RenderPhase.Solid || nextPhase === RenderPhase.Solid) {
          this.solidOpticalDepthDirty = true;
          if (owner > 0) this.fixtureActivationSolidOwner = owner;
        }
      }
      this.presenter?.markDirty(index, material);
      this.changed = true;
    }
    const walls = this.simulation.walls?.();
    if (walls && this.renderedWalls) for (let index = 0; index < walls.length; index++) {
      const wall = walls[index];
      if (this.renderedWalls[index] === wall) continue;
      this.renderedWalls[index] = wall;
      this.fallbackFields?.markAtmosphereBlockerDirty(index, owner);
      this.presenter?.markWallDirty(index);
      this.contourChunks.markCell(index);
      this.powderSurfaceDirty = true;
      this.solidOpticalDepthDirty = true;
      if (owner > 0) {
        this.fixtureActivationBoundaryOwner = owner;
        this.fixtureActivationPowderOwner = owner;
        this.fixtureActivationSolidOwner = owner;
      }
      this.changed = true;
    }
    this.dynamicPresentationInvalidated = true;
  }

  getBackendInfo(): RendererBackendInfo {
    return {
      ...this.backend,
      requestedOutputScale: this.requestedOutputScale,
      outputScale: this.backend.backend === 'webgl' ? this.webGLOutputScale : this.outputScale,
    };
  }

  /** Audit-only read of the phase-local presentation byte at one world cell. */
  presentationAuxiliaryAt(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.simulation.width || y >= this.simulation.height) return -1;
    return this.presenter?.presentationAuxiliaryAt(x, y)
      ?? this.boundaryStability[y * this.simulation.width + x];
  }

  /** One fixed typed bridge for capture-framework field evidence. */
  visualCaptureEvidenceAlphaAt(plane: VisualCaptureEvidencePlane, x: number, y: number): number {
    return readVisualCaptureEvidenceAlpha(this, plane, x, y);
  }

  /** One exact bulk digest for the capture framework's selected evidence plane. */
  visualCaptureEvidenceDigest(plane: VisualCaptureEvidencePlane): VisualCaptureEvidenceDigest {
    return digestVisualCaptureEvidenceAlpha(
      this, plane, this.simulation.width, this.simulation.height,
    );
  }

  /** Audit-only read of the existing full-resolution Powder support alpha. */
  powderSurfaceAlphaAt(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.simulation.width || y >= this.simulation.height) return -1;
    const presented = this.presenter?.powderSurfaceAlphaAt(x, y);
    if (presented !== undefined) return presented;
    const bytes = this.fallbackFields?.powderSurface.bytes;
    return bytes ? bytes[(y * this.simulation.width + x) * 4 + 3] : -1;
  }

  /** Audit-only read of the shared full-resolution liquid-field density byte. */
  liquidFieldAlphaAt(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.simulation.width || y >= this.simulation.height) return -1;
    const presented = this.presenter?.liquidFieldAlphaAt(x, y);
    if (presented !== undefined) return presented;
    const bytes = this.fallbackFields?.liquid.bytes;
    return bytes ? bytes[(y * this.simulation.width + x) * 4 + 3] : -1;
  }

  /** Audit-only bilinear density of the shared atmosphere at a world-cell centre. */
  atmosphereFieldAlphaAt(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.simulation.width || y >= this.simulation.height) return -1;
    const presented = this.presenter?.atmosphereFieldAlphaAt(x, y);
    if (presented !== undefined) return presented;
    const field = this.fallbackFields?.atmosphere;
    return field ? canvasAtmosphereAlphaAtWorldCell(
      field.bytes, field.width, field.height,
      this.simulation.width, this.simulation.height, x, y,
    ) * 255 : -1;
  }

  /** Audit-only bilinear density of the compact shared-emission field. */
  emissionFieldAlphaAt(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.simulation.width || y >= this.simulation.height) return -1;
    const presented = this.presenter?.emissionFieldAlphaAt(x, y);
    if (presented !== undefined) return presented;
    const field = this.fallbackFields?.emission;
    return field ? sampleCanvasFieldAlpha(
      field.bytes, field.width, field.height,
      this.simulation.width, this.simulation.height, x, y,
    ) : -1;
  }

  /** Audit-only state for the Coal/ROCK body styling control. */
  geologicalSolidStylingIsEnabled(): boolean {
    return this.presenter?.geologicalSolidStylingEnabled() ?? this.geologicalSolidStylingEnabled;
  }

  /** Audit-only state for HEAC/PTNM/RSSS deep-body styling. */
  thermalCatalyticRigidStylingIsEnabled(): boolean {
    return this.presenter?.thermalCatalyticRigidStylingEnabled()
      ?? this.thermalCatalyticRigidStylingEnabled;
  }

  /** Audit-only state for the source/sink/channel/force presentation control. */
  roleMaterialStylingIsEnabled(): boolean {
    return this.presenter?.roleMaterialStylingEnabled() ?? this.roleMaterialStylingEnabled;
  }

  gooSolidStylingIsEnabled(): boolean {
    return this.presenter?.gooSolidStylingEnabled() ?? this.gooSolidStylingEnabled;
  }

  frayForceStylingIsEnabled(): boolean {
    return this.presenter?.frayForceStylingEnabled() ?? this.frayForceStylingEnabled;
  }

  gbmbForceStylingIsEnabled(): boolean {
    return this.presenter?.gbmbForceStylingEnabled() ?? this.gbmbForceStylingEnabled;
  }

  /** Audit-only proof that native dirty state reached the active presentation staging grid. */
  renderedMaterialAt(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.simulation.width || y >= this.simulation.height) return -1;
    return this.presenter?.semanticMaterialAt(x, y)
      ?? this.rendered[y * this.simulation.width + x];
  }

  /** Audit-only proof that signed velocity reached the active WebGL staging grid. */
  renderedVelocityAt(x: number, y: number): readonly [number, number] {
    if (x < 0 || y < 0 || x >= this.simulation.width || y >= this.simulation.height) {
      return [0, 0];
    }
    if (this.presenter) return this.presenter.semanticVelocityAt(x, y);
    const velocity = this.simulation.velocity?.();
    const offset = (y * this.simulation.width + x) * 2;
    return [velocity?.[offset] ?? 0, velocity?.[offset + 1] ?? 0];
  }

  /** Audit-only readback of the propagated half-resolution gas identity plane. */
  gasIdentityStyleAt(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.simulation.width || y >= this.simulation.height) {
      return 0;
    }
    if (this.presenter) return this.presenter.gasIdentityStyleAt(x, y);
    const fields = this.fallbackFields;
    if (!fields) return 0;
    const fieldX = Math.min(fields.atmosphere.width - 1, Math.floor(x / 2));
    const fieldY = Math.min(fields.atmosphere.height - 1, Math.floor(y / 2));
    return fields.atmosphere.styleBytes[
      (fieldY * fields.atmosphere.width + fieldX) * 4
    ];
  }

  /** Audit-only readback of the atmosphere-owned signed flow and coherence byte. */
  atmosphereMotionAt(x: number, y: number): readonly [number, number, number] {
    if (x < 0 || y < 0 || x >= this.simulation.width || y >= this.simulation.height) {
      return [0, 0, 0];
    }
    if (this.presenter) return this.presenter.atmosphereMotionAt(x, y);
    const fields = this.fallbackFields;
    if (!fields) return [0, 0, 0];
    const fieldX = Math.min(fields.atmosphere.width - 1, Math.floor(x / 2));
    const fieldY = Math.min(fields.atmosphere.height - 1, Math.floor(y / 2));
    const offset = (fieldY * fields.atmosphere.width + fieldX) * 4;
    const state = fields.atmosphere.styleBytes;
    return [state[offset + 1] - 128, state[offset + 2] - 128, state[offset + 3]];
  }

  /** WebGL audit surface; the fallback has no advanced gas-chroma shader path. */
  getAtmosphereSupportAudit(): AtmosphereSupportAudit | undefined {
    return this.presenter?.atmosphereSupportAudit();
  }

  /** Audit-only readback of the exact half-resolution suspension RGBA texel. */
  suspensionAt(x: number, y: number): readonly [number, number, number, number] {
    if (x < 0 || y < 0 || x >= this.simulation.width || y >= this.simulation.height) {
      return [0, 0, 0, 0];
    }
    if (this.presenter) return this.presenter.suspensionAt(x, y);
    const field = this.fallbackFields?.suspension;
    if (!field) return [0, 0, 0, 0];
    const fieldX = Math.min(field.width - 1, Math.floor(x / 2));
    const fieldY = Math.min(field.height - 1, Math.floor(y / 2));
    const offset = (fieldY * field.width + fieldX) * 4;
    return [field.bytes[offset], field.bytes[offset + 1], field.bytes[offset + 2], field.bytes[offset + 3]];
  }

  /** Backend-neutral digest used to prove selector/support independence. */
  getSuspensionSupportAudit(): SuspensionSupportAudit | undefined {
    if (this.presenter) return this.presenter.suspensionSupportAudit();
    const field = this.fallbackFields?.suspension;
    if (!field) return undefined;
    const bytes = field.bytes;
    let nonzero = 0;
    let alphaSum = 0;
    let signature = 2166136261;
    for (let offset = 0; offset < bytes.length; offset += 4) {
      const alpha = bytes[offset + 3];
      nonzero += Number(alpha !== 0);
      alphaSum += alpha;
      signature = Math.imul(signature ^ bytes[offset], 16777619) >>> 0;
      signature = Math.imul(signature ^ bytes[offset + 1], 16777619) >>> 0;
      signature = Math.imul(signature ^ bytes[offset + 2], 16777619) >>> 0;
      signature = Math.imul(signature ^ alpha, 16777619) >>> 0;
    }
    return { active: field.hasSuspension, nonzero, alphaSum, signature };
  }


  enableCanvasPresentationTiming(): void { this.canvasPresentationTimingEnabled = true; }

  /** Enables passive scheduling counters for paired Canvas/WebGL browser gates. */
  enablePresentationRefreshAudit(): void { this.presentationRefreshAuditEnabled = true; }

  enableWebGLPresentationTiming(): void {
    this.webGLPresentationTimingEnabled = true;
    this.presenter?.enableWebGLPresentationTiming();
  }

  requestWebGLPresentationTimingSample(): boolean {
    return this.presenter?.requestWebGLPresentationTimingSample() ?? false;
  }

  getWebGLPresentationTiming(): WebGLPresentationTiming | undefined {
    return this.presenter?.getWebGLPresentationTiming();
  }

  requestWebGLCompletedFrameReceipt(): number | undefined {
    return this.presenter?.requestWebGLCompletedFrameReceipt();
  }

  runWithNextWebGLCompletedFrameReceipt(present: () => void): number | undefined {
    return this.presenter?.runWithNextWebGLCompletedFrameReceipt(present);
  }

  getWebGLCompletedFrameReceipt(ticket: number): WebGLCompletedFrameReceipt | undefined {
    return this.presenter?.getWebGLCompletedFrameReceipt(ticket);
  }

  requestWebGLFramebufferAlphaReadback(): number | undefined {
    return this.presenter?.requestWebGLFramebufferAlphaReadback();
  }

  getWebGLFramebufferAlphaReadback(ticket: number): WebGLFramebufferAlphaReadback | undefined {
    return this.presenter?.getWebGLFramebufferAlphaReadback(ticket);
  }

  forceEightXRenderStallForAudit(): boolean {
    return this.presenter?.forceEightXRenderStallForAudit() ?? false;
  }

  setGasFieldLightingEnabled(enabled: boolean): void {
    if (enabled === this.gasFieldLightingEnabled) return;
    this.gasFieldLightingEnabled = enabled;
    this.presenter?.setGasFieldLightingEnabled(enabled);
    if (this.fallbackFields) this.gasFieldLightingDirty = true;
    this.changed = true;
  }

  setGasVolumeChromaEnabled(enabled: boolean): void {
    if (enabled === this.gasVolumeChromaEnabled) return;
    this.gasVolumeChromaEnabled = enabled;
    this.presenter?.setGasVolumeChromaEnabled(enabled);
    if (this.fallbackFields) this.gasVolumeChromaDirty = true;
    this.changed = true;
  }

  setGasIdentityStylingEnabled(enabled: boolean): void {
    if (enabled === this.gasIdentityStylingEnabled) return;
    this.gasIdentityStylingEnabled = enabled;
    this.presenter?.setGasIdentityStylingEnabled(enabled);
    if (this.fallbackFields) this.gasIdentityStylingDirty = true;
    this.changed = true;
  }

  setEmissionVolumeChromaEnabled(enabled: boolean): void {
    if (enabled === this.emissionVolumeChromaEnabled) return;
    this.emissionVolumeChromaEnabled = enabled;
    this.presenter?.setEmissionVolumeChromaEnabled(enabled);
    this.syncFallbackVolumeSurfaces();
    this.changed = true;
  }

  setLiquidFieldLightingEnabled(enabled: boolean): void {
    if (enabled === this.liquidFieldLightingEnabled) return;
    this.liquidFieldLightingEnabled = enabled;
    this.presenter?.setLiquidFieldLightingEnabled(enabled);
    this.changed = true;
  }

  setLiquidSilhouetteCohesionEnabled(enabled: boolean): void {
    if (enabled === this.liquidSilhouetteCohesionEnabled) return;
    this.liquidSilhouetteCohesionEnabled = enabled;
    this.presenter?.setLiquidSilhouetteCohesionEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  setLiquidVolumeChromaEnabled(enabled: boolean): void {
    if (enabled === this.liquidVolumeChromaEnabled) return;
    this.liquidVolumeChromaEnabled = enabled;
    this.presenter?.setLiquidVolumeChromaEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  setLiquidOpticalDepthEnabled(enabled: boolean): void {
    if (enabled === this.liquidOpticalDepthEnabled) return;
    this.liquidOpticalDepthEnabled = enabled;
    this.presenter?.setLiquidOpticalDepthEnabled(enabled);
    this.changed = true;
  }

  setSolidOpticalDepthEnabled(enabled: boolean): void {
    if (enabled === this.solidOpticalDepthEnabled) return;
    this.solidOpticalDepthEnabled = enabled;
    this.presenter?.setSolidOpticalDepthEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  setTranslucentFieldTransmissionEnabled(enabled: boolean): void {
    if (enabled === this.translucentFieldTransmissionEnabled) return;
    this.translucentFieldTransmissionEnabled = enabled;
    this.presenter?.setTranslucentFieldTransmissionEnabled(enabled);
    this.changed = true;
  }

  setTranslucentBackdropRefractionEnabled(enabled: boolean): void {
    if (enabled === this.translucentBackdropRefractionEnabled) return;
    this.translucentBackdropRefractionEnabled = enabled;
    this.presenter?.setTranslucentBackdropRefractionEnabled(enabled);
    this.changed = true;
  }

  setSolidContactDepthEnabled(enabled: boolean): void {
    if (enabled === this.solidContactDepthEnabled) return;
    this.solidContactDepthEnabled = enabled;
    this.presenter?.setSolidContactDepthEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  setTranslucentLensShellEnabled(enabled: boolean): void {
    if (enabled === this.translucentLensShellEnabled) return;
    this.translucentLensShellEnabled = enabled;
    this.presenter?.setTranslucentLensShellEnabled(enabled);
    this.changed = true;
  }

  setSolidCurvatureDepthEnabled(enabled: boolean): void {
    if (enabled === this.solidCurvatureDepthEnabled) return;
    this.solidCurvatureDepthEnabled = enabled;
    this.presenter?.setSolidCurvatureDepthEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  setSurfaceContourLightingEnabled(enabled: boolean): void {
    if (enabled === this.surfaceContourLightingEnabled) return;
    this.surfaceContourLightingEnabled = enabled;
    this.presenter?.setSurfaceContourLightingEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  setSolidFieldLightingEnabled(enabled: boolean): void {
    if (enabled === this.solidFieldLightingEnabled) return;
    this.solidFieldLightingEnabled = enabled;
    this.presenter?.setSolidFieldLightingEnabled(enabled);
    // The supersampled contour plane is opaque over authoritative solid cells
    // and samples the lit base RGB. Rebuild it whenever this light term changes
    // or its cached pixels conceal an otherwise correct Canvas body response.
    this.contourChunks.markAll();
    this.changed = true;
  }

  /** WebGL's bounded dense liquid/solid core lift; Canvas remains semantic fallback. */
  setDenseBodyAmbientFillEnabled(enabled: boolean): void {
    if (enabled === this.denseBodyAmbientFillEnabled) return;
    this.denseBodyAmbientFillEnabled = enabled;
    // The WebGL presenter submits the uniform change itself. Canvas has no E80
    // branch, and a later WebGL promotion receives the stored value through
    // configurePresentation, so a second FieldRenderer frame is never needed.
    this.presenter?.setDenseBodyAmbientFillEnabled(enabled);
  }

  /** Normal-WebGL exact Metal/PHOT irradiance; Canvas remains unchanged. */
  setPhotonMetalIrradianceVfxEnabled(enabled: boolean): void {
    // The presenter owns both the uniform mutation and its single submitted
    // frame. A missing presenter means Canvas fallback, where E81 is a no-op.
    this.presenter?.setPhotonMetalIrradianceVfxEnabled(enabled);
  }

  /** Normal-WebGL exact Ceramic temperature relief; Canvas remains unchanged. */
  setCeramicBlackbodyVfxEnabled(enabled: boolean): void {
    // The presenter owns the uniform mutation and submitted frame. A missing
    // presenter is the resilient Canvas path, where E82 is deliberately inert.
    this.presenter?.setCeramicBlackbodyVfxEnabled(enabled);
  }

  /** Normal-HDR visual-lab A/B selector; Canvas and true 8x remain inert. */
  setVisualLabVariant(variant: VisualLabVariant): void {
    this.desiredVisualLabVariant = variant;
    this.presenter?.setVisualLabVariant(variant);
  }

  /** Current same-page Visual Lab choice, including pre-promotion Canvas state. */
  getVisualLabVariant(): VisualLabVariant {
    return this.desiredVisualLabVariant ?? 0;
  }

  /** Normal-WebGL cross-phase lighting profile; Canvas and true 8x stay inert. */
  setMaterialLightingVariant(variant: 0 | 1 | 2): void {
    if (variant !== 0 && variant !== 1 && variant !== 2) {
      throw new Error(`Invalid material-lighting variant ${JSON.stringify(variant)}`);
    }
    this.desiredMaterialLightingVariant = variant;
    this.presenter?.setMaterialLightingVariant(variant);
  }

  getMaterialLightingVariant(): 0 | 1 | 2 {
    return this.presenter?.getMaterialLightingVariant()
      ?? this.desiredMaterialLightingVariant
      ?? 0;
  }

  /** Native DLAY countdown is a state-owned RGB cue, never a JavaScript timer. */
  setDlayStateStylingEnabled(enabled: boolean): void {
    if (enabled === this.dlayStateStylingEnabled) return;
    this.dlayStateStylingEnabled = enabled;
    this.presenter?.setDlayStateStylingEnabled(enabled);
    this.changed = true;
  }

  /** Native WIFI channel/activity is an RGB projection of its packed state. */
  setWifiStateStylingEnabled(enabled: boolean): void {
    if (enabled === this.wifiStateStylingEnabled) return;
    this.wifiStateStylingEnabled = enabled;
    this.presenter?.setWifiStateStylingEnabled(enabled);
    this.changed = true;
  }

  setRoleMaterialStylingEnabled(enabled: boolean): void {
    if (enabled === this.roleMaterialStylingEnabled) return;
    this.roleMaterialStylingEnabled = enabled;
    this.presenter?.setRoleMaterialStylingEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  setCellularMaterialStylingEnabled(enabled: boolean): void {
    if (enabled === this.cellularMaterialStylingEnabled) return;
    this.cellularMaterialStylingEnabled = enabled;
    this.presenter?.setCellularMaterialStylingEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  setStructuralRigidStylingEnabled(enabled: boolean): void {
    if (enabled === this.structuralRigidStylingEnabled) return;
    this.structuralRigidStylingEnabled = enabled;
    this.presenter?.setStructuralRigidStylingEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  /** Coal/ROCK deep-body optics; RGB-only and topology-preserving. */
  setGeologicalSolidStylingEnabled(enabled: boolean): void {
    if (enabled === this.geologicalSolidStylingEnabled) return;
    this.geologicalSolidStylingEnabled = enabled;
    this.presenter?.setGeologicalSolidStylingEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  /** HEAC/PTNM/RSSS deep-body optics; RGB-only and topology-preserving. */
  setThermalCatalyticRigidStylingEnabled(enabled: boolean): void {
    if (enabled === this.thermalCatalyticRigidStylingEnabled) return;
    this.thermalCatalyticRigidStylingEnabled = enabled;
    this.presenter?.setThermalCatalyticRigidStylingEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  /** Native GOO deep-body cue; no pressure state is inferred or persisted. */
  setGooSolidStylingEnabled(enabled: boolean): void {
    if (enabled === this.gooSolidStylingEnabled) return;
    this.gooSolidStylingEnabled = enabled;
    this.presenter?.setGooSolidStylingEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  /** Exact FRAY nozzle grammar; RGB-only and independent of native force polarity. */
  setFrayForceStylingEnabled(enabled: boolean): void {
    if (enabled === this.frayForceStylingEnabled) return;
    this.frayForceStylingEnabled = enabled;
    this.presenter?.setFrayForceStylingEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  /** Static GBMB containment cue; unavailable gravity is never inferred. */
  setGbmbForceStylingEnabled(enabled: boolean): void {
    if (enabled === this.gbmbForceStylingEnabled) return;
    this.gbmbForceStylingEnabled = enabled;
    this.presenter?.setGbmbForceStylingEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  setMechanismBodyStylingEnabled(enabled: boolean): void {
    if (enabled === this.mechanismBodyStylingEnabled) return;
    this.mechanismBodyStylingEnabled = enabled;
    this.presenter?.setMechanismBodyStylingEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  /** Exact native control-hardware identity in both WebGL and Canvas recovery. */
  setElectronicIdentityStylingEnabled(enabled: boolean): void {
    if (enabled === this.electronicIdentityStylingEnabled) return;
    this.electronicIdentityStylingEnabled = enabled;
    this.presenter?.setElectronicIdentityStylingEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  /** Exact portals, holes, vents, and TRON retain static field bodies in both presenters. */
  setFieldProfileIdentityStylingEnabled(enabled: boolean): void {
    if (enabled === this.fieldProfileIdentityStylingEnabled) return;
    this.fieldProfileIdentityStylingEnabled = enabled;
    this.presenter?.setFieldProfileIdentityStylingEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  setEarthenPowderStylingEnabled(enabled: boolean): void {
    if (enabled === this.earthenPowderStylingEnabled) return;
    this.earthenPowderStylingEnabled = enabled;
    this.presenter?.setEarthenPowderStylingEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  /** Stable Smooth Sand/Clay/Concrete compaction grammar; RGB-only. */
  setPowderMesostrataStylingEnabled(enabled: boolean): void {
    if (enabled === this.powderMesostrataStylingEnabled) return;
    this.powderMesostrataStylingEnabled = enabled;
    this.presenter?.setPowderMesostrataStylingEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  setSensorMaterialStylingEnabled(enabled: boolean): void {
    if (enabled === this.sensorMaterialStylingEnabled) return;
    this.sensorMaterialStylingEnabled = enabled;
    this.presenter?.setSensorMaterialStylingEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  setUnusualPowderStylingEnabled(enabled: boolean): void {
    if (enabled === this.unusualPowderStylingEnabled) return;
    this.unusualPowderStylingEnabled = enabled;
    this.presenter?.setUnusualPowderStylingEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  setExplosivePowderStylingEnabled(enabled: boolean): void {
    if (enabled === this.explosivePowderStylingEnabled) return;
    this.explosivePowderStylingEnabled = enabled;
    this.presenter?.setExplosivePowderStylingEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  setUnusualSolidStylingEnabled(enabled: boolean): void {
    if (enabled === this.unusualSolidStylingEnabled) return;
    this.unusualSolidStylingEnabled = enabled;
    this.presenter?.setUnusualSolidStylingEnabled(enabled);
    this.solidOpticalDepthDirty = true;
    this.contourChunks.markAll();
    this.changed = true;
  }

  setLiquidIdentityStylingEnabled(enabled: boolean): void {
    if (enabled === this.liquidIdentityStylingEnabled) return;
    this.liquidIdentityStylingEnabled = enabled;
    this.presenter?.setLiquidIdentityStylingEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  setPhaseContactLightingEnabled(enabled: boolean): void {
    if (enabled === this.phaseContactLightingEnabled) return;
    this.phaseContactLightingEnabled = enabled;
    this.presenter?.setPhaseContactLightingEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  setThermalMaterialStylingEnabled(enabled: boolean): void {
    if (enabled === this.thermalMaterialStylingEnabled) return;
    this.thermalMaterialStylingEnabled = enabled;
    const presenter = this.presenter;
    presenter?.setThermalMaterialStylingEnabled(
      enabled && this.simulation.temperature !== undefined,
    );
    // The WebGL presenter has already submitted the uniform-only thermal
    // mutation above. Marking the Canvas chunks as changed here makes the next
    // tick submit a second full frame; at true 8x that can queue another
    // 15-million-fragment draw ahead of the audit-owned completion frame.
    // Canvas still needs its ordinary style rebuild. If WebGL later fails,
    // recovery marks every Canvas surface dirty and renders from this retained
    // toggle state before exposing the fallback.
    if (presenter) return;
    this.contourChunks.markAll();
    this.changed = true;
  }

  setEnergyCoreReliefEnabled(enabled: boolean): void {
    if (enabled === this.energyCoreReliefEnabled) return;
    this.energyCoreReliefEnabled = enabled;
    this.presenter?.setEnergyCoreReliefEnabled(enabled);
    this.changed = true;
  }

  setEnergyIdentityStylingEnabled(enabled: boolean): void {
    if (enabled === this.energyIdentityStylingEnabled) return;
    this.energyIdentityStylingEnabled = enabled;
    this.presenter?.setEnergyIdentityStylingEnabled(enabled);
    // Canvas electric-discharge identities are authored in the semantic body
    // pass, so a paused off/on audit needs those cells restyled even though no
    // simulation material became dirty. WebGL redraws immediately above.
    this.contourChunks.markAll();
    this.changed = true;
  }

  setVibrStateStylingEnabled(enabled: boolean): void {
    if (enabled === this.vibrStateStylingEnabled) return;
    this.vibrStateStylingEnabled = enabled;
    this.presenter?.setVibrStateStylingEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  setDeutStateStylingEnabled(enabled: boolean): void {
    if (enabled === this.deutStateStylingEnabled) return;
    this.deutStateStylingEnabled = enabled;
    this.presenter?.setDeutStateStylingEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  setSourceTargetStylingEnabled(enabled: boolean): void {
    if (enabled === this.sourceTargetStylingEnabled) return;
    this.sourceTargetStylingEnabled = enabled;
    this.presenter?.setSourceTargetStylingEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  setForceActivityStylingEnabled(enabled: boolean): void {
    if (enabled === this.forceActivityStylingEnabled) return;
    this.forceActivityStylingEnabled = enabled;
    this.presenter?.setForceActivityStylingEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  setPoloStateStylingEnabled(enabled: boolean): void {
    if (enabled === this.poloStateStylingEnabled) return;
    this.poloStateStylingEnabled = enabled;
    this.presenter?.setPoloStateStylingEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  setSpngStateStylingEnabled(enabled: boolean): void {
    if (enabled === this.spngStateStylingEnabled) return;
    this.spngStateStylingEnabled = enabled;
    this.presenter?.setSpngStateStylingEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  setGelHydrationStylingEnabled(enabled: boolean): void {
    if (enabled === this.gelHydrationStylingEnabled) return;
    this.gelHydrationStylingEnabled = enabled;
    this.presenter?.setGelHydrationStylingEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  setBaseStateStylingEnabled(enabled: boolean): void {
    if (enabled === this.baseStateStylingEnabled) return;
    this.baseStateStylingEnabled = enabled;
    this.presenter?.setBaseStateStylingEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  setQuartzCrystalStateStylingEnabled(enabled: boolean): void {
    if (enabled === this.quartzCrystalStateStylingEnabled) return;
    this.quartzCrystalStateStylingEnabled = enabled;
    this.presenter?.setQuartzCrystalStateStylingEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  setLcryStateStylingEnabled(enabled: boolean): void {
    if (enabled === this.lcryStateStylingEnabled) return;
    this.lcryStateStylingEnabled = enabled;
    this.presenter?.setLcryStateStylingEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  setPipePresentationStylingEnabled(enabled: boolean): void {
    if (enabled === this.pipePresentationStylingEnabled) return;
    this.pipePresentationStylingEnabled = enabled;
    this.presenter?.setPipePresentationStylingEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  setStorStateStylingEnabled(enabled: boolean): void {
    if (enabled === this.storStateStylingEnabled) return;
    this.storStateStylingEnabled = enabled;
    this.presenter?.setStorStateStylingEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  setSwchStateStylingEnabled(enabled: boolean): void {
    if (enabled === this.swchStateStylingEnabled) return;
    this.swchStateStylingEnabled = enabled;
    this.presenter?.setSwchStateStylingEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  setFiltSpectrumStylingEnabled(enabled: boolean): void {
    if (enabled === this.filtSpectrumStylingEnabled) return;
    this.filtSpectrumStylingEnabled = enabled;
    this.presenter?.setFiltSpectrumStylingEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  setLavaAncestryStylingEnabled(enabled: boolean): void {
    if (enabled === this.lavaAncestryStylingEnabled) return;
    this.lavaAncestryStylingEnabled = enabled;
    this.presenter?.setLavaAncestryStylingEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  setMoltenBodyOpticsEnabled(enabled: boolean): void {
    if (enabled === this.moltenBodyOpticsEnabled) return;
    this.moltenBodyOpticsEnabled = enabled;
    // Canvas intentionally has no advanced molten-body counterpart. Its
    // semantic liquid/energy presentation remains usable when WebGL is absent.
    this.presenter?.setMoltenBodyOpticsEnabled(enabled);
    this.changed = true;
  }

  setAqueousSurfaceReflectionEnabled(enabled: boolean): void {
    if (enabled === this.aqueousSurfaceReflectionEnabled) return;
    this.aqueousSurfaceReflectionEnabled = enabled;
    // Canvas intentionally remains a semantic fallback: this is a WebGL-only
    // Water optics control with no effect on matter ownership or physics.
    this.presenter?.setAqueousSurfaceReflectionEnabled(enabled);
    this.changed = true;
  }

  setBotanicalIdentityStylingEnabled(enabled: boolean): void {
    if (enabled === this.botanicalIdentityStylingEnabled) return;
    this.botanicalIdentityStylingEnabled = enabled;
    this.presenter?.setBotanicalIdentityStylingEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  setBotanicalLifecycleStylingEnabled(enabled: boolean): void {
    if (enabled === this.botanicalLifecycleStylingEnabled) return;
    this.botanicalLifecycleStylingEnabled = enabled;
    this.presenter?.setBotanicalLifecycleStylingEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  /** Normal-WebGL audit-only in-place uniform toggle; Canvas keeps its path. */
  setPlantCanopyInterlockVfxEnabled(enabled: boolean): void {
    this.presenter?.setPlantCanopyInterlockVfxEnabled(enabled);
    // The presenter submits this uniform-only frame immediately. Do not mark
    // the field renderer dirty: that would rebuild unrelated paced fields
    // between the focused audit's flat/styled/flat captures.
  }

  /** Normal-WebGL audit-only in-place uniform toggle; Canvas keeps its path. */
  setPlantCanopyHierarchyVfxEnabled(enabled: boolean): void {
    this.presenter?.setPlantCanopyHierarchyVfxEnabled(enabled);
    // Preserve the hydrated E55 fixture and submit only the causal uniform.
  }

  /** Normal-WebGL audit-only in-place uniform toggle; Canvas keeps its path. */
  setPlantCanopyFoliageVfxEnabled(enabled: boolean): void {
    this.presenter?.setPlantCanopyFoliageVfxEnabled(enabled);
    // Preserve the hydrated E58 fixture and submit only the causal uniform.
  }

  /** Normal-WebGL audit-only in-place uniform toggle; Canvas keeps its path. */
  setRockWeatheredFacetVfxEnabled(enabled: boolean): void {
    this.presenter?.setRockWeatheredFacetVfxEnabled(enabled);
    // Preserve the hydrated E29 fixture and submit only the causal uniform.
  }

  /** Normal-WebGL audit-only in-place uniform toggle; Canvas keeps its path. */
  setIszsCrystalHierarchyVfxEnabled(enabled: boolean): void {
    this.presenter?.setIszsCrystalHierarchyVfxEnabled(enabled);
    // Preserve the hydrated E47 fixture and submit only the causal uniform.
  }

  setSparkStateStylingEnabled(enabled: boolean): void {
    if (enabled === this.sparkStateStylingEnabled) return;
    this.sparkStateStylingEnabled = enabled;
    this.presenter?.setSparkStateStylingEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  setPowderBodyDepthEnabled(enabled: boolean): void {
    if (enabled === this.powderBodyDepthEnabled) return;
    this.powderBodyDepthEnabled = enabled;
    this.presenter?.setPowderBodyDepthEnabled(enabled);
    this.contourChunks.markAll();
    this.changed = true;
  }

  setPowderRenderStyle(style: PowderRenderStyle): void {
    if (style === this.powderRenderStyle) return;
    this.powderRenderStyle = style;
    if (this.presenter) {
      // The WebGL presenter owns this uniform-only transition and submits the
      // causal frame synchronously. Queuing the Canvas/field redraw as well
      // makes capture controls render the entire backing twice; recovery marks
      // every Canvas contour dirty when it recreates the fallback.
      this.presenter.setPowderRenderStyle(style);
      return;
    }
    this.contourChunks.markAll();
    this.changed = true;
  }

  getPowderRenderStyle(): PowderRenderStyle {
    return this.powderRenderStyle;
  }

  getCanvasPresentationTiming(): CanvasPresentationTiming | undefined {
    return this.canvasPresentationTiming;
  }

  getPresentationRefreshAudit(): PresentationRefreshAudit | undefined {
    return this.presentationRefreshAudit;
  }

  private applyThermalMaterialStyle(
    phase: RenderPhase,
    material: Material,
    emissive: boolean,
    traits: number,
    temperature: number | undefined,
    optics: RenderOptics,
  ): void {
    if (!this.thermalMaterialStylingEnabled || temperature === undefined
      || !receivesThermalMaterialStyle(phase, material, emissive, traits)) return;
    thermalMaterialDelta(this.thermalDelta, temperature, optics);
    this.styledColor[0] += this.thermalDelta[0];
    this.styledColor[1] += this.thermalDelta[1];
    this.styledColor[2] += this.thermalDelta[2];
  }

  applyGesture(start: ViewState, anchorStart: Point, anchorCurrent: Point, ratio: number): void {
    this.view.applyGesture(
      start,
      this.interactionPoint(anchorStart.x, anchorStart.y),
      this.interactionPoint(anchorCurrent.x, anchorCurrent.y),
      ratio,
    );
    this.syncTransform();
  }

  resetView(): void { this.view.reset(); this.syncTransform(); }

  /** Reconciles the camera with the current fitted host after surrounding UI settles. */
  resizeToHost(): void { this.resize(); }

  screenToWorld(clientX: number, clientY: number): Point {
    return this.presenter
      ? this.presenter.clientWorldPoint(clientX, clientY)
      : this.view.viewportToWorld(this.viewportPoint(clientX, clientY));
  }

  screenToCell(clientX: number, clientY: number): { x: number; y: number } {
    const point = this.screenToWorld(clientX, clientY);
    return { x: Math.floor(point.x), y: Math.floor(point.y) };
  }

  /** Projects a world anchor into the same CSS-pixel space used by picking. */
  worldToScreen(x: number, y: number): Point {
    const bounds = this.host.getBoundingClientRect();
    const content = contentBoxFromBounds(bounds, this.host);
    return viewportToClient(
      this.view.worldToViewport({ x, y }),
      content,
      this.host.clientWidth,
      this.host.clientHeight,
    );
  }

  private viewportPoint(clientX: number, clientY: number): Point {
    const bounds = this.host.getBoundingClientRect();
    const content = contentBoxFromBounds(bounds, this.host);
    return clientToViewport(
      clientToVisualViewport({ x: clientX, y: clientY }),
      content, this.host.clientWidth, this.host.clientHeight,
    );
  }

  private interactionPoint(clientX: number, clientY: number): Point {
    if (!this.presenter) return this.viewportPoint(clientX, clientY);
    // Invert the actual transformed canvas rectangle, then return through the
    // same ViewTransform. This keeps gesture anchors in the exact coordinate
    // space used by WebGL picking even when CSS bounds are fractional.
    return this.view.worldToViewport(this.presenter.clientWorldPoint(clientX, clientY));
  }

  private async createWebGLPresenter(): Promise<PixiFieldPresenter> {
    const module = await import('./pixi-field-presenter');
    return module.PixiFieldPresenter.create(
      this.host, this.simulation.width, this.simulation.height, this.webGLOutputScale, ALL_MATERIALS,
      this.fallbackFields,
    );
  }

  private async promoteLatePresenter(pending: Promise<PixiFieldPresenter>): Promise<void> {
    let presenter: PixiFieldPresenter | undefined;
    const promotionTimeout = webGLPromotionTimeout(this.webGLOutputScale);
    const promotionDeadline = performance.now() + promotionTimeout;
    try {
      presenter = await settleWithin(pending, promotionTimeout);
      if (this.disposed) {
        try { presenter?.destroy(); } catch { /* document is already leaving */ }
        return;
      }
      if (!presenter) {
        this.setBackend({ backend: 'canvas2d', label: 'Canvas 2D', reason: 'webgl-timeout' });
        void pending.then((latePresenter) => latePresenter.destroy()).catch(() => undefined);
        return;
      }
      const ready = await this.commitPresenter(presenter, promotionDeadline);
      if (!ready) {
        const contextLost = presenter.isContextLost();
        if (this.presenter === presenter) this.presenter = undefined;
        try { presenter.destroy(); } catch { /* timed-out candidate is already unusable */ }
        this.syncFallbackVolumeSurfaces();
        this.contourChunks.markAll();
        this.changed = true;
        this.setBackend({
          backend: 'canvas2d', label: 'Canvas 2D',
          reason: contextLost ? 'webgl-context-lost' : 'webgl-timeout',
        });
        return;
      }
    } catch (error) {
      const contextLost = presenter?.isContextLost() ?? false;
      try { presenter?.destroy(); } catch { /* failed presenter is already unusable */ }
      this.presenter = undefined;
      // The candidate and Canvas intentionally share these fields. If the
      // candidate rebuilt one before its first render failed, mirror those
      // bytes back into the still-mounted Canvas surfaces before resuming it.
      this.syncFallbackVolumeSurfaces();
      this.contourChunks.markAll();
      this.changed = true;
      this.setBackend({
        backend: 'canvas2d', label: 'Canvas 2D',
        reason: contextLost ? 'webgl-context-lost' : 'webgl-error',
      });
      console.warn('Semantic WebGL renderer unavailable; keeping Canvas fallback.', error);
    }
  }

  private async commitPresenter(
    presenter: PixiFieldPresenter,
    promotionDeadline: number,
  ): Promise<boolean> {
    // Compile the shader and seed every semantic field while the known-good
    // Canvas remains visible. Any failure leaves the fallback fully intact.
    if (this.disposed) return false;
    const now = performance.now();
    presenter.setContextLossHandler(() => this.recoverFromWebGLFailure(presenter, 'webgl-context-lost'));
    presenter.setRenderStallHandler(() => this.recoverFromWebGLFailure(presenter, 'webgl-timeout'));
    if (this.webGLPresentationTimingEnabled) presenter.enableWebGLPresentationTiming();
    presenter.configurePresentation(
      this.gasFieldLightingEnabled,
      this.liquidFieldLightingEnabled,
      this.translucentFieldTransmissionEnabled,
      this.translucentBackdropRefractionEnabled,
      this.solidContactDepthEnabled,
      this.translucentLensShellEnabled,
      this.solidCurvatureDepthEnabled,
      this.thermalMaterialStylingEnabled && this.simulation.temperature !== undefined,
      this.energyCoreReliefEnabled,
      this.powderRenderStyle,
      this.surfaceContourLightingEnabled,
      this.phaseContactLightingEnabled,
      this.solidFieldLightingEnabled,
      this.liquidSilhouetteCohesionEnabled,
      this.gasVolumeChromaEnabled,
      this.liquidVolumeChromaEnabled,
      this.powderBodyDepthEnabled,
      this.emissionVolumeChromaEnabled,
      this.liquidOpticalDepthEnabled,
      this.solidOpticalDepthEnabled,
      this.roleMaterialStylingEnabled,
      this.cellularMaterialStylingEnabled,
      this.sensorMaterialStylingEnabled,
      this.unusualPowderStylingEnabled,
      this.unusualSolidStylingEnabled,
      this.liquidIdentityStylingEnabled,
      this.gasIdentityStylingEnabled,
      this.energyIdentityStylingEnabled,
      this.botanicalIdentityStylingEnabled,
      this.vibrStateStylingEnabled,
      this.deutStateStylingEnabled,
      this.baseStateStylingEnabled,
      this.sourceTargetStylingEnabled,
      this.explosivePowderStylingEnabled,
      this.forceActivityStylingEnabled,
      this.poloStateStylingEnabled,
      this.spngStateStylingEnabled,
      this.gelHydrationStylingEnabled,
      this.filtSpectrumStylingEnabled,
      this.quartzCrystalStateStylingEnabled,
      this.lavaAncestryStylingEnabled,
      this.botanicalLifecycleStylingEnabled,
      this.sparkStateStylingEnabled,
      this.structuralRigidStylingEnabled,
      this.geologicalSolidStylingEnabled,
      this.thermalCatalyticRigidStylingEnabled,
      this.gooSolidStylingEnabled,
      this.frayForceStylingEnabled,
      this.gbmbForceStylingEnabled,
      this.earthenPowderStylingEnabled,
      this.powderMesostrataStylingEnabled,
      this.moltenBodyOpticsEnabled,
      this.aqueousSurfaceReflectionEnabled,
      this.mechanismBodyStylingEnabled,
      this.electronicIdentityStylingEnabled,
      this.fieldProfileIdentityStylingEnabled,
      this.lcryStateStylingEnabled,
      this.pipePresentationStylingEnabled,
      this.storStateStylingEnabled,
      this.swchStateStylingEnabled,
      this.denseBodyAmbientFillEnabled,
      this.dlayStateStylingEnabled,
      this.wifiStateStylingEnabled,
    );
    // The browser audit bridge is installed before late WebGL promotion can
    // finish. Seed any same-page choice without submitting an unhydrated frame;
    // later calls route through this.presenter and render normally.
    if (this.desiredVisualLabVariant !== undefined) {
      presenter.setVisualLabVariant(this.desiredVisualLabVariant, false);
    }
    if (this.desiredMaterialLightingVariant !== undefined) {
      presenter.setMaterialLightingVariant(this.desiredMaterialLightingVariant, false);
    }
    // Route subsequent dirty cells to the candidate while its first expensive
    // frame is in flight. The known-good Canvas remains mounted underneath;
    // latest semantic/field mutations coalesce behind the presenter's fence.
    this.presenter = presenter;
    presenter.update(
      this.rendered, this.renderedWalls, this.simulation.temperature?.(), this.simulation.velocity?.(),
      this.simulation.presentationState?.(), this.simulation.photonState?.(),
      now, now, true,
    );
    if (presenter.isContextLost()) throw new Error('WebGL context lost during presenter promotion');
    presenter.mount();
    // Mounting replaces the fallback surface and can settle the host's fitted
    // layout in the same task. Route that geometry through the single renderer
    // resize owner so the presenter, camera, and tracked host size cannot begin
    // WebGL life with different viewport dimensions.
    this.resize();
    if (presenter.isContextLost()) throw new Error('WebGL context lost while mounting presenter');
    // update() may synchronously compile the large composed shader. Charge that
    // elapsed work to the original promotion window instead of starting a fresh
    // full wait after compilation returns. JavaScript cannot interrupt a driver
    // call mid-compile, but it can avoid extending the deadline a second time.
    const firstFrameTimeoutMs = Math.max(0, promotionDeadline - performance.now());
    if (!await presenter.waitForFirstFrame(firstFrameTimeoutMs)) return false;
    if (this.disposed) return false;
    if (presenter.isContextLost() || this.presenter !== presenter) return false;
    this.releaseFallbackStorage();
    this.setBackend({ backend: 'webgl', label: 'WebGL' });
    this.changed = true;
    return true;
  }

  private recoverFromWebGLFailure(
    presenter: PixiFieldPresenter,
    reason: 'webgl-context-lost' | 'webgl-timeout',
  ): void {
    if (this.presenter !== presenter) return;
    this.failFixtureActivationPresentationGeneration();
    this.presenter = undefined;
    try { presenter.destroy(); }
    catch { /* the browser has already invalidated the presenter */ }

    // The 8x compatibility Canvas was intentionally released after promotion.
    // Recreate only the bounded fallback now, after the failed 8x allocation is
    // gone, so recovery never retains both full presentation backings.
    if (!this.fallbackFields) this.initFallback();
    this.contourChunks.markAll();
    this.powderSurfaceDirty = true;
    this.solidOpticalDepthDirty = true;
    this.lastPowderSurfaceRefresh = -Infinity;
    this.lastSolidOpticalDepthRefresh = -Infinity;
    this.lastDynamicFieldRefresh = -Infinity;
    this.lastDraw = -Infinity;
    this.changed = true;
    this.syncTransform();
    this.setBackend({ backend: 'canvas2d', label: 'Canvas 2D', reason });
    this.render(performance.now());
    console.warn(reason === 'webgl-context-lost'
      ? 'Semantic WebGL context lost; restored bounded Canvas fallback.'
      : 'Semantic WebGL render stalled; restored bounded Canvas fallback.');
  }

  private releaseFallbackStorage(): void {
    this.fallbackSurface.remove();
    this.fallbackSurface.width = 0;
    this.fallbackSurface.height = 0;
    for (const canvas of [
      this.surface, this.liquidSurface, this.smokeSurface, this.fireSurface,
      this.atmosphereSurface, this.emissionSurface, this.contourSurface,
      this.contourChunkSurface,
    ]) {
      canvas.width = 0;
      canvas.height = 0;
    }
    this.fallbackFields = undefined;
    this.basePixels = undefined;
    this.liquidPixels = undefined;
    this.smokePixels = undefined;
    this.firePixels = undefined;
    this.atmospherePixels = undefined;
    this.emissionPixels = undefined;
    this.liquidSurfaceScratch = undefined;
    this.contourChunkPixels = undefined;
    this.atmosphereSurfaceActive = false;
    this.emissionSurfaceActive = false;
    this.smokeSurfaceActive = false;
    this.fireSurfaceActive = false;
  }

  private syncFallbackVolumeSurfaces(): void {
    const fields = this.fallbackFields;
    if (!fields) return;
    this.syncCanvasAtmosphereSurface(fields);
    this.syncCanvasEmissionSurface(fields);
  }

  /** Uploads a packed field only while it is visible, plus once to clear it. */
  private syncCanvasAtmosphereSurface(fields: RenderFieldSet): boolean {
    const pixels = this.atmospherePixels;
    const active = fields.atmosphere.hasVolume;
    if (!pixels || (!active && !this.atmosphereSurfaceActive)) return false;
    shadeCanvasAtmosphere(
      pixels.data, fields.atmosphere.bytes,
      fields.atmosphere.width, fields.atmosphere.height,
      this.gasFieldLightingEnabled ? fields.emission : undefined,
      this.gasVolumeChromaEnabled,
      fields.atmosphere.styleBytes,
      this.gasIdentityStylingEnabled,
    );
    this.atmosphereContext.putImageData(pixels, 0, 0);
    this.atmosphereSurfaceActive = active;
    return true;
  }

  /** Uploads a packed field only while it is visible, plus once to clear it. */
  private syncCanvasEmissionSurface(fields: RenderFieldSet): boolean {
    const pixels = this.emissionPixels;
    const active = fields.emission.hasLight;
    if (!pixels || (!active && !this.emissionSurfaceActive)) return false;
    shadeCanvasEmissionVolume(
      pixels.data, fields.emission.bytes,
      fields.emission.width, fields.emission.height,
      this.emissionVolumeChromaEnabled,
    );
    this.emissionContext.putImageData(pixels, 0, 0);
    this.emissionSurfaceActive = active;
    return true;
  }

  private setBackend(backend: RendererBackendInfo): void {
    this.backend = backend;
    const effectiveScale = backend.backend === 'webgl' ? this.webGLOutputScale : this.outputScale;
    this.host.dataset.rendererBackend = backend.backend;
    this.host.dataset.requestedOutputScale = String(this.requestedOutputScale);
    this.host.dataset.outputScale = String(effectiveScale);
    if (backend.reason) this.host.dataset.rendererReason = backend.reason;
    else delete this.host.dataset.rendererReason;
    this.fallbackSurface.dataset.rendererReason = backend.reason ?? '';
  }

  private drawField(scheduleTime: number, visualTime: number, refreshDynamicFields: boolean): void {
    const width = this.simulation.width;
    const height = this.simulation.height;
    const temperatures = this.simulation.temperature?.();
    const velocities = this.simulation.velocity?.();
    const presentationState = this.simulation.presentationState?.();
    const photonState = this.simulation.photonState?.();
    if (this.presenter) {
      this.presenter.update(
        this.rendered, this.renderedWalls, temperatures, velocities, presentationState, photonState,
        scheduleTime, visualTime, refreshDynamicFields,
      );
      return;
    }
    const fields = this.fallbackFields;
    const basePixels = this.basePixels;
    const liquidPixels = this.liquidPixels;
    const smokePixels = this.smokePixels;
    const firePixels = this.firePixels;
    const atmospherePixels = this.atmospherePixels;
    const emissionPixels = this.emissionPixels;
    const liquidSurfaceScratch = this.liquidSurfaceScratch;
    if (!fields || !basePixels || !liquidPixels || !smokePixels || !firePixels
      || !atmospherePixels || !emissionPixels || !liquidSurfaceScratch) {
      throw new Error('Canvas render fields unavailable');
    }
    const activationOwner = this.fixtureActivationPresentation?.ticket ?? 0;
    this.boundaryEvolutionPending = false;
    if (this.fixtureActivationBoundaryOwner === activationOwner) {
      this.fixtureActivationBoundaryOwner = 0;
      this.fixtureActivationBoundaryConsumptionOwner = activationOwner;
    }
    updateBoundaryStabilityRect(
      this.boundaryStability, this.boundaryStabilityOwners, this.rendered, velocities,
      fields.lookups.styleBytes, width, { x: 0, y: 0, width, height }, this.boundaryDirtyMarker,
    );
    this.fixtureActivationBoundaryConsumptionOwner = 0;
    if (this.powderSurfaceDirty
      && scheduleTime - this.lastPowderSurfaceRefresh >= POWDER_SURFACE_REFRESH_INTERVAL) {
      const powderSurfaceChanged = fields.powderSurface.update(
        this.rendered, this.boundaryStability, this.renderedWalls,
      );
      this.powderSurfaceDirty = false;
      if (this.fixtureActivationPowderOwner === activationOwner) {
        this.fixtureActivationPowderOwner = 0;
      }
      this.lastPowderSurfaceRefresh = scheduleTime;
      if (powderSurfaceChanged) this.contourChunks.markAll();
    }
    if (this.solidOpticalDepthDirty
      && scheduleTime - this.lastSolidOpticalDepthRefresh >= POWDER_SURFACE_REFRESH_INTERVAL) {
      writeSolidOpticalDepth(
        this.rendered, this.boundaryStability, fields.lookups.styleBytes,
        width, this.renderedWalls, this.unusualSolidStylingEnabled,
      );
      this.solidOpticalDepthDirty = false;
      if (this.fixtureActivationSolidOwner === activationOwner) {
        this.fixtureActivationSolidOwner = 0;
      }
      this.lastSolidOpticalDepthRefresh = scheduleTime;
      this.contourChunks.markAll();
    }
    const timingStart = this.canvasPresentationTimingEnabled ? performance.now() : undefined;
    let volumePlaneUploads = 0;
    if (refreshDynamicFields && temperatures) {
      fields.markThermalEmissionDirty(this.fixtureActivationDynamicOwner);
    }
    const rebuiltField = fields.updateNext(
      this.rendered, scheduleTime, this.renderedWalls, velocities, temperatures,
    );
    fields.refreshSuspension(this.rendered, scheduleTime, this.renderedWalls);
    if (rebuiltField === 'liquid' || !this.canvasLiquidOpticalDepthHydrated) {
      fields.liquid.writeVerticalOpticalDepth(
        this.rendered, this.boundaryStability, this.renderedWalls,
      );
      this.canvasLiquidOpticalDepthHydrated = true;
      if (this.liquidSilhouetteCohesionEnabled) this.contourChunks.markAll();
    }
    if (rebuiltField === 'emission') {
      this.contourChunks.markAll();
      if (this.syncCanvasEmissionSurface(fields)) volumePlaneUploads++;
    }
    if (rebuiltField === 'atmosphere' || rebuiltField === 'emission'
      || this.gasFieldLightingDirty || this.gasVolumeChromaDirty
      || this.gasIdentityStylingDirty) {
      if (this.syncCanvasAtmosphereSurface(fields)) volumePlaneUploads++;
      this.gasFieldLightingDirty = false;
      this.gasVolumeChromaDirty = false;
      this.gasIdentityStylingDirty = false;
    }
    const fieldMs = timingStart === undefined ? undefined : performance.now() - timingStart;
    const materialTimingStart = timingStart === undefined ? undefined : performance.now();
    const base = basePixels.data;
    const liquid = liquidPixels.data;
    const smoke = smokePixels.data;
    const fire = firePixels.data;
    updateCanvasRenderTraitClock(this.traitClock, visualTime);
    base.fill(0); liquid.fill(0);
    // The source ImageData must still reset whenever its previous upload was
    // non-empty. Once an inactive transition has uploaded zeroes, skip both
    // repeated clears and repeated offscreen transfers until the plane returns.
    if (this.smokeSurfaceActive) smoke.fill(0);
    if (this.fireSurfaceActive) fire.fill(0);
    const suspensionSemanticActive = this.powderRenderStyle === 'smooth'
      && fields.suspension.hasSuspension;

    // Surface reconstruction scans the full 612x384 semantic plane. Record the
    // required phases while already walking that plane so gas/energy-only
    // Canvas frames do not pay for impossible solid/liquid reconstruction.
    let hasSolidSurface = false;
    let hasLiquidSurface = false;
    let hasSemanticGas = false;
    let hasLocalEmission = false;
    let index = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++, index++) {
      const material = this.rendered[index] as Material;
      const pixel = index * 4;
      const wall = this.renderedWalls?.[index] ?? 0;
      if (wall) {
        let refractedLiquid = false;
        if (this.translucentBackdropRefractionEnabled
          && fields.lookups.liquidByMaterial[material] !== 0
          && fields.lookups.styleBytes[material * 4 + 2] === 0) {
          const liquidOptics = fields.lookups.paletteBytes[material * 4 + 3] as RenderOptics;
          const leftLiquid = x > 0
            && (fields.lookups.liquidByMaterial[this.rendered[index - 1]] !== 0
              || (this.rendered[index - 1] === Material.Empty
                && fields.liquid.bytes[pixel - 4 + 3] >= 128));
          const rightLiquid = x < width - 1
            && (fields.lookups.liquidByMaterial[this.rendered[index + 1]] !== 0
              || (this.rendered[index + 1] === Material.Empty
                && fields.liquid.bytes[pixel + 4 + 3] >= 128));
          const topLiquid = y > 0
            && (fields.lookups.liquidByMaterial[this.rendered[index - width]] !== 0
              || (this.rendered[index - width] === Material.Empty
                && fields.liquid.bytes[pixel - width * 4 + 3] >= 128));
          const bottomLiquid = y < height - 1
            && (fields.lookups.liquidByMaterial[this.rendered[index + width]] !== 0
              || (this.rendered[index + width] === Material.Empty
                && fields.liquid.bytes[pixel + width * 4 + 3] >= 128));
          const liquidEdgeX = Number(leftLiquid) - Number(rightLiquid);
          const liquidEdgeY = Number(topLiquid) - Number(bottomLiquid);
          refractedLiquid = writeCanvasLiquidRefractedWallPixel(
            base, pixel, wall, x, y, liquidOptics, liquidEdgeX, liquidEdgeY,
          );
        }
        if (!refractedLiquid) writeCanvasWallPixel(base, pixel, wall, x, y);
        if (material === Material.Empty && fields.emission.hasLight) {
          const wallExposure = cardinalExposure(this.renderedWalls, width, height, x, y, wall);
          lightCanvasSurface(
            base, pixel, fields.emission.bytes, fields.emission.width, fields.emission.height,
            width, height, x, y, RenderProfile.Rigid, wallExposure,
          );
        }
      }
      if (material === Material.Empty) continue;
      const phase = fields.lookups.styleBytes[material * 4] as RenderPhase;
      const profile = fields.lookups.styleBytes[material * 4 + 1] as RenderProfile;
      const traits = fields.lookups.styleBytes[material * 4 + 3];
      const optics = fields.lookups.paletteBytes[material * 4 + 3] as RenderOptics;
      const liquidMaterial = fields.lookups.liquidByMaterial[material] !== 0;
      if (phase === RenderPhase.Solid) hasSolidSurface = true;
      if (liquidMaterial) hasLiquidSurface = true;
      if (phase === RenderPhase.Gas) hasSemanticGas = true;
      const applicableTraits = applicableCanvasRenderTraits(traits, phase);
      const gasAtmosphereAlpha = phase === RenderPhase.Gas
        ? canvasAtmosphereAlphaAtWorldCell(
          fields.atmosphere.bytes, fields.atmosphere.width, fields.atmosphere.height,
          width, height, x, y,
        )
        : 0;
      if (phase === RenderPhase.Liquid || phase === RenderPhase.Energy
        || applicableTraits !== 0 || material === Material.Dust) {
        this.contourChunks.markCell(index);
      }
      const target = liquidMaterial ? liquid : base;
      const top = y === 0 ? Material.Empty : this.rendered[index - width] as Material;
      const left = x === 0 ? Material.Empty : this.rendered[index - 1] as Material;
      const right = x === width - 1 ? Material.Empty : this.rendered[index + 1] as Material;
      const bottom = y === height - 1 ? Material.Wall : this.rendered[index + width] as Material;
      const exposedTop = top !== material;
      const liquidContourScale = phase === RenderPhase.Liquid
        ? canvasLiquidContourScale(fields.liquid.bytes[pixel + 3])
        : 1;
      const liquidSurfaceExposure = phase === RenderPhase.Liquid
        ? canvasLiquidSurfaceExposure(
          fields.liquid.bytes, width, x, y, top === Material.Empty,
        )
        : 0;
      const liquidSpeciesContact = phase === RenderPhase.Liquid && (
        (top !== material && fields.lookups.liquidByMaterial[top] !== 0)
        || (left !== material && fields.lookups.liquidByMaterial[left] !== 0)
        || (right !== material && fields.lookups.liquidByMaterial[right] !== 0)
        || (bottom !== material && fields.lookups.liquidByMaterial[bottom] !== 0)
      );
      const liquidForeignMatterContact = phase === RenderPhase.Liquid && (
        (top !== material && top !== Material.Empty && fields.lookups.liquidByMaterial[top] === 0)
        || (left !== material && left !== Material.Empty && fields.lookups.liquidByMaterial[left] === 0)
        || (right !== material && right !== Material.Empty && fields.lookups.liquidByMaterial[right] === 0)
        || (bottom !== material && bottom !== Material.Empty && fields.lookups.liquidByMaterial[bottom] === 0)
      );
      const liquidSpeciesRelief = phase === RenderPhase.Liquid && liquidSpeciesContact
        ? canvasLiquidSpeciesRelief(fields.liquid.bytes, width, height, x, y)
        : 0;
      // A species interface has its own bounded symmetric meniscus below. Keep
      // only a restrained directional component in the family body-depth term:
      // full contrast would turn one side of Water/Oil into an oversized bright
      // ridge instead of a stable shared interface.
      const liquidFieldRelief = phase === RenderPhase.Liquid
        ? canvasLiquidFieldRelief(fields.liquid.bytes, width, height, x, y) + liquidSpeciesRelief * 0.44
        : 0;
      const liquidEmissionExposure = phase === RenderPhase.Liquid
        && this.liquidFieldLightingEnabled && fields.emission.hasLight
        && !PROJECTED_RENDER_INFO[material]?.emissive
        && (top === Material.Empty || left === Material.Empty
          || right === Material.Empty || bottom === Material.Empty)
        ? canvasLiquidEmissionExposure(
          canvasLiquidEmissionSurfaceExposure(
            fields.liquid.bytes, width, height, x, y,
            top === Material.Empty, left === Material.Empty,
            right === Material.Empty, bottom === Material.Empty,
          ),
          liquidFieldRelief,
        )
        : 0;
      const normalLight = (left === Material.Empty ? 8 : 0) - (right === Material.Empty ? 6 : 0)
        + (exposedTop ? 18 : 0) - (bottom === Material.Empty ? 5 : 0);
      const denseSolidInterior = phase === RenderPhase.Solid
        && top === material && left === material && right === material && bottom === material;
      const solidRelief = denseSolidInterior
        ? canvasSolidRelief(x, y, material, profile, optics)
        : 0;
      const surfaceLight = normalLight + solidRelief;
      const projectedInfo = PROJECTED_RENDER_INFO[material];
      const solidOpticalDepth = phase === RenderPhase.Solid && material !== Material.Wall
        && !projectedInfo?.emissive
        ? this.boundaryStability[index] : 0;
      const solidFieldReachable = phase === RenderPhase.Solid && wall === 0
        && !(projectedInfo?.emissive ?? false) && this.solidFieldLightingEnabled
        && fields.emission.hasLight && fields.emission.mayLightWorldCell(x, y);
      const solidFieldGain = solidFieldReachable ? canvasSolidFieldLightingGain(
        phase, optics, traits, projectedInfo?.emissive ?? false,
        denseSolidInterior, wall !== 0, true,
      ) : 0;
      const solidBodyFieldExposure = solidFieldReachable ? canvasSolidBodyFieldExposure(
        phase, profile, optics, applicableTraits, projectedInfo?.emissive ?? false,
        denseSolidInterior, wall !== 0, solidOpticalDepth, solidRelief, true,
      ) : 0;
      let solidFieldNormalX = 0;
      let solidFieldNormalY = 0;
      if (solidFieldGain > 0) {
        const leftSolid = ordinarySolidNeighbour(fields.lookups.styleBytes, left);
        const rightSolid = ordinarySolidNeighbour(fields.lookups.styleBytes, right);
        const topSolid = ordinarySolidNeighbour(fields.lookups.styleBytes, top);
        const bottomSolid = ordinarySolidNeighbour(fields.lookups.styleBytes, bottom);
        solidFieldNormalX = Number(!rightSolid) - Number(!leftSolid);
        solidFieldNormalY = Number(!bottomSolid) - Number(!topSolid);
      }
      const powderBulkDepth = phase === RenderPhase.Powder
        && this.powderRenderStyle === 'smooth' && applicableTraits === 0
        && !projectedInfo?.emissive
        ? canvasPowderBulkDepth(this.rendered, width, height, x, y, material)
        : 0;
      const powderCanonicalColor = powderBulkDepth > 0 ? projectedInfo?.color ?? 0 : 0;
      if (this.translucentBackdropRefractionEnabled && wall && phase === RenderPhase.Solid
        && (material === Material.Glass || material === Material.Ice)
        && applicableTraits === 0 && !PROJECTED_RENDER_INFO[material]?.emissive) {
        const solidLeft = left !== Material.Empty && left !== Material.Wall
          && fields.lookups.styleBytes[left * 4] === RenderPhase.Solid;
        const solidRight = right !== Material.Empty && right !== Material.Wall
          && fields.lookups.styleBytes[right * 4] === RenderPhase.Solid;
        const solidTop = top !== Material.Empty && top !== Material.Wall
          && fields.lookups.styleBytes[top * 4] === RenderPhase.Solid;
        const solidBottom = bottom !== Material.Empty && bottom !== Material.Wall
          && fields.lookups.styleBytes[bottom * 4] === RenderPhase.Solid;
        writeCanvasRefractedWallPixel(
          base, pixel, wall, x, y, material,
          (solidRight ? 0 : 1) - (solidLeft ? 0 : 1),
          (solidBottom ? 0 : 1) - (solidTop ? 0 : 1),
        );
      }

      if (phase === RenderPhase.Energy) {
        const info = PROJECTED_RENDER_INFO[material];
        if (!info) continue;
        const energyNeighbourCount = Number(top === material) + Number(left === material)
          + Number(right === material) + Number(bottom === material);
        const energyFieldSupport = energyNeighbourCount === 4
          ? 255
          : energyNeighbourCount >= 2 ? 96 : sampleCanvasFieldAlpha(
            fields.emission.bytes, fields.emission.width, fields.emission.height,
            width, height, x, y,
          );
        const red = info.color >>> 16;
        const green = (info.color >>> 8) & 0xFF;
        const blue = info.color & 0xFF;
        const heat = semanticRenderHeat(temperatures?.[index]);
        const glowAlpha = shadeCanvasEnergy(
          this.styledColor, this.energyGlowColor, red, green, blue, profile, traits,
          material, x, y, visualTime, heat,
          velocities?.[index * 2] ?? 0, velocities?.[index * 2 + 1] ?? 0,
          energyFieldSupport, this.energyCoreReliefEnabled, normalLight,
          this.energyIdentityStylingEnabled,
        );
        if (applicableTraits !== 0) applyCanvasRenderTraits(
          this.styledColor, applicableTraits, phase, material, x, y, index, this.traitClock,
          this.roleMaterialStylingEnabled, this.energyIdentityStylingEnabled,
        );
        compositePixel(target, pixel, this.styledColor[0], this.styledColor[1], this.styledColor[2], 245);
        setPixel(
          fire, pixel,
          this.energyGlowColor[0], this.energyGlowColor[1], this.energyGlowColor[2], glowAlpha,
        );
        hasLocalEmission = true;
      } else if (material === Material.Sand) {
        const grain = hash(index) % 23 - 11;
        this.styledColor[0] = 194 + grain + surfaceLight;
        this.styledColor[1] = 145 + grain * 0.65 + surfaceLight;
        this.styledColor[2] = 76 + grain * 0.35 + surfaceLight;
        applyCanvasPowderBulkCellStyle(
          this.styledColor, powderCanonicalColor, this.boundaryStability[index],
          fields.powderSurface.bytes, pixel, powderBulkDepth, this.powderBodyDepthEnabled, optics,
          material, x, y, this.powderMesostrataStylingEnabled,
        );
        if (this.earthenPowderStylingEnabled && wall === 0 && applicableTraits === 0) {
          applyCanvasEarthenPowderStyle(this.styledColor, material, x, y);
        }
        this.applyThermalMaterialStyle(
          phase, material, false, applicableTraits, temperatures?.[index], optics,
        );
        compositePixel(
          target, pixel, this.styledColor[0], this.styledColor[1], this.styledColor[2], 255,
        );
      } else if (material === Material.Dust) {
        const grain = hash(index) % 23 - 11;
        const softness = Math.sin(visualTime * 0.0018 + x * 0.17 + y * 0.09) * 4;
        this.styledColor[0] = 188 + grain + surfaceLight + softness;
        this.styledColor[1] = 166 + grain + surfaceLight + softness;
        this.styledColor[2] = 124 + grain * 0.6 + surfaceLight;
        applyCanvasPowderBulkCellStyle(
          this.styledColor, powderCanonicalColor, this.boundaryStability[index],
          fields.powderSurface.bytes, pixel, powderBulkDepth, this.powderBodyDepthEnabled, optics,
          material, x, y, this.powderMesostrataStylingEnabled,
        );
        this.applyThermalMaterialStyle(
          phase, material, false, applicableTraits, temperatures?.[index], optics,
        );
        compositePixel(
          target, pixel, this.styledColor[0], this.styledColor[1], this.styledColor[2], 238,
        );
      } else if (material === Material.Salt) {
        const grain = hash(index) % 23 - 11;
        const crystal = (hash(index + 211) & 7) === 0 ? 28 : 0;
        this.styledColor[0] = 220 + grain + crystal + surfaceLight;
        this.styledColor[1] = 216 + grain + crystal + surfaceLight;
        this.styledColor[2] = 202 + grain + crystal + surfaceLight;
        applyCanvasPowderBulkCellStyle(
          this.styledColor, powderCanonicalColor, this.boundaryStability[index],
          fields.powderSurface.bytes, pixel, powderBulkDepth, this.powderBodyDepthEnabled, optics,
          material, x, y, this.powderMesostrataStylingEnabled,
        );
        if (this.unusualPowderStylingEnabled && wall === 0 && applicableTraits === 0
          && !projectedInfo?.emissive) {
          applyCanvasCrystallinePowderStyle(this.styledColor, material, x, y);
        }
        this.applyThermalMaterialStyle(
          phase, material, false, applicableTraits, temperatures?.[index], optics,
        );
        compositePixel(
          target, pixel, this.styledColor[0], this.styledColor[1], this.styledColor[2], 255,
        );
      } else if (material === Material.Oil) {
        const mask = materialNeighbourMask(this.rendered, width, height, x, y, material);
        const density = neighbourDensity(mask);
        const liquidVolumeInterior = isMaterialBulkInterior(
          this.rendered, width, height, x, y, material, mask,
        );
        const liquidFieldAlpha = fields.liquid.bytes[pixel + 3];
        const liquidBodySupport = canvasLiquidBodySupport(liquidFieldAlpha, density);
        const contour = contourLight(mask) * liquidContourScale;
        const flow = velocities ? velocities[index * 2] * 0.12 : 0;
        const sheen = Math.sin(visualTime * 0.0017 + x * 0.055 + y * 0.025 + flow) * 5 + contour;
        const depth = density / 8;
        this.styledColor[0] = 100 - depth * 28 + sheen;
        this.styledColor[1] = 74 - depth * 24 + sheen * 0.65;
        this.styledColor[2] = 39 - depth * 14 + sheen * 0.3;
        applyCanvasLiquidBodyOptics(
          this.styledColor, optics, liquidFieldAlpha, density,
          liquidFieldRelief, liquidSurfaceExposure, liquidBodySupport,
        );
        if (this.liquidFieldLightingEnabled && liquidSpeciesContact
          && !liquidForeignMatterContact && wall === 0) {
          applyCanvasLiquidInterfaceMeniscus(
            this.styledColor, optics, fields.liquid.bytes[pixel + 3], density, liquidSpeciesRelief,
          );
        }
        // Volume chroma belongs to an exact same-species bulk. Keeping the
        // one-cell shore neutral prevents the 2x presentation from bleeding a
        // body tint into an otherwise field-lit unlike-liquid meniscus.
        if (this.liquidVolumeChromaEnabled && liquidVolumeInterior && !liquidSpeciesContact) {
          const causticPhase = liquidBodySupport > 0 && wall === 0
            ? canvasLiquidCausticPhase(x, y, visualTime, material) : 0;
          const macroWave = liquidBodySupport > 0
            ? (wall === 0 ? canvasLiquidMacroWave(x, y, visualTime, material, causticPhase) : (sheen - contour) / 5)
            : 0;
          const macroCaustic = liquidBodySupport > 0 && wall === 0
            ? canvasLiquidCausticWave(x, y, visualTime, material, causticPhase) : 0;
          if (liquidBodySupport > 0 && wall === 0) {
            applyCanvasLiquidMacroSheen(
              this.styledColor, optics, liquidFieldAlpha, density, macroWave, liquidBodySupport,
            );
            applyCanvasLiquidMacroCaustic(
              this.styledColor, optics, liquidFieldAlpha, density, macroCaustic, liquidBodySupport,
            );
          }
          applyCanvasLiquidVolumeChroma(
            this.styledColor, optics, canvasLiquidVolumeChromaResponse(
              optics, liquidFieldAlpha, density,
              liquidFieldRelief, macroWave, liquidBodySupport,
            ),
            false,
          );
        }
        if ((this.liquidVolumeChromaEnabled || this.liquidOpticalDepthEnabled)
          && liquidVolumeInterior && !liquidSpeciesContact) {
          applyCanvasLiquidOpticalDepth(
            this.styledColor, optics,
            this.liquidOpticalDepthEnabled ? this.boundaryStability[index] : 0,
          );
        }
        compositePixel(
          target, pixel,
          this.styledColor[0], this.styledColor[1], this.styledColor[2], canvasLiquidAlpha(density),
        );
      } else if (material === Material.Wood) {
        const canonical = projectedInfo?.color ?? 0x9b6038;
        this.styledColor[0] = canonical >>> 16;
        this.styledColor[1] = canonical >>> 8 & 0xff;
        this.styledColor[2] = canonical & 0xff;
        applyCanvasSolidBodyOptics(
          this.styledColor, surfaceLight, normalLight, solidRelief,
          denseSolidInterior, profile, optics, solidOpticalDepth, this.solidOpticalDepthEnabled,
        );
        applyCanvasRenderTraits(
          this.styledColor, applicableTraits, phase, material, x, y, index, this.traitClock,
          this.roleMaterialStylingEnabled, this.energyIdentityStylingEnabled,
        );
        this.applyThermalMaterialStyle(
          phase, material, false, applicableTraits, temperatures?.[index], optics,
        );
        if (this.botanicalIdentityStylingEnabled) {
          applyCanvasBotanicalMorphology(this.styledColor, material, x, y, index);
        }
        compositePixel(
          target, pixel, this.styledColor[0], this.styledColor[1], this.styledColor[2], 255,
        );
      } else if (material === Material.Plant) {
        const canonical = projectedInfo?.color ?? 0x65a95f;
        this.styledColor[0] = canonical >>> 16;
        this.styledColor[1] = canonical >>> 8 & 0xff;
        this.styledColor[2] = canonical & 0xff;
        applyCanvasSolidBodyOptics(
          this.styledColor, surfaceLight, normalLight, solidRelief,
          denseSolidInterior, profile, optics, solidOpticalDepth, this.solidOpticalDepthEnabled,
        );
        applyCanvasPlantCanopyVolume(
          this.styledColor, material, denseSolidInterior, solidOpticalDepth,
          this.solidOpticalDepthEnabled, solidRelief, x, y,
        );
        applyCanvasRenderTraits(
          this.styledColor, applicableTraits, phase, material, x, y, index, this.traitClock,
          this.roleMaterialStylingEnabled, this.energyIdentityStylingEnabled,
        );
        this.applyThermalMaterialStyle(
          phase, material, false, applicableTraits, temperatures?.[index], optics,
        );
        if (this.botanicalIdentityStylingEnabled) {
          applyCanvasBotanicalMorphology(this.styledColor, material, x, y, index);
        }
        if (this.botanicalLifecycleStylingEnabled && presentationState) {
          applyCanvasBotanicalLifecycleStyle(
            this.styledColor, material, presentationState[index], x, y,
          );
        }
        compositePixel(
          target, pixel, this.styledColor[0], this.styledColor[1], this.styledColor[2], 255,
        );
      } else if (material === Material.Lava) {
        const mask = materialNeighbourMask(this.rendered, width, height, x, y, material);
        const density = neighbourDensity(mask);
        const liquidFieldAlpha = fields.liquid.bytes[pixel + 3];
        const liquidBodySupport = canvasLiquidBodySupport(liquidFieldAlpha, density);
        const contour = contourLight(mask) * liquidContourScale;
        const kelvin = temperatures ? temperatures[index] / 10 : 1450;
        const heat = clamp((kelvin - 700) / 1100, 0, 1);
        const crust = density > 6 ? -52 : 0;
        const pulse = Math.sin(visualTime * 0.003 + x * 0.1 + y * 0.07) * 8;
        this.styledColor[0] = 216 + crust + heat * 26 + contour * 0.35;
        this.styledColor[1] = 48 + pulse + heat * 110 + contour * 0.5;
        this.styledColor[2] = 8 + heat * 48;
        applyCanvasLiquidBodyOptics(
          this.styledColor, optics, liquidFieldAlpha, density,
          liquidFieldRelief, liquidSurfaceExposure, liquidBodySupport,
        );
        if (this.lavaAncestryStylingEnabled && presentationState) {
          applyCanvasLavaAncestryStyle(
            this.styledColor, material, presentationState[index], x, y,
          );
        }
        compositePixel(
          target, pixel,
          this.styledColor[0], this.styledColor[1], this.styledColor[2], canvasLiquidAlpha(density),
        );
        if (liquidSurfaceExposure > 0) {
          setPixel(
            fire, pixel, 255, 72 + heat * 112 + pulse, 12,
            (48 + heat * 34 + Math.max(0, contour)) * liquidSurfaceExposure,
          );
          hasLocalEmission = true;
        }
      } else if (material === Material.Ice) {
        const facet = (hash(index + 617) & 15) < 3 ? 24 : 0;
        this.styledColor[0] = 116 + facet;
        this.styledColor[1] = 193 + facet;
        this.styledColor[2] = 211 + facet;
        applyCanvasSolidBodyOptics(
          this.styledColor, surfaceLight, normalLight, solidRelief,
          denseSolidInterior, profile, optics, solidOpticalDepth, this.solidOpticalDepthEnabled,
        );
        if (this.solidContactDepthEnabled && denseSolidInterior) {
          applyCanvasTranslucentCaustic(this.styledColor, solidRelief, material);
        }
        if (this.translucentLensShellEnabled) {
          applyCanvasTranslucentLensShell(
            this.styledColor, solidRelief, normalLight, material, solidOpticalDepth,
          );
        }
        this.applyThermalMaterialStyle(
          phase, material, false, applicableTraits, temperatures?.[index], optics,
        );
        compositePixel(
          target, pixel,
          this.styledColor[0], this.styledColor[1], this.styledColor[2], 202,
        );
      } else if (material === Material.Acid) {
        const mask = materialNeighbourMask(this.rendered, width, height, x, y, material);
        const density = neighbourDensity(mask);
        const liquidVolumeInterior = isMaterialBulkInterior(
          this.rendered, width, height, x, y, material, mask,
        );
        const liquidFieldAlpha = fields.liquid.bytes[pixel + 3];
        const liquidBodySupport = canvasLiquidBodySupport(liquidFieldAlpha, density);
        const contour = contourLight(mask) * liquidContourScale;
        const depth = density / 8;
        const shimmer = Math.sin(visualTime * 0.0024 + x * 0.075 + y * 0.035) * 6 + contour;
        this.styledColor[0] = 211 - depth * 30 + shimmer;
        this.styledColor[1] = 94 - depth * 22 + shimmer * 0.7;
        this.styledColor[2] = 232 - depth * 24 + shimmer;
        applyCanvasLiquidBodyOptics(
          this.styledColor, optics, liquidFieldAlpha, density,
          liquidFieldRelief, liquidSurfaceExposure, liquidBodySupport,
        );
        if (this.liquidFieldLightingEnabled && liquidSpeciesContact
          && !liquidForeignMatterContact && wall === 0) {
          applyCanvasLiquidInterfaceMeniscus(
            this.styledColor, optics, fields.liquid.bytes[pixel + 3], density, liquidSpeciesRelief,
          );
        }
        if (this.liquidVolumeChromaEnabled && liquidVolumeInterior && !liquidSpeciesContact) {
          const causticPhase = liquidBodySupport > 0 && wall === 0
            ? canvasLiquidCausticPhase(x, y, visualTime, material) : 0;
          const macroWave = liquidBodySupport > 0
            ? (wall === 0 ? canvasLiquidMacroWave(x, y, visualTime, material, causticPhase) : (shimmer - contour) / 6)
            : 0;
          const macroCaustic = liquidBodySupport > 0 && wall === 0
            ? canvasLiquidCausticWave(x, y, visualTime, material, causticPhase) : 0;
          if (liquidBodySupport > 0 && wall === 0
            && !liquidForeignMatterContact && applicableTraits === 0 && !projectedInfo?.emissive) {
            applyCanvasLiquidMacroSheen(
              this.styledColor, optics, liquidFieldAlpha, density, macroWave, liquidBodySupport,
            );
            applyCanvasLiquidMacroCaustic(
              this.styledColor, optics, liquidFieldAlpha, density, macroCaustic, liquidBodySupport,
            );
          }
          applyCanvasLiquidVolumeChroma(
            this.styledColor, optics, canvasLiquidVolumeChromaResponse(
              optics, liquidFieldAlpha, density,
              liquidFieldRelief, macroWave, liquidBodySupport,
            ),
            false,
          );
          // Match normal WebGL's exact Acid-only deep-body chroma with the
          // already computed field support and low-frequency liquid signals.
          // The vector is Rec.709-luma-neutral, and this RGB-only addition is
          // unreachable for shores, droplets, seams, walls, or reconstructed
          // support because the same-species bulk proof above owns it.
          if (liquidBodySupport > 0 && wall === 0
            && !liquidForeignMatterContact && applicableTraits === 0 && !projectedInfo?.emissive) {
            const acidCoreVolume = liquidBodySupport * Math.max(0, Math.min(1, (density - 4) / 4));
            const acidCoreGlaze = acidCoreVolume * (
              0.020 + macroWave * 0.045 + macroCaustic * 0.025
            );
            this.styledColor[0] += 255 * 0.28 * acidCoreGlaze;
            this.styledColor[1] -= 255 * 0.15 * acidCoreGlaze;
            this.styledColor[2] += 255 * 0.65 * acidCoreGlaze;
          }
        }
        if ((this.liquidVolumeChromaEnabled || this.liquidOpticalDepthEnabled)
          && liquidVolumeInterior && !liquidSpeciesContact) {
          applyCanvasLiquidOpticalDepth(
            this.styledColor, optics,
            this.liquidOpticalDepthEnabled ? this.boundaryStability[index] : 0,
          );
        }
        compositePixel(
          target, pixel,
          this.styledColor[0], this.styledColor[1], this.styledColor[2], canvasLiquidAlpha(density),
        );
      } else if (material === Material.Gunpowder) {
        const grain = hash(index) % 23 - 11;
        // Sooty powder keeps an occasional reactive fleck, but not a mineral-
        // bright cell that makes a settled bulk read as glitter.
        const spark = (hash(index + 911) & 31) === 0 ? 12 : 0;
        this.styledColor[0] = 70 + grain + spark + surfaceLight;
        this.styledColor[1] = 64 + grain + spark * 0.7 + surfaceLight;
        this.styledColor[2] = 58 + grain + spark * 0.35 + surfaceLight;
        if (this.explosivePowderStylingEnabled && wall === 0
          && applicableTraits === 0 && !projectedInfo?.emissive) {
          applyCanvasExplosivePowderStyle(this.styledColor, material, x, y);
        }
        applyCanvasPowderBulkCellStyle(
          this.styledColor, powderCanonicalColor, this.boundaryStability[index],
          fields.powderSurface.bytes, pixel, powderBulkDepth, this.powderBodyDepthEnabled, optics,
          material, x, y, this.powderMesostrataStylingEnabled,
        );
        this.applyThermalMaterialStyle(
          phase, material, false, applicableTraits, temperatures?.[index], optics,
        );
        compositePixel(
          target, pixel, this.styledColor[0], this.styledColor[1], this.styledColor[2], 255,
        );
      } else if (material === Material.Wall) {
        const grain = hash(index) % 23 - 11;
        const seam = (hash(index + 73) & 31) === 0 ? -22 : 0;
        this.styledColor[0] = 105 + grain + seam;
        this.styledColor[1] = 98 + grain + seam;
        this.styledColor[2] = 88 + grain + seam;
        applyCanvasSolidBodyOptics(
          this.styledColor, surfaceLight, normalLight, solidRelief,
          denseSolidInterior, profile, optics,
        );
        compositePixel(
          target, pixel, this.styledColor[0], this.styledColor[1], this.styledColor[2], 255,
        );
      } else if (material === Material.Water) {
        const mask = materialNeighbourMask(this.rendered, width, height, x, y, material);
        const density = neighbourDensity(mask);
        const liquidVolumeInterior = isMaterialBulkInterior(
          this.rendered, width, height, x, y, material, mask,
        );
        const liquidFieldAlpha = fields.liquid.bytes[pixel + 3];
        const liquidBodySupport = canvasLiquidBodySupport(liquidFieldAlpha, density);
        const contour = contourLight(mask) * liquidContourScale;
        const depth = density / 8;
        const flow = velocities ? velocities[index * 2] * 0.18 : 0;
        const shimmer = Math.sin(visualTime * 0.002 + x * 0.065 + y * 0.02 + flow) * 4;
        const light = contour + shimmer;
        this.styledColor[0] = 53 - depth * 31 + light * 0.45;
        this.styledColor[1] = 169 - depth * 56 + light;
        this.styledColor[2] = 205 - depth * 40 + light;
        applyCanvasLiquidBodyOptics(
          this.styledColor, optics, liquidFieldAlpha, density,
          liquidFieldRelief, liquidSurfaceExposure, liquidBodySupport,
        );
        if (this.liquidFieldLightingEnabled && liquidSpeciesContact
          && !liquidForeignMatterContact && wall === 0) {
          applyCanvasLiquidInterfaceMeniscus(
            this.styledColor, optics, fields.liquid.bytes[pixel + 3], density, liquidSpeciesRelief,
          );
        }
        if (this.liquidVolumeChromaEnabled && liquidVolumeInterior && !liquidSpeciesContact) {
          const causticPhase = liquidBodySupport > 0 && wall === 0
            ? canvasLiquidCausticPhase(x, y, visualTime, material) : 0;
          const macroWave = liquidBodySupport > 0
            ? (wall === 0 ? canvasLiquidMacroWave(x, y, visualTime, material, causticPhase) : shimmer / 4)
            : 0;
          const macroCaustic = liquidBodySupport > 0 && wall === 0
            ? canvasLiquidCausticWave(x, y, visualTime, material, causticPhase) : 0;
          if (liquidBodySupport > 0 && wall === 0) {
            applyCanvasLiquidMacroSheen(
              this.styledColor, optics, liquidFieldAlpha, density, macroWave, liquidBodySupport,
            );
            applyCanvasLiquidMacroCaustic(
              this.styledColor, optics, liquidFieldAlpha, density, macroCaustic, liquidBodySupport,
            );
          }
          applyCanvasLiquidVolumeChroma(
            this.styledColor, optics, canvasLiquidVolumeChromaResponse(
              optics, liquidFieldAlpha, density,
              liquidFieldRelief, macroWave, liquidBodySupport,
            ),
            false,
          );
        }
        if ((this.liquidVolumeChromaEnabled || this.liquidOpticalDepthEnabled)
          && liquidVolumeInterior && !liquidSpeciesContact) {
          applyCanvasLiquidOpticalDepth(
            this.styledColor, optics,
            this.liquidOpticalDepthEnabled ? this.boundaryStability[index] : 0,
          );
        }
        compositePixel(
          target, pixel,
          this.styledColor[0], this.styledColor[1], this.styledColor[2], canvasLiquidAlpha(density),
        );
      } else if (material === Material.Smoke) {
        const mask = materialNeighbourMask(this.rendered, width, height, x, y, material);
        const density = neighbourDensity(mask);
        const contour = contourLight(mask);
        const speed = velocities ? Math.abs(velocities[index * 2 + 1]) : 0;
        const drift = velocities ? velocities[index * 2] * 0.025 : 0;
        const billow = Math.sin(visualTime * 0.0016 + x * 0.11 + y * 0.065 + drift) * 7;
        const volume = density * 5 + contour * 0.6 + billow;
        setPixel(
          smoke, pixel, 114 + volume, 118 + volume, 124 + volume,
          canvasGasSemanticAccentAlpha(gasAtmosphereAlpha, density, false)
            + Math.min(8, speed),
        );
      } else {
        const info = PROJECTED_RENDER_INFO[material];
        if (!info) continue;
        const red = info.color >>> 16;
        const green = (info.color >>> 8) & 0xFF;
        const blue = info.color & 0xFF;
        if (info.phase === RenderPhase.Gas) {
          const mask = materialNeighbourMask(this.rendered, width, height, x, y, material);
          const density = neighbourDensity(mask);
          const volume = contourLight(mask) * 0.5 + Math.sin(visualTime * 0.0014 + x * 0.08 + y * 0.05) * 5;
          shadeCanvasOpticalVolume(
            this.styledColor, red, green, blue, optics, 'gas', density, volume,
          );
          if (applicableTraits === 0 && !info.emissive) {
            setPixel(
              smoke, pixel,
              this.styledColor[0], this.styledColor[1], this.styledColor[2],
              canvasGasSemanticAccentAlpha(gasAtmosphereAlpha, density, false),
            );
          } else {
            if (applicableTraits !== 0) applyCanvasRenderTraits(
              this.styledColor, applicableTraits, phase, material, x, y, index, this.traitClock,
              this.roleMaterialStylingEnabled, this.energyIdentityStylingEnabled,
            );
            setPixel(
              smoke, pixel,
              this.styledColor[0], this.styledColor[1], this.styledColor[2],
              canvasGasSemanticAccentAlpha(gasAtmosphereAlpha, density, info.emissive),
            );
          }
        } else if (info.phase === RenderPhase.Liquid) {
          const mask = materialNeighbourMask(this.rendered, width, height, x, y, material);
          const density = neighbourDensity(mask);
          const liquidVolumeInterior = isMaterialBulkInterior(
            this.rendered, width, height, x, y, material, mask,
          );
          const liquidFieldAlpha = fields.liquid.bytes[pixel + 3];
          const liquidBodySupport = canvasLiquidBodySupport(liquidFieldAlpha, density);
          const contour = contourLight(mask) * liquidContourScale;
          const shimmer = Math.sin(visualTime * 0.0018 + x * 0.055 + y * 0.025) * 4 + contour;
          shadeCanvasOpticalVolume(
            this.styledColor, red, green, blue, optics, 'liquid', density, shimmer,
          );
          applyCanvasLiquidBodyOptics(
            this.styledColor, optics, liquidFieldAlpha, density,
            liquidFieldRelief, liquidSurfaceExposure, liquidBodySupport,
          );
          if (this.liquidFieldLightingEnabled && applicableTraits === 0
            && !info.emissive && liquidSpeciesContact && !liquidForeignMatterContact && wall === 0) {
            applyCanvasLiquidInterfaceMeniscus(
              this.styledColor, optics, fields.liquid.bytes[pixel + 3], density, liquidSpeciesRelief,
            );
          }
          if (this.liquidVolumeChromaEnabled && applicableTraits === 0
            && !info.emissive && liquidVolumeInterior && !liquidSpeciesContact) {
            const causticPhase = liquidBodySupport > 0 && wall === 0
              ? canvasLiquidCausticPhase(x, y, visualTime, material) : 0;
            const macroWave = liquidBodySupport > 0
              ? (wall === 0 ? canvasLiquidMacroWave(x, y, visualTime, material, causticPhase) : (shimmer - contour) / 4)
              : 0;
            const macroCaustic = liquidBodySupport > 0 && wall === 0
              ? canvasLiquidCausticWave(x, y, visualTime, material, causticPhase) : 0;
            if (liquidBodySupport > 0 && wall === 0) {
              applyCanvasLiquidMacroSheen(
                this.styledColor, optics, liquidFieldAlpha, density, macroWave, liquidBodySupport,
              );
              applyCanvasLiquidMacroCaustic(
                this.styledColor, optics, liquidFieldAlpha, density, macroCaustic, liquidBodySupport,
              );
            }
            applyCanvasLiquidVolumeChroma(
              this.styledColor, optics, canvasLiquidVolumeChromaResponse(
                optics, liquidFieldAlpha, density,
                liquidFieldRelief, macroWave, liquidBodySupport,
              ),
              false,
            );
          }
          if ((this.liquidVolumeChromaEnabled || this.liquidOpticalDepthEnabled)
            && applicableTraits === 0 && !info.emissive
            && liquidVolumeInterior && !liquidSpeciesContact) {
            applyCanvasLiquidOpticalDepth(
              this.styledColor, optics,
              this.liquidOpticalDepthEnabled ? this.boundaryStability[index] : 0,
            );
          }
          if (this.liquidIdentityStylingEnabled && wall === 0) applyCanvasLiquidIdentityStyle(
            this.styledColor, material, x, y, density,
            fields.liquid.bytes[pixel + 3], liquidFieldRelief,
            liquidSurfaceExposure, this.boundaryStability[index],
          );
          if (this.baseStateStylingEnabled && presentationState
            && material === Material.BASE && wall === 0) {
            applyCanvasBaseStateStyle(
              this.styledColor, material, presentationState[index], x, y,
            );
          }
          if (this.gelHydrationStylingEnabled && presentationState
            && material === Material.GEL && wall === 0) {
            applyCanvasGelHydrationStyle(
              this.styledColor, material, presentationState[index], x, y,
            );
          }
          if (this.deutStateStylingEnabled && presentationState
            && material === Material.DEUT && wall === 0) {
            applyCanvasDeutStateStyle(
              this.styledColor, material, presentationState[index], x, y,
            );
          }
          if (applicableTraits === 0 && !info.emissive) {
            compositePixel(
              target, pixel,
              this.styledColor[0], this.styledColor[1], this.styledColor[2], canvasLiquidAlpha(density),
            );
          } else {
            if (applicableTraits !== 0) applyCanvasRenderTraits(
              this.styledColor, applicableTraits, phase, material, x, y, index, this.traitClock,
              this.roleMaterialStylingEnabled, this.energyIdentityStylingEnabled,
            );
            compositePixel(
              target, pixel,
              this.styledColor[0], this.styledColor[1], this.styledColor[2], canvasLiquidAlpha(density),
            );
          }
        } else {
          shadeCanvasMaterial(
            this.styledColor, red, green, blue, profile,
            optics, material, x, y, index, visualTime,
          );
          if (this.sensorMaterialStylingEnabled) {
            applyCanvasSensorMorphology(this.styledColor, material, x, y);
          }
          if (this.unusualPowderStylingEnabled && phase === RenderPhase.Powder) {
            applyCanvasUnusualPowderStyle(
              this.styledColor, material, x, y, index,
              velocities?.[index * 2] ?? 0,
              velocities?.[index * 2 + 1] ?? 0,
            );
          }
          if (this.explosivePowderStylingEnabled && phase === RenderPhase.Powder
            && wall === 0 && applicableTraits === 0 && !info.emissive) {
            applyCanvasExplosivePowderStyle(this.styledColor, material, x, y);
          }
          if (this.unusualSolidStylingEnabled && phase === RenderPhase.Solid
            && !isCanvasNativeSpecialSolidMaterial(material)) {
            applyCanvasUnusualSolidMorphology(this.styledColor, material, x, y, index);
          }
          if (phase === RenderPhase.Powder) applyCanvasPowderBulkCellStyle(
            this.styledColor, powderCanonicalColor, this.boundaryStability[index],
            fields.powderSurface.bytes, pixel, powderBulkDepth, this.powderBodyDepthEnabled, optics,
            material, x, y, this.powderMesostrataStylingEnabled,
          );
          if (this.unusualPowderStylingEnabled && phase === RenderPhase.Powder
            && wall === 0 && applicableTraits === 0 && !info.emissive) {
            applyCanvasCrystallinePowderStyle(this.styledColor, material, x, y);
          }
          if (this.earthenPowderStylingEnabled && phase === RenderPhase.Powder
            && wall === 0 && applicableTraits === 0 && !info.emissive) {
            applyCanvasEarthenPowderStyle(this.styledColor, material, x, y);
          }
          if (denseSolidInterior && applicableTraits === 0 && !info.emissive) {
            const cohesion = canvasSolidInteriorCohesion(
              profile, optics, solidOpticalDepth, this.solidOpticalDepthEnabled,
            );
            this.styledColor[0] += (red - this.styledColor[0]) * cohesion;
            this.styledColor[1] += (green - this.styledColor[1]) * cohesion;
            this.styledColor[2] += (blue - this.styledColor[2]) * cohesion;
          }
          applyCanvasSolidBodyOptics(
            this.styledColor, surfaceLight, normalLight, solidRelief,
            denseSolidInterior, profile, optics, solidOpticalDepth, this.solidOpticalDepthEnabled,
          );
          // Common construction solids retain their shared curved body and
          // thickness optics, then receive a bounded exact-owner material
          // identity. This remains RGB-only and deliberately precedes traits,
          // thermal overlays, and state-specific graphics.
          if (this.structuralRigidStylingEnabled && phase === RenderPhase.Solid
            && wall === 0 && applicableTraits === 0 && !info.emissive) {
            applyCanvasStructuralRigidBulkOptics(
              this.styledColor, material, denseSolidInterior,
              solidOpticalDepth, solidRelief, this.solidOpticalDepthEnabled,
            );
            applyCanvasStructuralRigidStyle(this.styledColor, material, x, y);
          }
          // Coal and ROCK deliberately remain independent from construction
          // solids: their geological grammar begins only after the common
          // dense-body proof and never supplies a topology decision.
          if (this.geologicalSolidStylingEnabled && phase === RenderPhase.Solid
            && wall === 0 && applicableTraits === 0 && !info.emissive) {
            applyCanvasGeologicalSolidCoreOptics(
              this.styledColor, material, x, y, denseSolidInterior,
              solidOpticalDepth, solidRelief, this.solidOpticalDepthEnabled,
            );
          }
          // HEAC, PTNM, and RSSS retain their native surface identities above;
          // this exact-owner treatment begins only inside a proven solid core.
          if (this.thermalCatalyticRigidStylingEnabled && phase === RenderPhase.Solid
            && wall === 0 && applicableTraits === 0 && !info.emissive) {
            applyCanvasThermalCatalyticRigidCoreOptics(
              this.styledColor, material, x, y, denseSolidInterior,
              solidOpticalDepth, solidRelief, this.solidOpticalDepthEnabled,
            );
          }
          if (this.gooSolidStylingEnabled && phase === RenderPhase.Solid
            && wall === 0 && applicableTraits === 0 && !info.emissive) {
            applyCanvasGooSolidCoreOptics(
              this.styledColor, material, x, y, denseSolidInterior,
              solidOpticalDepth, solidRelief, this.solidOpticalDepthEnabled,
            );
          }
          if (this.unusualSolidStylingEnabled && phase === RenderPhase.Solid
            && isCanvasNativeSpecialSolidMaterial(material)) {
            applyCanvasUnusualSolidMorphology(this.styledColor, material, x, y, index);
          }
          // Cellular colonies are semantic discrete solids, but their
          // presentation motif belongs after generic body optics so dense LIFE
          // remains legible rather than being absorbed by the rigid core pass.
          // The helper is RGB-only and exact-owner guarded.
          if (this.cellularMaterialStylingEnabled && optics === RenderOptics.Cellular) {
            shadeCanvasCellularMaterial(this.styledColor, material, x, y);
          }
          if (this.unusualSolidStylingEnabled && phase === RenderPhase.Solid) {
            applyCanvasSpongeMorphology(this.styledColor, material, x, y);
          }
          if (this.spngStateStylingEnabled && presentationState) {
            applyCanvasSpongeHydrationStyle(
              this.styledColor, material, presentationState[index], x, y,
            );
          }
          if (this.quartzCrystalStateStylingEnabled && presentationState && wall === 0) {
            applyCanvasQuartzCrystalStateStyle(
              this.styledColor, material, presentationState[index],
            );
          }
          if (this.filtSpectrumStylingEnabled && presentationState && wall === 0) {
            applyCanvasFiltSpectrumStyle(
              this.styledColor, material, presentationState[index], temperatures?.[index],
            );
          }
          if (this.solidContactDepthEnabled && denseSolidInterior
            && applicableTraits === 0 && !info.emissive) {
            applyCanvasTranslucentCaustic(this.styledColor, solidRelief, material);
          }
          // The normal WebGL and direct 8x presenters both give exact native
          // transport/electronics bodies an owner-local surface grammar. Keep
          // Canvas recovery visually legible too, after common body work but
          // before role/state/thermal overlays. These helpers are RGB-only and
          // cannot modify semantic topology, alpha, walls, or simulation state.
          if (wall === 0 && !info.emissive) {
            if (this.mechanismBodyStylingEnabled) {
              applyCanvasMechanismBodyIdentityStyle(this.styledColor, material, x, y);
            }
            if (this.electronicIdentityStylingEnabled) {
              applyCanvasElectronicBodyIdentityStyle(this.styledColor, material, x, y);
            }
            // LCRY's native tmp2 is the final charged gray response. Layer it
            // after the ordinary electronics grammar without giving its shared
            // state word any authority over walls, alpha, or topology.
            if (this.lcryStateStylingEnabled && presentationState) {
              applyCanvasLcryStateStyle(this.styledColor, material, presentationState[index]);
            }
            if (this.pipePresentationStylingEnabled && presentationState) {
              applyCanvasPipePresentationStyle(this.styledColor, material, presentationState[index]);
            }
            if (this.storStateStylingEnabled && presentationState) {
              applyCanvasStorStateStyle(this.styledColor, material, presentationState[index]);
            }
            if (this.swchStateStylingEnabled && presentationState) {
              applyCanvasSwchStateStyle(this.styledColor, material, presentationState[index]);
            }
            if (this.dlayStateStylingEnabled) {
              applyCanvasDlayCountdownStyle(
                this.styledColor, material, presentationState?.[index] ?? 0, temperatures?.[index],
              );
            }
            if (this.wifiStateStylingEnabled) {
              applyCanvasWifiStateStyle(
                this.styledColor, material, presentationState?.[index] ?? 0,
              );
            }
            if (this.fieldProfileIdentityStylingEnabled && profile === RenderProfile.Field
              && optics === RenderOptics.Default) {
              applyCanvasFieldProfileIdentityStyle(this.styledColor, material, x, y);
            }
            if (this.frayForceStylingEnabled) {
              applyCanvasFrayForceStyle(this.styledColor, material, x, y);
            }
            if (this.gbmbForceStylingEnabled) {
              applyCanvasGbmbForceStyle(this.styledColor, material, x, y);
            }
          }
          if (applicableTraits !== 0) applyCanvasRenderTraits(
            this.styledColor, applicableTraits, phase, material, x, y, index, this.traitClock,
            this.roleMaterialStylingEnabled, this.energyIdentityStylingEnabled,
          );
          // LIGH and THDR are emissive native matter rather than Energy-phase
          // particles, so the common energy-core identity branch cannot name
          // them. Compose their exact discharge cue after the generic Carrier
          // accent; doing so keeps the warm/cool fork visible instead of losing
          // it to Canvas byte saturation. This is RGB-only and shares the
          // existing energy-identity audit toggle; emission support, powder
          // topology, native LIGH ctype, and physics remain untouched.
          if (this.energyIdentityStylingEnabled && wall === 0) {
            applyCanvasElectricDischargeStyle(this.styledColor, material, x, y);
          }
          if (this.vibrStateStylingEnabled && presentationState) {
            applyCanvasVibrStateStyle(
              this.styledColor, material, presentationState[index], x, y,
            );
          }
          if (this.forceActivityStylingEnabled && presentationState) {
            applyCanvasForceActivityStyle(
              this.styledColor, material, presentationState[index], x, y,
            );
          }
          if (this.poloStateStylingEnabled && presentationState) {
            applyCanvasPoloStateStyle(
              this.styledColor, material, presentationState[index], x, y,
            );
          }
          if (this.sourceTargetStylingEnabled && presentationState
            && isConfiguredSourceMaterial(material)) {
            applyCanvasSourceTargetStyle(
              this.styledColor, material, presentationState[index], x, y,
            );
          }
          if (this.translucentLensShellEnabled && applicableTraits === 0 && !info.emissive) {
            applyCanvasTranslucentLensShell(
              this.styledColor, solidRelief, normalLight, material, solidOpticalDepth,
            );
          }
          this.applyThermalMaterialStyle(
            phase, material, info.emissive, applicableTraits, temperatures?.[index], optics,
          );
          if (this.botanicalIdentityStylingEnabled
            && (material === Material.VINE || material === Material.SEED || material === Material.YEST)) {
            applyCanvasBotanicalMorphology(this.styledColor, material, x, y, index);
          }
          if (this.botanicalLifecycleStylingEnabled && presentationState) {
            applyCanvasBotanicalLifecycleStyle(
              this.styledColor, material, presentationState[index], x, y,
            );
          }
          if (this.sparkStateStylingEnabled && presentationState) {
            applyCanvasSparkStateStyle(
              this.styledColor, material, presentationState[index], x, y,
            );
          }
          if (photonState) applyCanvasPhotonSpectrumStyle(this.styledColor, photonState[index]);
          const alpha = material === Material.Glass ? 198
            : optics === RenderOptics.TranslucentRigid ? 218 : 255;
          if (wall && optics === RenderOptics.TranslucentRigid) {
            // Preserve the independent native-wall plane below translucent
            // matter, matching WebGL's source-over backdrop composition.
            compositePixel(
              target, pixel,
              this.styledColor[0], this.styledColor[1], this.styledColor[2], alpha,
            );
          } else {
            setPixel(
              target, pixel,
              this.styledColor[0], this.styledColor[1], this.styledColor[2], alpha,
            );
          }
        }
        if (info.emissive) {
          const light = info.phase === RenderPhase.Gas || info.phase === RenderPhase.Liquid
            ? 0 : surfaceLight;
          setPixel(
            fire, pixel,
            this.styledColor[0] + light, this.styledColor[1] + light,
            this.styledColor[2] + light, canvasLocalEmissionAlpha(info.phase),
          );
          hasLocalEmission = true;
        }
      }
      if (fields.emission.hasLight && liquidEmissionExposure > 0
        && phase === RenderPhase.Liquid && !PROJECTED_RENDER_INFO[material]?.emissive) {
        lightCanvasSurface(
          target, pixel, fields.emission.bytes, fields.emission.width, fields.emission.height,
          width, height, x, y, profile, liquidEmissionExposure, 4,
        );
      } else if (fields.emission.hasLight) {
        const translucentExposure = canvasTranslucentFieldExposure(
          optics, denseSolidInterior && applicableTraits === 0,
          PROJECTED_RENDER_INFO[material]?.emissive ?? false,
          this.translucentFieldTransmissionEnabled,
        );
        if (translucentExposure > 0 && fields.emission.mayLightWorldCell(x, y)) lightCanvasSurface(
          target, pixel, fields.emission.bytes, fields.emission.width, fields.emission.height,
          width, height, x, y, profile, translucentExposure, CANVAS_TRANSLUCENT_FIELD_GAIN,
        );
        if (solidBodyFieldExposure > 0) lightCanvasSurface(
          target, pixel, fields.emission.bytes, fields.emission.width, fields.emission.height,
          width, height, x, y, profile, solidBodyFieldExposure,
        );
        if (receivesSurfaceLight(phase)) {
          const exposure = cardinalExposure(this.rendered, width, height, x, y, material);
          lightCanvasSurface(
            target, pixel, fields.emission.bytes, fields.emission.width, fields.emission.height,
            width, height, x, y, profile, exposure, 1,
            solidFieldNormalX, solidFieldNormalY, solidFieldGain,
          );
        }
      }
      if (suspensionSemanticActive
        && phase === RenderPhase.Powder) {
        applyCanvasSemanticSuspensionStyle(
          target, pixel, material, x, y,
          fields.lookups.styleBytes, fields.lookups.paletteBytes,
          fields.suspension, fields.liquid.bytes,
        );
      }
    }

    if (hasSolidSurface) reconstructSolidSurface(
      base, this.rendered, fields.lookups.styleBytes, fields.lookups.paletteBytes, width, height,
    );
    if (hasLiquidSurface) {
      reconstructLiquidSurface(
        liquid, this.rendered, fields.liquid.bytes,
        fields.lookups.liquidByMaterial, fields.lookups.colorByMaterial, fields.lookups.styleBytes,
        liquidSurfaceScratch, width, height,
      );
      applyCanvasReconstructedSuspensionStyle(
        liquid, this.rendered, fields.lookups.styleBytes, fields.lookups.paletteBytes,
        fields.suspension, fields.liquid.bytes, this.powderRenderStyle,
      );
    }
    const materialMs = materialTimingStart === undefined
      ? undefined
      : performance.now() - materialTimingStart;
    const contourTimingStart = timingStart === undefined ? undefined : performance.now();
    if (this.outputScale >= CANVAS_CONTOUR_OUTPUT_SCALE) {
      if (hasLiquidSurface) for (let pixel = 0; pixel < base.length; pixel += 4) {
        if (liquid[pixel + 3] === 0) continue;
        compositePixel(
          base, pixel, liquid[pixel], liquid[pixel + 1], liquid[pixel + 2], liquid[pixel + 3],
        );
      }
      // Fully enclosed opaque solid chunks can be copied from this exact
      // semantic plane while the 2x contour cache is rebuilt. Upload before
      // contouring so that conservative interior chunks need not rerun the
      // per-subsample contour path, whose signed boundary response is an exact
      // no-op away from every material/wall/air interface.
      this.context.putImageData(basePixels, 0, 0);
      this.rasterizeCanvasMatterContours(base, fields.lookups.styleBytes, width, height);
    } else {
      this.context.putImageData(basePixels, 0, 0);
    }
    const contourMs = contourTimingStart === undefined
      ? undefined
      : performance.now() - contourTimingStart;
    const compositeTimingStart = timingStart === undefined ? undefined : performance.now();
    this.liquidContext.putImageData(liquidPixels, 0, 0);
    if (hasSemanticGas || this.smokeSurfaceActive) {
      this.smokeContext.putImageData(smokePixels, 0, 0);
      this.smokeSurfaceActive = hasSemanticGas;
      volumePlaneUploads++;
    }
    if (hasLocalEmission || this.fireSurfaceActive) {
      this.fireContext.putImageData(firePixels, 0, 0);
      this.fireSurfaceActive = hasLocalEmission;
      volumePlaneUploads++;
    }
    const output = backingSize(width, height, this.outputScale);
    const fallback = this.fallbackContext;
    fallback.clearRect(0, 0, output.width, output.height);
    fallback.save();
    fallback.imageSmoothingEnabled = true;
    fallback.imageSmoothingQuality = 'high';
    let volumePlaneComposites = 0;
    if (this.emissionSurfaceActive) {
      fallback.globalCompositeOperation = 'lighter';
      fallback.filter = `blur(${1.7 * this.outputScale}px)`;
      fallback.globalAlpha = 0.72;
      fallback.drawImage(
        this.emissionSurface, 0, 0, this.emissionSurface.width, this.emissionSurface.height,
        0, 0, output.width, output.height,
      );
      volumePlaneComposites++;
    }
    // The broad aura belongs behind matter. Opaque contours receive the same
    // field as restrained family-aware RGB lighting above, so their texture is
    // revealed instead of being washed by a screen-space glow.
    fallback.globalCompositeOperation = 'source-over';
    fallback.filter = 'none';
    fallback.globalAlpha = 1;
    fallback.imageSmoothingEnabled = false;
    if (this.outputScale >= CANVAS_CONTOUR_OUTPUT_SCALE) {
      fallback.drawImage(this.contourSurface, 0, 0);
    } else {
      fallback.drawImage(this.surface, 0, 0, width, height, 0, 0, output.width, output.height);
      fallback.imageSmoothingEnabled = true;
      fallback.drawImage(this.liquidSurface, 0, 0, width, height, 0, 0, output.width, output.height);
      fallback.imageSmoothingEnabled = false;
      fallback.globalAlpha = 0.18;
      fallback.drawImage(this.liquidSurface, 0, 0, width, height, 0, 0, output.width, output.height);
    }
    // Gas remains an independent particle/volume plane above native walls and
    // opaque matter. Only the broad light aura moved behind those surfaces.
    if (this.atmosphereSurfaceActive) {
      fallback.imageSmoothingEnabled = true;
      fallback.globalAlpha = 0.52;
      fallback.filter = 'none';
      fallback.drawImage(
        this.atmosphereSurface, 0, 0, this.atmosphereSurface.width, this.atmosphereSurface.height,
        0, 0, output.width, output.height,
      );
      volumePlaneComposites++;
    }
    if (this.smokeSurfaceActive) {
      fallback.imageSmoothingEnabled = true;
      fallback.filter = `blur(${0.2 * this.outputScale}px)`;
      fallback.globalAlpha = 0.24;
      fallback.drawImage(this.smokeSurface, 0, 0, width, height, 0, 0, output.width, output.height);
      volumePlaneComposites++;
    }
    if (this.fireSurfaceActive) {
      fallback.globalCompositeOperation = 'lighter';
      fallback.filter = `blur(${1.1 * this.outputScale}px)`;
      fallback.globalAlpha = 0.52;
      fallback.drawImage(this.fireSurface, 0, 0, width, height, 0, 0, output.width, output.height);
      fallback.filter = 'none';
      fallback.globalAlpha = 0.88;
      fallback.drawImage(this.fireSurface, 0, 0, width, height, 0, 0, output.width, output.height);
      volumePlaneComposites += 2;
    }
    fallback.restore();
    if (timingStart !== undefined) {
      this.canvasPresentationTiming = {
        sequence: (this.canvasPresentationTiming?.sequence ?? 0) + 1,
        durationMs: performance.now() - timingStart,
        fieldMs,
        materialMs,
        contourMs,
        compositeMs: compositeTimingStart === undefined
          ? undefined
          : performance.now() - compositeTimingStart,
        rebuiltField,
        volumePlaneUploads,
        volumePlaneComposites,
      };
    }
  }

  private initFallback(): void {
    const width = this.simulation.width;
    const height = this.simulation.height;
    this.fallbackFields = new RenderFieldSet(width, height, ALL_MATERIALS);
    this.canvasLiquidOpticalDepthHydrated = false;
    this.atmosphereSurfaceActive = false;
    this.emissionSurfaceActive = false;
    this.smokeSurfaceActive = false;
    this.fireSurfaceActive = false;
    for (const canvas of [this.surface, this.liquidSurface, this.smokeSurface, this.fireSurface]) {
      canvas.width = width;
      canvas.height = height;
    }
    this.atmosphereSurface.width = this.fallbackFields.atmosphere.width;
    this.atmosphereSurface.height = this.fallbackFields.atmosphere.height;
    this.emissionSurface.width = this.fallbackFields.emission.width;
    this.emissionSurface.height = this.fallbackFields.emission.height;
    const output = backingSize(width, height, this.outputScale);
    this.fallbackSurface.width = output.width;
    this.fallbackSurface.height = output.height;
    this.contourSurface.width = output.width;
    this.contourSurface.height = output.height;
    this.contourChunkSurface.width = CANVAS_CONTOUR_CHUNK_SIZE * this.contourScratch.outputScale;
    this.contourChunkSurface.height = CANVAS_CONTOUR_CHUNK_SIZE * this.contourScratch.outputScale;
    this.fallbackSurface.className = 'world-canvas fallback-field-canvas';
    this.fallbackSurface.style.width = `${width}px`;
    this.fallbackSurface.style.height = `${height}px`;
    this.fallbackSurface.style.transformOrigin = '0 0';
    this.fallbackSurface.dataset.renderer = 'semantic-field-canvas2d';
    this.fallbackSurface.dataset.worldSize = `${width}x${height}`;
    this.fallbackSurface.dataset.outputScale = String(this.outputScale);
    this.fallbackSurface.dataset.backingSize = `${output.width}x${output.height}`;
    this.fallbackSurface.dataset.volumeFields = 'shared';
    const context = this.surface.getContext('2d');
    const liquidContext = this.liquidSurface.getContext('2d');
    const smokeContext = this.smokeSurface.getContext('2d');
    const fireContext = this.fireSurface.getContext('2d');
    const atmosphereContext = this.atmosphereSurface.getContext('2d');
    const emissionContext = this.emissionSurface.getContext('2d');
    const fallbackContext = this.fallbackSurface.getContext('2d');
    const contourContext = this.contourSurface.getContext('2d');
    const contourChunkContext = this.contourChunkSurface.getContext('2d');
    if (!context || !liquidContext || !smokeContext || !fireContext || !atmosphereContext
      || !emissionContext || !fallbackContext || !contourContext || !contourChunkContext) {
      throw new Error('Canvas 2D unavailable');
    }
    this.context = context;
    this.liquidContext = liquidContext;
    this.smokeContext = smokeContext;
    this.fireContext = fireContext;
    this.atmosphereContext = atmosphereContext;
    this.emissionContext = emissionContext;
    this.fallbackContext = fallbackContext;
    this.contourContext = contourContext;
    this.contourChunkContext = contourChunkContext;
    this.contourChunkPixels = new ImageData(
      this.contourScratch.pixels,
      CANVAS_CONTOUR_CHUNK_SIZE * this.contourScratch.outputScale,
      CANVAS_CONTOUR_CHUNK_SIZE * this.contourScratch.outputScale,
    );
    this.basePixels = context.createImageData(width, height);
    this.liquidPixels = liquidContext.createImageData(width, height);
    this.smokePixels = smokeContext.createImageData(width, height);
    this.firePixels = fireContext.createImageData(width, height);
    this.atmospherePixels = atmosphereContext.createImageData(this.atmosphereSurface.width, this.atmosphereSurface.height);
    this.emissionPixels = emissionContext.createImageData(this.emissionSurface.width, this.emissionSurface.height);
    this.liquidSurfaceScratch = createLiquidSurfaceScratch(this.liquidPixels.data, width);
    this.host.append(this.fallbackSurface);
  }

  private rasterizeCanvasMatterContours(
    sourcePixels: Uint8ClampedArray,
    styleBytes: Uint8Array,
    width: number,
    height: number,
  ): void {
    const chunkPixels = this.contourChunkPixels;
    if (!chunkPixels) return;
    const dirtyRectangles = this.contourChunks.consume();
    for (const dirty of dirtyRectangles) {
      for (let chunkY = dirty.y; chunkY < dirty.y + dirty.height; chunkY += CANVAS_CONTOUR_CHUNK_SIZE) {
        const chunkHeight = Math.min(CANVAS_CONTOUR_CHUNK_SIZE, height - chunkY);
        for (let chunkX = dirty.x; chunkX < dirty.x + dirty.width; chunkX += CANVAS_CONTOUR_CHUNK_SIZE) {
        const chunkWidth = Math.min(CANVAS_CONTOUR_CHUNK_SIZE, width - chunkX);
        if (this.copyUniformSolidContourInterior(
          styleBytes, width, height, chunkX, chunkY, chunkWidth, chunkHeight,
        )) continue;
        this.contourScratch.rasterize({
          materials: this.rendered,
          sourcePixels,
          styleBytes,
          paletteBytes: this.fallbackFields?.lookups.paletteBytes,
          powderStability: this.boundaryStability,
          powderSurface: this.fallbackFields?.powderSurface.bytes,
          powderExteriorAir: this.fallbackFields?.powderSurface.exteriorAirBytes,
          liquidField: this.fallbackFields?.liquid.bytes,
          powderStyle: this.powderRenderStyle,
          walls: this.renderedWalls,
          solidContactDepth: this.solidContactDepthEnabled,
          solidCurvatureDepth: this.solidCurvatureDepthEnabled,
          surfaceContourLighting: this.surfaceContourLightingEnabled,
          phaseContactLighting: this.phaseContactLightingEnabled,
          liquidSilhouetteCohesion: this.liquidSilhouetteCohesionEnabled,
          worldWidth: width,
          worldHeight: height,
          chunkX,
          chunkY,
          chunkWidth,
          chunkHeight,
        });
        this.contourChunkContext.putImageData(chunkPixels, 0, 0);
        this.contourContext.clearRect(
          chunkX * this.contourScratch.outputScale,
          chunkY * this.contourScratch.outputScale,
          this.contourScratch.outputWidth,
          this.contourScratch.outputHeight,
        );
        this.contourContext.drawImage(
          this.contourChunkSurface,
          0, 0, this.contourScratch.outputWidth, this.contourScratch.outputHeight,
          chunkX * this.contourScratch.outputScale,
          chunkY * this.contourScratch.outputScale,
          this.contourScratch.outputWidth,
          this.contourScratch.outputHeight,
        );
        }
      }
    }
  }

  /**
   * Skips supersampled contour reconstruction only when this complete chunk
   * and its one-cell halo are one ordinary opaque rigid solid.  All possible
   * contour decisions (air, another material, a wall, a trait, emission, or a
   * world edge) therefore take the established raster path.  The base plane
   * already contains dense-body optics, so copying it exactly is equivalent in
   * this zero-boundary case and avoids expensive redundant subpixel work.
   */
  private copyUniformSolidContourInterior(
    styleBytes: Uint8Array,
    width: number,
    height: number,
    chunkX: number,
    chunkY: number,
    chunkWidth: number,
    chunkHeight: number,
  ): boolean {
    if (chunkX === 0 || chunkY === 0
      || chunkX + chunkWidth >= width || chunkY + chunkHeight >= height) return false;
    const material = this.rendered[chunkY * width + chunkX] as Material;
    const styleOffset = material * 4;
    if (material === Material.Empty || material === Material.Wall
      || styleBytes[styleOffset] !== RenderPhase.Solid
      || styleBytes[styleOffset + 1] !== RenderProfile.Rigid
      || styleBytes[styleOffset + 3] !== 0
      || PROJECTED_RENDER_INFO[material]?.emissive) return false;
    const walls = this.renderedWalls;
    for (let y = chunkY - 1; y <= chunkY + chunkHeight; y++) {
      let index = y * width + chunkX - 1;
      for (let x = chunkX - 1; x <= chunkX + chunkWidth; x++, index++) {
        if (this.rendered[index] !== material || (walls?.[index] ?? 0) !== 0) return false;
      }
    }
    const scale = this.contourScratch.outputScale;
    const destinationX = chunkX * scale;
    const destinationY = chunkY * scale;
    this.contourContext.clearRect(destinationX, destinationY, chunkWidth * scale, chunkHeight * scale);
    this.contourContext.imageSmoothingEnabled = false;
    this.contourContext.drawImage(
      this.surface,
      chunkX, chunkY, chunkWidth, chunkHeight,
      destinationX, destinationY, chunkWidth * scale, chunkHeight * scale,
    );
    return true;
  }


  private resize(): void {
    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
    this.viewportWidth = width;
    this.viewportHeight = height;
    const viewport = this.presenter?.resize(width, height) ?? { width, height };
    this.view.resize(viewport.width, viewport.height);
    this.syncTransform();
  }
  private syncTransform(): void {
    const position = this.view.position;
    if (this.presenter) this.presenter.setTransform(this.view.scale, position.x, position.y);
    else this.fallbackSurface.style.transform = `translate3d(${position.x}px, ${position.y}px, 0) scale(${this.view.scale})`;
  }
}

function applyCanvasPowderBulkCellStyle(
  color: Float32Array,
  canonicalColor: number,
  stability: number,
  powderSurface: Uint8Array,
  pixel: number,
  bulkDepth: number,
  bodyDepthEnabled: boolean,
  optics: RenderOptics,
  material: Material,
  x: number,
  y: number,
  mesostrataEnabled: boolean,
): void {
  applyCanvasPowderBulkStyle(
    color,
    canonicalColor >>> 16,
    (canonicalColor >>> 8) & 0xff,
    canonicalColor & 0xff,
    stability,
    powderSurface[pixel],
    powderSurface[pixel + 1],
    powderSurface[pixel + 2],
    powderSurface[pixel + 3],
    bulkDepth,
    bodyDepthEnabled,
    optics,
    material,
    x,
    y,
    mesostrataEnabled,
  );
}

function setPixel(target: Uint8ClampedArray, offset: number, red: number, green: number, blue: number, alpha: number): void {
  target[offset] = clamp(red, 0, 255);
  target[offset + 1] = clamp(green, 0, 255);
  target[offset + 2] = clamp(blue, 0, 255);
  target[offset + 3] = clamp(alpha, 0, 255);
}

function hash(value: number): number {
  value = Math.imul(value ^ 0x9e3779b9, 0x85ebca6b);
  value ^= value >>> 13;
  return (Math.imul(value, 0xc2b2ae35) ^ (value >>> 16)) >>> 0;
}

/** Matches the WebGL sparse-to-dense liquid opacity endpoints before the restrained nearest overlay. */
function canvasLiquidAlpha(neighbourCount: number): number {
  return 143 + neighbourCount * 8.25;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function cardinalExposure(
  values: Uint8Array | undefined,
  width: number,
  height: number,
  x: number,
  y: number,
  value: number,
): number {
  if (!values) return 1;
  let exposed = 0;
  if (x === 0 || values[y * width + x - 1] !== value) exposed++;
  if (x === width - 1 || values[y * width + x + 1] !== value) exposed++;
  if (y === 0 || values[(y - 1) * width + x] !== value) exposed++;
  if (y === height - 1 || values[(y + 1) * width + x] !== value) exposed++;
  return Math.min(1, exposed * 0.34);
}

function ordinarySolidNeighbour(styleBytes: Uint8Array, material: Material): boolean {
  return material !== Material.Empty && material !== Material.Wall
    && styleBytes[material * 4] === RenderPhase.Solid;
}

function powderAirBlocker(material: number, phase: RenderPhase): boolean {
  return material !== 0 && phase !== RenderPhase.Gas && phase !== RenderPhase.Energy;
}

function settleWithin<T>(promise: Promise<T>, milliseconds: number): Promise<T | undefined> {
  return new Promise<T | undefined>((resolve, reject) => {
    let finished = false;
    const timeout = window.setTimeout(() => {
      finished = true;
      resolve(undefined);
    }, milliseconds);
    promise.then((value) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeout);
      resolve(value);
    }, (error: unknown) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeout);
      reject(error);
    });
  });
}
