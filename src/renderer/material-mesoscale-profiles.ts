import type { MaterialAppearancePhase } from './material-appearance-profiles';
import {
  MATERIAL_MESOSCALE_PROFILE_FIELDS,
  MATERIAL_PHASE_PROFILE_CATALOG,
} from '../shared/material-phase-profile-catalog.js';

export interface MaterialMesoscaleProfile {
  readonly radius: number;
  readonly supportLow: number;
  readonly supportHigh: number;
  readonly slopeBlend: number;
  readonly curvatureBlend: number;
  readonly neighbourBlend: number;
}

export type MaterialMesoscaleProfiles = Readonly<Record<
  MaterialAppearancePhase,
  MaterialMesoscaleProfile
>>;

/**
 * Simulation-cell observation radii and response weights for broad material
 * shape. A zero radius is an explicit no-op until that phase owns a stable,
 * visually proven carrier.
 */
export const MATERIAL_MESOSCALE_PROFILES = Object.freeze(Object.fromEntries(
  MATERIAL_PHASE_PROFILE_CATALOG.phases.map(({ name, mesoscale: response }) => [name, response]),
)) as MaterialMesoscaleProfiles;

const PHASES = MATERIAL_PHASE_PROFILE_CATALOG.phases;
const FIELDS = MATERIAL_MESOSCALE_PROFILE_FIELDS as ReadonlyArray<
  keyof MaterialMesoscaleProfile
>;

export function validateMaterialMesoscaleProfiles(
  profiles: MaterialMesoscaleProfiles,
): void {
  if (JSON.stringify(Object.keys(profiles).sort())
    !== JSON.stringify(PHASES.map(({ name }) => name).sort())) {
    throw new Error('material mesoscale profiles must cover exactly powder, liquid, gas, and solid');
  }
  for (const { name } of PHASES) {
    const value = profiles[name];
    if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...FIELDS].sort())) {
      throw new Error(`${name} material mesoscale profile has an invalid field set`);
    }
    if (!Number.isFinite(value.radius) || value.radius < 0 || value.radius > 24) {
      throw new Error(`${name}.radius has an out-of-range mesoscale value`);
    }
    for (const field of FIELDS.slice(1)) {
      if (!Number.isFinite(value[field]) || value[field] < 0 || value[field] > 1) {
        throw new Error(`${name}.${field} has an out-of-range mesoscale value`);
      }
    }
    if (value.supportLow > value.supportHigh) {
      throw new Error(`${name} material mesoscale support range is reversed`);
    }
  }
}

const glslFloat = (value: number): string => Number.isInteger(value) ? `${value}.0` : `${value}`;
const glslProfile = (value: MaterialMesoscaleProfile): string => (
  `MaterialMesoscaleResponse(${FIELDS.map((field) => glslFloat(value[field])).join(', ')})`
);

export function buildMaterialMesoscaleProfileGLSLSelector(
  profiles: MaterialMesoscaleProfiles = MATERIAL_MESOSCALE_PROFILES,
): string {
  validateMaterialMesoscaleProfiles(profiles);
  const lines = [
    'struct MaterialMesoscaleResponse {',
    ...FIELDS.map((field) => `  float ${field};`),
    '};',
    'MaterialMesoscaleResponse materialMesoscaleParameters(float phase) {',
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

export const MATERIAL_MESOSCALE_PROFILE_GLSL_SELECTOR =
  buildMaterialMesoscaleProfileGLSLSelector();
