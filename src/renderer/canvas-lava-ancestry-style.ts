import { Material } from '../shared/materials';
import { LAVA_PRESENTATION_STATE } from '../simulation/types';

const MAX_CHANNEL_DELTA = 16;

export const enum CanvasLavaAncestryFamily {
  None = 0,
  Silicate = 1,
  Metal = 2,
  SaltMineral = 3,
  Electronic = 4,
  Radioactive = 5,
}

const FAMILY_BY_ORIGIN = new Uint8Array(256);
const FAMILY_KEY = new Int8Array([
  0, 0, 0,
  -5, 6, 14,  // silicate / glassy
  2, 12, 4,  // metallic
  -6, 14, 9,  // salt / mineral
  -10, 9, 16, // electronic semiconductor
  -6, 16, -2, // radioactive
]);

assignFamily(CanvasLavaAncestryFamily.Silicate, [
  Material.Sand, Material.Stone, Material.Brick, Material.Glass, Material.Ceramic,
  Material.Concrete, Material.Clay, Material.Quartz, Material.BGLA, Material.QRTZ,
  Material.ROCK,
]);
assignFamily(CanvasLavaAncestryFamily.Metal, [
  Material.Metal, Material.Thermite, Material.BRMT, Material.BMTL, Material.GOLD,
  Material.HEAC, Material.IRON, Material.PTNM, Material.TTAN, Material.TUNG,
]);
assignFamily(CanvasLavaAncestryFamily.SaltMineral, [
  Material.Salt, Material.LITH,
]);
assignFamily(CanvasLavaAncestryFamily.Electronic, [
  Material.SLCN, Material.INWR, Material.NTCT, Material.NSCN,
  Material.PSCN, Material.PTCT,
]);
assignFamily(CanvasLavaAncestryFamily.Radioactive, [
  Material.PLUT, Material.POLO, Material.URAN,
]);

/** Returns the bounded visual family for one exact public Lava origin. */
export function canvasLavaAncestryFamily(origin: number): CanvasLavaAncestryFamily {
  if (!Number.isInteger(origin) || origin <= 0 || origin >= FAMILY_BY_ORIGIN.length) {
    return CanvasLavaAncestryFamily.None;
  }
  return FAMILY_BY_ORIGIN[origin] as CanvasLavaAncestryFamily;
}

/**
 * Layers exact native Lava ancestry over the existing molten body.
 *
 * The precise public origin shifts a stable motif while broader melt families
 * share restrained spectral absorption. Generic or unknown Lava is unchanged.
 * This changes RGB only and performs no sample, allocation, clock, or
 * render-scale-dependent work.
 */
export function applyCanvasLavaAncestryStyle(
  output: Float32Array,
  material: number,
  state: number,
  x: number,
  y: number,
): void {
  if (
    material !== Material.Lava
    || (state & LAVA_PRESENTATION_STATE.presentMask) === 0
  ) return;
  const origin = state & LAVA_PRESENTATION_STATE.originMask;
  const family = canvasLavaAncestryFamily(origin);
  if (family === CanvasLavaAncestryFamily.None) return;

  const worldX = Math.floor(x);
  const worldY = Math.floor(y);
  const identityMark = positiveModulo(worldX * 3 + worldY * 5 + origin * 7, 17) <= 1;
  const familyBand = positiveModulo(
    worldX * (family + 1) - worldY * (6 - family) + origin,
    23,
  ) <= 1;
  const gain = identityMark ? 1 : familyBand ? 0.56 : 0.18;
  const key = family * 3;
  output[0] += clampSignedDelta(FAMILY_KEY[key] * gain);
  output[1] += clampSignedDelta(FAMILY_KEY[key + 1] * gain);
  output[2] += clampSignedDelta(FAMILY_KEY[key + 2] * gain);
}

function assignFamily(family: CanvasLavaAncestryFamily, origins: readonly Material[]): void {
  for (const origin of origins) FAMILY_BY_ORIGIN[origin] = family;
}

function positiveModulo(value: number, divisor: number): number {
  const remainder = value % divisor;
  return remainder < 0 ? remainder + divisor : remainder;
}

function clampSignedDelta(value: number): number {
  return value < -MAX_CHANNEL_DELTA ? -MAX_CHANNEL_DELTA
    : value > MAX_CHANNEL_DELTA ? MAX_CHANNEL_DELTA : value;
}
