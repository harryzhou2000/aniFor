import { MATERIAL_APPEARANCE_PROFILE_GLSL_SELECTOR } from './material-appearance-profiles';
import { RECONSTRUCTED_VOLUME_OPTICS_GLSL } from './reconstructed-volume-optics';

/**
 * Scale-safe RGB finish shared by the normal and compact WebGL compositors.
 *
 * Callers retain ownership of phase support, topology, alpha, and material
 * identity. The helper consumes only their already-proven body measurements,
 * so enabling it cannot grow a silhouette or manufacture matter. Keeping this
 * source in one module also prevents the 1x-4x and true-8x shaders from
 * developing unrelated lighting vocabularies while the HDR transport remains
 * intentionally normal-scale only.
 */
export const MATERIAL_BODY_FINISH_GLSL = `
// Convert the two liquid-body proofs already carried by both compositors into
// one perceptual depth. Field interior establishes connected matter; exact
// vertical optical depth then lets a shallow surface recede into a deep body.
// Keeping this normalization beside the shared finish prevents normal WebGL
// and the compact true-8x path from assigning unrelated meanings to depth.
float liquidBodyFinishDepth(
  float fieldInterior,
  float verticalOpticalDepth
) {
  float connectedBody = clamp(fieldInterior, 0.0, 1.0);
  float columnDepth = smoothstep(
    30.0 / 255.0, 78.0 / 255.0, clamp(verticalOpticalDepth, 0.0, 1.0)
  );
  return connectedBody * mix(0.34, 1.0, columnDepth);
}

// Compact optical response shared by every body-finish stage. The four lanes
// are key/reflection, fill/absorption, pigment retention, and transmission.
// Callers evaluate this once and reuse it, which matters when SwiftShader must
// shade roughly fifteen million true-8x fragments. The closed numeric values
// are RenderOptics classes, never exact material IDs.
${MATERIAL_APPEARANCE_PROFILE_GLSL_SELECTOR}
${RECONSTRUCTED_VOLUME_OPTICS_GLSL}

vec3 applyMaterialBodyFinish(
  vec3 color,
  float phase,
  vec4 finishResponse,
  float density,
  float depth,
  vec2 slope,
  float eligibility,
  float enabled
) {
  if (enabled < 0.5 || eligibility <= 0.0001) return color;

  float bodySupport = smoothstep(0.055, 0.42, density) * eligibility;
  float slopeLength = length(slope);
  vec2 bodyNormal = slopeLength > 0.0001 ? slope / slopeLength : vec2(0.0);
  float facing = dot(bodyNormal, normalize(vec2(-0.58, -0.815)));
  float shell = smoothstep(0.055, 0.34, density)
    * (1.0 - smoothstep(0.62, 0.94, density));
  float core = smoothstep(0.30, 0.86, depth);

  float powder = 1.0 - step(0.5, phase);
  float gas = step(1.5, phase);
  float liquid = 1.0 - powder - gas;
  vec3 keyTint = powder * vec3(1.00, 0.76, 0.46)
    + liquid * vec3(0.64, 0.86, 1.00)
    + gas * vec3(0.72, 0.82, 1.00);
  vec3 shadowTint = powder * vec3(0.74, 0.54, 0.34)
    + liquid * vec3(0.58, 0.68, 0.80)
    + gas * vec3(0.54, 0.60, 0.72);
  // Pull the key and fill gently toward the live material pigment. Optical
  // classes control the response strength while palette RGB preserves actual
  // species identity, avoiding one generic orange/blue finish for all matter.
  float identityPeak = max(max(color.r, color.g), max(color.b, 0.12));
  vec3 identityTint = clamp(color / identityPeak, 0.0, 1.0);
  keyTint = mix(keyTint, mix(vec3(0.92), identityTint, 0.42), 0.38);
  shadowTint = mix(shadowTint, mix(vec3(0.50), identityTint, 0.26), 0.28);

  // One restrained key/fill model gives all reconstructed bodies the same
  // light direction. Gas favours a broad shoulder, liquid a grazing lip, and
  // powder a rougher crown; these are phase coefficients, never material IDs.
  float grazing = 1.0 - clamp(slopeLength * 2.4, 0.0, 1.0);
  float key = max(facing, 0.0) * (0.026 + powder * 0.018 + liquid * 0.014)
    + shell * (0.010 + liquid * 0.018 + gas * 0.014)
    + liquid * grazing * shell * 0.010;
  float fill = max(-facing, 0.0) * (0.012 + powder * 0.010 + gas * 0.008)
    + core * (0.010 + powder * 0.010 + gas * 0.006);
  key *= bodySupport * finishResponse.x * (1.0 - core * (0.18 + gas * 0.18));
  fill *= bodySupport * finishResponse.y;

  color += (vec3(1.08) - clamp(color, 0.0, 1.08)) * keyTint * key;
  color *= vec3(1.0) - shadowTint * fill;

  // Dense volumes keep their pigment instead of collapsing toward grey. This
  // is a bounded saturation lift over existing RGB and cannot affect alpha.
  float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
  float pigment = bodySupport * core
    * (0.018 + powder * 0.018 + liquid * 0.010) * finishResponse.z;
  color += (color - vec3(luminance)) * pigment;
  return max(color, vec3(0.0));
}

// Cheap world-space billow basis for the direct true-8x compositor. Two broad
// triangular folds avoid sine evaluation across roughly fifteen million
// fragments while remaining anchored in simulation cells rather than output
// pixels. Their oblique overlap reads as cloud lobes rather than scan lines.
float gasCompactMacroRelief(vec2 position) {
  float foldA = 1.0 - 4.0 * abs(
    fract(dot(position, vec2(0.026, 0.017)) + 0.15) - 0.5
  );
  float foldB = 1.0 - 4.0 * abs(
    fract(dot(position, vec2(-0.015, 0.031)) + 0.52) - 0.5
  );
  return clamp(foldA * 0.62 + foldB * 0.38, -1.0, 1.0);
}

// Mesoscopic liquid/gas relief shared by normal WebGL and the direct true-8x
// compositor. Callers pass the centre and cardinal mean they already sampled;
// this deliberately adds no texture read, target, field, or scale-dependent
// allocation. The response is RGB-only and therefore cannot grow support or
// blur a species/contact boundary.
vec3 applyFluidVolumeLobe(
  vec3 color,
  float phase,
  vec4 finishResponse,
  float density,
  float neighbourMean,
  float curvature,
  float depth,
  vec2 slope,
  float macroRelief,
  float eligibility,
  float enabled,
  float materialLightingVariant
) {
  if (enabled < 0.5 || eligibility <= 0.0001) return color;

  float gas = step(1.5, phase);
  float liquid = 1.0 - gas;
  vec3 keyTint = liquid * vec3(0.58, 0.82, 1.00)
    + gas * vec3(0.70, 0.82, 1.00);
  vec3 absorptionTint = liquid * vec3(0.34, 0.48, 0.64)
    + gas * vec3(0.40, 0.46, 0.58);
  float identityPeak = max(max(color.r, color.g), max(color.b, 0.12));
  vec3 identityTint = clamp(color / identityPeak, 0.0, 1.0);
  keyTint = mix(keyTint, mix(vec3(0.94), identityTint, 0.36), 0.42);
  absorptionTint = mix(absorptionTint, mix(vec3(0.46), identityTint, 0.30), 0.32);
  float fieldBody = smoothstep(0.055 - gas * 0.045, 0.52 - gas * 0.28,
    min(density, max(neighbourMean, density * 0.62))) * eligibility;
  float signedCurvature = clamp(curvature, -1.0, 1.0);
  float crown = max(signedCurvature, 0.0);
  float pocket = max(-signedCurvature, 0.0);
  float slopeLength2 = dot(slope, slope);
  float facing = 0.0;
  if (slopeLength2 > 0.00001) {
    vec2 outward = -slope * inversesqrt(slopeLength2);
    facing = dot(outward, normalize(vec2(-0.58, -0.815)));
  }
  float shoulder = (1.0 - smoothstep(0.54 - gas * 0.30, 0.94 - gas * 0.28, density))
    * fieldBody;
  float core = smoothstep(0.28, 0.88, depth) * fieldBody;
  // A liquid column needs an optical surface/core read even when its centre
  // and all four cardinal samples are uniformly dense. The shared normalized
  // depth gives that otherwise-flat body a broad transmitted shoulder near
  // the surface and restrained coloured absorption deeper down. Gas keeps its
  // existing density-curvature response; topology and alpha remain caller-owned.
  float transmittedShoulder = liquid
    * (1.0 - smoothstep(0.24, 0.70, depth)) * fieldBody;
  float deepColumn = liquid * smoothstep(0.56, 0.94, depth) * fieldBody;
  // A broad gas billow can be locally uniform after the atmosphere field has
  // merged its particles, making both curvature and slope approach zero. Give
  // that proven volume a restrained translucent middle and denser core so it
  // remains dimensional without restoring particle-scale dots or hard edges.
  // Reuse core rather than evaluating another pair of smoothsteps in the
  // 15-million-fragment true-8x path. The parabolic middle peaks at 0.5 and
  // the squared core remains monotone, giving the same shoulder/core grammar
  // with only bounded multiplies over the already-computed body proof.
  float gasMidTransmission = gas * core * (1.0 - core) * 4.0;
  float gasDeepAbsorption = gas * core * core;
  float gasMacroBody = gas * fieldBody * smoothstep(0.14, 0.64, density)
    * (1.0 - core * 0.22);
  // Reuse the existing material-lighting OFF/A/B control to compare a shared
  // optical transport response. These are phase coefficients over already-live
  // body proofs, never new support or material selectors. Compact true-8x passes
  // literal Off, keeping its established fifteen-million-fragment path exact.
  float opticalExperiment = step(0.5, materialLightingVariant);
  float opticalExperimentB = step(1.5, materialLightingVariant);
  float liquidSurfaceScale = 1.0 + liquid * opticalExperiment
    * mix(0.28, 0.74, opticalExperimentB);
  float liquidCoreScale = 1.0 + liquid * opticalExperiment
    * mix(0.22, 0.66, opticalExperimentB);
  float gasMidScale = 1.0 + gas * opticalExperiment
    * mix(0.10, 0.24, opticalExperimentB);
  float gasExtinctionScale = 1.0 + gas * opticalExperiment
    * mix(0.32, 0.86, opticalExperimentB);
  float liquidTransmissionCrest = transmittedShoulder * finishResponse.w
    * (0.060 + max(facing, 0.0) * 0.045) * liquidSurfaceScale;

  // A broad convex crown and directional shoulder supply a coherent reflected
  // lobe. Concave/deep regions retain pigment through restrained absorption;
  // the two phase palettes share one light direction without erasing identity.
  float key = (crown * mix(0.038, 0.052, gas)
      + max(facing, 0.0) * shoulder * mix(0.026, 0.034, gas))
    * (1.0 - core * mix(0.24, 0.36, gas));
  key += liquidTransmissionCrest;
  key += gasMidTransmission * 0.036 * finishResponse.w * gasMidScale;
  key += max(macroRelief, 0.0) * gasMacroBody * 0.052;
  key *= finishResponse.x;
  float shade = (pocket * mix(0.030, 0.038, gas)
      + max(-facing, 0.0) * shoulder * mix(0.010, 0.014, gas)
      + core * mix(0.010, 0.007, gas)) * fieldBody;
  shade += deepColumn * 0.032 * liquidCoreScale;
  shade += gasDeepAbsorption * 0.024 * gasExtinctionScale;
  shade += max(-macroRelief, 0.0) * gasMacroBody * 0.036;
  shade *= finishResponse.y;
  color += (vec3(1.08) - clamp(color, 0.0, 1.08)) * keyTint * key;
  color *= vec3(1.0) - absorptionTint * shade;
  return max(color, vec3(0.0));
}
`;
