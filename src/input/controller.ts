import type { Camera } from "../app/contracts";
import type { GridPoint } from "../simulation/contracts";
import { PointerGestureState } from "./gesture-state";
import { rasterLine } from "./raster";

export type Tool = "wall" | "sand" | "water" | "fire" | "eraser";
export interface PaintIntent { readonly tool: Tool; readonly radius: number; readonly points: readonly GridPoint[]; }
export interface BrushPreview { readonly x: number; readonly y: number; readonly radius: number; }
export interface InputControllerOptions {
  readonly surface: HTMLElement;
  readonly camera: Camera;
  readonly getTool: () => Tool;
  readonly getBrushRadius: () => number;
  readonly onPaint: (intent: PaintIntent) => void;
  readonly onCameraChange?: () => void;
  readonly getCellScale?: () => number;
  readonly onBrushPreview?: (preview: BrushPreview | null) => void;
}

export interface InputController { destroy(): void; }

/** Pointer capture protects a deterministic one-finger stroke from leaving the surface. */
export function mountInputController(options: InputControllerOptions): InputController {
  const gesture = new PointerGestureState();
  let lastPaint: GridPoint | null = null;
  const local = (event: PointerEvent): GridPoint => {
    const rect = options.surface.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const preview = (screenPoint: GridPoint): void => options.onBrushPreview?.({
    x: screenPoint.x,
    y: screenPoint.y,
    radius: options.getBrushRadius() * (options.getCellScale?.() ?? 1),
  });
  const paint = (event: PointerEvent): void => {
    const screenPoint = local(event);
    const point = options.camera.screenToCell(screenPoint.x, screenPoint.y);
    const segment = lastPaint ? rasterLine(lastPaint, point) : [point];
    lastPaint = point;
    preview(screenPoint);
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
      options.camera.panBy(action.panX, action.panY);
      options.camera.zoomAt(action.center.x, action.center.y, action.zoom);
      options.onCameraChange?.();
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
