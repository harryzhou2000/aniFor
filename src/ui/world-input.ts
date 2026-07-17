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

export class WorldInputController {
  private readonly pointers = new Map<number, PointerSample>();
  private gesture?: GestureStart;
  private paintingPointer?: number;
  private erasing = false;
  private longPress?: number;

  constructor(
    private readonly element: HTMLElement,
    private readonly viewport: WorldViewport,
    private readonly callbacks: WorldInputCallbacks,
  ) {
    element.addEventListener('contextmenu', (event) => event.preventDefault());
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
      const [a, b] = Array.from(this.pointers.values());
      this.gesture = { view: this.viewport.getViewState(), center: midpoint(a, b), distance: distance(a, b) };
      return;
    }

    this.paintingPointer = event.pointerId;
    this.erasing = event.button === 2;
    this.drawAt(event.clientX, event.clientY);
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
    this.drawAt(current.x, current.y);
  };

  private readonly onPointerEnd = (event: PointerEvent): void => {
    this.pointers.delete(event.pointerId);
    if (this.paintingPointer === event.pointerId) this.paintingPointer = undefined;
    this.cancelLongPress();
    if (this.pointers.size < 2) this.gesture = undefined;
  };

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const view = this.viewport.getViewState();
    const anchor = { x: event.clientX, y: event.clientY };
    this.viewport.applyGesture(view, anchor, anchor, Math.exp(-event.deltaY * 0.0015));
  };

  private drawAt(clientX: number, clientY: number): void {
    this.callbacks.draw(this.viewport.screenToCell(clientX, clientY), this.erasing);
  }

  private cancelLongPress(): void {
    if (this.longPress !== undefined) window.clearTimeout(this.longPress);
    this.longPress = undefined;
  }
}

function midpoint(a: Point, b: Point): Point { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
function distance(a: Point, b: Point): number { return Math.hypot(a.x - b.x, a.y - b.y); }
