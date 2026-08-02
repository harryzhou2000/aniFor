import { Material } from '../shared/materials';

const DEPTH_START = 6;
const DEPTH_RANGE = 36;
const RELIEF_RANGE = 7;

/** True only for native pressure-reactive GOO. */
export function isCanvasGooSolidMaterial(material: number): boolean {
  return material === Material.GOO;
}

/**
 * Adds a restrained soft-body volume cue to a depth-proven GOO core.
 *
 * Native pressure, deformation, disappearance, coverage, and alpha all stay
 * outside this presentation helper. It consumes only already-computed solid
 * depth/relief and remains an allocation-free RGB-only no-op at surfaces.
 */
export function applyCanvasGooSolidCoreOptics(
  color: Float32Array,
  material: number,
  x: number,
  y: number,
  denseInterior: boolean,
  opticalDepthByte: number,
  relief: number,
  opticalDepthEnabled = true,
): void {
  if (!isCanvasGooSolidMaterial(material) || !denseInterior
    || !opticalDepthEnabled || opticalDepthByte <= DEPTH_START) return;

  const depth = smoothstep((opticalDepthByte - DEPTH_START) / DEPTH_RANGE);
  const signedRelief = clamp(relief / RELIEF_RANGE, -1, 1) * depth;
  const crown = Math.max(0, signedRelief);
  const pocket = Math.max(0, -signedRelief);
  const worldX = Math.floor(x);
  const worldY = Math.floor(y);
  // Broad, non-contour compression bands keep a large GOO mass soft without
  // pretending to know the current native pressure field.
  const compression = positiveModulo(worldX * 2 + worldY * 3, 29) <= 1;
  const bubble = positiveModulo(worldX * 5 - worldY * 2, 47) === 0;
  const red = 2 * crown - 4 * pocket - (compression ? depth : 0);
  const green = 4 * crown - 2 * pocket + (bubble ? depth : 0);
  const blue = 5 * crown - pocket + (compression ? 2 * depth : 0) + (bubble ? depth : 0);
  color[0] = clampByte(color[0] + clamp(red, -10, 10));
  color[1] = clampByte(color[1] + clamp(green, -10, 10));
  color[2] = clampByte(color[2] + clamp(blue, -10, 10));
}

function smoothstep(value: number): number {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}
function positiveModulo(value: number, divisor: number): number {
  const remainder = value % divisor;
  return remainder < 0 ? remainder + divisor : remainder;
}
function clamp(value: number, minimum: number, maximum: number): number {
  return value < minimum ? minimum : value > maximum ? maximum : value;
}
function clampByte(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}
