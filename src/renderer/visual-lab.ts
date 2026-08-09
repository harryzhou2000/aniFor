import type { FieldOutputScale } from './render-resolution';
import type { RenderLook } from './render-look';
import { VISUAL_LAB_STATIC_CONTRACT } from '../shared/visual-lab-static-contract.js';

/** Stable shader-facing codes; do not reorder once visual-lab captures exist. */
export const VISUAL_LAB_DOMAIN_CODE = VISUAL_LAB_STATIC_CONTRACT.domainCodes;

export type VisualLabDomain = keyof typeof VISUAL_LAB_DOMAIN_CODE;
export type VisualLabVariant = 0 | 1 | 2;
type StaticVisualLabDomain = (typeof VISUAL_LAB_STATIC_CONTRACT.domains)[number];
type StaticVisualLabDomainFor<Domain extends VisualLabDomain> = Extract<
  StaticVisualLabDomain,
  { readonly name: Domain }
>;
export type VisualLabTargetKind = StaticVisualLabDomain['targetKind'];

export type VisualLabDetailScale = (
  typeof VISUAL_LAB_STATIC_CONTRACT.normalHdrExecutionProfile.detailScales
)[number];
export type VisualLabExecutionFallback = 'disabled-preserve-baseline';

/**
 * Shared execution contract for comparison domains in the normal HDR
 * compositor. Fallbacks are explicit so unsupported paths cannot silently
 * reinterpret a requested variant.
 */
export interface VisualLabExecutionProfile {
  readonly detailScales: readonly VisualLabDetailScale[];
  readonly backend: 'webgl';
  readonly pipeline: 'normal-hdr';
  readonly variantZero: 'pixel-preserving-baseline';
  readonly fallbacks: Readonly<{
    classic: VisualLabExecutionFallback;
    canvas2d: VisualLabExecutionFallback;
    hdrUnavailable: VisualLabExecutionFallback;
    detail8x: VisualLabExecutionFallback;
  }>;
}

export const VISUAL_LAB_NORMAL_HDR_EXECUTION_PROFILE = (
  VISUAL_LAB_STATIC_CONTRACT.normalHdrExecutionProfile
) satisfies VisualLabExecutionProfile;

/** Existing fixed-compositor samplers that a lab adapter may read. */
export type VisualLabSampler =
  | 'hdr'
  | 'bloom'
  | 'semantic'
  | 'wall'
  | 'liquid'
  | 'atmosphere'
  | 'atmosphereStyle'
  | 'emission';

export type VisualLabExistingSamplerReads = Readonly<
  Partial<Record<VisualLabSampler, number>>
>;

export interface VisualLabResourceAdditions {
  readonly samplers: 0;
  readonly textures: 0;
  readonly fields: 0;
  readonly passes: 0;
  readonly targets: 0;
}

export interface VisualLabShaderResourceBudget {
  readonly existingSamplerReads: VisualLabExistingSamplerReads;
  readonly maxAdditionalTextureReadsPerFragment: number;
  readonly adds: Readonly<VisualLabResourceAdditions>;
}

export const VISUAL_LAB_ZERO_RESOURCE_ADDITIONS = Object.freeze({
  samplers: 0,
  textures: 0,
  fields: 0,
  passes: 0,
  targets: 0,
} as const satisfies VisualLabResourceAdditions);

/**
 * One renderer-owned capability table for lab routing and diagnostics. Powder
 * keeps its reserved shader code, but cannot request the expanded compositor
 * until its conservative hook exists.
 */
type VisualLabDomainCapabilityMap = {
  readonly [Domain in VisualLabDomain]: Readonly<{
    implemented: StaticVisualLabDomainFor<Domain>['implemented'];
    targetKind: StaticVisualLabDomainFor<Domain>['targetKind'];
  }>;
};

export const VISUAL_LAB_DOMAIN_CAPABILITY = Object.freeze(Object.fromEntries(
  VISUAL_LAB_STATIC_CONTRACT.domains.map(({ name, implemented, targetKind }) => [
    name,
    Object.freeze({ implemented, targetKind }),
  ]),
)) as VisualLabDomainCapabilityMap;

export type ImplementedVisualLabDomain = {
  [Domain in VisualLabDomain]:
    (typeof VISUAL_LAB_DOMAIN_CAPABILITY)[Domain]['implemented'] extends true
      ? Domain
      : never;
}[VisualLabDomain];

export type VisualLabHook = 'liquid-surface' | 'volume-field';

/** Stable metadata/source ABI consumed by normal-HDR domain adapter modules. */
export type VisualLabDomainShaderAdapter = {
  [Domain in ImplementedVisualLabDomain]: Readonly<{
    domain: Domain;
    domainCode: (typeof VISUAL_LAB_DOMAIN_CODE)[Domain];
    hook: VisualLabHook;
    entryPoint: string;
    source: string;
    budget: Readonly<VisualLabShaderResourceBudget>;
  }>;
}[ImplementedVisualLabDomain];

type ImplementedVisualLabDomainDescriptorMap = {
  readonly [Domain in ImplementedVisualLabDomain]: Readonly<{
    domainCode: (typeof VISUAL_LAB_DOMAIN_CODE)[Domain];
    targetKind: Exclude<VisualLabTargetKind, 'none'>;
    executionProfile: Readonly<VisualLabExecutionProfile>;
  }>;
};

/**
 * Complete renderer-facing metadata for domains that can compile the expanded
 * comparison compositor. Shader adapters consume this table rather than
 * repeating domain codes or target semantics.
 */
const IMPLEMENTED_STATIC_VISUAL_LAB_DOMAINS = VISUAL_LAB_STATIC_CONTRACT.domains.filter(
  (domain): domain is Extract<StaticVisualLabDomain, { readonly implemented: true }> => (
    domain.implemented
  ),
);

export const VISUAL_LAB_IMPLEMENTED_DOMAIN_DESCRIPTORS = Object.freeze(Object.fromEntries(
  IMPLEMENTED_STATIC_VISUAL_LAB_DOMAINS.map(({ name, code, targetKind }) => [
    name,
    Object.freeze({
      domainCode: code,
      targetKind,
      executionProfile: VISUAL_LAB_NORMAL_HDR_EXECUTION_PROFILE,
    }),
  ]),
)) as unknown as ImplementedVisualLabDomainDescriptorMap;

export function isVisualLabDomainImplemented(
  domain: VisualLabDomain,
): domain is ImplementedVisualLabDomain {
  return VISUAL_LAB_DOMAIN_CAPABILITY[domain].implemented;
}

export function isVisualLabDetailScaleSupported(
  domain: ImplementedVisualLabDomain,
  outputScale: FieldOutputScale,
): outputScale is VisualLabDetailScale {
  const supportedScales: readonly FieldOutputScale[] =
    VISUAL_LAB_IMPLEMENTED_DOMAIN_DESCRIPTORS[domain].executionProfile.detailScales;
  return supportedScales.includes(outputScale);
}

export interface VisualLabExecutionContext {
  readonly backend: VisualLabExecutionProfile['backend'] | 'canvas2d';
  readonly pipeline: VisualLabExecutionProfile['pipeline'] | 'none';
  readonly detailScale: FieldOutputScale;
}

/** Positive-path check; every false result preserves the ordinary baseline. */
export function isVisualLabExecutionSupported(
  domain: VisualLabDomain,
  context: Readonly<VisualLabExecutionContext>,
): domain is ImplementedVisualLabDomain {
  if (!isVisualLabDomainImplemented(domain)) return false;
  const profile = VISUAL_LAB_IMPLEMENTED_DOMAIN_DESCRIPTORS[domain].executionProfile;
  return context.backend === profile.backend
    && context.pipeline === profile.pipeline
    && isVisualLabDetailScaleSupported(domain, context.detailScale);
}

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
  if (look === 'classic') return DISABLED_VISUAL_LAB_STATE;

  const parameters = new URLSearchParams(search);
  const requestedDomain = parameters.get('visualLab');
  const requestedVariant = parseVariant(parameters.get('visualVariant'));
  const explicitExperiment = isDomain(requestedDomain)
    && requestedDomain !== 'off'
    && isVisualLabDomainImplemented(requestedDomain)
    && requestedVariant !== undefined;

  if (!isDomain(requestedDomain) || requestedDomain === 'off'
    || !isVisualLabDomainImplemented(requestedDomain)
    || (parameters.get('inputAudit') === '1' && !explicitExperiment)) {
    return DISABLED_VISUAL_LAB_STATE;
  }
  if (!isVisualLabExecutionSupported(requestedDomain, {
    backend: 'webgl', pipeline: 'normal-hdr', detailScale: outputScale,
  })) {
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
