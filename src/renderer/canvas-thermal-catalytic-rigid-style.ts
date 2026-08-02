import { Material } from '../shared/materials';

/** Exact native rigid owners with a depth-proven thermal/catalytic body pass. */
export const CANVAS_THERMAL_CATALYTIC_RIGID_MATERIALS = [
  Material.HEAC,
  Material.PTNM,
  Material.RSSS,
] as const;

export const enum CanvasThermalCatalyticRigidStyle {
  None = 0,
  HeatConductor = 1,
  Platinum = 2,
  Resist = 3,
}

const STYLE_BY_MATERIAL = new Uint8Array(256);
STYLE_BY_MATERIAL[Material.HEAC] = CanvasThermalCatalyticRigidStyle.HeatConductor;
STYLE_BY_MATERIAL[Material.PTNM] = CanvasThermalCatalyticRigidStyle.Platinum;
STYLE_BY_MATERIAL[Material.RSSS] = CanvasThermalCatalyticRigidStyle.Resist;

const DEPTH_START = 6;
const DEPTH_RANGE = 36;
const RELIEF_RANGE = 7;

/** Returns an exact owner style; every other material is an exact no-op. */
export function canvasThermalCatalyticRigidStyle(material: number): CanvasThermalCatalyticRigidStyle {
  if (!Number.isInteger(material) || material < 0 || material >= STYLE_BY_MATERIAL.length) {
    return CanvasThermalCatalyticRigidStyle.None;
  }
  return STYLE_BY_MATERIAL[material] as CanvasThermalCatalyticRigidStyle;
}

export function isCanvasThermalCatalyticRigidMaterial(material: number): boolean {
  return canvasThermalCatalyticRigidStyle(material) !== CanvasThermalCatalyticRigidStyle.None;
}

/**
 * Applies a static deep-body identity after common solid lighting.
 *
 * The optical depth and relief are supplied by the caller's existing solid
 * reconstruction. This performs no sampling/allocation and changes only RGB;
 * shallow contacts, holes, fine strokes, walls, alpha, and ownership stay on
 * the common renderer path.
 */
export function applyCanvasThermalCatalyticRigidCoreOptics(
  color: Float32Array,
  material: number,
  x: number,
  y: number,
  denseInterior: boolean,
  opticalDepthByte: number,
  relief: number,
  opticalDepthEnabled = true,
): void {
  const style = canvasThermalCatalyticRigidStyle(material);
  if (style === CanvasThermalCatalyticRigidStyle.None || !denseInterior
    || !opticalDepthEnabled || opticalDepthByte <= DEPTH_START) return;

  const depth = smoothstep((opticalDepthByte - DEPTH_START) / DEPTH_RANGE);
  const signedRelief = clamp(relief / RELIEF_RANGE, -1, 1) * depth;
  const crown = Math.max(0, signedRelief);
  const pocket = Math.max(0, -signedRelief);
  const worldX = Math.floor(x);
  const worldY = Math.floor(y);
  let red = 0;
  let green = 0;
  let blue = 0;

  if (style === CanvasThermalCatalyticRigidStyle.HeatConductor) {
    // HEAC: restrained heat-channel lamellae, with warm depth absorption.
    const channel = positiveModulo(worldX * 3 + worldY * 2, 17) === 0;
    const heatPin = positiveModulo(worldX - worldY * 4, 31) === 0;
    red += 4 * crown - 3 * pocket + (channel ? 3 * depth : 0);
    green -= 2 * depth + (heatPin ? depth : 0);
    blue -= 3 * depth + (channel ? depth : 0);
  } else if (style === CanvasThermalCatalyticRigidStyle.Platinum) {
    // PTNM: cool catalytic planes with infrequent neutral active sites.
    const plane = positiveModulo(worldX + worldY * 2, 19) <= 1;
    const site = positiveModulo(worldX * 5 - worldY * 3, 43) === 0;
    red += crown * 2 - pocket * 2 - (plane ? depth : 0);
    green += crown * 3 - pocket + (site ? depth : 0);
    blue += crown * 5 - pocket + (plane ? 2 * depth : 0) + (site ? depth : 0);
  } else {
    // RSSS: fused resist film keeps its existing surface grammar and receives
    // only a deep, low-frequency layer below that surface treatment.
    const seam = positiveModulo(worldX * 2 - worldY * 3, 23) === 0;
    const inclusion = positiveModulo(worldX * 7 + worldY, 47) === 0;
    red += 2 * crown - 4 * pocket + (inclusion ? 2 * depth : 0);
    green -= 3 * depth + (seam ? depth : 0);
    blue -= 3 * depth + (seam ? depth : 0);
  }

  color[0] = clampByte(color[0] + clamp(red, -12, 12));
  color[1] = clampByte(color[1] + clamp(green, -12, 12));
  color[2] = clampByte(color[2] + clamp(blue, -12, 12));
}

function smoothstep(value: number): number {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function positiveModulo(value: number, divisor: number): number {
  const remainder = value % divisor;
  return remainder < 0 ? remainder + divisor : remainder;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return value < minimum ? minimum : value > maximum ? maximum : value;
}

function clampByte(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}
