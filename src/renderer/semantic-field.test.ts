import { describe, expect, it } from 'vitest';
import { dynamicFieldRefreshDue, DYNAMIC_FIELD_REFRESH_INTERVAL } from './field-renderer';
import { packSemanticRect, semanticRenderHeat, semanticTemperatureByte } from './semantic-field';

describe('packSemanticRect', () => {
  it('packs material, normalized temperature, and signed velocity', () => {
    const target = new Uint8Array(8);
    packSemanticRect(
      target,
      2,
      new Uint8Array([2, 4]),
      new Uint16Array([0x1234, 0xFFFF]),
      new Int8Array([-128, 127, 0, -1]),
      { x: 0, y: 0, width: 2, height: 1 },
    );
    expect([...target]).toEqual([2, 0x12, 0, 255, 4, 0xFF, 128, 127]);
  });

  it('only modifies the requested rectangle', () => {
    const target = new Uint8Array(4 * 4 * 4).fill(99);
    packSemanticRect(target, 4, new Uint8Array(16).fill(7), undefined, undefined, { x: 1, y: 1, width: 2, height: 2 });
    expect([...target.slice(0, 20)]).toEqual(new Array(20).fill(99));
    expect([...target.slice(20, 28)]).toEqual([7, 0, 128, 128, 7, 0, 128, 128]);
    expect([...target.slice(28, 36)]).toEqual(new Array(8).fill(99));
  });

  it('shares the shader temperature byte and smoothstep fallback with Canvas', () => {
    expect(semanticTemperatureByte(undefined)).toBe(0);
    expect(semanticRenderHeat(undefined)).toBe(0);
    expect(semanticTemperatureByte(0x4080)).toBe(0x40);
    expect(semanticRenderHeat(0x4080)).toBeCloseTo(0.741, 2);
    expect(semanticRenderHeat(0xFFFF)).toBe(1);
  });
});

describe('dynamic field refresh budget', () => {
  it('caps full temperature and velocity repacks while preserving the first sample', () => {
    expect(dynamicFieldRefreshDue(0, -Infinity, true)).toBe(true);
    expect(dynamicFieldRefreshDue(DYNAMIC_FIELD_REFRESH_INTERVAL - 0.01, 0, true)).toBe(false);
    expect(dynamicFieldRefreshDue(DYNAMIC_FIELD_REFRESH_INTERVAL, 0, true)).toBe(true);
    expect(dynamicFieldRefreshDue(Infinity, 0, false)).toBe(false);
  });
});
