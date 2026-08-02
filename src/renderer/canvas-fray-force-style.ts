import { Material } from '../shared/materials';

/** True only for the native temperature-driven Force Ray emitter. */
export function isCanvasFrayForceMaterial(material: number): boolean {
  return material === Material.FRAY;
}

/**
 * Applies a compact static nozzle grammar to an authoritative FRAY owner.
 *
 * FRAY's push/pull polarity belongs to native temperature simulation, so this
 * deliberately does not infer a direction, inspect state, or animate. The
 * world-anchored marks change RGB only; alpha, coverage, walls, and particle
 * ownership remain under the ordinary renderer.
 */
export function applyCanvasFrayForceStyle(
  color: Float32Array,
  material: number,
  x: number,
  y: number,
): void {
  if (!isCanvasFrayForceMaterial(material)) return;
  const cellX = positiveModulo(Math.floor(x), 24) - 11.5;
  const cellY = positiveModulo(Math.floor(y), 24) - 11.5;
  const radiusSquared = cellX * cellX + cellY * cellY;
  const core = radiusSquared <= 6.25;
  const ring = radiusSquared >= 24 && radiusSquared <= 42;
  const axis = Math.abs(cellY) <= 1.5 && Math.abs(cellX) <= 10.5;
  const rail = Math.abs(cellX) >= 8.5 && Math.abs(cellY) <= 8.5;
  const pin = positiveModulo(Math.floor(x) * 3 - Math.floor(y) * 5, 29) === 0;
  let red = 0;
  let green = 0;
  let blue = 0;
  if (core) { red -= 3; green += 5; blue += 8; }
  if (ring) { red -= 2; green += 4; blue += 7; }
  if (axis) { red += 1; green += 3; blue += 5; }
  if (rail) { red -= 2; green += 2; blue += 4; }
  if (pin) { red += 2; green += 3; blue += 4; }
  color[0] = clampByte(color[0] + clamp(red, -12, 12));
  color[1] = clampByte(color[1] + clamp(green, -12, 12));
  color[2] = clampByte(color[2] + clamp(blue, -12, 12));
}

function positiveModulo(value: number, divisor: number): number {
  const remainder = value % divisor;
  return remainder < 0 ? remainder + divisor : remainder;
}

function clampByte(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return value < minimum ? minimum : value > maximum ? maximum : value;
}
