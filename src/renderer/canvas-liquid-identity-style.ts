import { Material } from '../shared/materials';
import { RenderPhase } from './render-profile';
import { canvasPasteResistFamilyMotifDelta } from './canvas-paste-resist-family-style';
import { canvasVirusFamilyMotifDelta } from './canvas-virus-family-style';
import { canvasWaxFamilyMotifDelta } from './canvas-wax-family-style';

const STYLE_COUNT = 15;
const TILE_SHIFT = 5;
const TILE_SIZE = 1 << TILE_SHIFT;
const TILE_MASK = TILE_SIZE - 1;
const TILE_CELLS = TILE_SIZE * TILE_SIZE;
const CHANNELS = 3;
const NO_STYLE = 255;

// A byte lookup makes sparse/non-contiguous native IDs one predictable branch.
const STYLE_BY_MATERIAL = new Uint8Array(256).fill(NO_STYLE);
STYLE_BY_MATERIAL[Material.Soap] = 0;
STYLE_BY_MATERIAL[Material.BIZR] = 1;
STYLE_BY_MATERIAL[Material.CBNW] = 2;
STYLE_BY_MATERIAL[Material.GEL] = 3;
STYLE_BY_MATERIAL[Material.GLOW] = 4;
STYLE_BY_MATERIAL[Material.VIRS] = 5;
STYLE_BY_MATERIAL[Material.FRZW] = 6;
STYLE_BY_MATERIAL[Material.RFGL] = 7;
STYLE_BY_MATERIAL[Material.DEUT] = 8;
STYLE_BY_MATERIAL[Material.EXOT] = 9;
STYLE_BY_MATERIAL[Material.ISOZ] = 10;
STYLE_BY_MATERIAL[Material.Mercury] = 11;
STYLE_BY_MATERIAL[Material.LRBD] = 12;
STYLE_BY_MATERIAL[Material.LiquidNitrogen] = 13;
STYLE_BY_MATERIAL[Material.LO2] = 14;

/** Static signed RGB motif, tiled in world space at 32×32 cells per identity. */
const MOTIF_RGB = new Int8Array(STYLE_COUNT * TILE_CELLS * CHANNELS);

// Existing surface exposure strengthens only film/facet identities. Depth may
// attenuate or reverse a motif, while the RGB coefficients supply absorption.
const SURFACE_SCALE = new Float32Array([
  0.34, 0, 0.22, 0, 0, 0, 0.24, 0.20, 0.08, 0.12, 0.18,
  0.20, 0.12, 0.28, 0.24,
]);
const DEPTH_SCALE = new Float32Array([
  -0.18, -1.55, -0.12, -0.10, 0.12, -0.08, -0.08, -0.12, 0.20, -0.16, -0.10,
  -0.22, -0.18, -0.06, -0.04,
]);
const DEPTH_RGB = new Int8Array([
  0, 0, 0,
  2, -2, 2,
  -1, 0, 1,
  -2, -3, -4,
  0, 1, 2,
  -2, -3, 0,
  -2, 0, 2,
  -2, 0, -2,
  -2, 1, 4,
  2, -2, 4,
  3, -2, 3,
  -2, -2, -1,
  -3, -2, 0,
  -1, 2, 5,
  -1, 1, 5,
]);

buildMotifLookup();

/** Bounded module-static bytes; independent of world size and output scale. */
export const CANVAS_LIQUID_IDENTITY_LOOKUP_BYTES = STYLE_BY_MATERIAL.byteLength
  + MOTIF_RGB.byteLength + SURFACE_SCALE.byteLength + DEPTH_SCALE.byteLength
  + DEPTH_RGB.byteLength;

/** Returns whether a liquid belongs to the authored exact-identity layer. */
export function hasCanvasLiquidIdentityStyle(material: number): boolean {
  return material === Material.MWAX || material === Material.PSTE || material === Material.RSST
    || material >= 0 && material < STYLE_BY_MATERIAL.length
    && STYLE_BY_MATERIAL[material] !== NO_STYLE;
}

/**
 * Adds one deterministic material identity to an already shaded Canvas liquid.
 *
 * The module-static motif lookup replaces per-cell lattice branching. Runtime
 * work is three signed-byte reads plus existing volume scalars; no hot-path
 * allocation, sampling, trigonometry, modulo, or division occurs. Only a
 * clamped RGB delta is added. The caller/compositor—not this helper—owns final
 * byte clamping, alpha, silhouette, reconstruction, species, and physics.
 */
export function applyCanvasLiquidIdentityStyle(
  output: Float32Array,
  material: number,
  x: number,
  y: number,
  neighbourDensity: number,
  fieldAlpha: number,
  signedFieldRelief: number,
  surfaceExposure: number,
  columnDepthByte: number,
): void {
  const style = material >= 0 && material < STYLE_BY_MATERIAL.length
    ? STYLE_BY_MATERIAL[material] : NO_STYLE;
  if (style !== NO_STYLE) {
    applyCanonicalLiquidIdentityStyle(
      output, style, x, y, neighbourDensity, fieldAlpha,
      signedFieldRelief, surfaceExposure, columnDepthByte,
    );
    return;
  }
  if (material === Material.MWAX) {
    applyWaxLiquidIdentityStyle(
      output, x, y, neighbourDensity, fieldAlpha,
      signedFieldRelief, surfaceExposure, columnDepthByte,
    );
    return;
  }
  if (material === Material.PSTE || material === Material.RSST) {
    applyPasteResistLiquidIdentityStyle(
      output, material, x, y, neighbourDensity, fieldAlpha,
      signedFieldRelief, surfaceExposure, columnDepthByte,
    );
  }
}

/** The ordinary fifteen-style hot path: one lookup and no special-family branches. */
function applyCanonicalLiquidIdentityStyle(
  output: Float32Array,
  style: number,
  x: number,
  y: number,
  neighbourDensity: number,
  fieldAlpha: number,
  signedFieldRelief: number,
  surfaceExposure: number,
  columnDepthByte: number,
): void {
  const connected = fieldAlpha * (0.68 / 255) + neighbourDensity * 0.04;
  const depth = columnDepthByte * (1 / 255);
  const motifScale = 0.48 + connected * 0.52
    + surfaceExposure * SURFACE_SCALE[style]
    + depth * DEPTH_SCALE[style];
  const relief = signedFieldRelief * connected * 11;
  const cell = ((y & TILE_MASK) << TILE_SHIFT) | (x & TILE_MASK);
  const motif = (style * TILE_CELLS + cell) * CHANNELS;
  const depthColor = style * CHANNELS;

  output[0] += clampDelta(MOTIF_RGB[motif] * motifScale + relief + DEPTH_RGB[depthColor] * depth);
  output[1] += clampDelta(MOTIF_RGB[motif + 1] * motifScale + relief + DEPTH_RGB[depthColor + 1] * depth);
  output[2] += clampDelta(MOTIF_RGB[motif + 2] * motifScale + relief + DEPTH_RGB[depthColor + 2] * depth);
}

function applyWaxLiquidIdentityStyle(
  output: Float32Array,
  x: number,
  y: number,
  neighbourDensity: number,
  fieldAlpha: number,
  signedFieldRelief: number,
  surfaceExposure: number,
  columnDepthByte: number,
): void {
  const connected = fieldAlpha * (0.68 / 255) + neighbourDensity * 0.04;
  const depth = columnDepthByte * (1 / 255);
  const motifScale = 0.48 + connected * 0.52 + surfaceExposure * 0.16 - depth * 0.16;
  const relief = signedFieldRelief * connected * 11;
  output[0] += clampDelta(canvasWaxFamilyMotifDelta(RenderPhase.Liquid, x, y, 0) * motifScale + relief - depth);
  output[1] += clampDelta(canvasWaxFamilyMotifDelta(RenderPhase.Liquid, x, y, 1) * motifScale + relief - depth * 2);
  output[2] += clampDelta(canvasWaxFamilyMotifDelta(RenderPhase.Liquid, x, y, 2) * motifScale + relief - depth * 3);
}

function applyPasteResistLiquidIdentityStyle(
  output: Float32Array,
  material: Material.PSTE | Material.RSST,
  x: number,
  y: number,
  neighbourDensity: number,
  fieldAlpha: number,
  signedFieldRelief: number,
  surfaceExposure: number,
  columnDepthByte: number,
): void {
  const isPaste = material === Material.PSTE;
  const connected = fieldAlpha * (0.68 / 255) + neighbourDensity * 0.04;
  const depth = columnDepthByte * (1 / 255);
  const motifScale = 0.48 + connected * 0.52
    + surfaceExposure * (isPaste ? 0.10 : 0.18)
    + depth * (isPaste ? -0.12 : -0.06);
  const relief = signedFieldRelief * connected * 11;
  const depthRed = isPaste ? -2 : -3;
  const depthGreen = isPaste ? -1 : -2;
  const depthBlue = isPaste ? 0 : 1;
  output[0] += clampDelta(
    canvasPasteResistFamilyMotifDelta(material, RenderPhase.Liquid, x, y, 0) * motifScale + relief + depthRed * depth,
  );
  output[1] += clampDelta(
    canvasPasteResistFamilyMotifDelta(material, RenderPhase.Liquid, x, y, 1) * motifScale + relief + depthGreen * depth,
  );
  output[2] += clampDelta(
    canvasPasteResistFamilyMotifDelta(material, RenderPhase.Liquid, x, y, 2) * motifScale + relief + depthBlue * depth,
  );
}

function buildMotifLookup(): void {
  for (let style = 0; style < STYLE_COUNT; style++) {
    for (let y = 0; y < TILE_SIZE; y++) for (let x = 0; x < TILE_SIZE; x++) {
      let red = 0;
      let green = 0;
      let blue = 0;
      if (style === 0) {
        // Soap: three diagonal thin-film interference orders.
        const band = (x * 2 + y * 3) & TILE_MASK;
        if (band < 4) { red = 7; green = 2; blue = 9; }
        else if (band >= 11 && band < 15) { red = -2; green = 8; blue = 4; }
        else if (band >= 22 && band < 26) { red = 8; green = 5; blue = -2; }
        else blue = 2;
      } else if (style === 1) {
        // BIZR: opposed angular prisms; its depth scale reverses their polarity.
        const rising = ((x * 2 + y) & 15) <= 1;
        const falling = ((x - y * 2) & 15) <= 1;
        if (rising && falling) { red = 10; green = -4; blue = 12; }
        else if (rising) { red = 4; green = 8; blue = 10; }
        else if (falling) { red = 8; green = -3; blue = 6; }
        else { red = 2; green = -1; blue = 3; }
      } else if (style === 2) {
        // CBNW: ring cells connected into staggered rising microbubble chains.
        const row = y & 15;
        const chainOffset = ((y >> 4) & 1) << 2;
        const column = ((x - chainOffset) & 7) - 4;
        const bubbleY = row - 7;
        const radiusSquared = column * column + bubbleY * bubbleY;
        if (radiusSquared >= 5 && radiusSquared <= 12) { red = 2; green = 7; blue = 10; }
        else if (Math.abs(column) <= 1 && (row <= 2 || row >= 13)) {
          red = -2; green = 2; blue = 6;
        } else { green = 1; blue = 2; }
      } else if (style === 3) {
        // GEL: broad staggered triangle folds, continuous across the tile.
        const phase = (x * 3 + y * 5 + ((y >> 3) << 1)) & TILE_MASK;
        const fold = 1 - Math.abs(phase - 16) * (1 / 8);
        red = Math.round(fold * 6);
        green = Math.round(fold * 3 + 1);
        blue = Math.round(2 - fold * 2);
      } else if (style === 4) {
        // GLOW: nested, field-independent subsurface rings.
        const localX = (x & 15) - 8;
        const localY = (y & 15) - 8;
        const radiusSquared = localX * localX + localY * localY;
        if (radiusSquared >= 35 && radiusSquared <= 54) { red = 2; green = 7; blue = 10; }
        else if (radiusSquared >= 8 && radiusSquared <= 19) { red = -2; green = 4; blue = 9; }
        else { green = 1; blue = 3; }
      } else if (style === 5) {
        // VIRS: the canonical 16-cell membrane/capsid grammar, softened later
        // by the existing liquid density, relief, and optical-depth scalars.
        red = canvasVirusFamilyMotifDelta(RenderPhase.Liquid, x, y, 0);
        green = canvasVirusFamilyMotifDelta(RenderPhase.Liquid, x, y, 1);
        blue = canvasVirusFamilyMotifDelta(RenderPhase.Liquid, x, y, 2);
      } else if (style === 6) {
        // FRZW: repeating orthogonal and diagonal frost facets.
        const localX = (x & 15) - 8;
        const localY = (y & 15) - 8;
        const arm = localX === 0 || localY === 0
          || localX === localY || localX === -localY;
        if (arm) { red = 5; green = 8; blue = 11; }
        else { red = -1; green = 1; blue = 3; }
      } else if (style === 7) {
        // RFGL: large bubble films crossed by coherent diagonal ribbons.
        const localX = (x & TILE_MASK) - 16;
        const localY = (y & 15) - 8;
        const radiusSquared = localX * localX + localY * localY;
        const ribbon = ((x * 3 + y * 2) & TILE_MASK) <= 3
          || ((x * 3 + y * 2) & TILE_MASK) >= 28;
        if (radiusSquared >= 104 && radiusSquared <= 157) { red = 5; green = 9; blue = 10; }
        else if (ribbon) { red = -2; green = 6; blue = 8; }
        else { green = 2; blue = 3; }
      } else if (style === 8) {
        // DEUT: deep horizontal concentration bands with cool lifted seams.
        const band = (y + ((x >> 3) & 3)) & 15;
        if (band <= 2) { red = -3; green = 5; blue = 11; }
        else if (band >= 9 && band <= 12) { red = -4; green = -2; blue = 5; }
        else { red = -2; green = 1; blue = 3; }
      } else if (style === 9) {
        // EXOT: opposed interference diamonds and displaced hot vertices.
        const localX = (x & 15) - 8;
        const localY = (y & 15) - 8;
        const diamond = Math.abs(localX) + Math.abs(localY);
        const shear = (x * 3 - y * 2) & 15;
        if (diamond >= 6 && diamond <= 9) { red = 4; green = -3; blue = 11; }
        else if (shear <= 2) { red = 8; green = 2; blue = 6; }
        else { red = -2; green = 1; blue = 3; }
      } else if (style === 10) {
        // ISOZ: coherent decay rings matching its solid ISZS phase partner.
        const localX = (x & 15) - 8;
        const localY = (y & 15) - 8;
        const radiusSquared = localX * localX + localY * localY;
        if (radiusSquared >= 31 && radiusSquared <= 52) { red = 8; green = -3; blue = 10; }
        else if (radiusSquared <= 10) { red = -3; green = 5; blue = 7; }
        else { red = 2; green = -1; blue = 3; }
      } else if (style === 11) {
        // MERC: broad neutral mirror bands with cool recessed pockets.
        const band = (x * 3 + y) & TILE_MASK;
        if (band >= 11 && band <= 18) { red = 8; green = 10; blue = 12; }
        else if (band >= 25 && band <= 29) { red = -6; green = -5; blue = -3; }
        else { red = 1; green = 2; blue = 3; }
      } else if (style === 12) {
        // LRBD: denser lead plates read heavier and less reflective than MERC.
        const plate = (x * 2 - y * 3) & 15;
        if (plate <= 2) { red = 4; green = 6; blue = 9; }
        else if (plate >= 10 && plate <= 13) { red = -7; green = -6; blue = -4; }
        else { red = -1; green = 0; blue = 2; }
      } else if (style === 13) {
        // LN2: cold stratified ripples and a sparse pale frost shoulder.
        const ripple = (x * 2 + y * 3) & 31;
        if (ripple <= 3 || ripple >= 29) { red = 2; green = 8; blue = 13; }
        else if (ripple >= 14 && ripple <= 18) { red = -3; green = 1; blue = 5; }
        else { red = 0; green = 3; blue = 6; }
      } else {
        // LO2: related cold body with a quieter oxygen-blue interference fold.
        const fold = (x * 3 - y * 2) & 31;
        if (fold <= 3 || fold >= 28) { red = 1; green = 6; blue = 13; }
        else if (fold >= 13 && fold <= 17) { red = -4; green = 0; blue = 5; }
        else { red = -1; green = 2; blue = 6; }
      }
      const offset = (style * TILE_CELLS + y * TILE_SIZE + x) * CHANNELS;
      MOTIF_RGB[offset] = red;
      MOTIF_RGB[offset + 1] = green;
      MOTIF_RGB[offset + 2] = blue;
    }
  }
}

function clampDelta(value: number): number {
  return value < -14 ? -14 : value > 14 ? 14 : value;
}
