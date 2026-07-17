import { describe, expect, it } from 'vitest';
import { Material } from '../../../shared/materials';
import { buildWaterSurface, polygonArea } from './metaball-surface';

describe('water metaball surface', () => {
  it('returns no geometry for a dry world', () => {
    expect(buildWaterSurface(new Uint8Array(80), 10, 8)).toEqual([]);
  });

  it('builds finite, bounded geometry around one cell', () => {
    const cells = new Uint8Array(10 * 8);
    cells[4 * 10 + 5] = Material.Water;
    const surface = buildWaterSurface(cells, 10, 8);
    expect(surface.length).toBeGreaterThan(0);
    for (const point of surface.flat()) {
      expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true);
      expect(point.x).toBeGreaterThanOrEqual(0); expect(point.x).toBeLessThanOrEqual(10);
      expect(point.y).toBeGreaterThanOrEqual(0); expect(point.y).toBeLessThanOrEqual(8);
    }
  });

  it('merges adjacent water into a larger continuous density region', () => {
    const single = new Uint8Array(12 * 8);
    single[4 * 12 + 5] = Material.Water;
    const adjacent = single.slice();
    adjacent[4 * 12 + 6] = Material.Water;
    const area = (cells: Uint8Array) => buildWaterSurface(cells, 12, 8).reduce((sum, polygon) => sum + polygonArea(polygon), 0);
    expect(area(adjacent)).toBeGreaterThan(area(single) * 1.35);
  });

  it('is deterministic for identical occupancy', () => {
    const cells = new Uint8Array(20 * 12);
    for (let x = 5; x < 12; x++) cells[7 * 20 + x] = Material.Water;
    expect(buildWaterSurface(cells, 20, 12)).toEqual(buildWaterSurface(cells, 20, 12));
  });
});
