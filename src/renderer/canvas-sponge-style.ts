import { Material } from '../shared/materials';

/**
 * Adds a stable porous relief to one semantic SPNG cell.
 *
 * The response is deliberately RGB-only: dark pore cores and offset warm lips
 * suggest void depth without deleting matter or widening its reconstructed
 * silhouette. Integer world coordinates make the motif deterministic across
 * Canvas2D, WebGL, camera motion, and every presentation scale.
 */
export function applyCanvasSpongeMorphology(
  output: Float32Array,
  material: number,
  x: number,
  y: number,
): void {
  if (material !== Material.SPNG) return;

  const localX = positiveModulo(Math.floor(x), 19);
  const localY = positiveModulo(Math.floor(y), 19);
  const firstX = localX - 5;
  const firstY = localY - 5;
  const secondX = localX - 14;
  const secondY = localY - 12;
  const firstRadius = firstX * firstX + firstY * firstY;
  const secondRadius = secondX * secondX + secondY * secondY;
  const poreCore = firstRadius <= 4 || secondRadius <= 3;
  const firstWall = firstRadius >= 5 && firstRadius <= 12;
  const secondWall = secondRadius >= 4 && secondRadius <= 10;
  const poreWall = firstWall || secondWall;
  const litLip = (firstWall && firstX + firstY <= -2)
    || (secondWall && secondX + secondY <= -2);
  const shadowLip = poreWall && !litLip;

  const red = poreCore ? -8 : litLip ? 7 : shadowLip ? -4 : 0;
  const green = poreCore ? -7 : litLip ? 5 : shadowLip ? -3 : 0;
  const blue = poreCore ? -3 : litLip ? -1 : shadowLip ? -1 : 0;
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
