import { Material } from '../shared/materials';
import { FORCE_ACTIVITY_PRESENTATION_STATE } from '../simulation/types';

export const FORCE_ACTIVITY_STATE_MASK = FORCE_ACTIVITY_PRESENTATION_STATE.activeMask;

/** Exact native owners whose presentation-state bit 0 reports force activity. */
export function isForceActivityMaterial(material: number): boolean {
  return material === Material.ACEL || material === Material.DCEL;
}

/**
 * Adds a bounded RGB-only native-activity cue to one authoritative ACEL/DCEL cell.
 *
 * ACEL uses a right-facing chevron and wake; DCEL uses a cool braking ring and
 * restrained core. Both motifs are fixed in integer world coordinates, require
 * no neighbour samples or clock, and leave alpha/support entirely to the caller.
 */
export function applyCanvasForceActivityStyle(
  rgb: Float32Array,
  material: number,
  state: number,
  x: number,
  y: number,
): void {
  if (!isForceActivityMaterial(material) || (state & FORCE_ACTIVITY_STATE_MASK) === 0) return;

  const localX = x & 15;
  const localY = y & 15;

  if (material === Material.ACEL) {
    const centredY = Math.abs(localY - 8);
    const chevronDistance = Math.abs(localX - 5 - centredY);
    const leadingChevron = localX >= 5 && localX <= 13 && chevronDistance <= 1;
    const wake = localX >= 1 && localX < 6 && localY >= 7 && localY <= 9;
    if (leadingChevron) {
      rgb[0] += 16;
      rgb[1] += 11;
      rgb[2] -= 4;
    } else if (wake) {
      rgb[0] += 8;
      rgb[1] += 5;
      rgb[2] -= 2;
    }
    return;
  }

  const dx = localX - 8;
  const dy = localY - 8;
  const radiusSquared = dx * dx + dy * dy;
  if (radiusSquared >= 25 && radiusSquared <= 49) {
    rgb[0] += 3;
    rgb[1] += 10;
    rgb[2] += 16;
  } else if (radiusSquared <= 4) {
    rgb[0] -= 8;
    rgb[1] -= 5;
    rgb[2] += 3;
  }
}
