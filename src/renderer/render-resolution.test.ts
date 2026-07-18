import { describe, expect, it } from 'vitest';
import { backingSize, FIELD_OUTPUT_SCALE, resolveFieldOutputScale } from './render-resolution';

describe('field render resolution', () => {
  it('allocates two backing pixels per axis without changing logical dimensions', () => {
    expect(FIELD_OUTPUT_SCALE).toBe(2);
    expect(backingSize(612, 384)).toEqual({ width: 1224, height: 768 });
  });

  it('rounds non-integral backing sizes deterministically', () => {
    expect(backingSize(10.25, 7.75, 2)).toEqual({ width: 21, height: 16 });
  });

  it('supports explicit one- and two-times diagnostic overrides', () => {
    expect(resolveFieldOutputScale('?renderScale=1')).toBe(1);
    expect(resolveFieldOutputScale('?renderScale=2')).toBe(2);
    expect(resolveFieldOutputScale('?renderScale=unexpected')).toBe(FIELD_OUTPUT_SCALE);
  });
});
