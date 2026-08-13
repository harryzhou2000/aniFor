import type { MaterialAppearancePhase } from './material-appearance-profiles';
import {
  MATERIAL_COMPOSITION_PROFILE_FIELDS,
  MATERIAL_PHASE_PROFILE_CATALOG,
} from '../shared/material-phase-profile-catalog.js';

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

const PHASES = MATERIAL_PHASE_PROFILE_CATALOG.phases;

/**
 * Broad phase balance for the shared Volumetric look. Family-specific optics
 * still shape the response; these values keep powder restrained, give liquids
 * a clearer transmissive body, and let gases carry light through their middle.
 */
export const MATERIAL_COMPOSITION_PROFILES = Object.freeze(Object.fromEntries(
  PHASES.map(({ name, composition: response }) => [name, response]),
)) as MaterialCompositionProfiles;

const PROFILE_FIELDS = MATERIAL_COMPOSITION_PROFILE_FIELDS as ReadonlyArray<
  keyof MaterialCompositionProfile
>;

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
    if (code === 0) lines.push(`  if (phase < 0.5) return ${response};`);
    else if (code === 1) lines.push(`  if (phase < 1.5) return ${response};`);
    else if (code === 2) lines.push(`  if (phase < 2.5) return ${response};`);
    else lines.push(`  return ${response};`);
  }
  lines.push('}');
  return lines.join('\n');
}

export const MATERIAL_COMPOSITION_PROFILE_GLSL_SELECTOR =
  buildMaterialCompositionProfileGLSLSelector();
