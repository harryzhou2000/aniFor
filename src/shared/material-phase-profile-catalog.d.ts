export type MaterialPhaseProfilePhase = 'powder' | 'liquid' | 'gas' | 'solid';
export type MaterialPhaseProfileCode = 0 | 1 | 2 | 3;
export type MaterialCompositionProfileField =
  | 'bodyLighting' | 'profileSheen' | 'irradiance' | 'penetrationPath'
  | 'pigmentCoupling' | 'volumeScatter' | 'farSideShadow' | 'ambientGrounding'
  | 'interiorContrast' | 'environmentTransport';
export type MaterialMesoscaleProfileField =
  | 'radius' | 'supportLow' | 'supportHigh'
  | 'slopeBlend' | 'curvatureBlend' | 'neighbourBlend';
export type MaterialCompositionProfileRecord = Readonly<Record<
  MaterialCompositionProfileField, number
>>;
export type MaterialMesoscaleProfileRecord = Readonly<Record<
  MaterialMesoscaleProfileField, number
>>;
export interface MaterialPhaseProfileCatalogEntry {
  readonly code: MaterialPhaseProfileCode;
  readonly name: MaterialPhaseProfilePhase;
  readonly composition: MaterialCompositionProfileRecord;
  readonly mesoscale: MaterialMesoscaleProfileRecord;
}
export declare const MATERIAL_PHASE_PROFILE_CATALOG_SCHEMA:
  'anifor.material-phase-profile-catalog/v1';
export declare const MATERIAL_COMPOSITION_PROFILE_FIELDS:
  readonly MaterialCompositionProfileField[];
export declare const MATERIAL_MESOSCALE_PROFILE_FIELDS:
  readonly MaterialMesoscaleProfileField[];
export declare const MATERIAL_PHASE_PROFILE_CATALOG: Readonly<{
  readonly schema: typeof MATERIAL_PHASE_PROFILE_CATALOG_SCHEMA;
  readonly compositionFields: typeof MATERIAL_COMPOSITION_PROFILE_FIELDS;
  readonly mesoscaleFields: typeof MATERIAL_MESOSCALE_PROFILE_FIELDS;
  readonly phases: readonly Readonly<MaterialPhaseProfileCatalogEntry>[];
}>;
export declare function validateMaterialPhaseProfileCatalog(value: unknown): unknown;
export declare function resolveMaterialPhaseProfileCatalogEntry(
  phaseName: string,
): Readonly<MaterialPhaseProfileCatalogEntry> | null;
