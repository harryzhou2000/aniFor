import { HDR_VOLUME_LAB_EMISSION_DESCRIPTOR } from './hdr-volume-lab-emission';
import { HDR_VOLUME_LAB_GAS_DESCRIPTOR } from './hdr-volume-lab-gas';
import { HDR_VOLUME_LAB_LIQUID_DESCRIPTOR } from './hdr-volume-lab-liquid';
import type { VisualLabDomainShaderAdapter } from './visual-lab';

/**
 * Sole explicit join point between normal-HDR leaf modules and the protected
 * assembler. Keep this tuple in canonical implemented-domain order; the host
 * independently validates completeness, order, codes, hooks, and leaf source.
 */
export const HDR_VOLUME_LAB_ADAPTER_REGISTRY = Object.freeze([
  HDR_VOLUME_LAB_LIQUID_DESCRIPTOR,
  HDR_VOLUME_LAB_GAS_DESCRIPTOR,
  HDR_VOLUME_LAB_EMISSION_DESCRIPTOR,
] as const satisfies readonly VisualLabDomainShaderAdapter[]);
