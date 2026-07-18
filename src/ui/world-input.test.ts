import { describe, expect, it, vi } from 'vitest';
import { visitGridLine, wheelZoomRatio, WorldInputController } from './world-input';

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
    const listeners = new Map<string, (event: WheelEvent) => void>();
    const element = {
      clientHeight: 600,
      dataset: {} as DOMStringMap,
      addEventListener(name: string, listener: (event: WheelEvent) => void) { listeners.set(name, listener); },
    } as unknown as HTMLElement;
    const view = { zoom: 1, panX: 0, panY: 0 };
    const viewport = {
      screenToCell: vi.fn(),
      getViewState: vi.fn(() => view),
      applyGesture: vi.fn(),
      resetView: vi.fn(),
    };
    new WorldInputController(element, viewport, { draw: vi.fn() });
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
