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
  // Heap slopes commonly carry comparable horizontal and vertical gradient.
  // The old 0.42..0.70 gate transferred only about one fifth of the wide field
  // at a 45-degree slope, leaving the semantic staircase visible everywhere
  // except a nearly horizontal crown. Admit diagonal gravity-facing slopes
  // strongly while a vertical wall/column (verticalShare ~= 0) remains an
  // exact no-op and therefore keeps its authored fine topology.
  return smoothstep(0.24, 0.56, verticalShare)
    * smoothstep(0.004, 0.027, abs(shape.z));
}

float powderSmoothCoverage(float density) {
  return smoothstep(0.36, 0.64, density);
}

// Coverage may extend the settled field across a diagonal without asking the
// old cell-edge highlight to occupy that complete new band. Fade the shared
// Smooth contour inward and reduce its peak by one third only while the wide
// field owns the edge. Local, Grains, and untouched semantic bulk pass through
// at exactly 1.0; alpha and material support never consume this RGB factor.
float powderSmoothContourFinish(float density, float fieldTransfer) {
  float inward = smoothstep(0.18, 0.48, density);
  return mix(1.0, 0.66 * inward, clamp(fieldTransfer, 0.0, 1.0));
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
