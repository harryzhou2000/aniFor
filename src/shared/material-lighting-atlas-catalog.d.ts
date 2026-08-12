export interface MaterialLightingAtlasPoint { readonly x: number; readonly y: number }
export interface MaterialLightingAtlasRect extends MaterialLightingAtlasPoint {
  readonly width: number; readonly height: number;
}
export interface MaterialLightingAtlasEllipse extends MaterialLightingAtlasPoint {
  readonly radiusX: number; readonly radiusY: number;
}
export interface MaterialLightingAtlasCloud {
  readonly bounds: MaterialLightingAtlasRect;
  readonly probe: MaterialLightingAtlasPoint;
  readonly lobes: readonly MaterialLightingAtlasEllipse[];
}
export interface MaterialLightingInspectionRegion extends MaterialLightingAtlasRect {
  readonly name: string; readonly role: 'response' | 'control';
}
export interface MaterialLightingAtlasDescriptor {
  readonly materials: Readonly<Record<
    'empty' | 'sand' | 'water' | 'fire' | 'smoke' | 'oil' | 'clay' | 'fog'
    | 'liquidCoolEmitter' | 'gasCoolEmitter', number
  >>;
  readonly powder: Readonly<{
    readonly sand: MaterialLightingAtlasRect; readonly clay: MaterialLightingAtlasRect;
    readonly hole: MaterialLightingAtlasRect; readonly fineColumn: MaterialLightingAtlasRect;
    readonly warmEmitter: MaterialLightingAtlasRect;
  }>;
  readonly liquid: Readonly<{
    readonly water: MaterialLightingAtlasRect; readonly oil: MaterialLightingAtlasRect;
    readonly waterHole: MaterialLightingAtlasRect; readonly oilChimney: MaterialLightingAtlasRect;
    readonly coolEmitter: MaterialLightingAtlasRect;
  }>;
  readonly gas: Readonly<{
    readonly smoke: MaterialLightingAtlasCloud; readonly fog: MaterialLightingAtlasCloud;
    readonly smokeHole: MaterialLightingAtlasRect; readonly fogChannel: MaterialLightingAtlasRect;
    readonly warmEmitter: MaterialLightingAtlasRect; readonly coolEmitter: MaterialLightingAtlasRect;
    readonly sparseSmoke: readonly MaterialLightingAtlasPoint[];
  }>;
  readonly guardedBlank: MaterialLightingAtlasRect;
  readonly inspectionRegions: readonly MaterialLightingInspectionRegion[];
}
export interface MaterialLightingAtlasCatalogEntry {
  readonly candidate: string;
  readonly world: Readonly<{ readonly width: number; readonly height: number }>;
  readonly descriptor: MaterialLightingAtlasDescriptor;
}
export declare const MATERIAL_LIGHTING_ATLAS_CATALOG_SCHEMA:
  'anifor.visual-lab.material-lighting-atlas-catalog/v1';
export declare const MATERIAL_LIGHTING_ATLAS_CATALOG: Readonly<{
  readonly schema: typeof MATERIAL_LIGHTING_ATLAS_CATALOG_SCHEMA;
  readonly atlases: readonly Readonly<MaterialLightingAtlasCatalogEntry>[];
}>;
