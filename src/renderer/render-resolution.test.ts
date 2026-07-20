import { describe, expect, it } from 'vitest';
import {
  backingSize, FIELD_OUTPUT_SCALE, resolveFieldOutputScale, safeWebGLOutputScale,
  WEBGL_EIGHT_X_FRAME_STALL_MS, WEBGL_EIGHT_X_PROMOTION_TIMEOUT_MS,
  WEBGL_PROMOTION_TIMEOUT_MS, webGLPromotionTimeout,
} from './render-resolution';

describe('field render resolution', () => {
  it('allocates two backing pixels per axis without changing logical dimensions', () => {
    expect(FIELD_OUTPUT_SCALE).toBe(2);
    expect(backingSize(612, 384)).toEqual({ width: 1224, height: 768 });
    expect(backingSize(612, 384, 1)).toEqual({ width: 612, height: 384 });
  });

  it('rounds non-integral backing sizes deterministically', () => {
    expect(backingSize(10.25, 7.75, 2)).toEqual({ width: 21, height: 16 });
  });

  it('supports explicit one-, two-, four-, and eight-times diagnostic overrides', () => {
    expect(resolveFieldOutputScale('')).toBe(FIELD_OUTPUT_SCALE);
    expect(resolveFieldOutputScale('?renderScale=1')).toBe(1);
    expect(resolveFieldOutputScale('?renderScale=2')).toBe(2);
    expect(resolveFieldOutputScale('?renderScale=4')).toBe(4);
    expect(resolveFieldOutputScale('?renderScale=8')).toBe(8);
    expect(backingSize(612, 384, 4)).toEqual({ width: 2448, height: 1536 });
    expect(backingSize(612, 384, 8)).toEqual({ width: 4896, height: 3072 });
    expect(resolveFieldOutputScale('?renderScale=unexpected')).toBe(FIELD_OUTPUT_SCALE);
  });

  it('admits canonical true 8x while respecting explicit target budgets', () => {
    expect(safeWebGLOutputScale(612, 384, 8)).toBe(8);
    expect(safeWebGLOutputScale(612, 384, 4)).toBe(4);
    expect(safeWebGLOutputScale(320, 200, 8)).toBe(8);
    expect(safeWebGLOutputScale(1_200, 800, 8)).toBe(4);
    expect(safeWebGLOutputScale(612, 384, 8, 2_000_000, 2_048)).toBe(2);
    expect(safeWebGLOutputScale(612, 384, 1, 1, 1)).toBe(1);
  });

  it('allows true 8x a bounded cold-start window without slowing lower scales', () => {
    expect(webGLPromotionTimeout(1)).toBe(WEBGL_PROMOTION_TIMEOUT_MS);
    expect(webGLPromotionTimeout(2)).toBe(WEBGL_PROMOTION_TIMEOUT_MS);
    expect(webGLPromotionTimeout(4)).toBe(WEBGL_PROMOTION_TIMEOUT_MS);
    expect(webGLPromotionTimeout(8)).toBe(WEBGL_EIGHT_X_PROMOTION_TIMEOUT_MS);
    expect(WEBGL_EIGHT_X_PROMOTION_TIMEOUT_MS).toBeGreaterThan(WEBGL_PROMOTION_TIMEOUT_MS);
    expect(WEBGL_EIGHT_X_FRAME_STALL_MS).toBe(WEBGL_EIGHT_X_PROMOTION_TIMEOUT_MS);
  });
});
