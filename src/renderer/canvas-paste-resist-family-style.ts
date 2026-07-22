import { Material } from '../shared/materials';
import { RenderPhase } from './render-profile';

const TILE_SHIFT = 5;
const TILE_SIZE = 1 << TILE_SHIFT;
const TILE_MASK = TILE_SIZE - 1;
const TILE_CELLS = TILE_SIZE * TILE_SIZE;
const CHANNELS = 3;
const FAMILY_COUNT = 2;
const PHASE_COUNT = 2;

const enum PasteResistFamily {
  Paste = 0,
  Resist = 1,
}

/** Signed RGB grammar shared across both native liquid/solid phase pairs. */
const PASTE_RESIST_FAMILY_RGB = new Int8Array(
  FAMILY_COUNT * PHASE_COUNT * TILE_CELLS * CHANNELS,
);

buildPasteResistFamilyLookup();

/** Module-static bytes; independent of world size and presentation scale. */
export const CANVAS_PASTE_RESIST_FAMILY_LOOKUP_BYTES =
  PASTE_RESIST_FAMILY_RGB.byteLength;

export function isPasteResistFamilyMaterial(material: number): boolean {
  return material === Material.PSTE || material === Material.PSTS
    || material === Material.RSST || material === Material.RSSS;
}

/**
 * Returns one signed channel from the shared 32-cell family topology.
 *
 * Each native phase pair keeps the same strata/weave locations. Phase changes
 * only their optical response, so pressure hardening or carrier-driven resist
 * conversion remains visually continuous without sampling simulation state.
 */
export function canvasPasteResistFamilyMotifDelta(
  material: number,
  phase: RenderPhase.Solid | RenderPhase.Liquid,
  x: number,
  y: number,
  channel: 0 | 1 | 2,
): number {
  const family = pasteResistFamily(material);
  if (family < 0) return 0;
  const phaseIndex = phase === RenderPhase.Liquid ? 1 : 0;
  const cell = ((Math.floor(y) & TILE_MASK) << TILE_SHIFT)
    | (Math.floor(x) & TILE_MASK);
  return PASTE_RESIST_FAMILY_RGB[
    ((family * PHASE_COUNT + phaseIndex) * TILE_CELLS + cell) * CHANNELS + channel
  ];
}

/** Applies one solid-family motif directly; liquid composition supplies depth scaling. */
export function applyCanvasPasteResistFamilyMorphology(
  output: Float32Array,
  material: number,
  phase: RenderPhase.Solid | RenderPhase.Liquid,
  x: number,
  y: number,
): void {
  if (!isPasteResistFamilyMaterial(material)) return;
  output[0] = clampByte(
    output[0] + canvasPasteResistFamilyMotifDelta(material, phase, x, y, 0),
  );
  output[1] = clampByte(
    output[1] + canvasPasteResistFamilyMotifDelta(material, phase, x, y, 1),
  );
  output[2] = clampByte(
    output[2] + canvasPasteResistFamilyMotifDelta(material, phase, x, y, 2),
  );
}

function pasteResistFamily(material: number): PasteResistFamily | -1 {
  if (material === Material.PSTE || material === Material.PSTS) {
    return PasteResistFamily.Paste;
  }
  if (material === Material.RSST || material === Material.RSSS) {
    return PasteResistFamily.Resist;
  }
  return -1;
}

function buildPasteResistFamilyLookup(): void {
  for (let family = 0; family < FAMILY_COUNT; family++) {
    for (let phase = 0; phase < PHASE_COUNT; phase++) {
      for (let y = 0; y < TILE_SIZE; y++) for (let x = 0; x < TILE_SIZE; x++) {
        let red = 0;
        let green = 0;
        let blue = 0;

        const localX = (x & 15) - 8;
        const localY = (y & 15) - 8;
        const radiusSquared = localX * localX + localY * localY;
        if (family === PasteResistFamily.Paste) {
          // Hydrated and hardened paste retain one staggered sediment lattice.
          // The rounded pocket reads as a soft colloid in liquid and as a
          // compressed inclusion once pressure converts the body to PSTS.
          const layer = (y + Math.floor(x / 8) * 2) & 7;
          const seam = layer < 2;
          const pocket = radiusSquared >= 18 && radiusSquared <= 36;
          if (phase === 1) {
            if (seam) { red = 6; green = 5; blue = 3; }
            else if (pocket) { red = -3; green = -2; blue = 1; }
            else { red = 1; green = 0; blue = 2; }
          } else if (seam) {
            red = -7; green = -6; blue = -4;
          } else if (pocket) {
            red = 6; green = 4; blue = 2;
          } else {
            red = 1; green = 0; blue = 2;
          }
        } else {
          // Resist uses one crossed polymer weave. Liquid RSST keeps softer
          // ribbons; solid RSSS locks the same rails and nodes into a laminate.
          const rising = (x * 2 + y) % 16 < 2;
          const falling = positiveModulo(x - y * 2, 16) < 2;
          const node = radiusSquared <= 9;
          const junction = rising && falling;
          if (phase === 1) {
            if (node) { red = 10; green = 3; blue = -3; }
            else if (junction) { red = 12; green = 2; blue = -2; }
            else if (rising) { red = 7; green = 2; blue = -2; }
            else if (falling) { red = 5; green = -2; blue = 2; }
            else { red = 2; green = -1; blue = -1; }
          } else if (node) {
            red = 13; green = 4; blue = -4;
          } else if (junction) {
            red = 14; green = 3; blue = -3;
          } else if (rising) {
            red = 10; green = 2; blue = -4;
          } else if (falling) {
            red = 7; green = -4; blue = 2;
          } else {
            red = 1; green = -1; blue = -2;
          }
        }

        const offset = (
          (family * PHASE_COUNT + phase) * TILE_CELLS + y * TILE_SIZE + x
        ) * CHANNELS;
        PASTE_RESIST_FAMILY_RGB[offset] = red;
        PASTE_RESIST_FAMILY_RGB[offset + 1] = green;
        PASTE_RESIST_FAMILY_RGB[offset + 2] = blue;
      }
    }
  }
}

function positiveModulo(value: number, divisor: number): number {
  const remainder = value % divisor;
  return remainder < 0 ? remainder + divisor : remainder;
}

function clampByte(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}
