import { RenderOptics } from './render-optics';

const STABILITY_MINIMUM = 224;
const DENSITY_MINIMUM = 0.66 * 255;
const SUPPORT_MINIMUM = 5.5;
const SUPPORT_BYTE_TO_COUNT = 9 / 255;
// A newly settled shoulder retains seventy percent of its original albedo
// variation, and a genuinely dense stable core retains sixty-two percent.
// This keeps the field-owned silhouette calm without ironing the mineral
// cadence out of a Smooth pile. Loose material and explicit Grains/Local stay
// on their existing paths before this helper is reached.
const CANONICAL_BLEND_SHOULDER = 0.30;
const CANONICAL_BLEND_CORE = 0.38;
const GRADIENT_BYTE_SCALE = 508;
const RELIEF_DARK_LIMIT = -0.07;
const RELIEF_LIGHT_LIMIT = 0.08;
const RELIEF_X = -0.55 * 4;
const RELIEF_Y = -0.80 * 4;
const BODY_SHOULDER_LIGHT = 0.030;
const BODY_CORE_ABSORPTION = -0.052;
const BODY_DIRECTIONAL_SHOULDER = 0.060;
const BODY_DIRECTIONAL_CORE = 0.045;
const BODY_CHROMA_DARK_LIMIT = -0.080;
const BODY_CHROMA_LIGHT_LIMIT = 0.085;
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
 * A restrained family key/fill then separates the field-supported shoulder
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
  optics: RenderOptics = RenderOptics.RoughGranular,
): void {
  // Temporal hysteresis already happens in BoundaryStabilityField. A second
  // trio of smoothsteps here made a fully powder-filled Canvas several
  // milliseconds slower while only stretching the one-time settle transition.
  if (bulkDepth <= 0 || stabilityByte < STABILITY_MINIMUM
    || densityByte <= DENSITY_MINIMUM
    || supportByte * SUPPORT_BYTE_TO_COUNT <= SUPPORT_MINIMUM) return;

  const crystalline = optics === RenderOptics.CrystallineGranular;
  const sooty = optics === RenderOptics.SootyGranular;
  const metallic = optics === RenderOptics.MetallicGranular;
  const baseBlend = crystalline ? 0.38 : sooty ? 0.46 : metallic ? 0.40
    : CANONICAL_BLEND_SHOULDER;
  // This runs only after the caller proved an exact stable Smooth-powder body.
  // Keep the shoulder's established per-cell material character, then calm
  // only field-dense interiors toward the WebGL core's 32% grain retention.
  // Density is already the shared powder support; no neighbour scan, field,
  // allocation, silhouette, alpha, or semantic ownership decision is added.
  const coreProgress = clamp((densityByte / 255 - 0.68) / (0.85 - 0.68), 0, 1);
  const blend = baseBlend + (CANONICAL_BLEND_CORE - baseBlend) * coreProgress;
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

  // The packed field supplies a broad family-aware volume: low-density shoulders
  // receive an upper-left key, the opposing slope becomes a warm fill/shadow,
  // and the densest supported core absorbs light. Existing cell/facet detail is
  // applied later, so the bulk remains powder rather than becoming wax.
  if (bodyDepthEnabled) {
    const shoulderLight = crystalline ? 0.040 : sooty ? 0.012 : metallic ? 0.036
      : BODY_SHOULDER_LIGHT;
    const coreAbsorption = crystalline ? -0.044 : sooty ? -0.070 : metallic ? -0.058
      : BODY_CORE_ABSORPTION;
    const directionalShoulder = crystalline ? 0.065 : sooty ? 0.030 : metallic ? 0.072
      : BODY_DIRECTIONAL_SHOULDER;
    const directionalCore = crystalline ? 0.040 : sooty ? 0.025 : metallic ? 0.050
      : BODY_DIRECTIONAL_CORE;
    const keyRed = crystalline ? 0.72 : sooty ? 0.78 : metallic ? 1.00 : BODY_KEY_RED;
    const keyGreen = crystalline ? 0.92 : sooty ? 0.72 : metallic ? 0.78 : BODY_KEY_GREEN;
    const keyBlue = crystalline ? 1.00 : sooty ? 0.62 : metallic ? 0.42 : BODY_KEY_BLUE;
    const shadowRed = crystalline ? 0.86 : sooty ? 0.92 : metallic ? 0.82 : BODY_SHADOW_RED;
    const shadowGreen = crystalline ? 0.72 : sooty ? 0.86 : metallic ? 0.70 : BODY_SHADOW_GREEN;
    const shadowBlue = crystalline ? 0.62 : sooty ? 0.78 : metallic ? 0.60 : BODY_SHADOW_BLUE;
    const familyResponse = crystalline ? 0.98 : sooty ? 0.58 : metallic ? 1.08 : 1;
    const bodyDensity = clamp(
      (densityByte - DENSITY_MINIMUM) / (255 - DENSITY_MINIMUM), 0, 1,
    );
    const supportDepth = clamp(
      (supportByte * SUPPORT_BYTE_TO_COUNT - SUPPORT_MINIMUM) / (9 - SUPPORT_MINIMUM), 0, 1,
    );
    const volumeDepth = Math.max(bodyDensity, supportDepth * 0.88);
    const depthTone = shoulderLight
      + (coreAbsorption - shoulderLight) * volumeDepth;
    const directionalGain = directionalShoulder
      + (directionalCore - directionalShoulder) * volumeDepth;
    const bodyResponse = clamp(
      directedSlope * directionalGain + depthTone,
      BODY_CHROMA_DARK_LIMIT,
      BODY_CHROMA_LIGHT_LIMIT,
    ) * familyResponse;
    if (bodyResponse > 0) {
      const amount = bodyResponse * BODY_KEY_EXPOSURE;
      color[0] += (255 - color[0]) * keyRed * amount;
      color[1] += (255 - color[1]) * keyGreen * amount;
      color[2] += (255 - color[2]) * keyBlue * amount;
    } else if (bodyResponse < 0) {
      const amount = -bodyResponse * BODY_SHADOW_EXPOSURE;
      color[0] *= 1 - shadowRed * amount;
      color[1] *= 1 - shadowGreen * amount;
      color[2] *= 1 - shadowBlue * amount;
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
