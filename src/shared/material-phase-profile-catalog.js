/**
 * Renderer-independent phase-level material response authoring. Renderer
 * selectors and inspection tooling project from these frozen records; this
 * catalog grants no runtime material, shader, or capture authority.
 */

export const MATERIAL_PHASE_PROFILE_CATALOG_SCHEMA = (
  'anifor.material-phase-profile-catalog/v1'
);

export const MATERIAL_COMPOSITION_PROFILE_FIELDS = Object.freeze([
  'bodyLighting', 'profileSheen', 'irradiance', 'penetrationPath',
  'pigmentCoupling', 'volumeScatter', 'farSideShadow', 'ambientGrounding',
  'interiorContrast', 'environmentTransport',
]);

export const MATERIAL_MESOSCALE_PROFILE_FIELDS = Object.freeze([
  'radius', 'supportLow', 'supportHigh',
  'slopeBlend', 'curvatureBlend', 'neighbourBlend',
]);

const deepFreeze = (value) => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
};

const composition = (
  bodyLighting, profileSheen, irradiance, penetrationPath,
  pigmentCoupling, volumeScatter, farSideShadow, ambientGrounding,
  interiorContrast, environmentTransport,
) => ({
  bodyLighting, profileSheen, irradiance, penetrationPath,
  pigmentCoupling, volumeScatter, farSideShadow, ambientGrounding,
  interiorContrast, environmentTransport,
});

const mesoscale = (
  radius, supportLow, supportHigh, slopeBlend, curvatureBlend, neighbourBlend,
) => ({ radius, supportLow, supportHigh, slopeBlend, curvatureBlend, neighbourBlend });

const phase = (code, name, compositionProfile, mesoscaleProfile) => ({
  code, name, composition: compositionProfile, mesoscale: mesoscaleProfile,
});

const catalog = {
  schema: MATERIAL_PHASE_PROFILE_CATALOG_SCHEMA,
  compositionFields: MATERIAL_COMPOSITION_PROFILE_FIELDS,
  mesoscaleFields: MATERIAL_MESOSCALE_PROFILE_FIELDS,
  phases: [
    phase(0, 'powder',
      composition(0.94, 0.30, 0.80, 0.84, 0.58, 0.34, 0.84, 1.08, 0.90, 0.34),
      mesoscale(0, 0, 1, 0, 0, 0)),
    phase(1, 'liquid',
      composition(1.18, 1.28, 1.16, 0.56, 0.34, 1.30, 0.74, 0.78, 1.14, 1.22),
      mesoscale(8, 0.46, 0.82, 0.72, 0.68, 0.64)),
    phase(2, 'gas',
      composition(1.14, 1.02, 1.08, 0.32, 0.24, 1.36, 0.56, 0.58, 1.18, 0.92),
      mesoscale(8, 0.018, 0.16, 0.76, 0.72, 0.64)),
    phase(3, 'solid',
      composition(1.10, 1.10, 0.94, 0.74, 0.44, 0.72, 0.98, 0.94, 1.00, 1.05),
      mesoscale(0, 0, 1, 0, 0, 0)),
  ],
};

const hasExactFields = (value, fields) => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
  && Reflect.ownKeys(value).length === fields.length
  && fields.every((field) => Object.hasOwn(value, field))
);

export function validateMaterialPhaseProfileCatalog(value) {
  if (value?.schema !== MATERIAL_PHASE_PROFILE_CATALOG_SCHEMA
    || value.compositionFields?.some((field, index) => (
      field !== MATERIAL_COMPOSITION_PROFILE_FIELDS[index]
    ))
    || value.compositionFields?.length !== MATERIAL_COMPOSITION_PROFILE_FIELDS.length
    || value.mesoscaleFields?.some((field, index) => (
      field !== MATERIAL_MESOSCALE_PROFILE_FIELDS[index]
    ))
    || value.mesoscaleFields?.length !== MATERIAL_MESOSCALE_PROFILE_FIELDS.length
    || !Array.isArray(value.phases) || value.phases.length !== 4) {
    throw new TypeError('Material phase profile catalog is malformed');
  }
  const expectedPhases = ['powder', 'liquid', 'gas', 'solid'];
  for (const [index, entry] of value.phases.entries()) {
    if (!hasExactFields(entry, ['code', 'name', 'composition', 'mesoscale'])
      || entry.code !== index || entry.name !== expectedPhases[index]
      || !hasExactFields(entry.composition, MATERIAL_COMPOSITION_PROFILE_FIELDS)
      || !hasExactFields(entry.mesoscale, MATERIAL_MESOSCALE_PROFILE_FIELDS)) {
      throw new TypeError('Material phase profile catalog has invalid phases');
    }
    for (const field of MATERIAL_COMPOSITION_PROFILE_FIELDS) {
      const response = entry.composition[field];
      if (!Number.isFinite(response) || response < 0 || response > 1.5) {
        throw new TypeError('Material phase profile catalog has invalid composition values');
      }
    }
    for (const field of MATERIAL_MESOSCALE_PROFILE_FIELDS) {
      const response = entry.mesoscale[field];
      const maximum = field === 'radius' ? 24 : 1;
      if (!Number.isFinite(response) || response < 0 || response > maximum) {
        throw new TypeError('Material phase profile catalog has invalid mesoscale values');
      }
    }
    if (entry.mesoscale.supportLow > entry.mesoscale.supportHigh) {
      throw new TypeError('Material phase profile catalog has reversed mesoscale support');
    }
  }
  return value;
}

validateMaterialPhaseProfileCatalog(catalog);
export const MATERIAL_PHASE_PROFILE_CATALOG = deepFreeze(catalog);

export function resolveMaterialPhaseProfileCatalogEntry(phaseName) {
  return MATERIAL_PHASE_PROFILE_CATALOG.phases.find(({ name }) => name === phaseName) ?? null;
}
