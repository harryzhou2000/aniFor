import type { Point, ViewportRect } from './view-transform';

export interface ElementBoxMetrics {
  readonly offsetWidth: number;
  readonly offsetHeight: number;
  readonly clientLeft: number;
  readonly clientTop: number;
  readonly clientWidth: number;
  readonly clientHeight: number;
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
