import { describe, expect, it } from 'vitest';
import {
  MATERIAL_COMPOSITION_PROFILES,
  buildMaterialCompositionProfileGLSLSelector,
  validateMaterialCompositionProfiles,
  type MaterialCompositionProfiles,
} from './material-composition-profiles';

describe('material composition profiles', () => {
  it('keeps the extracted phase vocabulary deeply frozen and valid', () => {
    validateMaterialCompositionProfiles(MATERIAL_COMPOSITION_PROFILES);
    expect(Object.isFrozen(MATERIAL_COMPOSITION_PROFILES)).toBe(true);
    for (const response of Object.values(MATERIAL_COMPOSITION_PROFILES)) {
      expect(Object.isFrozen(response)).toBe(true);
    }
    expect(MATERIAL_COMPOSITION_PROFILES.gas).toEqual({
      bodyLighting: 0.90, profileSheen: 0.78, irradiance: 0.82,
      penetrationPath: 0.58, pigmentCoupling: 0.16, volumeScatter: 0.82,
      farSideShadow: 0.44, ambientGrounding: 0.42,
    });
  });

  it('emits one deterministic arithmetic-only phase selector', () => {
    const first = buildMaterialCompositionProfileGLSLSelector();
    expect(buildMaterialCompositionProfileGLSLSelector()).toBe(first);
    expect(first.match(/MaterialCompositionResponse materialCompositionParameters/g)).toHaveLength(1);
    expect(first).toContain('if (phase < 0.5)');
    expect(first).toContain('if (phase < 1.5)');
    expect(first).toContain('if (phase < 2.5)');
    expect(first).not.toMatch(/uniform|sampler|texture/i);
  });

  it('rejects missing, extra, and unbounded authoring data', () => {
    const missing = { ...MATERIAL_COMPOSITION_PROFILES } as Record<string, unknown>;
    delete missing.gas;
    expect(() => validateMaterialCompositionProfiles(
      missing as MaterialCompositionProfiles,
    )).toThrow('cover exactly');
    const extra = {
      ...MATERIAL_COMPOSITION_PROFILES,
      plasma: MATERIAL_COMPOSITION_PROFILES.gas,
    } as unknown as MaterialCompositionProfiles;
    expect(() => validateMaterialCompositionProfiles(extra)).toThrow('cover exactly');
    const invalid = {
      ...MATERIAL_COMPOSITION_PROFILES,
      liquid: { ...MATERIAL_COMPOSITION_PROFILES.liquid, irradiance: Number.NaN },
    } as MaterialCompositionProfiles;
    expect(() => validateMaterialCompositionProfiles(invalid)).toThrow('liquid.irradiance');
  });
});
