import {
  MaterialAppearancePhaseCode,
  type MaterialAppearancePhase,
} from './material-appearance-profiles';

/** Phase-level weights; exact materials remain owned by appearance profiles. */
export interface MaterialCompositionProfile {
  readonly bodyLighting: number;
  readonly profileSheen: number;
  readonly irradiance: number;
  readonly penetrationPath: number;
  readonly pigmentCoupling: number;
  readonly volumeScatter: number;
  readonly farSideShadow: number;
  readonly ambientGrounding: number;
  /** Phase-wide strength of B-only shallow-to-core form; topology stays caller-owned. */
  readonly interiorContrast: number;
  /** B-only analytic sky/ground transport; zero keeps a phase outside the response. */
  readonly environmentTransport: number;
}

export type MaterialCompositionProfiles = Readonly<Record<
  MaterialAppearancePhase,
  MaterialCompositionProfile
>>;

export const MATERIAL_COMPOSITION_PROFILE_MINIMUM = 0;
export const MATERIAL_COMPOSITION_PROFILE_MAXIMUM = 1.5;

const PHASES = Object.freeze([
  Object.freeze({ name: 'powder', code: MaterialAppearancePhaseCode.Powder }),
  Object.freeze({ name: 'liquid', code: MaterialAppearancePhaseCode.Liquid }),
  Object.freeze({ name: 'gas', code: MaterialAppearancePhaseCode.Gas }),
  Object.freeze({ name: 'solid', code: MaterialAppearancePhaseCode.Solid }),
] as const);

const profile = (
  bodyLighting: number, profileSheen: number, irradiance: number,
  penetrationPath: number, pigmentCoupling: number, volumeScatter: number,
  farSideShadow: number, ambientGrounding: number, interiorContrast: number,
  environmentTransport: number,
): MaterialCompositionProfile => Object.freeze({
  bodyLighting, profileSheen, irradiance, penetrationPath,
  pigmentCoupling, volumeScatter, farSideShadow, ambientGrounding, interiorContrast,
  environmentTransport,
});

/**
 * Broad phase balance for the shared Volumetric look. Family-specific optics
 * still shape the response; these values keep powder restrained, give liquids
 * a clearer transmissive body, and let gases carry light through their middle.
 */
export const MATERIAL_COMPOSITION_PROFILES: MaterialCompositionProfiles = Object.freeze({
  powder: profile(0.94, 0.30, 0.80, 0.84, 0.58, 0.34, 0.84, 1.08, 0.90, 0.34),
  liquid: profile(1.18, 1.28, 1.16, 0.56, 0.34, 1.30, 0.74, 0.78, 1.14, 1.22),
  gas: profile(1.14, 1.02, 1.08, 0.32, 0.24, 1.36, 0.56, 0.58, 1.18, 0.92),
  solid: profile(1.10, 1.10, 0.94, 0.74, 0.44, 0.72, 0.98, 0.94, 1.00, 1.05),
});

const PROFILE_FIELDS = Object.freeze([
  'bodyLighting', 'profileSheen', 'irradiance', 'penetrationPath',
  'pigmentCoupling', 'volumeScatter', 'farSideShadow', 'ambientGrounding',
  'interiorContrast', 'environmentTransport',
] as const satisfies readonly (keyof MaterialCompositionProfile)[]);

export function validateMaterialCompositionProfiles(
  profiles: MaterialCompositionProfiles,
): void {
  const phaseNames = Object.keys(profiles).sort();
  const expectedPhases = PHASES.map(({ name }) => name).sort();
  if (JSON.stringify(phaseNames) !== JSON.stringify(expectedPhases)) {
    throw new Error('material composition profiles must cover exactly powder, liquid, gas, and solid');
  }
  for (const { name } of PHASES) {
    const response = profiles[name];
    const fields = Object.keys(response).sort();
    if (JSON.stringify(fields) !== JSON.stringify([...PROFILE_FIELDS].sort())) {
      throw new Error(`${name} material composition profile has an invalid field set`);
    }
    for (const field of PROFILE_FIELDS) {
      const value = response[field];
      if (!Number.isFinite(value)
        || value < MATERIAL_COMPOSITION_PROFILE_MINIMUM
        || value > MATERIAL_COMPOSITION_PROFILE_MAXIMUM) {
        throw new Error(`${name}.${field} has an out-of-range composition weight`);
      }
    }
  }
}

const glslFloat = (value: number): string => Number.isInteger(value) ? `${value}.0` : `${value}`;
const glslProfile = (value: MaterialCompositionProfile): string => (
  `MaterialCompositionResponse(${PROFILE_FIELDS.map((field) => glslFloat(value[field])).join(', ')})`
);

/** Deterministic source-only selector; no uniform, texture, or material plane. */
export function buildMaterialCompositionProfileGLSLSelector(
  profiles: MaterialCompositionProfiles = MATERIAL_COMPOSITION_PROFILES,
): string {
  validateMaterialCompositionProfiles(profiles);
  const lines = [
    'struct MaterialCompositionResponse {',
    ...PROFILE_FIELDS.map((field) => `  float ${field};`),
    '};',
    'MaterialCompositionResponse materialCompositionParameters(float phase) {',
  ];
  for (const { name, code } of PHASES) {
    const response = glslProfile(profiles[name]);
    if (code === MaterialAppearancePhaseCode.Powder) lines.push(`  if (phase < 0.5) return ${response};`);
    else if (code === MaterialAppearancePhaseCode.Liquid) lines.push(`  if (phase < 1.5) return ${response};`);
    else if (code === MaterialAppearancePhaseCode.Gas) lines.push(`  if (phase < 2.5) return ${response};`);
    else lines.push(`  return ${response};`);
  }
  lines.push('}');
  return lines.join('\n');
}

export const MATERIAL_COMPOSITION_PROFILE_GLSL_SELECTOR =
  buildMaterialCompositionProfileGLSLSelector();
