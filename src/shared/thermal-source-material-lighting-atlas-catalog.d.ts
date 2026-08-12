export interface ThermalSourceAtlasPoint { readonly x: number; readonly y: number }
export interface ThermalSourceAtlasRect extends ThermalSourceAtlasPoint {
  readonly width: number; readonly height: number;
}
export interface ThermalSourceAtlasCard {
  readonly key: 'ambient' | 'onset' | 'warm' | 'orange' | 'bright';
  readonly material: 25;
  readonly temperature: number;
  readonly temperatureByte: number;
  readonly card: ThermalSourceAtlasRect;
  readonly body: ThermalSourceAtlasRect;
  readonly core: ThermalSourceAtlasRect;
  readonly authoredHole: ThermalSourceAtlasRect;
  readonly openNotch: ThermalSourceAtlasRect;
  readonly thinLine: ThermalSourceAtlasRect;
  readonly isolated: ThermalSourceAtlasPoint;
  readonly wallCoexistence: ThermalSourceAtlasRect;
  readonly waterContact: Readonly<{
    readonly ceramic: ThermalSourceAtlasRect; readonly water: ThermalSourceAtlasRect;
  }>;
  readonly hotControls: Readonly<{
    readonly brick: ThermalSourceAtlasRect & Readonly<{ readonly material: 22 }>;
    readonly metal: ThermalSourceAtlasRect & Readonly<{ readonly material: 23 }>;
  }>;
  readonly guardedBlank: ThermalSourceAtlasRect;
}
export interface ThermalSourceAtlasInspectionRegion extends ThermalSourceAtlasRect {
  readonly name: string; readonly role: 'response' | 'control';
}
export interface ThermalSourceAtlasDescriptor {
  readonly snapshot: Readonly<{
    readonly version: 1; readonly world: Readonly<{ readonly width: 612; readonly height: 384 }>;
    readonly material: 25; readonly ambientTemperature: number;
    readonly conductiveWall: 1; readonly wallBlockSize: 4;
    readonly expected: Readonly<{
      readonly ceramicCells: number; readonly waterCells: number; readonly brickCells: number;
      readonly metalCells: number; readonly wallCells: number;
      readonly temperatureCounts: readonly Readonly<{ readonly temperature: number; readonly cells: number }>[];
      readonly materialHash: number; readonly temperatureHash: number; readonly wallHash: number;
    }>;
  }>;
  readonly materials: Readonly<Record<'empty' | 'water' | 'fire' | 'brick' | 'metal' | 'ceramic', number>>;
  readonly cards: readonly ThermalSourceAtlasCard[];
  readonly inspectionRegions: readonly ThermalSourceAtlasInspectionRegion[];
}
export interface ThermalSourceAtlasCatalogEntry {
  readonly candidate: string;
  readonly world: Readonly<{ readonly width: number; readonly height: number }>;
  readonly descriptor: ThermalSourceAtlasDescriptor;
}
export declare const THERMAL_SOURCE_MATERIAL_LIGHTING_ATLAS_CATALOG_SCHEMA:
  'anifor.visual-lab.thermal-source-material-lighting-atlas-catalog/v1';
export declare const THERMAL_SOURCE_MATERIAL_LIGHTING_ATLAS_CATALOG: Readonly<{
  readonly schema: typeof THERMAL_SOURCE_MATERIAL_LIGHTING_ATLAS_CATALOG_SCHEMA;
  readonly atlases: readonly Readonly<ThermalSourceAtlasCatalogEntry>[];
}>;
