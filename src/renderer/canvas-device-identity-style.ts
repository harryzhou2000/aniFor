import { Material } from '../shared/materials';

/**
 * Exact native transport/actuator owners with a compact Canvas body language.
 *
 * WebGL has richer analytic forms for these, but Canvas must not regress to a
 * flat generic Device material when it becomes the recovery presenter.  The
 * tables stay module-static and the helpers only alter the RGB entries of the
 * caller-owned reusable colour vector.
 */
export const CANVAS_MECHANISM_BODY_MATERIALS = [
  Material.DMG,
  Material.FRME,
  Material.PIPE,
  Material.PSTN,
  Material.RPEL,
  Material.GPMP,
  Material.PPIP,
  Material.PUMP,
  Material.PVOD,
  Material.STOR,
] as const;

/** Exact native electronics/control owners with their own static grammar. */
export const CANVAS_ELECTRONIC_BODY_MATERIALS = [
  Material.ARAY,
  Material.BTRY,
  Material.DRAY,
  Material.EMP,
  Material.ETRD,
  Material.INSL,
  Material.INST,
  Material.INWR,
  Material.NSCN,
  Material.NTCT,
  Material.PSCN,
  Material.PTCT,
  Material.SWCH,
  Material.TESC,
  Material.TUNG,
  Material.WIFI,
  Material.WIRE,
  Material.DLAY,
  Material.HSWC,
  Material.LCRY,
] as const;

export const CANVAS_MECHANISM_BODY_STYLE_BY_MATERIAL = new Uint8Array(256);
export const CANVAS_ELECTRONIC_BODY_STYLE_BY_MATERIAL = new Uint8Array(256);
for (let style = 1; style <= CANVAS_MECHANISM_BODY_MATERIALS.length; style++) {
  CANVAS_MECHANISM_BODY_STYLE_BY_MATERIAL[CANVAS_MECHANISM_BODY_MATERIALS[style - 1]] = style;
}
for (let style = 1; style <= CANVAS_ELECTRONIC_BODY_MATERIALS.length; style++) {
  CANVAS_ELECTRONIC_BODY_STYLE_BY_MATERIAL[CANVAS_ELECTRONIC_BODY_MATERIALS[style - 1]] = style;
}

// Match normal WebGL's body layer, whose established interior gain ranges from
// 0.58 to 1.00.  The Canvas fallback uses one restrained fixed point so its
// static device grammar remains legible without competing with later traits.
const CANVAS_DEVICE_IDENTITY_GAIN = 0.76;

export function canvasMechanismBodyStyle(material: number): number {
  return validStyle(CANVAS_MECHANISM_BODY_STYLE_BY_MATERIAL, material);
}

export function canvasElectronicBodyStyle(material: number): number {
  return validStyle(CANVAS_ELECTRONIC_BODY_STYLE_BY_MATERIAL, material);
}

/**
 * Adds a deterministic transport/actuator grammar to RGB only.
 *
 * Walls, emission, ownership, phase, opacity, support, and later simulation
 * traits are all caller-owned.  Coordinates are reduced to world cells, so the
 * result is stable across 1×–4× Canvas backing scales and recovery rebuilds.
 */
export function applyCanvasMechanismBodyIdentityStyle(
  color: Float32Array,
  material: number,
  x: number,
  y: number,
): void {
  if (canvasMechanismBodyStyle(material) === 0) return;
  const worldX = Math.floor(x);
  const worldY = Math.floor(y);
  let red = 0;
  let green = 0;
  let blue = 0;

  if (material === Material.PIPE || material === Material.PPIP) {
    const powered = material === Material.PPIP ? 1 : 0;
    const lumen = positiveModulo(worldX + worldY * 2 + powered, 9) === 0;
    const rail = positiveModulo(worldX * (2 + powered) + worldY * 3, 13) === 0;
    const junction = positiveModulo(worldX * 5 - worldY * 2 + powered, 31) === 0;
    if (lumen) { red -= 5; green -= 3; blue += 4; }
    if (rail) { red += 3; green += 7; blue += 11; }
    if (junction && powered) { red += 1; green += 4; blue += 8; }
  } else if (material === Material.GPMP || material === Material.PUMP) {
    const localX = positiveModulo(worldX, 18) / 18 - 0.5;
    const localY = positiveModulo(worldY, 18) / 18 - 0.5;
    const radius = Math.hypot(localX, localY);
    const ring = 1 - smoothstep(0.030, 0.070, Math.abs(radius - 0.29));
    const hub = 1 - smoothstep(0.09, 0.17, radius);
    const spoke = 1 - smoothstep(0.050, 0.115, Math.min(Math.abs(localX), Math.abs(localY)));
    const pumpGain = material === Material.PUMP ? 0.58 : 0.32;
    red += -3 * (ring * 0.82 + hub * 0.55) + 4 * spoke * pumpGain;
    green += 6 * (ring * 0.82 + hub * 0.55) + 7 * spoke * pumpGain;
    blue += 11 * (ring * 0.82 + hub * 0.55) + 10 * spoke * pumpGain;
  } else if (material === Material.PSTN || material === Material.FRME) {
    const frame = material === Material.FRME ? 1 : 0;
    const rib = positiveModulo(worldX * 2 + worldY + frame, 11) === 0;
    const seam = positiveModulo(worldX * 4 - worldY * 2 + frame, 35) === 0;
    const rail = positiveModulo(worldX + worldY * 3, 17) === 0;
    const bodyGain = 1 - frame * 0.38;
    if (rib) { red += 5 * bodyGain; green += 7 * bodyGain; blue += 10 * bodyGain; }
    if (seam) { red -= 5 * bodyGain; green -= 4 * bodyGain; blue -= 2 * bodyGain; }
    if (rail && frame) { red += 5; green += 3; }
  } else if (material === Material.RPEL) {
    const localX = positiveModulo(worldX, 20) / 20 - 0.5;
    const localY = positiveModulo(worldY, 20) / 20 - 0.5;
    const ring = 1 - smoothstep(0.025, 0.060, Math.abs(Math.hypot(localX, localY) - 0.33));
    const coil = positiveModulo(worldX + worldY * 3, 7) === 0;
    const seam = positiveModulo(worldX * 3 - worldY, 29) === 0;
    red += 3 * (ring + Number(coil) * 0.46) - 3 * Number(seam);
    green += 4 * (ring + Number(coil) * 0.46) - Number(seam);
    blue += 14 * (ring + Number(coil) * 0.46) - Number(seam);
  } else if (material === Material.PVOD || material === Material.STOR) {
    const storage = material === Material.STOR ? 1 : 0;
    const bay = positiveModulo(Math.floor(worldX / 3) + Math.floor(worldY / 3), 2) === 0;
    const rail = positiveModulo(worldX * 3 + worldY * 2 + storage, 17) === 0;
    const seam = positiveModulo(worldX * 5 - worldY + storage, 37) === 0;
    if (bay) { red -= 5; green -= 4; blue -= 2; }
    if (rail) { red += 4; green += 8; blue += 12; }
    if (seam && storage) { red += 4; green += 2; blue -= 2; }
  } else { // DMG
    const facet = positiveModulo(worldX * 2 + worldY * 3, 13) === 0;
    const crack = positiveModulo(worldX * 5 - worldY * 4, 31) === 0;
    if (facet) { red += 7; green += 4; blue -= 2; }
    if (crack) { red -= 6; green -= 4; blue -= 2; }
  }
  applyDelta(color, red, green, blue);
}

/**
 * Adds one compact exact-electronics signature to RGB only.
 *
 * This ports the normal composer's owner-local rail/node vocabulary without a
 * field, allocation, clock, blend, opacity, or topology decision.
 */
export function applyCanvasElectronicBodyIdentityStyle(
  color: Float32Array,
  material: number,
  x: number,
  y: number,
): void {
  const style = canvasElectronicBodyStyle(material);
  if (style === 0) return;
  const worldX = Math.floor(x);
  const worldY = Math.floor(y);
  const rail = positiveModulo(
    worldX * (1 + positiveModulo(style, 4))
      + worldY * (2 + positiveModulo(style, 3)) + style * 3,
    11 + positiveModulo(style, 5),
  ) === 0;
  const node = positiveModulo(
    worldX * (4 + positiveModulo(style, 3))
      - worldY * (2 + positiveModulo(style, 4)) + style * 7,
    29 + positiveModulo(style, 7),
  ) === 0;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (style < 4) {
    const beam = positiveModulo(worldX - worldY * (style === 2 ? 1 : 2), 9) <= 1;
    if (beam) { red += 8; green += 5; blue -= 3; }
    if (rail) { red += 3; green += 8; blue += 13; }
    if (node) { red -= 4; green -= 3; blue -= 1; }
  } else if (style < 6) {
    const ring = positiveModulo(Math.abs(worldX * 2 - worldY * 3) + style, 13) === 0;
    if (ring) { red += 4; green += 9; blue += 14; }
    if (node) { red += 8; green += 3; blue -= 2; }
    if (rail) { red -= 3; green -= 2; blue -= 1; }
  } else if (style < 9) {
    const slot = positiveModulo(worldX + worldY * 3 + style, 17) === 0;
    if (rail) { red -= 4; green += 2; blue += 8; }
    if (slot) { red += 5; green += 4; blue += 1; }
    if (node) { red += 2; green += 5; blue += 8; }
  } else if (style < 13) {
    const junction = positiveModulo(worldX * 2 + worldY * 5 + style, 19) === 0;
    const positivePolarity = positiveModulo(style, 2) === 0;
    if (junction) {
      if (positivePolarity) { red += 9; green -= 2; blue += 7; }
      else { red -= 3; green += 8; blue += 11; }
    }
    if (rail) { red += 3; green += 5; blue += 9; }
    if (node) { red -= 3; green -= 2; blue -= 1; }
  } else if (style < 17) {
    const coil = positiveModulo(worldX * 3 - worldY * 2 + style, 15) === 0;
    if (rail) { red += 6; green += 4; blue -= 2; }
    if (coil) { red += 2; green += 8; blue += 14; }
    if (node) { red -= 4; green -= 3; blue -= 1; }
  } else {
    const tap = positiveModulo(worldX + worldY * 4 + style, 21) === 0;
    if (rail) { red += 3; green += 8; blue += 13; }
    if (tap) { red += 7; green += 3; blue += 5; }
    if (node) { red -= 4; green -= 3; blue -= 1; }
  }
  applyDelta(color, red, green, blue);
}

function validStyle(table: Uint8Array, material: number): number {
  return Number.isInteger(material) && material >= 0 && material < table.length ? table[material] : 0;
}

function applyDelta(color: Float32Array, red: number, green: number, blue: number): void {
  color[0] = clampByte(color[0] + red * CANVAS_DEVICE_IDENTITY_GAIN);
  color[1] = clampByte(color[1] + green * CANVAS_DEVICE_IDENTITY_GAIN);
  color[2] = clampByte(color[2] + blue * CANVAS_DEVICE_IDENTITY_GAIN);
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
