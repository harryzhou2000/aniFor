import { RenderOptics } from './render-optics';
import { RenderPhase } from './render-profile';
import type { SuspensionField } from './suspension-field';

const SUSPENSION_COHESION_GAIN = 0.98;
const MAX_RELIEF_DELTA = 8;

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function suspensionKnee(alpha: number): number {
  const t = Math.max(0, Math.min(1, (alpha - 0.05) / 0.57));
  return t * t * (3 - 2 * t);
}

function applyWetChroma(
  target: Uint8ClampedArray,
  pixel: number,
  wetRed: number,
  wetGreen: number,
  wetBlue: number,
  amount: number,
): void {
  const currentLuma = target[pixel] * 0.2126
    + target[pixel + 1] * 0.7152 + target[pixel + 2] * 0.0722;
  const wetLuma = wetRed * 0.2126 + wetGreen * 0.7152 + wetBlue * 0.0722;
  const relief = Math.max(-MAX_RELIEF_DELTA, Math.min(MAX_RELIEF_DELTA, currentLuma - wetLuma));
  target[pixel] = clampByte(
    target[pixel] + (wetRed + relief - target[pixel]) * amount,
  );
  target[pixel + 1] = clampByte(
    target[pixel + 1] + (wetGreen + relief - target[pixel + 1]) * amount,
  );
  target[pixel + 2] = clampByte(
    target[pixel + 2] + (wetBlue + relief - target[pixel + 2]) * amount,
  );
}

function fieldPixelAt(field: SuspensionField, x: number, y: number): number {
  return ((y >> 1) * field.width + (x >> 1)) * 4;
}

/** Styles one already-lit authoritative powder or aqueous liquid cell. */
export function applyCanvasSemanticSuspensionStyle(
  target: Uint8ClampedArray,
  pixel: number,
  material: number,
  x: number,
  y: number,
  styleBytes: Uint8Array,
  paletteBytes: Uint8Array,
  field: SuspensionField,
  liquidDensityBytes: Uint8Array,
): void {
  if (target[pixel + 3] === 0) return;
  const fieldPixel = fieldPixelAt(field, x, y);
  const alpha = field.bytes[fieldPixel + 3] / 255;
  if (alpha <= 1 / 255) return;
  const lookup = material * 4;
  const phase = styleBytes[lookup];
  const ordinary = styleBytes[lookup + 2] === 0 && styleBytes[lookup + 3] === 0;
  if (!ordinary) return;
  if (phase === RenderPhase.Powder) {
    if (paletteBytes[lookup + 3] !== RenderOptics.RoughGranular
      || field.bytes[fieldPixel] !== paletteBytes[lookup]
      || field.bytes[fieldPixel + 1] !== paletteBytes[lookup + 1]
      || field.bytes[fieldPixel + 2] !== paletteBytes[lookup + 2]) return;
  } else if (phase === RenderPhase.Liquid) {
    if (paletteBytes[lookup + 3] !== RenderOptics.Aqueous
      || liquidDensityBytes[pixel + 3] < 64
      || liquidDensityBytes[pixel] !== paletteBytes[lookup]
      || liquidDensityBytes[pixel + 1] !== paletteBytes[lookup + 1]
      || liquidDensityBytes[pixel + 2] !== paletteBytes[lookup + 2]) return;
  } else return;
  const wetRed = liquidDensityBytes[pixel] * 0.52 + field.bytes[fieldPixel] * 0.48;
  const wetGreen = liquidDensityBytes[pixel + 1] * 0.52
    + field.bytes[fieldPixel + 1] * 0.48;
  const wetBlue = liquidDensityBytes[pixel + 2] * 0.52
    + field.bytes[fieldPixel + 2] * 0.48;
  applyWetChroma(
    target, pixel, wetRed, wetGreen, wetBlue,
    suspensionKnee(alpha) * SUSPENSION_COHESION_GAIN,
  );
}

/** Styles reconstructed aqueous liquid plus presentation-created empty support. */
export function applyCanvasReconstructedSuspensionStyle(
  liquid: Uint8ClampedArray,
  materials: Uint8Array,
  styleBytes: Uint8Array,
  paletteBytes: Uint8Array,
  field: SuspensionField,
  liquidDensityBytes: Uint8Array,
  powderStyle: 'grains' | 'local' | 'smooth',
): void {
  if (powderStyle !== 'smooth' || !field.hasSuspension) return;
  const { worldWidth: width, worldHeight: height } = field;
  for (let fieldY = 0; fieldY < field.height; fieldY++) {
    for (let fieldX = 0; fieldX < field.width; fieldX++) {
      const fieldPixel = (fieldY * field.width + fieldX) * 4;
      const alpha = field.bytes[fieldPixel + 3] / 255;
      if (alpha <= 1 / 255) continue;
      const amount = suspensionKnee(alpha) * SUSPENSION_COHESION_GAIN;
      const top = fieldY * 2;
      const left = fieldX * 2;
      for (let offsetY = 0; offsetY < 2 && top + offsetY < height; offsetY++) {
        for (let offsetX = 0; offsetX < 2 && left + offsetX < width; offsetX++) {
          const index = (top + offsetY) * width + left + offsetX;
          const pixel = index * 4;
          const material = materials[index];
          if (material !== 0) {
            if (styleBytes[material * 4] === RenderPhase.Liquid) {
              applyCanvasSemanticSuspensionStyle(
                liquid, pixel, material, left + offsetX, top + offsetY,
                styleBytes, paletteBytes, field, liquidDensityBytes,
              );
            }
            continue;
          }
          if (liquid[pixel + 3] === 0) continue;
          const wetRed = liquidDensityBytes[pixel] * 0.52 + field.bytes[fieldPixel] * 0.48;
          const wetGreen = liquidDensityBytes[pixel + 1] * 0.52
            + field.bytes[fieldPixel + 1] * 0.48;
          const wetBlue = liquidDensityBytes[pixel + 2] * 0.52
            + field.bytes[fieldPixel + 2] * 0.48;
          applyWetChroma(liquid, pixel, wetRed, wetGreen, wetBlue, amount);
        }
      }
    }
  }
}

/**
 * Applies one RGB-only powder suspension body to already reconstructed Canvas
 * matter. The semantic alpha/support planes remain authoritative.
 */
export function applyCanvasSuspensionStyle(
  base: Uint8ClampedArray,
  liquid: Uint8ClampedArray,
  materials: Uint8Array,
  styleBytes: Uint8Array,
  paletteBytes: Uint8Array,
  field: SuspensionField,
  liquidDensityBytes: Uint8Array,
  powderStyle: 'grains' | 'local' | 'smooth',
): void {
  if (powderStyle !== 'smooth' || !field.hasSuspension) return;
  const { worldWidth: width, worldHeight: height } = field;
  if (materials.length !== width * height
    || base.length !== materials.length * 4 || liquid.length !== base.length
    || liquidDensityBytes.length !== base.length) {
    throw new Error('Canvas suspension surface size mismatch');
  }

  // Visit each half-resolution tile once. Canvas fallback deliberately uses a
  // constant 2x2 tint per field texel; the reconstructed material contours and
  // final output scaler still provide the visible edge interpolation, without
  // repeating four bilinear samples and coordinate clamps for every world cell.
  for (let fieldY = 0; fieldY < field.height; fieldY++) {
    for (let fieldX = 0; fieldX < field.width; fieldX++) {
      const fieldPixel = (fieldY * field.width + fieldX) * 4;
      const alpha = field.bytes[fieldPixel + 3] / 255;
      if (alpha <= 1 / 255) continue;
      const top = fieldY * 2;
      const left = fieldX * 2;
      for (let offsetY = 0; offsetY < 2 && top + offsetY < height; offsetY++) {
        for (let offsetX = 0; offsetX < 2 && left + offsetX < width; offsetX++) {
          const index = (top + offsetY) * width + left + offsetX;
          const pixel = index * 4;
          const material = materials[index];
          if (styleBytes[material * 4] === RenderPhase.Powder) {
            applyCanvasSemanticSuspensionStyle(
              base, pixel, material, left + offsetX, top + offsetY,
              styleBytes, paletteBytes, field, liquidDensityBytes,
            );
          }
        }
      }
    }
  }
  applyCanvasReconstructedSuspensionStyle(
    liquid, materials, styleBytes, paletteBytes,
    field, liquidDensityBytes, powderStyle,
  );
}
