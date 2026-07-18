import { describe, expect, it } from 'vitest';
import { clientToViewport, ViewTransform } from './view-transform';

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
