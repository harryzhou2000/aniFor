import type { Camera } from "../app/contracts";
import type { GridPoint } from "../simulation/contracts";
import { rasterLine } from "./raster";

export type Tool = "wall" | "sand" | "water" | "fire" | "eraser";
export interface PaintIntent { readonly tool: Tool; readonly radius: number; readonly points: readonly GridPoint[]; }
export interface InputControllerOptions {
  readonly surface: HTMLElement;
  readonly camera: Camera;
  readonly getTool: () => Tool;
  readonly getBrushRadius: () => number;
  readonly onPaint: (intent: PaintIntent) => void;
  readonly onCameraChange?: () => void;
}

export interface InputController { destroy(): void; }

/** Pointer capture protects a deterministic one-finger stroke from leaving the surface. */
export function mountInputController(options: InputControllerOptions): InputController {
  const pointers = new Map<number, PointerEvent>();
  let lastPaint: GridPoint | null = null;
  let gesturing = false;
  let gestureCentroid: GridPoint | null = null;
  let gestureDistance = 0;
  const local = (event: PointerEvent): GridPoint => {
    const rect = options.surface.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const beginGesture = (): void => {
    gesturing = true; lastPaint = null;
    const pair = [...pointers.values()].slice(0, 2).map(local);
    gestureCentroid = { x: (pair[0].x + pair[1].x) / 2, y: (pair[0].y + pair[1].y) / 2 };
    gestureDistance = Math.hypot(pair[1].x - pair[0].x, pair[1].y - pair[0].y);
  };
  const paint = (event: PointerEvent): void => {
    const screenPoint = local(event);
    const point = options.camera.screenToCell(screenPoint.x, screenPoint.y);
    const segment = lastPaint ? rasterLine(lastPaint, point) : [point];
    lastPaint = point;
    options.onPaint({ tool: options.getTool(), radius: options.getBrushRadius(), points: segment });
  };
  const onDown = (event: PointerEvent): void => {
    pointers.set(event.pointerId, event);
    try { options.surface.setPointerCapture(event.pointerId); } catch { /* detached surfaces cannot capture */ }
    if (pointers.size === 1 && !gesturing) paint(event); else if (pointers.size === 2) beginGesture();
  };
  const onMove = (event: PointerEvent): void => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, event);
    if (!gesturing) { paint(event); return; }
    if (pointers.size < 2) return;
    const pair = [...pointers.values()].slice(0, 2).map(local);
    const centroid = { x: (pair[0].x + pair[1].x) / 2, y: (pair[0].y + pair[1].y) / 2 };
    const distance = Math.hypot(pair[1].x - pair[0].x, pair[1].y - pair[0].y);
    if (gestureCentroid && gestureDistance > 0) {
      options.camera.panBy(centroid.x - gestureCentroid.x, centroid.y - gestureCentroid.y);
      options.camera.zoomAt(centroid.x, centroid.y, distance / gestureDistance);
      options.onCameraChange?.();
    }
    gestureCentroid = centroid; gestureDistance = distance;
  };
  const end = (event: PointerEvent): void => {
    pointers.delete(event.pointerId); lastPaint = null;
    try { if (options.surface.hasPointerCapture(event.pointerId)) options.surface.releasePointerCapture(event.pointerId); } catch { /* already released */ }
    if (pointers.size === 0) { gesturing = false; gestureCentroid = null; gestureDistance = 0; }
  };
  options.surface.addEventListener("pointerdown", onDown);
  options.surface.addEventListener("pointermove", onMove);
  options.surface.addEventListener("pointerup", end);
  options.surface.addEventListener("pointercancel", end);
  options.surface.addEventListener("lostpointercapture", end);
  return { destroy: () => {
    options.surface.removeEventListener("pointerdown", onDown); options.surface.removeEventListener("pointermove", onMove);
    options.surface.removeEventListener("pointerup", end); options.surface.removeEventListener("pointercancel", end);
    options.surface.removeEventListener("lostpointercapture", end);
  } };
}
