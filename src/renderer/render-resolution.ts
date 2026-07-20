export const FIELD_OUTPUT_SCALE = 2;
export type FieldOutputScale = 1 | 2 | 4 | 8;
// 612x384 at true 8x is 15,040,512 pixels and 4,896 pixels wide. Keep the
// ceiling just above that canonical target while still rejecting accidental
// larger allocations. High scales disable redundant MSAA in the presenter.
export const WEBGL_OUTPUT_PIXEL_BUDGET = 16_777_216;
export const WEBGL_OUTPUT_DIMENSION_BUDGET = 8_192;
export const CANVAS_FALLBACK_PIXEL_BUDGET = 8_388_608;
export const CANVAS_FALLBACK_DIMENSION_BUDGET = 4_096;
export const WEBGL_PROMOTION_TIMEOUT_MS = 10_000;
export const WEBGL_EIGHT_X_PROMOTION_TIMEOUT_MS = 30_000;
// A later 8x frame that remains unsignalled for this long is no longer merely
// slow: without an explicit recovery path the latest-wins fence loop would
// leave a permanently frozen WebGL canvas even when no context-loss event fires.
export const WEBGL_EIGHT_X_FRAME_STALL_MS = 30_000;

export interface RenderSize { readonly width: number; readonly height: number }

/** Returns backing pixels without changing the logical simulation dimensions. */
export function backingSize(width: number, height: number, scale = FIELD_OUTPUT_SCALE): RenderSize {
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Allows direct 1×/2×/4×/8× A/B testing without changing world or camera math. */
export function resolveFieldOutputScale(search = globalThis.location?.search ?? ''): FieldOutputScale {
  const requested = new URLSearchParams(search).get('renderScale');
  if (requested === '1' || requested === '2' || requested === '4' || requested === '8') {
    return Number(requested) as FieldOutputScale;
  }
  return FIELD_OUTPUT_SCALE;
}

/**
 * Keeps a single WebGL presentation target below an explicit watchdog and
 * texture-size budget. The canonical 612x384 world fits true 8×; larger worlds
 * still step down deterministically.
 */
export function safeWebGLOutputScale(
  width: number,
  height: number,
  requested: FieldOutputScale,
  maxPixels = WEBGL_OUTPUT_PIXEL_BUDGET,
  maxDimension = WEBGL_OUTPUT_DIMENSION_BUDGET,
): FieldOutputScale {
  const candidates: readonly FieldOutputScale[] = [8, 4, 2, 1];
  for (const scale of candidates) {
    if (scale > requested) continue;
    const size = backingSize(width, height, scale);
    if (size.width <= maxDimension && size.height <= maxDimension
      && size.width * size.height <= maxPixels) return scale;
  }
  return 1;
}

/**
 * A true 8x target has 15 million fragments. Cold shader compilation and its
 * first complete draw can legitimately outlive the normal late-promotion
 * window, especially on software/low-power WebGL. Canvas remains mounted while
 * this runs, so allowing a bounded longer warm-up is safer than falsely
 * labelling a supported 8x target as timed out.
 */
export function webGLPromotionTimeout(scale: FieldOutputScale): number {
  return scale === 8 ? WEBGL_EIGHT_X_PROMOTION_TIMEOUT_MS : WEBGL_PROMOTION_TIMEOUT_MS;
}
