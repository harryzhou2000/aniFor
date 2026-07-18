/**
 * Adds bounded upper-left relief and density depth to the shared gas volume.
 * Alpha is copied exactly, so this presentation pass cannot widen or blur gas.
 */
export function shadeCanvasAtmosphere(
  target: Uint8ClampedArray,
  source: Uint8Array,
  width: number,
  height: number,
): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error('Invalid atmosphere dimensions');
  }
  const length = width * height * 4;
  if (source.length !== length || target.length !== length) throw new Error('Atmosphere buffer size mismatch');

  for (let y = 0; y < height; y++) {
    const topY = Math.max(0, y - 1);
    const bottomY = Math.min(height - 1, y + 1);
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const alpha = source[offset + 3];
      if (alpha === 0) {
        target[offset] = 0;
        target[offset + 1] = 0;
        target[offset + 2] = 0;
        target[offset + 3] = 0;
        continue;
      }

      const leftX = Math.max(0, x - 1);
      const rightX = Math.min(width - 1, x + 1);
      const left = source[(y * width + leftX) * 4 + 3] / 255;
      const right = source[(y * width + rightX) * 4 + 3] / 255;
      const top = source[(topY * width + x) * 4 + 3] / 255;
      const bottom = source[(bottomY * width + x) * 4 + 3] / 255;
      const density = alpha / 255;
      const upperLeftRelief = ((right - left) + (bottom - top)) * 0.5;
      // Optical depth darkens dense gas while the gradient retains a restrained
      // upper-left silver lining. Alpha remains the authoritative field support.
      const shade = clamp(1.10 - density * 0.34 + upperLeftRelief * 0.68, 0.66, 1.16);

      target[offset] = Math.round(source[offset] * shade);
      target[offset + 1] = Math.round(source[offset + 1] * shade);
      target[offset + 2] = Math.round(source[offset + 2] * shade);
      target[offset + 3] = alpha;
    }
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
