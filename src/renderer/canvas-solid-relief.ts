import { isGranularOptics, RENDER_OPTICS_CLASS_COUNT, RenderOptics } from './render-optics';
import { RenderProfile } from './render-profile';
import { Material } from '../shared/materials';

const SMOOTH_TRIANGLE_128 = Float32Array.from({ length: 128 }, (_, phase) => {
  const triangle = 1 - Math.abs(phase - 64) / 32;
  return triangle * (1.5 - 0.5 * triangle * triangle);
});
const PROFILE_COUNT = 7;
const OPTICS_PROFILE_COUNT = RENDER_OPTICS_CLASS_COUNT * PROFILE_COUNT;
const RELIEF_X = new Int8Array(OPTICS_PROFILE_COUNT);
const RELIEF_Y = new Int8Array(OPTICS_PROFILE_COUNT);
const RELIEF_STRENGTH = new Float32Array(OPTICS_PROFILE_COUNT);
const INTERIOR_COHESION = new Float32Array(OPTICS_PROFILE_COUNT);
const BODY_DEPTH = new Float32Array(OPTICS_PROFILE_COUNT);
const BODY_RELIEF = new Float32Array(OPTICS_PROFILE_COUNT);
const BODY_SPECULAR = new Float32Array(OPTICS_PROFILE_COUNT);
const BODY_EDGE = new Float32Array(OPTICS_PROFILE_COUNT);
const BODY_TINT_RED = new Float32Array(OPTICS_PROFILE_COUNT);
const BODY_TINT_GREEN = new Float32Array(OPTICS_PROFILE_COUNT);
const BODY_TINT_BLUE = new Float32Array(OPTICS_PROFILE_COUNT);
const BODY_THICKNESS = new Float32Array(OPTICS_PROFILE_COUNT);
const BODY_ABSORB_RED = new Float32Array(OPTICS_PROFILE_COUNT);
const BODY_ABSORB_GREEN = new Float32Array(OPTICS_PROFILE_COUNT);
const BODY_ABSORB_BLUE = new Float32Array(OPTICS_PROFILE_COUNT);
for (let index = 0; index < OPTICS_PROFILE_COUNT; index++) {
  const optics = Math.floor(index / PROFILE_COUNT);
  const profile = index % PROFILE_COUNT;
  let axisX = 2;
  let axisY = 1;
  let strength = 6.5;
  let cohesion = 0.28;
  let bodyDepth = 10;
  let bodyRelief = 0.50;
  let bodySpecular = 1.0;
  let bodyEdge = 1.0;
  let tintRed = 0.80;
  let tintGreen = 0.90;
  let tintBlue = 1.0;
  let bodyThickness = 16;
  let absorbRed = 0.88;
  let absorbGreen = 0.80;
  let absorbBlue = 0.68;
  if (isGranularOptics(optics) || profile === RenderProfile.Granular) {
    axisX = 0; axisY = 0; strength = 0; cohesion = 0;
    bodyDepth = 4; bodyRelief = 0.20; bodySpecular = 0.35; bodyEdge = 0.50;
    tintRed = 0.90; tintGreen = 0.90; tintBlue = 0.85;
    bodyThickness = 10; absorbRed = 0.82; absorbGreen = 0.78; absorbBlue = 0.72;
  } else if (optics === RenderOptics.SmoothRigid || optics === RenderOptics.Cellular) {
    axisX = 2; axisY = 1; strength = 7.0; cohesion = 0.46;
    bodyDepth = 15; bodyRelief = 0.65; bodySpecular = 2.4; bodyEdge = 1.8;
    tintRed = 0.50; tintGreen = 0.90; tintBlue = 1.35;
    bodyThickness = 23; absorbRed = 0.94; absorbGreen = 0.84; absorbBlue = 0.70;
  } else if (optics === RenderOptics.Organic) {
    axisX = 1; axisY = 4; strength = 6.0; cohesion = 0.30;
    bodyDepth = 11; bodyRelief = 0.45; bodySpecular = 1.5; bodyEdge = 1.2;
    tintRed = 0.65; tintGreen = 1.20; tintBlue = 0.55;
    bodyThickness = 18; absorbRed = 0.94; absorbGreen = 0.72; absorbBlue = 0.96;
  } else if (optics === RenderOptics.Device) {
    axisX = 4; axisY = 0; strength = 4.5; cohesion = 0.40;
    bodyDepth = 17; bodyRelief = 0.60; bodySpecular = 3.0; bodyEdge = 2.2;
    tintRed = 0.40; tintGreen = 1.15; tintBlue = 1.65;
    bodyThickness = 25; absorbRed = 1.00; absorbGreen = 0.84; absorbBlue = 0.62;
  } else if (optics === RenderOptics.Radioactive) {
    axisX = 3; axisY = -2; strength = 5.5; cohesion = 0.26;
    bodyDepth = 14; bodyRelief = 0.55; bodySpecular = 2.4; bodyEdge = 1.7;
    tintRed = 0.35; tintGreen = 1.45; tintBlue = 0.70;
    bodyThickness = 21; absorbRed = 0.96; absorbGreen = 0.62; absorbBlue = 0.92;
  } else if (optics === RenderOptics.TranslucentRigid) {
    axisX = 2; axisY = 1; strength = 6.0; cohesion = 0.50;
    // Keep the body absorption restrained so Ice's low-alpha wall facets retain
    // their signed positive/negative redistribution after Uint8 composition.
    bodyDepth = 8; bodyRelief = 0.35; bodySpecular = 3.4; bodyEdge = 2.8;
    tintRed = 0.45; tintGreen = 1.05; tintBlue = 1.70;
    bodyThickness = 13; absorbRed = 1.00; absorbGreen = 0.78; absorbBlue = 0.54;
  } else if (profile === RenderProfile.Rigid) {
    axisX = 2; axisY = 1; strength = 7.0; cohesion = 0.46;
    bodyDepth = 15; bodyRelief = 0.65; bodySpecular = 2.4; bodyEdge = 1.8;
    tintRed = 0.50; tintGreen = 0.90; tintBlue = 1.35;
    bodyThickness = 23; absorbRed = 0.94; absorbGreen = 0.84; absorbBlue = 0.70;
  } else if (profile === RenderProfile.Organic) {
    axisX = 1; axisY = 4; strength = 6.0; cohesion = 0.30;
    bodyDepth = 11; bodyRelief = 0.45; bodySpecular = 1.5; bodyEdge = 1.2;
    tintRed = 0.65; tintGreen = 1.20; tintBlue = 0.55;
    bodyThickness = 18; absorbRed = 0.94; absorbGreen = 0.72; absorbBlue = 0.96;
  } else if (profile === RenderProfile.Device) {
    axisX = 4; axisY = 0; strength = 4.5; cohesion = 0.40;
    bodyDepth = 17; bodyRelief = 0.60; bodySpecular = 3.0; bodyEdge = 2.2;
    tintRed = 0.40; tintGreen = 1.15; tintBlue = 1.65;
    bodyThickness = 25; absorbRed = 1.00; absorbGreen = 0.84; absorbBlue = 0.62;
  } else if (profile === RenderProfile.Radioactive) {
    axisX = 3; axisY = -2; strength = 5.5; cohesion = 0.26;
    bodyDepth = 14; bodyRelief = 0.55; bodySpecular = 2.4; bodyEdge = 1.7;
    tintRed = 0.35; tintGreen = 1.45; tintBlue = 0.70;
    bodyThickness = 21; absorbRed = 0.96; absorbGreen = 0.62; absorbBlue = 0.92;
  }
  RELIEF_X[index] = axisX;
  RELIEF_Y[index] = axisY;
  RELIEF_STRENGTH[index] = strength;
  INTERIOR_COHESION[index] = cohesion;
  BODY_DEPTH[index] = bodyDepth;
  BODY_RELIEF[index] = bodyRelief;
  BODY_SPECULAR[index] = bodySpecular;
  BODY_EDGE[index] = bodyEdge;
  BODY_TINT_RED[index] = tintRed;
  BODY_TINT_GREEN[index] = tintGreen;
  BODY_TINT_BLUE[index] = tintBlue;
  BODY_THICKNESS[index] = bodyThickness;
  BODY_ABSORB_RED[index] = absorbRed;
  BODY_ABSORB_GREEN[index] = absorbGreen;
  BODY_ABSORB_BLUE[index] = absorbBlue;
}

/**
 * One band-limited, family-directed wave for dense solid interiors. The
 * module-static smoothed-triangle table maps directly to WebGL's cubic and the
 * caller adds its scalar equally to RGB, preserving hue and alpha/silhouettes.
 */
export function canvasSolidRelief(
  x: number,
  y: number,
  material: number,
  profile: number,
  optics: number,
): number {
  const index = optics * PROFILE_COUNT + profile;
  if (RELIEF_STRENGTH[index] === 0) return 0;
  const phase = (x * RELIEF_X[index] + y * RELIEF_Y[index] + material * 11) & 127;
  return SMOOTH_TRIANGLE_128[phase] * RELIEF_STRENGTH[index];
}

/** RGB-only attenuation of cell-frequency styling in proven solid interiors. */
export function canvasSolidInteriorCohesion(profile: number, optics: number): number {
  return INTERIOR_COHESION[optics * PROFILE_COUNT + profile];
}

/** Adds solid lighting and uniformly compresses only over-range highlights. */
export function applyCanvasSolidLighting(color: Float32Array, light: number): void {
  color[0] += light;
  color[1] += light;
  color[2] += light;
  compressSolidPeak(color);
}

/**
 * Adds family-aware body depth using only lighting and relief values already
 * computed for the semantic solid cell. Dense interiors receive bounded
 * absorption plus a broad tinted reflection; exposed edges retain the old
 * scalar contour light with only a restrained family-coloured rim. RGB is the
 * only mutable state, so ownership, alpha, reconstruction, and silhouettes are
 * unaffected and reconstructed empty support cannot enter this path.
 */
export function applyCanvasSolidBodyOptics(
  color: Float32Array,
  surfaceLight: number,
  normalLight: number,
  relief: number,
  denseInterior: boolean,
  profile: number,
  optics: number,
  opticalDepthByte = 0,
  opticalDepthEnabled = true,
): void {
  const index = optics * PROFILE_COUNT + profile;
  // Dense bodies replace the old neutral macro band with the family-coloured
  // response below. Exposed contours keep their established scalar light.
  applyCanvasSolidLighting(color, denseInterior ? surfaceLight - relief : surfaceLight);
  if (!denseInterior) {
    const rim = Math.max(0, Math.min(1, normalLight / 18)) * BODY_EDGE[index];
    color[0] += BODY_TINT_RED[index] * rim;
    color[1] += BODY_TINT_GREEN[index] * rim;
    color[2] += BODY_TINT_BLUE[index] * rim;
    compressSolidPeak(color);
    return;
  }

  const absorption = Math.max(0, BODY_DEPTH[index] - relief * BODY_RELIEF[index]);
  const depthScale = 1 - absorption / 255;
  color[0] *= depthScale;
  color[1] *= depthScale;
  color[2] *= depthScale;
  const reflection = BODY_SPECULAR[index] * (0.35 + Math.max(0, relief) / 7);
  color[0] += BODY_TINT_RED[index] * reflection;
  color[1] += BODY_TINT_GREEN[index] * reflection;
  color[2] += BODY_TINT_BLUE[index] * reflection;
  // Depth zero is an exact surface and six is only one cell below it. Begin
  // absorption after that first protected layer so narrow strokes, holes, and
  // small authored details retain their established RGB while genuinely thick
  // bodies gain a coherent surface-to-core falloff.
  if (opticalDepthEnabled && opticalDepthByte > 6) {
    const linearDepth = (opticalDepthByte - 6) / 249;
    const shapedDepth = linearDepth * (1.4 - linearDepth * 0.4);
    const thickness = BODY_THICKNESS[index] / 255 * shapedDepth;
    color[0] *= 1 - BODY_ABSORB_RED[index] * thickness;
    color[1] *= 1 - BODY_ABSORB_GREEN[index] * thickness;
    color[2] *= 1 - BODY_ABSORB_BLUE[index] * thickness;

    // Turn the existing signed, family-directed macro height into a restrained
    // chromatic reflection on crowns and spectral absorption in pockets. The
    // response starts beyond the protected first layer and reaches full weight
    // after seven exact-species cells. Screen-like highlights and multiplicative
    // shadows each remain below ten bytes, so this reads at fit view without
    // flattening material texture or clipping a channel.
    const reliefStrength = RELIEF_STRENGTH[index];
    if (reliefStrength > 0 && relief !== 0) {
      const depthProgress = Math.min(1, Math.max(0, (opticalDepthByte - 6) / 36));
      const depthSupport = depthProgress * depthProgress * (3 - 2 * depthProgress);
      const signedResponse = Math.max(-1, Math.min(1, relief / reliefStrength)) * depthSupport;
      const responseBytes = Math.min(10, 6 + BODY_SPECULAR[index] * 1.4);
      if (signedResponse > 0) {
        const tintPeak = Math.max(
          BODY_TINT_RED[index], BODY_TINT_GREEN[index], BODY_TINT_BLUE[index],
        );
        // A crown is a reflected fill, not emitted light. Keep it below the
        // pocket response so deep radioactive/device bodies still read as
        // optically thick across a complete macro wave.
        const highlight = signedResponse * responseBytes * 0.55;
        color[0] += (255 - color[0]) / 255 * BODY_TINT_RED[index] / tintPeak * highlight;
        color[1] += (255 - color[1]) / 255 * BODY_TINT_GREEN[index] / tintPeak * highlight;
        color[2] += (255 - color[2]) / 255 * BODY_TINT_BLUE[index] / tintPeak * highlight;
      } else if (signedResponse < 0) {
        const shadow = -signedResponse * responseBytes / 255;
        color[0] *= 1 - BODY_ABSORB_RED[index] * shadow;
        color[1] *= 1 - BODY_ABSORB_GREEN[index] * shadow;
        color[2] *= 1 - BODY_ABSORB_BLUE[index] * shadow;
      }
    }
  }
  compressSolidPeak(color);
}

function compressSolidPeak(color: Float32Array): void {
  const peak = Math.max(color[0], color[1], color[2]);
  if (peak <= 254) return;
  const scale = 254 / peak;
  color[0] *= scale;
  color[1] *= scale;
  color[2] *= scale;
}

/**
 * Adds a broad, signed, nearly luminance-neutral spectral band inside exact
 * Glass and Ice. The caller supplies the already computed solid relief, so the
 * effect adds no pattern lookup, field sample, allocation, or animation. Glass
 * keeps one coherent band while Ice reverses and softens it like a frosted
 * facet. RGB changes only; alpha and reconstructed support remain authoritative.
 */
export function applyCanvasTranslucentCaustic(
  color: Float32Array,
  relief: number,
  material: number,
): void {
  const gain = material === Material.Glass ? 1.0
    : material === Material.Ice ? -0.42 : 0;
  if (gain === 0 || relief === 0) return;
  const split = relief * gain;
  color[0] += split;
  color[1] -= split * 0.176;
  color[2] -= split * 1.20;
}

/**
 * Gives exact Glass and Ice a broad body shell without sampling another field.
 * `relief` is the existing signed macro height and `edgeLight` is the caller's
 * already-computed semantic contour response. The operation is RGB-only and
 * intentionally leaves every other translucent-rigid material unchanged.
 */
export function applyCanvasTranslucentLensShell(
  color: Float32Array,
  relief: number,
  edgeLight: number,
  material: number,
): void {
  if (material !== Material.Glass && material !== Material.Ice) return;
  const rim = Math.min(7, Math.abs(edgeLight) * 0.32);
  const absoluteRelief = Math.abs(relief);
  if (material === Material.Glass) {
    const crown = Math.max(0, relief) * 1.15;
    const valley = Math.max(0, -relief);
    const scale = 1 - (1.5 + valley * 0.35) / 255;
    color[0] = color[0] * scale + (rim + crown) * 0.45;
    color[1] = color[1] * scale + (rim + crown) * 0.78;
    color[2] = color[2] * scale + rim + crown;
    return;
  }
  const frostedRidge = absoluteRelief * 0.55;
  const scale = 1 - (2.5 + absoluteRelief * 0.20) / 255;
  color[0] = color[0] * scale + (rim * 0.70 + frostedRidge) * 0.58;
  color[1] = color[1] * scale + (rim * 0.70 + frostedRidge) * 0.86;
  color[2] = color[2] * scale + rim * 0.70 + frostedRidge;
}
