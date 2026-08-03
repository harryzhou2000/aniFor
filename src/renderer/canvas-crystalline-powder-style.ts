import { Material } from '../shared/materials';

/** Common loose crystals that need a readable Canvas fallback identity. */
export const CANVAS_CRYSTALLINE_POWDER_MATERIALS = [
  Material.Salt,
  Material.Snow,
  Material.Quartz,
] as const;

const STYLE_BY_MATERIAL = new Uint8Array(256);
for (let style = 1; style <= CANVAS_CRYSTALLINE_POWDER_MATERIALS.length; style++) {
  STYLE_BY_MATERIAL[CANVAS_CRYSTALLINE_POWDER_MATERIALS[style - 1]] = style;
}

/** Returns the exact common-crystal style, or zero for every protected control. */
export function canvasCrystallinePowderStyle(material: number): number {
  if (!Number.isInteger(material) || material < 0 || material >= STYLE_BY_MATERIAL.length) return 0;
  return STYLE_BY_MATERIAL[material];
}

export function isCanvasCrystallinePowderMaterial(material: number): boolean {
  return canvasCrystallinePowderStyle(material) !== 0;
}

/**
 * Adds a quiet exact-owner crystal motif after Canvas's common powder body.
 *
 * This is deterministic, RGB-only, allocation-free arithmetic in world-cell
 * coordinates. It changes neither alpha nor support, so holes, contacts,
 * particle physics, and native PQRT state remain caller-owned.
 */
export function applyCanvasCrystallinePowderStyle(
  color: Float32Array,
  material: number,
  x: number,
  y: number,
): void {
  const style = canvasCrystallinePowderStyle(material);
  if (style === 0) return;
  const worldX = Math.floor(x);
  const worldY = Math.floor(y);
  let red = 0;
  let green = 0;
  let blue = 0;

  if (style === 1) {
    // Salt: sparse, warm cubic cleavage planes.
    const longPlane = positiveModulo(worldX + worldY * 2, 9) === 0;
    const crossPlane = positiveModulo(worldX * 2 - worldY, 13) === 0;
    red += longPlane ? 7 : crossPlane ? -4 : 1;
    green += longPlane ? 5 : crossPlane ? -3 : 1;
    blue += longPlane ? 2 : crossPlane ? -2 : 0;
  } else if (style === 2) {
    // Snow: cool, soft flake intersections rather than a hard grain grid.
    const localX = positiveModulo(worldX, 9) - 4;
    const localY = positiveModulo(worldY, 9) - 4;
    const arm = (localX === 0 || localY === 0 || Math.abs(localX) === Math.abs(localY))
      && Math.max(Math.abs(localX), Math.abs(localY)) <= 3;
    const core = Math.abs(localX) + Math.abs(localY) <= 1;
    red += arm ? (core ? 3 : 1) : -1;
    green += arm ? (core ? 6 : 3) : 0;
    blue += arm ? (core ? 8 : 5) : 1;
  } else {
    // Powder quartz: lilac angular facets establish a body beneath tmp2 state.
    const rising = positiveModulo(worldX + worldY * 2, 11) === 0;
    const falling = positiveModulo(worldX * 2 - worldY, 15) === 0;
    red += rising || falling ? 8 : -1;
    green += rising && falling ? 2 : 0;
    blue += rising || falling ? 7 : 1;
  }

  color[0] = clampByte(color[0] + red);
  color[1] = clampByte(color[1] + green);
  color[2] = clampByte(color[2] + blue);
}

function positiveModulo(value: number, divisor: number): number {
  const remainder = value % divisor;
  return remainder < 0 ? remainder + divisor : remainder;
}

function clampByte(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}
