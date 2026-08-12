export interface SolidMaterialLightingAtlasCatalogPoint {
  readonly x: number;
  readonly y: number;
}

export interface SolidMaterialLightingAtlasCatalogRect extends SolidMaterialLightingAtlasCatalogPoint {
  readonly width: number;
  readonly height: number;
}

export interface SolidMaterialLightingInspectionRegion extends SolidMaterialLightingAtlasCatalogRect {
  readonly name: string;
  readonly role: 'response' | 'control';
}

export interface SolidMaterialLightingAtlasCatalogDescriptor {
  readonly definitions: readonly Readonly<{ readonly material: number; readonly code: string }>[];
  readonly columns: number;
  readonly origin: SolidMaterialLightingAtlasCatalogPoint;
  readonly stride: SolidMaterialLightingAtlasCatalogPoint;
  readonly cardSize: Readonly<{ readonly width: number; readonly height: number }>;
  readonly conductiveWall: number;
  readonly template: Readonly<{
    readonly body: SolidMaterialLightingAtlasCatalogRect;
    readonly hole: SolidMaterialLightingAtlasCatalogRect;
    readonly openNotch: SolidMaterialLightingAtlasCatalogRect;
    readonly thinStructure: SolidMaterialLightingAtlasCatalogRect;
    readonly isolated: SolidMaterialLightingAtlasCatalogPoint;
    readonly contactOwner: SolidMaterialLightingAtlasCatalogRect;
    readonly contactNeighbour: SolidMaterialLightingAtlasCatalogRect;
    readonly nativeWall: SolidMaterialLightingAtlasCatalogRect;
    readonly emitter: SolidMaterialLightingAtlasCatalogRect;
    readonly guardedBlank: SolidMaterialLightingAtlasCatalogRect;
  }>;
  readonly inspectionRegions: readonly SolidMaterialLightingInspectionRegion[];
}

export interface SolidMaterialLightingAtlasCatalogEntry {
  readonly candidate: string;
  readonly world: Readonly<{ readonly width: number; readonly height: number }>;
  readonly descriptor: SolidMaterialLightingAtlasCatalogDescriptor;
}

export declare const SOLID_MATERIAL_LIGHTING_ATLAS_CATALOG_SCHEMA:
  'anifor.visual-lab.solid-material-lighting-atlas-catalog/v1';

export declare const SOLID_MATERIAL_LIGHTING_ATLAS_CATALOG: Readonly<{
  readonly schema: typeof SOLID_MATERIAL_LIGHTING_ATLAS_CATALOG_SCHEMA;
  readonly atlases: readonly Readonly<SolidMaterialLightingAtlasCatalogEntry>[];
}>;
