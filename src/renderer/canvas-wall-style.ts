import { Material } from '../shared/materials';
import { RenderOptics } from './render-optics';

const WALL_COLORS: Readonly<Record<number, readonly [number, number, number]>> = {
  1: [125, 139, 150], 2: [91, 111, 139], 3: [191, 130, 60], 6: [68, 145, 170],
  8: [104, 105, 108], 9: [111, 132, 150], 10: [174, 132, 73], 13: [129, 108, 156],
  15: [205, 191, 91], 16: [68, 80, 91],
};
const DEFAULT_WALL_COLOR = [103, 105, 111] as const;
export const CANVAS_LIQUID_REFRACTION_LOOKUP_BYTES = 0;

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
  edgeX = 0,
  edgeY = 0,
): boolean {
  if (wall === 0 || (material !== Material.Glass && material !== Material.Ice)) return false;
  const color = WALL_COLORS[wall] ?? DEFAULT_WALL_COLOR;
  if (material === Material.Glass) {
    const shiftX = Math.sign(edgeX) * 3;
    const shiftY = Math.sign(edgeY) * 3;
    const light = canvasWallPatternLight(wall, x + shiftX, y + shiftY);
    target[offset] = clampByte(color[0] + light);
    target[offset + 1] = clampByte(color[1] + light);
    target[offset + 2] = clampByte(color[2] + light);
  } else {
    const facet = (Math.floor(x / 4) + Math.floor(y / 4) * 3 + material) & 3;
    const shiftX = edgeX !== 0 ? Math.sign(edgeX) * 2
      : facet === 0 ? 2 : facet === 1 ? -2 : 0;
    const shiftY = edgeY !== 0 ? Math.sign(edgeY) * 2
      : facet === 2 ? 2 : facet === 3 ? -2 : 0;
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

/**
 * Rewrites only a coexisting wall's procedural pattern through a supported
 * non-emissive liquid surface. Phase-categorical neighbours supply the outer
 * slope on top of one coherent family-specific lens displacement. Dense
 * interiors therefore bend as a stable body instead of sliding the discrete
 * wall pattern in visible tiles. Native wall ID, wall alpha, liquid alpha, and
 * both semantic planes remain unchanged.
 */
export function writeCanvasLiquidRefractedWallPixel(
  target: Uint8ClampedArray,
  offset: number,
  wall: number,
  x: number,
  y: number,
  optics: RenderOptics,
  edgeX = 0,
  edgeY = 0,
): boolean {
  if (wall === 0 || optics === RenderOptics.Molten) return false;
  const strength = optics === RenderOptics.Aqueous || optics === RenderOptics.Corrosive
    ? 3 : 2;
  const coherentX = optics === RenderOptics.Aqueous || optics === RenderOptics.Corrosive
    ? 2 : optics === RenderOptics.Oily ? -1 : 1;
  const coherentY = optics === RenderOptics.Aqueous ? -1
    : optics === RenderOptics.Oily || optics === RenderOptics.Corrosive ? 1 : 0;
  const shiftX = clampShift(coherentX + edgeX * strength);
  const shiftY = clampShift(coherentY + edgeY * strength);
  if (shiftX === 0 && shiftY === 0) return false;
  writeCanvasWallPixel(target, offset, wall, x, y, x + shiftX, y + shiftY);
  return true;
}

export function canvasWallPatternLight(wall: number, x: number, y: number): number {
  if (wall === 6) {
    // One continuous wall ID carries an asymmetric calibration-card pattern.
    // Refraction moves only this analytic coordinate, so wall identity/support
    // remain authoritative while irregular fiducials visibly bend.
    const cellX = Math.floor(x);
    const cellY = Math.floor(y);
    const localX = positiveModulo(cellX, 40);
    const localY = positiveModulo(cellY, 24);
    const verticalDistance = Math.min(
      Math.abs(localX - 4), Math.abs(localX - 13), Math.abs(localX - 27),
    );
    const vertical = verticalDistance <= 1 ? 28 : 0;
    const baseline = Math.abs(localY - 12) <= 1 ? 16 : 0;
    const chevronX = 20 + Math.floor(Math.abs(localY - 12) * 0.55);
    const chevron = Math.abs(localX - chevronX) <= 1 ? 12 : 0;
    return -7 + vertical + baseline + chevron;
  }
  const checker = ((Math.floor(x / 4) + Math.floor(y / 4)) & 1) ? 9 : -4;
  const patterned = wall === 9 || wall === 10 || wall === 13 || wall === 15;
  const stripe = patterned && ((Math.floor(x) + Math.floor(y)) & 3) === 0 ? 22 : 0;
  return checker + stripe;
}

function clampByte(value: number): number { return Math.max(0, Math.min(255, value)); }
function clampShift(value: number): number { return Math.max(-3, Math.min(3, value)); }
function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
