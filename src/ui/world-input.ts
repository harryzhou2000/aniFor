import type { Point, ViewState } from '../renderer/view-transform';

interface PointerSample extends Point { readonly pointerType: string }
const TOUCH_PAINT_ACTIVATION_DISTANCE = 6;

type Interaction =
  | { readonly kind: 'paint'; readonly pointerId: number; readonly erase: boolean; lastCell: Point; started: boolean; readonly tapEligible: boolean; readonly origin: Point }
  | { readonly kind: 'pan'; readonly pointerId: number; readonly view: ViewState; readonly start: Point }
  | { readonly kind: 'pinch'; readonly pointerIds: readonly [number, number]; readonly view: ViewState; readonly center: Point; readonly distance: number };

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
  private interaction?: Interaction;

  constructor(
    private readonly element: HTMLElement,
    private readonly viewport: WorldViewport,
    private readonly callbacks: WorldInputCallbacks,
  ) {
    element.addEventListener('contextmenu', (event) => event.preventDefault());
    element.addEventListener('dragstart', (event) => event.preventDefault());
    element.addEventListener('pointerdown', this.onPointerDown);
    element.addEventListener('pointermove', this.onPointerMove);
    element.addEventListener('pointerup', this.onPointerUp);
    element.addEventListener('pointercancel', this.onPointerAbort);
    element.addEventListener('lostpointercapture', this.onPointerAbort);
    element.addEventListener('auxclick', (event) => { if (event.button === 1) event.preventDefault(); });
    element.addEventListener('wheel', this.onWheel, { passive: false });
    element.addEventListener('dblclick', () => viewport.resetView());
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    const isTouch = event.pointerType === 'touch';
    const isPan = event.pointerType === 'mouse' && event.button === 1;
    const isPaint = !isTouch && (event.button === 0 || event.button === 2);
    if ((!isTouch && !isPan && !isPaint) || (!isTouch && this.interaction)) return;

    event.preventDefault();
    this.element.setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId, {
      x: event.clientX, y: event.clientY,
      pointerType: event.pointerType,
    });

    if (isTouch) {
      const touchCount = Array.from(this.pointers.values()).filter(({ pointerType }) => pointerType === 'touch').length;
      if (touchCount >= 2) this.rebaseTouchNavigation();
      else {
        this.setInteraction({
          kind: 'paint', pointerId: event.pointerId, erase: false,
          lastCell: this.viewport.screenToCell(event.clientX, event.clientY),
          started: false, tapEligible: true, origin: { x: event.clientX, y: event.clientY },
        });
      }
      return;
    }

    if (isPan) this.setInteraction({ kind: 'pan', pointerId: event.pointerId, view: this.viewport.getViewState(), start: { x: event.clientX, y: event.clientY } });
    else {
      const erase = event.button === 2;
      this.setInteraction({
        kind: 'paint', pointerId: event.pointerId, erase,
        lastCell: this.drawAt(event.clientX, event.clientY, erase),
        started: true, tapEligible: false, origin: { x: event.clientX, y: event.clientY },
      });
    }
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const previous = this.pointers.get(event.pointerId);
    if (!previous) return;
    const current = { ...previous, x: event.clientX, y: event.clientY };
    this.pointers.set(event.pointerId, current);

    const interaction = this.interaction;
    if (!interaction) return;
    if (interaction.kind === 'pinch') {
      if (!interaction.pointerIds.includes(event.pointerId)) return;
      const a = this.pointers.get(interaction.pointerIds[0]);
      const b = this.pointers.get(interaction.pointerIds[1]);
      if (!a || !b) return;
      this.viewport.applyGesture(
        interaction.view,
        interaction.center,
        midpoint(a, b),
        distance(a, b) / Math.max(1, interaction.distance),
      );
      return;
    }
    if (interaction.pointerId !== event.pointerId) return;
    if (interaction.kind === 'pan') this.viewport.applyGesture(interaction.view, interaction.start, current, 1);
    else this.drawStrokeTo(current.x, current.y, interaction);
  };

  private readonly onPointerUp = (event: PointerEvent): void => { this.finishPointer(event, true); };
  private readonly onPointerAbort = (event: PointerEvent): void => { this.finishPointer(event, false); };

  private finishPointer(event: PointerEvent, commitTap: boolean): void {
    if (!this.pointers.has(event.pointerId)) return;
    const interaction = this.interaction;
    if (commitTap && interaction?.kind === 'paint' && interaction.pointerId === event.pointerId && !interaction.started && interaction.tapEligible) {
      this.callbacks.draw(interaction.lastCell, interaction.erase);
    }
    this.pointers.delete(event.pointerId);
    if (!interaction) return;
    const endedActivePointer = interaction.kind === 'pinch'
      ? interaction.pointerIds.includes(event.pointerId)
      : interaction.pointerId === event.pointerId;
    if (!endedActivePointer) return;
    if (event.pointerType === 'touch' || interaction.kind === 'pinch') this.rebaseTouchNavigation();
    else this.setInteraction(undefined);
  }

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    const view = this.viewport.getViewState();
    const anchor = { x: event.clientX, y: event.clientY };
    const ratio = wheelZoomRatio(event.deltaY, event.deltaMode, this.element.clientHeight);
    this.element.dataset.lastWheel = `${event.deltaY}:${ratio}`;
    this.viewport.applyGesture(view, anchor, anchor, ratio);
  };

  private drawAt(clientX: number, clientY: number, erase: boolean): Point {
    const cell = this.viewport.screenToCell(clientX, clientY);
    this.callbacks.draw(cell, erase);
    return cell;
  }

  private drawStrokeTo(clientX: number, clientY: number, interaction: Extract<Interaction, { kind: 'paint' }>): void {
    const end = this.viewport.screenToCell(clientX, clientY);
    if (!interaction.started) {
      if (Math.hypot(clientX - interaction.origin.x, clientY - interaction.origin.y) < TOUCH_PAINT_ACTIVATION_DISTANCE) return;
      this.callbacks.draw(interaction.lastCell, interaction.erase);
      interaction.started = true;
    }
    if (end.x === interaction.lastCell.x && end.y === interaction.lastCell.y) return;
    visitGridLine(interaction.lastCell, end, (cell) => this.callbacks.draw(cell, interaction.erase));
    interaction.lastCell = end;
  }

  private rebaseTouchNavigation(): void {
    const touches = Array.from(this.pointers, ([pointerId, sample]) => ({ pointerId, sample }))
      .filter(({ sample }) => sample.pointerType === 'touch');
    if (touches.length >= 2) {
      const [a, b] = touches;
      this.setInteraction({
        kind: 'pinch', pointerIds: [a.pointerId, b.pointerId], view: this.viewport.getViewState(),
        center: midpoint(a.sample, b.sample), distance: distance(a.sample, b.sample),
      });
    } else if (touches.length === 1) {
      const [touch] = touches;
      this.setInteraction({
        kind: 'paint', pointerId: touch.pointerId, erase: false,
        lastCell: this.viewport.screenToCell(touch.sample.x, touch.sample.y),
        started: false, tapEligible: false, origin: touch.sample,
      });
    } else this.setInteraction(undefined);
  }

  private setInteraction(interaction: Interaction | undefined): void {
    this.interaction = interaction;
    this.element.classList?.toggle('is-panning', interaction?.kind === 'pan' || interaction?.kind === 'pinch');
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
