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
  float enabled,
  float materialLightingVariant
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
  // One shared profile response replaces phase-specific A/B lighting deltas.
  // Off remains an exact multiplicative identity. Normal HDR supplies the
  // live profile; compact true-8x passes literal Off and retains exact output.
  float lightingExperiment = step(0.5, materialLightingVariant);
  float lightingExperimentB = step(1.5, materialLightingVariant);
  float sharedLightingWeight = powder * 0.78 + liquid + gas * 0.90;
  float sharedKeyScale = 1.0 + lightingExperiment * sharedLightingWeight
    * mix(0.18, 0.52, lightingExperimentB);
  float sharedFillScale = 1.0 + lightingExperiment * sharedLightingWeight
    * mix(0.16, 0.46, lightingExperimentB);
  float sharedPigmentScale = 1.0 + lightingExperiment * sharedLightingWeight
    * mix(0.08, 0.24, lightingExperimentB);
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
  key *= bodySupport * finishResponse.x * (1.0 - core * (0.18 + gas * 0.18))
    * sharedKeyScale;
  fill *= bodySupport * finishResponse.y * sharedFillScale;

  color += (vec3(1.08) - clamp(color, 0.0, 1.08)) * keyTint * key;
  color *= vec3(1.0) - shadowTint * fill;

  // Volumetric powder keeps its existing mineral cadence, but the stable bulk
  // receives a broad shallow-to-core countershade. The caller's settled Smooth
  // eligibility is the sole admission proof: Local, Grains, moving particles,
  // holes, thin structures, and unlike contacts never enter this response.
  // Compact true-8x supplies literal Off, so this normal-HDR B refinement is
  // RGB-only and cannot alter coverage, alpha, or the compact material grammar.
  float powderCountershade = powder * lightingExperimentB * bodySupport;
  float powderShallowKey = powderCountershade * (1.0 - core)
    * (0.050 + max(facing, 0.0) * 0.025) * finishResponse.x;
  float powderDeepFill = powderCountershade * core
    * (0.040 + max(-facing, 0.0) * 0.016) * finishResponse.y;
  color += (vec3(1.10) - clamp(color, 0.0, 1.10))
    * keyTint * powderShallowKey;
  color *= vec3(1.0) - shadowTint * powderDeepFill;

  // Let the existing optical profile's transmission lane distinguish a pale
  // crystalline shell from a dense sooty or metallic one. This remains a
  // broad-body B-only response: the caller still owns topology and excludes
  // Local/Grains, motion, wet mixtures, fine structures, contacts, and halos.
  // Compact true-8x passes literal Off, preserving its bounded shader path.
  float powderShellTransmission = powderCountershade * shell
    * finishResponse.w * (0.040 + max(facing, 0.0) * 0.024);
  vec3 powderTransmissionTint = mix(
    keyTint, mix(vec3(0.96), identityTint, 0.56), 0.42
  );
  color += (vec3(1.08) - clamp(color, 0.0, 1.08))
    * powderTransmissionTint * powderShellTransmission;

  // Give every reconstructed body one coherent grazing-light vocabulary. The
  // existing shell and facing proofs decide where a reflection can live, while
  // the optical profile's reflection/transmission lanes decide its strength
  // and pigment keeps it species-aware. Powder stays deliberately restrained
  // so mineral grain remains dominant; liquid and gas receive the clearer
  // curved-shell cue. This B-only term is RGB-only and compact true-8x passes
  // literal Off, so it cannot alter support, topology, or the bounded path.
  float profileSheenWeight = powder * 0.18 + liquid + gas * 0.78;
  float profileGrazing = 1.0 - abs(clamp(facing, -1.0, 1.0));
  float profileSheen = lightingExperimentB * eligibility * shell
    * profileSheenWeight * finishResponse.x
    * (0.100 + profileGrazing * profileGrazing * 0.300)
    * mix(0.55, 1.0, clamp(finishResponse.w / 1.40, 0.0, 1.0));
  vec3 profileSheenTint = mix(
    vec3(0.78, 0.89, 1.00), mix(vec3(0.98), identityTint, 0.38), 0.48
  );
  color += (vec3(1.10) - clamp(color, 0.0, 1.10))
    * profileSheenTint * profileSheen;

  // Dense volumes keep their pigment instead of collapsing toward grey. This
  // is a bounded saturation lift over existing RGB and cannot affect alpha.
  float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
  float pigment = bodySupport * core
    * (0.018 + powder * 0.018 + liquid * 0.010) * finishResponse.z
    * sharedPigmentScale;
  color += (color - vec3(luminance)) * pigment;
  return max(color, vec3(0.0));
}

// Place every reconstructed phase in the same emitter-lit scene. The caller
// already samples the shared emission field and owns all matter/support proofs;
// this helper only converts that existing centre sample, body response, and
// optical profile into a B-only RGB contribution. It deliberately performs no
// texture read and cannot create coverage, alpha, topology, or a new owner.
vec3 applyMaterialProfileIrradiance(
  vec3 color,
  float phase,
  vec4 finishResponse,
  float density,
  float depth,
  vec2 slope,
  float eligibility,
  vec4 emissionState,
  float lightIncidence,
  float enabled,
  float materialLightingVariant
) {
  float lightingExperimentB = step(1.5, materialLightingVariant);
  float lightReach = smoothstep(0.002, 0.42, emissionState.a);
  if (enabled < 0.5 || lightingExperimentB < 0.5
    || eligibility <= 0.0001 || lightReach <= 0.0001) return color;

  float powder = 1.0 - step(0.5, phase);
  float liquid = step(0.5, phase) * (1.0 - step(1.5, phase));
  float gas = step(1.5, phase) * (1.0 - step(2.5, phase));
  float solid = step(2.5, phase);
  float body = smoothstep(0.035, 0.42, density) * eligibility;
  float bodyDepth = clamp(depth, 0.0, 1.0);
  float slopeLength = length(slope);
  vec2 bodyNormal = slopeLength > 0.0001 ? -slope / slopeLength : vec2(0.0);
  // A normal-directed field probe is the authoritative source-facing proof at
  // high quality. Retain a small shared key fallback for flat/compact-quality
  // bodies so the response degrades continuously rather than becoming a hard
  // quality seam; the probe remains the dominant directional term.
  float sourceFacing = clamp(
    lightIncidence
      + max(dot(bodyNormal, normalize(vec2(-0.58, -0.815))), 0.0) * 0.24,
    0.0, 1.0
  );

  // Reflection/transmission lanes define transport while the pigment lane
  // keeps diffuse powder and deep gas from converging on the same glossy tint.
  float transport = powder * (
      finishResponse.x * 0.30 + finishResponse.z * 0.16
    ) + liquid * (
      finishResponse.x * 0.34 + finishResponse.w * 0.46
    ) + gas * (
      finishResponse.x * 0.16 + finishResponse.w * 0.58
    ) + solid * (
      finishResponse.x * 0.38 + finishResponse.w * 0.26
    );
  float phaseGain = powder * 0.62 + liquid + gas * 0.82 + solid * 0.76;

  // Carry external light through the body according to the same profile lanes
  // used by every phase finish. Absorption divided by transmission is a compact
  // optical-thickness proxy: clean gas, clear liquid, Glass, and Ice preserve a
  // broader illuminated middle, while soot, powder, and opaque rigid bodies
  // keep the source-facing lift close to their shell. The rational envelope is
  // bounded, branch-free, and uses no additional field or texture sample.
  float opticalAbsorption = clamp(
    finishResponse.y / max(finishResponse.w, 0.50), 0.35, 2.40
  );
  float transmissionReserve = clamp(
    (finishResponse.w - 0.50) / 1.0, 0.0, 1.0
  );
  float penetrationPath = bodyDepth
    * (powder + liquid * 0.78 + gas * 0.58 + solid * 0.92);
  float penetration = 1.0 / (
    1.0 + penetrationPath * opticalAbsorption * 1.10
  );
  float shallowTransport = (0.020 + sourceFacing * 0.140)
    * mix(0.88, 1.0, penetration);
  // Deep carriage is primarily an external-source response. Retain a small
  // continuous fallback for flat/low-quality bodies, but symmetric or internal
  // field light cannot receive the same through-body reach as positive outward
  // contrast from the caller's two-sided probe.
  float externalTransport = mix(0.30, 1.0, clamp(lightIncidence, 0.0, 1.0));
  float deepTransport = bodyDepth * (0.026 + gas * 0.018)
    * penetration * mix(0.55, 1.15, transmissionReserve) * externalTransport;
  float irradiance = lightReach * body * transport * phaseGain
    * (shallowTransport + deepTransport);

  float lightPeak = max(max(emissionState.r, emissionState.g), max(emissionState.b, 0.08));
  vec3 lightTint = clamp(emissionState.rgb / lightPeak, 0.0, 1.0);
  float identityPeak = max(max(color.r, color.g), max(color.b, 0.12));
  vec3 identityTint = clamp(color / identityPeak, 0.0, 1.0);
  float pigmentCoupling = powder * 0.44 + liquid * 0.24 + gas * 0.16 + solid * 0.34;
  // Let receiver pigment absorb the shared source spectrum progressively with
  // optical depth.  High-transmission profiles retain the emitted hue through
  // clean gas, water, Glass, and Ice; low-transmission profiles move soot,
  // oils, powder, and opaque rigid bodies gently toward their own pigment.
  // This is the chromatic counterpart of the scalar penetration envelope
  // above and uses the same profile lane rather than a thermal/material branch.
  float pigmentTransport = clamp(
    pigmentCoupling * (
      0.45 + (1.0 - transmissionReserve) * bodyDepth * 0.85
    ),
    0.0, 0.62
  );
  vec3 absorbedLightTint = lightTint * mix(vec3(0.72), identityTint, 0.58);
  vec3 irradianceTint = mix(lightTint, absorbedLightTint, pigmentTransport);
  color += (vec3(1.12) - clamp(color, 0.0, 1.12))
    * irradianceTint * irradiance;
  return max(color, vec3(0.0));
}

// B-only normal-HDR lighting for exact, supported solid bodies. The solid
// compositor already owns normals, optical depth, contact rejection, and
// family classification; this helper only turns those proofs into a shared
// key/fill/transmission vocabulary. Its response is RGB-only and material
// identity comes from the existing optics profile rather than an element ID.
vec3 applySolidMaterialLighting(
  vec3 color,
  vec4 finishResponse,
  float opticalDepth,
  vec3 normal,
  float eligibility,
  float enabled,
  float materialLightingVariant
) {
  if (enabled < 0.5 || materialLightingVariant < 1.5 || eligibility <= 0.0001) {
    return color;
  }

  float body = smoothstep(6.0 / 255.0, 42.0 / 255.0, opticalDepth) * eligibility;
  float core = smoothstep(24.0 / 255.0, 116.0 / 255.0, opticalDepth);
  float facing = dot(normal, normalize(vec3(-0.42, -0.62, 0.78)));
  float grazing = pow(1.0 - clamp(normal.z, 0.0, 1.0), 2.0);
  float shell = body * (1.0 - core);

  float key = body * (max(facing, 0.0) * 0.040 + grazing * 0.025)
    * finishResponse.x;
  float transmission = shell * (0.032 + grazing * 0.045) * finishResponse.w;
  // Optical classes which explicitly reserve extra transmission can carry a
  // little light into the first connected body layers, rather than reading as
  // one bright silhouette rim. The profile lane, not an exact material ID,
  // decides admission; opaque/default families retain the existing shell-only
  // response. This is RGB-only over the compositor-owned body/depth proof.
  float interiorTransmission = body * (1.0 - core)
    * (0.010 + grazing * 0.018 + max(facing, 0.0) * 0.010)
    * max(finishResponse.w - 1.0, 0.0);
  float fill = body * (core * 0.032 + max(-facing, 0.0) * 0.019)
    * finishResponse.y;
  // The ordinary linear lane stays restrained for rigid, translucent,
  // organic, and radioactive bodies. Profiles that deliberately reserve the
  // upper fill range gain a deeper core shoulder, allowing a dense enclosure
  // response without a material/class branch or a brighter false emission.
  fill += body * core * max(finishResponse.y - 1.25, 0.0) * 0.18;

  float identityPeak = max(max(color.r, color.g), max(color.b, 0.12));
  vec3 identityTint = clamp(color / identityPeak, 0.0, 1.0);
  vec3 keyTint = mix(vec3(0.78, 0.88, 1.0), mix(vec3(0.94), identityTint, 0.48), 0.46);
  vec3 shadowTint = mix(vec3(0.48, 0.56, 0.68), mix(vec3(0.52), identityTint, 0.24), 0.30);
  color += (vec3(1.08) - clamp(color, 0.0, 1.08))
    * keyTint * (key + transmission + interiorTransmission);
  color *= vec3(1.0) - shadowTint * fill;

  float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color += (color - vec3(luminance)) * body * core * 0.018 * finishResponse.z;
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
    * mix(0.18, 1.75, opticalExperimentB);
  float gasExtinctionScale = 1.0 + gas * opticalExperiment
    * mix(0.65, 4.25, opticalExperimentB);
  // Variant B may strengthen the cloud's existing field-proven lobe, but it
  // must not invent another noise field or grow support. Convex crowns and
  // lit shoulders catch a little more transmitted light while concave pockets
  // and deep cores retain a complementary, pigment-tinted shadow. Variant A
  // and Off remain byte-for-byte on the established path.
  float gasOpticalCharacter = gas * opticalExperimentB;
  // Sooty families deliberately retain more pigment and absorption than clean
  // gases, but that authored profile can otherwise let B read as a dark slab
  // with only a bright rim. Detect the family through its existing optical
  // response lanes (never a material ID), open a little transmitted middle,
  // and ease only the deepest B absorption. Clean gases stay on the shared
  // cloud response. This is RGB-only over proven gas support.
  float sootyGasCharacter = gasOpticalCharacter
    * smoothstep(1.04, 1.24, finishResponse.y)
    * (1.0 - smoothstep(0.66, 0.98, finishResponse.w));
  // A connected shallow liquid body can be nearly level, leaving its local
  // normal and curvature close to zero across most of a broad pool. Square the
  // existing transmission proof into a recognisable upper shallow zone while
  // letting the directional term below remain the brighter moving crest. Blend
  // only the authored reflection/transmission lanes so oily and aqueous bodies
  // retain distinct response. This remains RGB-only and field/depth-gated: it
  // cannot grow a shore or bridge an unlike-material contact.
  float liquidShallowBand = transmittedShoulder * transmittedShoulder
    * opticalExperimentB;
  float liquidBroadTransmission = liquidShallowBand
    * finishResponse.w * (0.160 + crown * 0.040);
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
  key += sootyGasCharacter * gasMidTransmission
    * (0.026 + max(macroRelief, 0.0) * 0.018) * finishResponse.x;
  key += max(macroRelief, 0.0) * gasMacroBody * 0.052;
  key += gasOpticalCharacter
    * (crown * fieldBody * 0.026 + max(facing, 0.0) * shoulder * 0.016)
    * finishResponse.w;
  key *= finishResponse.x;
  // Transmission is a separate optical lane: applying it after reflection
  // scaling keeps aqueous and oily bodies distinct instead of multiplying the
  // authored response by the reflection lane a second time.
  key += liquidBroadTransmission;
  float shade = (pocket * mix(0.030, 0.038, gas)
      + max(-facing, 0.0) * shoulder * mix(0.010, 0.014, gas)
      + core * mix(0.010, 0.007, gas)) * fieldBody;
  shade += deepColumn * 0.032 * liquidCoreScale;
  shade += gasDeepAbsorption * 0.024 * gasExtinctionScale;
  shade += max(-macroRelief, 0.0) * gasMacroBody * 0.036;
  shade += gasOpticalCharacter
    * (pocket * fieldBody * 0.022 + max(-facing, 0.0) * shoulder * 0.010
      + gasDeepAbsorption * 0.014);
  shade *= finishResponse.y;
  shade *= mix(1.0, 0.82, sootyGasCharacter * core);
  color += (vec3(1.08) - clamp(color, 0.0, 1.08)) * keyTint * key;
  color *= vec3(1.0) - absorptionTint * shade;
  // Preserve authored pigment through the existing deep-volume proofs instead
  // of letting connected transparent bodies and dense clouds converge on one
  // grey absorption. The liquid column and gas core keep separate restrained
  // phase coefficients, while the optical profile remains the sole family
  // distinction. This is B-only and RGB-only; shores, wisps, contacts, alpha,
  // and compact literal-Off stay owned by their callers.
  float fluidDeepPigment = opticalExperimentB * finishResponse.z
    * (liquid * deepColumn * 0.016 + gasDeepAbsorption * 0.024);
  float fluidLuminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color += (color - vec3(fluidLuminance)) * fluidDeepPigment;
  return max(color, vec3(0.0));
}
`;
