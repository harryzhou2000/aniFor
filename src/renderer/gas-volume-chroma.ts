const RESPONSE_LIMIT = 0.060;
const REC709_RED = 0.2126;
const REC709_GREEN = 0.7152;
const REC709_BLUE = 0.0722;

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
  // A low, always-positive shell is the forward-scattered rim. The signed
  // relief remains dominant in pockets and dense overlaps, retaining a real
  // key/fill pair instead of washing the whole cloud brighter.
  const shell = smoothstep(0.008, 0.12, density)
    * (1 - smoothstep(0.18, 0.58, density)) * 0.012;
  return clamp(
    relief * (0.040 + (1 - opticalDepth) * 0.055) + shell,
    -RESPONSE_LIMIT,
    RESPONSE_LIMIT,
  );
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
  const red = sourceRed / 255;
  const green = sourceGreen / 255;
  const blue = sourceBlue / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const chroma = maximum - minimum;
  const luma = red * REC709_RED + green * REC709_GREEN + blue * REC709_BLUE;
  // Chroma is measured against the source's own peak, while the luma term
  // gently favours readable spectral scattering in bright clean gases. Neutral
  // Smoke/FOG naturally retain the restrained atmospheric key/fill below.
  const spectral = clamp(chroma / Math.max(0.18, maximum), 0, 1);
  const spectralMix = smoothstep(0.04, 0.62, spectral)
    * (0.72 + smoothstep(0.08, 0.92, luma) * 0.22);
  const inverseChroma = 1 / Math.max(chroma, 1 / 255);
  const hueRed = clamp((red - minimum) * inverseChroma, 0, 1);
  const hueGreen = clamp((green - minimum) * inverseChroma, 0, 1);
  const hueBlue = clamp((blue - minimum) * inverseChroma, 0, 1);
  if (response > 0) {
    const keyRed = mix(0.58, 0.45 + hueRed * 0.55, spectralMix);
    const keyGreen = mix(0.80, 0.45 + hueGreen * 0.55, spectralMix);
    const keyBlue = mix(1.00, 0.45 + hueBlue * 0.55, spectralMix);
    target[offset] += 255 * keyRed * response * 0.80;
    target[offset + 1] += 255 * keyGreen * response * 0.80;
    target[offset + 2] += 255 * keyBlue * response * 0.80;
    return;
  }
  const amount = -response;
  const fillRed = mix(1.00, 0.88 - hueRed * 0.43, spectralMix);
  const fillGreen = mix(0.72, 0.88 - hueGreen * 0.43, spectralMix);
  const fillBlue = mix(0.45, 0.88 - hueBlue * 0.43, spectralMix);
  target[offset] *= 1 - fillRed * amount;
  target[offset + 1] *= 1 - fillGreen * amount;
  target[offset + 2] *= 1 - fillBlue * amount;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const progress = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return progress * progress * (3 - 2 * progress);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function mix(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}
