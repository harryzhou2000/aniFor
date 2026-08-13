export interface VisualCaptureAuthoringAtlas {
  readonly candidate: string;
  readonly world: Readonly<{ readonly width: number; readonly height: number }>;
  readonly descriptor: Readonly<Record<string, unknown>>;
}
export interface VisualCaptureAuthoringMetadata {
  readonly domain: string;
  readonly driver: string;
  readonly preparationReportLabel: string;
}
export interface VisualCaptureAuthoringEntry {
  readonly atlas: Readonly<VisualCaptureAuthoringAtlas>;
  readonly capture: Readonly<VisualCaptureAuthoringMetadata> | null;
}
export interface VisualCaptureAuthoringSource {
  readonly name: string;
  readonly entries: readonly Readonly<VisualCaptureAuthoringEntry>[];
}
export declare function normalizeVisualCaptureAuthoringManifest(
  sources: readonly Readonly<VisualCaptureAuthoringSource>[],
): readonly Readonly<VisualCaptureAuthoringSource>[];
export declare const VISUAL_CAPTURE_AUTHORING_MANIFEST:
  readonly Readonly<VisualCaptureAuthoringSource>[];
