export interface LiquidMotionVfxPoint { readonly x: number; readonly y: number }
export interface LiquidMotionVfxRect extends LiquidMotionVfxPoint {
  readonly width: number; readonly height: number;
}
export interface LiquidMotionVfxVector { readonly x: number; readonly y: number }
export interface LiquidMotionVfxPool {
  readonly code: 'STILL_WATER' | 'MOVING_WATER'; readonly material: 2;
  readonly body: LiquidMotionVfxRect; readonly airFacingSurface: LiquidMotionVfxRect;
  readonly core: LiquidMotionVfxRect; readonly authoredHole: LiquidMotionVfxRect;
  readonly openChimney: LiquidMotionVfxRect; readonly velocity: LiquidMotionVfxVector;
}
export interface LiquidMotionVfxWallPattern {
  readonly kind: 'native-wall-checker'; readonly region: LiquidMotionVfxRect;
  readonly blockSize: 4; readonly occupiedParity: 0;
  readonly wallProbe: LiquidMotionVfxPoint; readonly clearProbe: LiquidMotionVfxPoint;
}
export interface LiquidMotionVfxBoundary {
  readonly code: 'WATR_METL' | 'WATR_OIL'; readonly water: LiquidMotionVfxRect;
  readonly other: LiquidMotionVfxRect; readonly otherMaterial: 23 | 8;
  readonly waterProbe: LiquidMotionVfxPoint; readonly otherProbe: LiquidMotionVfxPoint;
}
export interface LiquidMotionVfxAuditSnapshot {
  readonly version: 1; readonly world: { readonly width: 612; readonly height: 384 };
  readonly pools: readonly [LiquidMotionVfxPool, LiquidMotionVfxPool];
  readonly moving: Readonly<{
    readonly strand: LiquidMotionVfxRect & { readonly material: 2; readonly velocity: LiquidMotionVfxVector };
    readonly isolated: LiquidMotionVfxPoint & { readonly material: 2; readonly velocity: LiquidMotionVfxVector };
    readonly oil: LiquidMotionVfxRect & { readonly material: 8; readonly velocity: LiquidMotionVfxVector };
    readonly acid: LiquidMotionVfxRect & { readonly material: 13; readonly velocity: LiquidMotionVfxVector };
  }>;
  readonly contacts: Readonly<{
    readonly waterMetal: LiquidMotionVfxBoundary; readonly waterOil: LiquidMotionVfxBoundary;
  }>;
  readonly wallCoexistence: LiquidMotionVfxWallPattern; readonly guardedBlank: LiquidMotionVfxRect;
  readonly conductiveWall: 1;
  readonly expected: Readonly<{
    readonly waterCells: 53121; readonly oilCells: 7232; readonly acidCells: 4992;
    readonly metalCells: 2240; readonly wallCells: 1232; readonly movingVelocityCells: 34013;
  }>;
}
export interface LiquidMotionInspectionRegion extends LiquidMotionVfxRect {
  readonly name: string; readonly role: 'response' | 'control';
}
export interface LiquidMotionVfxAtlasDescriptor {
  readonly fixture: LiquidMotionVfxAuditSnapshot;
  readonly inspectionRegions: readonly LiquidMotionInspectionRegion[];
}
export declare const LIQUID_MOTION_VFX_ATLAS_CATALOG_SCHEMA:
  'anifor.visual-lab.liquid-motion-vfx-atlas-catalog/v1';
export declare const LIQUID_MOTION_VFX_ATLAS_CATALOG: Readonly<{
  readonly schema: typeof LIQUID_MOTION_VFX_ATLAS_CATALOG_SCHEMA;
  readonly atlases: readonly Readonly<{
    readonly candidate: 'water-motion';
    readonly world: Readonly<{ readonly width: 612; readonly height: 384 }>;
    readonly descriptor: LiquidMotionVfxAtlasDescriptor;
  }>[];
}>;
