import { Material } from '../shared/materials';
import { VIBR_PRESENTATION_STATE } from '../simulation/types';

/**
 * Presentation-only decoding of the native VIBR/BVBR state word.
 *
 * bits 0..6   upstream tmp/10 charge, clamped to 0..100
 * bits 7..14  upstream explosion life, normalized from 0..750 to 0..255
 * bit 15      alternate tmp2/CFLM mode
 */
export function applyCanvasVibrStateStyle(
  rgb: Float32Array,
  material: number,
  state: number,
  x: number,
  y: number,
): void {
  if ((material !== Material.VIBR && material !== Material.BVBR) || state === 0) return;

  const charge = Math.min(100, state & VIBR_PRESENTATION_STATE.chargeMask) / 100;
  const countdown = (
    state & VIBR_PRESENTATION_STATE.countdownMask
  ) >>> VIBR_PRESENTATION_STATE.countdownShift;
  const countdownStrength = countdown / 255;
  const alternate = (state & VIBR_PRESENTATION_STATE.alternateModeMask) !== 0;
  const horizontal = (y & 7) === 0;
  const vertical = ((x + (y >> 3) * 3) & 7) === 0;
  const junction = horizontal && vertical;
  const conductor = junction ? 1 : horizontal || vertical ? 0.72 : 0.24;

  // Charge energizes the existing shared fracture lattice without changing its
  // ownership or silhouette. The alternate mode bends the hue toward CFLM blue.
  rgb[0] += charge * conductor * (alternate ? 2 : -3);
  rgb[1] += charge * conductor * (alternate ? 7 : 12);
  rgb[2] += charge * conductor * (alternate ? 17 : 13);

  if (countdownStrength <= 0) return;
  const localX = (x & 15) - 8;
  const localY = (y & 15) - 8;
  const radiusSquared = localX * localX + localY * localY;
  const burstRing = radiusSquared >= 24 && radiusSquared <= 52;
  const burst = countdownStrength * (burstRing ? 1 : junction ? 0.82 : 0.34);
  rgb[0] += burst * (alternate ? 8 : 18);
  rgb[1] += burst * (alternate ? 15 : 20);
  rgb[2] += burst * (alternate ? 22 : 13);
}
