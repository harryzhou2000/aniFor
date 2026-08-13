export type MaterialAppearanceProfilePhase = 'powder' | 'liquid' | 'gas' | 'solid';
export type MaterialAppearanceProfileLane =
  | 'key' | 'fill' | 'pigment' | 'transmission' | 'roughness' | 'interiorScatter';
export type MaterialAppearanceProfileTuple = readonly [
  number, number, number, number, number, number,
];
export interface MaterialAppearanceProfileFamilyEntry {
  readonly optics: number;
  readonly name: string;
  readonly profile: MaterialAppearanceProfileTuple;
}
export interface MaterialAppearanceProfilePhaseEntry {
  readonly name: MaterialAppearanceProfilePhase;
  readonly fallback: MaterialAppearanceProfileTuple;
  readonly families: readonly Readonly<MaterialAppearanceProfileFamilyEntry>[];
}
export declare const MATERIAL_APPEARANCE_PROFILE_CATALOG_SCHEMA:
  'anifor.material-appearance-profile-catalog/v1';
export declare const MATERIAL_APPEARANCE_PROFILE_LANES:
  readonly MaterialAppearanceProfileLane[];
export declare const MATERIAL_APPEARANCE_PROFILE_CATALOG: Readonly<{
  readonly schema: typeof MATERIAL_APPEARANCE_PROFILE_CATALOG_SCHEMA;
  readonly lanes: typeof MATERIAL_APPEARANCE_PROFILE_LANES;
  readonly phases: readonly Readonly<MaterialAppearanceProfilePhaseEntry>[];
}>;
export declare function validateMaterialAppearanceProfileCatalog(value: unknown): unknown;
export declare function resolveMaterialAppearanceProfileCatalogEntry(
  phaseName: string,
  optics: number,
): Readonly<MaterialAppearanceProfileFamilyEntry> | null;
