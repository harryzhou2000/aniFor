export type MaterialShowcaseCommand = Readonly<{ readonly kind: string } & Record<string, number | string>>;
export type MaterialShowcaseCatalogAuditSupport = Readonly<
  | { readonly kind: 'semantic'; readonly materials: readonly number[]; readonly minimumRecall: number }
  | { readonly kind: 'atmosphere'; readonly style: number; readonly minimumAlpha: number; readonly minimumRecall: number }
  | { readonly kind: 'emission'; readonly minimumAlpha: number; readonly minimumRecall: number }
>;
export interface MaterialShowcaseCatalogAudit {
  readonly version: 6;
  readonly semantic: Readonly<{
    readonly hash: number;
    readonly occupied: number;
    readonly materialCounts: readonly Readonly<{ readonly material: number; readonly count: number }>[];
  }>;
  readonly metalInsert: Readonly<{
    readonly material: 23;
    readonly rect: Readonly<{ readonly x: number; readonly y: number; readonly width: number; readonly height: number }>;
    readonly radius: 8;
    readonly expectedCells: 880;
    readonly rowCounts: readonly number[];
    readonly coreProbe: Readonly<{ readonly x: number; readonly y: number }>;
    readonly waterControls: readonly Readonly<{ readonly x: number; readonly y: number }>[];
  }>;
  readonly regions: readonly Readonly<{
    readonly name: string;
    readonly family: 'powder' | 'liquid' | 'gas' | 'solid' | 'organic' | 'emission' | 'contact';
    readonly profile: 'granular-body' | 'cohesive-liquid' | 'diffuse-gas' | 'rigid-body' | 'organic-body' | 'emissive-volume' | 'phase-contact';
    readonly x: number;
    readonly y: number;
    readonly radiusX: number;
    readonly radiusY: number;
    readonly support: MaterialShowcaseCatalogAuditSupport;
    readonly semanticMaterials: readonly number[];
    readonly topology?: boolean;
    readonly silhouette?: boolean;
    readonly expectedMatching: number;
  }>[];
}
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
  readonly audit: MaterialShowcaseCatalogAudit;
}>;
