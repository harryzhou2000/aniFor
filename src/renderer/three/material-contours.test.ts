import { describe, expect, it } from 'vitest';
import { materialContours } from './material-contours';

describe('connected material geometry', () => {
  it('joins adjacent cells into one outer surface', () => {
    const loops = materialContours(new Uint8Array([1,1,1,1]), 2, 2, 1);
    expect(loops).toHaveLength(1);
    expect(loops[0].area).toBe(4);
    expect(loops[0].points).toHaveLength(4);
  });
  it('preserves holes and distinguishes their winding', () => {
    const loops = materialContours(new Uint8Array([1,1,1,1,0,1,1,1,1]), 3, 3, 1);
    expect(loops.map(loop => loop.area).sort((a,b) => a-b)).toEqual([-1,9]);
  });
  it('keeps diagonal islands separate and does not merge different materials', () => {
    const loops = materialContours(new Uint8Array([1,2,2,1]), 2, 2, 1);
    expect(loops.map(loop => loop.area)).toEqual([1,1]);
  });
  it('treats native walls as barriers even where matter coexists', () => {
    const loops = materialContours(new Uint8Array([1,1,1]), 3, 1, 1, new Uint8Array([0,1,0]));
    expect(loops.map(loop => loop.area)).toEqual([1,1]);
  });
});
