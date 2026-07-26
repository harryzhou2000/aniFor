import { describe, expect, it } from 'vitest';
import {
  contourLight,
  enclosedSurfaceCoverage,
  isMaterialBulkInterior,
  materialNeighbourMask,
  neighbourDensity,
  NEIGHBOUR_BOTTOM,
  NEIGHBOUR_LEFT,
  NEIGHBOUR_RIGHT,
} from './volumetric-field';

describe('volumetric field sampling', () => {
  it('keeps a one-cell buffer between a bulk interior and a foreign seam', () => {
    const cells = new Uint8Array(7 * 5).fill(2);
    cells[2 * 7 + 5] = 3;
    const nearSeamMask = materialNeighbourMask(cells, 7, 5, 3, 2, 2);
    const bufferedMask = materialNeighbourMask(cells, 7, 5, 2, 2, 2);
    expect(nearSeamMask).toBe(0xFF);
    expect(isMaterialBulkInterior(cells, 7, 5, 3, 2, 2, nearSeamMask)).toBe(false);
    expect(isMaterialBulkInterior(cells, 7, 5, 2, 2, 2, bufferedMask)).toBe(true);
  });

  it('reports a fully enclosed field sample', () => {
    const cells = new Uint8Array(9).fill(2);
    const mask = materialNeighbourMask(cells, 3, 3, 1, 1, 2);
    expect(mask).toBe(0xFF);
    expect(neighbourDensity(mask)).toBe(8);
    expect(contourLight(mask)).toBe(0);
  });

  it('produces a bright upward-facing contour', () => {
    const cells = new Uint8Array([
      0, 0, 0,
      2, 2, 2,
      2, 2, 2,
    ]);
    const mask = materialNeighbourMask(cells, 3, 3, 1, 1, 2);
    expect(mask & NEIGHBOUR_BOTTOM).not.toBe(0);
    expect(mask & NEIGHBOUR_LEFT).not.toBe(0);
    expect(mask & NEIGHBOUR_RIGHT).not.toBe(0);
    expect(contourLight(mask)).toBeGreaterThan(0);
  });

  it('does not wrap neighbours across row boundaries', () => {
    const cells = new Uint8Array([
      0, 0, 2,
      2, 0, 0,
    ]);
    const mask = materialNeighbourMask(cells, 3, 2, 0, 1, 2);
    expect(mask).toBe(0);
  });

  it('fills an enclosed solid pinhole without expanding an exposed edge', () => {
    expect(enclosedSurfaceCoverage(0xff)).toBe(1);
    expect(enclosedSurfaceCoverage(NEIGHBOUR_LEFT | NEIGHBOUR_BOTTOM)).toBe(0);
    expect(enclosedSurfaceCoverage(NEIGHBOUR_LEFT | NEIGHBOUR_RIGHT)).toBe(0);
  });
});
