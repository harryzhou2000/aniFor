import { describe, expect, it, vi } from 'vitest';
import { visitGridLine, wheelZoomRatio, WorldInputController } from './world-input';

function inputHarness() {
  const listeners = new Map<string, (event: any) => void>();
  const element = {
    clientHeight: 600,
    dataset: {} as DOMStringMap,
    classList: { toggle: vi.fn() },
    setPointerCapture: vi.fn(),
    addEventListener(name: string, listener: (event: any) => void) { listeners.set(name, listener); },
  } as unknown as HTMLElement;
  const view = { zoom: 1, panX: 0, panY: 0 };
  const viewport = {
    screenToCell: vi.fn((x: number, y: number) => ({ x: Math.floor(x / 10), y: Math.floor(y / 10) })),
    getViewState: vi.fn(() => view),
    applyGesture: vi.fn(),
    resetView: vi.fn(),
  };
  const draw = vi.fn();
  const drawSegment = vi.fn();
  const finishStroke = vi.fn();
  new WorldInputController(element, viewport, { draw, drawSegment, finishStroke });
  const dispatchPointer = (name: string, overrides: Partial<PointerEvent> = {}) => {
    const event = {
      pointerId: 1, pointerType: 'mouse', button: 0, clientX: 0, clientY: 0,
      preventDefault: vi.fn(), stopPropagation: vi.fn(), ...overrides,
    } as unknown as PointerEvent;
    listeners.get(name)!(event);
    return event;
  };
  return { listeners, element, view, viewport, draw, drawSegment, finishStroke, dispatchPointer };
}

describe('wheelZoomRatio', () => {
  it('normalizes pixel, line, and page deltas into a bounded zoom step', () => {
    expect(wheelZoomRatio(-48, 0, 600)).toBeCloseTo(wheelZoomRatio(-3, 1, 600));
    expect(wheelZoomRatio(-1, 2, 600)).toBeCloseTo(Math.exp(0.48));
    expect(wheelZoomRatio(-100_000, 0, 600)).toBeCloseTo(Math.exp(0.48));
  });

  it('uses reciprocal factors for equal zoom-in and zoom-out deltas', () => {
    expect(wheelZoomRatio(-120, 0, 600) * wheelZoomRatio(120, 0, 600)).toBeCloseTo(1);
  });
});

describe('WorldInputController wheel handling', () => {
  it('prevents page scrolling and forwards an anchored zoom gesture', () => {
    const { listeners, element, view, viewport } = inputHarness();
    const event = {
      clientX: 220,
      clientY: 180,
      deltaY: -120,
      deltaMode: 0,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as WheelEvent;

    listeners.get('wheel')!(event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopPropagation).toHaveBeenCalledOnce();
    expect(viewport.applyGesture).toHaveBeenCalledWith(
      view,
      { x: 220, y: 180 },
      { x: 220, y: 180 },
      wheelZoomRatio(-120, 0, 600),
    );
    expect(element.dataset.lastWheel).toBeDefined();
  });
});

describe('WorldInputController pointer modes', () => {
  it('uses middle-button drag for camera pan without painting', () => {
    const { element, view, viewport, draw, dispatchPointer } = inputHarness();
    const down = dispatchPointer('pointerdown', { pointerId: 4, button: 1, clientX: 120, clientY: 90 });
    dispatchPointer('pointermove', { pointerId: 4, button: 1, clientX: 170, clientY: 130 });

    expect(down.preventDefault).toHaveBeenCalledOnce();
    expect(element.setPointerCapture).toHaveBeenCalledWith(4);
    expect(viewport.applyGesture).toHaveBeenCalledWith(view, { x: 120, y: 90 }, { x: 170, y: 130, pointerType: 'mouse' }, 1);
    expect(viewport.screenToCell).not.toHaveBeenCalled();
    expect(draw).not.toHaveBeenCalled();
  });

  it('uses one touch for a continuous brush and two touches only for pan and zoom', () => {
    const { viewport, draw, drawSegment, dispatchPointer } = inputHarness();
    dispatchPointer('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 });
    expect(draw).not.toHaveBeenCalled();
    dispatchPointer('pointermove', { pointerId: 1, pointerType: 'touch', clientX: 140, clientY: 120 });
    expect(draw).toHaveBeenCalledWith({ x: 10, y: 10 }, false);
    expect(draw).toHaveBeenCalledWith({ x: 14, y: 12 }, false);
    expect(viewport.applyGesture).not.toHaveBeenCalled();

    const pinchView = { zoom: 1.2, panX: 18, panY: 9 };
    viewport.getViewState.mockReturnValue(pinchView);
    dispatchPointer('pointerdown', { pointerId: 2, pointerType: 'touch', clientX: 200, clientY: 100 });
    draw.mockClear();
    drawSegment.mockClear();
    viewport.applyGesture.mockClear();
    dispatchPointer('pointermove', { pointerId: 1, pointerType: 'touch', clientX: 150, clientY: 130 });
    dispatchPointer('pointermove', { pointerId: 2, pointerType: 'touch', clientX: 240, clientY: 120 });
    expect(viewport.applyGesture).toHaveBeenCalledWith(
      pinchView,
      { x: 170, y: 110 },
      { x: 195, y: 125 },
      Math.hypot(90, -10) / Math.hypot(60, -20),
    );
    expect(draw).not.toHaveBeenCalled();
    expect(drawSegment).not.toHaveBeenCalled();

    dispatchPointer('pointerup', { pointerId: 2, pointerType: 'touch', clientX: 240, clientY: 120 });
    expect(draw).not.toHaveBeenCalled();
    expect(drawSegment).not.toHaveBeenCalled();
    viewport.applyGesture.mockClear();
    dispatchPointer('pointermove', { pointerId: 1, pointerType: 'touch', clientX: 160, clientY: 140 });
    expect(draw).toHaveBeenCalledWith({ x: 16, y: 14 }, false);
    expect(viewport.applyGesture).not.toHaveBeenCalled();
  });

  it('does not leave a brush dot when a second touch begins navigation', () => {
    const { draw, dispatchPointer } = inputHarness();
    dispatchPointer('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 });
    dispatchPointer('pointermove', { pointerId: 1, pointerType: 'touch', clientX: 103, clientY: 102 });
    dispatchPointer('pointerdown', { pointerId: 2, pointerType: 'touch', clientX: 200, clientY: 100 });
    dispatchPointer('pointermove', { pointerId: 2, pointerType: 'touch', clientX: 230, clientY: 120 });
    dispatchPointer('pointerup', { pointerId: 2, pointerType: 'touch', clientX: 230, clientY: 120 });
    dispatchPointer('pointerup', { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 });
    expect(draw).not.toHaveBeenCalled();
  });

  it('does not commit a deferred touch when the pointer is cancelled', () => {
    const { draw, dispatchPointer } = inputHarness();
    dispatchPointer('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 });
    dispatchPointer('pointercancel', { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 });
    expect(draw).not.toHaveBeenCalled();
  });

  it('keeps primary and secondary drags continuous and semantically separate', () => {
    const { draw, drawSegment, finishStroke, dispatchPointer } = inputHarness();
    dispatchPointer('pointerdown', { pointerId: 1, button: 0, clientX: 20, clientY: 30 });
    dispatchPointer('pointermove', { pointerId: 1, button: 0, clientX: 60, clientY: 50 });
    dispatchPointer('pointerup', { pointerId: 1, button: 0, clientX: 60, clientY: 50 });
    expect(draw).toHaveBeenCalledWith({ x: 2, y: 3 }, false);
    expect(draw).toHaveBeenCalledWith({ x: 6, y: 5 }, false);
    expect(drawSegment).toHaveBeenCalledWith({ x: 2, y: 3 }, { x: 6, y: 5 }, false);
    expect(finishStroke).toHaveBeenCalledWith({ x: 2, y: 3 }, { x: 6, y: 5 }, false);

    draw.mockClear();
    drawSegment.mockClear();
    dispatchPointer('pointerdown', { pointerId: 2, button: 2, clientX: 80, clientY: 90 });
    dispatchPointer('pointermove', { pointerId: 2, button: 2, clientX: 100, clientY: 100 });
    expect(draw.mock.calls.every(([, erase]) => erase === true)).toBe(true);
    expect(drawSegment).toHaveBeenCalledWith({ x: 8, y: 9 }, { x: 10, y: 10 }, true);
    expect(finishStroke).toHaveBeenCalledOnce();
  });

  it('stops navigation when pointer capture is lost', () => {
    const { viewport, dispatchPointer } = inputHarness();
    dispatchPointer('pointerdown', { pointerId: 7, button: 1, clientX: 40, clientY: 50 });
    dispatchPointer('lostpointercapture', { pointerId: 7, button: 1, clientX: 40, clientY: 50 });
    dispatchPointer('pointermove', { pointerId: 7, button: 1, clientX: 90, clientY: 100 });
    expect(viewport.applyGesture).not.toHaveBeenCalled();
  });
});

describe('visitGridLine', () => {
  it('fills every grid cell between sparse pointer samples', () => {
    const visited: Array<{ x: number; y: number }> = [];
    visitGridLine({ x: 2, y: 3 }, { x: 6, y: 5 }, (point) => visited.push(point));
    expect(visited).toEqual([
      { x: 3, y: 4 },
      { x: 4, y: 4 },
      { x: 5, y: 5 },
      { x: 6, y: 5 },
    ]);
  });
});
