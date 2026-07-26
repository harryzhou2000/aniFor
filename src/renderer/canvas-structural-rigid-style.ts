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

// Dense construction bodies use the existing signed macro-relief and
// exact-species optical-depth byte for their broad response. These keys are
// intentionally capped at seven source RGB bytes: they make a large body read
// as brick, metal, ceramic, or mineral rather than a flat generic solid, while
// leaving the sparse identity marks below as a separate fine-detail layer.
const BULK_CROWN_KEY_BY_STYLE = new Int8Array([
  0, 0, 0,
  7, 3, 1, // Brick: warm sunlit crown
  2, 4, 7, // Metal: cool neutral reflection
  2, 4, 6, // Ceramic: cool glazed crown
  1, 4, 6, // Broken metal: restrained plate reflection
  7, 5, 0, // Gold: warm specular crown
  3, 4, 6, // Iron: cool rolled highlight
  2, 5, 7, // Titanium: cold machined crown
]);
const BULK_POCKET_KEY_BY_STYLE = new Int8Array([
  0, 0, 0,
  6, 3, 2, // Brick: shallow warm occlusion
  3, 4, 6, // Metal: cool pocket absorption
  2, 3, 5, // Ceramic: restrained glaze shadow
  3, 4, 5, // Broken metal: subdued plate pocket
  6, 4, 1, // Gold: amber pocket
  4, 4, 5, // Iron: blue-grey pocket
  3, 5, 6, // Titanium: cold pocket
]);

/** Returns the stable structural-identity style, or zero for every control. */
export function canvasStructuralRigidStyle(material: number): number {
  if (!Number.isInteger(material) || material < 0 || material >= STYLE_BY_MATERIAL.length) return 0;
  return STYLE_BY_MATERIAL[material];
}

export function isCanvasStructuralRigidMaterial(material: number): boolean {
  return canvasStructuralRigidStyle(material) !== 0;
}

/**
 * Applies one broad, depth-proven construction-body response after the shared
 * solid optics. The caller has already established semantic ownership and
 * trait/emission/wall eligibility; this helper only consumes existing local
 * state and changes RGB. It is deliberately a no-op for the protected first
 * interior layer, thin structures, and disabled optical-depth mode.
 */
export function applyCanvasStructuralRigidBulkOptics(
  color: Float32Array,
  material: number,
  denseInterior: boolean,
  opticalDepthByte: number,
  relief: number,
  opticalDepthEnabled = true,
): void {
  const style = canvasStructuralRigidStyle(material);
  if (style === 0 || !denseInterior || !opticalDepthEnabled
    || opticalDepthByte <= 6 || relief === 0) return;

  const depthProgress = clampUnit((opticalDepthByte - 6) / 36);
  const depthSupport = depthProgress * depthProgress * (3 - 2 * depthProgress);
  // Seven is the largest currently configured solid-relief amplitude. Keeping
  // the normalization fixed makes this exact RGB bound independent of family.
  const signedResponse = clampUnit(Math.abs(relief) / 7) * depthSupport;
  const keyOffset = style * 3;
  const keys = relief > 0 ? BULK_CROWN_KEY_BY_STYLE : BULK_POCKET_KEY_BY_STYLE;
  const direction = relief > 0 ? 1 : -1;
  color[0] = clampByte(color[0] + keys[keyOffset] * signedResponse * direction);
  color[1] = clampByte(color[1] + keys[keyOffset + 1] * signedResponse * direction);
  color[2] = clampByte(color[2] + keys[keyOffset + 2] * signedResponse * direction);
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

function clampUnit(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
