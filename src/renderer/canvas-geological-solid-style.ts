import { Material } from '../shared/materials';

/** Exact native geological solids with a depth-proven body treatment. */
export const CANVAS_GEOLOGICAL_SOLID_MATERIALS = [
  Material.Coal,
  Material.ROCK,
] as const;

export const enum CanvasGeologicalSolidStyle {
  None = 0,
  Coal = 1,
  Rock = 2,
}

const STYLE_BY_MATERIAL = new Uint8Array(256);
STYLE_BY_MATERIAL[Material.Coal] = CanvasGeologicalSolidStyle.Coal;
STYLE_BY_MATERIAL[Material.ROCK] = CanvasGeologicalSolidStyle.Rock;

const DEPTH_START = 6;
const DEPTH_RANGE = 36;
const RELIEF_RANGE = 7;

/** Returns the exact geological body style, or `None` for all controls. */
export function canvasGeologicalSolidStyle(material: number): CanvasGeologicalSolidStyle {
  if (!Number.isInteger(material) || material < 0 || material >= STYLE_BY_MATERIAL.length) {
    return CanvasGeologicalSolidStyle.None;
  }
  return STYLE_BY_MATERIAL[material] as CanvasGeologicalSolidStyle;
}

export function isCanvasGeologicalSolidMaterial(material: number): boolean {
  return canvasGeologicalSolidStyle(material) !== CanvasGeologicalSolidStyle.None;
}

/**
 * Adds exact-owner geological core optics after the common solid body pass.
 *
 * The caller supplies the existing exact-species optical-depth byte and
 * analytic solid relief. This helper performs world-anchored RGB arithmetic
 * only: it does not inspect neighbours, allocate, alter alpha, or make a
 * support/topology decision. The first proven interior layer remains an exact
 * no-op so thin structures, authored holes, and seams keep their common path.
 */
export function applyCanvasGeologicalSolidCoreOptics(
  color: Float32Array,
  material: number,
  x: number,
  y: number,
  denseInterior: boolean,
  opticalDepthByte: number,
  relief: number,
  opticalDepthEnabled = true,
): void {
  const style = canvasGeologicalSolidStyle(material);
  if (style === CanvasGeologicalSolidStyle.None || !denseInterior
    || !opticalDepthEnabled || opticalDepthByte <= DEPTH_START) return;

  const depth = smoothstep((opticalDepthByte - DEPTH_START) / DEPTH_RANGE);
  const signedRelief = clamp(relief / RELIEF_RANGE, -1, 1) * depth;
  const crown = Math.max(0, signedRelief);
  const pocket = Math.max(0, -signedRelief);
  const worldX = Math.floor(x);
  const worldY = Math.floor(y);
  let red = 0;
  let green = 0;
  let blue = 0;

  if (style === CanvasGeologicalSolidStyle.Coal) {
    // Coal: soot-darkened depth with rare warm mineral inclusions. Cleavage is
    // deliberately broad and world-anchored, never a cell-edge decision.
    const cleavage = positiveModulo(worldX * 2 + worldY * 3, 13) === 0;
    const crossCleavage = positiveModulo(worldX - worldY * 2, 29) === 0;
    const inclusion = positiveModulo(worldX * 7 + worldY * 5, 41) === 0;
    red -= 5 * depth + pocket * 3;
    green -= 4 * depth + pocket * 2;
    blue -= 3 * depth + pocket;
    if (cleavage || crossCleavage) {
      red -= 2 * depth;
      green -= 2 * depth;
      blue -= depth;
    }
    if (inclusion) {
      red += 3 * depth + crown;
      green += depth;
      blue -= depth;
    } else {
      blue += crown * 2;
    }
  } else {
    // ROCK: low-frequency strata and cool mineral crowns over depth-proven
    // body absorption. The sparse vein is an identity mark, not a contour.
    const stratum = positiveModulo(worldX + Math.floor(worldY / 3) * 2, 15) <= 1;
    const vein = positiveModulo(worldX * 3 - worldY * 2, 37) === 0;
    red -= 3 * pocket + (stratum ? depth : 0);
    green += crown * 2 - pocket * 2 + (stratum ? depth : 0);
    blue += crown * 4 - pocket + (stratum ? 2 * depth : 0);
    if (vein) {
      red += depth;
      green += 2 * depth;
      blue += 3 * depth;
    }
  }

  color[0] = clampByte(color[0] + clamp(red, -12, 12));
  color[1] = clampByte(color[1] + clamp(green, -12, 12));
  color[2] = clampByte(color[2] + clamp(blue, -12, 12));
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
