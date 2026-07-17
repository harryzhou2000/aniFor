import { MaterialRenderer } from '../renderer/field-renderer';
import { Material } from '../shared/materials';
import { decodeSharedWorld, encodeSharedWorld } from '../shared/share-codec';
import type { SimulationBackend } from '../simulation';
import { mountControls } from '../ui/controls';
import { WorldInputController } from '../ui/world-input';

const AUTOSAVE_KEY = 'stillroom-world-v1';

export class Game {
  private readonly simulation: SimulationBackend;
  private readonly renderer: MaterialRenderer;
  private material = Material.Sand;
  private radius = 7;
  private paused = false;
  private accumulator = 0;
  private lastFrame = performance.now();

  constructor(private readonly root: HTMLElement, simulation: SimulationBackend) {
    this.simulation = simulation;
    const viewport = root.querySelector('.viewport') as HTMLElement;
    this.renderer = new MaterialRenderer(viewport, simulation);
  }

  async start(): Promise<void> {
    await this.renderer.init();
    await this.restore();
    const viewport = this.root.querySelector('.viewport') as HTMLElement;
    new WorldInputController(viewport, this.renderer, {
      draw: ({ x, y }, erase) => {
        if (erase) this.simulation.erase(x, y, this.radius + 1);
        else this.simulation.paint(x, y, this.material, this.radius);
      },
    });
    mountControls(this.root, {
      onMaterial: (material) => { this.material = material; },
      onRadius: (radius) => { this.radius = radius; },
      onPause: () => { this.paused = !this.paused; },
      onShare: () => this.share(),
      onClear: () => { this.simulation.clear(); localStorage.removeItem(AUTOSAVE_KEY); },
    });
    this.seedIfEmpty();
    window.setInterval(() => this.save(), 4000);
    requestAnimationFrame(this.frame);
  }

  private readonly frame = (time: number): void => {
    const elapsed = Math.min(time - this.lastFrame, 80);
    this.lastFrame = time;
    if (!this.paused) {
      this.accumulator += elapsed;
      while (this.accumulator >= 1000 / 60) { this.simulation.step(); this.accumulator -= 1000 / 60; }
    }
    this.renderer.render(time);
    requestAnimationFrame(this.frame);
  };


  private async share(): Promise<boolean> {
    const encoded = await encodeSharedWorld(this.simulation.saveWorld());
    const url = new URL(location.href);
    url.hash = new URLSearchParams({ world: encoded }).toString();
    history.replaceState(null, '', url);
    try { await navigator.clipboard.writeText(url.toString()); return true; } catch { return false; }
  }

  private save(): void {
    try { localStorage.setItem(AUTOSAVE_KEY, this.simulation.saveWorld()); } catch { /* storage may be unavailable */ }
  }

  private async restore(): Promise<void> {
    const shared = new URLSearchParams(location.hash.slice(1)).get('world');
    if (shared) {
      try { this.simulation.loadWorld(await decodeSharedWorld(shared)); return; }
      catch { history.replaceState(null, "", location.pathname + location.search); }
    }
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) this.simulation.loadWorld(saved);
    } catch { localStorage.removeItem(AUTOSAVE_KEY); }
  }

  private seedIfEmpty(): void {
    if (this.simulation.cells().some((cell) => cell !== Material.Empty)) return;
    const floor = this.simulation.height - 8;
    for (let x = 25; x < this.simulation.width - 25; x += 3) this.simulation.paint(x, floor, Material.Wall, 2);
    this.simulation.paint(Math.floor(this.simulation.width * 0.38), Math.floor(this.simulation.height * 0.18), Material.Sand, 16);
    this.simulation.paint(Math.floor(this.simulation.width * 0.62), Math.floor(this.simulation.height * 0.22), Material.Water, 14);
  }
}
