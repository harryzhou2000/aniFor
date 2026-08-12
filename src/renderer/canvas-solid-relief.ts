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
const DEEP_INTERIOR_COHESION = new Float32Array(OPTICS_PROFILE_COUNT);
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
  let deepCohesion = 0.48;
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
    deepCohesion = 0;
    bodyDepth = 4; bodyRelief = 0.20; bodySpecular = 0.35; bodyEdge = 0.50;
    tintRed = 0.90; tintGreen = 0.90; tintBlue = 0.85;
    bodyThickness = 10; absorbRed = 0.82; absorbGreen = 0.78; absorbBlue = 0.72;
  } else if (optics === RenderOptics.SmoothRigid || optics === RenderOptics.Cellular
    || optics === RenderOptics.MetallicRigid) {
    axisX = 2; axisY = 1; strength = 7.0; cohesion = 0.46;
    // Preserve a restrained amount of the already-authored material cadence
    // in a genuinely thick rigid core. The old 78% pull toward canonical
    // palette made broad Metal/Stone/Concrete bodies read as a flat plastic
    // swatch once the separate depth optics had done their work. This remains
    // RGB-only and only applies after the exact-species depth proof.
    deepCohesion = 0.66;
    // Thick rigid bodies are the primary normal-fit solid surface. Give their
    // already-proven broad relief enough reflected range to read as material
    // volume rather than a neutral flat card; alpha and every contour remain
    // owned by the semantic/optical-depth paths below.
    bodyDepth = 15; bodyRelief = 0.65; bodySpecular = 4.0; bodyEdge = 1.8;
    tintRed = 0.50; tintGreen = 0.90; tintBlue = 1.35;
    bodyThickness = 23; absorbRed = 0.94; absorbGreen = 0.84; absorbBlue = 0.70;
  } else if (optics === RenderOptics.Organic) {
    axisX = 1; axisY = 4; strength = 6.0; cohesion = 0.30;
    deepCohesion = 0.56;
    bodyDepth = 11; bodyRelief = 0.45; bodySpecular = 1.5; bodyEdge = 1.2;
    tintRed = 0.65; tintGreen = 1.20; tintBlue = 0.55;
    bodyThickness = 18; absorbRed = 0.94; absorbGreen = 0.72; absorbBlue = 0.96;
  } else if (optics === RenderOptics.Device) {
    axisX = 4; axisY = 0; strength = 4.5; cohesion = 0.40;
    deepCohesion = 0.70;
    bodyDepth = 17; bodyRelief = 0.60; bodySpecular = 3.0; bodyEdge = 2.2;
    tintRed = 0.40; tintGreen = 1.15; tintBlue = 1.65;
    bodyThickness = 25; absorbRed = 1.00; absorbGreen = 0.84; absorbBlue = 0.62;
  } else if (optics === RenderOptics.Radioactive) {
    axisX = 3; axisY = -2; strength = 5.5; cohesion = 0.26;
    deepCohesion = 0.50;
    bodyDepth = 14; bodyRelief = 0.55; bodySpecular = 2.4; bodyEdge = 1.7;
    tintRed = 0.35; tintGreen = 1.45; tintBlue = 0.70;
    bodyThickness = 21; absorbRed = 0.96; absorbGreen = 0.62; absorbBlue = 0.92;
  } else if (optics === RenderOptics.TranslucentRigid) {
    axisX = 2; axisY = 1; strength = 6.0; cohesion = 0.50;
    deepCohesion = 0.70;
    // Keep the body absorption restrained so Ice's low-alpha wall facets retain
    // their signed positive/negative redistribution after Uint8 composition.
    bodyDepth = 8; bodyRelief = 0.35; bodySpecular = 3.4; bodyEdge = 2.8;
    tintRed = 0.45; tintGreen = 1.05; tintBlue = 1.70;
    bodyThickness = 13; absorbRed = 1.00; absorbGreen = 0.78; absorbBlue = 0.54;
  } else if (profile === RenderProfile.Rigid) {
    axisX = 2; axisY = 1; strength = 7.0; cohesion = 0.46;
    deepCohesion = 0.66;
    bodyDepth = 15; bodyRelief = 0.65; bodySpecular = 4.0; bodyEdge = 1.8;
    tintRed = 0.50; tintGreen = 0.90; tintBlue = 1.35;
    bodyThickness = 23; absorbRed = 0.94; absorbGreen = 0.84; absorbBlue = 0.70;
  } else if (profile === RenderProfile.Organic) {
    axisX = 1; axisY = 4; strength = 6.0; cohesion = 0.30;
    deepCohesion = 0.56;
    bodyDepth = 11; bodyRelief = 0.45; bodySpecular = 1.5; bodyEdge = 1.2;
    tintRed = 0.65; tintGreen = 1.20; tintBlue = 0.55;
    bodyThickness = 18; absorbRed = 0.94; absorbGreen = 0.72; absorbBlue = 0.96;
  } else if (profile === RenderProfile.Device) {
    axisX = 4; axisY = 0; strength = 4.5; cohesion = 0.40;
    deepCohesion = 0.70;
    bodyDepth = 17; bodyRelief = 0.60; bodySpecular = 3.0; bodyEdge = 2.2;
    tintRed = 0.40; tintGreen = 1.15; tintBlue = 1.65;
    bodyThickness = 25; absorbRed = 1.00; absorbGreen = 0.84; absorbBlue = 0.62;
  } else if (profile === RenderProfile.Radioactive) {
    axisX = 3; axisY = -2; strength = 5.5; cohesion = 0.26;
    deepCohesion = 0.50;
    bodyDepth = 14; bodyRelief = 0.55; bodySpecular = 2.4; bodyEdge = 1.7;
    tintRed = 0.35; tintGreen = 1.45; tintBlue = 0.70;
    bodyThickness = 21; absorbRed = 0.96; absorbGreen = 0.62; absorbBlue = 0.92;
  }
  RELIEF_X[index] = axisX;
  RELIEF_Y[index] = axisY;
  RELIEF_STRENGTH[index] = strength;
  INTERIOR_COHESION[index] = cohesion;
  DEEP_INTERIOR_COHESION[index] = deepCohesion;
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

/**
 * RGB-only attenuation of cell-frequency styling in proven solid interiors.
 *
 * The first exact interior layer retains its established response.  Only a
 * cell already proven deep by the phase-local optical-depth field trades more
 * micro texture for the existing broad body relief, so the renderer never
 * erases a thin stroke, authored hole, contact, or contour to make a block
 * appear smoother.
 */
export function canvasSolidInteriorCohesion(
  profile: number,
  optics: number,
  opticalDepthByte = 6,
  opticalDepthEnabled = true,
): number {
  const index = optics * PROFILE_COUNT + profile;
  const cohesion = INTERIOR_COHESION[index];
  if (!opticalDepthEnabled || opticalDepthByte <= 6) return cohesion;
  const progress = Math.max(0, Math.min(1, (opticalDepthByte - 6) / 36));
  const smoothProgress = progress * progress * (3 - 2 * progress);
  return cohesion + (DEEP_INTERIOR_COHESION[index] - cohesion) * smoothProgress;
}

/** Adds solid lighting and uniformly compresses only over-range highlights. */
export function applyCanvasSolidLighting(color: Float32Array, light: number): void {
  color[0] += light;
  color[1] += light;
  color[2] += light;
  compressSolidPeak(color);
}

/**
 * Adds the missing Canvas counterpart to WebGL's ordinary-solid grazing
 * environment response. The caller supplies the already-classified Hermite
 * density and analytic contour gradient, so this is RGB-only arithmetic: it
 * cannot change alpha, ownership, coverage, topology, fields, or allocations.
 * Granular matter deliberately keeps its existing categorical/noisy look.
 */
export function applyCanvasSolidContourFresnelRim(
  target: Uint8ClampedArray,
  offset: number,
  density: number,
  gradientX: number,
  gradientY: number,
  optics: number,
): void {
  if (density <= 0.08 || density >= 0.92 || isGranularOptics(optics)) return;
  const gradientLengthSquared = gradientX * gradientX + gradientY * gradientY;
  if (gradientLengthSquared <= 1e-8) return;
  const contour = smoothstep(0.08, 0.42, density)
    * (1 - smoothstep(0.58, 0.92, density));
  if (contour <= 0) return;
  // Match the direct mesh's normal-Z/Fresnel construction with only the
  // Canvas contour's existing analytic slope. A slight slope scale keeps the
  // 2x rim legible without becoming a white outline at 4x/8x.
  const normalZ = 1 / Math.sqrt(1 + gradientLengthSquared * 0.90);
  const fresnel = (1 - normalZ) * (1 - normalZ);
  const gain = optics === RenderOptics.TranslucentRigid ? 0.19
    : optics === RenderOptics.SmoothRigid || optics === RenderOptics.Cellular
      || optics === RenderOptics.MetallicRigid ? 0.17
    : optics === RenderOptics.Device ? 0.16
    : optics === RenderOptics.Radioactive ? 0.14
    : optics === RenderOptics.Organic ? 0.12 : 0.11;
  // Six source bytes is a hard visual ceiling, including the strongest
  // translucent contour. The positive environment response deliberately
  // complements the existing signed key/fill rather than replacing it.
  const rim = Math.min(6, 255 * contour * fresnel * gain);
  if (rim <= 0) return;
  const gradientLength = Math.sqrt(gradientLengthSquared);
  const keyFacing = Math.max(0, (-gradientX * 0.48 - gradientY * 0.68) / gradientLength);
  const exposure = rim * (0.72 + keyFacing * 0.28);
  let red = 0.50;
  let green = 0.68;
  let blue = 0.90;
  if (optics === RenderOptics.SmoothRigid || optics === RenderOptics.Cellular
    || optics === RenderOptics.MetallicRigid) {
    red = 0.46; green = 0.80; blue = 1;
  } else if (optics === RenderOptics.Organic) {
    red = 0.56; green = 0.82; blue = 0.48;
  } else if (optics === RenderOptics.Device) {
    red = 0.38; green = 0.82; blue = 1;
  } else if (optics === RenderOptics.Radioactive) {
    red = 0.36; green = 1; blue = 0.64;
  } else if (optics === RenderOptics.TranslucentRigid) {
    red = 0.44; green = 0.84; blue = 1;
  }
  target[offset] += (255 - target[offset]) / 255 * red * exposure;
  target[offset + 1] += (255 - target[offset + 1]) / 255 * green * exposure;
  target[offset + 2] += (255 - target[offset + 2]) / 255 * blue * exposure;
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

function smoothstep(start: number, end: number, value: number): number {
  const progress = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return progress * progress * (3 - 2 * progress);
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
 * Gives the translucent-rigid family a broad body shell without sampling another field.
 * `relief` is the existing signed macro height and `edgeLight` is the caller's
 * already-computed semantic contour response. Glass and Ice retain their
 * existing stronger branches; the remaining crystal family receives a quieter
 * material-specific shell. The operation is RGB-only.
 */
export function applyCanvasTranslucentLensShell(
  color: Float32Array,
  relief: number,
  edgeLight: number,
  material: number,
  opticalDepthByte = 0,
): void {
  if (material !== Material.Glass && material !== Material.Ice
    && material !== Material.DRIC && material !== Material.NICE
    && material !== Material.QRTZ && material !== Material.RIME) return;
  const rim = Math.min(7, Math.abs(edgeLight) * 0.32);
  const absoluteRelief = Math.abs(relief);
  if (material === Material.Glass) {
    // Canvas composites this translucent shell after the local body pass, so it
    // needs a modest alpha-compensation over the direct WebGL crown to retain
    // the same fit-view macro relief. It reuses signed relief and is RGB-only.
    const crown = Math.max(0, relief) * 2.0;
    const valley = Math.max(0, -relief);
    const scale = 1 - (1.5 + valley * 0.35) / 255;
    color[0] = color[0] * scale + (rim + crown) * 0.45;
    color[1] = color[1] * scale + (rim + crown) * 0.78;
    color[2] = color[2] * scale + rim + crown;
    // Match the normal WebGL glass core with the already-maintained
    // exact-species thickness byte. The first interior layer stays an exact
    // no-op; only a proven deep pane receives this cool transmission/absorption
    // cue. This is RGB-only and cannot affect the separate backdrop, alpha,
    // semantic coverage, wall ownership, or any reconstruction decision.
    const glassDepth = smoothstep(6, 42, opticalDepthByte);
    color[0] *= 1 - glassDepth * 0.042;
    color[1] *= 1 - glassDepth * 0.0105;
    color[2] += (255 - color[2]) * glassDepth * 0.0225;
    return;
  }
  if (material === Material.Ice) {
    const frostedRidge = absoluteRelief * 0.55;
    const scale = 1 - (2.5 + absoluteRelief * 0.20) / 255;
    color[0] = color[0] * scale + (rim * 0.70 + frostedRidge) * 0.58;
    color[1] = color[1] * scale + (rim * 0.70 + frostedRidge) * 0.86;
    color[2] = color[2] * scale + rim * 0.70 + frostedRidge;
    return;
  }
  if (material === Material.QRTZ) {
    const crown = Math.max(0, relief) * 0.72;
    const valley = Math.max(0, -relief);
    const prismScale = 1 - (1.1 + valley * 0.16) / 255;
    color[0] = color[0] * prismScale + (rim + crown) * 0.48;
    color[1] = color[1] * prismScale + (rim + crown) * 0.72;
    color[2] = color[2] * prismScale + (rim + crown) * 0.94;
    return;
  }
  const frost = absoluteRelief * 0.34;
  const crystalScale = 1 - (1.4 + absoluteRelief * 0.14) / 255;
  if (material === Material.DRIC) {
    color[0] = color[0] * crystalScale + (rim * 0.46 + frost) * 0.62;
    color[1] = color[1] * crystalScale + (rim * 0.46 + frost) * 0.80;
    color[2] = color[2] * crystalScale + rim * 0.46 + frost;
    return;
  }
  if (material === Material.NICE) {
    const coolRim = rim * 0.52 + frost * 1.20;
    color[0] = color[0] * crystalScale + coolRim * 0.50;
    color[1] = color[1] * crystalScale + coolRim * 0.84;
    color[2] = color[2] * crystalScale + coolRim * 1.15;
    return;
  }
  color[0] = color[0] * crystalScale + (rim * 0.42 + frost) * 0.60;
  color[1] = color[1] * crystalScale + (rim * 0.42 + frost) * 0.82;
  color[2] = color[2] * crystalScale + rim * 0.42 + frost;
}
