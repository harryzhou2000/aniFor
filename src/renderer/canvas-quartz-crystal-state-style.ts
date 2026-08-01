import { Material } from '../shared/materials';
import { QUARTZ_PRESENTATION_STATE } from '../simulation/types';

/** Largest signed channel contribution of the native crystal-state overlay. */
export const CANVAS_QUARTZ_CRYSTAL_STATE_MAX_CHANNEL_DELTA = 80;

/**
 * Decodes upstream PQRT/QRTZ `tmp2` only for its exact public owners.
 * Zero is a legitimate, darker seeded crystal state; unrelated owners are
 * strict no-ops even if the shared presentation word contains matching bits.
 */
export function canvasQuartzCrystalSpeckle(material: number, state: number): number | undefined {
  if (material !== Material.Quartz && material !== Material.QRTZ) return undefined;
  return Math.min(
    QUARTZ_PRESENTATION_STATE.speckleMaximum,
    state & QUARTZ_PRESENTATION_STATE.speckleMask,
  );
}

/**
 * Adds the native crystal-seed brightness response after common material
 * lighting. This is deterministic RGB-only arithmetic: alpha, topology,
 * reconstruction, physics, and native tmp/life data remain untouched.
 */
export function applyCanvasQuartzCrystalStateStyle(
  output: Float32Array,
  material: number,
  state: number,
): void {
  const speckle = canvasQuartzCrystalSpeckle(material, state);
  if (speckle === undefined) return;

  // Preserve the upstream signed progression while leaving headroom for the
  // shared styled body. QRTZ is a cooler solid product, so its blue lift is
  // fractionally stronger without inventing a separate mutable state.
  const signed = (speckle - 5) * 16;
  const solid = material === Material.QRTZ;
  const red = signed * (solid ? 0.29 : 0.33);
  const green = signed * (solid ? 0.34 : 0.31);
  const blue = signed * (solid ? 0.47 : 0.38);
  output[0] = clampByte(output[0] + clampSigned(red));
  output[1] = clampByte(output[1] + clampSigned(green));
  output[2] = clampByte(output[2] + clampSigned(blue));
}

function clampSigned(value: number): number {
  return Math.max(-CANVAS_QUARTZ_CRYSTAL_STATE_MAX_CHANNEL_DELTA,
    Math.min(CANVAS_QUARTZ_CRYSTAL_STATE_MAX_CHANNEL_DELTA, value));
}

function clampByte(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}
