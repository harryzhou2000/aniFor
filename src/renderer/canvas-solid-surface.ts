import { RenderPhase } from './render-profile';
import { compositePixel } from './rgba-composite';

/**
 * Closes only fully enclosed, same-material pinholes in the Canvas solid plane.
 * The semantic particle field is never changed, exposed notches stay open, and
 * unlike solids cannot bleed across their interface.
 */
export function reconstructSolidSurface(
  target: Uint8ClampedArray,
  materials: Uint8Array,
  styleBytes: Uint8Array,
  width: number,
  height: number,
): void {
  if (target.length !== materials.length * 4 || width * height !== materials.length) {
    throw new Error('Canvas solid surface size mismatch');
  }
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const index = y * width + x;
    if (materials[index] !== 0) continue;
    const material = materials[index - 1];
    if (!material || styleBytes[material * 4] !== RenderPhase.Solid) continue;
    if (materials[index + 1] !== material || materials[index - width] !== material || materials[index + width] !== material) continue;
    const pixel = index * 4;
    const left = (index - 1) * 4;
    const right = (index + 1) * 4;
    const top = (index - width) * 4;
    const bottom = (index + width) * 4;
    const alpha = (target[left + 3] + target[right + 3] + target[top + 3] + target[bottom + 3]) / 4;
    if (alpha <= 0) continue;
    compositePixel(
      target,
      pixel,
      (target[left] + target[right] + target[top] + target[bottom]) / 4 + 4,
      (target[left + 1] + target[right + 1] + target[top + 1] + target[bottom + 1]) / 4 + 5,
      (target[left + 2] + target[right + 2] + target[top + 2] + target[bottom + 2]) / 4 + 6,
      alpha * 0.82,
    );
  }
}
