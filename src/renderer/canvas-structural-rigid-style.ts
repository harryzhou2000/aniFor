import { Material } from '../shared/materials';

/** Exact common construction solids with an independent body-identity layer. */
export const CANVAS_STRUCTURAL_RIGID_MATERIALS = [
  Material.Brick,
  Material.Metal,
  Material.Ceramic,
  Material.BMTL,
  Material.GOLD,
  Material.IRON,
  Material.TTAN,
] as const;

const STYLE_BY_MATERIAL = new Uint8Array(256);
for (let style = 1; style <= CANVAS_STRUCTURAL_RIGID_MATERIALS.length; style++) {
  STYLE_BY_MATERIAL[CANVAS_STRUCTURAL_RIGID_MATERIALS[style - 1]] = style;
}

/** Returns the stable structural-identity style, or zero for every control. */
export function canvasStructuralRigidStyle(material: number): number {
  if (!Number.isInteger(material) || material < 0 || material >= STYLE_BY_MATERIAL.length) return 0;
  return STYLE_BY_MATERIAL[material];
}

export function isCanvasStructuralRigidMaterial(material: number): boolean {
  return canvasStructuralRigidStyle(material) !== 0;
}

/**
 * Adds a restrained, world-anchored identity to common rigid construction
 * matter. The caller owns opacity, contours, semantic material identity, and
 * all physical state; this helper is allocation-free RGB arithmetic only.
 */
export function applyCanvasStructuralRigidStyle(
  color: Float32Array,
  material: number,
  x: number,
  y: number,
): void {
  const style = canvasStructuralRigidStyle(material);
  if (style === 0) return;

  const worldX = Math.floor(x);
  const worldY = Math.floor(y);
  let red = 0;
  let green = 0;
  let blue = 0;

  if (style === 1) {
    // Brick: staggered courses with a subdued warm mortar interruption.
    const course = positiveModulo(worldY, 6) === 0;
    const joint = positiveModulo(worldX + Math.floor(worldY / 6) * 3, 12) === 0;
    const fleck = positiveModulo(worldX * 5 + worldY * 3, 23) === 0;
    if (course || joint) { red -= 8; green -= 6; blue -= 4; }
    else if (fleck) { red += 3; green += 1; blue -= 1; }
  } else if (style === 2) {
    // Metal: cool, sparse machined brush marks and specular pinpoints.
    const brush = positiveModulo(worldX * 2 + worldY, 9) === 0;
    const glint = positiveModulo(worldX * 5 - worldY * 3, 31) === 0;
    if (brush) { red -= 2; green += 1; blue += 4; }
    if (glint) { red += 5; green += 6; blue += 7; }
  } else if (style === 3) {
    // Ceramic: fine cool glaze with isolated restrained crazing seams.
    const glaze = positiveModulo(worldX * 3 + worldY * 5, 19) === 0;
    const craze = positiveModulo(worldX * 7 - worldY * 4, 29) === 0;
    if (glaze) { red += 3; green += 4; blue += 5; }
    if (craze) { red -= 4; green -= 3; blue -= 2; }
  } else if (style === 4) {
    // Broken metal: broad plate joins and sparse dark repair pits.
    const plate = positiveModulo(worldX + Math.floor(worldY / 5) * 2, 11) === 0;
    const pit = positiveModulo(worldX * 7 + worldY * 11, 37) === 0;
    if (plate) { red -= 3; green -= 2; blue += 2; }
    if (pit) { red -= 7; green -= 6; blue -= 4; }
  } else if (style === 5) {
    // Gold: a warm, narrow cross-grain sheen rather than a flat yellow plate.
    const grain = positiveModulo(worldX * 3 - worldY, 13) === 0;
    const glint = positiveModulo(worldX * 5 + worldY * 2, 31) === 0;
    if (grain) { red += 5; green += 3; blue -= 3; }
    if (glint) { red += 7; green += 5; blue -= 1; }
  } else if (style === 6) {
    // Iron: quiet oxide-scale flecks over a cool rolled base.
    const scale = positiveModulo(worldX * 5 + worldY * 3, 17) <= 1;
    const roll = positiveModulo(worldX - worldY * 2, 15) === 0;
    if (scale) { red += 5; green -= 2; blue -= 4; }
    if (roll) { red -= 2; green -= 1; blue += 2; }
  } else {
    // Titanium: fine cool lamellae with rare neutral machining highlights.
    const lamella = positiveModulo(worldX * 2 + worldY * 3, 11) === 0;
    const highlight = positiveModulo(worldX * 7 - worldY * 5, 37) === 0;
    if (lamella) { red -= 2; green += 2; blue += 5; }
    if (highlight) { red += 3; green += 4; blue += 5; }
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
