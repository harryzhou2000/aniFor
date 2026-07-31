import { Material } from '../shared/materials';

/**
 * Exact default-optics Field owners whose normal-detail material language must
 * remain recognisable in the Canvas recovery presenter as well as WebGL.
 * Zero in the lookup means the generic Field wave remains authoritative.
 */
export const CANVAS_FIELD_PROFILE_IDENTITY_MATERIALS = [
  Material.BHOL,
  Material.NBHL,
  Material.VOID,
  Material.PRTI,
  Material.PRTO,
  Material.TRON,
  Material.NWHL,
  Material.WHOL,
] as const;

export const CANVAS_FIELD_PROFILE_IDENTITY_BY_MATERIAL = new Uint8Array(256);
for (let style = 1; style <= CANVAS_FIELD_PROFILE_IDENTITY_MATERIALS.length; style++) {
  CANVAS_FIELD_PROFILE_IDENTITY_BY_MATERIAL[
    CANVAS_FIELD_PROFILE_IDENTITY_MATERIALS[style - 1]
  ] = style;
}

// Match the normal WebGL material layer's restrained static cadence without
// bringing a clock, field, allocation, alpha, or topology decision to Canvas.
const FIELD_IDENTITY_GAIN = 0.74;

export function canvasFieldProfileIdentityStyle(material: number): number {
  return Number.isInteger(material) && material >= 0
    && material < CANVAS_FIELD_PROFILE_IDENTITY_BY_MATERIAL.length
    ? CANVAS_FIELD_PROFILE_IDENTITY_BY_MATERIAL[material] : 0;
}

/**
 * Adds a compact aperture/rail/void grammar to caller-owned RGB only.
 *
 * The exact owner is the guard: role, configured-source, temperature, and
 * native-state decals deliberately remain later independent presentation
 * layers. World-cell coordinates keep the result stable across 1x–4x backing
 * scales and Canvas recovery rebuilds.
 */
export function applyCanvasFieldProfileIdentityStyle(
  color: Float32Array,
  material: number,
  x: number,
  y: number,
): void {
  if (canvasFieldProfileIdentityStyle(material) === 0) return;
  const cellX = Math.floor(x);
  const cellY = Math.floor(y);
  const fieldBand = 1 - Math.abs(positiveModulo(cellX + cellY * 0.62 + material * 0.37, 12) / 6 - 1);
  const fieldCross = positiveModulo(cellX * 3 + cellY * 5 + material, 13) === 0 ? 1 : 0;
  let red = -3 * (fieldBand - 0.46) * 0.72 + fieldCross * 0.30;
  let green = 4 * (fieldBand - 0.46) * 0.72 + fieldCross * 0.90;
  let blue = 10 * (fieldBand - 0.46) * 0.72 + fieldCross * 1.80;
  const localX = positiveModulo(cellX, 16) - 7.5;
  const localY = positiveModulo(cellY, 16) - 7.5;
  const radiusSquared = localX * localX + localY * localY;
  const apertureCore = 1 - smoothstep(3, 26, radiusSquared);
  const apertureRing = smoothstep(13, 32, radiusSquared) * (1 - smoothstep(45, 74, radiusSquared));
  const spoke = positiveModulo(cellX * 5 - cellY * 3 + material, 11) === 0 ? 1 : 0;

  if (material === Material.TRON) {
    const rail = Math.max(
      Number(positiveModulo(cellX + cellY * 2, 7) === 0),
      Number(positiveModulo(cellX * 2 - cellY, 11) === 0),
    );
    red = 2 * (0.26 + rail * 0.74) - 2 * fieldBand;
    green = 19 * (0.26 + rail * 0.74) + 4 * fieldBand;
    blue = -7 * (0.26 + rail * 0.74) + fieldBand;
  } else if (material === Material.PRTI || material === Material.PRTO) {
    const key = material === Material.PRTI ? [17, 5, -3] : [-4, 8, 18];
    const gain = apertureRing * 0.86 + spoke * 0.24;
    red = key[0] * gain - 4 * apertureCore * 0.38;
    green = key[1] * gain - 3 * apertureCore * 0.38;
    blue = key[2] * gain - 5 * apertureCore * 0.38;
  } else if (material === Material.BHOL || material === Material.NBHL || material === Material.NWHL) {
    const rim = material === Material.NWHL ? [15, 1, -2] : [5, 1, 13];
    const gain = apertureRing * 0.76 + spoke * 0.16;
    red = rim[0] * gain - 5 * apertureCore * 0.56;
    green = rim[1] * gain - 4 * apertureCore * 0.56;
    blue = rim[2] * gain - 6 * apertureCore * 0.56;
  } else { // VOID / WHOL
    const gain = apertureRing * 0.74 + spoke * 0.32;
    red = 5 * gain - 2 * apertureCore * 0.16;
    green = 13 * gain - apertureCore * 0.16;
    blue = 18 * gain - 2 * apertureCore * 0.16;
  }
  color[0] = clampByte(color[0] + red * FIELD_IDENTITY_GAIN);
  color[1] = clampByte(color[1] + green * FIELD_IDENTITY_GAIN);
  color[2] = clampByte(color[2] + blue * FIELD_IDENTITY_GAIN);
}

function positiveModulo(value: number, divisor: number): number {
  const remainder = value % divisor;
  return remainder < 0 ? remainder + divisor : remainder;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const progress = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return progress * progress * (3 - 2 * progress);
}

function clampByte(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}
