import { RENDER_OPTICS_CLASS_COUNT, RenderOptics } from './render-optics';

const LIGHT_X = 0.48;
const LIGHT_Y = 0.68;
const MAX_RESPONSE = 0.065;

// Key-light transmission followed by shadow absorption. The values are kept
// deliberately restrained: they tint the existing analytic bevel instead of
// painting a second material colour over it.
const KEY = new Float32Array([
  0.92, 0.86, 0.72, // Default
  0.70, 0.90, 1.00, // Aqueous (defensive; matter callers exclude liquids)
  1.00, 0.84, 0.58, // Oily
  0.70, 1.00, 0.74, // Corrosive
  1.00, 0.70, 0.48, // Molten
  0.84, 0.86, 0.90, // SootyGas
  0.78, 0.90, 1.00, // CleanGas
  1.00, 0.82, 0.56, // RoughGranular
  0.76, 0.91, 1.00, // SmoothRigid
  0.82, 1.00, 0.66, // Organic
  0.60, 0.88, 1.00, // Device
  0.62, 1.00, 0.72, // Radioactive
  0.70, 0.90, 1.00, // TranslucentRigid
  0.72, 0.92, 1.00, // CrystallineGranular
  0.78, 0.72, 0.62, // SootyGranular
  1.00, 0.78, 0.42, // MetallicGranular
  0.62, 0.90, 1.00, // CryogenicLiquid (defensive; matter callers exclude liquids)
  1.00, 0.98, 0.94, // MetallicLiquid
  0.82, 0.92, 1.00, // ViscousLiquid
  0.00, 0.00, 0.00, // Cellular retains its historical zero-filled slot
  0.76, 0.91, 1.00, // MetallicRigid inherits SmoothRigid in permissive Canvas
]);

const SHADOW = new Float32Array([
  0.86, 0.70, 0.48,
  0.90, 0.72, 0.50,
  0.72, 0.62, 0.50,
  0.74, 0.62, 0.42,
  0.72, 0.56, 0.42,
  0.82, 0.76, 0.68,
  0.90, 0.76, 0.58,
  0.72, 0.62, 0.50,
  0.95, 0.72, 0.44,
  0.78, 0.66, 0.45,
  0.96, 0.70, 0.38,
  0.74, 0.62, 0.42,
  0.90, 0.72, 0.50,
  0.86, 0.72, 0.62,
  0.92, 0.86, 0.78,
  0.82, 0.70, 0.60,
  0.78, 0.86, 1.00,
  0.58, 0.62, 0.70,
  0.70, 0.64, 0.58,
  0.00, 0.00, 0.00,
  0.95, 0.72, 0.44,
]);

/** Signed analytic key/fill response; dense cores and empty support are exact no-ops. */
export function canvasSurfaceChromaResponse(
  density: number,
  gradientX: number,
  gradientY: number,
  optics: number,
): number {
  if (density <= 0.02 || density >= 0.98) return 0;
  const gradientLengthSquared = gradientX * gradientX + gradientY * gradientY;
  if (gradientLengthSquared <= 1e-8) return 0;
  const contourBand = smoothstep(0.02, 0.42, density)
    * (1 - smoothstep(0.58, 0.98, density));
  if (contourBand <= 0) return 0;
  const directional = Math.max(-1, Math.min(1,
    (gradientX * LIGHT_X + gradientY * LIGHT_Y) / Math.sqrt(gradientLengthSquared),
  ));
  const familyGain = optics === RenderOptics.TranslucentRigid ? 1
    : optics === RenderOptics.SmoothRigid || optics === RenderOptics.Cellular
      || optics === RenderOptics.MetallicRigid ? 0.94
    : optics === RenderOptics.Device ? 0.90
    : optics === RenderOptics.Radioactive ? 0.86
    : optics === RenderOptics.Organic ? 0.82
    : optics === RenderOptics.CrystallineGranular ? 0.98
    : optics === RenderOptics.SootyGranular ? 0.58
    : optics === RenderOptics.MetallicGranular ? 1
    : optics === RenderOptics.RoughGranular ? 0.92
    : 0.78;
  return Math.max(-MAX_RESPONSE, Math.min(
    MAX_RESPONSE, directional * contourBand * MAX_RESPONSE * familyGain,
  ));
}

/** Applies the signed family tint to RGB only; alpha and support remain untouched. */
export function applyCanvasSurfaceChroma(
  target: Uint8ClampedArray,
  offset: number,
  response: number,
  optics: number,
): void {
  if (response === 0) return;
  const family = Math.max(0, Math.min(RENDER_OPTICS_CLASS_COUNT - 1, optics | 0));
  const table = response > 0 ? KEY : SHADOW;
  // Canvas starts from the already-quantized one-cell material plane, while
  // WebGL applies the same shell before its final float composition. This
  // small fixed exposure match keeps the visible response in backend parity.
  const amount = response > 0 ? response * 1.55 : -response * 1.15;
  for (let channel = 0; channel < 3; channel++) {
    const base = target[offset + channel];
    const tint = table[family * 3 + channel];
    target[offset + channel] = response > 0
      ? base + (255 - base) * tint * amount
      : base * (1 - tint * amount);
  }
}

function smoothstep(start: number, end: number, value: number): number {
  const normalized = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return normalized * normalized * (3 - 2 * normalized);
}
