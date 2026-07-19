import { ALL_MATERIALS, Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';
import { clientToViewport, ViewTransform, type Point, type ViewState } from './view-transform';
import { contentBoxFromBounds } from './client-coordinate-map';
import type { PixiFieldPresenter } from './pixi-field-presenter';
import { backingSize, resolveFieldOutputScale } from './render-resolution';
import { shadeCanvasAtmosphere } from './canvas-atmosphere-relief';
import { canvasLocalEmissionAlpha } from './canvas-emission-style';
import { shadeCanvasOpticalVolume } from './canvas-optics-style';
import {
  createLiquidSurfaceScratch, reconstructLiquidSurface, type LiquidSurfaceScratch,
} from './canvas-liquid-surface';
import {
  canvasLiquidContourScale, canvasLiquidFieldRelief, canvasLiquidSurfaceExposure,
} from './canvas-liquid-light';
import { shadeCanvasEnergy } from './canvas-energy-style';
import { shadeCanvasMaterial } from './canvas-material-style';
import {
  applicableCanvasRenderTraits, applyCanvasRenderTraits, CANVAS_RENDER_TRAIT_CLOCK_SIZE,
  updateCanvasRenderTraitClock,
} from './canvas-render-traits';
import { lightCanvasSurface } from './canvas-surface-light';
import { reconstructSolidSurface } from './canvas-solid-surface';
import { canvasSolidRelief } from './canvas-solid-relief';
import { RenderFieldSet } from './render-field-set';
import { RenderOptics } from './render-optics';
import { receivesSurfaceLight, renderPhase, RenderPhase, RenderProfile } from './render-profile';
import { semanticRenderHeat } from './semantic-field';
import { compositePixel } from './rgba-composite';
import { forceCanvas2D, supportsWebGL } from './webgl-support';
import { contourLight, materialNeighbourMask, neighbourDensity } from './volumetric-field';

const FRAME_INTERVAL = 1000 / 30;
export const DYNAMIC_FIELD_REFRESH_INTERVAL = 1000 / 12;
const WEBGL_LATE_PROMOTION_MS = 10_000;

export interface RendererBackendInfo {
  readonly backend: 'webgl' | 'canvas2d';
  readonly label: 'WebGL' | 'Canvas 2D';
  readonly reason?: 'forced' | 'webgl-unavailable' | 'webgl-starting' | 'webgl-timeout' | 'webgl-error';
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
  private readonly rendered: Uint8Array;
  private readonly renderedWalls?: Uint8Array;
  private readonly styledColor = new Float32Array(3);
  private readonly energyGlowColor = new Float32Array(3);
  private readonly traitClock = new Int32Array(CANVAS_RENDER_TRAIT_CLOCK_SIZE);
  private readonly outputScale = resolveFieldOutputScale();
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
  private firePixels?: ImageData;
  private fallbackFields?: RenderFieldSet;
  private backend: RendererBackendInfo = { backend: 'canvas2d', label: 'Canvas 2D', reason: 'webgl-starting' };
  private lastDraw = -Infinity;
  private lastDynamicFieldRefresh = -Infinity;
  private changed = true;
  private canvasPresentationTimingEnabled = false;
  private canvasPresentationTiming?: CanvasPresentationTiming;

  constructor(private readonly host: HTMLElement, private readonly simulation: SimulationBackend) {
    this.rendered = new Uint8Array(simulation.width * simulation.height);
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

  render(time: number): void {
    if (time - this.lastDraw < FRAME_INTERVAL) return;
    for (const cell of this.simulation.consumeDirtyCells()) {
      const previous = this.rendered[cell.index];
      this.rendered[cell.index] = cell.material;
      this.fallbackFields?.markDirty(previous, cell.material);
      this.presenter?.markDirty(cell.index, cell.material);
      this.changed = true;
    }
    for (const cell of this.simulation.consumeDirtyWalls?.() ?? []) {
      if (!this.renderedWalls) break;
      this.renderedWalls[cell.index] = cell.wall;
      this.presenter?.markWallDirty(cell.index);
      this.changed = true;
    }
    const hasDynamicFields = Boolean(this.simulation.temperature || this.simulation.velocity);
    const refreshDynamicFields = dynamicFieldRefreshDue(time, this.lastDynamicFieldRefresh, hasDynamicFields);
    const visualRefreshDue = this.presenter?.visualRefreshDue(time) ?? this.fallbackFields?.due(time) ?? false;
    if (!this.changed && !refreshDynamicFields && !visualRefreshDue) return;
    if (refreshDynamicFields) this.lastDynamicFieldRefresh = time;
    this.changed = false;
    this.lastDraw = time;
    this.drawField(time, refreshDynamicFields);
  }

  getViewState(): ViewState { return this.view.snapshot(); }

  getBackendInfo(): RendererBackendInfo { return this.backend; }

  enableCanvasPresentationTiming(): void { this.canvasPresentationTimingEnabled = true; }

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
      this.host, this.simulation.width, this.simulation.height, this.outputScale, ALL_MATERIALS,
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
      this.changed = true;
      this.setBackend({ backend: 'canvas2d', label: 'Canvas 2D', reason: 'webgl-error' });
      console.warn('Semantic WebGL renderer unavailable; keeping Canvas fallback.', error);
    }
  }

  private commitPresenter(presenter: PixiFieldPresenter): void {
    // Compile the shader and seed every semantic field while the known-good
    // Canvas remains visible. Any failure leaves the fallback fully intact.
    presenter.update(
      this.rendered, this.renderedWalls, this.simulation.temperature?.(), this.simulation.velocity?.(),
      performance.now(), true,
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
    this.host.dataset.rendererBackend = backend.backend;
    if (backend.reason) this.host.dataset.rendererReason = backend.reason;
    else delete this.host.dataset.rendererReason;
    this.fallbackSurface.dataset.rendererReason = backend.reason ?? '';
  }

  private drawField(time: number, refreshDynamicFields: boolean): void {
    const width = this.simulation.width;
    const height = this.simulation.height;
    const temperatures = this.simulation.temperature?.();
    const velocities = this.simulation.velocity?.();
    if (this.presenter) {
      this.presenter.update(this.rendered, this.renderedWalls, temperatures, velocities, time, refreshDynamicFields);
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
    const timingStart = this.canvasPresentationTimingEnabled ? performance.now() : undefined;
    const rebuiltField = fields.updateNext(this.rendered, time);
    if (rebuiltField === 'atmosphere') {
      shadeCanvasAtmosphere(
        atmospherePixels.data, fields.atmosphere.bytes,
        fields.atmosphere.width, fields.atmosphere.height,
      );
      this.atmosphereContext.putImageData(atmospherePixels, 0, 0);
    } else if (rebuiltField === 'emission') {
      emissionPixels.data.set(fields.emission.bytes);
      this.emissionContext.putImageData(emissionPixels, 0, 0);
    }
    const base = basePixels.data;
    const liquid = liquidPixels.data;
    const smoke = smokePixels.data;
    const fire = firePixels.data;
    updateCanvasRenderTraitClock(this.traitClock, time);
    base.fill(0); liquid.fill(0); smoke.fill(0); fire.fill(0);

    for (let index = 0; index < this.rendered.length; index++) {
      const material = this.rendered[index] as Material;
      const x = index % width;
      const y = Math.floor(index / width);
      const pixel = index * 4;
      const wall = this.renderedWalls?.[index] ?? 0;
      if (wall) {
        setWallPixel(base, pixel, wall, x, y);
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
      const liquidReliefScale = phase === RenderPhase.Liquid
        ? 1 + canvasLiquidFieldRelief(fields.liquid.bytes, width, height, x, y)
          * (optics === RenderOptics.Aqueous ? 1.08
            : optics === RenderOptics.Oily ? 0.84
              : optics === RenderOptics.Corrosive ? 1.0
                : optics === RenderOptics.Molten ? 0.76 : 0.92)
        : 1;
      const normalLight = (left === Material.Empty ? 8 : 0) - (right === Material.Empty ? 6 : 0)
        + (exposedTop ? 18 : 0) - (bottom === Material.Empty ? 5 : 0);
      const grain = hash(index) % 23 - 11;
      const denseSolidInterior = phase === RenderPhase.Solid
        && top === material && left === material && right === material && bottom === material;
      const surfaceLight = normalLight + (denseSolidInterior
        ? canvasSolidRelief(x, y, material, profile, optics)
        : 0);

      if (phase === RenderPhase.Energy) {
        const info = PROJECTED_RENDER_INFO[material];
        if (!info) continue;
        const red = info.color >>> 16;
        const green = (info.color >>> 8) & 0xFF;
        const blue = info.color & 0xFF;
        const heat = semanticRenderHeat(temperatures?.[index]);
        const glowAlpha = shadeCanvasEnergy(
          this.styledColor, this.energyGlowColor, red, green, blue, profile, traits,
          material, x, y, time, heat,
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
        compositePixel(target, pixel, 194 + grain + surfaceLight, 145 + grain * 0.65 + surfaceLight, 76 + grain * 0.35 + surfaceLight, 255);
      } else if (material === Material.Dust) {
        const softness = Math.sin(time * 0.0018 + x * 0.17 + y * 0.09) * 4;
        compositePixel(target, pixel, 188 + grain + surfaceLight + softness, 166 + grain + surfaceLight + softness, 124 + grain * 0.6 + surfaceLight, 238);
      } else if (material === Material.Salt) {
        const crystal = (hash(index + 211) & 7) === 0 ? 28 : 0;
        compositePixel(target, pixel, 220 + grain + crystal + surfaceLight, 216 + grain + crystal + surfaceLight, 202 + grain + crystal + surfaceLight, 255);
      } else if (material === Material.Oil) {
        const mask = materialNeighbourMask(this.rendered, width, height, x, y, material);
        const density = neighbourDensity(mask);
        const contour = contourLight(mask) * liquidContourScale;
        const flow = velocities ? velocities[index * 2] * 0.12 : 0;
        const sheen = Math.sin(time * 0.0017 + x * 0.055 + y * 0.025 + flow) * 5 + contour;
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
        const pulse = Math.sin(time * 0.003 + x * 0.1 + y * 0.07) * 8;
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
        compositePixel(target, pixel, 116 + facet + surfaceLight, 193 + facet + surfaceLight, 211 + facet + surfaceLight, 244);
      } else if (material === Material.Acid) {
        const mask = materialNeighbourMask(this.rendered, width, height, x, y, material);
        const density = neighbourDensity(mask);
        const contour = contourLight(mask) * liquidContourScale;
        const depth = density / 8;
        const shimmer = Math.sin(time * 0.0024 + x * 0.075 + y * 0.035) * 6 + contour;
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
        const spark = (hash(index + 911) & 31) === 0 ? 34 : 0;
        compositePixel(target, pixel, 70 + grain + spark + surfaceLight, 64 + grain + spark * 0.7 + surfaceLight, 58 + grain + spark * 0.35 + surfaceLight, 255);
      } else if (material === Material.Wall) {
        const seam = (hash(index + 73) & 31) === 0 ? -22 : 0;
        compositePixel(target, pixel, 105 + grain + seam + surfaceLight, 98 + grain + seam + surfaceLight, 88 + grain + seam + surfaceLight, 255);
      } else if (material === Material.Water) {
        const mask = materialNeighbourMask(this.rendered, width, height, x, y, material);
        const density = neighbourDensity(mask);
        const contour = contourLight(mask) * liquidContourScale;
        const depth = density / 8;
        const flow = velocities ? velocities[index * 2] * 0.18 : 0;
        const shimmer = Math.sin(time * 0.002 + x * 0.065 + y * 0.02 + flow) * 4;
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
        const billow = Math.sin(time * 0.0016 + x * 0.11 + y * 0.065 + drift) * 7;
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
          const volume = contourLight(mask) * 0.5 + Math.sin(time * 0.0014 + x * 0.08 + y * 0.05) * 5;
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
          const shimmer = Math.sin(time * 0.0018 + x * 0.055 + y * 0.025) * 4 + contour;
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
            this.styledColor, red, green, blue, fields.lookups.styleBytes[material * 4 + 1],
            optics, material, x, y, index, time,
          );
          if (denseSolidInterior && applicableTraits === 0 && !info.emissive) {
            const cohesion = 0.28;
            this.styledColor[0] += (red - this.styledColor[0]) * cohesion;
            this.styledColor[1] += (green - this.styledColor[1]) * cohesion;
            this.styledColor[2] += (blue - this.styledColor[2]) * cohesion;
          }
          if (applicableTraits !== 0) applyCanvasRenderTraits(
            this.styledColor, applicableTraits, phase, material, x, y, index, this.traitClock,
          );
          compositePixel(
            target, pixel,
            this.styledColor[0] + surfaceLight, this.styledColor[1] + surfaceLight, this.styledColor[2] + surfaceLight,
            255,
          );
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
      if (fields.emission.hasLight && receivesSurfaceLight(phase)) {
        const exposure = cardinalExposure(this.rendered, width, height, x, y, material);
        lightCanvasSurface(
          target, pixel, fields.emission.bytes, fields.emission.width, fields.emission.height,
          width, height, x, y, profile, exposure,
        );
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
    fallback.drawImage(this.surface, 0, 0, width, height, 0, 0, output.width, output.height);
    fallback.imageSmoothingEnabled = true;
    fallback.drawImage(this.liquidSurface, 0, 0, width, height, 0, 0, output.width, output.height);
    // A restrained nearest pass keeps the two-pixel reconstruction crisp while
    // the high-quality pass joins cells into a cohesive liquid surface.
    fallback.imageSmoothingEnabled = false;
    fallback.globalAlpha = 0.18;
    fallback.drawImage(this.liquidSurface, 0, 0, width, height, 0, 0, output.width, output.height);
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
    if (!context || !liquidContext || !smokeContext || !fireContext || !atmosphereContext || !emissionContext || !fallbackContext) {
      throw new Error('Canvas 2D unavailable');
    }
    this.context = context;
    this.liquidContext = liquidContext;
    this.smokeContext = smokeContext;
    this.fireContext = fireContext;
    this.atmosphereContext = atmosphereContext;
    this.emissionContext = emissionContext;
    this.fallbackContext = fallbackContext;
    this.basePixels = context.createImageData(width, height);
    this.liquidPixels = liquidContext.createImageData(width, height);
    this.smokePixels = smokeContext.createImageData(width, height);
    this.firePixels = fireContext.createImageData(width, height);
    this.atmospherePixels = atmosphereContext.createImageData(this.atmosphereSurface.width, this.atmosphereSurface.height);
    this.emissionPixels = emissionContext.createImageData(this.emissionSurface.width, this.emissionSurface.height);
    this.liquidSurfaceScratch = createLiquidSurfaceScratch(this.liquidPixels.data, width);
    this.host.append(this.fallbackSurface);
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

function setWallPixel(target: Uint8ClampedArray, offset: number, wall: number, x: number, y: number): void {
  const colors: Readonly<Record<number, readonly [number, number, number]>> = {
    1: [125, 139, 150], 2: [91, 111, 139], 3: [191, 130, 60], 6: [68, 145, 170],
    8: [104, 105, 108], 9: [111, 132, 150], 10: [174, 132, 73], 13: [129, 108, 156],
    15: [205, 191, 91], 16: [68, 80, 91],
  };
  const color = colors[wall] ?? [103, 105, 111];
  const checker = ((Math.floor(x / 4) + Math.floor(y / 4)) & 1) ? 9 : -4;
  const filter = [6, 9, 10, 13, 15].includes(wall) && ((x + y) & 3) === 0 ? 22 : 0;
  setPixel(target, offset, color[0] + checker + filter, color[1] + checker + filter, color[2] + checker + filter, 248);
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
