import { RENDER_OPTICS_CLASS_COUNT, RenderOptics } from './render-optics';
import { RenderProfile } from './render-profile';

const SMOOTH_TRIANGLE_128 = Float32Array.from({ length: 128 }, (_, phase) => {
  const triangle = 1 - Math.abs(phase - 64) / 32;
  return triangle * (1.5 - 0.5 * triangle * triangle);
});
const PROFILE_COUNT = 7;
const OPTICS_PROFILE_COUNT = RENDER_OPTICS_CLASS_COUNT * PROFILE_COUNT;
const RELIEF_X = new Int8Array(OPTICS_PROFILE_COUNT);
const RELIEF_Y = new Int8Array(OPTICS_PROFILE_COUNT);
const RELIEF_STRENGTH = new Float32Array(OPTICS_PROFILE_COUNT);
const INTERIOR_COHESION = new Float32Array(OPTICS_PROFILE_COUNT);
for (let index = 0; index < OPTICS_PROFILE_COUNT; index++) {
  const optics = Math.floor(index / PROFILE_COUNT);
  const profile = index % PROFILE_COUNT;
  let axisX = 2;
  let axisY = 1;
  let strength = 6.5;
  let cohesion = 0.28;
  if (optics === RenderOptics.RoughGranular || profile === RenderProfile.Granular) {
    axisX = 0; axisY = 0; strength = 0; cohesion = 0;
  } else if (optics === RenderOptics.SmoothRigid) {
    axisX = 2; axisY = 1; strength = 7.0; cohesion = 0.46;
  } else if (optics === RenderOptics.Organic) {
    axisX = 1; axisY = 4; strength = 6.0; cohesion = 0.30;
  } else if (optics === RenderOptics.Device) {
    axisX = 4; axisY = 0; strength = 4.5; cohesion = 0.40;
  } else if (optics === RenderOptics.Radioactive) {
    axisX = 3; axisY = -2; strength = 5.5; cohesion = 0.26;
  } else if (optics === RenderOptics.TranslucentRigid) {
    axisX = 2; axisY = 1; strength = 6.0; cohesion = 0.50;
  } else if (profile === RenderProfile.Rigid) {
    axisX = 2; axisY = 1; strength = 7.0; cohesion = 0.46;
  } else if (profile === RenderProfile.Organic) {
    axisX = 1; axisY = 4; strength = 6.0; cohesion = 0.30;
  } else if (profile === RenderProfile.Device) {
    axisX = 4; axisY = 0; strength = 4.5; cohesion = 0.40;
  } else if (profile === RenderProfile.Radioactive) {
    axisX = 3; axisY = -2; strength = 5.5; cohesion = 0.26;
  }
  RELIEF_X[index] = axisX;
  RELIEF_Y[index] = axisY;
  RELIEF_STRENGTH[index] = strength;
  INTERIOR_COHESION[index] = cohesion;
}

/**
 * One band-limited, family-directed wave for dense solid interiors. The
 * module-static smoothed-triangle table maps directly to WebGL's cubic and the
 * caller adds its scalar equally to RGB, preserving hue and alpha/silhouettes.
 */
export function canvasSolidRelief(
  x: number,
  y: number,
  material: number,
  profile: number,
  optics: number,
): number {
  const index = optics * PROFILE_COUNT + profile;
  if (RELIEF_STRENGTH[index] === 0) return 0;
  const phase = (x * RELIEF_X[index] + y * RELIEF_Y[index] + material * 11) & 127;
  return SMOOTH_TRIANGLE_128[phase] * RELIEF_STRENGTH[index];
}

/** RGB-only attenuation of cell-frequency styling in proven solid interiors. */
export function canvasSolidInteriorCohesion(profile: number, optics: number): number {
  return INTERIOR_COHESION[optics * PROFILE_COUNT + profile];
}

/** Adds solid lighting and uniformly compresses only over-range highlights. */
export function applyCanvasSolidLighting(color: Float32Array, light: number): void {
  color[0] += light;
  color[1] += light;
  color[2] += light;
  const peak = Math.max(color[0], color[1], color[2]);
  if (peak <= 254) return;
  const scale = 254 / peak;
  color[0] *= scale;
  color[1] *= scale;
  color[2] *= scale;
}
