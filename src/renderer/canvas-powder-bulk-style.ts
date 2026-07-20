const STABILITY_MINIMUM = 224;
const DENSITY_MINIMUM = 0.66 * 255;
const SUPPORT_MINIMUM = 5.5;
const SUPPORT_BYTE_TO_COUNT = 9 / 255;
const CANONICAL_BLEND_MAX = 0.62;
const GRADIENT_BYTE_SCALE = 508;
const RELIEF_DARK_LIMIT = -0.07;
const RELIEF_LIGHT_LIMIT = 0.08;
const RELIEF_X = -0.55 * 4;
const RELIEF_Y = -0.80 * 4;
const OUTPUT_PEAK = 254;

/**
 * Proves that an occupied powder cell belongs to a deep exact-material body.
 * Two cells of depth reject shallow ledges, while one same-row lateral rejects
 * narrow columns. The caller remains responsible for phase and stability.
 */
export function canvasPowderBulkDepth(
  materials: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  material: number,
): 0 | 1 {
  if (material === 0 || width < 3 || height < 3
    || x <= 0 || x + 1 >= width || y < 0 || y + 2 >= height) return 0;
  const index = y * width + x;
  if (materials[index + width] !== material
    || materials[index + width * 2] !== material) return 0;
  return materials[index - 1] === material || materials[index + 1] === material ? 1 : 0;
}

/**
 * Pulls stable, field-supported powder bulk toward its canonical albedo, then
 * applies a small directional scalar relief from the shared signed gradients.
 * This is an allocation-free RGB-only presentation transform.
 */
export function applyCanvasPowderBulkStyle(
  color: Float32Array,
  canonicalRed: number,
  canonicalGreen: number,
  canonicalBlue: number,
  stabilityByte: number,
  densityByte: number,
  gradientXByte: number,
  gradientYByte: number,
  supportByte: number,
  bulkDepth: number,
): void {
  // Temporal hysteresis already happens in BoundaryStabilityField. A second
  // trio of smoothsteps here made a fully powder-filled Canvas several
  // milliseconds slower while only stretching the one-time settle transition.
  if (bulkDepth <= 0 || stabilityByte < STABILITY_MINIMUM
    || densityByte <= DENSITY_MINIMUM
    || supportByte * SUPPORT_BYTE_TO_COUNT <= SUPPORT_MINIMUM) return;

  const blend = CANONICAL_BLEND_MAX;
  color[0] += (canonicalRed - color[0]) * blend;
  color[1] += (canonicalGreen - color[1]) * blend;
  color[2] += (canonicalBlue - color[2]) * blend;

  const directedSlope = clamp(
    (gradientXByte - 128) / GRADIENT_BYTE_SCALE * RELIEF_X
      + (gradientYByte - 128) / GRADIENT_BYTE_SCALE * RELIEF_Y,
    -1,
    1,
  );
  const relief = (directedSlope < 0
    ? directedSlope * -RELIEF_DARK_LIMIT
    : directedSlope * RELIEF_LIGHT_LIMIT);
  const scale = 1 + relief;
  color[0] *= scale;
  color[1] *= scale;
  color[2] *= scale;

  const peak = Math.max(color[0], color[1], color[2]);
  if (peak > OUTPUT_PEAK) {
    const headroomScale = OUTPUT_PEAK / peak;
    color[0] *= headroomScale;
    color[1] *= headroomScale;
    color[2] *= headroomScale;
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
