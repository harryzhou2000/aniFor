import { MATERIAL_APPEARANCE_PROFILE_GLSL_SELECTOR } from './material-appearance-profiles';
import { MATERIAL_COMPOSITION_PROFILE_GLSL_SELECTOR } from './material-composition-profiles';
import { MATERIAL_MESOSCALE_PROFILE_GLSL_SELECTOR } from './material-mesoscale-profiles';
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
${MATERIAL_COMPOSITION_PROFILE_GLSL_SELECTOR}
${MATERIAL_MESOSCALE_PROFILE_GLSL_SELECTOR}
${RECONSTRUCTED_VOLUME_OPTICS_GLSL}

// Reusable fixed-cell probe for mesoscopic material form. Callers retain
// ownership of the sampled field and pass one near and one wider cardinal
// stencil from that same field; this helper performs no texture lookup and
// cannot invent support. The wide response is admitted only by a coherent
// occupied neighbourhood, so silhouettes, holes, fine columns, and contacts
// keep the near reconstruction as their authority.
struct MaterialMesoscaleShape {
  vec2 slope;
  float curvature;
  float neighbourMean;
  float coherence;
};
MaterialMesoscaleShape materialMesoscaleShape(
  float centre,
  vec4 nearCardinal,
  vec4 wideCardinal,
  MaterialMesoscaleResponse response
) {
  float nearMean = dot(nearCardinal, vec4(0.25));
  float wideMean = dot(wideCardinal, vec4(0.25));
  float coherence = smoothstep(
    response.supportLow, response.supportHigh, min(centre, min(nearMean, wideMean))
  );
  vec2 nearSlope = vec2(
    nearCardinal.y - nearCardinal.x,
    nearCardinal.w - nearCardinal.z
  );
  // Wide taps are three simulation cells from the centre. Normalize their
  // derivative to the near-cell scale before blending the two observations.
  vec2 wideSlope = vec2(
    wideCardinal.y - wideCardinal.x,
    wideCardinal.w - wideCardinal.z
  ) / max(response.radius, 1.0);
  float nearCurvature = centre - nearMean;
  float wideCurvature = centre - wideMean;
  return MaterialMesoscaleShape(
    mix(nearSlope, wideSlope, coherence * response.slopeBlend),
    clamp(mix(nearCurvature, wideCurvature,
      coherence * response.curvatureBlend) * 7.0, -1.0, 1.0),
    mix(nearMean, wideMean, coherence * response.neighbourBlend),
    coherence
  );
}

vec3 applyMaterialBodyFinish(
  vec3 color,
  float phase,
  vec4 finishResponse,
  float finishRoughness,
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
  MaterialCompositionResponse composition = materialCompositionParameters(phase);
  // One shared profile response replaces phase-specific A/B lighting deltas.
  // Off remains an exact multiplicative identity. Normal HDR supplies the
  // live profile; compact true-8x passes literal Off and retains exact output.
  float lightingExperiment = step(0.5, materialLightingVariant);
  float lightingExperimentB = step(1.5, materialLightingVariant);
  float sharedLightingWeight = composition.bodyLighting;
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
  float interiorContrast = composition.interiorContrast;
  float powderShallowKey = powderCountershade * (1.0 - core)
    * (0.050 + max(facing, 0.0) * 0.025) * finishResponse.x
    * interiorContrast;
  float powderDeepFill = powderCountershade * core
    * (0.040 + max(-facing, 0.0) * 0.016) * finishResponse.y
    * interiorContrast;
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
  float profileSheenWeight = composition.profileSheen;
  float profileGrazing = 1.0 - abs(clamp(facing, -1.0, 1.0));
  // The fifth appearance-profile lane controls lobe width without consuming a
  // palette/style byte or adding a runtime material lookup. Low roughness keeps
  // crystalline, metallic, and translucent families on a tighter, brighter
  // grazing lobe; high roughness spreads a lower-energy shoulder across soot,
  // viscous liquid, organic matter, and ordinary mineral powder. Only B uses
  // this response, so Off/Balanced and compact true-8x retain their established
  // presentation even though they compile the same static profile vocabulary.
  float roughness = clamp(finishRoughness, 0.5, 1.5);
  float roughnessProgress = (roughness - 0.5) / 1.0;
  float profileSheenShape = pow(
    profileGrazing, mix(3.4, 1.25, roughnessProgress)
  ) * mix(1.18, 0.82, roughnessProgress);
  float profileSheen = lightingExperimentB * eligibility * shell
    * profileSheenWeight * finishResponse.x
    * (0.100 + profileSheenShape * 0.300)
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
  float interiorScatter,
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
  MaterialCompositionResponse composition = materialCompositionParameters(phase);
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
  float phaseGain = composition.irradiance;

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
  float penetrationPath = bodyDepth * composition.penetrationPath;
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
  float pigmentCoupling = composition.pigmentCoupling;
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

  // A source-shaped in-scattering lobe gives transmissive matter a readable
  // interior rather than concentrating every cue on its silhouette. The
  // parabola is zero at the exposed shell and deepest core, and the signed
  // transported incidence admits only a genuine external source. Optical
  // transmission controls both strength and retained source colour: Water and
  // clean gas carry the broadest middle, Oil/soot absorb sooner, and settled
  // Smooth powder receives only a restrained mineral-volume cue. Solids keep
  // their separate body-lighting vocabulary. This is B-only RGB arithmetic
  // over existing proofs; it adds no sample, resource, support, or alpha path.
  float positiveExternal = max(lightIncidence, 0.0);
  float midPath = 4.0 * bodyDepth * (1.0 - bodyDepth);
  float phaseScatter = composition.volumeScatter;
  // Solid phase scatter is reserved for genuinely transmissive optical
  // profiles. Glass/Ice carry a high transmission reserve and enter smoothly;
  // ordinary rigid, organic, device, radioactive, and metallic profiles stay
  // below the knee. Liquid, gas, and settled powder retain their established
  // phase response. This uses the existing profile lane rather than an exact
  // material/class branch and cannot create support or emission.
  float clearScatter = smoothstep(1.05, 1.30, finishResponse.w);
  float softScatter = smoothstep(1.10, 1.16, interiorScatter)
    * (1.0 - smoothstep(0.98, 1.08, finishResponse.w));
  float solidScatterAdmission = mix(
    1.0, max(clearScatter, softScatter), solid
  );
  float solidScatterGain = mix(1.0, 2.35, solid * solidScatterAdmission);
  float transportLobe = lightReach * body * positiveExternal * midPath
    * phaseScatter * solidScatterAdmission * interiorScatter * transmissionReserve
    * (0.024 + finishResponse.x * 0.060) * solidScatterGain;
  vec3 transportLobeTint = mix(
    absorbedLightTint, lightTint, mix(0.28, 0.82, transmissionReserve)
  );
  color += (vec3(1.12) - clamp(color, 0.0, 1.12))
    * transportLobeTint * transportLobe;

  // The same two-sided probe also carries a signed far-side response. Turn
  // only that negative half into a broad profile-governed shadow: opaque,
  // absorbent bodies keep a clearer grounded side while transmissive gas,
  // liquid, Glass, and Ice remain softly lit through their volume. Source hue
  // gently colours the missing-light spectrum instead of applying a neutral
  // grey overlay. No extra sample, support decision, or alpha path is added.
  float shadowFacing = max(-lightIncidence, 0.0);
  float shadowAbsorption = mix(
    0.55, 1.0, clamp((opticalAbsorption - 0.35) / 2.05, 0.0, 1.0)
  );
  float shadowPhase = composition.farSideShadow;
  float softShadow = lightReach * body * shadowFacing * shadowAbsorption
    * shadowPhase * (0.045 + bodyDepth * 0.105);
  vec3 shadowSpectrum = mix(
    vec3(0.82), vec3(0.98) - lightTint * 0.28, 0.70
  );
  color *= vec3(1.0) - shadowSpectrum * softShadow;
  return max(color, vec3(0.0));
}

// Source-independent ambient grounding for reconstructed matter. Every caller
// supplies its existing body/depth/slope admission proof, so this helper cannot
// create support or turn unlike contacts into separator lines. Deep, locally
// level matter receives a quiet pigment-aware cavity tone; exposed shells,
// holes, thin structures, and high-gradient boundaries tend continuously to
// zero. Profile transmission opens the ambient response for clear media while
// the new roughness lane lets diffuse families retain a broader grounded mass.
// This is B-only RGB arithmetic on normal WebGL. Canvas and compact true-8x do
// not call it and gain no resource, sample, uniform, allocation, or branch.
vec3 applyMaterialAmbientGrounding(
  vec3 color,
  float phase,
  vec4 finishResponse,
  float finishRoughness,
  float density,
  float depth,
  vec2 slope,
  float eligibility,
  float enabled,
  float materialLightingVariant
) {
  if (enabled < 0.5 || materialLightingVariant < 1.5 || eligibility <= 0.0001) {
    return color;
  }
  float powder = 1.0 - step(0.5, phase);
  float liquid = step(0.5, phase) * (1.0 - step(1.5, phase));
  float gas = step(1.5, phase) * (1.0 - step(2.5, phase));
  float solid = step(2.5, phase);
  MaterialCompositionResponse composition = materialCompositionParameters(phase);
  float body = smoothstep(0.08 - gas * 0.06, 0.52 - gas * 0.28, density)
    * eligibility;
  float interior = smoothstep(0.24, 0.84, clamp(depth, 0.0, 1.0));
  float slopeQuiet = 1.0 - smoothstep(0.018, 0.18, length(slope));
  float cavity = body * interior * mix(0.48, 1.0, slopeQuiet);
  // A proven Smooth powder body receives a second, broader basin response.
  // Unlike a contour shadow, this lives in quiet deep heap interiors and
  // therefore makes valleys/contact mass readable without outlining grains or
  // erasing fine columns. The caller's body gate already excludes moving,
  // sparse, Local, Grains, contacted, and unsupported powder.
  float powderBasin = powder * eligibility
    * smoothstep(0.54, 0.84, density)
    * smoothstep(0.20, 0.70, clamp(depth, 0.0, 1.0))
    * (1.0 - smoothstep(0.028, 0.18, length(slope)));
  float powderBasinOcclusion = min(
    18.0 / 255.0,
    powderBasin * (0.035 + clamp(finishResponse.y, 0.0, 1.0) * 0.030)
  );
  float transmission = clamp((finishResponse.w - 0.50) / 1.0, 0.0, 1.0);
  float roughness = clamp((finishRoughness - 0.5) / 1.0, 0.0, 1.0);
  float phaseGrounding = composition.ambientGrounding;
  float grounding = cavity * phaseGrounding
    * mix(1.08, 0.62, transmission) * mix(0.88, 1.10, roughness)
    * (0.026 + finishResponse.y * 0.032);
  // Bulk powder and supported solid need a broader mass cue than the small
  // cavity term alone. Keep it on dense, optically deep, quiet interiors so a
  // pile gains a settled base and a slab gains weight without drawing a dark
  // contour, filling a hole, or swallowing a thin column. Local/Grains and
  // compact true-8x never enter this helper through their existing call gates.
  float powderOrSolid = max(powder, solid);
  float broadMass = powderOrSolid * body
    * smoothstep(0.36, 0.80, density)
    * smoothstep(0.12, 0.62, clamp(depth, 0.0, 1.0))
    * mix(0.48, 1.0, slopeQuiet);
  float broadMassOcclusion = broadMass * phaseGrounding
    * mix(0.92, 0.58, transmission)
    * (0.050 + roughness * 0.045);
  float identityPeak = max(max(color.r, color.g), max(color.b, 0.12));
  vec3 identityTint = clamp(color / identityPeak, 0.0, 1.0);
  vec3 cavityTint = mix(vec3(0.74, 0.80, 0.88), identityTint, 0.34);
  vec3 massTint = mix(vec3(0.68, 0.74, 0.82), identityTint, 0.44);
  color *= vec3(1.0) - cavityTint * (grounding + powderBasinOcclusion)
    - massTint * broadMassOcclusion;
  return max(color, vec3(0.0));
}

// Source-independent environment transport for reconstructed transmissive
// matter. The compositor already owns body support, optical depth, slope, and
// contact rejection; this helper turns only those proofs into a quiet analytic
// cool-sky/warm-ground hemisphere. It never samples scene colour, so adjacent
// matter cannot leak across a contact and no environment texture or pass is
// needed. The two terms intentionally separate a shell/profile reflection from
// a low-slope interior carry. Both are B-only RGB arithmetic in normal WebGL;
// compact true-8x has no call site. Powder enters only through the caller's
// settled Smooth broad-body proof and carries the lowest phase weight.
vec3 applyMaterialEnvironmentTransport(
  vec3 color,
  float phase,
  vec4 finishResponse,
  float finishRoughness,
  float finishInteriorScatter,
  float density,
  float depth,
  vec2 slope,
  float eligibility,
  float enabled,
  float materialLightingVariant
) {
  if (enabled < 0.5 || materialLightingVariant < 1.5
    || eligibility <= 0.0001) return color;

  float gas = step(1.5, phase) * (1.0 - step(2.5, phase));
  float solid = step(2.5, phase);
  MaterialCompositionResponse composition = materialCompositionParameters(phase);
  float responseWeight = composition.environmentTransport;
  if (responseWeight <= 0.0001) return color;

  float body = smoothstep(0.05 - gas * 0.04, 0.46 - gas * 0.22, density)
    * eligibility;
  float bodyDepth = mix(
    clamp(depth, 0.0, 1.0),
    smoothstep(6.0 / 255.0, 108.0 / 255.0, depth),
    solid
  );
  float slopeLength = length(slope);
  vec3 bodyNormal = normalize(vec3(-slope * 2.2, 1.0));
  float skyFacing = clamp(
    bodyNormal.z * 0.64 - bodyNormal.y * 0.30 + bodyNormal.x * 0.16,
    0.0, 1.0
  );
  float groundFacing = clamp(
    0.42 + bodyNormal.y * 0.42 - bodyNormal.x * 0.10,
    0.0, 1.0
  );
  vec3 environmentTint = mix(
    vec3(0.24, 0.14, 0.075), vec3(0.18, 0.42, 0.68), skyFacing
  );
  environmentTint += vec3(0.20, 0.095, 0.035) * groundFacing * 0.24;

  float transmission = clamp((finishResponse.w - 0.50) / 1.0, 0.0, 1.0);
  float roughness = clamp((finishRoughness - 0.5) / 1.0, 0.0, 1.0);
  // The shared class profile trades a concentrated shell for readable quiet
  // interior transport. This is source-independent B-only RGB arithmetic over
  // the existing body/depth proofs; it cannot manufacture material support.
  float scatterProgress = clamp((finishInteriorScatter - 0.50) / 1.0, 0.0, 1.0);
  float shellConcentration = mix(1.16, 0.84, scatterProgress);
  float interiorOpenness = mix(0.62, 1.48, scatterProgress);
  float shell = body * (1.0 - smoothstep(0.28, 0.82, bodyDepth));
  float horizon = pow(1.0 - clamp(bodyNormal.z, 0.0, 1.0), mix(3.2, 1.15, roughness));
  float shellTransport = shell * finishResponse.x
    * mix(0.22, 1.0, transmission)
    * (0.012 + horizon * mix(0.080, 0.040, roughness)) * shellConcentration;

  float quietInterior = body * smoothstep(0.20, 0.76, bodyDepth)
    * (1.0 - smoothstep(0.025, 0.20, slopeLength));
  float bodyCarry = quietInterior * finishResponse.w
    * mix(0.18, 1.0, transmission) * (0.006 + skyFacing * 0.012)
    * interiorOpenness;
  float transport = responseWeight * (shellTransport + bodyCarry);

  float identityPeak = max(max(color.r, color.g), max(color.b, 0.12));
  vec3 identityTint = clamp(color / identityPeak, 0.0, 1.0);
  vec3 transportTint = mix(environmentTint, identityTint, 0.28 + roughness * 0.18);
  color += (vec3(1.10) - clamp(color, 0.0, 1.10))
    * transportTint * transport;
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
  float finishRoughness,
  float finishInteriorScatter,
  float opticalDepth,
  float reliefPhase,
  vec3 normal,
  float eligibility,
  float enabled,
  float materialLightingVariant
) {
  if (enabled < 0.5 || materialLightingVariant < 1.5 || eligibility <= 0.0001) {
    return color;
  }

  float body = smoothstep(6.0 / 255.0, 42.0 / 255.0, opticalDepth) * eligibility;
  // Relief may move the broad shell/core transition by less than three source
  // depth levels, but never contributes brightness directly. This keeps the
  // existing connected-body relief useful without reviving its rejected
  // diagonal bands as a visible lighting pattern.
  float warpedOpticalDepth = clamp(
    opticalDepth + clamp(reliefPhase, -1.0, 1.0) * (2.5 / 255.0), 0.0, 1.0
  );
  float core = smoothstep(24.0 / 255.0, 116.0 / 255.0, warpedOpticalDepth);
  float facing = dot(normal, normalize(vec3(-0.42, -0.62, 0.78)));
  float grazingBase = 1.0 - clamp(normal.z, 0.0, 1.0);
  float roughness = clamp((finishRoughness - 0.5) / 1.0, 0.0, 1.0);
  float lobeExponent = mix(3.0, 0.86, roughness);
  float lobeEnergy = mix(1.20, 0.72, roughness);
  float grazing = pow(grazingBase, lobeExponent) * lobeEnergy;
  float reflectedFacing = pow(max(facing, 0.0), lobeExponent) * lobeEnergy;
  float shell = body * (1.0 - core);
  float interiorContrast = materialCompositionParameters(3.0).interiorContrast;

  float key = body * (reflectedFacing * 0.040 + grazing * 0.025)
    * finishResponse.x * interiorContrast;
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
    * finishResponse.y * interiorContrast;
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

  // A quiet, supported solid body needs a readable shell-to-core transition,
  // not another silhouette rim. The class profile admits translucent and waxy
  // families while opaque rigid/device/metal families remain effectively off.
  // This reuses the compositor-owned exact optical depth and changes RGB only.
  float scatterProgress = clamp((finishInteriorScatter - 0.50) / 1.0, 0.0, 1.0);
  float transmissionReserve = clamp((finishResponse.w - 0.50) / 1.0, 0.0, 1.0);
  float clearAdmission = smoothstep(1.05, 1.30, finishResponse.w);
  float softAdmission = smoothstep(0.76, 1.18, finishInteriorScatter)
    * smoothstep(0.65, 1.05, finishResponse.w);
  float volumeAdmission = max(clearAdmission, softAdmission);
  float shellToCoreBand = body * (4.0 * core * (1.0 - core));
  float subsurface = shellToCoreBand * volumeAdmission
    * (0.012 + 0.032 * transmissionReserve)
    * (0.72 + 0.56 * scatterProgress);
  vec3 subsurfaceTint = mix(keyTint, identityTint, 0.44 + 0.30 * transmissionReserve);
  color += (vec3(1.08) - clamp(color, 0.0, 1.08))
    * subsurfaceTint * subsurface;

  // Exchange a small amount of the profile's existing optical energy between
  // shell and core. Smooth rigid bodies gain a cooler, tighter skin and a
  // pigment-bearing centre; high-transmission/scatter profiles retain an open
  // luminous interior instead of being darkened into an opaque slab.
  float opaqueReserve = 1.0 - transmissionReserve;
  float shellExchange = shell * (0.005 + (1.0 - roughness) * 0.011)
    * clamp(finishResponse.x, 0.55, 1.45);
  float coreExchange = body * core * (0.005 + finishResponse.z * 0.008)
    * mix(1.0, 0.34, transmissionReserve);
  float openCore = body * core * volumeAdmission
    * (0.004 + finishInteriorScatter * 0.006) * transmissionReserve;
  vec3 shellTint = mix(vec3(0.70, 0.83, 1.0), identityTint, 0.30 + roughness * 0.22);
  vec3 coreTint = mix(vec3(0.42, 0.48, 0.58), identityTint, 0.58 + opaqueReserve * 0.24);
  color += (vec3(1.08) - clamp(color, 0.0, 1.08)) * shellTint * shellExchange;
  color *= vec3(1.0) - coreTint * coreExchange;
  color += (vec3(1.08) - clamp(color, 0.0, 1.08))
    * mix(keyTint, identityTint, 0.68) * openCore;

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
// blur a species/contact boundary. Normal powder joins only through its
// caller-owned settled Smooth-body gate; compact true-8x remains literal Off.
vec3 applyMaterialVolumeLobe(
  vec3 color,
  float phase,
  vec4 finishResponse,
  float finishRoughness,
  float finishInteriorScatter,
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

  float powder = 1.0 - step(0.5, phase);
  float liquid = step(0.5, phase) * (1.0 - step(1.5, phase));
  float gas = step(1.5, phase) * (1.0 - step(2.5, phase));
  float fluid = liquid + gas;
  vec3 keyTint = powder * vec3(0.92, 0.72, 0.48)
    + liquid * vec3(0.58, 0.82, 1.00)
    + gas * vec3(0.70, 0.82, 1.00);
  vec3 absorptionTint = powder * vec3(0.48, 0.39, 0.32)
    + liquid * vec3(0.34, 0.48, 0.64)
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
  // Fill the optical gap between the shallow transmitted shoulder and deepest
  // absorption with one smooth column-scale lens. It is zero at both ends of
  // the normalized depth and therefore cannot create another shore or flatten
  // the authoritative deep pigment. This is arithmetic over the existing
  // caller-owned depth/body proof, not another field sample.
  float liquidColumnDepth = clamp(depth, 0.0, 1.0);
  float liquidMidColumn = liquid * 4.0 * liquidColumnDepth
    * (1.0 - liquidColumnDepth) * fieldBody;
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
  MaterialCompositionResponse composition = materialCompositionParameters(phase);
  float interiorContrast = composition.interiorContrast;
  // The sixth family lane already governs emitter-driven in-scattering. Reuse
  // it for the source-independent broad B lobe so clear liquid/gas and bright
  // crystalline powder retain a more open middle, while oily/sooty/metallic
  // families keep a denser core. This changes only existing RGB terms after
  // caller-owned support; Off/A and literal-Off compact true-8x select 1.0.
  float scatterProgress = clamp((finishInteriorScatter - 0.50) / 1.0, 0.0, 1.0);
  float profileMiddleScatter = mix(
    1.0, mix(0.78, 1.26, scatterProgress), opticalExperimentB
  );
  float profileCoreExtinction = mix(
    1.0, mix(1.15, 0.86, scatterProgress), opticalExperimentB
  );
  // The profile decides whether the mid-column reads as an open lens or a
  // pigment-bearing dense body. Clear/soft liquids exchange more of the
  // existing optical energy into transmission; oily and metallic families
  // retain the opposing absorption. Both terms remain bounded and B-only.
  float liquidTransmissionReserve = clamp(
    (finishResponse.w - 0.50) / 1.0, 0.0, 1.0
  );
  float liquidMidOpenness = clamp(
    liquidTransmissionReserve * 0.62 + scatterProgress * 0.38, 0.0, 1.0
  );
  float liquidMidLens = liquidMidColumn * opticalExperimentB
    * (0.040 + liquidMidOpenness * 0.080) * finishResponse.w
    * interiorContrast;
  float liquidMidRetention = liquidMidColumn * opticalExperimentB
    * (0.016 + (1.0 - liquidMidOpenness) * 0.034);
  // Convert the static family roughness lane into an energy-bounded lobe width.
  // The original crown/facing response remains exact outside B. Tight optical
  // families concentrate their reflection; broad families trade peak for a
  // wider diffuse shoulder. This is scalar arithmetic over existing curvature
  // and normal proofs, never a material selector or additional sample.
  float roughness = clamp(finishRoughness, 0.5, 1.5);
  float roughnessProgress = (roughness - 0.5) / 1.0;
  float lobeExponent = mix(2.30, 0.72, roughnessProgress);
  float lobeEnergy = mix(1.20, 0.86, roughnessProgress);
  float reflectedCrown = mix(
    crown, pow(crown, lobeExponent) * lobeEnergy, opticalExperimentB
  );
  float positiveFacing = max(facing, 0.0);
  float reflectedFacing = mix(
    positiveFacing, pow(positiveFacing, lobeExponent) * lobeEnergy,
    opticalExperimentB
  );
  float liquidSurfaceScale = 1.0 + liquid * opticalExperiment
    * mix(0.28, 0.74, opticalExperimentB);
  float liquidCoreScale = 1.0 + liquid * opticalExperiment
    * mix(0.22, 0.66, opticalExperimentB);
  float gasMidScale = 1.0 + gas * opticalExperiment
    * mix(0.18, 1.75, opticalExperimentB);
  // B previously multiplied every gas core by the same 5.25 extinction
  // envelope. That turned the deliberately absorptive SootyGas profile into a
  // dark slab before its transmitted middle could remain readable. Let the
  // existing transmission lane choose a bounded B envelope instead: soot
  // keeps stronger absorption than clean gas in the downstream finish, while
  // both retain a visible volume. Variant A still selects exactly 0.65, and
  // Off, non-gas phases, support, alpha, and compact true-8x remain unchanged.
  float gasTransmissionReserve = clamp(
    (finishResponse.w - 0.50) / 1.0, 0.0, 1.0
  );
  float gasProfileExtinctionB = mix(1.85, 2.85, gasTransmissionReserve);
  float gasExtinctionScale = 1.0 + gas * opticalExperiment
    * mix(0.65, gasProfileExtinctionB, opticalExperimentB);
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
    * finishResponse.w * (0.160 + crown * 0.040) * interiorContrast
    * profileMiddleScatter;
  float liquidTransmissionCrest = transmittedShoulder * finishResponse.w
    * (0.060 + reflectedFacing * 0.045) * liquidSurfaceScale
    * mix(1.0, interiorContrast, opticalExperimentB);

  // Turn the existing wide, coherent curvature observation into a body-scale
  // liquid meniscus. The optical profile chooses between a clear cool crown
  // and an oily warm grazing band without consulting a material ID. Positive
  // curvature catches transmitted environment light; negative curvature keeps
  // a quieter pigment-aware recess. Existing broad-body eligibility, density,
  // depth, and neighbour proofs keep holes, chimneys, droplets, unlike contacts,
  // and reconstructed fringe outside this RGB-only B experiment.
  float oilyProfile = liquid * opticalExperimentB
    * smoothstep(1.02, 1.16, finishResponse.y)
    * (1.0 - smoothstep(0.76, 1.02, finishResponse.w));
  float clearProfile = liquid * opticalExperimentB
    * smoothstep(0.84, 1.18, finishResponse.w)
    * (1.0 - oilyProfile);
  float coherentMeniscus = liquid * opticalExperimentB * fieldBody
    * smoothstep(0.08, 0.42, abs(signedCurvature))
    * (1.0 - core * 0.54);
  float meniscusCrown = coherentMeniscus * smoothstep(0.02, 0.48, crown);
  float meniscusPocket = coherentMeniscus * smoothstep(0.02, 0.48, pocket);
  float roughMeniscusWidth = mix(1.12, 0.78, roughnessProgress);
  float clearCrown = meniscusCrown * clearProfile * finishResponse.w
    * (0.050 + reflectedFacing * 0.040) * roughMeniscusWidth;
  float oilyGrazing = meniscusCrown * oilyProfile * finishResponse.x
    * (0.060 + (1.0 - abs(facing)) * 0.052) * roughMeniscusWidth;
  float oilyShallowCarry = oilyProfile * liquidShallowBand
    * finishResponse.x * (0.026 + (1.0 - core) * 0.022);
  vec3 meniscusTint = mix(
    vec3(0.50, 0.82, 1.00), vec3(1.00, 0.69, 0.27), oilyProfile
  );

  // A broad convex crown and directional shoulder supply a coherent reflected
  // lobe. Concave/deep regions retain pigment through restrained absorption;
  // the two phase palettes share one light direction without erasing identity.
  float key = fluid * (reflectedCrown * mix(0.038, 0.052, gas)
      + reflectedFacing * shoulder * mix(0.026, 0.034, gas))
    * (1.0 - core * mix(0.24, 0.36, gas));
  key += liquidTransmissionCrest;
  key += gasMidTransmission * 0.036 * finishResponse.w * gasMidScale
    * mix(1.0, interiorContrast, opticalExperimentB) * profileMiddleScatter;
  key += sootyGasCharacter * gasMidTransmission
    * (0.026 + max(macroRelief, 0.0) * 0.018) * finishResponse.x;
  key += max(macroRelief, 0.0) * gasMacroBody * 0.052;
  key += gasOpticalCharacter
    * (crown * fieldBody * 0.026 + max(facing, 0.0) * shoulder * 0.016)
    * finishResponse.w;
  // Settled Smooth powder enters the same non-rigid volume vocabulary only
  // through its caller-owned broad-body gate. The low phase scatter and
  // profile lanes retain mineral grain while adding a coherent shallow key and
  // deep countershade; no procedural texture or support decision is introduced.
  float powderVolume = powder * opticalExperimentB * fieldBody
    * composition.volumeScatter;
  float powderMid = 4.0 * clamp(depth, 0.0, 1.0)
    * (1.0 - clamp(depth, 0.0, 1.0));
  // Powder already arrives through the wide settled-Smooth carrier. Give that
  // actual body signal enough optical weight to survive fit-view composition:
  // a shallow profile-coloured crown and an opposing compacted core. This is
  // deliberately stronger than the removed extra-stencil prototype, which
  // duplicated the same field but stayed visually inert. Grain RGB remains
  // untouched; the caller still owns support, alpha, holes, contacts, motion,
  // Local/Grains, and the compact true-8x literal-Off path.
  float powderOpenProfile = clamp(
    (finishInteriorScatter - 0.50) / 1.0, 0.0, 1.0
  );
  float powderCrownScale = mix(0.118, 0.178, powderOpenProfile);
  float powderCoreScale = mix(0.132, 0.086, powderOpenProfile);
  key += powderVolume * (
    powderMid * powderCrownScale
      + max(facing, 0.0) * shoulder * (0.064 + powderOpenProfile * 0.022)
  ) * finishResponse.x * profileMiddleScatter;
  key *= finishResponse.x;
  // Transmission is a separate optical lane: applying it after reflection
  // scaling keeps aqueous and oily bodies distinct instead of multiplying the
  // authored response by the reflection lane a second time.
  key += liquidBroadTransmission;
  key += liquidMidLens;
  float shade = fluid * (pocket * mix(0.030, 0.038, gas)
      + max(-facing, 0.0) * shoulder * mix(0.010, 0.014, gas)
      + core * mix(0.010, 0.007, gas)) * fieldBody;
  shade += deepColumn * 0.032 * liquidCoreScale
    * mix(1.0, interiorContrast, opticalExperimentB) * profileCoreExtinction;
  shade += liquidMidRetention * profileCoreExtinction;
  shade += gasDeepAbsorption * 0.024 * gasExtinctionScale
    * mix(1.0, interiorContrast, opticalExperimentB) * profileCoreExtinction;
  shade += max(-macroRelief, 0.0) * gasMacroBody * 0.036;
  shade += gasOpticalCharacter
    * (pocket * fieldBody * 0.022 + max(-facing, 0.0) * shoulder * 0.010
      + gasDeepAbsorption * 0.014);
  shade += powderVolume * (
    core * core * powderCoreScale
      + max(-facing, 0.0) * shoulder * (0.038 + (1.0 - powderOpenProfile) * 0.016)
  ) * profileCoreExtinction;
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
  float materialDeepPigment = opticalExperimentB * finishResponse.z
    * (powder * powderVolume * core * 0.030
      + liquid * (deepColumn * 0.016 + liquidMidRetention * 0.010)
      + gasDeepAbsorption * 0.024);
  float materialLuminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color += (color - vec3(materialLuminance)) * materialDeepPigment;
  color += (vec3(1.12) - clamp(color, 0.0, 1.12))
    * meniscusTint * (clearCrown + oilyGrazing + oilyShallowCarry);
  vec3 meniscusAbsorption = mix(
    absorptionTint, mix(absorptionTint, identityTint, 0.48), oilyProfile
  );
  color *= vec3(1.0) - meniscusAbsorption * meniscusPocket
    * mix(0.026, 0.052, oilyProfile);
  return max(color, vec3(0.0));
}
`;
