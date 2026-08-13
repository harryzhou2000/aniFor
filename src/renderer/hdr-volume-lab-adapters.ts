import { HDR_VOLUME_LAB_EMISSION_DESCRIPTOR } from './hdr-volume-lab-emission';
import { HDR_VOLUME_LAB_GAS_DESCRIPTOR } from './hdr-volume-lab-gas';
import { HDR_VOLUME_LAB_LIQUID_DESCRIPTOR } from './hdr-volume-lab-liquid';
import {
  VISUAL_LAB_IMPLEMENTED_DOMAIN_DESCRIPTORS,
  type ImplementedVisualLabDomain,
  type VisualLabDomainShaderAdapter,
} from './visual-lab';

/**
 * Sole explicit renderer join between normal-HDR leaf modules and the protected
 * assembler. Imports remain explicit so static data never gains module paths or
 * GLSL authority; the descriptor order comes from the shared implemented-domain
 * contract rather than being repeated here.
 */
export const HDR_VOLUME_LAB_LEAF_ADAPTERS_BY_DOMAIN = Object.freeze({
  liquid: HDR_VOLUME_LAB_LIQUID_DESCRIPTOR,
  gas: HDR_VOLUME_LAB_GAS_DESCRIPTOR,
  emission: HDR_VOLUME_LAB_EMISSION_DESCRIPTOR,
} satisfies Readonly<Record<ImplementedVisualLabDomain, VisualLabDomainShaderAdapter>>);

/** Public canonical tuple; its order is derived from the implemented-domain seam. */
export const HDR_VOLUME_LAB_ADAPTER_REGISTRY = Object.freeze(
  (Object.keys(VISUAL_LAB_IMPLEMENTED_DOMAIN_DESCRIPTORS) as ImplementedVisualLabDomain[])
    .map((domain) => HDR_VOLUME_LAB_LEAF_ADAPTERS_BY_DOMAIN[domain]),
);
