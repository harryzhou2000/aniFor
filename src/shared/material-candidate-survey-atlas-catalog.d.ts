export type MaterialCandidateSurveyCommand = Readonly<
  { readonly kind: string } & Record<string, number | string>
>;
export declare const MATERIAL_CANDIDATE_SURVEY_ATLAS_CATALOG_SCHEMA:
  'anifor.material-candidate-survey-atlas-catalog/v1';
export interface MaterialCandidateSurveyCatalogAudit {
  readonly version: 1;
  readonly world: Readonly<{ readonly width: 612; readonly height: 384 }>;
  readonly semantic: Readonly<{
    readonly hash: 2255453673;
    readonly occupied: 115368;
    readonly materialCounts: readonly Readonly<{ readonly material: number; readonly count: number }>[];
  }>;
  readonly regions: readonly Readonly<{
    readonly name: string; readonly material: number; readonly phase: 'powder' | 'liquid';
    readonly profile: 'granular-body' | 'cohesive-liquid';
    readonly x: number; readonly y: number; readonly radiusX: 30; readonly radiusY: 24;
    readonly support: Readonly<{
      readonly kind: 'semantic'; readonly materials: readonly number[]; readonly minimumRecall: 0.96;
    }>;
    readonly semanticMaterials: readonly number[]; readonly expectedMatching: 2880;
  }>[];
  readonly sharedContext: Readonly<{
    readonly material: number;
    readonly contactProbes: readonly Readonly<{
      readonly x: number; readonly y: number; readonly material: number;
    }>[];
    readonly wallProbes: readonly Readonly<{ readonly x: number; readonly y: number }>[];
  }>;
}
export declare const MATERIAL_CANDIDATE_SURVEY_ATLAS_CATALOG: Readonly<{
  readonly schema: typeof MATERIAL_CANDIDATE_SURVEY_ATLAS_CATALOG_SCHEMA;
  readonly world: Readonly<{ readonly width: 612; readonly height: 384 }>;
  readonly commands: readonly MaterialCandidateSurveyCommand[];
  readonly audit: Readonly<MaterialCandidateSurveyCatalogAudit>;
}>;
