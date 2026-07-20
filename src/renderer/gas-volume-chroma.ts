const RESPONSE_LIMIT = 0.060;

/**
 * Signed chromatic key/fill for one already reconstructed gas sample.
 * Density, directional relief, and curvature are presentation fields in [0, 1]
 * space; this function never changes gas support or opacity.
 */
export function canvasGasVolumeChromaResponse(
  density: number,
  directionalRelief: number,
  curvature: number,
): number {
  if (density <= 0) return 0;
  const opticalDepth = smoothstep(0.035, 0.62, density);
  const relief = clamp(directionalRelief * 1.20 + curvature * 2.50, -1, 1);
  return clamp(relief * (0.025 + (1 - opticalDepth) * 0.035), -RESPONSE_LIMIT, RESPONSE_LIMIT);
}

/** Applies a hue-aware gas key/fill to RGB only, without allocating. */
export function applyCanvasGasVolumeChroma(
  target: Uint8ClampedArray,
  offset: number,
  response: number,
  sourceRed: number,
  sourceGreen: number,
  sourceBlue: number,
): void {
  if (response === 0) return;
  if (response > 0) {
    const keyRed = 0.58 * 0.65 + sourceRed / 255 * 0.35;
    const keyGreen = 0.80 * 0.65 + sourceGreen / 255 * 0.35;
    const keyBlue = 1.00 * 0.65 + sourceBlue / 255 * 0.35;
    target[offset] += 255 * keyRed * response * 0.80;
    target[offset + 1] += 255 * keyGreen * response * 0.80;
    target[offset + 2] += 255 * keyBlue * response * 0.80;
    return;
  }
  const amount = -response;
  target[offset] *= 1 - amount;
  target[offset + 1] *= 1 - 0.72 * amount;
  target[offset + 2] *= 1 - 0.45 * amount;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const progress = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return progress * progress * (3 - 2 * progress);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
