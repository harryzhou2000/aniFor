import { describe, expect, it } from 'vitest';
import { RenderOptics } from './render-optics';
import {
  buildMaterialAppearanceProfileGLSLSelector,
  MATERIAL_APPEARANCE_PROFILE_GLSL_SELECTOR,
  MATERIAL_APPEARANCE_PROFILES,
  MATERIAL_APPEARANCE_PROFILE_MAXIMUM,
  MATERIAL_APPEARANCE_PROFILE_MINIMUM,
  validateMaterialAppearanceProfiles,
  type MaterialAppearanceProfiles,
} from './material-appearance-profiles';

describe('material appearance profiles', () => {
  it('keeps every phase response immutable, finite, and bounded', () => {
    expect(Object.isFrozen(MATERIAL_APPEARANCE_PROFILES)).toBe(true);
    for (const phase of Object.values(MATERIAL_APPEARANCE_PROFILES)) {
      expect(Object.isFrozen(phase)).toBe(true);
      expect(Object.isFrozen(phase.default)).toBe(true);
      expect(Object.isFrozen(phase.overrides)).toBe(true);
      for (const response of Object.values(phase.overrides)) {
        expect(Object.isFrozen(response)).toBe(true);
        for (const lane of response) {
          expect(Number.isFinite(lane)).toBe(true);
          expect(lane).toBeGreaterThanOrEqual(MATERIAL_APPEARANCE_PROFILE_MINIMUM);
          expect(lane).toBeLessThanOrEqual(MATERIAL_APPEARANCE_PROFILE_MAXIMUM);
        }
      }
    }
    expect(() => validateMaterialAppearanceProfiles(MATERIAL_APPEARANCE_PROFILES)).not.toThrow();
  });

  it('rejects unknown classes and out-of-range response lanes before shader assembly', () => {
    const unknownRenderOptics = 99 as RenderOptics;
    const unknownOptics: MaterialAppearanceProfiles = {
      ...MATERIAL_APPEARANCE_PROFILES,
      gas: {
        ...MATERIAL_APPEARANCE_PROFILES.gas,
        overrides: { ...MATERIAL_APPEARANCE_PROFILES.gas.overrides, [unknownRenderOptics]: [1, 1, 1, 1] },
      },
    };
    const unboundedLane: MaterialAppearanceProfiles = {
      ...MATERIAL_APPEARANCE_PROFILES,
      liquid: {
        ...MATERIAL_APPEARANCE_PROFILES.liquid,
        overrides: {
          ...MATERIAL_APPEARANCE_PROFILES.liquid.overrides,
          [RenderOptics.Aqueous]: [1, 1, 3, 1],
        },
      },
    };
    const wrongPhase: MaterialAppearanceProfiles = {
      ...MATERIAL_APPEARANCE_PROFILES,
      powder: {
        ...MATERIAL_APPEARANCE_PROFILES.powder,
        overrides: {
          ...MATERIAL_APPEARANCE_PROFILES.powder.overrides,
          [RenderOptics.Aqueous]: [1, 1, 1, 1],
        },
      },
    };

    expect(() => validateMaterialAppearanceProfiles(unknownOptics)).toThrow(/unknown RenderOptics/);
    expect(() => validateMaterialAppearanceProfiles(unboundedLane)).toThrow(/out-of-range/);
    expect(() => validateMaterialAppearanceProfiles(wrongPhase)).toThrow(/phase-incompatible/);
  });

  it('emits the existing phase-family response vocabulary deterministically', () => {
    const first = buildMaterialAppearanceProfileGLSLSelector();
    expect(MATERIAL_APPEARANCE_PROFILE_GLSL_SELECTOR).toBe(first);
    expect(buildMaterialAppearanceProfileGLSLSelector()).toBe(first);
    expect(first).toContain('if (abs(optics - 13.0) < 0.5) return vec4(1.24, 0.82, 1.04, 1.22);');
    expect(first).toContain('if (abs(optics - 17.0) < 0.5) return vec4(1.34, 1.1, 0.92, 0.58);');
    expect(first).toContain('if (abs(optics - 5.0) < 0.5) return vec4(0.74, 1.28, 1.12, 0.64);');
    expect(first).toContain('if (enabled < 0.5 || optics < 0.5) return vec4(1.0);');
    expect(first).not.toContain('Material.');
  });
});
