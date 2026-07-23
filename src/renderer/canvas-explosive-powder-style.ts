import { Material } from '../shared/materials';

/** Explosive powders covered by the dedicated Canvas identity treatment. */
export const CANVAS_EXPLOSIVE_POWDER_MATERIALS = [
  Material.Gunpowder,
  Material.Thermite,
  Material.C4,
  Material.Firework,
  Material.BANG,
  Material.BOMB,
  Material.C5,
  Material.DEST,
  Material.FIRW,
  Material.FSEP,
  Material.FUSE,
  Material.IGNT,
  Material.LITH,
  Material.RBDM,
] as const;

export const enum CanvasExplosivePowderFamily {
  None = 0,
  EnergeticCompound = 1,
  Pyrotechnic = 2,
  HighExplosive = 3,
  Fuse = 4,
  ReactiveMetal = 5,
}

// Style zero is reserved for the exact no-op path. These compact lookup tables
// are initialized once and remain read-only during rendering.
const STYLE_BY_MATERIAL = new Uint8Array(256);
const FAMILY_BY_STYLE = new Uint8Array([
  CanvasExplosivePowderFamily.None,
  CanvasExplosivePowderFamily.EnergeticCompound,
  CanvasExplosivePowderFamily.ReactiveMetal,
  CanvasExplosivePowderFamily.EnergeticCompound,
  CanvasExplosivePowderFamily.Pyrotechnic,
  CanvasExplosivePowderFamily.HighExplosive,
  CanvasExplosivePowderFamily.HighExplosive,
  CanvasExplosivePowderFamily.HighExplosive,
  CanvasExplosivePowderFamily.HighExplosive,
  CanvasExplosivePowderFamily.Pyrotechnic,
  CanvasExplosivePowderFamily.Fuse,
  CanvasExplosivePowderFamily.Fuse,
  CanvasExplosivePowderFamily.Fuse,
  CanvasExplosivePowderFamily.ReactiveMetal,
  CanvasExplosivePowderFamily.ReactiveMetal,
]);

// One restrained signed colour key per style. Geometry supplies the variation;
// keeping the complete key inside [-14, 14] makes the bound obvious in both the
// TypeScript implementation and a future GLSL twin.
const RGB_KEY_BY_STYLE = new Int8Array([
  0, 0, 0,
  8, 5, -4,   // GUNP
  13, 3, -5,  // THRM
  5, 7, -3,   // PLEX / C4
  10, -2, 8,  // FWRK
  12, -4, -3, // BANG
  14, 7, -6,  // BOMB
  -3, 4, 12,  // C5
  14, -5, -6, // DEST
  9, 2, 10,   // FIRW
  4, 10, -3,  // FSEP
  -2, 9, -4,  // FUSE
  11, 6, -5,  // IGNT
  8, 1, 6,    // LITH
  6, 4, 8,    // RBDM
]);

for (let style = 1; style <= CANVAS_EXPLOSIVE_POWDER_MATERIALS.length; style++) {
  STYLE_BY_MATERIAL[CANVAS_EXPLOSIVE_POWDER_MATERIALS[style - 1]] = style;
}

/** Returns the stable one-based style identity, or zero for every control. */
export function canvasExplosivePowderStyle(material: number): number {
  if (!Number.isInteger(material) || material < 0 || material >= STYLE_BY_MATERIAL.length) return 0;
  return STYLE_BY_MATERIAL[material];
}

/** Returns the broader visual family, or `None` for a non-explosive control. */
export function canvasExplosivePowderFamily(material: number): CanvasExplosivePowderFamily {
  return FAMILY_BY_STYLE[canvasExplosivePowderStyle(material)] as CanvasExplosivePowderFamily;
}

export function isCanvasExplosivePowderMaterial(material: number): boolean {
  return canvasExplosivePowderStyle(material) !== 0;
}

/**
 * Applies a deterministic identity signature to one explosive powder cell.
 *
 * Coordinates are reduced to world-grid integers before modular arithmetic,
 * making the pattern independent of render scale and straightforward to twin
 * with GLSL `floor` and `mod`. The helper performs no sampling, allocation, or
 * time-dependent work. It changes RGB only; alpha and topology remain owned by
 * the caller.
 */
export function applyCanvasExplosivePowderStyle(
  output: Float32Array,
  material: number,
  x: number,
  y: number,
): void {
  const style = canvasExplosivePowderStyle(material);
  if (style === 0) return;

  const family = FAMILY_BY_STYLE[style];
  const worldX = Math.floor(x);
  const worldY = Math.floor(y);

  // The first mark distinguishes individual materials. The second breaks up
  // repetition, while the family mark gives related powders a shared cadence.
  const materialMark = positiveModulo(worldX * 3 + worldY * 5 + style * 7, 13) === 0;
  const crossMark = positiveModulo(worldX * 7 - worldY * 2 + style * 3, 17) === 0;
  const familyCoordinate = worldX * (family + 1)
    + worldY * (6 - family)
    + family * 3;
  const familyMark = positiveModulo(familyCoordinate, 7 + family) <= (family === 2 ? 1 : 0);
  const gain = materialMark ? 1 : crossMark ? 0.68 : familyMark ? 0.38 : 0.14;
  const keyOffset = style * 3;

  output[0] = clampByte(output[0] + RGB_KEY_BY_STYLE[keyOffset] * gain);
  output[1] = clampByte(output[1] + RGB_KEY_BY_STYLE[keyOffset + 1] * gain);
  output[2] = clampByte(output[2] + RGB_KEY_BY_STYLE[keyOffset + 2] * gain);
}

function positiveModulo(value: number, divisor: number): number {
  const remainder = value % divisor;
  return remainder < 0 ? remainder + divisor : remainder;
}

function clampByte(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}
