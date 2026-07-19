import { ALL_MATERIALS, Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';
import { clientToViewport, ViewTransform, type Point, type ViewState } from './view-transform';
import { contentBoxFromBounds } from './client-coordinate-map';
import type { PixiFieldPresenter, WebGLPresentationTiming } from './pixi-field-presenter';
import {
  backingSize, CANVAS_FALLBACK_DIMENSION_BUDGET, CANVAS_FALLBACK_PIXEL_BUDGET,
  resolveFieldOutputScale, safeWebGLOutputScale, type FieldOutputScale,
} from './render-resolution';
import { shadeCanvasAtmosphere } from './canvas-atmosphere-relief';
import { canvasLocalEmissionAlpha } from './canvas-emission-style';
import { shadeCanvasOpticalVolume } from './canvas-optics-style';
import {
  createLiquidSurfaceScratch, reconstructLiquidSurface, type LiquidSurfaceScratch,
} from './canvas-liquid-surface';
import {
  canvasLiquidContourScale, canvasLiquidEmissionExposure, canvasLiquidFieldRelief,
  canvasLiquidEmissionSurfaceExposure, canvasLiquidSpeciesRelief, canvasLiquidSurfaceExposure,
} from './canvas-liquid-light';
import { shadeCanvasEnergy } from './canvas-energy-style';
import { shadeCanvasMaterial } from './canvas-material-style';
import {
  applicableCanvasRenderTraits, applyCanvasRenderTraits, CANVAS_RENDER_TRAIT_CLOCK_SIZE,
  updateCanvasRenderTraitClock,
} from './canvas-render-traits';
import {
  CANVAS_TRANSLUCENT_FIELD_GAIN, canvasTranslucentFieldExposure, lightCanvasSurface,
} from './canvas-surface-light';
import { reconstructSolidSurface } from './canvas-solid-surface';
import { writeCanvasRefractedWallPixel, writeCanvasWallPixel } from './canvas-wall-style';
import {
  applyCanvasSolidLighting, canvasSolidInteriorCohesion, canvasSolidRelief,
} from './canvas-solid-relief';
import { RenderFieldSet } from './render-field-set';
import { RenderOptics } from './render-optics';
import { receivesSurfaceLight, renderPhase, RenderPhase, RenderProfile } from './render-profile';
import { semanticRenderHeat } from './semantic-field';
import { compositePixel } from './rgba-composite';
import { forceCanvas2D, supportsWebGL } from './webgl-support';
import { contourLight, materialNeighbourMask, neighbourDensity } from './volumetric-field';
import { updateBoundaryStabilityRect } from './boundary-stability-field';
import {
  CANVAS_CONTOUR_CHUNK_SIZE, CANVAS_CONTOUR_OUTPUT_SCALE, CanvasPhaseContourScratch,
} from './canvas-phase-contour';
import { DirtyChunkGrid } from './dirty-chunk-grid';
import { POWDER_SURFACE_REFRESH_INTERVAL } from './powder-surface-field';
import type { PowderRenderStyle } from './powder-render-style';

const FRAME_INTERVAL = 1000 / 30;
export const DYNAMIC_FIELD_REFRESH_INTERVAL = 1000 / 12;
const WEBGL_LATE_PROMOTION_MS = 10_000;

export interface RendererBackendInfo {
  readonly backend: 'webgl' | 'canvas2d';
  readonly label: 'WebGL' | 'Canvas 2D';
  readonly reason?: 'forced' | 'webgl-unavailable' | 'webgl-starting' | 'webgl-timeout' | 'webgl-error';
  readonly requestedOutputScale?: FieldOutputScale;
  readonly outputScale?: FieldOutputScale;
}

export interface CanvasPresentationTiming {
  readonly sequence: number;
  readonly durationMs: number;
  readonly rebuiltField?: 'atmosphere' | 'liquid' | 'emission';
}

export function dynamicFieldRefreshDue(time: number, lastRefresh: number, enabled: boolean): boolean {
  return enabled && time - lastRefresh >= DYNAMIC_FIELD_REFRESH_INTERVAL;
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
  private readonly energyGlowColor = new Float32Array(3);
  private readonly traitClock = new Int32Array(CANVAS_RENDER_TRAIT_CLOCK_SIZE);
  private readonly boundaryStability: Uint8Array;
  private readonly boundaryStabilityOwners: Uint8Array;
  private readonly requestedOutputScale: FieldOutputScale;
  private readonly outputScale: FieldOutputScale;
  private readonly webGLOutputScale: FieldOutputScale;
  private readonly contourScratch: CanvasPhaseContourScratch;
  private readonly contourChunks: DirtyChunkGrid;
  private readonly boundaryDirtyMarker = {
    markCell: (index: number): void => {
      this.contourChunks.markCell(index);
      this.powderSurfaceDirty = true;
    },
  };
  private presenter?: PixiFieldPresenter;
  private readonly view: ViewTransform;
  private basePixels?: ImageData;
  private liquidPixels?: ImageData;
  private smokePixels?: ImageData;
  private atmospherePixels?: ImageData;
  private emissionPixels?: ImageData;
  private liquidSurfaceScratch?: LiquidSurfaceScratch;
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
  private changed = true;
  private powderSurfaceDirty = true;
  private gasFieldLightingEnabled = true;
  private liquidFieldLightingEnabled = true;
  private translucentFieldTransmissionEnabled = true;
  private translucentBackdropRefractionEnabled = true;
  private powderRenderStyle: PowderRenderStyle = 'smooth';
  private gasFieldLightingDirty = false;
  private canvasPresentationTimingEnabled = false;
  private canvasPresentationTiming?: CanvasPresentationTiming;
  private webGLPresentationTimingEnabled = false;

  constructor(private readonly host: HTMLElement, private readonly simulation: SimulationBackend) {
    this.requestedOutputScale = resolveFieldOutputScale();
    this.webGLOutputScale = safeWebGLOutputScale(
      simulation.width, simulation.height, this.requestedOutputScale,
    );
    // Keep the compatibility canvas at a bounded 4x ceiling while an 8x WebGL
    // candidate initializes. This avoids duplicating 60 MiB surfaces at startup;
    // explicit forced-Canvas mode remains a true 8x diagnostic.
    this.outputScale = forceCanvas2D() ? this.requestedOutputScale : safeWebGLOutputScale(
      simulation.width, simulation.height, this.requestedOutputScale,
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
    const webglAvailable = !forcedCanvas && supportsWebGL();
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
    new ResizeObserver(() => this.resize()).observe(this.host);
    if (webglAvailable) {
      // Let the compatibility canvas and controls paint before Pixi performs any
      // potentially blocking GPU initialization on a cold browser/driver.
      requestAnimationFrame(() => window.setTimeout(() => {
        void this.promoteLatePresenter(this.createWebGLPresenter());
      }, 0));
    }
  }

  render(time: number, visualTime = time): void {
    if (time - this.lastDraw < FRAME_INTERVAL) return;
    for (const cell of this.simulation.consumeDirtyCells()) {
      const previous = this.rendered[cell.index];
      this.rendered[cell.index] = cell.material;
      const fallbackFields = this.fallbackFields;
      fallbackFields?.markDirty(previous, cell.material);
      this.contourChunks.markCell(cell.index);
      if (fallbackFields) {
        const previousPhase = fallbackFields.lookups.styleBytes[previous * 4];
        const nextPhase = fallbackFields.lookups.styleBytes[cell.material * 4];
        if (previousPhase === RenderPhase.Solid || previousPhase === RenderPhase.Powder
          || nextPhase === RenderPhase.Solid || nextPhase === RenderPhase.Powder) {
          this.powderSurfaceDirty = true;
        }
      }
      this.presenter?.markDirty(cell.index, cell.material);
      this.changed = true;
    }
    for (const cell of this.simulation.consumeDirtyWalls?.() ?? []) {
      if (!this.renderedWalls) break;
      this.renderedWalls[cell.index] = cell.wall;
      this.presenter?.markWallDirty(cell.index);
      this.contourChunks.markCell(cell.index);
      this.powderSurfaceDirty = true;
      this.changed = true;
    }
    const hasDynamicFields = Boolean(this.simulation.temperature || this.simulation.velocity);
    const refreshDynamicFields = dynamicFieldRefreshDue(time, this.lastDynamicFieldRefresh, hasDynamicFields);
    const powderRefreshDue = this.powderSurfaceDirty
      && time - this.lastPowderSurfaceRefresh >= POWDER_SURFACE_REFRESH_INTERVAL;
    const visualRefreshDue = this.presenter?.visualRefreshDue(time)
      ?? ((this.fallbackFields?.due(time) ?? false) || powderRefreshDue);
    if (!this.changed && !refreshDynamicFields && !visualRefreshDue) return;
    if (refreshDynamicFields) this.lastDynamicFieldRefresh = time;
    this.changed = false;
    this.lastDraw = time;
    this.drawField(time, visualTime, refreshDynamicFields);
  }

  getViewState(): ViewState { return this.view.snapshot(); }

  getBackendInfo(): RendererBackendInfo {
    return {
      ...this.backend,
      requestedOutputScale: this.requestedOutputScale,
      outputScale: this.backend.backend === 'webgl' ? this.webGLOutputScale : this.outputScale,
    };
  }

  enableCanvasPresentationTiming(): void { this.canvasPresentationTimingEnabled = true; }

  enableWebGLPresentationTiming(): void {
    this.webGLPresentationTimingEnabled = true;
    this.presenter?.enableWebGLPresentationTiming();
  }

  requestWebGLPresentationTimingSample(): boolean {
    const requested = this.presenter?.requestWebGLPresentationTimingSample() ?? false;
    if (requested) this.changed = true;
    return requested;
  }

  getWebGLPresentationTiming(): WebGLPresentationTiming | undefined {
    return this.presenter?.getWebGLPresentationTiming();
  }

  setGasFieldLightingEnabled(enabled: boolean): void {
    if (enabled === this.gasFieldLightingEnabled) return;
    this.gasFieldLightingEnabled = enabled;
    this.presenter?.setGasFieldLightingEnabled(enabled);
    if (this.fallbackFields) this.gasFieldLightingDirty = true;
    this.changed = true;
  }

  setLiquidFieldLightingEnabled(enabled: boolean): void {
    if (enabled === this.liquidFieldLightingEnabled) return;
    this.liquidFieldLightingEnabled = enabled;
    this.presenter?.setLiquidFieldLightingEnabled(enabled);
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

  setPowderRenderStyle(style: PowderRenderStyle): void {
    if (style === this.powderRenderStyle) return;
    this.powderRenderStyle = style;
    this.presenter?.setPowderRenderStyle(style);
    this.contourChunks.markAll();
    this.changed = true;
  }

  getCanvasPresentationTiming(): CanvasPresentationTiming | undefined {
    return this.canvasPresentationTiming;
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

  screenToWorld(clientX: number, clientY: number): Point {
    return this.presenter
      ? this.presenter.clientWorldPoint(clientX, clientY)
      : this.view.viewportToWorld(this.viewportPoint(clientX, clientY));
  }

  screenToCell(clientX: number, clientY: number): { x: number; y: number } {
    const point = this.screenToWorld(clientX, clientY);
    return { x: Math.floor(point.x), y: Math.floor(point.y) };
  }

  private viewportPoint(clientX: number, clientY: number): Point {
    const bounds = this.host.getBoundingClientRect();
    const content = contentBoxFromBounds(bounds, this.host);
    return clientToViewport({ x: clientX, y: clientY }, content, this.host.clientWidth, this.host.clientHeight);
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
    try {
      presenter = await settleWithin(pending, WEBGL_LATE_PROMOTION_MS);
      if (!presenter) {
        this.setBackend({ backend: 'canvas2d', label: 'Canvas 2D', reason: 'webgl-timeout' });
        void pending.then((latePresenter) => latePresenter.destroy()).catch(() => undefined);
        return;
      }
      this.commitPresenter(presenter);
    } catch (error) {
      try { presenter?.destroy(); } catch { /* failed presenter is already unusable */ }
      this.presenter = undefined;
      // The candidate and Canvas intentionally share these fields. If the
      // candidate rebuilt one before its first render failed, mirror those
      // bytes back into the still-mounted Canvas surfaces before resuming it.
      this.syncFallbackVolumeSurfaces();
      this.contourChunks.markAll();
      this.changed = true;
      this.setBackend({ backend: 'canvas2d', label: 'Canvas 2D', reason: 'webgl-error' });
      console.warn('Semantic WebGL renderer unavailable; keeping Canvas fallback.', error);
    }
  }

  private commitPresenter(presenter: PixiFieldPresenter): void {
    // Compile the shader and seed every semantic field while the known-good
    // Canvas remains visible. Any failure leaves the fallback fully intact.
    const now = performance.now();
    if (this.webGLPresentationTimingEnabled) presenter.enableWebGLPresentationTiming();
    presenter.setGasFieldLightingEnabled(this.gasFieldLightingEnabled);
    presenter.setLiquidFieldLightingEnabled(this.liquidFieldLightingEnabled);
    presenter.setTranslucentFieldTransmissionEnabled(this.translucentFieldTransmissionEnabled);
    presenter.setTranslucentBackdropRefractionEnabled(this.translucentBackdropRefractionEnabled);
    presenter.setPowderRenderStyle(this.powderRenderStyle);
    presenter.update(
      this.rendered, this.renderedWalls, this.simulation.temperature?.(), this.simulation.velocity?.(),
      now, now, true,
    );
    presenter.resize(this.host.clientWidth, this.host.clientHeight);
    const position = this.view.position;
    presenter.setTransform(this.view.scale, position.x, position.y);
    presenter.mount();
    this.presenter = presenter;
    this.releaseFallbackStorage();
    this.setBackend({ backend: 'webgl', label: 'WebGL' });
    this.changed = true;
  }

  private releaseFallbackStorage(): void {
    this.fallbackSurface.remove();
    this.fallbackSurface.width = 0;
    this.fallbackSurface.height = 0;
    for (const canvas of [
      this.surface, this.liquidSurface, this.smokeSurface, this.fireSurface,
      this.atmosphereSurface, this.emissionSurface,
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
  }

  private syncFallbackVolumeSurfaces(): void {
    const fields = this.fallbackFields;
    if (!fields) return;
    if (this.atmospherePixels) {
      shadeCanvasAtmosphere(
        this.atmospherePixels.data, fields.atmosphere.bytes,
        fields.atmosphere.width, fields.atmosphere.height,
        this.gasFieldLightingEnabled ? fields.emission : undefined,
      );
      this.atmosphereContext.putImageData(this.atmospherePixels, 0, 0);
    }
    if (this.emissionPixels) {
      this.emissionPixels.data.set(fields.emission.bytes);
      this.emissionContext.putImageData(this.emissionPixels, 0, 0);
    }
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
    if (this.presenter) {
      this.presenter.update(
        this.rendered, this.renderedWalls, temperatures, velocities,
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
    updateBoundaryStabilityRect(
      this.boundaryStability, this.boundaryStabilityOwners, this.rendered, velocities,
      fields.lookups.styleBytes, width, { x: 0, y: 0, width, height }, this.boundaryDirtyMarker,
    );
    if (this.powderSurfaceDirty
      && scheduleTime - this.lastPowderSurfaceRefresh >= POWDER_SURFACE_REFRESH_INTERVAL) {
      const powderSurfaceChanged = fields.powderSurface.update(
        this.rendered, this.boundaryStability, this.renderedWalls,
      );
      this.powderSurfaceDirty = false;
      this.lastPowderSurfaceRefresh = scheduleTime;
      if (powderSurfaceChanged) this.contourChunks.markAll();
    }
    const timingStart = this.canvasPresentationTimingEnabled ? performance.now() : undefined;
    const rebuiltField = fields.updateNext(this.rendered, scheduleTime);
    if (rebuiltField === 'emission') {
      this.contourChunks.markAll();
      emissionPixels.data.set(fields.emission.bytes);
      this.emissionContext.putImageData(emissionPixels, 0, 0);
    }
    if (rebuiltField === 'atmosphere' || rebuiltField === 'emission' || this.gasFieldLightingDirty) {
      shadeCanvasAtmosphere(
        atmospherePixels.data, fields.atmosphere.bytes,
        fields.atmosphere.width, fields.atmosphere.height,
        this.gasFieldLightingEnabled ? fields.emission : undefined,
      );
      this.atmosphereContext.putImageData(atmospherePixels, 0, 0);
      this.gasFieldLightingDirty = false;
    }
    const base = basePixels.data;
    const liquid = liquidPixels.data;
    const smoke = smokePixels.data;
    const fire = firePixels.data;
    updateCanvasRenderTraitClock(this.traitClock, visualTime);
    base.fill(0); liquid.fill(0); smoke.fill(0); fire.fill(0);

    let index = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++, index++) {
      const material = this.rendered[index] as Material;
      const pixel = index * 4;
      const wall = this.renderedWalls?.[index] ?? 0;
      if (wall) {
        writeCanvasWallPixel(base, pixel, wall, x, y);
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
      const applicableTraits = applicableCanvasRenderTraits(traits, phase);
      if (phase === RenderPhase.Liquid || phase === RenderPhase.Energy
        || applicableTraits !== 0 || material === Material.Dust) {
        this.contourChunks.markCell(index);
      }
      const target = fields.lookups.liquidByMaterial[material] ? liquid : base;
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
      const liquidFieldRelief = phase === RenderPhase.Liquid
        ? canvasLiquidFieldRelief(fields.liquid.bytes, width, height, x, y)
          + (liquidSpeciesContact
            ? canvasLiquidSpeciesRelief(fields.liquid.bytes, width, height, x, y)
            : 0)
        : 0;
      const liquidReliefScale = phase === RenderPhase.Liquid
        ? 1 + liquidFieldRelief
          * (this.outputScale >= CANVAS_CONTOUR_OUTPUT_SCALE
            ? (optics === RenderOptics.Aqueous ? 1.35 : 1.18)
            : 1)
          * (optics === RenderOptics.Aqueous ? 1.08
            : optics === RenderOptics.Oily ? 0.84
              : optics === RenderOptics.Corrosive ? 1.0
                : optics === RenderOptics.Molten ? 0.76 : 0.92)
        : 1;
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
      const surfaceLight = normalLight + (denseSolidInterior
        ? canvasSolidRelief(x, y, material, profile, optics)
        : 0);
      if (this.translucentBackdropRefractionEnabled && wall && denseSolidInterior
        && applicableTraits === 0 && !PROJECTED_RENDER_INFO[material]?.emissive) {
        writeCanvasRefractedWallPixel(base, pixel, wall, x, y, material);
      }

      if (phase === RenderPhase.Energy) {
        const info = PROJECTED_RENDER_INFO[material];
        if (!info) continue;
        const red = info.color >>> 16;
        const green = (info.color >>> 8) & 0xFF;
        const blue = info.color & 0xFF;
        const heat = semanticRenderHeat(temperatures?.[index]);
        const glowAlpha = shadeCanvasEnergy(
          this.styledColor, this.energyGlowColor, red, green, blue, profile, traits,
          material, x, y, visualTime, heat,
          velocities?.[index * 2] ?? 0, velocities?.[index * 2 + 1] ?? 0,
        );
        if (applicableTraits !== 0) applyCanvasRenderTraits(
          this.styledColor, applicableTraits, phase, material, x, y, index, this.traitClock,
        );
        compositePixel(target, pixel, this.styledColor[0], this.styledColor[1], this.styledColor[2], 245);
        setPixel(
          fire, pixel,
          this.energyGlowColor[0], this.energyGlowColor[1], this.energyGlowColor[2], glowAlpha,
        );
      } else if (material === Material.Sand) {
        const grain = hash(index) % 23 - 11;
        compositePixel(target, pixel, 194 + grain + surfaceLight, 145 + grain * 0.65 + surfaceLight, 76 + grain * 0.35 + surfaceLight, 255);
      } else if (material === Material.Dust) {
        const grain = hash(index) % 23 - 11;
        const softness = Math.sin(visualTime * 0.0018 + x * 0.17 + y * 0.09) * 4;
        compositePixel(target, pixel, 188 + grain + surfaceLight + softness, 166 + grain + surfaceLight + softness, 124 + grain * 0.6 + surfaceLight, 238);
      } else if (material === Material.Salt) {
        const grain = hash(index) % 23 - 11;
        const crystal = (hash(index + 211) & 7) === 0 ? 28 : 0;
        compositePixel(target, pixel, 220 + grain + crystal + surfaceLight, 216 + grain + crystal + surfaceLight, 202 + grain + crystal + surfaceLight, 255);
      } else if (material === Material.Oil) {
        const mask = materialNeighbourMask(this.rendered, width, height, x, y, material);
        const density = neighbourDensity(mask);
        const contour = contourLight(mask) * liquidContourScale;
        const flow = velocities ? velocities[index * 2] * 0.12 : 0;
        const sheen = Math.sin(visualTime * 0.0017 + x * 0.055 + y * 0.025 + flow) * 5 + contour;
        const depth = density / 8;
        compositePixel(
          target, pixel, (91 - depth * 28 + sheen) * liquidReliefScale,
          (67 - depth * 24 + sheen * 0.65) * liquidReliefScale,
          (35 - depth * 14 + sheen * 0.3) * liquidReliefScale, canvasLiquidAlpha(density),
        );
        if (liquidSurfaceExposure > 0) setPixel(
          fire, pixel, 172 + sheen, 128 + sheen, 66,
          (34 + Math.max(0, contour)) * liquidSurfaceExposure,
        );
      } else if (material === Material.Wood) {
        const grain = hash(index) % 23 - 11;
        const ring = ((x + Math.floor(y / 3)) % 9) < 2 ? -20 : 4;
        this.styledColor[0] = 132 + grain + ring + surfaceLight;
        this.styledColor[1] = 76 + grain * 0.45 + ring * 0.5 + surfaceLight;
        this.styledColor[2] = 40 + ring * 0.25 + surfaceLight;
        applyCanvasRenderTraits(
          this.styledColor, applicableTraits, phase, material, x, y, index, this.traitClock,
        );
        compositePixel(
          target, pixel, this.styledColor[0], this.styledColor[1], this.styledColor[2], 255,
        );
      } else if (material === Material.Plant) {
        const grain = hash(index) % 23 - 11;
        const leaf = (hash(index + 401) & 3) * 7;
        this.styledColor[0] = 62 + leaf + surfaceLight;
        this.styledColor[1] = 132 + leaf + surfaceLight;
        this.styledColor[2] = 58 + grain * 0.35 + surfaceLight;
        applyCanvasRenderTraits(
          this.styledColor, applicableTraits, phase, material, x, y, index, this.traitClock,
        );
        compositePixel(
          target, pixel, this.styledColor[0], this.styledColor[1], this.styledColor[2], 255,
        );
      } else if (material === Material.Lava) {
        const mask = materialNeighbourMask(this.rendered, width, height, x, y, material);
        const density = neighbourDensity(mask);
        const contour = contourLight(mask) * liquidContourScale;
        const kelvin = temperatures ? temperatures[index] / 10 : 1450;
        const heat = clamp((kelvin - 700) / 1100, 0, 1);
        const crust = density > 6 ? -52 : 0;
        const pulse = Math.sin(visualTime * 0.003 + x * 0.1 + y * 0.07) * 8;
        compositePixel(
          target, pixel, (216 + crust + heat * 26 + contour * 0.35) * liquidReliefScale,
          (48 + pulse + heat * 110 + contour * 0.5) * liquidReliefScale,
          (8 + heat * 48) * liquidReliefScale, canvasLiquidAlpha(density),
        );
        if (liquidSurfaceExposure > 0) setPixel(
          fire, pixel, 255, 72 + heat * 112 + pulse, 12,
          (48 + heat * 34 + Math.max(0, contour)) * liquidSurfaceExposure,
        );
      } else if (material === Material.Ice) {
        const facet = (hash(index + 617) & 15) < 3 ? 24 : 0;
        compositePixel(target, pixel, 116 + facet + surfaceLight, 193 + facet + surfaceLight, 211 + facet + surfaceLight, 220);
      } else if (material === Material.Acid) {
        const mask = materialNeighbourMask(this.rendered, width, height, x, y, material);
        const density = neighbourDensity(mask);
        const contour = contourLight(mask) * liquidContourScale;
        const depth = density / 8;
        const shimmer = Math.sin(visualTime * 0.0024 + x * 0.075 + y * 0.035) * 6 + contour;
        compositePixel(
          target, pixel, (211 - depth * 30 + shimmer) * liquidReliefScale,
          (94 - depth * 22 + shimmer * 0.7) * liquidReliefScale,
          (232 - depth * 24 + shimmer) * liquidReliefScale, canvasLiquidAlpha(density),
        );
        if (liquidSurfaceExposure > 0) setPixel(
          fire, pixel, 238 + shimmer, 148 + shimmer, 255,
          (38 + Math.max(0, contour)) * liquidSurfaceExposure,
        );
      } else if (material === Material.Gunpowder) {
        const grain = hash(index) % 23 - 11;
        const spark = (hash(index + 911) & 31) === 0 ? 34 : 0;
        compositePixel(target, pixel, 70 + grain + spark + surfaceLight, 64 + grain + spark * 0.7 + surfaceLight, 58 + grain + spark * 0.35 + surfaceLight, 255);
      } else if (material === Material.Wall) {
        const grain = hash(index) % 23 - 11;
        const seam = (hash(index + 73) & 31) === 0 ? -22 : 0;
        compositePixel(target, pixel, 105 + grain + seam + surfaceLight, 98 + grain + seam + surfaceLight, 88 + grain + seam + surfaceLight, 255);
      } else if (material === Material.Water) {
        const mask = materialNeighbourMask(this.rendered, width, height, x, y, material);
        const density = neighbourDensity(mask);
        const contour = contourLight(mask) * liquidContourScale;
        const depth = density / 8;
        const flow = velocities ? velocities[index * 2] * 0.18 : 0;
        const shimmer = Math.sin(visualTime * 0.002 + x * 0.065 + y * 0.02 + flow) * 4;
        const light = contour + shimmer;
        compositePixel(
          target, pixel, (53 - depth * 31 + light * 0.45) * liquidReliefScale,
          (169 - depth * 56 + light) * liquidReliefScale,
          (205 - depth * 40 + light) * liquidReliefScale, canvasLiquidAlpha(density),
        );
        if (liquidSurfaceExposure > 0) setPixel(
          fire, pixel, 129 + light, 232 + light, 245,
          (44 + Math.max(0, contour)) * liquidSurfaceExposure,
        );
      } else if (material === Material.Smoke) {
        const mask = materialNeighbourMask(this.rendered, width, height, x, y, material);
        const density = neighbourDensity(mask);
        const contour = contourLight(mask);
        const speed = velocities ? Math.abs(velocities[index * 2 + 1]) : 0;
        const drift = velocities ? velocities[index * 2] * 0.025 : 0;
        const billow = Math.sin(visualTime * 0.0016 + x * 0.11 + y * 0.065 + drift) * 7;
        const volume = density * 5 + contour * 0.6 + billow;
        setPixel(smoke, pixel, 114 + volume, 118 + volume, 124 + volume, 45 + density * 13 + Math.min(38, speed));
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
              this.styledColor[0], this.styledColor[1], this.styledColor[2], 42 + density * 12,
            );
          } else {
            if (applicableTraits !== 0) applyCanvasRenderTraits(
              this.styledColor, applicableTraits, phase, material, x, y, index, this.traitClock,
            );
            setPixel(
              smoke, pixel,
              this.styledColor[0], this.styledColor[1], this.styledColor[2], 42 + density * 12,
            );
          }
        } else if (info.phase === RenderPhase.Liquid) {
          const mask = materialNeighbourMask(this.rendered, width, height, x, y, material);
          const density = neighbourDensity(mask);
          const contour = contourLight(mask) * liquidContourScale;
          const shimmer = Math.sin(visualTime * 0.0018 + x * 0.055 + y * 0.025) * 4 + contour;
          shadeCanvasOpticalVolume(
            this.styledColor, red, green, blue, optics, 'liquid', density, shimmer,
          );
          this.styledColor[0] *= liquidReliefScale;
          this.styledColor[1] *= liquidReliefScale;
          this.styledColor[2] *= liquidReliefScale;
          if (applicableTraits === 0 && !info.emissive) {
            compositePixel(
              target, pixel,
              this.styledColor[0], this.styledColor[1], this.styledColor[2], canvasLiquidAlpha(density),
            );
          } else {
            if (applicableTraits !== 0) applyCanvasRenderTraits(
              this.styledColor, applicableTraits, phase, material, x, y, index, this.traitClock,
            );
            compositePixel(
              target, pixel,
              this.styledColor[0], this.styledColor[1], this.styledColor[2], canvasLiquidAlpha(density),
            );
          }
          if (liquidSurfaceExposure > 0) setPixel(
            fire, pixel, red + 35, green + 35, blue + 35,
            (30 + Math.max(0, contour)) * liquidSurfaceExposure,
          );
        } else {
          shadeCanvasMaterial(
            this.styledColor, red, green, blue, profile,
            optics, material, x, y, index, visualTime,
          );
          if (denseSolidInterior && applicableTraits === 0 && !info.emissive) {
            const cohesion = canvasSolidInteriorCohesion(profile, optics);
            this.styledColor[0] += (red - this.styledColor[0]) * cohesion;
            this.styledColor[1] += (green - this.styledColor[1]) * cohesion;
            this.styledColor[2] += (blue - this.styledColor[2]) * cohesion;
          }
          if (applicableTraits !== 0) applyCanvasRenderTraits(
            this.styledColor, applicableTraits, phase, material, x, y, index, this.traitClock,
          );
          if (red > 200 || green > 200 || blue > 200) {
            applyCanvasSolidLighting(this.styledColor, surfaceLight);
          } else {
            this.styledColor[0] += surfaceLight;
            this.styledColor[1] += surfaceLight;
            this.styledColor[2] += surfaceLight;
          }
          const alpha = optics === RenderOptics.TranslucentRigid ? 218 : 255;
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
        if (receivesSurfaceLight(phase)) {
          const exposure = cardinalExposure(this.rendered, width, height, x, y, material);
          lightCanvasSurface(
            target, pixel, fields.emission.bytes, fields.emission.width, fields.emission.height,
            width, height, x, y, profile, exposure,
          );
        }
      }
    }

    reconstructSolidSurface(
      base, this.rendered, fields.lookups.styleBytes, fields.lookups.paletteBytes, width, height,
    );
    reconstructLiquidSurface(
      liquid, this.rendered, fields.liquid.bytes,
      fields.lookups.liquidByMaterial, fields.lookups.colorByMaterial, fields.lookups.styleBytes,
      liquidSurfaceScratch, width, height,
    );
    if (this.outputScale >= CANVAS_CONTOUR_OUTPUT_SCALE) {
      for (let pixel = 0; pixel < base.length; pixel += 4) {
        if (liquid[pixel + 3] === 0) continue;
        compositePixel(
          base, pixel, liquid[pixel], liquid[pixel + 1], liquid[pixel + 2], liquid[pixel + 3],
        );
      }
      this.rasterizeCanvasMatterContours(base, fields.lookups.styleBytes, width, height);
    }
    this.liquidContext.putImageData(liquidPixels, 0, 0);
    this.smokeContext.putImageData(smokePixels, 0, 0);
    this.fireContext.putImageData(firePixels, 0, 0);
    this.context.putImageData(basePixels, 0, 0);
    const output = backingSize(width, height, this.outputScale);
    const fallback = this.fallbackContext;
    fallback.clearRect(0, 0, output.width, output.height);
    fallback.save();
    fallback.imageSmoothingEnabled = true;
    fallback.imageSmoothingQuality = 'high';
    fallback.globalCompositeOperation = 'lighter';
    fallback.filter = `blur(${1.7 * this.outputScale}px)`;
    fallback.globalAlpha = 0.72;
    fallback.drawImage(
      this.emissionSurface, 0, 0, this.emissionSurface.width, this.emissionSurface.height,
      0, 0, output.width, output.height,
    );
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
    fallback.imageSmoothingEnabled = true;
    fallback.globalAlpha = 0.52;
    fallback.filter = 'none';
    fallback.drawImage(
      this.atmosphereSurface, 0, 0, this.atmosphereSurface.width, this.atmosphereSurface.height,
      0, 0, output.width, output.height,
    );
    fallback.filter = `blur(${0.2 * this.outputScale}px)`;
    fallback.globalAlpha = 0.24;
    fallback.drawImage(this.smokeSurface, 0, 0, width, height, 0, 0, output.width, output.height);
    fallback.globalCompositeOperation = 'lighter';
    fallback.filter = `blur(${1.1 * this.outputScale}px)`;
    fallback.globalAlpha = 0.52;
    fallback.drawImage(this.fireSurface, 0, 0, width, height, 0, 0, output.width, output.height);
    fallback.filter = 'none';
    fallback.globalAlpha = 0.88;
    fallback.drawImage(this.fireSurface, 0, 0, width, height, 0, 0, output.width, output.height);
    fallback.restore();
    if (timingStart !== undefined) {
      this.canvasPresentationTiming = {
        sequence: (this.canvasPresentationTiming?.sequence ?? 0) + 1,
        durationMs: performance.now() - timingStart,
        rebuiltField,
      };
    }
  }

  private initFallback(): void {
    const width = this.simulation.width;
    const height = this.simulation.height;
    this.fallbackFields = new RenderFieldSet(width, height, ALL_MATERIALS);
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
        this.contourScratch.rasterize({
          materials: this.rendered,
          sourcePixels,
          styleBytes,
          powderStability: this.boundaryStability,
          powderSurface: this.fallbackFields?.powderSurface.bytes,
          powderStyle: this.powderRenderStyle,
          walls: this.renderedWalls,
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


  private resize(): void {
    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
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
