import { ALL_MATERIALS, Material, type MaterialCategory } from '../shared/materials';
import type { SimulationBackend } from '../simulation';
import { ViewTransform, type Point, type ViewState } from './view-transform';
import type { PixiFieldPresenter } from './pixi-field-presenter';
import { supportsWebGL } from './webgl-support';
import { contourLight, materialNeighbourMask, neighbourDensity } from './volumetric-field';

const FRAME_INTERVAL = 1000 / 30;

interface ProjectedRenderInfo { readonly color: number; readonly category: MaterialCategory }
const PROJECTED_RENDER_INFO: Array<ProjectedRenderInfo | undefined> = [];
for (const material of ALL_MATERIALS) {
  PROJECTED_RENDER_INFO[material.id] = { color: Number.parseInt(material.color.slice(1), 16), category: material.category };
}

/** Continuous field renderer: one shaded texel per native Powder Toy cell. */
export class MaterialRenderer {
  private readonly surface = document.createElement('canvas');
  private readonly smokeSurface = document.createElement('canvas');
  private readonly fireSurface = document.createElement('canvas');
  private readonly rendered: Uint8Array;
  private presenter?: PixiFieldPresenter;
  private readonly view: ViewTransform;
  private basePixels!: ImageData;
  private smokePixels!: ImageData;
  private context!: CanvasRenderingContext2D;
  private smokeContext!: CanvasRenderingContext2D;
  private fireContext!: CanvasRenderingContext2D;
  private firePixels!: ImageData;
  private lastDraw = -Infinity;
  private changed = true;

  constructor(private readonly host: HTMLElement, private readonly simulation: SimulationBackend) {
    this.rendered = new Uint8Array(simulation.width * simulation.height);
    this.view = new ViewTransform(simulation.width, simulation.height);
    for (const canvas of [this.surface, this.smokeSurface, this.fireSurface]) {
      canvas.width = simulation.width;
      canvas.height = simulation.height;
    }
  }

  async init(): Promise<void> {
    this.surface.className = 'world-canvas';
    this.surface.style.width = `${this.simulation.width}px`;
    this.surface.style.height = `${this.simulation.height}px`;
    this.surface.style.transformOrigin = '0 0';
    const context = this.surface.getContext('2d');
    const smokeContext = this.smokeSurface.getContext('2d');
    const fireContext = this.fireSurface.getContext('2d');
    if (!context || !smokeContext || !fireContext) throw new Error('Canvas 2D unavailable');
    this.context = context;
    this.smokeContext = smokeContext;
    this.fireContext = fireContext;
    this.basePixels = context.createImageData(this.simulation.width, this.simulation.height);
    this.smokePixels = smokeContext.createImageData(this.simulation.width, this.simulation.height);
    this.firePixels = fireContext.createImageData(this.simulation.width, this.simulation.height);
    if (supportsWebGL()) {
      try {
        const { PixiFieldPresenter } = await import('./pixi-field-presenter');
        this.presenter = await Promise.race([
          PixiFieldPresenter.create(this.host, this.surface),
          new Promise<undefined>((resolve) => window.setTimeout(() => resolve(undefined), 750)),
        ]);
        this.presenter?.mount();
      } catch { // Canvas presentation remains the compatibility path.
      }
    }
    if (!this.presenter) this.host.append(this.surface);
    this.resize();
    new ResizeObserver(() => this.resize()).observe(this.host);
  }

  render(time: number): void {
    if (time - this.lastDraw < FRAME_INTERVAL) return;
    for (const cell of this.simulation.consumeDirtyCells()) {
      this.rendered[cell.index] = cell.material;
      this.changed = true;
    }
    const hasDynamicFields = Boolean(this.simulation.temperature || this.simulation.velocity);
    if (!this.changed && !hasDynamicFields) return;
    this.changed = false;
    this.lastDraw = time;
    this.drawField(time);
  }

  getViewState(): ViewState { return this.view.snapshot(); }

  applyGesture(start: ViewState, anchorStart: Point, anchorCurrent: Point, ratio: number): void {
    const rect = this.host.getBoundingClientRect();
    this.view.applyGesture(
      start,
      { x: anchorStart.x - rect.left, y: anchorStart.y - rect.top },
      { x: anchorCurrent.x - rect.left, y: anchorCurrent.y - rect.top },
      ratio,
    );
    this.syncTransform();
  }

  resetView(): void { this.view.reset(); this.syncTransform(); }

  screenToCell(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.host.getBoundingClientRect();
    return {
      x: Math.floor((clientX - rect.left - this.view.position.x) / this.view.scale),
      y: Math.floor((clientY - rect.top - this.view.position.y) / this.view.scale),
    };
  }

  private drawField(time: number): void {
    const base = this.basePixels.data;
    const smoke = this.smokePixels.data;
    const fire = this.firePixels.data;
    base.fill(0); smoke.fill(0); fire.fill(0);
    const width = this.simulation.width;
    const height = this.simulation.height;
    const temperatures = this.simulation.temperature?.();
    const velocities = this.simulation.velocity?.();

    for (let index = 0; index < this.rendered.length; index++) {
      const material = this.rendered[index] as Material;
      if (material === Material.Empty) continue;
      const x = index % width;
      const y = Math.floor(index / width);
      const pixel = index * 4;
      const top = y === 0 ? Material.Empty : this.rendered[index - width] as Material;
      const left = x === 0 ? Material.Empty : this.rendered[index - 1] as Material;
      const right = x === width - 1 ? Material.Empty : this.rendered[index + 1] as Material;
      const bottom = y === height - 1 ? Material.Wall : this.rendered[index + width] as Material;
      const exposedTop = top !== material;
      const normalLight = (left === Material.Empty ? 8 : 0) - (right === Material.Empty ? 6 : 0)
        + (exposedTop ? 18 : 0) - (bottom === Material.Empty ? 5 : 0);
      const grain = hash(index) % 23 - 11;

      if (material === Material.Sand) {
        setPixel(base, pixel, 194 + grain + normalLight, 145 + grain * 0.65 + normalLight, 76 + grain * 0.35 + normalLight, 255);
      } else if (material === Material.Dust) {
        const softness = Math.sin(time * 0.0018 + x * 0.17 + y * 0.09) * 4;
        setPixel(base, pixel, 188 + grain + normalLight + softness, 166 + grain + normalLight + softness, 124 + grain * 0.6 + normalLight, 238);
      } else if (material === Material.Salt) {
        const crystal = (hash(index + 211) & 7) === 0 ? 28 : 0;
        setPixel(base, pixel, 220 + grain + crystal + normalLight, 216 + grain + crystal + normalLight, 202 + grain + crystal + normalLight, 255);
      } else if (material === Material.Oil) {
        const mask = materialNeighbourMask(this.rendered, width, height, x, y, material);
        const density = neighbourDensity(mask);
        const contour = contourLight(mask);
        const flow = velocities ? velocities[index * 2] * 0.12 : 0;
        const sheen = Math.sin(time * 0.0017 + x * 0.055 + y * 0.025 + flow) * 5 + contour;
        const depth = density / 8;
        setPixel(base, pixel, 91 - depth * 28 + sheen, 67 - depth * 24 + sheen * 0.65, 35 - depth * 14 + sheen * 0.3, 218 + density * 4);
        if (exposedTop) setPixel(fire, pixel, 172 + sheen, 128 + sheen, 66, 34 + Math.max(0, contour));
      } else if (material === Material.Wood) {
        const ring = ((x + Math.floor(y / 3)) % 9) < 2 ? -20 : 4;
        setPixel(base, pixel, 132 + grain + ring + normalLight, 76 + grain * 0.45 + ring * 0.5 + normalLight, 40 + ring * 0.25 + normalLight, 255);
      } else if (material === Material.Plant) {
        const leaf = (hash(index + 401) & 3) * 7;
        setPixel(base, pixel, 62 + leaf + normalLight, 132 + leaf + normalLight, 58 + grain * 0.35 + normalLight, 255);
      } else if (material === Material.Lava) {
        const mask = materialNeighbourMask(this.rendered, width, height, x, y, material);
        const density = neighbourDensity(mask);
        const contour = contourLight(mask);
        const kelvin = temperatures ? temperatures[index] / 10 : 1450;
        const heat = clamp((kelvin - 700) / 1100, 0, 1);
        const crust = density > 6 ? -52 : 0;
        const pulse = Math.sin(time * 0.003 + x * 0.1 + y * 0.07) * 8;
        setPixel(base, pixel, 224 + crust + heat * 31 + contour, 48 + pulse + heat * 120 + contour, 8 + heat * 54, 255);
        setPixel(fire, pixel, 255, 54 + heat * 130 + pulse, 8, 135 + heat * 80 + Math.max(0, contour));
      } else if (material === Material.Ice) {
        const facet = (hash(index + 617) & 15) < 3 ? 24 : 0;
        setPixel(base, pixel, 116 + facet + normalLight, 193 + facet + normalLight, 211 + facet + normalLight, 244);
      } else if (material === Material.Acid) {
        const mask = materialNeighbourMask(this.rendered, width, height, x, y, material);
        const density = neighbourDensity(mask);
        const contour = contourLight(mask);
        const depth = density / 8;
        const shimmer = Math.sin(time * 0.0024 + x * 0.075 + y * 0.035) * 6 + contour;
        setPixel(base, pixel, 127 - depth * 30 + shimmer, 205 - depth * 38 + shimmer, 58 - depth * 14 + shimmer * 0.45, 202 + density * 6);
        if (exposedTop) setPixel(fire, pixel, 137 + shimmer, 236, 72 + shimmer, 42 + Math.max(0, contour));
      } else if (material === Material.Gunpowder) {
        const spark = (hash(index + 911) & 31) === 0 ? 34 : 0;
        setPixel(base, pixel, 70 + grain + spark + normalLight, 64 + grain + spark * 0.7 + normalLight, 58 + grain + spark * 0.35 + normalLight, 255);
      } else if (material === Material.Wall) {
        const seam = (hash(index + 73) & 31) === 0 ? -22 : 0;
        setPixel(base, pixel, 105 + grain + seam + normalLight, 98 + grain + seam + normalLight, 88 + grain + seam + normalLight, 255);
      } else if (material === Material.Water) {
        const mask = materialNeighbourMask(this.rendered, width, height, x, y, material);
        const density = neighbourDensity(mask);
        const contour = contourLight(mask);
        const depth = density / 8;
        const flow = velocities ? velocities[index * 2] * 0.18 : 0;
        const shimmer = Math.sin(time * 0.002 + x * 0.065 + y * 0.02 + flow) * 4;
        const light = contour + shimmer;
        setPixel(base, pixel, 53 - depth * 31 + light * 0.45, 169 - depth * 56 + light, 205 - depth * 40 + light, 198 + density * 7);
        if (exposedTop) setPixel(fire, pixel, 129 + light, 232 + light, 245, 44 + Math.max(0, contour));
      } else if (material === Material.Smoke) {
        const mask = materialNeighbourMask(this.rendered, width, height, x, y, material);
        const density = neighbourDensity(mask);
        const contour = contourLight(mask);
        const speed = velocities ? Math.abs(velocities[index * 2 + 1]) : 0;
        const drift = velocities ? velocities[index * 2] * 0.025 : 0;
        const billow = Math.sin(time * 0.0016 + x * 0.11 + y * 0.065 + drift) * 7;
        const volume = density * 5 + contour * 0.6 + billow;
        setPixel(smoke, pixel, 114 + volume, 118 + volume, 124 + volume, 45 + density * 13 + Math.min(38, speed));
      } else if (material === Material.Fire) {
        const kelvin = temperatures ? temperatures[index] / 10 : 1100;
        const heat = clamp((kelvin - 450) / 1100, 0, 1);
        setPixel(base, pixel, 255, 115 + heat * 125, 28 + heat * 130, 255);
        setPixel(fire, pixel, 255, 92 + heat * 100, 18, 210);
      } else {
        const info = PROJECTED_RENDER_INFO[material];
        if (!info) continue;
        const red = info.color >>> 16;
        const green = (info.color >>> 8) & 0xFF;
        const blue = info.color & 0xFF;
        if (info.category === "gases") {
          const mask = materialNeighbourMask(this.rendered, width, height, x, y, material);
          const density = neighbourDensity(mask);
          const volume = density * 4 + contourLight(mask) * 0.5 + Math.sin(time * 0.0014 + x * 0.08 + y * 0.05) * 5;
          setPixel(smoke, pixel, red + volume, green + volume, blue + volume, 42 + density * 12);
        } else if (info.category === "liquids") {
          const mask = materialNeighbourMask(this.rendered, width, height, x, y, material);
          const density = neighbourDensity(mask);
          const contour = contourLight(mask);
          const depth = density * 3.2;
          const shimmer = Math.sin(time * 0.0018 + x * 0.055 + y * 0.025) * 4 + contour;
          setPixel(base, pixel, red - depth + shimmer, green - depth + shimmer, blue - depth + shimmer, 205 + density * 6);
          if (exposedTop) setPixel(fire, pixel, red + 35, green + 35, blue + 35, 30 + Math.max(0, contour));
        } else if (info.category === "energy") {
          setPixel(base, pixel, red + normalLight, green + normalLight, blue + normalLight, 245);
          setPixel(fire, pixel, red, green, blue, 180);
        } else {
          setPixel(base, pixel, red + grain * 0.45 + normalLight, green + grain * 0.45 + normalLight, blue + grain * 0.45 + normalLight, 255);
        }
      }
    }

    const context = this.context;
    this.smokeContext.putImageData(this.smokePixels, 0, 0);
    this.fireContext.putImageData(this.firePixels, 0, 0);
    context.putImageData(this.basePixels, 0, 0);
    context.save();
    context.imageSmoothingEnabled = true;
    context.filter = 'blur(2.2px)';
    context.globalAlpha = 0.78;
    context.drawImage(this.smokeSurface, 0, 0);
    context.globalCompositeOperation = 'lighter';
    context.filter = 'blur(5px)';
    context.globalAlpha = 0.72;
    context.drawImage(this.fireSurface, 0, 0);
    context.filter = 'none';
    context.globalAlpha = 0.92;
    context.drawImage(this.fireSurface, 0, 0);
    context.restore();
    this.presenter?.update();
  }


  private resize(): void { this.view.resize(this.host.clientWidth, this.host.clientHeight); this.syncTransform(); }
  private syncTransform(): void {
    const position = this.view.position;
    if (this.presenter) this.presenter.setTransform(this.view.scale, position.x, position.y);
    else this.surface.style.transform = `translate3d(${position.x}px, ${position.y}px, 0) scale(${this.view.scale})`;
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

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
