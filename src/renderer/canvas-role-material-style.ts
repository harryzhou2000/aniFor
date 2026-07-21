import { RenderTrait } from './render-traits';

const ROLE_TRAITS = RenderTrait.Emitter | RenderTrait.Sink
  | RenderTrait.Channel | RenderTrait.Force;

/**
 * Stable fit-view glyphs for semantic mechanism roles. RGB only: the caller
 * retains ownership of alpha, support, material identity, and native state.
 */
export function applyCanvasRoleMaterialStyle(
  rgb: Float32Array,
  traits: number,
  material: number,
  x: number,
  y: number,
): void {
  if ((traits & ROLE_TRAITS) === 0) return;
  const baseRed = rgb[0];
  const baseGreen = rgb[1];
  const baseBlue = rgb[2];
  const emitter = (traits & RenderTrait.Emitter) !== 0;
  const sink = (traits & RenderTrait.Sink) !== 0;
  const localX = positiveModulo(x + material * 3, 24) - 11.5;
  const localY = positiveModulo(y + material * 5, 24) - 11.5;
  const radius = Math.hypot(localX, localY);
  const core = radius < 3.6;
  const ring = Math.abs(radius - 7.4) < 1.5;

  if (emitter) {
    const strength = core ? 18 : ring ? 11 : 3;
    rgb[0] += strength;
    rgb[1] += strength * 0.46;
    rgb[2] += strength * 0.13;
  }
  if (sink) {
    const strength = core ? 15 : ring ? 12 : 3;
    if (core) rgb[0] -= 4;
    rgb[0] += strength * 0.18;
    rgb[1] += strength * 0.55;
    rgb[2] += strength;
  }
  if (traits & RenderTrait.Channel) {
    const railDistance = Math.abs(positiveModulo(x - y + material * 2, 14) - 7);
    const rail = railDistance <= 1;
    const node = rail && positiveModulo(x + y + material, 12) < 3;
    rgb[0] += rail ? 3 + (node ? 3 : 0) : 0;
    rgb[1] += rail ? 8 + (node ? 4 : 0) : 2;
    rgb[2] += rail ? 14 + (node ? 6 : 0) : 3;
  }
  if (traits & RenderTrait.Force) {
    const forceRing = Math.abs(radius - 5.0) < 1.2 || Math.abs(radius - 9.2) < 1.1;
    rgb[0] += forceRing ? 2 : 0;
    rgb[1] += forceRing ? 11 : 2;
    rgb[2] += forceRing ? 17 : 4;
  }

  // Composed roles such as CONV/FRAY/SING remain vivid without becoming
  // emissive white tiles or exceeding the established bounded RGB accents.
  rgb[0] = baseRed + clamp(rgb[0] - baseRed, -6, 24);
  rgb[1] = baseGreen + clamp(rgb[1] - baseGreen, -6, 24);
  rgb[2] = baseBlue + clamp(rgb[2] - baseBlue, -6, 24);
}

function positiveModulo(value: number, divisor: number): number {
  const remainder = value % divisor;
  return remainder < 0 ? remainder + divisor : remainder;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
