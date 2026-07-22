import { Material } from '../shared/materials';
import { RenderPhase } from './render-profile';

const TILE_SHIFT = 5;
const TILE_SIZE = 1 << TILE_SHIFT;
const TILE_MASK = TILE_SIZE - 1;
const TILE_CELLS = TILE_SIZE * TILE_SIZE;
const CHANNELS = 3;
const PHASES = 2;

/** Signed RGB grammar shared by solid WAX and liquid MWAX. */
const WAX_FAMILY_RGB = new Int8Array(PHASES * TILE_CELLS * CHANNELS);

buildWaxFamilyLookup();

/** Module-static bytes; independent of world size and presentation scale. */
export const CANVAS_WAX_FAMILY_LOOKUP_BYTES = WAX_FAMILY_RGB.byteLength;

export function isWaxFamilyMaterial(material: number): boolean {
  return material === Material.Wax || material === Material.MWAX;
}

/**
 * Returns one signed channel from the shared 32-cell wax lamella grammar.
 * Solid and liquid use the same ridges/blooms while phase-specific amplitudes
 * let crystals soften into a flowing translucent body after native melting.
 */
export function canvasWaxFamilyMotifDelta(
  phase: RenderPhase.Solid | RenderPhase.Liquid,
  x: number,
  y: number,
  channel: 0 | 1 | 2,
): number {
  const phaseIndex = phase === RenderPhase.Liquid ? 1 : 0;
  const cell = ((y & TILE_MASK) << TILE_SHIFT) | (x & TILE_MASK);
  return WAX_FAMILY_RGB[(phaseIndex * TILE_CELLS + cell) * CHANNELS + channel];
}

/** Applies the solid phase directly; MWAX is composed by the liquid identity layer. */
export function applyCanvasWaxFamilyMorphology(
  output: Float32Array,
  material: number,
  phase: RenderPhase.Solid | RenderPhase.Liquid,
  x: number,
  y: number,
): void {
  if (!isWaxFamilyMaterial(material)) return;
  output[0] = clampByte(output[0] + canvasWaxFamilyMotifDelta(phase, x, y, 0));
  output[1] = clampByte(output[1] + canvasWaxFamilyMotifDelta(phase, x, y, 1));
  output[2] = clampByte(output[2] + canvasWaxFamilyMotifDelta(phase, x, y, 2));
}

function buildWaxFamilyLookup(): void {
  for (let phase = 0; phase < PHASES; phase++) {
    for (let y = 0; y < TILE_SIZE; y++) for (let x = 0; x < TILE_SIZE; x++) {
      const localX = (x & 15) - 8;
      const localY = (y & 15) - 8;
      const radiusSquared = localX * localX + localY * localY;
      const bloom = radiusSquared >= 27 && radiusSquared <= 49;
      const lamella = (x + y * 2 + ((x >> 3) << 1)) & 15;
      const raisedRidge = lamella <= 2;
      const recessedFold = lamella >= 9 && lamella <= 11;
      const waxJoint = bloom && ((x + y) & 3) === 0;

      let red = 1;
      let green = 1;
      let blue = 0;
      if (phase === 0) {
        // Solid WAX: crystalline blooms interrupt layered cooling strata.
        if (waxJoint) { red = 11; green = 9; blue = 4; }
        else if (bloom) { red = 7; green = 6; blue = 2; }
        else if (raisedRidge) { red = 8; green = 6; blue = 2; }
        else if (recessedFold) { red = -6; green = -5; blue = -3; }
      } else {
        // MWAX: the same lamellae remain legible but soften into broad flow bands.
        if (waxJoint) { red = 7; green = 7; blue = 3; }
        else if (bloom) { red = 4; green = 5; blue = 2; }
        else if (raisedRidge) { red = 6; green = 6; blue = 2; }
        else if (recessedFold) { red = -3; green = -3; blue = -2; }
      }
      const offset = (phase * TILE_CELLS + y * TILE_SIZE + x) * CHANNELS;
      WAX_FAMILY_RGB[offset] = red;
      WAX_FAMILY_RGB[offset + 1] = green;
      WAX_FAMILY_RGB[offset + 2] = blue;
    }
  }
}

function clampByte(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}
