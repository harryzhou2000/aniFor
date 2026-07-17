import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';
import { ViewTransform, type Point, type ViewState } from './view-transform';
import { buildWaterSurface } from './materials/water/metaball-surface';

const FRAME_INTERVAL = 1000 / 30;

/** Continuous field renderer: one shaded texel per native Powder Toy cell. */
export class MaterialRenderer {
  private readonly surface = document.createElement('canvas');
  private readonly smokeSurface = document.createElement('canvas');
  private readonly fireSurface = document.createElement('canvas');
  private readonly rendered: Uint8Array;
  private readonly view: ViewTransform;
  private basePixels!: ImageData;
  private smokePixels!: ImageData;
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
    this.host.append(this.surface);
    const context = this.surface.getContext('2d');
    const smoke = this.smokeSurface.getContext('2d');
    const fire = this.fireSurface.getContext('2d');
    if (!context || !smoke || !fire) throw new Error('Canvas 2D unavailable');
    this.basePixels = context.createImageData(this.simulation.width, this.simulation.height);
    this.smokePixels = smoke.createImageData(this.simulation.width, this.simulation.height);
    this.firePixels = fire.createImageData(this.simulation.width, this.simulation.height);
    this.resize();
    new ResizeObserver(() => this.resize()).observe(this.host);
  }

  render(time: number): void {
    for (const cell of this.simulation.consumeDirtyCells()) {
      this.rendered[cell.index] = cell.material;
      this.changed = true;
    }
    if (!this.changed || time - this.lastDraw < FRAME_INTERVAL) return;
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
      } else if (material === Material.Wall) {
        const seam = (hash(index + 73) & 31) === 0 ? -22 : 0;
        setPixel(base, pixel, 105 + grain + seam + normalLight, 98 + grain + seam + normalLight, 88 + grain + seam + normalLight, 255);
      } else if (material === Material.Water) {
        const flow = velocities ? velocities[index * 2] * 0.18 : 0;
        const shimmer = Math.sin(time * 0.0025 + x * 0.11 + flow) * 5;
        const surface = top !== Material.Water ? 42 : 0;
        setPixel(base, pixel, 27 + shimmer + surface * 0.35, 112 + shimmer + surface, 157 + shimmer + surface, 224);
      } else if (material === Material.Smoke) {
        const speed = velocities ? Math.abs(velocities[index * 2 + 1]) : 0;
        setPixel(smoke, pixel, 126 + grain, 128 + grain, 132 + grain, 95 + Math.min(55, speed));
      } else if (material === Material.Fire) {
        const kelvin = temperatures ? temperatures[index] / 10 : 1100;
        const heat = clamp((kelvin - 450) / 1100, 0, 1);
        setPixel(base, pixel, 255, 115 + heat * 125, 28 + heat * 130, 255);
        setPixel(fire, pixel, 255, 92 + heat * 100, 18, 210);
      }
    }

    const context = this.surface.getContext('2d')!;
    const smokeContext = this.smokeSurface.getContext('2d')!;
    const fireContext = this.fireSurface.getContext('2d')!;
    smokeContext.putImageData(this.smokePixels, 0, 0);
    fireContext.putImageData(this.firePixels, 0, 0);
    context.putImageData(this.basePixels, 0, 0);
    this.drawWaterSurface(context);
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
  }

  private drawWaterSurface(context: CanvasRenderingContext2D): void {
    const polygons = buildWaterSurface(this.rendered, this.simulation.width, this.simulation.height);
    if (polygons.length === 0) return;
    const gradient = context.createLinearGradient(0, 0, 0, this.simulation.height);
    gradient.addColorStop(0, 'rgba(125, 229, 239, 0.82)');
    gradient.addColorStop(0.42, 'rgba(40, 157, 190, 0.72)');
    gradient.addColorStop(1, 'rgba(15, 82, 130, 0.88)');
    context.save();
    context.beginPath();
    for (const polygon of polygons) {
      context.moveTo(polygon[0].x, polygon[0].y);
      for (let index = 1; index < polygon.length; index++) context.lineTo(polygon[index].x, polygon[index].y);
      context.closePath();
    }
    context.fillStyle = gradient;
    context.globalAlpha = 0.72;
    context.fill();
    context.globalCompositeOperation = 'screen';
    context.filter = 'blur(0.8px)';
    context.globalAlpha = 0.16;
    context.fillStyle = '#d8fdff';
    context.fill();
    context.restore();
  }

  private resize(): void { this.view.resize(this.host.clientWidth, this.host.clientHeight); this.syncTransform(); }
  private syncTransform(): void {
    const position = this.view.position;
    this.surface.style.transform = `translate3d(${position.x}px, ${position.y}px, 0) scale(${this.view.scale})`;
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
