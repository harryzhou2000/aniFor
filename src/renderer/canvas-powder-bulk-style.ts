import { RenderOptics } from './render-optics';
import { Material } from '../shared/materials';

const STABILITY_MINIMUM = 224;
const DENSITY_MINIMUM = 0.66 * 255;
const SUPPORT_MINIMUM = 5.5;
const SUPPORT_BYTE_TO_COUNT = 9 / 255;
// A newly settled shoulder retains seventy percent of its original albedo
// variation, and a genuinely dense stable core retains seventy-six percent.
// This keeps the field-owned silhouette calm without ironing the mineral
// cadence out of a Smooth pile. Loose material and explicit Grains/Local stay
// on their existing paths before this helper is reached.
const CANONICAL_BLEND_SHOULDER = 0.30;
const CANONICAL_BLEND_CORE = 0.24;
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
  material = Material.Empty,
  worldX = 0,
  worldY = 0,
  mesostrataEnabled = true,
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
  // only field-dense interiors. Keep substantially more exact cell albedo in
  // the core: at 1x–4x presentation the later composed raster legitimately
  // filters a sub-cell facet, so aggressively converging this cell-scale
  // signal leaves a Smooth pile visibly airbrushed. The field still owns only
  // the outer silhouette; this RGB-only residual cannot alter it.
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

  // The broad powder field owns the calm exterior, while this strictly
  // deep-body term adds a sparse, slope-aware compaction cadence to the three
  // common earth materials. It deliberately follows the exact same stable
  // bulk proof above: loose grains, fine structures, Local/Grains callers,
  // trait/emissive owners, walls, and wet-sediment replacement never reach
  // this RGB-only arithmetic. Retaining the pre-existing per-cell mineral
  // albedo underneath prevents a Smooth pile from becoming airbrushed.
  if (bodyDepthEnabled && mesostrataEnabled) applyCanvasSettledPowderMesostrata(
    color, material, worldX, worldY, gradientXByte, gradientYByte,
    densityByte, supportByte,
  );

  const peak = Math.max(color[0], color[1], color[2]);
  if (peak > OUTPUT_PEAK) {
    const headroomScale = OUTPUT_PEAK / peak;
    color[0] *= headroomScale;
    color[1] *= headroomScale;
    color[2] *= headroomScale;
  }
}

/**
 * Gives deep Sand, Stone, Clay, and Concrete a restrained, world-anchored compaction
 * cadence. The caller has already proved stable, exact-material bulk support;
 * this helper allocates nothing and changes RGB only.
 */
function applyCanvasSettledPowderMesostrata(
  color: Float32Array,
  material: number,
  worldX: number,
  worldY: number,
  gradientXByte: number,
  gradientYByte: number,
  densityByte: number,
  supportByte: number,
): void {
  let style = 0;
  if (material === Material.Sand) style = 1;
  else if (material === Material.Stone) style = 2;
  else if (material === Material.Concrete) style = 3;
  else if (material === Material.Clay) style = 4;
  else return;

  const slopeX = (gradientXByte - 128) / 127;
  const slopeY = (gradientYByte - 128) / 127;
  const slopeMagnitude = clamp(Math.hypot(slopeX, slopeY) * 0.72, 0, 1);
  const volumeDepth = Math.max(
    clamp((densityByte - DENSITY_MINIMUM) / (255 - DENSITY_MINIMUM), 0, 1),
    clamp((supportByte * SUPPORT_BYTE_TO_COUNT - SUPPORT_MINIMUM) / (9 - SUPPORT_MINIMUM), 0, 1) * 0.88,
  );
  const x = Math.floor(worldX);
  const y = Math.floor(worldY);
  // The perpendicular component follows the established field slope; the
  // small fixed basis keeps a settled flat core coherent without inventing a
  // neighbour sample or a time-varying direction.
  const phase = x * (-slopeY * 0.195 + 0.037 * style)
    + y * (slopeX * 0.195 + 0.061 * style) + style * 0.173;
  const band = 1 - Math.abs(positiveFraction(phase) * 2 - 1);
  const signedBand = (band - 0.5) * 2;
  // A flat settled Stone body still needs a readable mineral cadence at Canvas
  // fit view. Sand/Clay/Concrete continue to reserve most of their strata for
  // actual slopes, while Stone keeps a stronger calm-core floor that makes a
  // broad natural bed distinguishable from a flat grey fallback plane.
  const slopeBase = style === 2 ? 0.58 : 0.30;
  const gain = (slopeBase + slopeMagnitude * (1 - slopeBase))
    * (0.34 + volumeDepth * 0.66);
  let red = 0;
  let green = 0;
  let blue = 0;
  if (style === 1) { // Sand: warm compressed strata with a cool shaded side.
    red = 7; green = 3; blue = -4;
  } else if (style === 2) { // Stone: a visible cool bedding, not a pixel grain field.
    red = 14; green = 17; blue = 23;
  } else if (style === 3) { // Concrete: cool aggregate density, not courses.
    red = 8; green = 7; blue = 8;
  } else { // Clay: slightly warmer lamellae and denser terracotta pockets.
    red = 6; green = 1; blue = -3;
  }
  // Stone's longer-cadence cool bedding needs to survive the Canvas 2x
  // downsample, but all mineral layers share this explicit eight-byte cap.
  // The same existing confidence gate keeps it out of grains, thin bodies,
  // holes, contacts, walls, and every non-Smooth style.
  color[0] = clamp(color[0] + clamp(red * signedBand * gain, -8, 8), 0, 255);
  color[1] = clamp(color[1] + clamp(green * signedBand * gain, -8, 8), 0, 255);
  color[2] = clamp(color[2] + clamp(blue * signedBand * gain, -8, 8), 0, 255);
}

function positiveFraction(value: number): number {
  return value - Math.floor(value);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
