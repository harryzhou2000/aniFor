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

