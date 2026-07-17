import { Application, Container, Graphics } from 'pixi.js';
import { MATERIALS, Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';
import { cellStyle, tintVariation } from './material-palette';
import { buildWaterSurface } from './materials/water/metaball-surface';
import { ViewTransform, type Point, type ViewState } from './view-transform';

/** Pixi material layers fed only by the simulation's dirty-cell contract. */
export class MaterialRenderer {
  private readonly app = new Application();
  private readonly scene = new Container();
  private readonly glow = new Graphics();
  private readonly waterHighlights = new Graphics();
  private readonly occlusion = new Graphics();
  private readonly layers = new Map<Material, Graphics>();
  private readonly rendered: Uint8Array;
  private cellSize = 6;
  private readonly view: ViewTransform;
  private hasFire = false;

  constructor(private readonly host: HTMLElement, private readonly simulation: SimulationBackend) {
    this.rendered = new Uint8Array(simulation.width * simulation.height);
    this.view = new ViewTransform(simulation.width * this.cellSize, simulation.height * this.cellSize);
    for (const material of MATERIALS) this.layers.set(material.id, new Graphics());
  }

  async init(): Promise<void> {
    await this.app.init({
      resizeTo: this.host,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(devicePixelRatio, 2),
    });
    this.app.canvas.className = 'world-canvas';
    this.host.append(this.app.canvas);
    this.scene.addChild(
      this.glow,
      this.layers.get(Material.Wall)!,
      this.layers.get(Material.Sand)!,
      this.layers.get(Material.Water)!,
      this.waterHighlights,
      this.occlusion,
      this.layers.get(Material.Smoke)!,
      this.layers.get(Material.Fire)!,
    );
    this.layers.get(Material.Water)!.alpha = 0.78;
    this.occlusion.blendMode = 'multiply';
    this.app.stage.addChild(this.scene);
    this.resize();
    new ResizeObserver(() => this.resize()).observe(this.host);
  }

  render(time: number): void {
    const affected = new Set<Material>();
    for (const cell of this.simulation.consumeDirtyCells()) {
      const previous = this.rendered[cell.index] as Material;
      if (previous !== Material.Empty) affected.add(previous);
      if (cell.material !== Material.Empty) affected.add(cell.material);
      this.rendered[cell.index] = cell.material;
    }

    this.hasFire = this.rendered.includes(Material.Fire);
    if (this.hasFire) affected.add(Material.Fire);
    for (const material of affected) this.rebuildLayer(material, time);
    if (affected.has(Material.Wall) || affected.has(Material.Sand) || affected.has(Material.Water)) this.rebuildOcclusion();
    if (!this.hasFire && affected.has(Material.Fire)) this.glow.clear();
  }

  getViewState(): ViewState { return this.view.snapshot(); }

  applyGesture(start: ViewState, anchorStart: Point, anchorCurrent: Point, ratio: number): void {
    const rect = this.app.canvas.getBoundingClientRect();
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
    const rect = this.app.canvas.getBoundingClientRect();
    return {
      x: Math.floor((clientX - rect.left - this.scene.position.x) / this.view.scale / this.cellSize),
      y: Math.floor((clientY - rect.top - this.scene.position.y) / this.view.scale / this.cellSize),
    };
  }

  private rebuildLayer(material: Material, time: number): void {
    const layer = this.layers.get(material);
    const style = cellStyle(material);
    if (!layer || !style) return;
    layer.clear();
    if (material === Material.Fire) this.glow.clear();
    if (material === Material.Water) { this.rebuildWater(layer, style.color); return; }

    for (let index = 0; index < this.rendered.length; index++) {
      if (this.rendered[index] !== material) continue;
      const x = (index % this.simulation.width + 0.5) * this.cellSize;
      const y = (Math.floor(index / this.simulation.width) + 0.5) * this.cellSize;
      const wobble = material === Material.Fire ? Math.sin(time * 0.008 + index) * this.cellSize * 0.08 : 0;
      const radius = Math.max(1, this.cellSize * (style.radius + tintVariation(index)));
      if (style.glow) this.glow.circle(x, y + wobble, radius * 2.35).fill({ color: style.glow, alpha: 0.055 });
      layer.circle(x, y + wobble, radius).fill({ color: style.color, alpha: style.alpha });
      if (material === Material.Sand) layer.circle(x - radius * 0.18, y - radius * 0.18, Math.max(0.35, radius * 0.12)).fill({ color: 0xffe0a8, alpha: 0.25 });
    }
  }

  private rebuildWater(layer: Graphics, color: number): void {
    this.waterHighlights.clear();
    for (const polygon of buildWaterSurface(this.rendered, this.simulation.width, this.simulation.height)) {
      layer.poly(polygon.flatMap((point) => [point.x * this.cellSize, point.y * this.cellSize])).fill({ color, alpha: 1 });
    }
    for (let index = 0; index < this.rendered.length; index++) {
      if (this.rendered[index] !== Material.Water) continue;
      const x = index % this.simulation.width, y = Math.floor(index / this.simulation.width);
      if (y > 0 && this.rendered[(y - 1) * this.simulation.width + x] === Material.Water) continue;
      this.waterHighlights.ellipse((x + 0.5) * this.cellSize, (y + 0.3) * this.cellSize, this.cellSize * 0.32, this.cellSize * 0.12)
        .stroke({ color: 0xd9fbff, alpha: 0.3, width: 0.65 });
    }
  }

  private rebuildOcclusion(): void {
    this.occlusion.clear();
    const width = this.simulation.width, height = this.simulation.height;
    for (let index = 0; index < this.rendered.length; index++) {
      const material = this.rendered[index] as Material;
      if (!isDense(material)) continue;
      const x = index % width, y = Math.floor(index / width);
      let neighbours = 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        if ((!ox && !oy) || x + ox < 0 || x + ox >= width || y + oy < 0 || y + oy >= height) continue;
        if (isDense(this.rendered[(y + oy) * width + x + ox] as Material)) neighbours++;
      }
      if (neighbours <= 3) continue;
      this.occlusion.circle((x + 0.5) * this.cellSize, (y + 0.58) * this.cellSize, this.cellSize * 0.48)
        .fill({ color: 0x17130f, alpha: Math.min(0.12, (neighbours - 3) * 0.022) });
    }
  }

  private resize(): void {
    this.view.resize(this.host.clientWidth, this.host.clientHeight);
    this.syncTransform();
  }

  private syncTransform(): void {
    this.scene.scale.set(this.view.scale);
    const position = this.view.position;
    this.scene.position.set(position.x, position.y);
  }
}

function isDense(material: Material): boolean {
  return material === Material.Sand || material === Material.Water || material === Material.Wall;
}
