import { Material } from '../shared/materials';

/** True only for GBMB, whose native Newtonian-gravity behavior is unavailable here. */
export function isCanvasGbmbForceMaterial(material: number): boolean {
  return material === Material.GBMB;
}

/**
 * Applies a static containment-body signature to GBMB RGB only.
 *
 * This is not a gravity, velocity, attachment, or polarity visualization. It
 * uses only exact material ownership and world coordinates, retaining the
 * renderer's established powder topology, alpha, walls, and simulation state.
 */
export function applyCanvasGbmbForceStyle(
  color: Float32Array,
  material: number,
  x: number,
  y: number,
): void {
  if (!isCanvasGbmbForceMaterial(material)) return;
  const worldX = Math.floor(x);
  const worldY = Math.floor(y);
  const localX = positiveModulo(worldX, 28) - 13.5;
  const localY = positiveModulo(worldY, 28) - 13.5;
  const radiusSquared = localX * localX + localY * localY;
  const core = radiusSquared <= 9;
  const ring = radiusSquared >= 35 && radiusSquared <= 60;
  const meridian = Math.abs(localX) <= 1.5 && Math.abs(localY) <= 11.5;
  const latitude = Math.abs(localY) <= 1.5 && Math.abs(localX) <= 11.5;
  const mote = positiveModulo(worldX * 5 + worldY * 3, 37) === 0;
  let red = 0;
  let green = 0;
  let blue = 0;
  if (core) { red += 3; green += 4; blue += 9; }
  if (ring) { red += 2; green += 2; blue += 8; }
  if (meridian || latitude) { red -= 3; green -= 2; blue += 3; }
  if (mote) { red += 2; green += 3; blue += 5; }
  color[0] = clampByte(color[0] + clamp(red, -12, 12));
  color[1] = clampByte(color[1] + clamp(green, -12, 12));
  color[2] = clampByte(color[2] + clamp(blue, -12, 12));
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
