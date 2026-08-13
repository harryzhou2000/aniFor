import { RENDER_OPTICS_CLASS_COUNT, RenderOptics } from './render-optics';
import { MATERIAL_APPEARANCE_PROFILE_CATALOG } from '../shared/material-appearance-profile-catalog.js';

/**
 * Stable phase codes shared by the normal and compact material-body finish.
 * They are source constants, not a runtime material plane or shader uniform.
 */
export const enum MaterialAppearancePhaseCode {
  Powder = 0,
  Liquid = 1,
  Gas = 2,
  Solid = 3,
}

export type MaterialAppearancePhase = 'powder' | 'liquid' | 'gas' | 'solid';

/**
 * Key/reflection, fill/absorption, pigment retention, transmission, bounded
 * material lobe width, and source-shaped interior scatter. The first four
 * lanes retain their established ordering so Canvas consumers can continue to
 * project the lanes they already own without learning about WebGL-only response.
 */
export type MaterialAppearanceProfile = readonly [number, number, number, number, number, number];

export interface MaterialAppearancePhaseProfiles {
  readonly default: MaterialAppearanceProfile;
  readonly overrides: Readonly<Partial<Record<RenderOptics, MaterialAppearanceProfile>>>;
}

export type MaterialAppearanceProfiles = Readonly<Record<
  MaterialAppearancePhase,
  MaterialAppearancePhaseProfiles
>>;

/** Broad enough for every currently approved response while rejecting accidental extremes. */
export const MATERIAL_APPEARANCE_PROFILE_MINIMUM = 0.5;
export const MATERIAL_APPEARANCE_PROFILE_MAXIMUM = 1.5;

const PHASES: readonly { readonly name: MaterialAppearancePhase; readonly code: MaterialAppearancePhaseCode }[] = [
  { name: 'powder', code: MaterialAppearancePhaseCode.Powder },
  { name: 'liquid', code: MaterialAppearancePhaseCode.Liquid },
  { name: 'gas', code: MaterialAppearancePhaseCode.Gas },
  { name: 'solid', code: MaterialAppearancePhaseCode.Solid },
];

/** Actionable phase/class pairs that require profile-authoring review coverage. */
export const MATERIAL_APPEARANCE_PHASE_OPTICS = Object.freeze(Object.fromEntries(
  MATERIAL_APPEARANCE_PROFILE_CATALOG.phases.map(({ name, families }) => [
    name, Object.freeze(families.map(({ optics }) => optics as RenderOptics)),
  ]),
)) as Readonly<Record<MaterialAppearancePhase, readonly RenderOptics[]>>;

function profile(
  key: number,
  fill: number,
  pigment: number,
  transmission: number,
  roughness = 1,
  interiorScatter = 1,
): MaterialAppearanceProfile {
  return Object.freeze([key, fill, pigment, transmission, roughness, interiorScatter]);
}

function phaseProfiles(
  fallback: MaterialAppearanceProfile,
  overrides: Partial<Record<RenderOptics, MaterialAppearanceProfile>>,
): MaterialAppearancePhaseProfiles {
  return Object.freeze({ default: fallback, overrides: Object.freeze(overrides) });
}

/**
 * The closed, family-level body-finish vocabulary. Exact materials only choose
 * a RenderOptics class elsewhere; adding a material here is deliberately
 * impossible. The values match the pre-profile shared GLSL selector.
 */
export const MATERIAL_APPEARANCE_PROFILES: MaterialAppearanceProfiles = Object.freeze(
  Object.fromEntries(MATERIAL_APPEARANCE_PROFILE_CATALOG.phases.map((entry) => [
    entry.name,
    phaseProfiles(entry.fallback, Object.fromEntries(entry.families
      .filter(({ profile: response }) => response.some((lane, index) => (
        lane !== entry.fallback[index]
      )))
      .map((family) => [family.optics, family.profile]))),
  ])),
) as MaterialAppearanceProfiles;

const MATERIAL_APPEARANCE_IDENTITY_PROFILE = profile(1, 1, 1, 1, 1, 1);

/**
 * Allocation-free runtime projection of the same phase/class vocabulary that
 * generates the WebGL selector. Canvas consumers may use only lanes with a
 * direct equivalent in their own transport; this resolver does not imply that
 * shader key, pigment, or topology arithmetic should be copied into Canvas.
 */
export function resolveMaterialAppearanceProfile(
  phase: MaterialAppearancePhase,
  optics: number,
): MaterialAppearanceProfile {
  if (!knownRenderOptics(optics) || optics === RenderOptics.Default) {
    return MATERIAL_APPEARANCE_IDENTITY_PROFILE;
  }
  const phaseProfiles = MATERIAL_APPEARANCE_PROFILES[phase];
  return phaseProfiles.overrides[optics as RenderOptics] ?? phaseProfiles.default;
}

function knownRenderOptics(optics: number): boolean {
  return Number.isInteger(optics)
    && optics >= RenderOptics.Default
    && optics < RENDER_OPTICS_CLASS_COUNT;
}

function validateProfile(label: string, value: MaterialAppearanceProfile): void {
  if (value.length !== 6) throw new Error(`${label} must have six response lanes`);
  for (const lane of value) {
    if (!Number.isFinite(lane)
      || lane < MATERIAL_APPEARANCE_PROFILE_MINIMUM
      || lane > MATERIAL_APPEARANCE_PROFILE_MAXIMUM) {
      throw new Error(`${label} has an out-of-range response lane`);
    }
  }
}

/** Reject invalid class keys or unbounded response data before shader assembly. */
export function validateMaterialAppearanceProfiles(profiles: MaterialAppearanceProfiles): void {
  for (const { name } of PHASES) {
    const phase = profiles[name];
    if (!phase) throw new Error(`missing ${name} material appearance profile`);
    validateProfile(`${name} default`, phase.default);
    for (const [rawOptics, response] of Object.entries(phase.overrides)) {
      const optics = Number(rawOptics);
      if (!knownRenderOptics(optics) || optics === RenderOptics.Default) {
        throw new Error(`${name} has an unknown RenderOptics override`);
      }
      if (!(MATERIAL_APPEARANCE_PHASE_OPTICS[name] as readonly number[]).includes(optics)) {
        throw new Error(`${name} has a phase-incompatible RenderOptics override`);
      }
      validateProfile(`${name} RenderOptics.${optics}`, response);
    }
  }
}

function glslFloat(value: number): string {
  return Number.isInteger(value) ? `${value}.0` : `${value}`;
}

function glslProfile(value: MaterialAppearanceProfile): string {
  return `MaterialBodyFinishResponse(vec4(${value.slice(0, 4).map(glslFloat).join(', ')}), ${glslFloat(value[4])}, ${glslFloat(value[5])})`;
}

function orderedOverrides(
  profiles: MaterialAppearancePhaseProfiles,
): readonly (readonly [number, MaterialAppearanceProfile])[] {
  return Object.entries(profiles.overrides)
    .map(([rawOptics, response]) => [Number(rawOptics), response] as const)
    .sort(([left], [right]) => left - right);
}

/**
 * Deterministically emits the compact selector embedded by MATERIAL_BODY_FINISH_GLSL.
 * It is evaluated while assembling shader source, never per fragment; generated GLSL
 * contains only enum-owned numeric constants and arithmetic-only returns.
 */
export function buildMaterialAppearanceProfileGLSLSelector(
  profiles: MaterialAppearanceProfiles = MATERIAL_APPEARANCE_PROFILES,
): string {
  validateMaterialAppearanceProfiles(profiles);
  const lines = [
    'struct MaterialBodyFinishResponse {',
    '  vec4 optics;',
    '  float roughness;',
    '  float interiorScatter;',
    '};',
    'MaterialBodyFinishResponse materialBodyFinishParameters(float phase, float optics, float enabled) {',
    '  if (enabled < 0.5 || optics < 0.5) return MaterialBodyFinishResponse(vec4(1.0), 1.0, 1.0);',
  ];

  for (const { name, code } of PHASES) {
    const phaseProfiles = profiles[name];
    if (code === MaterialAppearancePhaseCode.Powder) lines.push('  if (phase < 0.5) {');
    else if (code === MaterialAppearancePhaseCode.Liquid) lines.push('  if (phase < 1.5) {');
    else if (code === MaterialAppearancePhaseCode.Gas) lines.push('  if (phase < 2.5) {');
    else lines.push('  {');
    for (const [optics, response] of orderedOverrides(phaseProfiles)) {
      lines.push(`    if (abs(optics - ${glslFloat(optics)}) < 0.5) return ${glslProfile(response)};`);
    }
    lines.push(`    return ${glslProfile(phaseProfiles.default)};`);
    lines.push('  }');
  }
  lines.push('}');
  return lines.join('\n');
}

/** Validated once at module initialization, before either WebGL program exists. */
export const MATERIAL_APPEARANCE_PROFILE_GLSL_SELECTOR =
  buildMaterialAppearanceProfileGLSLSelector();
