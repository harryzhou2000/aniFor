export declare const VISUAL_CAPTURE_GEOMETRY_SCHEMA:
  'anifor.visual-capture.geometry/v1';
export declare const VISUAL_CAPTURE_LAYOUT_PROFILE: 'hermetic-918x576-v1';

export declare const VISUAL_CAPTURE_GEOMETRY: Readonly<{
  schema: typeof VISUAL_CAPTURE_GEOMETRY_SCHEMA;
  profile: typeof VISUAL_CAPTURE_LAYOUT_PROFILE;
  activation: Readonly<{
    inputAudit: '1';
    auditStage: 'visual-lab';
    visualLabAudit: '1';
  }>;
  world: Readonly<{ width: 612; height: 384 }>;
  deviceMetrics: Readonly<{
    width: 1280;
    height: 600;
    deviceScaleFactor: 1;
    mobile: false;
    screenWidth: 1280;
    screenHeight: 600;
  }>;
  captureBox: Readonly<{
    selector: '.semantic-field-canvas';
    left: 181;
    top: 12;
    width: 918;
    height: 576;
    clipScale: 1;
  }>;
}>;

export type VisualCaptureGeometryProof = Readonly<{
  schema: typeof VISUAL_CAPTURE_GEOMETRY_SCHEMA;
  profile: typeof VISUAL_CAPTURE_LAYOUT_PROFILE;
  viewport: Readonly<{
    width: 1280;
    height: 600;
    devicePixelRatio: 1;
    visualScale: 1;
    scrollX: 0;
    scrollY: 0;
  }>;
  canvas: Readonly<{
    layoutMarker: typeof VISUAL_CAPTURE_LAYOUT_PROFILE;
    left: 181;
    top: 12;
    width: 918;
    height: 576;
    clipScale: 1;
    backingWidth: number;
    backingHeight: number;
  }>;
}>;

export declare function visualCaptureLayoutRequested(search?: string): boolean;
export declare function createVisualCaptureGeometryProof(
  renderScale: number,
): VisualCaptureGeometryProof;
