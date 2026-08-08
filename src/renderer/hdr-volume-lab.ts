import {
  HDR_VOLUME_LAB_EMISSION_DESCRIPTOR,
} from './hdr-volume-lab-emission';
import { HDR_VOLUME_LAB_GAS_DESCRIPTOR } from './hdr-volume-lab-gas';
import { HDR_VOLUME_LAB_LIQUID_DESCRIPTOR } from './hdr-volume-lab-liquid';
import type {
  ImplementedVisualLabDomain, VisualLabDomainShaderAdapter,
} from './visual-lab';

/**
 * Stable, complete authoring seam for normal-scale RGB-only Visual Lab
 * comparisons. Domain modules own candidate arithmetic; this facade owns only
 * assembly and the shared volume-field guards. The presenter remains
 * authoritative for matter, atmosphere support, and alpha.
 *
 * Shader-facing lab state is vec4(domain, variant, target, gain). Target zero
 * is a wildcard. The hook owns no field, pass, target, upload cadence, clock,
 * sampler declaration, or true-8x resource.
 */
export const HDR_VOLUME_LAB_DOMAIN_ADAPTERS = Object.freeze({
  liquid: HDR_VOLUME_LAB_LIQUID_DESCRIPTOR,
  gas: HDR_VOLUME_LAB_GAS_DESCRIPTOR,
  emission: HDR_VOLUME_LAB_EMISSION_DESCRIPTOR,
} as const satisfies Readonly<Record<
  ImplementedVisualLabDomain,
  VisualLabDomainShaderAdapter
>>);

const HDR_VOLUME_LAB_DISPATCH_GLSL = `
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

  if (labDomain == ${HDR_VOLUME_LAB_DOMAIN_ADAPTERS.gas.domainCode}.0) {
    return ${HDR_VOLUME_LAB_DOMAIN_ADAPTERS.gas.entryPoint}(
      radiance, uv, worldPosition, labTarget, labVariant, labGain
    );
  }
  if (labDomain == ${HDR_VOLUME_LAB_DOMAIN_ADAPTERS.emission.domainCode}.0) {
    return ${HDR_VOLUME_LAB_DOMAIN_ADAPTERS.emission.entryPoint}(
      radiance, uv, worldPosition, labTarget, labVariant, labGain
    );
  }
  return radiance;
}
`;

/**
 * One compile-time shader payload assembled from the frozen domain adapters.
 * Ordinary pages still use the separate five-input compositor and compile none
 * of this source; the expanded compositor retains its established eight inputs.
 */
export const HDR_VOLUME_LAB_GLSL = [
  HDR_VOLUME_LAB_DOMAIN_ADAPTERS.liquid.source,
  HDR_VOLUME_LAB_DOMAIN_ADAPTERS.gas.source,
  HDR_VOLUME_LAB_DOMAIN_ADAPTERS.emission.source,
  HDR_VOLUME_LAB_DISPATCH_GLSL,
].join('\n');
