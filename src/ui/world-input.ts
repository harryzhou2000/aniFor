import type { Point, ViewState } from '../renderer/view-transform';

interface PointerSample extends Point {
  readonly startX: number;
  readonly startY: number;
  readonly pointerType: string;
}

interface GestureStart {
  readonly view: ViewState;
  readonly center: Point;
  readonly distance: number;
}

export interface WorldViewport {
  screenToCell(clientX: number, clientY: number): Point;
  getViewState(): ViewState;
  applyGesture(start: ViewState, anchorStart: Point, anchorCurrent: Point, ratio: number): void;
  resetView(): void;
}

export interface WorldInputCallbacks {
  draw(cell: Point, erase: boolean): void;
}

export function wheelZoomRatio(deltaY: number, deltaMode: number, viewportHeight: number): number {
  const pixels = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? Math.max(1, viewportHeight) : 1);
  return Math.exp(-Math.max(-240, Math.min(240, pixels)) * 0.002);
}

export class WorldInputController {
  private readonly pointers = new Map<number, PointerSample>();
  private gesture?: GestureStart;
  private paintingPointer?: number;
  private lastPaintCell?: Point;
  private erasing = false;
  private longPress?: number;

  constructor(
    private readonly element: HTMLElement,
    private readonly viewport: WorldViewport,
    private readonly callbacks: WorldInputCallbacks,
  ) {
    element.addEventListener('contextmenu', (event) => event.preventDefault());
    element.addEventListener('dragstart', (event) => event.preventDefault());
    element.addEventListener('pointerdown', this.onPointerDown);
    element.addEventListener('pointermove', this.onPointerMove);
    element.addEventListener('pointerup', this.onPointerEnd);
    element.addEventListener('pointercancel', this.onPointerEnd);
    element.addEventListener('wheel', this.onWheel, { passive: false });
    element.addEventListener('dblclick', () => viewport.resetView());
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.element.setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId, {
      x: event.clientX, y: event.clientY,
      startX: event.clientX, startY: event.clientY,
      pointerType: event.pointerType,
    });

    if (this.pointers.size >= 2) {
      this.cancelLongPress();
      this.paintingPointer = undefined;
      this.lastPaintCell = undefined;
      const [a, b] = Array.from(this.pointers.values());
      this.gesture = { view: this.viewport.getViewState(), center: midpoint(a, b), distance: distance(a, b) };
      return;
    }

    this.paintingPointer = event.pointerId;
    this.erasing = event.button === 2;
    this.lastPaintCell = this.drawAt(event.clientX, event.clientY);
    if (event.pointerType === 'touch') {
      this.longPress = window.setTimeout(() => {
        const pointer = this.pointers.get(event.pointerId);
        if (!pointer || this.pointers.size !== 1) return;
        this.erasing = true;
        navigator.vibrate?.(15);
        this.drawAt(pointer.x, pointer.y);
      }, 480);
    }
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const previous = this.pointers.get(event.pointerId);
    if (!previous) return;
    const current = { ...previous, x: event.clientX, y: event.clientY };
    this.pointers.set(event.pointerId, current);

    if (this.gesture && this.pointers.size >= 2) {
      const [a, b] = Array.from(this.pointers.values());
      this.viewport.applyGesture(
        this.gesture.view,
        this.gesture.center,
        midpoint(a, b),
        distance(a, b) / Math.max(1, this.gesture.distance),
      );
      return;
    }

    if (this.paintingPointer !== event.pointerId) return;
    if (Math.hypot(current.x - current.startX, current.y - current.startY) > 8) this.cancelLongPress();
    this.drawStrokeTo(current.x, current.y);
  };

  private readonly onPointerEnd = (event: PointerEvent): void => {
    this.pointers.delete(event.pointerId);
    if (this.paintingPointer === event.pointerId) {
      this.paintingPointer = undefined;
      this.lastPaintCell = undefined;
    }
    this.cancelLongPress();
    if (this.pointers.size < 2) this.gesture = undefined;
  };

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    const view = this.viewport.getViewState();
    const anchor = { x: event.clientX, y: event.clientY };
    const ratio = wheelZoomRatio(event.deltaY, event.deltaMode, this.element.clientHeight);
    this.element.dataset.lastWheel = `${event.deltaY}:${ratio}`;
    this.viewport.applyGesture(view, anchor, anchor, ratio);
  };

  private drawAt(clientX: number, clientY: number): Point {
    const cell = this.viewport.screenToCell(clientX, clientY);
    this.callbacks.draw(cell, this.erasing);
    return cell;
  }

  private drawStrokeTo(clientX: number, clientY: number): void {
    const end = this.viewport.screenToCell(clientX, clientY);
    const start = this.lastPaintCell ?? end;
    visitGridLine(start, end, (cell) => this.callbacks.draw(cell, this.erasing));
    this.lastPaintCell = end;
  }

  private cancelLongPress(): void {
    if (this.longPress !== undefined) window.clearTimeout(this.longPress);
    this.longPress = undefined;
  }
}

function midpoint(a: Point, b: Point): Point { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
function distance(a: Point, b: Point): number { return Math.hypot(a.x - b.x, a.y - b.y); }

export function visitGridLine(start: Point, end: Point, visit: (point: Point) => void): void {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const steps = Math.max(Math.abs(deltaX), Math.abs(deltaY));
  if (steps === 0) { visit(end); return; }
  for (let step = 1; step <= steps; step++) {
    const progress = step / steps;
    visit({ x: Math.round(start.x + deltaX * progress), y: Math.round(start.y + deltaY * progress) });
  }
}
