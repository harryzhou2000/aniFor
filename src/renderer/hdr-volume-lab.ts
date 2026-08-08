/**
 * Authoring seam for temporary RGB-only volume comparisons in the existing
 * normal-scale HDR composite. The semantic presenter remains authoritative for
 * matter, atmosphere support, and alpha; this function receives straight
 * radiance and returns straight radiance. Variant zero is an exact no-op.
 *
 * Shader-facing lab state is vec4(domain, variant, target, gain):
 * - domain 2 targets exact connected Water/Oil/Acid surface material IDs;
 * - domain 3 targets the propagated atmosphere style byte;
 * - domain 4 targets the semantic material byte under an emission volume;
 * - target zero is a wildcard.
 *
 * Keep candidate arithmetic inside the guarded domain branches. The hook owns
 * no texture, field, pass, target, upload cadence, clock, or 8x resource.
 */
export const HDR_VOLUME_LAB_GLSL = `
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
  if (labDomain != 2.0 || labVariant < 0.5 || labGain < 0.0001
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
  vec3 familyTint = material == MATERIAL_WATER ? vec3(0.76, 0.98, 1.10)
    : (material == MATERIAL_OIL ? vec3(1.10, 0.82, 0.44)
    : vec3(0.84, 1.08, 0.68));

  // A keeps the established transmitted donor dominant, then adds a shallow
  // family-coloured meniscus key. It is an optical comparison, not support.
  if (labVariant < 1.5) {
    vec3 transmission = max(transmitted, vec3(0.0)) * familyTint;
    float transmissionMix = min(
      0.12, surface * (0.040 + keyFacing * 0.035) * labGain
    );
    radiance = mix(radiance, transmission, transmissionMix);
    radiance += (vec3(1.18) - clamp(radiance, 0.0, 1.18))
      * familyTint * crown * (0.040 + motionLeading * 0.035) * labGain;
    return max(radiance, vec3(0.0));
  }

  // B favours the already-computed environment/bloom reflection and balances
  // it with a restrained opposing absorption pocket.
  vec3 reflectionTint = mix(familyTint, max(reflected, vec3(0.0)), 0.38);
  radiance += (vec3(1.24) - clamp(radiance, 0.0, 1.24))
    * reflectionTint * crown * (0.075 + motionLeading * 0.050) * labGain;
  vec3 absorption = material == MATERIAL_WATER ? vec3(0.18, 0.07, 0.03)
    : (material == MATERIAL_OIL ? vec3(0.05, 0.18, 0.42)
    : vec3(0.20, 0.05, 0.24));
  radiance *= vec3(1.0) - absorption
    * (pocket * 0.055 + motionWake * surface * 0.035) * labGain;
  return max(radiance, vec3(0.0));
}

vec3 applyHdrVolumeLab(vec3 radiance, vec2 uv) {
  float labDomain = floor(uVisualLab.x + 0.5);
  float labVariant = floor(uVisualLab.y + 0.5);
  float labTarget = floor(uVisualLab.z + 0.5);
  float labGain = clamp(uVisualLab.w, 0.0, 2.0);
  if (labVariant < 0.5 || labGain < 0.0001) return radiance;
  // Liquid consumes E08 locals in applyHdrLiquidLab; reserved Powder has no
  // compositor implementation yet. Neither should pay a global wall sample.
  if (labDomain < 2.5) return radiance;

  float wall = floor(texture(uWallTexture, boundedUv(uv)).r * 255.0 + 0.5);
  if (wall > 0.5) return radiance;
  vec2 worldPosition = uv / uWorldTexel;

  // Gas lab: the shared atmosphere field owns the connected volume and its
  // propagated style byte. Four existing-field cardinals supply a broad normal
  // and curvature; authored sparse gaps remain unsupported and unchanged.
  if (labDomain == 3.0) {
    vec4 centre = texture(uAtmosphereTexture, boundedUv(uv));
    float style = floor(
      texture(uAtmosphereStyleTexture, boundedUv(uv)).r * 255.0 + 0.5
    );
    float styledGas = step(0.5, style);
    float targetMatch = styledGas * (labTarget < 0.5
      ? 1.0 : 1.0 - step(0.5, abs(style - labTarget)));
    if (targetMatch < 0.5 || centre.a < 0.045) return radiance;
    float left = texture(
      uAtmosphereTexture, boundedUv(uv - vec2(uAtmosphereTexel.x, 0.0))
    ).a;
    float right = texture(
      uAtmosphereTexture, boundedUv(uv + vec2(uAtmosphereTexel.x, 0.0))
    ).a;
    float top = texture(
      uAtmosphereTexture, boundedUv(uv - vec2(0.0, uAtmosphereTexel.y))
    ).a;
    float bottom = texture(
      uAtmosphereTexture, boundedUv(uv + vec2(0.0, uAtmosphereTexel.y))
    ).a;
    float neighbourMean = (left + right + top + bottom) * 0.25;
    float support = targetMatch * smoothstep(0.08, 0.38, centre.a)
      * smoothstep(0.08, 0.34, neighbourMean);
    float directional = ((left - right) * 0.44 + (bottom - top) * 0.56);
    float curvature = clamp((centre.a - neighbourMean) * 7.5, -1.0, 1.0);
    float waveA = sin(dot(worldPosition, vec2(0.055, 0.031)) + 0.80);
    float waveB = sin(dot(worldPosition, vec2(-0.029, 0.081)) + 2.15);
    float macro = clamp(waveA * 0.62 + waveB * 0.38, -1.0, 1.0);
    float relief = clamp(
      directional * 0.58 + curvature * 0.24 + macro * 0.18, -1.0, 1.0
    );
    float crown = max(relief, 0.0) * support;
    float pocket = max(-relief, 0.0) * support;
    vec3 key = labVariant < 1.5
      ? vec3(0.74, 0.82, 0.94) : vec3(0.94, 0.72, 0.48);
    vec3 shadow = labVariant < 1.5
      ? vec3(0.24, 0.30, 0.42) : vec3(0.40, 0.24, 0.16);
    float keyGain = mix(0.055, 0.095, step(1.5, labVariant)) * labGain;
    float pocketGain = mix(0.040, 0.070, step(1.5, labVariant)) * labGain;
    radiance += (vec3(1.14) - clamp(radiance, 0.0, 1.14))
      * key * crown * keyGain;
    radiance *= vec3(1.0) - shadow * pocket * pocketGain;
    return max(radiance, vec3(0.0));
  }

  // Emission lab: the existing compact emission field supplies the same broad
  // support and cardinal relief. A nonzero target uses the already-bound
  // semantic texture; empty aura support remains available through wildcard 0.
  if (labDomain == 4.0) {
    vec4 centre = texture(uEmissionTexture, boundedUv(uv));
    float material = materialFromSemantic(semanticState(uv));
    float targetMatch = labTarget < 0.5
      ? 1.0 : 1.0 - step(0.5, abs(material - labTarget));
    if (targetMatch < 0.5 || centre.a < 0.025) return radiance;
    float left = texture(
      uEmissionTexture, boundedUv(uv - vec2(uEmissionTexel.x, 0.0))
    ).a;
    float right = texture(
      uEmissionTexture, boundedUv(uv + vec2(uEmissionTexel.x, 0.0))
    ).a;
    float top = texture(
      uEmissionTexture, boundedUv(uv - vec2(0.0, uEmissionTexel.y))
    ).a;
    float bottom = texture(
      uEmissionTexture, boundedUv(uv + vec2(0.0, uEmissionTexel.y))
    ).a;
    float neighbourMean = (left + right + top + bottom) * 0.25;
    float support = targetMatch * smoothstep(0.04, 0.32, centre.a)
      * smoothstep(0.025, 0.24, neighbourMean);
    float directional = (left - right) * 0.46 + (bottom - top) * 0.54;
    float curvature = clamp((centre.a - neighbourMean) * 6.5, -1.0, 1.0);
    float pulse = sin(dot(worldPosition, vec2(0.071, -0.047)) + 1.70);
    float relief = clamp(
      directional * 0.62 + curvature * 0.28 + pulse * 0.10, -1.0, 1.0
    );
    float crown = max(relief, 0.0) * support;
    float pocket = max(-relief, 0.0) * support;
    vec3 key = labVariant < 1.5
      ? vec3(0.72, 0.88, 1.10) : vec3(1.14, 0.62, 0.24);
    float keyGain = mix(0.070, 0.120, step(1.5, labVariant)) * labGain;
    float pocketGain = mix(0.025, 0.050, step(1.5, labVariant)) * labGain;
    radiance += (vec3(1.35) - clamp(radiance, 0.0, 1.35))
      * key * crown * keyGain;
    radiance *= 1.0 - pocket * pocketGain;
    return max(radiance, vec3(0.0));
  }

  return radiance;
}
`;
