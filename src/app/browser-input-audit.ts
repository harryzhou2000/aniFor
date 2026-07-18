import type { RendererBackendInfo } from '../renderer/field-renderer';
import type { Point, ViewState } from '../renderer/view-transform';

export interface BrowserInputAuditApi {
  readonly version: 1;
  readonly width: number;
  readonly height: number;
  cell(x: number, y: number): number;
  occupiedCells(): number;
  clear(): void;
  setRadius(radius: number): void;
  resetView(): void;
  screenToWorld(clientX: number, clientY: number): Point;
  screenToCell(clientX: number, clientY: number): Point;
  viewState(): ViewState;
  backend(): RendererBackendInfo;
}

declare global {
  interface Window { __ANIFOR_INPUT_AUDIT__?: BrowserInputAuditApi }
}

export function browserInputAuditRequested(search = globalThis.location?.search ?? ''): boolean {
  return new URLSearchParams(search).get('inputAudit') === '1';
}
