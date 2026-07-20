import { describe, expect, it } from 'vitest';
import { packExteriorAir, packWallRect } from './wall-field';

describe('wall field', () => {
  it('keeps native wall IDs separate from particle semantics', () => {
    const target = new Uint8Array(3 * 2 * 4).fill(99);
    packWallRect(target, 3, new Uint8Array([0, 8, 8, 0, 15, 0]), { x: 1, y: 0, width: 2, height: 2 });
    expect([...target.slice(0, 4)]).toEqual([99, 99, 99, 99]);
    expect([...target.slice(4, 12)]).toEqual([8, 99, 0, 255, 8, 99, 0, 255]);
    expect([...target.slice(16, 24)]).toEqual([15, 99, 0, 255, 0, 99, 0, 255]);
  });

  it('packs exterior air into G without changing wall IDs', () => {
    const target = new Uint8Array([
      8, 0, 0, 255,
      0, 0, 0, 255,
      15, 0, 0, 255,
    ]);
    packExteriorAir(target, new Uint8Array([255, 0, 255]));
    expect([...target]).toEqual([
      8, 255, 0, 255,
      0, 0, 0, 255,
      15, 255, 0, 255,
    ]);
  });
});
