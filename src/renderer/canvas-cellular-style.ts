import { Material } from '../shared/materials';

/** First and last stable render projections for native PT_LIFE ctypes. */
export const CANVAS_CELLULAR_FIRST_MATERIAL = Material.LIFE_GOL;
export const CANVAS_CELLULAR_LAST_MATERIAL = Material.LIFE_BRAN;

/** Returns whether a material byte is one of the 24 native LIFE projections. */
export function isCanvasCellularMaterial(material: number): boolean {
  return material >= CANVAS_CELLULAR_FIRST_MATERIAL
    && material <= CANVAS_CELLULAR_LAST_MATERIAL;
}

/**
 * Writes a deterministic RGB-only LIFE motif into caller-owned scratch.
 *
 * The native ctype projection supplies the preset identity. Four inexpensive
 * coordinate vocabularies, plus preset-specific period and phase, keep all 24
 * rules legible without animation, sampling, allocation, or topology changes.
 * Callers continue to own alpha and semantic support; values beyond RGB are
 * deliberately never read or written.
 */
export function shadeCanvasCellularMaterial(
  output: Float32Array,
  material: number,
  x: number,
  y: number,
): void {
  if (!isCanvasCellularMaterial(material)) return;

  const preset = material - CANVAS_CELLULAR_FIRST_MATERIAL;
  const motif = preset & 3;
  const period = 3 + ((preset >>> 2) & 3);
  const phase = positiveModulo(preset * 5 + (preset >>> 4) * 3, period);
  let coordinate: number;
  if (motif === 0) coordinate = x + y;
  else if (motif === 1) coordinate = x + Math.floor(y / 2);
  else if (motif === 2) coordinate = x * 2 + y * 3;
  else coordinate = x - y;

  const bandWidth = 1 + (preset >>> 4);
  const band = positiveModulo(coordinate + phase, period) < bandWidth;
  const nodePeriod = 11 + preset % 3;
  const node = positiveModulo(x * 3 + y * 5 + preset * 7, nodePeriod) === 0;
  // Engrave the dominant band instead of relying on a bright-only accent.
  // Saturated LIFE palettes (white, yellow, cyan, magenta) otherwise clip the
  // motif in Canvas byte space, while very dark palettes still retain the
  // restrained positive interstice and node response.
  const scalar = (band ? -4 - ((preset >>> 2) & 1) * 2 : 2 + (preset & 1))
    + (node ? (band ? -2 : 2) : 0);

  let red = scalar;
  let green = scalar;
  let blue = scalar;
  if (motif === 0) {
    if (band) green -= 2;
    if (node) blue += 2;
  } else if (motif === 1) {
    if (band) red -= 2;
    if (band) blue += 1;
  } else if (motif === 2) {
    if (node) green += 2;
    if (band) red += 1;
  } else {
    if (band) blue -= 2;
    if (node) green -= 1;
  }

  output[0] = clampByte(output[0] + red);
  output[1] = clampByte(output[1] + green);
  output[2] = clampByte(output[2] + blue);
}

function positiveModulo(value: number, divisor: number): number {
  const remainder = value % divisor;
  return remainder < 0 ? remainder + divisor : remainder;
}

function clampByte(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}
