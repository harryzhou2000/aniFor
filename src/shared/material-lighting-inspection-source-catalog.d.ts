export type MaterialLightingInspectionProjection = 'declared' | 'gas-geometry' | 'solid-template';
export interface MaterialLightingInspectionSource {
  readonly name: string;
  readonly projection: MaterialLightingInspectionProjection;
  readonly atlases: readonly Readonly<{
    readonly candidate: string;
    readonly world: Readonly<{ readonly width: number; readonly height: number }>;
    readonly descriptor: Readonly<Record<string, unknown>>;
  }>[];
}
export declare const MATERIAL_LIGHTING_INSPECTION_SOURCE_CATALOG_SCHEMA:
  'anifor.visual-lab.material-lighting-inspection-source-catalog/v1';
export declare const MATERIAL_LIGHTING_INSPECTION_SOURCE_CATALOG: Readonly<{
  readonly schema: typeof MATERIAL_LIGHTING_INSPECTION_SOURCE_CATALOG_SCHEMA;
  readonly sources: readonly Readonly<MaterialLightingInspectionSource>[];
}>;
