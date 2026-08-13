import { describe, expect, it } from 'vitest';
import { RenderOptics } from './render-optics';
import {
  buildMaterialAppearanceProfileGLSLSelector,
  MATERIAL_APPEARANCE_PROFILE_GLSL_SELECTOR,
  MATERIAL_APPEARANCE_PROFILES,
  MATERIAL_APPEARANCE_PHASE_OPTICS,
  MATERIAL_APPEARANCE_PROFILE_MAXIMUM,
  MATERIAL_APPEARANCE_PROFILE_MINIMUM,
  resolveMaterialAppearanceProfile,
  validateMaterialAppearanceProfiles,
  type MaterialAppearanceProfiles,
} from './material-appearance-profiles';

describe('material appearance profiles', () => {
  it('publishes the frozen actionable phase and optics coverage vocabulary', () => {
    expect(MATERIAL_APPEARANCE_PHASE_OPTICS).toEqual({
      powder: [7, 13, 14, 15],
      liquid: [1, 2, 3, 4, 16, 17, 18],
      gas: [5, 6],
      solid: [8, 9, 10, 11, 12, 20, 21],
    });
    expect(Object.isFrozen(MATERIAL_APPEARANCE_PHASE_OPTICS)).toBe(true);
    for (const optics of Object.values(MATERIAL_APPEARANCE_PHASE_OPTICS)) {
      expect(Object.isFrozen(optics)).toBe(true);
    }
  });

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
        overrides: { ...MATERIAL_APPEARANCE_PROFILES.gas.overrides, [unknownRenderOptics]: [1, 1, 1, 1, 1, 1] },
      },
    };
    const unboundedLane: MaterialAppearanceProfiles = {
      ...MATERIAL_APPEARANCE_PROFILES,
      liquid: {
        ...MATERIAL_APPEARANCE_PROFILES.liquid,
        overrides: {
          ...MATERIAL_APPEARANCE_PROFILES.liquid.overrides,
          [RenderOptics.Aqueous]: [1, 1, 3, 1, 1, 1],
        },
      },
    };
    const wrongPhase: MaterialAppearanceProfiles = {
      ...MATERIAL_APPEARANCE_PROFILES,
      powder: {
        ...MATERIAL_APPEARANCE_PROFILES.powder,
        overrides: {
          ...MATERIAL_APPEARANCE_PROFILES.powder.overrides,
          [RenderOptics.Aqueous]: [1, 1, 1, 1, 1, 1],
        },
      },
    };

    expect(() => validateMaterialAppearanceProfiles(unknownOptics)).toThrow(/unknown RenderOptics/);
    expect(() => validateMaterialAppearanceProfiles(unboundedLane)).toThrow(/out-of-range/);
    expect(() => validateMaterialAppearanceProfiles(wrongPhase)).toThrow(/phase-incompatible/);
  });

  it('emits the phase-family optics and roughness vocabulary deterministically', () => {
    const first = buildMaterialAppearanceProfileGLSLSelector();
    expect(MATERIAL_APPEARANCE_PROFILE_GLSL_SELECTOR).toBe(first);
    expect(buildMaterialAppearanceProfileGLSLSelector()).toBe(first);
    expect(first).toContain('struct MaterialBodyFinishResponse {');
    expect(first).toContain('vec4 optics;');
    expect(first).toContain('float roughness;');
    expect(first).toContain('float interiorScatter;');
    expect(first).toContain('if (abs(optics - 13.0) < 0.5) return MaterialBodyFinishResponse(vec4(1.24, 0.82, 1.04, 1.22), 0.76, 1.05);');
    expect(first).toContain('if (abs(optics - 17.0) < 0.5) return MaterialBodyFinishResponse(vec4(1.34, 1.1, 0.92, 0.58), 0.7, 0.62);');
    expect(first).toContain('if (abs(optics - 5.0) < 0.5) return MaterialBodyFinishResponse(vec4(0.74, 1.28, 1.12, 0.64), 1.3, 0.72);');
    expect(first).toContain('if (abs(optics - 9.0) < 0.5) return MaterialBodyFinishResponse(vec4(0.92, 1.16, 1.12, 0.78), 1.14, 0.8);');
    expect(first).toContain('if (abs(optics - 10.0) < 0.5) return MaterialBodyFinishResponse(vec4(1.12, 1.5, 1.04, 0.5), 0.88, 0.6);');
    expect(first).toContain('if (abs(optics - 11.0) < 0.5) return MaterialBodyFinishResponse(vec4(0.98, 1.24, 1.1, 0.8), 1.04, 0.82);');
    expect(first).toContain('if (abs(optics - 12.0) < 0.5) return MaterialBodyFinishResponse(vec4(1.34, 0.82, 0.84, 1.42), 0.76, 1.25);');
    expect(first).toContain('if (abs(optics - 20.0) < 0.5) return MaterialBodyFinishResponse(vec4(1.42, 1.08, 1.12, 0.56), 0.62, 0.55);');
    expect(first).toContain('if (enabled < 0.5 || optics < 0.5) return MaterialBodyFinishResponse(vec4(1.0), 1.0, 1.0);');
    expect(first).not.toContain('Material.');
  });

  it('preserves the established optics lanes and bounds family lobe widths', () => {
    const powder = MATERIAL_APPEARANCE_PROFILES.powder;
    expect(powder.default.slice(0, 4)).toEqual([0.90, 1.10, 1.08, 0.80]);
    expect(powder.overrides[RenderOptics.CrystallineGranular]?.slice(0, 4))
      .toEqual([1.24, 0.82, 1.04, 1.22]);
    expect(powder.overrides[RenderOptics.SootyGranular]?.[4]).toBeGreaterThan(1);
    expect(powder.overrides[RenderOptics.CrystallineGranular]?.[4]).toBeLessThan(1);
    expect(MATERIAL_APPEARANCE_PROFILES.liquid.overrides[RenderOptics.ViscousLiquid]?.[4])
      .toBeGreaterThan(1);
    expect(MATERIAL_APPEARANCE_PROFILES.liquid.overrides[RenderOptics.MetallicLiquid]?.[4])
      .toBeLessThan(1);
    expect(MATERIAL_APPEARANCE_PROFILES.solid.overrides[RenderOptics.TranslucentRigid]?.[4])
      .toBeLessThan(1);
    expect(MATERIAL_APPEARANCE_PROFILES.solid.overrides[RenderOptics.MetallicRigid]?.[4])
      .toBeLessThan(MATERIAL_APPEARANCE_PROFILES.solid.overrides[RenderOptics.SmoothRigid]![4]);
    expect(MATERIAL_APPEARANCE_PROFILES.solid.overrides[RenderOptics.Waxy])
      .toEqual([1.04, 1.12, 1.18, 0.90, 1.06, 1.18]);
    expect(MATERIAL_APPEARANCE_PROFILES.liquid.overrides[RenderOptics.Aqueous]?.[5])
      .toBeGreaterThan(MATERIAL_APPEARANCE_PROFILES.liquid.overrides[RenderOptics.Oily]![5]);
    expect(MATERIAL_APPEARANCE_PROFILES.gas.overrides[RenderOptics.CleanGas]?.[5])
      .toBeGreaterThan(MATERIAL_APPEARANCE_PROFILES.gas.overrides[RenderOptics.SootyGas]![5]);
  });

  it('resolves the same frozen phase override or fallback without allocating', () => {
    const aqueous = resolveMaterialAppearanceProfile('liquid', RenderOptics.Aqueous);
    expect(aqueous).toBe(MATERIAL_APPEARANCE_PROFILES.liquid.overrides[RenderOptics.Aqueous]);
    expect(resolveMaterialAppearanceProfile('liquid', RenderOptics.Aqueous)).toBe(aqueous);
    expect(resolveMaterialAppearanceProfile('liquid', RenderOptics.CleanGas))
      .toBe(MATERIAL_APPEARANCE_PROFILES.liquid.default);
    const identity = resolveMaterialAppearanceProfile('gas', RenderOptics.Default);
    expect(identity).toEqual([1, 1, 1, 1, 1, 1]);
    expect(Object.isFrozen(identity)).toBe(true);
    expect(resolveMaterialAppearanceProfile('gas', -1)).toBe(identity);
    expect(resolveMaterialAppearanceProfile('gas', 255)).toBe(identity);
    expect(resolveMaterialAppearanceProfile('solid', RenderOptics.TranslucentRigid))
      .toBe(MATERIAL_APPEARANCE_PROFILES.solid.overrides[RenderOptics.TranslucentRigid]);
    expect(resolveMaterialAppearanceProfile('solid', RenderOptics.Device))
      .toBe(MATERIAL_APPEARANCE_PROFILES.solid.overrides[RenderOptics.Device]);
    expect(resolveMaterialAppearanceProfile('solid', RenderOptics.MetallicRigid))
      .toBe(MATERIAL_APPEARANCE_PROFILES.solid.overrides[RenderOptics.MetallicRigid]);
    expect(resolveMaterialAppearanceProfile('solid', RenderOptics.Waxy))
      .toBe(MATERIAL_APPEARANCE_PROFILES.solid.overrides[RenderOptics.Waxy]);
  });
});
