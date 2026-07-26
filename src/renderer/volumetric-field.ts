/** Bit layout for the eight cells surrounding a rendered field sample. */
export const NEIGHBOUR_TOP_LEFT = 1 << 0;
export const NEIGHBOUR_TOP = 1 << 1;
export const NEIGHBOUR_TOP_RIGHT = 1 << 2;
export const NEIGHBOUR_LEFT = 1 << 3;
export const NEIGHBOUR_RIGHT = 1 << 4;
export const NEIGHBOUR_BOTTOM_LEFT = 1 << 5;
export const NEIGHBOUR_BOTTOM = 1 << 6;
export const NEIGHBOUR_BOTTOM_RIGHT = 1 << 7;

const POPULATION = Uint8Array.from({ length: 256 }, (_, value) => {
  let count = 0;
  for (let bits = value; bits; bits >>>= 1) count += bits & 1;
  return count;
});

/**
 * Samples a material's local field without allocating. The returned mask can
 * drive density, contour normals, and edge highlights for liquids and gases.
 */
export function materialNeighbourMask(
  cells: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  material: number,
): number {
  let mask = 0;
  const hasTop = y > 0;
  const hasBottom = y + 1 < height;
  const hasLeft = x > 0;
  const hasRight = x + 1 < width;
  const index = y * width + x;

  if (hasTop && hasLeft && cells[index - width - 1] === material) mask |= NEIGHBOUR_TOP_LEFT;
  if (hasTop && cells[index - width] === material) mask |= NEIGHBOUR_TOP;
  if (hasTop && hasRight && cells[index - width + 1] === material) mask |= NEIGHBOUR_TOP_RIGHT;
  if (hasLeft && cells[index - 1] === material) mask |= NEIGHBOUR_LEFT;
  if (hasRight && cells[index + 1] === material) mask |= NEIGHBOUR_RIGHT;
  if (hasBottom && hasLeft && cells[index + width - 1] === material) mask |= NEIGHBOUR_BOTTOM_LEFT;
  if (hasBottom && cells[index + width] === material) mask |= NEIGHBOUR_BOTTOM;
  if (hasBottom && hasRight && cells[index + width + 1] === material) mask |= NEIGHBOUR_BOTTOM_RIGHT;
  return mask;
}

export function neighbourDensity(mask: number): number { return POPULATION[mask & 0xFF]; }

/**
 * True only for a locally uniform material body with one neutral-cell buffer
 * before a different material can begin. Callers reuse the already computed
 * eight-neighbour mask and pay only four bounded cardinal reads.
 */
export function isMaterialBulkInterior(
  cells: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  material: number,
  neighbourMask: number,
): boolean {
  if ((neighbourMask & 0xFF) !== 0xFF || x < 2 || y < 2 || x + 2 >= width || y + 2 >= height) return false;
  const index = y * width + x;
  return cells[index - 2] === material && cells[index + 2] === material
    && cells[index - width * 2] === material && cells[index + width * 2] === material;
}

const CARDINALS = NEIGHBOUR_TOP | NEIGHBOUR_LEFT | NEIGHBOUR_RIGHT | NEIGHBOUR_BOTTOM;
const DIAGONALS = NEIGHBOUR_TOP_LEFT | NEIGHBOUR_TOP_RIGHT | NEIGHBOUR_BOTTOM_LEFT | NEIGHBOUR_BOTTOM_RIGHT;

/**
 * Coverage for an empty solid cell. A closed one-cell cavity is reconstructed,
 * while an exposed edge or a corner remains empty so surfaces do not inflate.
 */
export function enclosedSurfaceCoverage(mask: number): number {
  const support = POPULATION[mask & CARDINALS] * 0.12 + POPULATION[mask & DIAGONALS] * 0.05;
  const normalized = Math.max(0, Math.min(1, (support - 0.34) / (0.64 - 0.34)));
  return normalized * normalized * (3 - 2 * normalized);
}

/** Positive values face the upper-left key light used by the field renderer. */
export function contourLight(mask: number): number {
  const left = Number(Boolean(mask & NEIGHBOUR_TOP_LEFT))
    + Number(Boolean(mask & NEIGHBOUR_LEFT)) * 2
    + Number(Boolean(mask & NEIGHBOUR_BOTTOM_LEFT));
  const right = Number(Boolean(mask & NEIGHBOUR_TOP_RIGHT))
    + Number(Boolean(mask & NEIGHBOUR_RIGHT)) * 2
    + Number(Boolean(mask & NEIGHBOUR_BOTTOM_RIGHT));
  const top = Number(Boolean(mask & NEIGHBOUR_TOP_LEFT))
    + Number(Boolean(mask & NEIGHBOUR_TOP)) * 2
    + Number(Boolean(mask & NEIGHBOUR_TOP_RIGHT));
  const bottom = Number(Boolean(mask & NEIGHBOUR_BOTTOM_LEFT))
    + Number(Boolean(mask & NEIGHBOUR_BOTTOM)) * 2
    + Number(Boolean(mask & NEIGHBOUR_BOTTOM_RIGHT));
  return (right - left) * 2 + (bottom - top) * 3;
}
