import type { CanvasPresentationTiming, RendererBackendInfo } from '../renderer/field-renderer';
import type { WebGLPresentationTiming } from '../renderer/pixi-field-presenter';
import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';
import type { Point, ViewState } from '../renderer/view-transform';

export interface BrowserInputAuditApi {
  readonly version: 1;
  readonly width: number;
  readonly height: number;
  cell(x: number, y: number): number;
  wall(x: number, y: number): number;
  sourceTarget(x: number, y: number): number;
  occupiedCells(): number;
  setGasFieldLighting(enabled: boolean): void;
  setLiquidFieldLighting(enabled: boolean): void;
  setTranslucentFieldTransmission(enabled: boolean): void;
  setTranslucentBackdropRefraction(enabled: boolean): void;
  setSolidContactDepth(enabled: boolean): void;
  setTranslucentLensShell(enabled: boolean): void;
  setSolidCurvatureDepth(enabled: boolean): void;
  clear(): void;
  setRadius(radius: number): void;
  setMaterial(material: Material): void;
  resetView(): void;
  screenToWorld(clientX: number, clientY: number): Point;
  screenToCell(clientX: number, clientY: number): Point;
  viewState(): ViewState;
  backend(): RendererBackendInfo;
  prepareDenseSolidFixture(): void;
  toggleDenseSolidProbe(): void;
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

/** Changes one cell so a paused dense fixture presents another complete frame. */
export function toggleDenseSolidAuditProbe(simulation: SimulationBackend): void {
  const x = Math.floor(simulation.width / 2);
  const y = Math.floor(simulation.height / 2);
  const material = simulation.cells()[y * simulation.width + x] === Material.Metal
    ? Material.Glass
    : Material.Metal;
  simulation.paint(x, y, material, 0);
}
