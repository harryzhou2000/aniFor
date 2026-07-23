import { Material } from '../shared/materials';
import {
  PLNT_PRESENTATION_STATE,
  SEED_PRESENTATION_STATE,
} from '../simulation/types';

const SEED_MAX_CHANNEL_DELTA = 24;
const PLANT_MAX_CHANNEL_DELTA = 64;
const SEED_GERMINATION_VISUAL_MAXIMUM = 200;

/**
 * Native TPT leaf palette selected by the three inherited cyan/magenta/yellow
 * colour groups. Kept flat and module-static for a direct GLSL translation.
 */
export const TPT_TREE_LEAF_PALETTE = new Uint8Array([
  243, 246, 244, // white
  255, 223, 50,  // yellow
  255, 183, 197, // pink
  250, 0, 25,    // red
  128, 206, 196, // cyan / light blue
  127, 255, 0,   // bright green
  0, 74, 178,    // blue
  12, 172, 0,    // usual PLNT green
]);

/** Mirrors upstream's boolean cyan/magenta/yellow-group palette selection. */
export function tptTreeLeafPaletteIndex(inheritedColour: number): number {
  const colour = inheritedColour & 0x3f;
  const cyan = (colour & 0x30) === 0 ? 0 : 1;
  const magenta = (colour & 0x0c) === 0 ? 0 : 1;
  const yellow = (colour & 0x03) === 0 ? 0 : 1;
  return cyan * 4 + magenta * 2 + yellow;
}

/**
 * Adds exact-owner native SEED/PLNT lifecycle cues to an already styled body.
 *
 * SEED water deepens and cools the husk, while its supported-soil timer opens a
 * stable germination seam. PLNT with native tree/genome payload approaches the
 * upstream inherited leaf palette and receives direction/phase-anchored veins
 * and active growth tips. Authoritative dormant SEED (state zero) and ordinary
 * presence-only PLNT are exact no-ops.
 *
 * This helper changes RGB only and performs no neighbour sample, allocation,
 * clock lookup, or output-scale-dependent work.
 */
export function applyCanvasBotanicalLifecycleStyle(
  output: Float32Array,
  material: number,
  state: number,
  x: number,
  y: number,
): void {
  if (material === Material.SEED) {
    applySeedLifecycleStyle(output, state, x, y);
  } else if (material === Material.Plant) {
    applyPlantLifecycleStyle(output, state, x, y);
  }
}

function applySeedLifecycleStyle(
  output: Float32Array,
  state: number,
  x: number,
  y: number,
): void {
  if (state === 0) return;

  const water = state & SEED_PRESENTATION_STATE.waterMask;
  const timer = (state & SEED_PRESENTATION_STATE.germinationMask)
    >>> SEED_PRESENTATION_STATE.germinationShift;
  const moisture = water / SEED_PRESENTATION_STATE.waterMaximum;
  const germination = Math.min(timer, SEED_GERMINATION_VISUAL_MAXIMUM)
    / SEED_GERMINATION_VISUAL_MAXIMUM;
  const swelling = Math.min(1, water / 4);
  const worldX = Math.floor(x);
  const worldY = Math.floor(y);
  const localX = positiveModulo(worldX, 11) - 5;
  const localY = positiveModulo(worldY, 11) - 5;
  const radiusSquared = localX * localX + localY * localY;
  const swollenHusk = radiusSquared >= 12 && radiusSquared <= 25;
  const openingSeam = localX === 0 && localY >= -3 && localY <= 3;
  const rootTip = localX >= -1 && localX <= 1 && localY >= 2 && localY <= 4;

  let red = -12 * moisture;
  let green = -9 * moisture;
  let blue = 5 * moisture;
  if (swollenHusk) {
    red += 4 * swelling;
    green += 7 * swelling;
    blue += 6 * swelling;
  }
  if (openingSeam) {
    red += 5 * germination;
    green += 16 * germination;
    blue += 3 * germination;
  }
  if (rootTip) {
    red -= 2 * germination;
    green += 7 * germination;
    blue += 5 * germination;
  }

  output[0] += clampSignedDelta(red, SEED_MAX_CHANNEL_DELTA);
  output[1] += clampSignedDelta(green, SEED_MAX_CHANNEL_DELTA);
  output[2] += clampSignedDelta(blue, SEED_MAX_CHANNEL_DELTA);
}

function applyPlantLifecycleStyle(
  output: Float32Array,
  state: number,
  x: number,
  y: number,
): void {
  if ((state & PLNT_PRESENTATION_STATE.presentMask) === 0) return;
  const nativePayload = state & ~PLNT_PRESENTATION_STATE.presentMask;
  if (nativePayload === 0) return;

  const tree = (state & PLNT_PRESENTATION_STATE.treeMask) !== 0;
  // Upstream selects the inherited eight-colour canopy only for tree-grown
  // PLNT. Ordinary hydrated/active PLNT must retain its normal plant body.
  if (!tree) return;
  const phase = (state & PLNT_PRESENTATION_STATE.phaseMask)
    >>> PLNT_PRESENTATION_STATE.phaseShift;
  const direction = (state & PLNT_PRESENTATION_STATE.directionMask)
    >>> PLNT_PRESENTATION_STATE.directionShift;
  const inheritedColour = (state & PLNT_PRESENTATION_STATE.inheritedColourMask)
    >>> PLNT_PRESENTATION_STATE.inheritedColourShift;
  const hydrationClass = (state & PLNT_PRESENTATION_STATE.hydrationClassMask)
    >>> PLNT_PRESENTATION_STATE.hydrationClassShift;
  const active = (state & PLNT_PRESENTATION_STATE.activeGrowthMask) !== 0;
  const paletteIndex = tptTreeLeafPaletteIndex(inheritedColour);
  const paletteOffset = paletteIndex * 3;
  const worldX = Math.floor(x);
  const worldY = Math.floor(y);
  const vein = positiveModulo(
    worldX * (direction + 1) + worldY * (8 - direction) + phase * 3,
    13,
  ) <= 1;
  const growthTip = active && positiveModulo(
    worldX * (8 - direction) - worldY * (direction + 1) + phase * 5,
    17,
  ) <= 1;
  const blend = 0.42;
  const hydration = hydrationClass / 3;
  let variationRed = -2 * hydration;
  let variationGreen = -1 * hydration;
  let variationBlue = 4 * hydration;
  if (vein) {
    variationRed -= 4;
    variationGreen += 7;
    variationBlue -= 3;
  }
  if (growthTip) {
    variationRed += 7;
    variationGreen += 11;
    variationBlue += 4;
  }

  const sourceRed = output[0];
  const sourceGreen = output[1];
  const sourceBlue = output[2];
  output[0] = clampByte(sourceRed + clampSignedDelta(
    (TPT_TREE_LEAF_PALETTE[paletteOffset] - sourceRed) * blend + variationRed,
    PLANT_MAX_CHANNEL_DELTA,
  ));
  output[1] = clampByte(sourceGreen + clampSignedDelta(
    (TPT_TREE_LEAF_PALETTE[paletteOffset + 1] - sourceGreen) * blend + variationGreen,
    PLANT_MAX_CHANNEL_DELTA,
  ));
  output[2] = clampByte(sourceBlue + clampSignedDelta(
    (TPT_TREE_LEAF_PALETTE[paletteOffset + 2] - sourceBlue) * blend + variationBlue,
    PLANT_MAX_CHANNEL_DELTA,
  ));
}

function positiveModulo(value: number, divisor: number): number {
  const remainder = value % divisor;
  return remainder < 0 ? remainder + divisor : remainder;
}

function clampSignedDelta(value: number, maximum: number): number {
  return value < -maximum ? -maximum : value > maximum ? maximum : value;
}

function clampByte(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}
