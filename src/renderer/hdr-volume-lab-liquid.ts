import {
  VISUAL_LAB_IMPLEMENTED_DOMAIN_DESCRIPTORS,
  VISUAL_LAB_ZERO_RESOURCE_ADDITIONS,
  type VisualLabDomainShaderAdapter,
  type VisualLabShaderResourceBudget,
} from './visual-lab';

/**
 * Liquid candidates consume only locals already established by E08. The
 * compositor facade injects this source after the common material helpers.
 */
export const HDR_VOLUME_LAB_LIQUID_GLSL = `
vec3 applyHdrLiquidLab(
  vec3 radiance,
  float material,
  float surface,
  float ripple,
  vec2 outward,
  vec3 transmitted,
  vec3 reflected,
  float wallBacked,
  float motion,
  float motionFacing,
  float flowFacing
) {
  float labDomain = floor(uVisualLab.x + 0.5);
  float labVariant = floor(uVisualLab.y + 0.5);
  float labTarget = floor(uVisualLab.z + 0.5);
  float labGain = clamp(uVisualLab.w, 0.0, 2.0);
  float targetMatch = labTarget < 0.5
    ? 1.0 : 1.0 - step(0.5, abs(material - labTarget));
  if (labDomain != ${VISUAL_LAB_IMPLEMENTED_DOMAIN_DESCRIPTORS.liquid.domainCode}.0 || labVariant < 0.5 || labGain < 0.0001
    || targetMatch < 0.5 || wallBacked > 0.5 || surface < 0.001) {
    return radiance;
  }

  float keyFacing = max(
    0.0, dot(outward, normalize(vec2(-0.55, -0.835)))
  );
  float rippleBand = ripple * 0.5 + 0.5;
  float crown = surface * (0.38 + keyFacing * 0.62)
    * (0.72 + rippleBand * 0.28);
  float pocket = surface * (1.0 - keyFacing)
    * (0.72 + (1.0 - rippleBand) * 0.28);
  // The adapter receives the already-owner-gated E08 motion scalar. Water and
  // Oil can therefore compare direction-aware finishes without another
  // selector, sample, or fixture-specific compositor branch.
  float familyMotion = (
    material == MATERIAL_WATER || material == MATERIAL_OIL ? 1.0 : 0.0
  )
    * clamp(motion * (0.45 + motionFacing * 0.55), 0.0, 1.0);
  float motionLeading = smoothstep(-0.10, 0.62, flowFacing) * familyMotion;
  float motionWake = smoothstep(-0.10, 0.62, -flowFacing) * familyMotion;
  float litCrest = surface
    * smoothstep(0.38, 0.86, keyFacing)
    * smoothstep(0.50, 0.88, rippleBand);
  vec3 familyTint = material == MATERIAL_WATER ? vec3(0.76, 0.98, 1.10)
    : (material == MATERIAL_OIL ? vec3(1.10, 0.82, 0.44)
    : vec3(0.84, 1.08, 0.68));

  // A makes the already-computed transmitted donor visibly authoritative in
  // shallow, lit liquid. A narrow ripple crest prevents the broader mix from
  // reading as a flat opacity change. Both terms remain surface-owned RGB.
  if (labVariant < 1.5) {
    vec3 transmission = max(transmitted, vec3(0.0)) * familyTint;
    float transmissionMix = min(
      0.40,
      surface * (0.160 + keyFacing * 0.150 + rippleBand * 0.050) * labGain
    );
    radiance = mix(radiance, transmission, transmissionMix);
    radiance += (vec3(1.18) - clamp(radiance, 0.0, 1.18))
      * familyTint * (crown * 0.090 + litCrest * 0.140
        + motionLeading * surface * 0.070) * labGain;
    return max(radiance, vec3(0.0));
  }

  // B makes the completed environment/bloom donor visibly reflective while a
  // restrained opposing pocket keeps Oil and Water from becoming silver foil.
  vec3 reflectionTint = mix(familyTint, max(reflected, vec3(0.0)), 0.82);
  radiance += (vec3(1.24) - clamp(radiance, 0.0, 1.24))
    * reflectionTint * (crown * 0.240 + litCrest * 0.090
      + motionLeading * surface * 0.120) * labGain;
  vec3 absorption = material == MATERIAL_WATER ? vec3(0.18, 0.07, 0.03)
    : (material == MATERIAL_OIL ? vec3(0.05, 0.18, 0.42)
    : vec3(0.20, 0.05, 0.24));
  radiance *= vec3(1.0) - absorption
    * (pocket * 0.140 + motionWake * surface * 0.090) * labGain;
  return max(radiance, vec3(0.0));
}
`;

const HDR_VOLUME_LAB_LIQUID_RESOURCE_BUDGET = Object.freeze({
  existingSamplerReads: Object.freeze({}),
  maxAdditionalTextureReadsPerFragment: 0,
  adds: VISUAL_LAB_ZERO_RESOURCE_ADDITIONS,
} satisfies VisualLabShaderResourceBudget);

export const HDR_VOLUME_LAB_LIQUID_DESCRIPTOR = Object.freeze({
  domain: 'liquid',
  domainCode: VISUAL_LAB_IMPLEMENTED_DOMAIN_DESCRIPTORS.liquid.domainCode,
  hook: 'liquid-surface',
  entryPoint: 'applyHdrLiquidLab',
  source: HDR_VOLUME_LAB_LIQUID_GLSL,
  budget: HDR_VOLUME_LAB_LIQUID_RESOURCE_BUDGET,
} satisfies VisualLabDomainShaderAdapter);
