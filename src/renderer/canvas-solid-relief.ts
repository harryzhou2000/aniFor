import { RenderOptics } from './render-optics';
import { RenderProfile } from './render-profile';

const TRIANGLE_128 = Float32Array.from({ length: 128 }, (_, phase) => (
  1 - Math.abs(phase - 64) / 32
));
const PROFILE_COUNT = 7;
const RELIEF_STRENGTH = Float32Array.from({ length: 12 * PROFILE_COUNT }, (_, index) => {
  const optics = Math.floor(index / PROFILE_COUNT);
  const profile = index % PROFILE_COUNT;
  if (optics === RenderOptics.SmoothRigid) return 8.5;
  if (optics === RenderOptics.Organic) return 7.5;
  if (optics === RenderOptics.Device) return 5.0;
  if (optics === RenderOptics.Radioactive) return 6.5;
  if (profile === RenderProfile.Organic) return 7.0;
  if (profile === RenderProfile.Device) return 5.0;
  if (profile === RenderProfile.Radioactive) return 6.0;
  return 6.5;
});

/**
 * Low-frequency faceted relief for dense solid interiors. Integer triangular
 * waves are deliberately cheaper than trigonometry in the full Canvas cell
 * loop and map directly to the WebGL implementation. The caller adds this
 * equally to RGB, preserving hue and leaving alpha/silhouettes untouched.
 */
export function canvasSolidRelief(
  x: number,
  y: number,
  material: number,
  profile: number,
  optics: number,
): number {
  const waveA = TRIANGLE_128[(x * 3 + y * 2 + material * 11) & 127];
  return waveA * RELIEF_STRENGTH[optics * PROFILE_COUNT + profile];
}
