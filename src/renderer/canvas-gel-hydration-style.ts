import { Material } from '../shared/materials';
import { GEL_PRESENTATION_STATE } from '../simulation/types';

/** Largest signed RGB response this presentation-only hydration layer may add. */
export const CANVAS_GEL_HYDRATION_MAX_CHANNEL_DELTA = 124;

/**
 * Decodes GEL's exact native absorbed-water reservoir for its semantic owner.
 * A dry GEL owner legitimately has state zero; all non-GEL owners are no-ops.
 */
export function canvasGelHydration(material: number, state: number): number {
  if (material !== Material.GEL) return 0;
  return Math.min(
    GEL_PRESENTATION_STATE.hydrationMaximum,
    state & GEL_PRESENTATION_STATE.hydrationMask,
  );
}

/**
 * Adds a restrained wet-gel colour/body cue over existing liquid styling.
 *
 * Native GEL begins orange and shifts toward a cool hydrated blue. This helper
 * expresses that transition as deterministic integer-world RGB arithmetic
 * only: it never samples, allocates, reads time, or changes alpha, support,
 * ownership, liquid reconstruction, or physics.
 */
export function applyCanvasGelHydrationStyle(
  output: Float32Array,
  material: number,
  state: number,
  x: number,
  y: number,
): void {
  const hydration = canvasGelHydration(material, state);
  if (hydration === 0) return;

  const moisture = hydration / GEL_PRESENTATION_STATE.hydrationMaximum;
  const worldX = Math.floor(x);
  const worldY = Math.floor(y);
  const localX = positiveModulo(worldX, 20) - 10;
  const localY = positiveModulo(worldY, 20) - 10;
  const radiusSquared = localX * localX + localY * localY;
  const swollenPocket = radiusSquared <= 18;
  const membrane = radiusSquared >= 34 && radiusSquared <= 58;
  const waterVein = positiveModulo(worldX * 3 - worldY * 2, 17) <= 1;
  const upperLip = membrane && localX + localY <= -3
    && positiveModulo(worldX + worldY, 5) <= 1;

  // Upstream GEL graphics move from (255,186,0) toward (69,71,173) as native
  // tmp reaches 100. Retain 62% of that authentic chroma excursion over our
  // already-lit body: this makes saturation unmistakable without replacing
  // the common meniscus/depth response with a flat palette colour.
  let red = hydration * (-223 / 120) * 0.62;
  let green = hydration * (-138 / 120) * 0.62;
  let blue = hydration * (208 / 120) * 0.62;
  if (swollenPocket) {
    red -= 3 * moisture;
    green -= 2 * moisture;
  } else if (waterVein) {
    red += 3 * moisture;
    green += 4 * moisture;
    blue += 2 * moisture;
  }
  if (upperLip) {
    red += 6 * moisture;
    green += 8 * moisture;
    blue += 2 * moisture;
  }

  output[0] = clampByte(output[0] + clampSignedDelta(red));
  output[1] = clampByte(output[1] + clampSignedDelta(green));
  output[2] = clampByte(output[2] + clampSignedDelta(blue));
}

function positiveModulo(value: number, divisor: number): number {
  const remainder = value % divisor;
  return remainder < 0 ? remainder + divisor : remainder;
}

function clampSignedDelta(value: number): number {
  return value < -CANVAS_GEL_HYDRATION_MAX_CHANNEL_DELTA
    ? -CANVAS_GEL_HYDRATION_MAX_CHANNEL_DELTA
    : value > CANVAS_GEL_HYDRATION_MAX_CHANNEL_DELTA
      ? CANVAS_GEL_HYDRATION_MAX_CHANNEL_DELTA
      : value;
}

function clampByte(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}
