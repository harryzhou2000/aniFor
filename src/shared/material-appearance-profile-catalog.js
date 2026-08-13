/**
 * Renderer-independent authoring source for the six class-level appearance
 * lanes. Browser shader assembly and Node review tooling derive from these same
 * frozen rows; this module grants no runtime material or capture authority.
 */

export const MATERIAL_APPEARANCE_PROFILE_CATALOG_SCHEMA = (
  'anifor.material-appearance-profile-catalog/v1'
);

export const MATERIAL_APPEARANCE_PROFILE_LANES = Object.freeze([
  'key', 'fill', 'pigment', 'transmission', 'roughness', 'interiorScatter',
]);

const deepFreeze = (value) => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
};

const family = (optics, name, profile) => ({ optics, name, profile });
const phase = (name, fallback, families) => ({ name, fallback, families });

const catalog = {
  schema: MATERIAL_APPEARANCE_PROFILE_CATALOG_SCHEMA,
  lanes: MATERIAL_APPEARANCE_PROFILE_LANES,
  phases: [
    phase('powder', [0.90, 1.10, 1.08, 0.80, 1.18, 0.90], [
      family(7, 'RoughGranular', [0.90, 1.10, 1.08, 0.80, 1.18, 0.90]),
      family(13, 'CrystallineGranular', [1.24, 0.82, 1.04, 1.22, 0.76, 1.05]),
      family(14, 'SootyGranular', [0.72, 1.30, 1.26, 0.64, 1.30, 0.72]),
      family(15, 'MetallicGranular', [1.32, 1.08, 0.92, 0.58, 0.72, 0.58]),
    ]),
    phase('liquid', [1, 1, 1, 1, 1, 1], [
      family(1, 'Aqueous', [1.10, 0.86, 0.82, 1.18, 0.92, 1.25]),
      family(2, 'Oily', [0.94, 1.12, 1.24, 0.72, 1.14, 0.72]),
      family(3, 'Corrosive', [1.16, 1.02, 1.16, 1.02, 0.98, 0.95]),
      family(4, 'Molten', [0.78, 0.82, 1.30, 0.54, 0.88, 0.65]),
      family(16, 'CryogenicLiquid', [1.26, 0.74, 0.78, 1.28, 0.76, 1.28]),
      family(17, 'MetallicLiquid', [1.34, 1.10, 0.92, 0.58, 0.70, 0.62]),
      family(18, 'ViscousLiquid', [0.86, 1.16, 1.22, 0.66, 1.24, 0.76]),
    ]),
    phase('gas', [1, 1, 1, 1, 1, 1], [
      family(5, 'SootyGas', [0.74, 1.28, 1.12, 0.64, 1.30, 0.72]),
      family(6, 'CleanGas', [1.16, 0.76, 0.76, 1.28, 0.94, 1.28]),
    ]),
    phase('solid', [1, 1, 1, 1, 1, 1], [
      family(8, 'SmoothRigid', [1.18, 1.12, 1.06, 0.72, 0.92, 0.80]),
      family(9, 'Organic', [0.92, 1.16, 1.12, 0.78, 1.14, 0.80]),
      family(10, 'Device', [1.12, 1.50, 1.04, 0.50, 0.88, 0.60]),
      family(11, 'Radioactive', [0.98, 1.24, 1.10, 0.80, 1.04, 0.82]),
      family(12, 'TranslucentRigid', [1.34, 0.82, 0.84, 1.42, 0.76, 1.25]),
      family(20, 'MetallicRigid', [1.42, 1.08, 1.12, 0.56, 0.62, 0.55]),
      family(21, 'Waxy', [1.04, 1.12, 1.18, 0.90, 1.06, 1.18]),
    ]),
  ],
};

export function validateMaterialAppearanceProfileCatalog(value) {
  if (value?.schema !== MATERIAL_APPEARANCE_PROFILE_CATALOG_SCHEMA
    || value.lanes?.length !== 6
    || value.lanes.some((lane, index) => lane !== MATERIAL_APPEARANCE_PROFILE_LANES[index])
    || !Array.isArray(value.phases) || value.phases.length !== 4) {
    throw new TypeError('Material appearance profile catalog is malformed');
  }
  const phases = new Set();
  const pairs = new Set();
  for (const phaseEntry of value.phases) {
    if (!['powder', 'liquid', 'gas', 'solid'].includes(phaseEntry?.name)
      || phases.has(phaseEntry.name)
      || !Array.isArray(phaseEntry.families) || phaseEntry.families.length === 0) {
      throw new TypeError('Material appearance profile catalog has invalid phases');
    }
    phases.add(phaseEntry.name);
    const profiles = [phaseEntry.fallback, ...phaseEntry.families.map(({ profile }) => profile)];
    if (profiles.some((profile) => !Array.isArray(profile) || profile.length !== 6
      || profile.some((lane) => !Number.isFinite(lane) || lane < 0.5 || lane > 1.5))) {
      throw new TypeError('Material appearance profile catalog has invalid response lanes');
    }
    for (const familyEntry of phaseEntry.families) {
      const pair = `${phaseEntry.name}:${familyEntry.optics}`;
      if (!Number.isInteger(familyEntry.optics) || familyEntry.optics <= 0
        || !/^[A-Z][A-Za-z]+$/.test(familyEntry.name ?? '') || pairs.has(pair)) {
        throw new TypeError('Material appearance profile catalog has invalid families');
      }
      pairs.add(pair);
    }
  }
  return value;
}

validateMaterialAppearanceProfileCatalog(catalog);
export const MATERIAL_APPEARANCE_PROFILE_CATALOG = deepFreeze(catalog);

export function resolveMaterialAppearanceProfileCatalogEntry(phaseName, optics) {
  const phaseEntry = MATERIAL_APPEARANCE_PROFILE_CATALOG.phases.find(
    ({ name }) => name === phaseName,
  );
  if (!phaseEntry) return null;
  const familyEntry = phaseEntry.families.find((entry) => entry.optics === optics);
  if (!familyEntry) return null;
  return familyEntry;
}
