import { describe, expect, it } from 'vitest';

import {
  MATERIAL_APPEARANCE_PROFILE_CATALOG,
  MATERIAL_APPEARANCE_PROFILE_LANES,
  validateMaterialAppearanceProfileCatalog,
} from './material-appearance-profile-catalog.js';

const recursivelyFrozen = (value: unknown): boolean => {
  if (value === null || typeof value !== 'object') return true;
  return Object.isFrozen(value) && Object.values(value).every(recursivelyFrozen);
};

describe('material appearance profile catalog', () => {
  it('owns the exact ordered phase, class, and lane vocabulary', () => {
    expect(MATERIAL_APPEARANCE_PROFILE_LANES).toEqual([
      'key', 'fill', 'pigment', 'transmission', 'roughness', 'interiorScatter',
    ]);
    expect(MATERIAL_APPEARANCE_PROFILE_CATALOG.phases.map(({ name, families }) => ({
      name, families: families.map(({ optics, name: familyName }) => [optics, familyName]),
    }))).toEqual([
      { name: 'powder', families: [[7, 'RoughGranular'], [13, 'CrystallineGranular'], [14, 'SootyGranular'], [15, 'MetallicGranular']] },
      { name: 'liquid', families: [[1, 'Aqueous'], [2, 'Oily'], [3, 'Corrosive'], [4, 'Molten'], [16, 'CryogenicLiquid'], [17, 'MetallicLiquid'], [18, 'ViscousLiquid']] },
      { name: 'gas', families: [[5, 'SootyGas'], [6, 'CleanGas']] },
      { name: 'solid', families: [[8, 'SmoothRigid'], [9, 'Organic'], [10, 'Device'], [11, 'Radioactive'], [12, 'TranslucentRigid'], [20, 'MetallicRigid'], [21, 'Waxy']] },
    ]);
    expect(recursivelyFrozen(MATERIAL_APPEARANCE_PROFILE_CATALOG)).toBe(true);
  });

  it('keeps every fallback and family tuple finite, bounded, and six-wide', () => {
    for (const phase of MATERIAL_APPEARANCE_PROFILE_CATALOG.phases) {
      for (const profile of [phase.fallback, ...phase.families.map(({ profile }) => profile)]) {
        expect(profile).toHaveLength(6);
        expect(profile.every((lane) => Number.isFinite(lane) && lane >= 0.5 && lane <= 1.5))
          .toBe(true);
      }
    }
    expect(() => validateMaterialAppearanceProfileCatalog(MATERIAL_APPEARANCE_PROFILE_CATALOG))
      .not.toThrow();
  });

  it('rejects duplicate classes and malformed response lanes before projection', () => {
    const duplicate = structuredClone(MATERIAL_APPEARANCE_PROFILE_CATALOG) as any;
    duplicate.phases[0].families.push(structuredClone(duplicate.phases[0].families[0]));
    expect(() => validateMaterialAppearanceProfileCatalog(duplicate)).toThrow('invalid families');

    const malformed = structuredClone(MATERIAL_APPEARANCE_PROFILE_CATALOG) as any;
    malformed.phases[1].families[0].profile[5] = 4;
    expect(() => validateMaterialAppearanceProfileCatalog(malformed))
      .toThrow('invalid response lanes');
  });
});
