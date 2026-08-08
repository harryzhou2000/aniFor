import {
  VISUAL_LAB_IMPLEMENTED_DOMAIN_DESCRIPTORS,
  VISUAL_LAB_ZERO_RESOURCE_ADDITIONS,
  type VisualLabDomainShaderAdapter,
  type VisualLabShaderResourceBudget,
} from './visual-lab';

/** Emission candidate body split from the shared volume dispatcher. */
export const HDR_VOLUME_LAB_EMISSION_GLSL = `
vec3 applyHdrEmissionLab(
  vec3 radiance,
  vec2 uv,
  vec2 worldPosition,
  float target,
  float variant,
  float gain
) {
  vec4 centre = texture(uEmissionTexture, boundedUv(uv));
  float material = materialFromSemantic(semanticState(uv));
  float targetMatch = target < 0.5
    ? 1.0 : 1.0 - step(0.5, abs(material - target));
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
  vec3 key = variant < 1.5
    ? vec3(0.72, 0.88, 1.10) : vec3(1.14, 0.62, 0.24);
  float keyGain = mix(0.070, 0.120, step(1.5, variant)) * gain;
  float pocketGain = mix(0.025, 0.050, step(1.5, variant)) * gain;
  radiance += (vec3(1.35) - clamp(radiance, 0.0, 1.35))
    * key * crown * keyGain;
  radiance *= 1.0 - pocket * pocketGain;
  return max(radiance, vec3(0.0));
}
`;

const HDR_VOLUME_LAB_EMISSION_RESOURCE_BUDGET = Object.freeze({
  existingSamplerReads: Object.freeze({
    wall: 1,
    semantic: 1,
    emission: 5,
  }),
  maxAdditionalTextureReadsPerFragment: 7,
  adds: VISUAL_LAB_ZERO_RESOURCE_ADDITIONS,
} satisfies VisualLabShaderResourceBudget);

export const HDR_VOLUME_LAB_EMISSION_DESCRIPTOR = Object.freeze({
  domain: 'emission',
  domainCode: VISUAL_LAB_IMPLEMENTED_DOMAIN_DESCRIPTORS.emission.domainCode,
  hook: 'volume-field',
  entryPoint: 'applyHdrEmissionLab',
  source: HDR_VOLUME_LAB_EMISSION_GLSL,
  budget: HDR_VOLUME_LAB_EMISSION_RESOURCE_BUDGET,
} satisfies VisualLabDomainShaderAdapter);
