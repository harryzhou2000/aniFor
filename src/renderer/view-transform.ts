export interface Point { readonly x: number; readonly y: number }
export interface ViewState { readonly zoom: number; readonly panX: number; readonly panY: number }
export interface ViewportRect { readonly left: number; readonly top: number; readonly width: number; readonly height: number }

/** Fits a fixed-aspect surface inside the available viewport without stretching it. */
export function fitAspect(width: number, height: number, aspect: number): { width: number; height: number } {
  const availableWidth = Math.max(1, width);
  const availableHeight = Math.max(1, height);
  const safeAspect = Math.max(Number.EPSILON, aspect);
  const fittedWidth = Math.min(availableWidth, availableHeight * safeAspect);
  return { width: fittedWidth, height: fittedWidth / safeAspect };
}

export function clientToViewport(point: Point, rect: ViewportRect, viewportWidth: number, viewportHeight: number): Point {
  return {
    x: (point.x - rect.left) * Math.max(1, viewportWidth) / Math.max(1, rect.width),
    y: (point.y - rect.top) * Math.max(1, viewportHeight) / Math.max(1, rect.height),
  };
}

export class ViewTransform {
  private viewportWidth = 1;
  private viewportHeight = 1;
  private fitScale = 1;
  private state: ViewState = { zoom: 1, panX: 0, panY: 0 };

  constructor(private readonly worldWidth: number, private readonly worldHeight: number) {}

  resize(width: number, height: number): void {
    const previousFitScale = this.fitScale;
    this.viewportWidth = Math.max(1, width);
    this.viewportHeight = Math.max(1, height);
    this.fitScale = Math.min(this.viewportWidth / this.worldWidth, this.viewportHeight / this.worldHeight);
    const resizeRatio = this.fitScale / Math.max(Number.EPSILON, previousFitScale);
    this.state = this.clamp({
      ...this.state,
      panX: this.state.panX * resizeRatio,
      panY: this.state.panY * resizeRatio,
    });
  }

  snapshot(): ViewState { return { ...this.state }; }

  applyGesture(start: ViewState, anchorStart: Point, anchorCurrent: Point, ratio: number): void {
    const startScale = this.fitScale * start.zoom;
    const startPosition = this.positionFor(start);
    const worldAnchor = {
      x: (anchorStart.x - startPosition.x) / startScale,
      y: (anchorStart.y - startPosition.y) / startScale,
    };
    const zoom = Math.max(1, Math.min(5, start.zoom * ratio));
    const scale = this.fitScale * zoom;
    const baseX = (this.viewportWidth - this.worldWidth * scale) / 2;
    const baseY = (this.viewportHeight - this.worldHeight * scale) / 2;
    this.state = this.clamp({
      zoom,
      panX: anchorCurrent.x - worldAnchor.x * scale - baseX,
      panY: anchorCurrent.y - worldAnchor.y * scale - baseY,
    });
  }

  reset(): void { this.state = { zoom: 1, panX: 0, panY: 0 }; }
  get scale(): number { return this.fitScale * this.state.zoom; }
  get position(): Point { return this.positionFor(this.state); }

  viewportToWorld(point: Point): Point {
    const position = this.position;
    return { x: (point.x - position.x) / this.scale, y: (point.y - position.y) / this.scale };
  }

  worldToViewport(point: Point): Point {
    const position = this.position;
    return { x: position.x + point.x * this.scale, y: position.y + point.y * this.scale };
  }

  private positionFor(state: ViewState): Point {
    const scale = this.fitScale * state.zoom;
    return {
      x: (this.viewportWidth - this.worldWidth * scale) / 2 + state.panX,
      y: (this.viewportHeight - this.worldHeight * scale) / 2 + state.panY,
    };
  }

  private clamp(state: ViewState): ViewState {
    const scale = this.fitScale * state.zoom;
    const maxPanX = Math.max(0, (this.worldWidth * scale - this.viewportWidth) / 2);
    const maxPanY = Math.max(0, (this.worldHeight * scale - this.viewportHeight) / 2);
    return {
      zoom: state.zoom,
      panX: Math.max(-maxPanX, Math.min(maxPanX, state.panX)),
      panY: Math.max(-maxPanY, Math.min(maxPanY, state.panY)),
    };
  }
}
