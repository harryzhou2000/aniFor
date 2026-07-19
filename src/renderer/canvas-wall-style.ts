import { Material } from '../shared/materials';

const WALL_COLORS: Readonly<Record<number, readonly [number, number, number]>> = {
  1: [125, 139, 150], 2: [91, 111, 139], 3: [191, 130, 60], 6: [68, 145, 170],
  8: [104, 105, 108], 9: [111, 132, 150], 10: [174, 132, 73], 13: [129, 108, 156],
  15: [205, 191, 91], 16: [68, 80, 91],
};
const DEFAULT_WALL_COLOR = [103, 105, 111] as const;

/** Writes one native-wall backdrop while allowing only its procedural pattern coordinate to move. */
export function writeCanvasWallPixel(
  target: Uint8ClampedArray,
  offset: number,
  wall: number,
  x: number,
  y: number,
  patternX = x,
  patternY = y,
): void {
  const color = WALL_COLORS[wall] ?? DEFAULT_WALL_COLOR;
  const light = canvasWallPatternLight(wall, patternX, patternY);
  target[offset] = clampByte(color[0] + light);
  target[offset + 1] = clampByte(color[1] + light);
  target[offset + 2] = clampByte(color[2] + light);
  target[offset + 3] = 248;
}

/**
 * Rewrites only a coexisting wall's pattern for exact Glass/Ice. Glass carries
 * one coherent lens shift; Ice averages opposing stable facets. Wall identity,
 * wall alpha, particle alpha, and both semantic planes remain untouched.
 */
export function writeCanvasRefractedWallPixel(
  target: Uint8ClampedArray,
  offset: number,
  wall: number,
  x: number,
  y: number,
  material: number,
): boolean {
  if (wall === 0 || (material !== Material.Glass && material !== Material.Ice)) return false;
  const color = WALL_COLORS[wall] ?? DEFAULT_WALL_COLOR;
  if (material === Material.Glass) {
    const phase = (x * 2 + y + material * 11) & 127;
    const shiftX = phase < 64 ? 2 : -2;
    const light = canvasWallPatternLight(wall, x + shiftX, y);
    target[offset] = clampByte(color[0] + light);
    target[offset + 1] = clampByte(color[1] + light);
    target[offset + 2] = clampByte(color[2] + light);
  } else {
    const facet = (Math.floor(x / 4) + Math.floor(y / 4) * 3 + material) & 3;
    const shiftX = facet === 0 ? 2 : facet === 1 ? -2 : 0;
    const shiftY = facet === 2 ? 2 : facet === 3 ? -2 : 0;
    const forward = canvasWallPatternLight(wall, x + shiftX, y + shiftY);
    const reverse = canvasWallPatternLight(wall, x - shiftX, y - shiftY);
    const light = forward * 0.68 + reverse * 0.32;
    target[offset] = clampByte(color[0] + light);
    target[offset + 1] = clampByte(color[1] + light);
    target[offset + 2] = clampByte(color[2] + light);
  }
  target[offset + 3] = 248;
  return true;
}

export function canvasWallPatternLight(wall: number, x: number, y: number): number {
  const checker = ((Math.floor(x / 4) + Math.floor(y / 4)) & 1) ? 9 : -4;
  const patterned = wall === 6 || wall === 9 || wall === 10 || wall === 13 || wall === 15;
  const stripe = patterned && ((Math.floor(x) + Math.floor(y)) & 3) === 0 ? 22 : 0;
  return checker + stripe;
}

function clampByte(value: number): number { return Math.max(0, Math.min(255, value)); }
