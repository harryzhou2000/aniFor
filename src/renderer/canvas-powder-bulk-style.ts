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
const BODY_DEPTH_MIDPOINT = 212;
const BODY_DEPTH_TONE_LIMIT = 0.014;
const BODY_DEPTH_TONE_PER_BYTE = BODY_DEPTH_TONE_LIMIT / (255 - BODY_DEPTH_MIDPOINT);
const BODY_SLOPE_CHROMA_SHARE = 0.35;
const BODY_CHROMA_DARK_LIMIT = -0.035;
const BODY_CHROMA_LIGHT_LIMIT = 0.040;
const BODY_KEY_EXPOSURE = 1.15;
const BODY_SHADOW_EXPOSURE = 0.85;
const BODY_KEY_RED = 1.00;
const BODY_KEY_GREEN = 0.82;
const BODY_KEY_BLUE = 0.56;
const BODY_SHADOW_RED = 0.72;
const BODY_SHADOW_GREEN = 0.62;
const BODY_SHADOW_BLUE = 0.50;
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
 * A restrained mineral key/fill then separates the field-supported shoulder
 * from the dense core without changing coverage, ownership, or fine structures.
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
  bodyDepthEnabled = true,
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

  // The packed field density supplies one broad depth coordinate even where a
  // flat heap has no directional slope. Keep this response deliberately below
  // the existing relief: it gives a settled body a warm shoulder and absorbing
  // core while the retained per-cell/facet variation still reads as powder.
  if (bodyDepthEnabled) {
    const depthTone = clamp(
      (BODY_DEPTH_MIDPOINT - densityByte) * BODY_DEPTH_TONE_PER_BYTE,
      -BODY_DEPTH_TONE_LIMIT,
      BODY_DEPTH_TONE_LIMIT,
    );
    const bodyResponse = clamp(
      relief * BODY_SLOPE_CHROMA_SHARE + depthTone,
      BODY_CHROMA_DARK_LIMIT,
      BODY_CHROMA_LIGHT_LIMIT,
    );
    if (bodyResponse > 0) {
      const amount = bodyResponse * BODY_KEY_EXPOSURE;
      color[0] += (255 - color[0]) * BODY_KEY_RED * amount;
      color[1] += (255 - color[1]) * BODY_KEY_GREEN * amount;
      color[2] += (255 - color[2]) * BODY_KEY_BLUE * amount;
    } else if (bodyResponse < 0) {
      const amount = -bodyResponse * BODY_SHADOW_EXPOSURE;
      color[0] *= 1 - BODY_SHADOW_RED * amount;
      color[1] *= 1 - BODY_SHADOW_GREEN * amount;
      color[2] *= 1 - BODY_SHADOW_BLUE * amount;
    }
  }

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
