import { Material } from '../shared/materials';
import { LCRY_PRESENTATION_STATE } from '../simulation/types';

/**
 * Decodes LCRY's native tmp2 brightness only when both its exact semantic
 * owner and the owner-multiplexed presence marker agree. An uncharged crystal
 * is therefore a valid zero-brightness owner, while stale state from another
 * material remains a strict no-op.
 */
export function canvasLcryBrightness(material: number, state: number): number | undefined {
  if (material !== Material.LCRY || (state & LCRY_PRESENTATION_STATE.presentMask) === 0) {
    return undefined;
  }
  return Math.min(LCRY_PRESENTATION_STATE.brightnessMaximum,
    state & LCRY_PRESENTATION_STATE.brightnessMask);
}

/**
 * Restores upstream LCRY's neutral charge ramp after the common electronic
 * body grammar. The native renderer assigns the visible gray directly from
 * `0x50 + tmp2 * 0x10`; this keeps that RGB response exact while leaving
 * alpha, semantic ownership, walls, topology, and simulation state untouched.
 */
export function applyCanvasLcryStateStyle(
  output: Float32Array,
  material: number,
  state: number,
): void {
  const brightness = canvasLcryBrightness(material, state);
  if (brightness === undefined) return;
  const gray = 0x50 + brightness * 0x10;
  output[0] = gray;
  output[1] = gray;
  output[2] = gray;
}
