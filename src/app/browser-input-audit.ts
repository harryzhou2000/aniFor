import type { CanvasPresentationTiming, RendererBackendInfo } from '../renderer/field-renderer';
import type { WebGLPresentationTiming } from '../renderer/pixi-field-presenter';
import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';
import type { Point, ViewState } from '../renderer/view-transform';
import type { MaterialAtlasEntry } from './material-atlas-audit';

export interface BrowserInputAuditApi {
  readonly version: 1;
  readonly width: number;
  readonly height: number;
  cell(x: number, y: number): number;
  wall(x: number, y: number): number;
  temperature(x: number, y: number): number;
  sourceTarget(x: number, y: number): number;
  occupiedCells(): number;
  setGasFieldLighting(enabled: boolean): void;
  setGasVolumeChroma(enabled: boolean): void;
  setLiquidFieldLighting(enabled: boolean): void;
  setLiquidSilhouetteCohesion(enabled: boolean): void;
  setTranslucentFieldTransmission(enabled: boolean): void;
  setTranslucentBackdropRefraction(enabled: boolean): void;
  setSolidContactDepth(enabled: boolean): void;
  setTranslucentLensShell(enabled: boolean): void;
  setSolidCurvatureDepth(enabled: boolean): void;
  setSurfaceContourLighting(enabled: boolean): void;
  setSolidFieldLighting(enabled: boolean): void;
  setPhaseContactLighting(enabled: boolean): void;
  setThermalMaterialStyling(enabled: boolean): void;
  setEnergyCoreRelief(enabled: boolean): void;
  clear(): void;
  setRadius(radius: number): void;
  setMaterial(material: Material): void;
  resetView(): void;
  screenToWorld(clientX: number, clientY: number): Point;
  screenToCell(clientX: number, clientY: number): Point;
  viewState(): ViewState;
  backend(): RendererBackendInfo;
  prepareDenseSolidFixture(): void;
  prepareContourStressFixture(): void;
  toggleDenseSolidProbe(): void;
  materialAtlas(): readonly MaterialAtlasEntry[];
  prepareMaterialAtlas(): void;
  canvasPresentationTiming(): CanvasPresentationTiming | undefined;
  requestWebGLPresentationTimingSample(): boolean;
  webGLPresentationTiming(): WebGLPresentationTiming | undefined;
}

declare global {
  interface Window { __ANIFOR_INPUT_AUDIT__?: BrowserInputAuditApi }
}

export function browserInputAuditRequested(search = globalThis.location?.search ?? ''): boolean {
  return new URLSearchParams(search).get('inputAudit') === '1';
}

export function blankBrowserInputAuditRequested(search = globalThis.location?.search ?? ''): boolean {
  const parameters = new URLSearchParams(search);
  return parameters.get('inputAudit') === '1' && parameters.get('blankAudit') === '1';
}

/** Builds the full-grid steady-state Canvas workload used only by the browser audit. */
export function prepareDenseSolidAuditFixture(simulation: SimulationBackend): void {
  if (simulation.name !== 'TypeScript deterministic fallback') {
    throw new Error('Dense Canvas audit fixture requires the deterministic backend');
  }
  // DeterministicBackend.clear() marks every index dirty before this direct
  // fill, so the renderer observes the completed fixture on its next frame.
  simulation.clear();
  simulation.cells().fill(Material.Metal);
}

/**
 * Builds the production Canvas contour worst case used by the browser timer.
 * Every 32x32 chunk contains connected liquid while one-cell gaps keep the
 * analytic boundary path active instead of degenerating into a dense interior.
 */
export function prepareContourStressAuditFixture(simulation: SimulationBackend): void {
  if (simulation.name !== 'TypeScript deterministic fallback') {
    throw new Error('Canvas contour audit fixture requires the deterministic backend');
  }
  simulation.clear();
  const cells = simulation.cells();
  for (let y = 0; y < simulation.height; y++) for (let x = 0; x < simulation.width; x++) {
    if (x % 3 < 2 && y % 3 < 2) cells[y * simulation.width + x] = Material.Water;
  }
}

/** Changes one cell so a paused dense fixture presents another complete frame. */
export function toggleDenseSolidAuditProbe(simulation: SimulationBackend): void {
  const x = Math.floor(simulation.width / 2);
  const y = Math.floor(simulation.height / 2);
  const material = simulation.cells()[y * simulation.width + x] === Material.Metal
    ? Material.Glass
    : Material.Metal;
  simulation.paint(x, y, material, 0);
}
