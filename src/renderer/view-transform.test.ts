import { describe, expect, it } from 'vitest';
import { clientToViewport, fitAspect, ViewTransform } from './view-transform';

describe('fixed-aspect viewport fitting', () => {
  it('preserves the native field ratio through wide and tall resizes', () => {
    expect(fitAspect(1200, 500, 612 / 384)).toEqual({ width: 796.875, height: 500 });
    expect(fitAspect(700, 900, 612 / 384)).toEqual({ width: 700, height: 700 / (612 / 384) });
  });
});

describe('ViewTransform', () => {
  it('fits and centers the world', () => {
    const view = new ViewTransform(960, 600);
    view.resize(480, 500);
    expect(view.scale).toBe(0.5);
    expect(view.position).toEqual({ x: 0, y: 100 });
  });

  it('keeps the pinch anchor stable while zooming', () => {
    const view = new ViewTransform(1000, 1000);
    view.resize(500, 500);
    const start = view.snapshot();
    view.applyGesture(start, { x: 100, y: 150 }, { x: 100, y: 150 }, 2);
    expect(view.scale).toBe(1);
    expect(view.position).toEqual({ x: -100, y: -150 });
  });

  it('keeps an off-center zoom anchored proportionally through viewport resize', () => {
    const view = new ViewTransform(612, 384);
    view.resize(612, 384);
    view.applyGesture(view.snapshot(), { x: 100, y: 100 }, { x: 100, y: 100 }, 2);
    expect(view.scale).toBe(2);
    expect(view.position).toEqual({ x: -100, y: -100 });

    view.resize(306, 192);
    expect(view.scale).toBe(1);
    expect(view.position).toEqual({ x: -50, y: -50 });
  });

  it('round-trips world points across the whole viewport after zoom and resize', () => {
    const view = new ViewTransform(612, 384);
    view.resize(900, 600);
    view.applyGesture(view.snapshot(), { x: 120, y: 480 }, { x: 120, y: 480 }, 2.4);
    view.resize(720, 480);

    for (const world of [{ x: 0, y: 0 }, { x: 306, y: 192 }, { x: 611, y: 383 }]) {
      const restored = view.viewportToWorld(view.worldToViewport(world));
      expect(restored.x).toBeCloseTo(world.x);
      expect(restored.y).toBeCloseTo(world.y);
    }
  });

  it('bounds zoom and panning so the world cannot be lost', () => {
    const view = new ViewTransform(1000, 1000);
    view.resize(500, 500);
    view.applyGesture(view.snapshot(), { x: 250, y: 250 }, { x: 50_000, y: -50_000 }, 20);
    expect(view.snapshot()).toEqual({ zoom: 5, panX: 1000, panY: -1000 });
  });

  it('maps CSS client coordinates into the renderer content box', () => {
    expect(clientToViewport(
      { x: 310, y: 220 },
      { left: 10, top: 20, width: 600, height: 400 },
      1200,
      800,
    )).toEqual({ x: 600, y: 400 });
  });
});
