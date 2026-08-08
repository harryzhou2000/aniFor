import {
  VISUAL_LAB_IMPLEMENTED_DOMAIN_DESCRIPTORS,
  type VisualLabDomainShaderAdapter,
} from './visual-lab';

/** Gas candidate body split from the shared volume dispatcher. */
export const HDR_VOLUME_LAB_GAS_GLSL = `
vec3 applyHdrGasLab(
  vec3 radiance,
  vec2 uv,
  vec2 worldPosition,
  float target,
  float variant,
  float gain
) {
  vec4 centre = texture(uAtmosphereTexture, boundedUv(uv));
  float style = floor(
    texture(uAtmosphereStyleTexture, boundedUv(uv)).r * 255.0 + 0.5
  );
  float styledGas = step(0.5, style);
  float targetMatch = styledGas * (target < 0.5
    ? 1.0 : 1.0 - step(0.5, abs(style - target)));
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
  vec3 key = variant < 1.5
    ? vec3(0.74, 0.82, 0.94) : vec3(0.94, 0.72, 0.48);
  vec3 shadow = variant < 1.5
    ? vec3(0.24, 0.30, 0.42) : vec3(0.40, 0.24, 0.16);
  float keyGain = mix(0.055, 0.095, step(1.5, variant)) * gain;
  float pocketGain = mix(0.040, 0.070, step(1.5, variant)) * gain;
  radiance += (vec3(1.14) - clamp(radiance, 0.0, 1.14))
    * key * crown * keyGain;
  radiance *= vec3(1.0) - shadow * pocket * pocketGain;
  return max(radiance, vec3(0.0));
}
`;

export const HDR_VOLUME_LAB_GAS_DESCRIPTOR = Object.freeze({
  domain: 'gas',
  domainCode: VISUAL_LAB_IMPLEMENTED_DOMAIN_DESCRIPTORS.gas.domainCode,
  hook: 'volume-field',
  entryPoint: 'applyHdrGasLab',
  source: HDR_VOLUME_LAB_GAS_GLSL,
} satisfies VisualLabDomainShaderAdapter);
