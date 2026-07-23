import { Material } from '../shared/materials';
import { SPNG_PRESENTATION_STATE } from '../simulation/types';

const MAX_CHANNEL_DELTA = 20;

/**
 * Interprets authoritative native SPNG water content as a bounded wet-body cue.
 *
 * Existing sponge morphology continues to own the pore layout. Hydration only
 * deepens and cools that body while giving upper-left pore lips a restrained
 * wet sheen. The operation is RGB-only, deterministic in integer world space,
 * and needs no neighbour sample, clock, allocation, or render-scale resource.
 */
export function applyCanvasSpongeHydrationStyle(
  output: Float32Array,
  material: number,
  state: number,
  x: number,
  y: number,
): void {
  if (
    material !== Material.SPNG
    || (state & SPNG_PRESENTATION_STATE.presentMask) === 0
  ) return;

  const hydration = Math.min(
    SPNG_PRESENTATION_STATE.hydrationMaximum,
    state & SPNG_PRESENTATION_STATE.hydrationMask,
  );
  if (hydration === 0) return;
  const moisture = hydration / SPNG_PRESENTATION_STATE.hydrationMaximum;
  const worldX = Math.floor(x);
  const worldY = Math.floor(y);
  const localX = positiveModulo(worldX, 19);
  const localY = positiveModulo(worldY, 19);
  const firstX = localX - 5;
  const firstY = localY - 5;
  const secondX = localX - 14;
  const secondY = localY - 12;
  const firstRadius = firstX * firstX + firstY * firstY;
  const secondRadius = secondX * secondX + secondY * secondY;
  const poreCore = firstRadius <= 4 || secondRadius <= 3;
  const firstWall = firstRadius >= 5 && firstRadius <= 12;
  const secondWall = secondRadius >= 4 && secondRadius <= 10;
  const litLip = (firstWall && firstX + firstY <= -2)
    || (secondWall && secondX + secondY <= -2);
  const wetGlint = litLip && positiveModulo(worldX - worldY, 4) <= 1;

  let red = -16;
  let green = -12;
  let blue = -5;
  if (wetGlint) {
    red += 10;
    green += 16;
    blue += 22;
  } else if (poreCore) {
    red -= 4;
    green -= 2;
    blue += 8;
  } else if (firstWall || secondWall) {
    red -= 2;
    green += 1;
    blue += 6;
  }

  output[0] += clampSignedDelta(red * moisture);
  output[1] += clampSignedDelta(green * moisture);
  output[2] += clampSignedDelta(blue * moisture);
}

function positiveModulo(value: number, divisor: number): number {
  const remainder = value % divisor;
  return remainder < 0 ? remainder + divisor : remainder;
}

function clampSignedDelta(value: number): number {
  return value < -MAX_CHANNEL_DELTA ? -MAX_CHANNEL_DELTA
    : value > MAX_CHANNEL_DELTA ? MAX_CHANNEL_DELTA : value;
}
