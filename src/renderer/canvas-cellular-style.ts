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
 * A fixed 16-cell membrane/core/junction grammar keeps a dense colony from
 * reading as a flat engraved solid. Callers continue to own alpha and semantic
 * support;
 * values beyond RGB are deliberately never read or written.
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
  // A world-anchored microscopic colony: a dim membrane encloses a small core.
  // This is deliberately only an RGB grammar; it never substitutes for live-cell
  // occupancy, reconstructs gaps, reads neighbours, or follows simulation time.
  const cellX = positiveModulo(x + preset * 3, 16) - 7.5;
  const cellY = positiveModulo(y + preset * 5, 16) - 7.5;
  const radiusSquared = cellX * cellX + cellY * cellY;
  const membrane = radiusSquared >= 24.5 && radiusSquared <= 43.5;
  const core = radiusSquared <= 7.5;
  // A restrained chord through the living membrane gives a packed colony a
  // cell-wall junction rather than a field of repeated stripes. It remains a
  // world-anchored RGB mark: no live/dead inference or neighbour ownership is
  // involved, and the exact native preset selects its orientation.
  let junctionCoordinate: number;
  if (motif === 0) junctionCoordinate = cellX - cellY;
  else if (motif === 1) junctionCoordinate = cellX + cellY;
  else if (motif === 2) junctionCoordinate = cellX * 2 + cellY;
  else junctionCoordinate = cellX - cellY * 2;
  const junction = radiusSquared >= 18.5 && radiusSquared < 42.5
    && Math.abs(junctionCoordinate) < 0.75;
  // Engrave the dominant band instead of relying on a bright-only accent.
  // Saturated LIFE palettes (white, yellow, cyan, magenta) otherwise clip the
  // motif in Canvas byte space, while very dark palettes still retain the
  // restrained positive interstice and node response.
  const scalar = (band ? -4 - ((preset >>> 2) & 1) * 2 : 2 + (preset & 1))
    + (node ? (band ? -2 : 2) : 0)
    + (membrane ? -1 : core ? 1 : 0)
    + (junction ? (band ? -1 : -2) : 0);

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
  if (membrane) {
    red -= motif === 1 ? 0 : 1;
    green -= motif === 2 ? 0 : 1;
    blue += motif === 3 ? 0 : 1;
  } else if (core) {
    red += motif === 2 ? 1 : 0;
    green += motif === 3 ? 1 : 0;
    blue += motif === 0 ? 1 : 0;
  }
  if (junction) {
    if (motif === 0) green -= 1;
    else if (motif === 1) blue -= 1;
    else if (motif === 2) red -= 1;
    else green -= 1;
  }

  // Keep composed cellular texture in the same restrained ten-byte envelope
  // used by the former stripe-only motif, including saturated native palettes.
  output[0] = clampByte(output[0] + clamp(red, -10, 10));
  output[1] = clampByte(output[1] + clamp(green, -10, 10));
  output[2] = clampByte(output[2] + clamp(blue, -10, 10));
}

function positiveModulo(value: number, divisor: number): number {
  const remainder = value % divisor;
  return remainder < 0 ? remainder + divisor : remainder;
}

function clampByte(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
