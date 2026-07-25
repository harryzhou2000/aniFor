import { Material } from '../shared/materials';

/** Exact native cold/crystalline solids that receive a coherent body motif. */
export function isCanvasCrystallineSolidMaterial(material: number): boolean {
  return material === Material.DRIC || material === Material.NICE
    || material === Material.QRTZ || material === Material.RIME;
}

/**
 * Applies one deterministic 32-cell crystalline motif to authoritative RGB.
 *
 * The arithmetic is deliberately discrete and module-static: it performs no
 * allocation, sampling, clock read, or neighbour lookup. Alpha, support,
 * ownership, reconstruction, and the common translucent-rigid optics remain
 * the caller's responsibility.
 */
export function applyCanvasCrystallineSolidMorphology(
  output: Float32Array,
  material: number,
  x: number,
  y: number,
): void {
  if (!isCanvasCrystallineSolidMaterial(material)) return;

  const cellX = positiveModulo(Math.floor(x), 32);
  const cellY = positiveModulo(Math.floor(y), 32);
  let red = 0;
  let green = 0;
  let blue = 0;

  if (material === Material.DRIC) {
    // Dry ice: dark sublimation fractures meet raised frost lips. The slanted
    // lip family prevents a dense block from reading as a regular checkerboard.
    const fracture = positiveModulo(
      cellX * 3 + cellY * 5 + Math.floor(cellY / 4) * 2,
      19,
    ) <= 1;
    const frostLip = positiveModulo(cellX - Math.floor(cellY / 2), 13) <= 1;
    if (fracture && frostLip) {
      red = -10; green = -7; blue = -4;
    } else if (fracture) {
      red = -7; green = -5; blue = -3;
    } else if (frostLip) {
      red = 5; green = 7; blue = 10;
    } else {
      red = -1; green = 0; blue = 2;
    }
  } else if (material === Material.NICE) {
    // Nitrogen ice: two broad cold facet families intersect in sparse blue-white
    // crowns while their faces retain a restrained cryogenic cast.
    const risingFacet = positiveModulo(cellX + cellY * 2, 14) <= 1;
    const fallingFacet = positiveModulo(cellX * 2 - cellY, 17) <= 1;
    if (risingFacet && fallingFacet) {
      red = 7; green = 10; blue = 14;
    } else if (risingFacet) {
      red = -2; green = 3; blue = 10;
    } else if (fallingFacet) {
      red = 3; green = 7; blue = 12;
    } else {
      // This is the dominant body face at normal fit. Canvas applies the
      // motif before family body optics, so a slightly stronger cool cast
      // survives the shared depth pass without changing support or shape.
      red = -1; green = 3; blue = 8;
    }
  } else if (material === Material.QRTZ) {
    // Solid quartz: vertical prism edges cross long diagonal cleavage planes.
    // Alternating faces keep the bulk prismatic without per-cell sparkle.
    const prismEdge = positiveModulo(cellX, 8) <= 1;
    const cleavage = positiveModulo(cellX + cellY, 16) <= 1;
    if (prismEdge && cleavage) {
      red = 12; green = 9; blue = 14;
    } else if (prismEdge) {
      red = 8; green = 4; blue = 12;
    } else if (cleavage) {
      red = -5; green = 2; blue = 7;
    } else if (((Math.floor(cellX / 8) + Math.floor(cellY / 8)) & 1) === 0) {
      // Broad prism faces need enough chroma to remain legible after Canvas
      // body optics at normal fit, while the sparse edge/cleavage accents keep
      // their stronger contrast.
      red = 3; green = 1; blue = 6;
    } else {
      red = 0; green = 4; blue = 3;
    }
  } else {
    // Rime: paired deposition nodes grow a vertical spine and diagonal frost
    // branches. Tips catch the cool key while gaps preserve the pale substrate.
    const localX = positiveModulo(cellX, 16) - 8;
    const nodeY = cellY < 16 ? 8 : 24;
    const localY = cellY - nodeY;
    const spine = Math.abs(localX) <= 1;
    const branch = Math.abs(Math.abs(localX) - Math.abs(localY)) <= 1
      && Math.abs(localX) <= 7;
    const node = spine && Math.abs(localY) <= 1;
    const tip = branch && Math.abs(localX) >= 6;
    if (tip) {
      red = 7; green = 11; blue = 14;
    } else if (node) {
      red = 4; green = 9; blue = 12;
    } else if (branch) {
      red = 5; green = 9; blue = 13;
    } else if (spine) {
      red = 3; green = 7; blue = 10;
    } else {
      red = -2; green = 0; blue = 2;
    }
  }

  output[0] = clampByte(output[0] + clampSigned(red));
  output[1] = clampByte(output[1] + clampSigned(green));
  output[2] = clampByte(output[2] + clampSigned(blue));
}

function positiveModulo(value: number, divisor: number): number {
  const remainder = value % divisor;
  return remainder < 0 ? remainder + divisor : remainder;
}

function clampSigned(value: number): number {
  return value < -14 ? -14 : value > 14 ? 14 : value;
}

function clampByte(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}
