export interface WaxMaterialLightingAtlasPoint { readonly x: number; readonly y: number }
export interface WaxMaterialLightingAtlasRect extends WaxMaterialLightingAtlasPoint {
  readonly width: number; readonly height: number;
}
export type WaxMaterialLightingPhase = 'solid' | 'liquid';
export type WaxMaterialLightingPhaseStructureKind = 'lamella-spur' | 'strand-droplets';
export interface WaxMaterialLightingAtlasDefinition {
  readonly material: 27 | 59; readonly code: 'WAX' | 'MWAX';
  readonly color: '#e0c278' | '#e0e0aa'; readonly phase: WaxMaterialLightingPhase;
}
export interface WaxMaterialLightingContactControl {
  readonly owner: WaxMaterialLightingAtlasRect;
  readonly neighbour: WaxMaterialLightingAtlasRect;
  readonly neighbourMaterial: 2 | 23;
}
export interface WaxMaterialLightingMotifProbeSet {
  readonly tileOrigin: WaxMaterialLightingAtlasPoint;
  readonly ridge: WaxMaterialLightingAtlasRect;
  readonly fold: WaxMaterialLightingAtlasRect;
  readonly bloom: WaxMaterialLightingAtlasRect;
  readonly joint: WaxMaterialLightingAtlasRect;
  readonly interstitial: WaxMaterialLightingAtlasRect;
}
export interface WaxMaterialLightingAtlasCard extends WaxMaterialLightingAtlasDefinition {
  readonly index: number; readonly left: number; readonly top: number;
  readonly width: number; readonly height: number;
  readonly card: WaxMaterialLightingAtlasRect;
  readonly body: WaxMaterialLightingAtlasRect;
  readonly surfaceProbe: WaxMaterialLightingAtlasRect;
  readonly coreProbe: WaxMaterialLightingAtlasRect;
  readonly authoredCavity: WaxMaterialLightingAtlasRect;
  readonly openChimney: WaxMaterialLightingAtlasRect;
  readonly haloOuter: WaxMaterialLightingAtlasRect;
  readonly phaseStructureKind: WaxMaterialLightingPhaseStructureKind;
  readonly phaseStructure: readonly WaxMaterialLightingAtlasPoint[];
  readonly isolated: WaxMaterialLightingAtlasPoint;
  readonly guardedBlank: WaxMaterialLightingAtlasRect;
  readonly waterContact: WaxMaterialLightingContactControl;
  readonly metalContact: WaxMaterialLightingContactControl;
  readonly warmEmitter: WaxMaterialLightingAtlasRect;
  readonly motifProbes: readonly WaxMaterialLightingMotifProbeSet[];
}
export interface WaxMaterialLightingInspectionRegion extends WaxMaterialLightingAtlasRect {
  readonly name: string; readonly role: 'response' | 'control';
}
export interface WaxMaterialLightingAtlasDescriptor {
  readonly materials: Readonly<Record<'empty' | 'water' | 'metal' | 'wax' | 'mwax', number>>;
  readonly definitions: readonly WaxMaterialLightingAtlasDefinition[];
  readonly layout: Readonly<{
    readonly columns: number; readonly rows: number;
    readonly origin: WaxMaterialLightingAtlasPoint;
    readonly stride: WaxMaterialLightingAtlasPoint;
    readonly cardSize: Readonly<{ readonly width: number; readonly height: number }>;
  }>;
  readonly cards: readonly WaxMaterialLightingAtlasCard[];
  readonly inspectionRegions: readonly WaxMaterialLightingInspectionRegion[];
}
export interface WaxMaterialLightingAtlasCatalogEntry {
  readonly candidate: 'wax-material-lighting-atlas';
  readonly world: Readonly<{ readonly width: number; readonly height: number }>;
  readonly descriptor: WaxMaterialLightingAtlasDescriptor;
}
export declare const WAX_MATERIAL_LIGHTING_ATLAS_CATALOG_SCHEMA:
  'anifor.visual-lab.wax-material-lighting-atlas-catalog/v1';
export declare const WAX_MATERIAL_LIGHTING_ATLAS_CATALOG: Readonly<{
  readonly schema: typeof WAX_MATERIAL_LIGHTING_ATLAS_CATALOG_SCHEMA;
  readonly atlases: readonly Readonly<WaxMaterialLightingAtlasCatalogEntry>[];
}>;
