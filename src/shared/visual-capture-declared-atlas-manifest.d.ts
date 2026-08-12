export interface VisualCaptureDeclaredAtlas {
  readonly candidate: string;
  readonly world: Readonly<{ readonly width: number; readonly height: number }>;
  readonly descriptor: Readonly<Record<string, unknown>>;
}
export interface VisualCaptureDeclaredAtlasSource {
  readonly name: string;
  readonly atlases: readonly Readonly<VisualCaptureDeclaredAtlas>[];
}
export declare function normalizeVisualCaptureDeclaredAtlasManifest(
  sources: readonly Readonly<VisualCaptureDeclaredAtlasSource>[],
): readonly Readonly<VisualCaptureDeclaredAtlasSource>[];
export declare const VISUAL_CAPTURE_DECLARED_ATLAS_MANIFEST:
  readonly Readonly<VisualCaptureDeclaredAtlasSource>[];
