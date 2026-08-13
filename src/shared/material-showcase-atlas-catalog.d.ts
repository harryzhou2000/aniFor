export type MaterialShowcaseCommand = Readonly<{ readonly kind: string } & Record<string, number | string>>;
export declare const MATERIAL_SHOWCASE_ATLAS_CATALOG_SCHEMA:
  'anifor.visual-lab.material-showcase-atlas-catalog/v1';
export declare const MATERIAL_SHOWCASE_SCENE_AUTHORING: Readonly<{
  readonly world: Readonly<{ readonly width: 612; readonly height: 384 }>;
  readonly commands: readonly MaterialShowcaseCommand[];
}>;
export declare const MATERIAL_SHOWCASE_ATLAS_CATALOG: Readonly<{
  readonly schema: typeof MATERIAL_SHOWCASE_ATLAS_CATALOG_SCHEMA;
  readonly atlases: readonly Readonly<{
    readonly candidate: 'gas-showcase' | 'oxygen-showcase';
    readonly world: typeof MATERIAL_SHOWCASE_SCENE_AUTHORING.world;
    readonly descriptor: Readonly<{ readonly inspectionRegions: readonly Readonly<{
      readonly name: string; readonly role: 'response' | 'control';
      readonly x: number; readonly y: number; readonly width: number; readonly height: number;
    }>[] }>;
  }>[];
}>;
