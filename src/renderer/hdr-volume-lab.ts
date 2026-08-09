import {
  HDR_VOLUME_LAB_EMISSION_DESCRIPTOR,
} from './hdr-volume-lab-emission';
import { HDR_VOLUME_LAB_GAS_DESCRIPTOR } from './hdr-volume-lab-gas';
import { HDR_VOLUME_LAB_LIQUID_DESCRIPTOR } from './hdr-volume-lab-liquid';
import {
  VISUAL_LAB_IMPLEMENTED_DOMAIN_DESCRIPTORS,
  type ImplementedVisualLabDomain,
  type VisualLabDomainShaderAdapter,
} from './visual-lab';

const GLSL_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const FORBIDDEN_ADAPTER_SOURCE = /#version|\buniform\b|\bvoid\s+main\s*\(|\b(?:finalColor|gl_FragColor|uTime)\b|\.a\s*=/;
const VISUAL_LAB_HOOKS = new Set(['liquid-surface', 'volume-field']);

export interface HDRVisualLabShaderAssembly {
  readonly adapters: readonly VisualLabDomainShaderAdapter[];
  readonly domainAdapters: Readonly<Record<
    ImplementedVisualLabDomain,
    VisualLabDomainShaderAdapter
  >>;
  readonly source: string;
}

const liquidSurfaceCall = (entryPoint: string, domainCode: number): string => `
  if (labDomain == ${domainCode}.0) {
    return ${entryPoint}(
      radiance, material, surface, ripple, outward, transmitted, reflected,
      wallBacked, motion, motionFacing, flowFacing
    );
  }`;

const renderLiquidSurfaceDispatch = (
  adapters: readonly VisualLabDomainShaderAdapter[],
): string => `
vec3 applyHdrLiquidSurfaceLab(
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
${adapters.map(({ entryPoint, domainCode }) => (
    liquidSurfaceCall(entryPoint, domainCode)
  )).join('\n')}
  return radiance;
}
`;

const volumeFieldCall = (entryPoint: string, domainCode: number): string => `
  if (labDomain == ${domainCode}.0) {
    return ${entryPoint}(
      radiance, uv, worldPosition, labTarget, labVariant, labGain
    );
  }`;

const renderVolumeFieldDispatch = (
  adapters: readonly VisualLabDomainShaderAdapter[],
): string => {
  const outsideVolumeDomains = adapters.length > 0
    ? adapters.map(({ domainCode }) => `labDomain != ${domainCode}.0`).join(' && ')
    : 'true';
  return `
vec3 applyHdrVolumeLab(vec3 radiance, vec2 uv) {
  float labDomain = floor(uVisualLab.x + 0.5);
  float labVariant = floor(uVisualLab.y + 0.5);
  float labTarget = floor(uVisualLab.z + 0.5);
  float labGain = clamp(uVisualLab.w, 0.0, 2.0);
  if (labVariant < 0.5 || labGain < 0.0001) return radiance;
  // Only volume-field domains pay the shared native-wall sample. This guard is
  // generated from exact domain codes rather than relying on their ordering.
  if (${outsideVolumeDomains}) return radiance;

  float wall = floor(texture(uWallTexture, boundedUv(uv)).r * 255.0 + 0.5);
  if (wall > 0.5) return radiance;
  vec2 worldPosition = uv / uWorldTexel;
${adapters.map(({ entryPoint, domainCode }) => (
    volumeFieldCall(entryPoint, domainCode)
  )).join('\n')}
  return radiance;
}
`;
};

const validateAdapter = (
  adapter: VisualLabDomainShaderAdapter,
  index: number,
  domains: Set<string>,
  domainCodes: Set<number>,
  entryPoints: Set<string>,
): void => {
  if (!adapter || typeof adapter !== 'object') {
    throw new TypeError(`HDR Visual Lab adapter at index ${index} must be an object`);
  }
  const { domain, domainCode, entryPoint, hook, source } = adapter;
  if (!Object.hasOwn(VISUAL_LAB_IMPLEMENTED_DOMAIN_DESCRIPTORS, domain)) {
    throw new TypeError(`HDR Visual Lab adapter at index ${index} has unknown domain ${String(domain)}`);
  }
  if (domains.has(domain)) throw new TypeError(`duplicate HDR Visual Lab domain ${domain}`);
  if (!Number.isInteger(domainCode)) {
    throw new TypeError(`HDR Visual Lab domain ${domain} has a non-integer domain code`);
  }
  if (domainCodes.has(domainCode)) {
    throw new TypeError(`duplicate HDR Visual Lab domain code ${domainCode}`);
  }
  const expectedCode = VISUAL_LAB_IMPLEMENTED_DOMAIN_DESCRIPTORS[domain].domainCode;
  if (domainCode !== expectedCode) {
    throw new TypeError(
      `HDR Visual Lab domain ${domain} must use domain code ${expectedCode}`,
    );
  }
  if (!VISUAL_LAB_HOOKS.has(hook)) {
    throw new TypeError(`HDR Visual Lab domain ${domain} has unsupported hook ${String(hook)}`);
  }
  if (typeof entryPoint !== 'string' || !GLSL_IDENTIFIER.test(entryPoint)) {
    throw new TypeError(`HDR Visual Lab domain ${domain} has an unsafe GLSL entry point`);
  }
  if (entryPoints.has(entryPoint)) {
    throw new TypeError(`duplicate HDR Visual Lab entry point ${entryPoint}`);
  }
  if (typeof source !== 'string' || source.trim().length === 0) {
    throw new TypeError(`HDR Visual Lab domain ${domain} has empty GLSL source`);
  }
  if (FORBIDDEN_ADAPTER_SOURCE.test(source)) {
    throw new TypeError(`HDR Visual Lab domain ${domain} source escapes the adapter seam`);
  }
  const declaration = new RegExp(`\\bvec3\\s+${entryPoint}\\s*\\(`);
  if (!declaration.test(source)) {
    throw new TypeError(
      `HDR Visual Lab domain ${domain} source does not declare ${entryPoint}`,
    );
  }
  domains.add(domain);
  domainCodes.add(domainCode);
  entryPoints.add(entryPoint);
};

/**
 * Validates and assembles the closed normal-HDR experiment registry. Leaf
 * modules own candidate arithmetic; this host owns source order and both hook
 * ABIs, so descriptors never carry executable invocation snippets.
 */
export function assembleHdrVisualLabShader(
  input: readonly VisualLabDomainShaderAdapter[],
): HDRVisualLabShaderAssembly {
  if (!Array.isArray(input)) throw new TypeError('HDR Visual Lab adapters must be an array');
  const domains = new Set<string>();
  const domainCodes = new Set<number>();
  const entryPoints = new Set<string>();
  input.forEach((adapter, index) => (
    validateAdapter(adapter, index, domains, domainCodes, entryPoints)
  ));

  const expectedDomains = Object.keys(VISUAL_LAB_IMPLEMENTED_DOMAIN_DESCRIPTORS);
  const actualDomains = input.map(({ domain }) => domain);
  if (actualDomains.join(',') !== expectedDomains.join(',')) {
    throw new TypeError(
      `HDR Visual Lab adapters must be complete and ordered: ${expectedDomains.join(', ')}`,
    );
  }

  const adapters = Object.freeze([...input]);
  const domainAdapters = Object.freeze(Object.fromEntries(
    adapters.map((adapter) => [adapter.domain, adapter]),
  )) as Readonly<Record<ImplementedVisualLabDomain, VisualLabDomainShaderAdapter>>;
  const liquidSurfaceAdapters = adapters.filter(({ hook }) => hook === 'liquid-surface');
  const volumeFieldAdapters = adapters.filter(({ hook }) => hook === 'volume-field');
  const source = [
    ...adapters.map((adapter) => adapter.source),
    renderLiquidSurfaceDispatch(liquidSurfaceAdapters),
    renderVolumeFieldDispatch(volumeFieldAdapters),
  ].join('\n');
  return Object.freeze({ adapters, domainAdapters, source });
}

/**
 * Stable, complete authoring seam for normal-scale RGB-only Visual Lab
 * comparisons. The canonical tuple is the sole source of source/dispatch
 * ordering; the presenter remains authoritative for support and alpha.
 */
const HDR_VISUAL_LAB_SHADER = assembleHdrVisualLabShader([
  HDR_VOLUME_LAB_LIQUID_DESCRIPTOR,
  HDR_VOLUME_LAB_GAS_DESCRIPTOR,
  HDR_VOLUME_LAB_EMISSION_DESCRIPTOR,
]);

export const HDR_VOLUME_LAB_ADAPTERS = HDR_VISUAL_LAB_SHADER.adapters;
export const HDR_VOLUME_LAB_DOMAIN_ADAPTERS = HDR_VISUAL_LAB_SHADER.domainAdapters;

/** Ordinary pages still compile none of this expanded-compositor payload. */
export const HDR_VOLUME_LAB_GLSL = HDR_VISUAL_LAB_SHADER.source;
