import { describe, expect, it } from 'vitest';
import { packExteriorAir, packPresentationStateRect, packWallRect } from './wall-field';

describe('wall field', () => {
  it('keeps native wall IDs separate from particle semantics', () => {
    const target = new Uint8Array(3 * 2 * 4).fill(99);
    packWallRect(target, 3, new Uint8Array([0, 8, 8, 0, 15, 0]), { x: 1, y: 0, width: 2, height: 2 });
    expect([...target.slice(0, 4)]).toEqual([99, 99, 99, 99]);
    expect([...target.slice(4, 12)]).toEqual([8, 99, 99, 99, 8, 99, 99, 99]);
    expect([...target.slice(16, 24)]).toEqual([15, 99, 99, 99, 0, 99, 99, 99]);
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

  it('packs 16-bit native state into B/A without changing walls or exterior air', () => {
    const target = new Uint8Array([
      8, 255, 41, 42,
      0, 0, 43, 44,
      15, 255, 45, 46,
      2, 17, 47, 48,
    ]);
    packPresentationStateRect(
      target, 2, new Uint16Array([0, 0x1234, 0xABCD, 0xFFFF]),
      { x: 1, y: 0, width: 1, height: 2 },
    );
    expect([...target]).toEqual([
      8, 255, 41, 42,
      0, 0, 0x34, 0x12,
      15, 255, 45, 46,
      2, 17, 0xFF, 0xFF,
    ]);

    packWallRect(target, 2, new Uint8Array([1, 2, 3, 4]), { x: 0, y: 0, width: 2, height: 2 });
    packExteriorAir(target, new Uint8Array([7, 8, 9, 10]));
    expect([...target]).toEqual([
      1, 7, 41, 42,
      2, 8, 0x34, 0x12,
      3, 9, 45, 46,
      4, 10, 0xFF, 0xFF,
    ]);
  });

  it('rejects a presentation plane that cannot cover the wall field', () => {
    expect(() => packPresentationStateRect(
      new Uint8Array(4 * 4), 2, new Uint16Array(3),
      { x: 0, y: 0, width: 2, height: 2 },
    )).toThrow('Presentation-state field size mismatch');
  });
});
