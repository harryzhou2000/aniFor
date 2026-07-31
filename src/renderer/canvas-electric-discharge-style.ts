import { Material } from '../shared/materials';

/**
 * Exact semantic owners that receive the sparse electrical body motif.
 * Keep this separate from explosive-powder styling: both owners are emissive
 * controls and their topology belongs to the native simulation.
 */
export const CANVAS_ELECTRIC_DISCHARGE_MATERIALS = [
  Material.LIGH,
  Material.THDR,
] as const;

export const enum CanvasElectricDischargeStyle {
  None = 0,
  Lightning = 1,
  Thunder = 2,
}

const STYLE_BY_MATERIAL = new Uint8Array(256);
STYLE_BY_MATERIAL[Material.LIGH] = CanvasElectricDischargeStyle.Lightning;
STYLE_BY_MATERIAL[Material.THDR] = CanvasElectricDischargeStyle.Thunder;

function positiveModulo(value: number, divisor: number): number {
  const remainder = value % divisor;
  return remainder < 0 ? remainder + divisor : remainder;
}

function clampByte(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}

/**
 * Returns an exact-owner style only. Numeric projections, parameterised IDs,
 * and every ordinary explosive are deliberately no-ops.
 */
export function canvasElectricDischargeStyle(
  material: number,
): CanvasElectricDischargeStyle {
  if (!Number.isInteger(material) || material < 0 || material >= STYLE_BY_MATERIAL.length) {
    return CanvasElectricDischargeStyle.None;
  }
  return STYLE_BY_MATERIAL[material] as CanvasElectricDischargeStyle;
}

export function isCanvasElectricDischargeMaterial(material: number): boolean {
  return canvasElectricDischargeStyle(material) !== CanvasElectricDischargeStyle.None;
}

/**
 * Adds a deterministic world-anchored electrical accent to an existing RGB
 * result. This is arithmetic-only, allocation-free, and never changes alpha,
 * ownership, support, or topology. Each channel moves by at most 18 bytes.
 */
export function applyCanvasElectricDischargeStyle(
  output: Float32Array,
  material: number,
  x: number,
  y: number,
): void {
  const style = canvasElectricDischargeStyle(material);
  if (style === CanvasElectricDischargeStyle.None) {
    return;
  }

  const worldX = Math.floor(x);
  const worldY = Math.floor(y);
  let redDelta = 0;
  let greenDelta = 0;
  let blueDelta = 0;

  if (style === CanvasElectricDischargeStyle.Lightning) {
    // A cool narrow trunk with intermittent, world-anchored branch sparks.
    const trunk = positiveModulo(worldX * 2 - worldY * 3, 13) <= 1;
    const branch = positiveModulo(worldX * 5 + worldY * 3, 17) === 0;
    const node = positiveModulo(worldX + worldY * 2, 29) === 0;
    redDelta = trunk ? 10 : branch ? 6 : 2;
    greenDelta = trunk ? 14 : branch ? 8 : 3;
    blueDelta = node ? 18 : trunk ? 16 : branch ? 14 : 5;
  } else {
    // A warmer, heavier fork with a restrained blue shock fringe.
    const fork = positiveModulo(worldX * 3 + worldY * 5, 11) <= 1;
    const shock = positiveModulo(worldX * 7 - worldY * 2, 19) === 0;
    const ember = positiveModulo(worldX + worldY * 3, 7) <= 1;
    redDelta = fork ? 18 : shock ? 12 : 5;
    greenDelta = fork ? 13 : shock ? 7 : 3;
    blueDelta = fork ? 3 : shock ? 7 : ember ? 1 : -2;
  }

  output[0] = clampByte(output[0] + redDelta);
  output[1] = clampByte(output[1] + greenDelta);
  output[2] = clampByte(output[2] + blueDelta);
}
