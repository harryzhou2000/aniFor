export interface SourceTargetAtlasPoint { readonly x: number; readonly y: number }
export interface SourceTargetAtlasRect extends SourceTargetAtlasPoint {
  readonly width: number; readonly height: number;
}
export interface SourceTargetAtlasInspectionRegion extends SourceTargetAtlasRect {
  readonly name: string; readonly role: 'response' | 'control';
}
export interface SourceTargetAtlasOwner { readonly material: number; readonly code: string }
export interface SourceTargetAtlasTarget extends SourceTargetAtlasOwner { readonly family: string }
export interface SourceTargetAtlasCard {
  readonly owner: number; readonly ownerCode: string;
  readonly target: number; readonly targetCode: string; readonly targetFamily: string;
  readonly encodedState: number; readonly row: number; readonly column: number; readonly index: number;
  readonly card: SourceTargetAtlasRect; readonly body: SourceTargetAtlasRect;
  readonly ownerShellProbe: SourceTargetAtlasRect; readonly targetAccentProbe: SourceTargetAtlasRect;
  readonly authoredHole: SourceTargetAtlasRect; readonly openNotch: SourceTargetAtlasRect;
  readonly thinStructure: SourceTargetAtlasRect; readonly isolated: SourceTargetAtlasPoint;
  readonly zeroState: SourceTargetAtlasRect; readonly wrongOwner: SourceTargetAtlasRect;
  readonly targetControl: SourceTargetAtlasRect; readonly wallCoexistence: SourceTargetAtlasRect;
  readonly guardedBlank: SourceTargetAtlasRect;
}
export interface SourceTargetAtlasDescriptor {
  readonly materials: Readonly<{ readonly empty: number; readonly sand: number; readonly metal: number }>;
  readonly conductiveWall: number; readonly columns: number; readonly rows: number;
  readonly owners: readonly SourceTargetAtlasOwner[]; readonly targets: readonly SourceTargetAtlasTarget[];
  readonly cards: readonly SourceTargetAtlasCard[];
  readonly recoveryProbe: SourceTargetAtlasPoint & { readonly owner: number; readonly target: number };
  readonly inspectionRegions: readonly SourceTargetAtlasInspectionRegion[];
}
export interface SourceTargetAtlasCatalogEntry {
  readonly candidate: string;
  readonly world: Readonly<{ readonly width: number; readonly height: number }>;
  readonly descriptor: SourceTargetAtlasDescriptor;
}
export declare const SOURCE_TARGET_MATERIAL_LIGHTING_ATLAS_CATALOG_SCHEMA:
  'anifor.visual-lab.source-target-material-lighting-atlas-catalog/v1';
export declare const SOURCE_TARGET_MATERIAL_LIGHTING_ATLAS_CATALOG: Readonly<{
  readonly schema: typeof SOURCE_TARGET_MATERIAL_LIGHTING_ATLAS_CATALOG_SCHEMA;
  readonly atlases: readonly Readonly<SourceTargetAtlasCatalogEntry>[];
}>;
