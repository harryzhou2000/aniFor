import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { SPNG_PRESENTATION_STATE } from '../simulation/types';
import { applyCanvasSpongeHydrationStyle } from './canvas-sponge-hydration-style';

const SOURCE = [210, 164, 58, 0.625] as const;
const SOURCE_FLOAT = Array.from(new Float32Array(SOURCE));

function encode(hydration: number): number {
  return SPNG_PRESENTATION_STATE.presentMask
    | (hydration & SPNG_PRESENTATION_STATE.hydrationMask);
}

function styled(material: number, hydration: number, x: number, y: number): number[] {
  const output = new Float32Array(SOURCE);
  applyCanvasSpongeHydrationStyle(output, material, encode(hydration), x, y);
  return Array.from(output);
}

describe('Canvas native SPNG hydration styling', () => {
  it('requires exact owner presence and leaves authoritative dry SPNG unchanged', () => {
    const dry = styled(Material.SPNG, 0, 1, 2);
    expect(dry).toEqual(SOURCE_FLOAT);
    const absent = new Float32Array(SOURCE);
    applyCanvasSpongeHydrationStyle(absent, Material.SPNG, 25, 1, 2);
    expect(Array.from(absent)).toEqual(SOURCE_FLOAT);
    expect(styled(Material.Water, 25, 1, 2)).toEqual(SOURCE_FLOAT);
  });

  it('darkens and cools the ordinary body monotonically with native water content', () => {
    const low = styled(Material.SPNG, 10, 1, 2);
    const middle = styled(Material.SPNG, 25, 1, 2);
    const saturated = styled(Material.SPNG, 50, 1, 2);
    expect(low[0]).toBeLessThan(SOURCE[0]);
    expect(middle[0]).toBeLessThan(low[0]);
    expect(saturated[0]).toBeLessThan(middle[0]);
    expect(saturated[2] - SOURCE[2]).toBeGreaterThan(saturated[0] - SOURCE[0]);
  });

  it('gives hydrated pore lips a cool highlight distinct from pore cores', () => {
    const glint = styled(Material.SPNG, 50, 2, 5);
    const core = styled(Material.SPNG, 50, 5, 5);
    const body = styled(Material.SPNG, 50, 1, 2);
    expect(glint[2]).toBeGreaterThan(body[2]);
    expect(glint[1]).toBeGreaterThan(body[1]);
    expect(core).not.toEqual(glint);
  });

  it('is deterministic, 19-cell periodic, RGB-bounded, and alpha-invariant', () => {
    for (const hydration of [1, 10, 25, 49, 50, 63]) {
      for (let y = -20; y <= 20; y++) for (let x = -20; x <= 20; x++) {
        const first = styled(Material.SPNG, hydration, x, y);
        expect(styled(Material.SPNG, hydration, x, y)).toEqual(first);
        expect(styled(Material.SPNG, hydration, x + 0.75, y + 0.25)).toEqual(first);
        expect(styled(Material.SPNG, hydration, x + 19, y + 19)).toEqual(first);
        for (let channel = 0; channel < 3; channel++) {
          expect(Math.abs(first[channel] - SOURCE[channel])).toBeLessThanOrEqual(20);
        }
        expect(first[3]).toBe(SOURCE_FLOAT[3]);
      }
    }
  });
});
