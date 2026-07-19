export const FIELD_OUTPUT_SCALE = 2;
export type FieldOutputScale = 1 | 2 | 4 | 8;

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
