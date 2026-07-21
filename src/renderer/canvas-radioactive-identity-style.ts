import { Material } from '../shared/materials';

const MAX_CHANNEL_DELTA = 12;

/** Exact-owner radioactive powder/solid identities not covered by fluid fields. */
export const RADIOACTIVE_BODY_STYLE_BY_MATERIAL = new Uint8Array(256);
RADIOACTIVE_BODY_STYLE_BY_MATERIAL[Material.BVBR] = 1;
RADIOACTIVE_BODY_STYLE_BY_MATERIAL[Material.PLUT] = 2;
RADIOACTIVE_BODY_STYLE_BY_MATERIAL[Material.POLO] = 3;
RADIOACTIVE_BODY_STYLE_BY_MATERIAL[Material.SING] = 4;
RADIOACTIVE_BODY_STYLE_BY_MATERIAL[Material.URAN] = 5;
RADIOACTIVE_BODY_STYLE_BY_MATERIAL[Material.ISZS] = 6;
RADIOACTIVE_BODY_STYLE_BY_MATERIAL[Material.VIBR] = 7;
export const CANVAS_RADIOACTIVE_IDENTITY_LOOKUP_BYTES =
  RADIOACTIVE_BODY_STYLE_BY_MATERIAL.byteLength;

export function canvasRadioactiveBodyStyle(material: number): number {
  return material >= 0 && material < RADIOACTIVE_BODY_STYLE_BY_MATERIAL.length
    ? RADIOACTIVE_BODY_STYLE_BY_MATERIAL[material] : 0;
}

/** Adds one stable RGB-only isotope/material structure to authoritative matter. */
export function applyCanvasRadioactiveIdentityStyle(
  rgb: Float32Array,
  material: number,
  x: number,
  y: number,
): void {
  const style = canvasRadioactiveBodyStyle(material);
  if (style === 0) return;
  let red = 0;
  let green = 0;
  let blue = 0;
  if (style === 1) {
    // BVBR: charged broken-cell facets.
    const crack = ((x * 3 + y * 5) & 15) <= 1 || ((x - y * 2) & 15) === 0;
    red = crack ? -3 : 1; green = crack ? 10 : 2; blue = crack ? 7 : 0;
  } else if (style === 2) {
    // PLUT: sparse hot fissile inclusions in a darker ore body.
    const inclusion = (x * 17 + y * 31 + Math.floor(x * y * 0.125) + material) & 31;
    red = inclusion < 4 ? 10 : -3;
    green = inclusion < 4 ? 8 : 1;
    blue = inclusion < 4 ? -2 : -1;
  } else if (style === 3) {
    // POLO: larger decay pits with a pale energetic rim.
    const localX = (x & 7) - 4;
    const localY = (y & 7) - 4;
    const radiusSquared = localX * localX + localY * localY;
    const rim = radiusSquared >= 6 && radiusSquared <= 11;
    red = rim ? 8 : -2; green = rim ? 10 : 1; blue = rim ? 3 : -1;
  } else if (style === 4) {
    // SING: absorptive centres enclosed by a cold accretion ring.
    const localX = (x & 15) - 8;
    const localY = (y & 15) - 8;
    const radiusSquared = localX * localX + localY * localY;
    const ring = radiusSquared >= 35 && radiusSquared <= 58;
    red = ring ? 2 : -8; green = ring ? 5 : -7; blue = ring ? 11 : -5;
  } else if (style === 5) {
    // URAN: broad diagonal ore striation.
    const band = (x * 2 + y + (y >> 3)) & 15;
    red = band <= 3 ? 6 : -3; green = band <= 3 ? 9 : 1; blue = band <= 3 ? -2 : 0;
  } else if (style === 6) {
    // ISZS: crystalline decay facets paired with liquid ISOZ rings.
    const localX = (x & 7) - 4;
    const localY = (y & 7) - 4;
    const facet = Math.abs(localX) + Math.abs(localY);
    red = facet === 3 || facet === 4 ? 9 : -2;
    green = facet === 3 || facet === 4 ? -2 : 3;
    blue = facet === 3 || facet === 4 ? 11 : 4;
  } else {
    // VIBR: orthogonal fracture lattice with charged junctions.
    const horizontal = (y & 7) === 0;
    const vertical = ((x + (y >> 3) * 3) & 7) === 0;
    red = horizontal || vertical ? -2 : 1;
    green = horizontal || vertical ? 11 : 2;
    blue = horizontal && vertical ? 12 : horizontal || vertical ? 6 : 0;
  }
  rgb[0] += clampDelta(red);
  rgb[1] += clampDelta(green);
  rgb[2] += clampDelta(blue);
}

function clampDelta(value: number): number {
  return Math.max(-MAX_CHANNEL_DELTA, Math.min(MAX_CHANNEL_DELTA, value));
}
