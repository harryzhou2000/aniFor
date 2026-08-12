export interface OpposedSourceAtlasPoint { readonly x: number; readonly y: number }
export interface OpposedSourceAtlasRect extends OpposedSourceAtlasPoint {
  readonly width: number; readonly height: number;
}
export interface OpposedSourceInspectionRegion extends OpposedSourceAtlasRect {
  readonly name: string; readonly role: 'response' | 'control';
}
export interface OpposedSourceAtlasCard {
  readonly material: 1 | 26 | 28;
  readonly code: 'SAND' | 'CLAY' | 'CONC';
  readonly body: OpposedSourceAtlasRect;
  readonly warmSource: OpposedSourceAtlasRect;
  readonly coolSource: OpposedSourceAtlasRect;
  readonly warmGap: OpposedSourceAtlasRect;
  readonly coolGap: OpposedSourceAtlasRect;
  readonly authoredHole: OpposedSourceAtlasRect;
  readonly fineColumn: OpposedSourceAtlasRect;
  readonly fineSource: OpposedSourceAtlasRect;
  readonly fineGap: OpposedSourceAtlasRect;
  readonly darkCore: OpposedSourceAtlasRect;
}
export interface OpposedSourceAtlasDescriptor {
  readonly materials: Readonly<Record<
    'empty' | 'sand' | 'water' | 'fire' | 'concrete' | 'clay' | 'elec', number
  >>;
  readonly conductiveWall: number;
  readonly cards: readonly OpposedSourceAtlasCard[];
  readonly isolatedSand: OpposedSourceAtlasPoint;
  readonly wetSuspension: Readonly<{
    readonly water: OpposedSourceAtlasRect;
    readonly mixture: OpposedSourceAtlasRect;
    readonly source: OpposedSourceAtlasRect;
    readonly gap: OpposedSourceAtlasRect;
    readonly lightFacingSand: OpposedSourceAtlasPoint;
    readonly sandWeave: Readonly<{
      readonly period: number; readonly sandResidues: readonly number[];
    }>;
  }>;
  readonly nativeWall: OpposedSourceAtlasPoint;
  readonly transportOccluder: Readonly<{
    readonly wall: OpposedSourceAtlasRect;
    readonly litFrontShoulder: OpposedSourceAtlasRect;
    readonly umbra: OpposedSourceAtlasRect;
    readonly openShoulder: OpposedSourceAtlasRect;
  }>;
  readonly wallFreeControl: OpposedSourceAtlasRect;
  readonly inspectionRegions: readonly OpposedSourceInspectionRegion[];
}
export interface OpposedSourceAtlasCatalogEntry {
  readonly candidate: string;
  readonly world: Readonly<{ readonly width: number; readonly height: number }>;
  readonly descriptor: OpposedSourceAtlasDescriptor;
}
export declare const OPPOSED_SOURCE_MATERIAL_LIGHTING_ATLAS_CATALOG_SCHEMA:
  'anifor.visual-lab.opposed-source-material-lighting-atlas-catalog/v1';
export declare const OPPOSED_SOURCE_MATERIAL_LIGHTING_ATLAS_CATALOG: Readonly<{
  readonly schema: typeof OPPOSED_SOURCE_MATERIAL_LIGHTING_ATLAS_CATALOG_SCHEMA;
  readonly atlases: readonly Readonly<OpposedSourceAtlasCatalogEntry>[];
}>;
