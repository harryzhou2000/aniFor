import { MaterialRenderer } from '../renderer/field-renderer';
import { applyRenderLabScene, renderLabRequested } from '../renderer/render-lab-scene';
import { applyWallLabScene, wallLabRequested } from '../renderer/wall-lab-scene';
import { MATERIALS, Material } from '../shared/materials';
import { decodeSharedWorld } from '../shared/share-codec';
import { exportWorldFile, importWorldFile, MAX_WORLD_FILE_BYTES, worldFileName } from '../shared/world-file';
import type { SimulationBackend } from '../simulation';
import { mountControls } from '../ui/controls';
import { buildToolCatalog, type WallToolInfo } from '../ui/tool-catalog';
import { WorldInputController } from '../ui/world-input';

const AUTOSAVE_KEY = 'stillroom-world-v1';

export class Game {
  private readonly simulation: SimulationBackend;
  private readonly renderer: MaterialRenderer;
  private material = Material.Sand;
  private wallTool?: WallToolInfo;
  private radius = 7;
  private eraseMode = false;
  private paused = false;
  private accumulator = 0;
  private lastFrame = performance.now();
  private probeX = 0;
  private probeY = 0;
  private lastIndicatorUpdate = -Infinity;
  private indicator?: HTMLOutputElement;

  constructor(private readonly root: HTMLElement, simulation: SimulationBackend) {
    this.simulation = simulation;
    const viewport = root.querySelector('.viewport') as HTMLElement;
    this.renderer = new MaterialRenderer(viewport, simulation);
    this.probeX = Math.floor(simulation.width / 2);
    this.probeY = Math.floor(simulation.height / 2);
  }

  async start(): Promise<void> {
    await this.renderer.init();
    const renderLab = renderLabRequested();
    const wallLab = wallLabRequested();
    if (renderLab) {
      applyRenderLabScene(this.simulation);
      this.paused = true;
      this.root.dataset.scene = 'render-lab';
    } else if (wallLab) {
      applyWallLabScene(this.simulation);
      this.paused = true;
      this.root.dataset.scene = 'wall-lab';
    } else {
      await this.restore();
    }
    const viewport = this.root.querySelector('.viewport') as HTMLElement;
    new WorldInputController(viewport, this.renderer, {
      draw: ({ x, y }, erase) => {
        erase ||= this.eraseMode;
        if (this.wallTool && this.simulation.paintWall && this.simulation.eraseWall) {
          if (erase) this.simulation.eraseWall(x, y, this.radius + 1);
          else this.simulation.paintWall(x, y, this.wallTool.nativeWall, this.radius);
        } else if (erase) this.simulation.erase(x, y, this.radius + 1);
        else this.simulation.paint(x, y, this.material, this.radius);
      },
    });
    this.mountFieldIndicator(viewport);
    const toolbox = this.root.querySelector<HTMLElement>('.toolbox');
    if (!toolbox) throw new Error('Missing simulation toolbox');
    mountControls(toolbox, {
      onMaterial: (material) => { this.material = material; this.wallTool = undefined; },
      onRadius: (radius) => { this.radius = radius; },
      onPause: () => { this.paused = !this.paused; },
      onEraseMode: (erase) => { this.eraseMode = erase; },
      onSaveFile: () => this.downloadWorldFile(),
      onOpenFile: (file) => this.openWorldFile(file),
      onClear: () => { this.simulation.clear(); localStorage.removeItem(AUTOSAVE_KEY); },
      onTool: (tool) => { if (tool.kind === 'wall') this.wallTool = tool; },
    }, buildToolCatalog(MATERIALS, { walls: Boolean(this.simulation.paintWall && this.simulation.eraseWall) }));
    if (renderLab || wallLab) {
      const status = this.root.querySelector('.status');
      const sceneName = renderLab ? 'render lab' : 'native wall lab';
      if (status) status.textContent = `${this.simulation.name} · paused ${sceneName}`;
    } else {
      this.seedIfEmpty();
      window.setInterval(() => this.save(), 4000);
    }
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
    if (time - this.lastIndicatorUpdate >= 100) {
      this.lastIndicatorUpdate = time;
      this.updateFieldIndicator();
    }
    requestAnimationFrame(this.frame);
  };


  private mountFieldIndicator(viewport: HTMLElement): void {
    const indicator = document.createElement("output");
    indicator.className = "field-indicator glass";
    indicator.setAttribute("aria-live", "off");
    viewport.append(indicator);
    this.indicator = indicator;
    const selectProbe = (event: PointerEvent): void => {
      const cell = this.renderer.screenToCell(event.clientX, event.clientY);
      if (cell.x < 0 || cell.y < 0 || cell.x >= this.simulation.width || cell.y >= this.simulation.height) return;
      this.probeX = cell.x;
      this.probeY = cell.y;
      if (this.indicator) this.indicator.dataset.cell = cell.x + ',' + cell.y;
      this.updateFieldIndicator();
    };
    viewport.addEventListener("pointermove", selectProbe);
    viewport.addEventListener("pointerdown", selectProbe);
    this.updateFieldIndicator();
  }

  private updateFieldIndicator(): void {
    if (!this.indicator) return;
    const index = this.probeY * this.simulation.width + this.probeX;
    const rawTemperature = this.simulation.temperature?.()[index];
    const pressure = this.simulation.pressure?.()[index];
    const temperature = rawTemperature ? (rawTemperature / 10 - 273.15).toFixed(1) + " °C" : "—";
    const pressureText = pressure === undefined ? "—" : (pressure >= 0 ? "+" : "") + pressure.toFixed(2);
    this.indicator.innerHTML = "<span><b>Pressure</b>" + pressureText + "</span><span><b>Temperature</b>" + temperature + "</span>";
  }

  private async downloadWorldFile(): Promise<boolean> {
    try {
      const file = exportWorldFile(this.simulation);
      const name = worldFileName(file.extension);
      const sharedFile = new File([file.bytes.slice().buffer], name, { type: file.mediaType });
      const shareData = { files: [sharedFile], title: 'AniforTPT save' };
      if (navigator.share && navigator.canShare?.(shareData)) {
        try {
          await navigator.share(shareData);
          return true;
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return false;
          // Platform or permission failures still get a normal file download.
        }
      }
      const href = URL.createObjectURL(sharedFile);
      const download = document.createElement('a');
      download.href = href;
      download.download = name;
      download.hidden = true;
      document.body.append(download);
      download.click();
      download.remove();
      window.setTimeout(() => URL.revokeObjectURL(href), 0);
      return true;
    } catch { return false; }
  }

  private async openWorldFile(file: File): Promise<boolean> {
    if (!file.size || file.size > MAX_WORLD_FILE_BYTES) return false;
    try {
      importWorldFile(this.simulation, new Uint8Array(await file.arrayBuffer()));
      history.replaceState(null, '', location.pathname + location.search);
      this.save();
      return true;
    } catch { return false; }
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
