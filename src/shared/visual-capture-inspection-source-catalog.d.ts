export type VisualCaptureInspectionProjection = 'declared' | 'gas-geometry' | 'solid-template';
export interface VisualCaptureInspectionSource {
  readonly name: string;
  readonly projection: VisualCaptureInspectionProjection;
  readonly atlases: readonly Readonly<{
    readonly candidate: string;
    readonly world: Readonly<{ readonly width: number; readonly height: number }>;
    readonly descriptor: Readonly<Record<string, unknown>>;
  }>[];
}
export declare const VISUAL_CAPTURE_INSPECTION_SOURCE_CATALOG_SCHEMA:
  'anifor.visual-capture.inspection-source-catalog/v1';
export declare const VISUAL_CAPTURE_INSPECTION_SOURCE_CATALOG: Readonly<{
  readonly schema: typeof VISUAL_CAPTURE_INSPECTION_SOURCE_CATALOG_SCHEMA;
  readonly sources: readonly Readonly<VisualCaptureInspectionSource>[];
}>;
