import type { GridPoint } from "../simulation/contracts";
import { rasterizeCircle } from "../simulation/raster";
import type { WorldBedGeometry } from "../renderer/camera";
import { PointerGestureState } from "./gesture-state";
import { rasterLine } from "./raster";

export type Tool = "wall" | "sand" | "water" | "fire" | "eraser";
export interface PaintIntent { readonly tool: Tool; readonly radius: number; readonly points: readonly GridPoint[]; }
export interface BrushPreview { readonly cells: readonly { readonly x: number; readonly y: number; readonly size: number }[]; }
export interface InputControllerOptions {
  readonly surface: HTMLElement;
  readonly getContentRect: () => DOMRectReadOnly;
  readonly camera: WorldBedGeometry;
  readonly getTool: () => Tool;
  readonly getBrushRadius: () => number;
  readonly onPaint: (intent: PaintIntent) => void;
  readonly onCameraChange?: () => void;
  readonly onBrushPreview?: (preview: BrushPreview | null) => void;
}

export interface InputController { destroy(): void; }

export function toBedLocalPoint(clientX: number, clientY: number, rect: Pick<DOMRectReadOnly, "left" | "top">): GridPoint {
  return { x: clientX - rect.left, y: clientY - rect.top };
}

export function buildBrushPreview(camera: WorldBedGeometry, point: GridPoint | null, radius: number): BrushPreview | null {
  if (!point) return null;
  const size = camera.cellScale;
  return { cells: rasterizeCircle(point.x, point.y, radius, 256, 192).map((cell) => {
    const center = camera.cellToCssCenter(cell.x, cell.y)!;
    return { x: center.x - size / 2, y: center.y - size / 2, size };
  }) };
}

/** Pointer capture protects a deterministic one-finger stroke from leaving the surface. */
export function mountInputController(options: InputControllerOptions): InputController {
  const gesture = new PointerGestureState();
  let lastPaint: GridPoint | null = null;
  const local = (event: PointerEvent): GridPoint => {
    const rect = options.getContentRect();
    return toBedLocalPoint(event.clientX, event.clientY, rect);
  };
  const preview = (point: GridPoint | null): void => options.onBrushPreview?.(buildBrushPreview(options.camera, point, options.getBrushRadius()));
  const paint = (event: PointerEvent): void => {
    const screenPoint = local(event);
    const point = options.camera.cssToCell(screenPoint.x, screenPoint.y);
    preview(point);
    if (!point) { lastPaint = null; return; }
    const segment = lastPaint ? rasterLine(lastPaint, point) : [point];
    lastPaint = point;
    options.onPaint({ tool: options.getTool(), radius: options.getBrushRadius(), points: segment });
  };
  const onDown = (event: PointerEvent): void => {
    try { options.surface.setPointerCapture(event.pointerId); } catch { /* detached surfaces cannot capture */ }
    const action = gesture.begin(event.pointerId, local(event));
    if (action === "paint") paint(event);
    if (action === "cancel-paint") { lastPaint = null; options.onBrushPreview?.(null); }
  };
  const onMove = (event: PointerEvent): void => {
    const action = gesture.move(event.pointerId, local(event));
    if (action === "paint") { paint(event); return; }
    if (action) {
      options.camera.pinch(action);
      options.onCameraChange?.();
      options.onBrushPreview?.(null);
    }
  };
  const end = (event: PointerEvent): void => {
    gesture.end(event.pointerId); lastPaint = null; options.onBrushPreview?.(null);
    try { if (options.surface.hasPointerCapture(event.pointerId)) options.surface.releasePointerCapture(event.pointerId); } catch { /* already released */ }
  };
  const cancelAll = (): void => {
    lastPaint = null; options.onBrushPreview?.(null);
    for (const id of gesture.cancel()) {
      try { if (options.surface.hasPointerCapture(id)) options.surface.releasePointerCapture(id); } catch { /* already released */ }
    }
  };
  const onKeyDown = (event: KeyboardEvent): void => { if (event.key === "Escape") cancelAll(); };
  options.surface.addEventListener("pointerdown", onDown);
  options.surface.addEventListener("pointermove", onMove);
  options.surface.addEventListener("pointerup", end);
  options.surface.addEventListener("pointercancel", end);
  options.surface.addEventListener("lostpointercapture", end);
  options.surface.addEventListener("keydown", onKeyDown);
  return { destroy: () => {
    options.surface.removeEventListener("pointerdown", onDown); options.surface.removeEventListener("pointermove", onMove);
    options.surface.removeEventListener("pointerup", end); options.surface.removeEventListener("pointercancel", end);
    options.surface.removeEventListener("lostpointercapture", end);
    options.surface.removeEventListener("keydown", onKeyDown);
    cancelAll();
  } };
}
