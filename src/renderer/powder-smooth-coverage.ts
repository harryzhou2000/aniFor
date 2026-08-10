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
  return smoothstep(0.42, 0.70, verticalShare)
    * smoothstep(0.004, 0.027, abs(shape.z));
}

float powderSmoothCoverage(float density) {
  return smoothstep(0.36, 0.64, density);
}
`;
