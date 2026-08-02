import { Material } from '../shared/materials';
import { SWCH_PRESENTATION_STATE } from '../simulation/types';

/**
 * True only for an exact native SWCH owner whose projected native lifetime is
 * in the conducting/on range. An absent word and an off/decaying switch are
 * deliberately presentation no-ops, so stale words from another owner cannot
 * manufacture a powered switch.
 */
export function canvasSwchIsOn(material: number, state: number): boolean {
  return material === Material.SWCH
    && (state & SWCH_PRESENTATION_STATE.presentMask) !== 0
    && (state & SWCH_PRESENTATION_STATE.onMask) !== 0;
}

/**
 * Adds a compact, static emerald conduction cue after the ordinary electronic
 * device body. This changes RGB only: the caller remains solely responsible
 * for alpha, semantic ownership, wall composition, topology, and physics.
 */
export function applyCanvasSwchStateStyle(
  output: Float32Array,
  material: number,
  state: number,
): void {
  if (!canvasSwchIsOn(material, state)) return;

  // Stay restrained against the dark native SWCH body while retaining green
  // headroom for ordinary lighting and later electronic overlays.
  output[0] = clampByte(output[0] * 0.66 + 16);
  output[1] = clampByte(output[1] * 0.82 + 100);
  output[2] = clampByte(output[2] * 0.70 + 42);
}

function clampByte(value: number): number { return Math.max(0, Math.min(255, value)); }
