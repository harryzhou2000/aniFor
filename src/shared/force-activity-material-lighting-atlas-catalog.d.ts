export interface ForceActivityAtlasPoint { readonly x: number; readonly y: number }
export interface ForceActivityAtlasRect extends ForceActivityAtlasPoint {
  readonly width: number; readonly height: number;
}
export interface ForceActivityAtlasOwner {
  readonly material: 115 | 116;
  readonly code: 'ACEL' | 'DCEL';
}
export interface ForceActivityAtlasState {
  readonly key: 'inactive' | 'active';
  readonly active: boolean;
  readonly encodedState: 0 | 1;
}
export interface ForceActivityAtlasInspectionRegion extends ForceActivityAtlasRect {
  readonly name: string;
  readonly role: 'response' | 'control';
}
export interface ForceActivityAtlasCard {
  readonly material: 115 | 116; readonly code: 'ACEL' | 'DCEL';
  readonly stateKey: 'inactive' | 'active'; readonly active: boolean;
  readonly encodedState: 0 | 1; readonly row: number; readonly column: number; readonly index: number;
  readonly card: ForceActivityAtlasRect; readonly body: ForceActivityAtlasRect;
  readonly surfaceProbe: ForceActivityAtlasRect; readonly coreProbe: ForceActivityAtlasRect;
  readonly motifAxisProbe: ForceActivityAtlasRect; readonly motifArrowProbe: ForceActivityAtlasRect;
  readonly motifBackgroundProbe: ForceActivityAtlasRect; readonly authoredHole: ForceActivityAtlasRect;
  readonly openNotch: ForceActivityAtlasRect; readonly thinStructure: ForceActivityAtlasRect;
  readonly isolated: ForceActivityAtlasPoint; readonly wrongOwner: ForceActivityAtlasRect;
  readonly waterControl: ForceActivityAtlasRect; readonly metalControl: ForceActivityAtlasRect;
  readonly emitter: ForceActivityAtlasRect; readonly guardedBlank: ForceActivityAtlasRect;
}
export interface ForceActivityAtlasDescriptor {
  readonly materials: Readonly<Record<
    'empty' | 'sand' | 'water' | 'fire' | 'metal' | 'acel' | 'dcel', number
  >>;
  readonly owners: readonly ForceActivityAtlasOwner[];
  readonly states: readonly ForceActivityAtlasState[];
  readonly layout: Readonly<{
    readonly columns: number; readonly rows: number;
    readonly origin: ForceActivityAtlasPoint; readonly stride: ForceActivityAtlasPoint;
    readonly cardSize: Readonly<{ readonly width: number; readonly height: number }>;
  }>;
  readonly template: Readonly<{
    readonly body: ForceActivityAtlasRect;
    readonly surfaceProbe: ForceActivityAtlasRect;
    readonly coreProbe: ForceActivityAtlasRect;
    readonly motifAxisProbe: ForceActivityAtlasRect;
    readonly motifArrowProbe: ForceActivityAtlasRect;
    readonly motifBackgroundProbe: ForceActivityAtlasRect;
    readonly authoredHole: ForceActivityAtlasRect;
    readonly openNotch: ForceActivityAtlasRect;
    readonly thinStructure: ForceActivityAtlasRect;
    readonly isolated: ForceActivityAtlasPoint;
    readonly wrongOwner: ForceActivityAtlasRect;
    readonly waterControl: ForceActivityAtlasRect;
    readonly metalControl: ForceActivityAtlasRect;
    readonly emitter: ForceActivityAtlasRect;
    readonly guardedBlank: ForceActivityAtlasRect;
  }>;
  readonly cards: readonly ForceActivityAtlasCard[];
  readonly inspectionRegions: readonly ForceActivityAtlasInspectionRegion[];
}
export interface ForceActivityAtlasCatalogEntry {
  readonly candidate: string;
  readonly world: Readonly<{ readonly width: number; readonly height: number }>;
  readonly descriptor: ForceActivityAtlasDescriptor;
}
export declare const FORCE_ACTIVITY_MATERIAL_LIGHTING_ATLAS_CATALOG_SCHEMA:
  'anifor.visual-lab.force-activity-material-lighting-atlas-catalog/v1';
export declare const FORCE_ACTIVITY_MATERIAL_LIGHTING_ATLAS_CATALOG: Readonly<{
  readonly schema: typeof FORCE_ACTIVITY_MATERIAL_LIGHTING_ATLAS_CATALOG_SCHEMA;
  readonly atlases: readonly Readonly<ForceActivityAtlasCatalogEntry>[];
}>;
