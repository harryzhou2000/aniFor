import { Material } from '../shared/materials';
import { POLO_PRESENTATION_STATE } from '../simulation/types';

const MAX_CHANNEL_DELTA = 16;

/**
 * Adds a bounded RGB-only interpretation of authoritative native POLO state.
 *
 * Native POLO remains neutron-ready until `tmp` reaches five, spends fifteen
 * life ticks cooling after an emission, and becomes PLUT after ten absorbed
 * protons. The fixed 16-cell grammar makes those states legible without a
 * neighbour sample, clock, allocation, or render-scale-dependent operation.
 * Alpha, support, ownership, temperature, and the static radioactive identity
 * remain entirely owned by the caller.
 */
export function applyCanvasPoloStateStyle(
  rgb: Float32Array,
  material: number,
  state: number,
  x: number,
  y: number,
): void {
  if (
    material !== Material.POLO
    || state === 0
    || (state & POLO_PRESENTATION_STATE.presentMask) === 0
  ) return;

  const emissions = state & POLO_PRESENTATION_STATE.emissionMask;
  const cooldown = (
    state & POLO_PRESENTATION_STATE.cooldownMask
  ) >>> POLO_PRESENTATION_STATE.cooldownShift;
  const protonDose = (
    state & POLO_PRESENTATION_STATE.protonDoseMask
  ) >>> POLO_PRESENTATION_STATE.protonDoseShift;
  const worldX = Math.floor(x);
  const worldY = Math.floor(y);
  const localX = worldX & 15;
  const localY = worldY & 15;
  const dx = localX - 8;
  const dy = localY - 8;
  const radiusSquared = dx * dx + dy * dy;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (emissions >= POLO_PRESENTATION_STATE.emissionMaximum) {
    // Upstream turns spent POLO grey. Keep that transition restrained so the
    // ordinary radioactive body identity remains visible underneath it.
    const ashFacet = ((worldX + worldY * 3) & 7) === 0;
    red = ashFacet ? 16 : 10;
    green = ashFacet ? 7 : 2;
    blue = ashFacet ? 16 : 13;
  } else if (cooldown > 0) {
    // A newly emitted neutron starts at life=15. The warm shell expands as the
    // authoritative countdown falls, distinguishing afterglow from readiness.
    const boundedCooldown = cooldown > POLO_PRESENTATION_STATE.cooldownMaximum
      ? POLO_PRESENTATION_STATE.cooldownMaximum : cooldown;
    const heat = boundedCooldown / POLO_PRESENTATION_STATE.cooldownMaximum;
    const shellRadiusSquared = 16
      + (POLO_PRESENTATION_STATE.cooldownMaximum - boundedCooldown) * 2;
    const shell = Math.abs(radiusSquared - shellRadiusSquared) <= 5;
    const ray = dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy);
    if (shell) {
      red = 12 + heat * 4;
      green = 6 + heat * 5;
      blue = -6 + heat * 2;
    } else if (ray) {
      red = 6 + heat * 4;
      green = 6 + heat * 3;
      blue = -2;
    } else {
      red = 1 + heat * 3;
      green = 2 + heat * 3;
      blue = heat;
    }
  } else {
    // Default POLO is already neutron-ready: the presence bit alone must show
    // a cool radioactive crown rather than collapsing into the zero-state path.
    const readyRing = radiusSquared >= 25 && radiusSquared <= 49;
    const readyCore = radiusSquared <= 4;
    const neutronRay = dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy);
    if (readyRing) {
      red = 7;
      green = 16;
      blue = 9;
    } else if (readyCore) {
      red = 5;
      green = 12;
      blue = 7;
    } else if (neutronRay) {
      red = 4;
      green = 10;
      blue = 5;
    } else {
      red = 2;
      green = 5;
      blue = 3;
    }
  }

  if (protonDose > 0) {
    const boundedDose = protonDose > POLO_PRESENTATION_STATE.protonDoseMaximum
      ? POLO_PRESENTATION_STATE.protonDoseMaximum : protonDose;
    const progress = boundedDose / POLO_PRESENTATION_STATE.protonDoseMaximum;
    const filledHeight = Math.ceil(progress * 12);
    const captureRung = localY >= 16 - filledHeight
      && ((localX + localY) & 3) <= 1;
    red += progress * (captureRung ? 10 : 2);
    green -= progress * (captureRung ? 3 : 1);
    blue += progress * (captureRung ? 7 : 2);
  }

  rgb[0] += clampSignedDelta(red);
  rgb[1] += clampSignedDelta(green);
  rgb[2] += clampSignedDelta(blue);
}

function clampSignedDelta(value: number): number {
  return value < -MAX_CHANNEL_DELTA ? -MAX_CHANNEL_DELTA
    : value > MAX_CHANNEL_DELTA ? MAX_CHANNEL_DELTA : value;
}
