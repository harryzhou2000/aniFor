export const FIELD_OUTPUT_SCALE = 2;

export interface RenderSize { readonly width: number; readonly height: number }

/** Returns backing pixels without changing the logical simulation dimensions. */
export function backingSize(width: number, height: number, scale = FIELD_OUTPUT_SCALE): RenderSize {
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Allows direct 1×/2× A/B testing without changing world or camera math. */
export function resolveFieldOutputScale(search = globalThis.location?.search ?? ''): 1 | 2 {
  const requested = new URLSearchParams(search).get('renderScale');
  return requested === '1' ? 1 : requested === '2' ? 2 : FIELD_OUTPUT_SCALE;
}
