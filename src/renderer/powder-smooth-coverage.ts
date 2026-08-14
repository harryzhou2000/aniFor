/**
 * Scale-neutral Smooth-powder transfer shared by the normal compositor and
 * the compact true-8x compositor. Eligibility remains caller-owned: normal
 * WebGL has its broad settled-depth proof, while 8x retains its separate
 * projected-empty contour route. These helpers only prevent their common
 * directional signal and final density crossing from drifting apart.
 */
export const POWDER_SMOOTH_COVERAGE_GLSL = `
float powderSmoothDirectionalSignal(vec4 shape) {
  float verticalShare = abs(shape.z)
    / (abs(shape.y) + abs(shape.z) + 0.000001);
  // Smooth the oblique shoulders of a settled heap, not every broad edge. A
  // vertical wall/column has verticalShare ~= 0 and a flat ledge/cap approaches
  // 1, so the two-sided window preserves both kinds of authored fine topology
  // while admitting more of the diagonal field that removes pile stair-steps.
  float heapSlope = smoothstep(0.12, 0.34, verticalShare);
  float flatTopReject = 1.0 - smoothstep(0.84, 0.98, verticalShare);
  return heapSlope * flatTopReject
    * smoothstep(0.004, 0.027, abs(shape.z));
}

float powderSmoothCoverage(float density, vec2 gradient) {
  // Interpret the blurred density as an implicit surface instead of assigning
  // every slope the same wide scalar interval. Dividing the crossing width by
  // the field gradient gives a stable roughly one-cell antialias band: broad
  // reconstruction remains a curved geometry carrier, but no longer turns
  // into a many-cell translucent bevel where its density changes slowly.
  float halfWidth = clamp(length(gradient) * 0.72, 0.010, 0.060);
  return smoothstep(0.50 - halfWidth, 0.50 + halfWidth, density);
}

// Coverage may extend the settled field across a diagonal without asking the
// old cell-edge highlight to occupy that complete new band. Fade the shared
// Smooth contour inward and reduce its peak by one third only while the wide
// field owns the edge. Local, Grains, and untouched semantic bulk pass through
// at exactly 1.0; alpha and material support never consume this RGB factor.
float powderSmoothContourFinish(float density, float fieldTransfer) {
  // The reconstructed alpha already supplies the curved silhouette. Delay and
  // soften the legacy cell-edge key inside that contour so it cannot redraw a
  // bright staircase over the field geometry. Deeper pigment and mesostrata
  // are independent and remain fully present.
  float inward = smoothstep(0.52, 0.82, density);
  return mix(1.0, 0.44 * inward, clamp(fieldTransfer, 0.0, 1.0));
}

// Keep the first alpha crossing quiet, then restore the material's grain soon
// after the silhouette has become opaque. The former 0.72..1.00 normal-path
// ramp left a broad textureless bevel inside every pile; this scale-neutral
// transfer gives normal and true-8x the same narrower material boundary.
float powderSmoothTextureRetention(float density, float fieldTransfer) {
  float interior = smoothstep(0.50, 0.78, density);
  return 1.0 - clamp(fieldTransfer, 0.0, 1.0) * (1.0 - interior);
}
`;
