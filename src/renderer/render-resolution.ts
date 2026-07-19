export const FIELD_OUTPUT_SCALE = 2;
export type FieldOutputScale = 1 | 2 | 4 | 8;
export const WEBGL_OUTPUT_PIXEL_BUDGET = 8_388_608;
export const WEBGL_OUTPUT_DIMENSION_BUDGET = 4_096;

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
 * Keeps a single WebGL presentation target below a conservative watchdog and
 * texture-size budget. Small worlds may still use true 8×; the canonical world
 * safely steps 8× down to 4× while Canvas remains able to exercise true 8×.
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
