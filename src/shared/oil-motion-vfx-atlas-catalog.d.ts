export interface OilMotionVfxPoint { readonly x: number; readonly y: number }
export interface OilMotionVfxRect extends OilMotionVfxPoint {
  readonly width: number; readonly height: number;
}
export interface OilMotionVfxVector { readonly x: number; readonly y: number }
export interface OilMotionVfxTarget {
  readonly material: 8; readonly body: OilMotionVfxRect;
  readonly airFacingTop: OilMotionVfxRect; readonly airFacingLeft: OilMotionVfxRect;
  readonly airFacingRight: OilMotionVfxRect; readonly core: OilMotionVfxRect;
  readonly authoredHole: OilMotionVfxRect; readonly openChimney: OilMotionVfxRect;
  readonly velocity: OilMotionVfxVector;
}
export interface OilMotionVfxBoundary {
  readonly code: 'OIL_WATR' | 'OIL_DESL'; readonly oil: OilMotionVfxRect;
  readonly other: OilMotionVfxRect; readonly otherMaterial: 2 | 35;
  readonly oilProbe: OilMotionVfxPoint; readonly otherProbe: OilMotionVfxPoint;
  readonly velocity: OilMotionVfxVector;
}
export interface OilMotionVfxWallRegion {
  readonly region: OilMotionVfxRect; readonly blockSize: 4; readonly wall: 1;
  readonly wallProbe: OilMotionVfxPoint;
}
export interface OilMotionVfxAuditSnapshot {
  readonly version: 1; readonly world: { readonly width: 612; readonly height: 384 };
  readonly target: OilMotionVfxTarget;
  readonly stationaryOil: OilMotionVfxRect & { readonly material: 8 };
  readonly movingSiblings: Readonly<{
    readonly water: OilMotionVfxRect & { readonly material: 2; readonly velocity: OilMotionVfxVector };
    readonly acid: OilMotionVfxRect & { readonly material: 13; readonly velocity: OilMotionVfxVector };
    readonly diesel: OilMotionVfxRect & { readonly material: 35; readonly velocity: OilMotionVfxVector };
    readonly nitro: OilMotionVfxRect & { readonly material: 32; readonly velocity: OilMotionVfxVector };
  }>;
  readonly movingOil: Readonly<{
    readonly thin: OilMotionVfxRect & { readonly material: 8; readonly velocity: OilMotionVfxVector };
    readonly isolated: OilMotionVfxPoint & { readonly material: 8; readonly velocity: OilMotionVfxVector };
  }>;
  readonly seams: readonly [OilMotionVfxBoundary, OilMotionVfxBoundary];
  readonly wallCoexistence: OilMotionVfxWallRegion; readonly guardedBlank: OilMotionVfxRect;
  readonly expected: Readonly<{
    readonly oilCells: 60549; readonly waterCells: 7936; readonly acidCells: 5376;
    readonly dieselCells: 7936; readonly nitroCells: 5376; readonly wallCells: 2304;
    readonly movingVelocityCells: 66053;
  }>;
}
export interface OilMotionInspectionRegion extends OilMotionVfxRect {
  readonly name: string; readonly role: 'response' | 'control';
}
export interface OilMotionVfxAtlasDescriptor {
  readonly fixture: OilMotionVfxAuditSnapshot;
  readonly inspectionRegions: readonly OilMotionInspectionRegion[];
}
export declare const OIL_MOTION_VFX_ATLAS_CATALOG_SCHEMA:
  'anifor.visual-lab.oil-motion-vfx-atlas-catalog/v1';
export declare const OIL_MOTION_VFX_ATLAS_CATALOG: Readonly<{
  readonly schema: typeof OIL_MOTION_VFX_ATLAS_CATALOG_SCHEMA;
  readonly atlases: readonly Readonly<{
    readonly candidate: 'oil-motion';
    readonly world: Readonly<{ readonly width: 612; readonly height: 384 }>;
    readonly descriptor: OilMotionVfxAtlasDescriptor;
  }>[];
}>;
