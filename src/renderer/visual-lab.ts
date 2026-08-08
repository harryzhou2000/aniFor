import type { FieldOutputScale } from './render-resolution';
import type { RenderLook } from './render-look';

/** Stable shader-facing codes; do not reorder once visual-lab captures exist. */
export const VISUAL_LAB_DOMAIN_CODE = Object.freeze({
  off: 0,
  powder: 1,
  liquid: 2,
  gas: 3,
  emission: 4,
} as const);

export type VisualLabDomain = keyof typeof VISUAL_LAB_DOMAIN_CODE;
export type VisualLabVariant = 0 | 1 | 2;

export interface VisualLabState {
  readonly domain: VisualLabDomain;
  readonly domainCode: (typeof VISUAL_LAB_DOMAIN_CODE)[VisualLabDomain];
  readonly variant: VisualLabVariant;
  /** Domain-specific selector: propagated gas style or semantic material ID. */
  readonly target: number;
  readonly gain: number;
}

export const DISABLED_VISUAL_LAB_STATE: Readonly<VisualLabState> = Object.freeze({
  domain: 'off',
  domainCode: VISUAL_LAB_DOMAIN_CODE.off,
  variant: 0,
  target: 0,
  gain: 1,
});

const isDomain = (value: string | null): value is VisualLabDomain => (
  value !== null && Object.hasOwn(VISUAL_LAB_DOMAIN_CODE, value)
);

const parseVariant = (value: string | null): VisualLabVariant | undefined => {
  if (value === '0' || value === '1' || value === '2') return Number(value) as VisualLabVariant;
  return undefined;
};

const parseTarget = (value: string | null): number => {
  if (value === null || !/^\d+$/.test(value)) return 0;
  const target = Number(value);
  return Number.isInteger(target) && target <= 255 ? target : 0;
};

const parseGain = (value: string | null): number => {
  if (value === null || value.trim() === '') return 1;
  const gain = Number(value);
  return Number.isFinite(gain) ? Math.min(2, Math.max(0, gain)) : 1;
};

/**
 * Resolves the normal-WebGL comparison lab without changing simulation state.
 * Classic, true 8x, and implicit input-audit requests collapse to one canonical
 * disabled value so no stale experiment controls can reach the shader.
 */
export function resolveVisualLabState(
  look: RenderLook,
  outputScale: FieldOutputScale,
  search = globalThis.location?.search ?? '',
): Readonly<VisualLabState> {
  if (look === 'classic' || outputScale >= 8) return DISABLED_VISUAL_LAB_STATE;

  const parameters = new URLSearchParams(search);
  const requestedDomain = parameters.get('visualLab');
  const requestedVariant = parseVariant(parameters.get('visualVariant'));
  const explicitExperiment = isDomain(requestedDomain)
    && requestedDomain !== 'off'
    && requestedVariant !== undefined;

  if (!isDomain(requestedDomain) || requestedDomain === 'off'
    || (parameters.get('inputAudit') === '1' && !explicitExperiment)) {
    return DISABLED_VISUAL_LAB_STATE;
  }

  return Object.freeze({
    domain: requestedDomain,
    domainCode: VISUAL_LAB_DOMAIN_CODE[requestedDomain],
    variant: requestedVariant ?? 0,
    target: parseTarget(parameters.get('visualTarget')),
    gain: parseGain(parameters.get('visualGain')),
  });
}

/** Packs the immutable state as shader vec4(domain, variant, target, gain). */
export function packVisualLabState(state: Readonly<VisualLabState>): Float32Array {
  return new Float32Array([state.domainCode, state.variant, state.target, state.gain]);
}
