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
/**
 * Data-only authoring shorthand. Normalization expands it to the public
 * per-entry source shape; it grants no fixture-preparation authority.
 */
export interface VisualCaptureAuthoringDefaultCaptureSource {
  readonly name: string;
  readonly atlases: readonly Readonly<VisualCaptureAuthoringAtlas>[];
  readonly capture: Readonly<VisualCaptureAuthoringMetadata> | null;
  readonly captureOverrides?: Readonly<Record<string, Readonly<VisualCaptureAuthoringMetadata> | null>>;
}
export type VisualCaptureAuthoringSourceInput =
  | Readonly<VisualCaptureAuthoringSource>
  | Readonly<VisualCaptureAuthoringDefaultCaptureSource>;
export declare function normalizeVisualCaptureAuthoringManifest(
  sources: readonly VisualCaptureAuthoringSourceInput[],
): readonly Readonly<VisualCaptureAuthoringSource>[];
export declare const VISUAL_CAPTURE_AUTHORING_MANIFEST:
  readonly Readonly<VisualCaptureAuthoringSource>[];
