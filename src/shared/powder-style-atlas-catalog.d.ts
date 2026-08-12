export interface PowderStyleAtlasPoint { readonly x: number; readonly y: number }
export interface PowderStyleAtlasRect extends PowderStyleAtlasPoint {
  readonly width: number; readonly height: number;
}
export interface PowderStyleAtlasPile {
  readonly left: number; readonly right: number; readonly peakX: number;
  readonly peakY: number; readonly baseY: number;
}
export interface PowderStyleAtlasInspectionRegion extends PowderStyleAtlasRect {
  readonly name: string; readonly role: 'response' | 'control';
}
export interface PowderStyleAtlasDescriptor {
  readonly materials: Readonly<Record<'empty' | 'sand' | 'water' | 'concrete' | 'clay', number>>;
  readonly conductiveWall: number;
  readonly bulk: Readonly<{
    readonly sandProbe: PowderStyleAtlasPoint; readonly clayProbe: PowderStyleAtlasPoint;
    readonly sandPile: PowderStyleAtlasPile; readonly clayPile: PowderStyleAtlasPile;
  }>;
  readonly fine: Readonly<{
    readonly clayStem: PowderStyleAtlasRect; readonly clayLedge: PowderStyleAtlasRect;
    readonly concreteRidge: PowderStyleAtlasRect; readonly authoredHole: PowderStyleAtlasRect;
    readonly concreteProbe: PowderStyleAtlasPoint;
  }>;
  readonly grains: Readonly<{
    readonly sand: PowderStyleAtlasPoint; readonly clay: PowderStyleAtlasPoint;
    readonly concreteDiagonal: readonly PowderStyleAtlasPoint[];
  }>;
  readonly unstableControl: readonly PowderStyleAtlasPoint[];
  readonly wetContact: Readonly<{
    readonly powder: PowderStyleAtlasRect; readonly water: PowderStyleAtlasRect;
    readonly powderProbe: PowderStyleAtlasPoint; readonly waterProbe: PowderStyleAtlasPoint;
  }>;
  readonly wallCoexistence: PowderStyleAtlasRect;
  readonly wallProbe: PowderStyleAtlasPoint;
  readonly blank: PowderStyleAtlasRect;
  readonly blankProbe: PowderStyleAtlasPoint;
  readonly inspectionRegions: readonly PowderStyleAtlasInspectionRegion[];
}
export interface PowderStyleAtlasCatalogEntry {
  readonly candidate: string;
  readonly world: Readonly<{ readonly width: number; readonly height: number }>;
  readonly descriptor: PowderStyleAtlasDescriptor;
}
export declare const POWDER_STYLE_ATLAS_CATALOG_SCHEMA:
  'anifor.visual-lab.powder-style-atlas-catalog/v1';
export declare const POWDER_STYLE_ATLAS_CATALOG: Readonly<{
  readonly schema: typeof POWDER_STYLE_ATLAS_CATALOG_SCHEMA;
  readonly atlases: readonly Readonly<PowderStyleAtlasCatalogEntry>[];
}>;
