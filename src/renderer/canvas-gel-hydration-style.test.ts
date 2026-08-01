import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { GEL_PRESENTATION_STATE } from '../simulation/types';
import {
  applyCanvasGelHydrationStyle,
  CANVAS_GEL_HYDRATION_MAX_CHANNEL_DELTA,
  canvasGelHydration,
} from './canvas-gel-hydration-style';

const SOURCE = [236, 145, 24, 0.68] as const;
const SOURCE_FLOAT = Array.from(new Float32Array(SOURCE));

function encodedHydration(hydration: number): number {
  return hydration & GEL_PRESENTATION_STATE.hydrationMask;
}

function styled(hydration: number, x: number, y: number): number[] {
  const output = new Float32Array(SOURCE);
  applyCanvasGelHydrationStyle(output, Material.GEL, encodedHydration(hydration), x, y);
  return Array.from(output);
}

describe('Canvas native GEL hydration styling', () => {
  it('decodes exactly the GEL-owned native 0..100 reservoir', () => {
    expect(canvasGelHydration(Material.GEL, 0)).toBe(0);
    expect(canvasGelHydration(Material.GEL, encodedHydration(37))).toBe(37);
    expect(canvasGelHydration(Material.GEL, GEL_PRESENTATION_STATE.hydrationMask)).toBe(
      GEL_PRESENTATION_STATE.hydrationMaximum,
    );
    expect(canvasGelHydration(Material.GEL, GEL_PRESENTATION_STATE.reservedMask)).toBe(0);
    expect(canvasGelHydration(Material.Water, encodedHydration(100))).toBe(0);
  });

  it('leaves dry GEL and every non-owner byte-identical', () => {
    expect(styled(0, 3, 7)).toEqual(SOURCE_FLOAT);

    const wrongOwner = new Float32Array(SOURCE);
    applyCanvasGelHydrationStyle(wrongOwner, Material.Water, encodedHydration(100), 3, 7);
    expect(Array.from(wrongOwner)).toEqual(SOURCE_FLOAT);
  });

  it('moves hydrated GEL from warm orange toward cooler blue monotonically', () => {
    const low = styled(10, 3, 7);
    const middle = styled(50, 3, 7);
    const saturated = styled(100, 3, 7);

    expect(low[0]).toBeLessThan(SOURCE[0]);
    expect(middle[0]).toBeLessThan(low[0]);
    expect(saturated[0]).toBeLessThan(middle[0]);
    expect(low[2]).toBeGreaterThan(SOURCE[2]);
    expect(middle[2]).toBeGreaterThan(low[2]);
    expect(saturated[2]).toBeGreaterThan(middle[2]);
    expect(saturated[2]).toBeGreaterThan(saturated[0]);
  });

  it('is deterministic, integer-world anchored, RGB-bounded, and alpha-invariant', () => {
    for (const hydration of [1, 10, 50, 100, 127]) {
      for (const [x, y] of [[3, 7], [-18, 12], [31, -9], [611, 383]]) {
        const first = styled(hydration, x, y);
        expect(styled(hydration, x, y)).toEqual(first);
        expect(styled(hydration, x + 0.8, y + 0.2)).toEqual(first);
        for (let channel = 0; channel < 3; channel += 1) {
          expect(Math.abs(first[channel] - SOURCE[channel]))
            .toBeLessThanOrEqual(CANVAS_GEL_HYDRATION_MAX_CHANNEL_DELTA);
        }
        expect(first[3]).toBe(SOURCE_FLOAT[3]);
      }
    }
  });
});
