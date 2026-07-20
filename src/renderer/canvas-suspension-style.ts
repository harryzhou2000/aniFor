import { RenderOptics } from './render-optics';
import { RenderPhase } from './render-profile';
import type { SuspensionField } from './suspension-field';

const LIQUID_TINT_GAIN = 0.94;
const POWDER_COHESION_GAIN = 0.96;

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function suspensionKnee(alpha: number): number {
  const t = Math.max(0, Math.min(1, (alpha - 0.08) / 0.74));
  return t * t * (3 - 2 * t);
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
      const cohesion = suspensionKnee(alpha);
      const liquidAmount = cohesion * LIQUID_TINT_GAIN;
      const powderAmount = cohesion * POWDER_COHESION_GAIN;
      const top = fieldY * 2;
      const left = fieldX * 2;
      for (let offsetY = 0; offsetY < 2 && top + offsetY < height; offsetY++) {
        for (let offsetX = 0; offsetX < 2 && left + offsetX < width; offsetX++) {
          const index = (top + offsetY) * width + left + offsetX;
          const pixel = index * 4;
          // Both semantic phases converge on one wet-sediment body colour.
          // The liquid field already owns an exact, ambiguity-free aqueous RGB
          // at powder cells, so no new material selection happens here.
          const red = liquidDensityBytes[pixel] * 0.52 + field.bytes[fieldPixel] * 0.48;
          const green = liquidDensityBytes[pixel + 1] * 0.52
            + field.bytes[fieldPixel + 1] * 0.48;
          const blue = liquidDensityBytes[pixel + 2] * 0.52
            + field.bytes[fieldPixel + 2] * 0.48;
          if (liquid[pixel + 3] !== 0) {
            liquid[pixel] = clampByte(liquid[pixel] + (red - liquid[pixel]) * liquidAmount);
            liquid[pixel + 1] = clampByte(
              liquid[pixel + 1] + (green - liquid[pixel + 1]) * liquidAmount,
            );
            liquid[pixel + 2] = clampByte(
              liquid[pixel + 2] + (blue - liquid[pixel + 2]) * liquidAmount,
            );
          }
          const material = materials[index];
          const lookup = material * 4;
          if (base[pixel + 3] === 0 || styleBytes[lookup] !== RenderPhase.Powder
            || styleBytes[lookup + 2] !== 0 || styleBytes[lookup + 3] !== 0
            || paletteBytes[lookup + 3] !== RenderOptics.RoughGranular
            || field.bytes[fieldPixel] !== paletteBytes[lookup]
            || field.bytes[fieldPixel + 1] !== paletteBytes[lookup + 1]
            || field.bytes[fieldPixel + 2] !== paletteBytes[lookup + 2]) continue;
          // The residual 4% of the already-lit source carries the bounded facet
          // relief while both semantic phases otherwise meet at one albedo.
          base[pixel] = clampByte(base[pixel] + (red - base[pixel]) * powderAmount);
          base[pixel + 1] = clampByte(
            base[pixel + 1] + (green - base[pixel + 1]) * powderAmount,
          );
          base[pixel + 2] = clampByte(
            base[pixel + 2] + (blue - base[pixel + 2]) * powderAmount,
          );
        }
      }
    }
  }
}
