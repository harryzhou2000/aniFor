import { MaterialRenderer } from '../renderer/field-renderer';
import { applyRenderLabScene, renderLabRequested } from '../renderer/render-lab-scene';
import { applyWallLabScene, wallLabRequested } from '../renderer/wall-lab-scene';
import { ALL_MATERIALS, MATERIALS, Material } from '../shared/materials';
import { decodeSharedWorld } from '../shared/share-codec';
import { exportWorldFile, importWorldFile, MAX_WORLD_FILE_BYTES, worldFileName } from '../shared/world-file';
import type { SimulationBackend } from '../simulation';
import { mountControls } from '../ui/controls';
import { NativeSignEditor, NativeSignOverlay, hitTestNativeSign } from '../ui/native-signs';
import {
  buildToolCatalog, type LifeToolInfo, type SignToolInfo, type SimToolInfo,
  type SourceToolInfo, type WallToolInfo,
} from '../ui/tool-catalog';
import { WorldInputController } from '../ui/world-input';
import { drawToolPoint, drawToolSegment } from './tool-dispatch';
import {
  blankBrowserInputAuditRequested, browserInputAuditRequested,
  prepareContourStressAuditFixture, prepareDenseSolidAuditFixture,
  prepareSolidFieldLightingAuditFixture, prepareSolidOpticalDepthAuditFixture,
  toggleDenseSolidAuditProbe,
} from './browser-input-audit';
import { navigateToRenderScale } from './render-scale-navigation';
import {
  MATERIAL_ATLAS, materialAtlasAuditRequested, prepareMaterialAtlasAuditFixture,
} from './material-atlas-audit';

const AUTOSAVE_KEY = 'stillroom-world-v1';

export class Game {
  private readonly simulation: SimulationBackend;
  private readonly renderer: MaterialRenderer;
  private material = Material.Sand;
  private wallTool?: WallToolInfo;
  private simulationTool?: SimToolInfo;
  private sourceTool?: SourceToolInfo;
  private lifeTool?: LifeToolInfo;
  private signTool?: SignToolInfo;
  private signOverlay?: NativeSignOverlay;
  private signEditor?: NativeSignEditor;
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
      if (materialAtlasAuditRequested()) prepareMaterialAtlasAuditFixture(this.simulation);
      else if (blankBrowserInputAuditRequested()) this.simulation.clear();
      else applyRenderLabScene(this.simulation);
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
    if (this.simulation.signs && this.simulation.upsertSign && this.simulation.removeSign) {
      this.signOverlay = new NativeSignOverlay(viewport, this.simulation, this.renderer);
      this.signEditor = new NativeSignEditor(this.simulation);
    }
    new WorldInputController(viewport, this.renderer, {
      draw: ({ x, y }, erase) => {
        erase ||= this.eraseMode;
        if (this.signTool) {
          this.handleSignPoint({ x, y }, erase);
          return;
        }
        drawToolPoint(this.simulation, { x, y }, {
          material: this.material, wallTool: this.wallTool,
          simulationTool: this.simulationTool, sourceTool: this.sourceTool,
          lifeTool: this.lifeTool, signTool: this.signTool,
          radius: this.radius,
        }, erase);
      },
      drawSegment: (start, end, erase) => {
        erase ||= this.eraseMode;
        drawToolSegment(this.simulation, start, end, {
          material: this.material, wallTool: this.wallTool,
          simulationTool: this.simulationTool, sourceTool: this.sourceTool,
          lifeTool: this.lifeTool, signTool: this.signTool,
          radius: this.radius,
        }, erase);
      },
    });
    this.mountFieldIndicator(viewport);
    const toolbox = this.root.querySelector<HTMLElement>('.toolbox');
    if (!toolbox) throw new Error('Missing simulation toolbox');
    mountControls(toolbox, {
      onMaterial: (material) => {
        this.material = material;
        this.wallTool = undefined;
        this.simulationTool = undefined;
        this.sourceTool = undefined;
        this.lifeTool = undefined;
        this.signTool = undefined;
      },
      onRadius: (radius) => { this.radius = radius; },
      onPause: () => { this.paused = !this.paused; },
      onEraseMode: (erase) => { this.eraseMode = erase; },
      onPowderRenderStyle: (style) => { this.renderer.setPowderRenderStyle(style); },
      onRenderScale: (scale) => {
        navigateToRenderScale(scale, {
          currentUrl: location.href,
          diagnosticScene: renderLab || wallLab,
          persist: () => this.save(),
          assign: (href) => { location.assign(href); },
        });
      },
      canConfigureSource: (source, target) => this.simulation.canConfigureSource?.(source, target) ?? false,
      onSaveFile: () => this.downloadWorldFile(),
      onOpenFile: (file) => this.openWorldFile(file),
      onClear: () => { this.simulation.clear(); localStorage.removeItem(AUTOSAVE_KEY); },
      onTool: (tool) => {
        if (tool.kind === 'wall') {
          this.wallTool = tool;
          this.simulationTool = undefined;
          this.sourceTool = undefined;
          this.lifeTool = undefined;
          this.signTool = undefined;
        }
        else if (tool.kind === 'force' || tool.kind === 'thermal' || tool.kind === 'utility') {
          this.simulationTool = tool;
          this.wallTool = undefined;
          this.sourceTool = undefined;
          this.lifeTool = undefined;
          this.signTool = undefined;
        } else if (tool.kind === 'source') {
          this.sourceTool = tool;
          this.wallTool = undefined;
          this.simulationTool = undefined;
          this.lifeTool = undefined;
          this.signTool = undefined;
        } else if (tool.kind === 'life') {
          this.lifeTool = tool;
          this.wallTool = undefined;
          this.simulationTool = undefined;
          this.sourceTool = undefined;
          this.signTool = undefined;
        } else if (tool.kind === 'sign') {
          this.signTool = tool;
          this.wallTool = undefined;
          this.simulationTool = undefined;
          this.sourceTool = undefined;
          this.lifeTool = undefined;
        }
      },
    }, buildToolCatalog(MATERIALS, {
      walls: Boolean(this.simulation.paintWall && this.simulation.eraseWall),
      simulationTools: Boolean(this.simulation.applySimulationTool),
      configuredSources: Boolean(
        this.simulation.paintConfiguredSource && this.simulation.canConfigureSource
          && this.simulation.configuredSourceTargetAt,
      ),
      lifePresets: Boolean(this.simulation.paintLifePreset),
      signs: Boolean(this.simulation.signs && this.simulation.upsertSign && this.simulation.removeSign),
    }));
    if (renderLab || wallLab) {
      const status = this.root.querySelector('.status');
      const sceneName = renderLab ? 'render lab' : 'native wall lab';
      if (status) status.textContent = `${this.simulation.name} · paused ${sceneName}`;
    } else {
      this.seedIfEmpty();
      window.setInterval(() => this.save(), 4000);
    }
    if (renderLab && browserInputAuditRequested()) this.installBrowserInputAudit();
    requestAnimationFrame(this.frame);
  }

  private installBrowserInputAudit(): void {
    this.material = Material.Sand;
    this.wallTool = undefined;
    this.simulationTool = undefined;
    this.sourceTool = undefined;
    this.lifeTool = undefined;
    this.signTool = undefined;
    this.eraseMode = false;
    this.radius = 0;
    this.renderer.resetView();
    this.renderer.enableCanvasPresentationTiming();
    this.renderer.enableWebGLPresentationTiming();
    this.root.dataset.inputAudit = 'ready';
    window.__ANIFOR_INPUT_AUDIT__ = {
      version: 1,
      width: this.simulation.width,
      height: this.simulation.height,
      cell: (x, y) => {
        if (x < 0 || y < 0 || x >= this.simulation.width || y >= this.simulation.height) return -1;
        return this.simulation.cells()[y * this.simulation.width + x];
      },
      wall: (x, y) => {
        if (x < 0 || y < 0 || x >= this.simulation.width || y >= this.simulation.height) return -1;
        return this.simulation.walls?.()[y * this.simulation.width + x] ?? 0;
      },
      temperature: (x, y) => {
        if (x < 0 || y < 0 || x >= this.simulation.width || y >= this.simulation.height) return -1;
        return this.simulation.temperature?.()[y * this.simulation.width + x] ?? -1;
      },
      sourceTarget: (x, y) => this.simulation.configuredSourceTargetAt?.(x, y) ?? Material.Empty,
      presentationAuxiliary: (x, y) => this.renderer.presentationAuxiliaryAt(x, y),
      occupiedCells: () => {
        let occupied = 0;
        for (const material of this.simulation.cells()) if (material !== Material.Empty) occupied++;
        return occupied;
      },
      setGasFieldLighting: (enabled) => { this.renderer.setGasFieldLightingEnabled(enabled); },
      setGasVolumeChroma: (enabled) => { this.renderer.setGasVolumeChromaEnabled(enabled); },
      setEmissionVolumeChroma: (enabled) => {
        this.renderer.setEmissionVolumeChromaEnabled(enabled);
      },
      setLiquidFieldLighting: (enabled) => { this.renderer.setLiquidFieldLightingEnabled(enabled); },
      setLiquidSilhouetteCohesion: (enabled) => {
        this.renderer.setLiquidSilhouetteCohesionEnabled(enabled);
      },
      setLiquidVolumeChroma: (enabled) => {
        this.renderer.setLiquidVolumeChromaEnabled(enabled);
      },
      setLiquidOpticalDepth: (enabled) => {
        this.renderer.setLiquidOpticalDepthEnabled(enabled);
      },
      setSolidOpticalDepth: (enabled) => {
        this.renderer.setSolidOpticalDepthEnabled(enabled);
      },
      setTranslucentFieldTransmission: (enabled) => {
        this.renderer.setTranslucentFieldTransmissionEnabled(enabled);
      },
      setTranslucentBackdropRefraction: (enabled) => {
        this.renderer.setTranslucentBackdropRefractionEnabled(enabled);
      },
      setSolidContactDepth: (enabled) => {
        this.renderer.setSolidContactDepthEnabled(enabled);
      },
      setTranslucentLensShell: (enabled) => {
        this.renderer.setTranslucentLensShellEnabled(enabled);
      },
      setSolidCurvatureDepth: (enabled) => {
        this.renderer.setSolidCurvatureDepthEnabled(enabled);
      },
      setSurfaceContourLighting: (enabled) => {
        this.renderer.setSurfaceContourLightingEnabled(enabled);
      },
      setSolidFieldLighting: (enabled) => {
        this.renderer.setSolidFieldLightingEnabled(enabled);
      },
      setRoleMaterialStyling: (enabled) => {
        this.renderer.setRoleMaterialStylingEnabled(enabled);
      },
      setCellularMaterialStyling: (enabled) => {
        this.renderer.setCellularMaterialStylingEnabled(enabled);
      },
      setPhaseContactLighting: (enabled) => {
        this.renderer.setPhaseContactLightingEnabled(enabled);
      },
      setThermalMaterialStyling: (enabled) => {
        this.renderer.setThermalMaterialStylingEnabled(enabled);
      },
      setEnergyCoreRelief: (enabled) => {
        this.renderer.setEnergyCoreReliefEnabled(enabled);
      },
      setPowderBodyDepth: (enabled) => {
        this.renderer.setPowderBodyDepthEnabled(enabled);
      },
      clear: () => { this.simulation.clear(); },
      setRadius: (radius) => { this.radius = Math.max(0, Math.min(64, Math.round(radius))); },
      setMaterial: (material) => {
        if (!ALL_MATERIALS.some(({ id }) => id === material)) throw new Error(`Unknown audit material ${material}`);
        this.material = material;
        this.wallTool = undefined;
        this.simulationTool = undefined;
        this.sourceTool = undefined;
        this.lifeTool = undefined;
        this.signTool = undefined;
        this.eraseMode = false;
      },
      resetView: () => { this.renderer.resetView(); },
      screenToWorld: (clientX, clientY) => this.renderer.screenToWorld(clientX, clientY),
      screenToCell: (clientX, clientY) => this.renderer.screenToCell(clientX, clientY),
      viewState: () => this.renderer.getViewState(),
      backend: () => this.renderer.getBackendInfo(),
      prepareDenseSolidFixture: () => { prepareDenseSolidAuditFixture(this.simulation); },
      prepareSolidOpticalDepthFixture: () => {
        prepareSolidOpticalDepthAuditFixture(this.simulation);
      },
      prepareSolidFieldLightingFixture: () => {
        prepareSolidFieldLightingAuditFixture(this.simulation);
      },
      prepareContourStressFixture: () => { prepareContourStressAuditFixture(this.simulation); },
      toggleDenseSolidProbe: () => { toggleDenseSolidAuditProbe(this.simulation); },
      materialAtlas: () => MATERIAL_ATLAS,
      prepareMaterialAtlas: () => { prepareMaterialAtlasAuditFixture(this.simulation); },
      canvasPresentationTiming: () => this.renderer.getCanvasPresentationTiming(),
      requestWebGLPresentationTimingSample: () => this.renderer.requestWebGLPresentationTimingSample(),
      webGLPresentationTiming: () => this.renderer.getWebGLPresentationTiming(),
      forceEightXRenderStall: () => this.renderer.forceEightXRenderStallForAudit(),
    };
  }

  private readonly frame = (time: number): void => {
    const elapsed = Math.min(time - this.lastFrame, 80);
    this.lastFrame = time;
    if (!this.paused) {
      this.accumulator += elapsed;
      while (this.accumulator >= 1000 / 60) { this.simulation.step(); this.accumulator -= 1000 / 60; }
    }
    this.renderer.render(time, this.root.dataset.inputAudit === 'ready' ? 1_000 : time);
    this.signOverlay?.render(time);
    if (time - this.lastIndicatorUpdate >= 100) {
      this.lastIndicatorUpdate = time;
      this.updateFieldIndicator();
    }
    requestAnimationFrame(this.frame);
  };

  private handleSignPoint(point: { x: number; y: number }, erase: boolean): void {
    if (!this.signEditor || this.signEditor.isOpen) return;
    if (point.x < 0 || point.y < 0
      || point.x >= this.simulation.width || point.y >= this.simulation.height) return;
    const existing = hitTestNativeSign(this.simulation.signs?.() ?? [], point);
    if (erase) {
      if (existing) this.simulation.removeSign?.(existing.index);
      return;
    }
    this.signEditor.open(point, existing);
  }


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
    const sourceTarget = this.simulation.configuredSourceTargetAt?.(this.probeX, this.probeY);
    const sourceText = sourceTarget === undefined ? ''
      : `<span class="source-target"><b>Source target</b>${materialLabel(sourceTarget)}</span>`;
    const renderer = this.renderer.getBackendInfo();
    this.indicator.dataset.renderer = renderer.backend;
    this.indicator.dataset.rendererReason = renderer.reason ?? '';
    const scaleCapped = renderer.outputScale !== undefined
      && renderer.requestedOutputScale !== undefined
      && renderer.outputScale < renderer.requestedOutputScale;
    this.indicator.title = renderer.reason ? rendererReason(renderer.reason)
      : scaleCapped
        ? `Semantic WebGL renderer; ${renderer.requestedOutputScale}× request safely capped to ${renderer.outputScale}×`
        : 'Semantic WebGL renderer';
    this.indicator.innerHTML = "<span><b>Pressure</b>" + pressureText
      + "</span><span><b>Temperature</b>" + temperature
      + "</span><span class=\"renderer-indicator\"><b>Backend</b>" + rendererStatus(renderer) + "</span>"
      + sourceText;
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

function materialLabel(material: Material): string {
  return ALL_MATERIALS.find(({ id }) => id === material)?.name ?? `Element ${material}`;
}

function rendererReason(reason: NonNullable<ReturnType<MaterialRenderer['getBackendInfo']>['reason']>): string {
  if (reason === 'forced') return 'Canvas2D forced by the renderer query override';
  if (reason === 'webgl-unavailable') return 'Canvas2D because WebGL is unavailable';
  if (reason === 'webgl-starting') return 'Canvas2D while the WebGL renderer starts';
  if (reason === 'webgl-timeout') return 'Canvas2D because WebGL initialization timed out';
  if (reason === 'webgl-context-lost') return 'Canvas2D because the active WebGL context was lost';
  return 'Canvas2D because WebGL initialization failed';
}

function rendererStatus(renderer: ReturnType<MaterialRenderer['getBackendInfo']>): string {
  const scale = renderer.outputScale === undefined ? '' : ` · ${renderer.outputScale}×`;
  const capped = renderer.outputScale !== undefined && renderer.requestedOutputScale !== undefined
    && renderer.outputScale < renderer.requestedOutputScale
    ? ` (${renderer.requestedOutputScale}× capped)` : '';
  const base = renderer.label + scale + capped;
  if (renderer.backend === 'webgl') return base;
  if (renderer.reason === 'webgl-starting') return `${base} · starting WebGL`;
  if (renderer.reason === 'webgl-timeout') return `${base} · WebGL timeout`;
  if (renderer.reason === 'webgl-unavailable') return `${base} · WebGL unavailable`;
  if (renderer.reason === 'webgl-error') return `${base} · WebGL error`;
  if (renderer.reason === 'webgl-context-lost') return `${base} · WebGL context lost`;
  if (renderer.reason === 'forced') return `${base} · forced`;
  return base;
}
