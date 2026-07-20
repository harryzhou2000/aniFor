import { describe, expect, it } from 'vitest';
import { clientToCanvasWorld, contentBoxFromBounds, viewportToClient } from './client-coordinate-map';

describe('production client-coordinate mapping', () => {
  it('resolves a fractional scaled content box from actual element metrics', () => {
    const content = contentBoxFromBounds(
      { left: 101.25, top: 52.5, width: 918.75, height: 576.5625 },
      {
        offsetWidth: 980, offsetHeight: 615,
        clientLeft: 2, clientTop: 3, clientWidth: 976, clientHeight: 609,
      },
    );
    expect(content.left).toBeCloseTo(103.125);
    expect(content.top).toBeCloseTo(55.3125);
    expect(content.width).toBeCloseTo(915);
    expect(content.height).toBeCloseTo(570.9375);
  });

  it('maps left, centre, and right canvas points into the 612x384 world', () => {
    const rect = { left: 48.375, top: 91.125, width: 827.25, height: 519.0588235294 };
    const points = [
      { client: { x: rect.left, y: rect.top }, world: { x: 0, y: 0 } },
      { client: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, world: { x: 306, y: 192 } },
      { client: { x: rect.left + rect.width, y: rect.top + rect.height }, world: { x: 612, y: 384 } },
    ];
    for (const { client, world } of points) {
      const mapped = clientToCanvasWorld(client, rect, 612, 384);
      expect(mapped.x).toBeCloseTo(world.x, 8);
      expect(mapped.y).toBeCloseTo(world.y, 8);
    }
  });

  it('depends only on CSS geometry, never DPR or the 1224x768 backing', () => {
    const rect = { left: 17.2, top: 28.6, width: 612.75, height: 384.4705882353 };
    const client = { x: rect.left + rect.width * 0.73, y: rect.top + rect.height * 0.21 };
    expect(clientToCanvasWorld(client, rect, 612, 384)).toEqual({ x: 446.76, y: 80.64 });
  });

  it('projects logical viewport coordinates through a page-scaled content box', () => {
    expect(viewportToClient(
      { x: 306, y: 192 },
      { left: 40, top: 80, width: 918, height: 576 },
      612,
      384,
    )).toEqual({ x: 499, y: 368 });
  });
});
