const LIQUID_HOLE_THRESHOLD = 86;

/**
 * Closes small empty pinholes in a Canvas liquid layer using the same density
 * field as WebGL. Occupied non-liquid cells remain untouched, so grains and
 * hard boundaries stay visible above the reconstructed liquid mass.
 */
export function reconstructLiquidSurface(
  target: Uint8ClampedArray,
  materials: Uint8Array,
  density: Uint8Array,
  width: number,
  height: number,
): void {
  if (target.length !== materials.length * 4 || density.length !== materials.length * 4) {
    throw new Error('Canvas liquid surface size mismatch');
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = y * width + x;
    const fieldPixel = index * 4;
    if (materials[index] !== 0 || density[fieldPixel + 3] < LIQUID_HOLE_THRESHOLD) continue;
    const amount = smoothstep(0.30, 0.68, density[fieldPixel + 3] / 255);
    if (amount <= 0) continue;
    const left = density[(y * width + Math.max(0, x - 1)) * 4 + 3] / 255;
    const right = density[(y * width + Math.min(width - 1, x + 1)) * 4 + 3] / 255;
    const top = density[(Math.max(0, y - 1) * width + x) * 4 + 3] / 255;
    const bottom = density[(Math.min(height - 1, y + 1) * width + x) * 4 + 3] / 255;
    const light = (left - right) * 28 + (top - bottom) * 36;
    target[fieldPixel] = clamp(density[fieldPixel] + light);
    target[fieldPixel + 1] = clamp(density[fieldPixel + 1] + light);
    target[fieldPixel + 2] = clamp(density[fieldPixel + 2] + light);
    target[fieldPixel + 3] = clamp(amount * (96 + amount * 114));
  }
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const amount = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return amount * amount * (3 - 2 * amount);
}

function clamp(value: number): number { return Math.max(0, Math.min(255, Math.round(value))); }
