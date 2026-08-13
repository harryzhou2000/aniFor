import { describe, expect, it } from 'vitest';

import {
  MATERIAL_COMPOSITION_PROFILE_FIELDS,
  MATERIAL_MESOSCALE_PROFILE_FIELDS,
  MATERIAL_PHASE_PROFILE_CATALOG,
  validateMaterialPhaseProfileCatalog,
} from './material-phase-profile-catalog.js';

const recursivelyFrozen = (value: unknown): boolean => {
  if (value === null || typeof value !== 'object') return true;
  return Object.isFrozen(value) && Object.values(value).every(recursivelyFrozen);
};

describe('material phase profile catalog', () => {
  it('owns the exact ordered phase codes, names, fields, and response records', () => {
    expect(MATERIAL_COMPOSITION_PROFILE_FIELDS).toEqual([
      'bodyLighting', 'profileSheen', 'irradiance', 'penetrationPath',
      'pigmentCoupling', 'volumeScatter', 'farSideShadow', 'ambientGrounding',
      'interiorContrast', 'environmentTransport',
    ]);
    expect(MATERIAL_MESOSCALE_PROFILE_FIELDS).toEqual([
      'radius', 'supportLow', 'supportHigh',
      'slopeBlend', 'curvatureBlend', 'neighbourBlend',
    ]);
    expect(MATERIAL_PHASE_PROFILE_CATALOG.phases).toEqual([
      { code: 0, name: 'powder', composition: {
        bodyLighting: 0.94, profileSheen: 0.30, irradiance: 0.80,
        penetrationPath: 0.84, pigmentCoupling: 0.58, volumeScatter: 0.34,
        farSideShadow: 0.84, ambientGrounding: 1.08, interiorContrast: 0.90,
        environmentTransport: 0.34,
      }, mesoscale: {
        radius: 0, supportLow: 0, supportHigh: 1,
        slopeBlend: 0, curvatureBlend: 0, neighbourBlend: 0,
      } },
      { code: 1, name: 'liquid', composition: {
        bodyLighting: 1.18, profileSheen: 1.28, irradiance: 1.16,
        penetrationPath: 0.56, pigmentCoupling: 0.34, volumeScatter: 1.30,
        farSideShadow: 0.74, ambientGrounding: 0.78, interiorContrast: 1.14,
        environmentTransport: 1.22,
      }, mesoscale: {
        radius: 8, supportLow: 0.46, supportHigh: 0.82,
        slopeBlend: 0.72, curvatureBlend: 0.68, neighbourBlend: 0.64,
      } },
      { code: 2, name: 'gas', composition: {
        bodyLighting: 1.14, profileSheen: 1.02, irradiance: 1.08,
        penetrationPath: 0.32, pigmentCoupling: 0.24, volumeScatter: 1.36,
        farSideShadow: 0.56, ambientGrounding: 0.58, interiorContrast: 1.18,
        environmentTransport: 0.92,
      }, mesoscale: {
        radius: 8, supportLow: 0.018, supportHigh: 0.16,
        slopeBlend: 0.76, curvatureBlend: 0.72, neighbourBlend: 0.64,
      } },
      { code: 3, name: 'solid', composition: {
        bodyLighting: 1.10, profileSheen: 1.10, irradiance: 0.94,
        penetrationPath: 0.74, pigmentCoupling: 0.44, volumeScatter: 0.72,
        farSideShadow: 0.98, ambientGrounding: 0.94, interiorContrast: 1.00,
        environmentTransport: 1.05,
      }, mesoscale: {
        radius: 0, supportLow: 0, supportHigh: 1,
        slopeBlend: 0, curvatureBlend: 0, neighbourBlend: 0,
      } },
    ]);
    expect(recursivelyFrozen(MATERIAL_PHASE_PROFILE_CATALOG)).toBe(true);
  });

  it('rejects phase drift and malformed composition or mesoscale records', () => {
    const phaseDrift = structuredClone(MATERIAL_PHASE_PROFILE_CATALOG) as any;
    phaseDrift.phases[1].code = 2;
    expect(() => validateMaterialPhaseProfileCatalog(phaseDrift)).toThrow('invalid phases');

    const compositionDrift = structuredClone(MATERIAL_PHASE_PROFILE_CATALOG) as any;
    compositionDrift.phases[0].composition.environmentTransport = 2;
    expect(() => validateMaterialPhaseProfileCatalog(compositionDrift))
      .toThrow('invalid composition values');

    const mesoscaleDrift = structuredClone(MATERIAL_PHASE_PROFILE_CATALOG) as any;
    mesoscaleDrift.phases[2].mesoscale.supportLow = 0.5;
    expect(() => validateMaterialPhaseProfileCatalog(mesoscaleDrift))
      .toThrow('reversed mesoscale support');
  });
});
