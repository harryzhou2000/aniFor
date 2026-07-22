import { Material } from '../shared/materials';
import { RenderPhase } from './render-profile';
import { canvasVirusFamilyMotifDelta } from './canvas-virus-family-style';

const STYLE_COUNT = 17;
const TILE_SHIFT = 4;
const TILE_SIZE = 1 << TILE_SHIFT;
const TILE_MASK = TILE_SIZE - 1;
const TILE_CELLS = TILE_SIZE * TILE_SIZE;
const COLOR_CHANNELS = 3;
const MOTIF_CHANNELS = 4;
const NO_STYLE = 0;
const MAX_CHANNEL_DELTA = 12;

/**
 * Stable material-to-style ABI for the first authored gas identity tranche.
 * Zero means that the atmosphere texel receives no exact-species motif.
 */
export const GAS_IDENTITY_STYLE_BY_MATERIAL = new Uint8Array(256);
GAS_IDENTITY_STYLE_BY_MATERIAL[Material.Smoke] = 1;
GAS_IDENTITY_STYLE_BY_MATERIAL[Material.Steam] = 2;
GAS_IDENTITY_STYLE_BY_MATERIAL[Material.Gas] = 3;
GAS_IDENTITY_STYLE_BY_MATERIAL[Material.Oxygen] = 4;
GAS_IDENTITY_STYLE_BY_MATERIAL[Material.Hydrogen] = 5;
GAS_IDENTITY_STYLE_BY_MATERIAL[Material.CarbonDioxide] = 6;
GAS_IDENTITY_STYLE_BY_MATERIAL[Material.NobleGas] = 7;
GAS_IDENTITY_STYLE_BY_MATERIAL[Material.BOYL] = 8;
GAS_IDENTITY_STYLE_BY_MATERIAL[Material.CAUS] = 9;
GAS_IDENTITY_STYLE_BY_MATERIAL[Material.FOG] = 10;
GAS_IDENTITY_STYLE_BY_MATERIAL[Material.RFRG] = 11;
GAS_IDENTITY_STYLE_BY_MATERIAL[Material.CFLM] = 12;
GAS_IDENTITY_STYLE_BY_MATERIAL[Material.AMTR] = 13;
GAS_IDENTITY_STYLE_BY_MATERIAL[Material.WARP] = 14;
GAS_IDENTITY_STYLE_BY_MATERIAL[Material.BIZRG] = 15;
GAS_IDENTITY_STYLE_BY_MATERIAL[Material.MORT] = 16;
GAS_IDENTITY_STYLE_BY_MATERIAL[Material.VRSG] = 17;

/** Shared unsigned RGBA motif atlas; RGB stores signed deltas biased by 128. */
export const GAS_IDENTITY_MOTIF_TEXTURE_WIDTH = TILE_SIZE;
export const GAS_IDENTITY_MOTIF_TEXTURE_HEIGHT = STYLE_COUNT * TILE_SIZE;
export const GAS_IDENTITY_MOTIF_TEXTURE_BYTES = new Uint8Array(
  STYLE_COUNT * TILE_CELLS * MOTIF_CHANNELS,
);

// Dense-volume absorption is intentionally much smaller than the motif. The
// atmosphere's existing relief remains authoritative; these gains only let its
// signed slope and curvature reinforce the physical character of each gas.
const DENSITY_RGB = new Int8Array([
  -4, -4, -3, // Smoke: sooty absorption.
  1, 2, 3, // Steam: pale blue-white body.
  3, 2, -1, // Gas: warm fuel haze.
  0, 2, 3, // Oxygen: cool lifted volume.
  1, 1, 3, // Hydrogen: fine cool wisps.
  -3, -2, -1, // CO2: heavy muted pool.
  2, 1, 3, // Noble gas: violet shimmer.
  3, 0, -2, // BOYL: hot turbulent amber.
  -1, 3, -1, // CAUS: corrosive green haze.
  2, 2, 2, // FOG: neutral soft banks.
  -1, 2, 4, // RFRG: frosted cyan body.
  -1, 1, 4, // CFLM: cold blue flame.
  -4, -2, -4, // AMTR: absorptive void.
  2, -2, 3, // WARP: displaced violet shear.
  3, -2, 3, // BIZRG: angular prism colour.
  -2, -2, -2, // MORT: banded exhaust depth.
  3, -2, 3, // VRSG: magenta vesicle membrane.
]);

const RELIEF_GAIN = new Float32Array([
  7, 8, 9, 10, 8, 6, 9, 11, 7, 5, 10, 11, -5, 10, 8, 7, 8,
]);
const CURVATURE_GAIN = new Float32Array([
  10, 8, 9, 8, 7, 6, 10, 12, 8, 5, 11, 10, -9, 9, 10, 7, 10,
]);

buildMotifLookup();

/** Bounded module-static bytes, independent of world and output resolution. */
export const CANVAS_GAS_IDENTITY_LOOKUP_BYTES =
  GAS_IDENTITY_STYLE_BY_MATERIAL.byteLength + GAS_IDENTITY_MOTIF_TEXTURE_BYTES.byteLength
  + DENSITY_RGB.byteLength + RELIEF_GAIN.byteLength + CURVATURE_GAIN.byteLength;

/** Decodes a native/render-projection material ID to the stable 0/1–17 style ABI. */
export function canvasGasIdentityStyle(material: number): number {
  return material >= 0 && material < GAS_IDENTITY_STYLE_BY_MATERIAL.length
    ? GAS_IDENTITY_STYLE_BY_MATERIAL[material] : NO_STYLE;
}

/**
 * Adds exact-species character to one already-supported atmosphere RGBA texel.
 *
 * `density` is normalized field alpha and both signed inputs are the relief and
 * curvature already derived by the atmosphere pass. The hot path performs
 * three immutable motif-channel reads and fixed arithmetic only: no allocation, sampling,
 * trigonometry, modulo, or render-scale-dependent work. RGB changes by at most
 * twelve bytes per channel. Alpha/support is never read or written.
 */
export function applyCanvasGasIdentityStyle(
  target: Uint8ClampedArray,
  offset: number,
  styleClass: number,
  fieldX: number,
  fieldY: number,
  density: number,
  signedRelief: number,
  signedCurvature: number,
): void {
  if (styleClass < 1 || styleClass > STYLE_COUNT) return;
  const style = styleClass - 1;
  const volume = density < 0 ? 0 : density > 1 ? 1 : density;
  const motifScale = 0.34 + volume * 0.66;
  const relief = signedRelief * RELIEF_GAIN[style]
    + signedCurvature * CURVATURE_GAIN[style];
  const cell = ((fieldY & TILE_MASK) << TILE_SHIFT) | (fieldX & TILE_MASK);
  const motif = (style * TILE_CELLS + cell) * MOTIF_CHANNELS;
  const color = style * COLOR_CHANNELS;

  target[offset] += clampDelta(
    (GAS_IDENTITY_MOTIF_TEXTURE_BYTES[motif] - 128) * motifScale
      + DENSITY_RGB[color] * volume + relief,
  );
  target[offset + 1] += clampDelta(
    (GAS_IDENTITY_MOTIF_TEXTURE_BYTES[motif + 1] - 128) * motifScale
      + DENSITY_RGB[color + 1] * volume + relief,
  );
  target[offset + 2] += clampDelta(
    (GAS_IDENTITY_MOTIF_TEXTURE_BYTES[motif + 2] - 128) * motifScale
      + DENSITY_RGB[color + 2] * volume + relief,
  );
}

function buildMotifLookup(): void {
  for (let style = 0; style < STYLE_COUNT; style++) {
    for (let y = 0; y < TILE_SIZE; y++) for (let x = 0; x < TILE_SIZE; x++) {
      let red = 0;
      let green = 0;
      let blue = 0;
      const localX = (x & 7) - 4;
      const localY = (y & 7) - 4;
      const radiusSquared = localX * localX + localY * localY;

      if (style === 0) {
        // Smoke: broad irregular soot islands rather than cell-frequency noise.
        const coarseX = x >> 2;
        const coarseY = y >> 2;
        const soot = (coarseX * 7 + coarseY * 11 + coarseX * coarseY * 3) & 15;
        if (soot < 4) { red = -7; green = -7; blue = -6; }
        else if (soot > 11) { red = 3; green = 3; blue = 2; }
        else { red = -2; green = -2; blue = -1; }
      } else if (style === 1) {
        // Steam: broad ascending vapour folds with a bright crest.
        const plume = (x + (y >> 1) + ((y >> 3) << 1)) & TILE_MASK;
        if (plume <= 2) { red = 5; green = 7; blue = 8; }
        else if (plume >= 9 && plume <= 12) { red = -2; green = 0; blue = 2; }
        else { red = 1; green = 2; blue = 3; }
      } else if (style === 2) {
        // Fuel gas: annular eddies with a warm tangent wake.
        const wake = ((x * 2 - y) & 7) <= 1;
        if (radiusSquared >= 7 && radiusSquared <= 15) { red = 7; green = 4; blue = -2; }
        else if (wake) { red = 3; green = 2; blue = -2; }
        else { red = -2; green = -1; blue = 1; }
      } else if (style === 3) {
        // Oxygen: paired lift chevrons rising through the field.
        const lift = Math.abs(((x - (y >> 1)) & 7) - 4);
        if (lift <= 1 && (y & 7) <= 5) { red = 1; green = 6; blue = 8; }
        else if ((y & 7) >= 6) { red = -2; green = 0; blue = 2; }
      } else if (style === 4) {
        // Hydrogen: narrow separated wisps, lighter and finer than steam.
        const wisp = (x * 3 + y + ((y >> 2) * 3)) & TILE_MASK;
        if (wisp <= 1 || wisp >= 15) { red = 4; green = 5; blue = 8; }
        else if (wisp >= 7 && wisp <= 9) { red = -2; green = -1; blue = 2; }
      } else if (style === 5) {
        // Carbon dioxide: heavy horizontal pooling strata.
        const bank = (y + ((x >> 2) & 1) * 2) & 7;
        if (bank <= 1) { red = 2; green = 2; blue = 3; }
        else if (bank >= 5) { red = -6; green = -5; blue = -4; }
        else { red = -2; green = -1; blue = 0; }
      } else if (style === 6) {
        // Noble gas: diamond interference facets with alternating polarity.
        const diamond = Math.abs(localX) + Math.abs(localY);
        if (diamond === 3 || diamond === 4) { red = 6; green = 2; blue = 8; }
        else if (diamond <= 1) { red = -3; green = 3; blue = 6; }
        else { red = 1; green = -1; blue = 2; }
      } else if (style === 7) {
        // BOYL: opposed hot/cool vortex quadrants.
        const spin = localX * localY;
        const arm = Math.abs(radiusSquared - 10) <= 3;
        if (arm && spin >= 0) { red = 8; green = 3; blue = -4; }
        else if (arm) { red = -3; green = 1; blue = 6; }
        else { red = 1; green = -1; blue = 0; }
      } else if (style === 8) {
        // CAUS: irregular caustic veins and suspended corrosive pockets.
        const vein = (x * 5 + y * 3 + ((x ^ y) << 1)) & 15;
        if (vein <= 2) { red = -4; green = 8; blue = -3; }
        else if (vein >= 12) { red = 2; green = -4; blue = 2; }
        else { red = -1; green = 2; blue = -1; }
      } else if (style === 9) {
        // Fog: soft, wide, nearly neutral banks with sparse upper rims.
        const bank = (y + (x >> 2) + ((x >> 3) << 1)) & TILE_MASK;
        if (bank <= 3) { red = 4; green = 5; blue = 5; }
        else if (bank >= 10 && bank <= 13) { red = -3; green = -3; blue = -2; }
        else { red = 1; green = 1; blue = 2; }
      } else if (style === 10) {
        // Refrigerant: frost stars embedded in the cold vapour.
        const frost = localX === 0 || localY === 0 || localX === localY || localX === -localY;
        if (localX === 0 && localY === 0) { red = 5; green = 9; blue = 11; }
        else if (frost) { red = 3; green = 7; blue = 9; }
        else { red = -2; green = 0; blue = 3; }
      } else if (style === 11) {
        // Cold flame: tapering upward tongues with a dark inter-flame cleft.
        const tongue = Math.abs(((x + (y >> 1)) & 7) - 4);
        const taper = 3 - ((15 - y) >> 2);
        if (tongue <= taper) { red = -2; green = 3; blue = 9; }
        else if (tongue >= 3) { red = -3; green = -2; blue = 1; }
      } else if (style === 12) {
        // Antimatter: an absorptive void with a restrained inverse rim.
        if (radiusSquared <= 4) { red = -9; green = -8; blue = -9; }
        else if (radiusSquared >= 10 && radiusSquared <= 17) { red = 4; green = 1; blue = 5; }
        else { red = -3; green = -2; blue = -3; }
      } else if (style === 13) {
        // Warp: dislocated diagonal shear bands.
        const shiftedX = x + ((y >> 2) & 1) * 5;
        const shear = (shiftedX * 2 - y * 3) & TILE_MASK;
        if (shear <= 2) { red = 6; green = -4; blue = 8; }
        else if (shear >= 8 && shear <= 10) { red = -4; green = 3; blue = -2; }
        else { red = 1; green = -1; blue = 2; }
      } else if (style === 14) {
        // Bizarre gas: intersecting angular prisms with RGB-separated faces.
        const rising = ((x * 2 + y) & 7) <= 1;
        const falling = ((x - y * 2) & 7) <= 1;
        if (rising && falling) { red = 8; green = -5; blue = 8; }
        else if (rising) { red = -2; green = 7; blue = 4; }
        else if (falling) { red = 6; green = -3; blue = 7; }
        else { red = 1; green = -1; blue = 2; }
      } else if (style === 15) {
        // Train exhaust: layered rolling bands with intermittent soot clots.
        const band = (y * 2 + (x >> 1)) & 15;
        const clot = ((x >> 2) * 5 + (y >> 2) * 3) & 7;
        if (clot === 0) { red = -7; green = -7; blue = -7; }
        else if (band <= 3) { red = 4; green = 4; blue = 4; }
        else if (band >= 10) { red = -3; green = -3; blue = -3; }
        else { red = 1; green = 1; blue = 1; }
      } else {
        // Gaseous virus keeps the shared 16-world-cell grammar. Each atmosphere
        // texel spans 2x2 world cells, so the 8-cell pattern repeats twice in
        // this immutable 16x16 atlas without widening gas support.
        red = canvasVirusFamilyMotifDelta(RenderPhase.Gas, x * 2, y * 2, 0);
        green = canvasVirusFamilyMotifDelta(RenderPhase.Gas, x * 2, y * 2, 1);
        blue = canvasVirusFamilyMotifDelta(RenderPhase.Gas, x * 2, y * 2, 2);
      }

      const offset = (style * TILE_CELLS + y * TILE_SIZE + x) * MOTIF_CHANNELS;
      GAS_IDENTITY_MOTIF_TEXTURE_BYTES[offset] = red + 128;
      GAS_IDENTITY_MOTIF_TEXTURE_BYTES[offset + 1] = green + 128;
      GAS_IDENTITY_MOTIF_TEXTURE_BYTES[offset + 2] = blue + 128;
      GAS_IDENTITY_MOTIF_TEXTURE_BYTES[offset + 3] = 255;
    }
  }
}

function clampDelta(value: number): number {
  return value < -MAX_CHANNEL_DELTA ? -MAX_CHANNEL_DELTA
    : value > MAX_CHANNEL_DELTA ? MAX_CHANNEL_DELTA : value;
}
