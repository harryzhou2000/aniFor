import { Material } from '../shared/materials';

/**
 * Exact earth-derived powders with a low-frequency Canvas body-identity layer.
 *
 * These are intentionally kept separate from granular particle styling: the
 * marks describe subdued sediment, mineral, and formed-earth variation that
 * remains coherent when Smooth powder contours reconstruct a larger body.
 */
export const CANVAS_EARTHEN_POWDER_MATERIALS = [
  Material.Dust,
  Material.Stone,
  Material.Concrete,
  Material.Clay,
] as const;

const STYLE_BY_MATERIAL = new Uint8Array(256);
for (let style = 1; style <= CANVAS_EARTHEN_POWDER_MATERIALS.length; style++) {
  STYLE_BY_MATERIAL[CANVAS_EARTHEN_POWDER_MATERIALS[style - 1]] = style;
}

/** Returns the stable one-based earth-material style, or zero for all controls. */
export function canvasEarthenPowderStyle(material: number): number {
  if (!Number.isInteger(material) || material < 0 || material >= STYLE_BY_MATERIAL.length) return 0;
  return STYLE_BY_MATERIAL[material];
}

export function isCanvasEarthenPowderMaterial(material: number): boolean {
  return canvasEarthenPowderStyle(material) !== 0;
}

/**
 * Adds restrained, world-anchored earth-material variation to RGB only.
 *
 * Coordinates are reduced to world-grid integers, so the motif stays stable
 * across render scales. The helper does no sampling, allocation, or temporal
 * work; alpha, coverage, ownership, and powder topology remain caller-owned.
 */
export function applyCanvasEarthenPowderStyle(
  color: Float32Array,
  material: number,
  x: number,
  y: number,
): void {
  const style = canvasEarthenPowderStyle(material);
  if (style === 0) return;

  const worldX = Math.floor(x);
  const worldY = Math.floor(y);
  let red = 0;
  let green = 0;
  let blue = 0;

  if (style === 1) {
    // Dust: broad wind-laid bands interrupted by very occasional pale silt.
    const band = positiveModulo(worldY + Math.floor(worldX / 7) * 2, 17) === 0;
    const silt = positiveModulo(worldX * 3 + worldY * 5, 31) === 0;
    if (band) { red -= 4; green -= 3; blue -= 2; }
    else if (silt) { red += 4; green += 3; blue += 1; }
  } else if (style === 2) {
    // Stone: long mineral seams and rare cool crystalline facets.
    const seam = positiveModulo(worldX * 2 - worldY + Math.floor(worldY / 9) * 3, 23) === 0;
    const facet = positiveModulo(worldX * 5 + worldY * 2, 37) === 0;
    if (seam) { red -= 5; green -= 4; blue -= 2; }
    if (facet) { red += 2; green += 3; blue += 4; }
  } else if (style === 3) {
    // Concrete: restrained formwork courses with widely spaced warm aggregate.
    const course = positiveModulo(worldY, 13) === 0;
    const joint = positiveModulo(worldX + Math.floor(worldY / 13) * 5, 29) === 0;
    const aggregate = positiveModulo(worldX * 4 + worldY * 7, 41) === 0;
    if (course || joint) { red -= 4; green -= 4; blue -= 3; }
    else if (aggregate) { red += 3; green += 2; blue -= 1; }
  } else {
    // Clay: soft sedimentary lamellae with sparse warmer compression pockets.
    const lamella = positiveModulo(worldY * 2 + Math.floor(worldX / 8), 19) === 0;
    const pocket = positiveModulo(worldX * 3 - worldY * 2, 43) === 0;
    if (lamella) { red -= 3; green -= 3; blue -= 2; }
    if (pocket) { red += 5; green += 1; blue -= 2; }
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
