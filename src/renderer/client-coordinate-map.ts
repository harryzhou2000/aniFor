import type { Point, ViewportRect } from './view-transform';

export interface ElementBoxMetrics {
  readonly offsetWidth: number;
  readonly offsetHeight: number;
  readonly clientLeft: number;
  readonly clientTop: number;
  readonly clientWidth: number;
  readonly clientHeight: number;
}

/** The layout-to-visual viewport transform exposed during browser page zoom. */
export interface VisualViewportMetrics {
  readonly scale: number;
  readonly offsetLeft: number;
  readonly offsetTop: number;
}

/**
 * Aligns PointerEvent client coordinates with DOMRect coordinates.
 *
 * Chrome's CDP page-scale path reports PointerEvent.clientX/Y in layout
 * coordinates while getBoundingClientRect() is expressed in the visual
 * viewport. At ordinary browser scale this is deliberately an exact no-op.
 * Backing resolution and device-pixel ratio never participate here.
 */
export function clientToVisualViewport(
  point: Point,
  viewport: VisualViewportMetrics | null | undefined = globalThis.visualViewport,
): Point {
  const rawScale = viewport?.scale ?? 1;
  const scale = Number.isFinite(rawScale) && rawScale > 0 ? rawScale : 1;
  const rawLeft = viewport?.offsetLeft ?? 0;
  const rawTop = viewport?.offsetTop ?? 0;
  const left = Number.isFinite(rawLeft) ? rawLeft : 0;
  const top = Number.isFinite(rawTop) ? rawTop : 0;
  return { x: (point.x - left) / scale, y: (point.y - top) / scale };
}

/** Resolves an element's CSS content box even when an ancestor applies scale. */
export function contentBoxFromBounds(bounds: ViewportRect, metrics: ElementBoxMetrics): ViewportRect {
  const scaleX = bounds.width / Math.max(1, metrics.offsetWidth);
  const scaleY = bounds.height / Math.max(1, metrics.offsetHeight);
  return {
    left: bounds.left + metrics.clientLeft * scaleX,
    top: bounds.top + metrics.clientTop * scaleY,
    width: metrics.clientWidth * scaleX,
    height: metrics.clientHeight * scaleY,
  };
}

/** Inverts the actual transformed canvas rectangle into logical world cells. */
export function clientToCanvasWorld(
  point: Point,
  canvasBounds: ViewportRect,
  worldWidth: number,
  worldHeight: number,
): Point {
  return {
    x: (point.x - canvasBounds.left) * worldWidth / Math.max(1, canvasBounds.width),
    y: (point.y - canvasBounds.top) * worldHeight / Math.max(1, canvasBounds.height),
  };
}

/** Projects one logical viewport point back into the transformed CSS content box. */
export function viewportToClient(
  point: Point,
  contentBounds: ViewportRect,
  viewportWidth: number,
  viewportHeight: number,
): Point {
  return {
    x: contentBounds.left + point.x * contentBounds.width / Math.max(1, viewportWidth),
    y: contentBounds.top + point.y * contentBounds.height / Math.max(1, viewportHeight),
  };
}
