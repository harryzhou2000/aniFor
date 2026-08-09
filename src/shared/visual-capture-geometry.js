/**
 * Hermetic CSS/compositor geometry for Visual Lab evidence captures.
 *
 * The ordinary app remains responsive. Only the existing Visual Lab audit
 * tuple activates this fixed frame, so identical renderer bytes are sampled
 * through identical CSS geometry on local and hosted Chrome runners.
 */

const deepFreeze = (value) => {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
};

export const VISUAL_CAPTURE_GEOMETRY_SCHEMA = 'anifor.visual-capture.geometry/v1';
export const VISUAL_CAPTURE_LAYOUT_PROFILE = 'hermetic-918x576-v1';

export const VISUAL_CAPTURE_GEOMETRY = deepFreeze({
  schema: VISUAL_CAPTURE_GEOMETRY_SCHEMA,
  profile: VISUAL_CAPTURE_LAYOUT_PROFILE,
  activation: {
    inputAudit: '1',
    auditStage: 'visual-lab',
    visualLabAudit: '1',
  },
  world: { width: 612, height: 384 },
  deviceMetrics: {
    width: 1280,
    height: 600,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: 1280,
    screenHeight: 600,
  },
  captureBox: {
    selector: '.semantic-field-canvas',
    left: 181,
    top: 12,
    width: 918,
    height: 576,
    clipScale: 1,
  },
});

export function visualCaptureLayoutRequested(
  search = globalThis.location?.search ?? '',
) {
  const parameters = new URLSearchParams(search);
  return Object.entries(VISUAL_CAPTURE_GEOMETRY.activation).every(
    ([name, value]) => parameters.get(name) === value,
  );
}

export function createVisualCaptureGeometryProof(renderScale) {
  if (!Number.isInteger(renderScale) || renderScale < 1 || renderScale > 8) {
    throw new TypeError('Visual capture geometry renderScale must be an integer from 1 through 8');
  }
  const { captureBox, deviceMetrics, profile, schema, world } = VISUAL_CAPTURE_GEOMETRY;
  return deepFreeze({
    schema,
    profile,
    viewport: {
      width: deviceMetrics.width,
      height: deviceMetrics.height,
      devicePixelRatio: deviceMetrics.deviceScaleFactor,
      visualScale: 1,
      scrollX: 0,
      scrollY: 0,
    },
    canvas: {
      layoutMarker: profile,
      left: captureBox.left,
      top: captureBox.top,
      width: captureBox.width,
      height: captureBox.height,
      clipScale: captureBox.clipScale,
      backingWidth: world.width * renderScale,
      backingHeight: world.height * renderScale,
    },
  });
}
