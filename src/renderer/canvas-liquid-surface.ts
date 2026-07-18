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
  liquidByMaterial: Uint8Array,
  colorByMaterial: Uint8Array,
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
    let red = 0;
    let green = 0;
    let blue = 0;
    let samples = 0;
    // Prefer the four cardinal donors. Four diagonals alone can barely cross the
    // reconstruction threshold, so scan them only when cardinal support supplied
    // no styled pixel; the species-colour gate still rejects mixed donors.
    for (let direction = 0; direction < 8 && (direction < 4 || samples === 0); direction++) {
      const diagonal = direction - 4;
      const offsetX = direction < 4
        ? (direction === 0 ? -1 : direction === 1 ? 1 : 0)
        : (diagonal < 2 ? -1 : 1);
      const offsetY = direction < 4
        ? (direction === 2 ? -1 : direction === 3 ? 1 : 0)
        : (diagonal % 2 === 0 ? -1 : 1);
      if (x + offsetX < 0 || y + offsetY < 0 || x + offsetX >= width || y + offsetY >= height) continue;
      const neighbour = (y + offsetY) * width + x + offsetX;
      const material = materials[neighbour];
      if (!liquidByMaterial[material]) continue;
      const color = material * 3;
      if (colorByMaterial[color] !== density[fieldPixel]
        || colorByMaterial[color + 1] !== density[fieldPixel + 1]
        || colorByMaterial[color + 2] !== density[fieldPixel + 2]) continue;
      const neighbourPixel = neighbour * 4;
      if (target[neighbourPixel + 3] === 0) continue;
      red += target[neighbourPixel];
      green += target[neighbourPixel + 1];
      blue += target[neighbourPixel + 2];
      samples++;
    }
    target[fieldPixel] = clamp((samples ? red / samples : density[fieldPixel]) + light);
    target[fieldPixel + 1] = clamp((samples ? green / samples : density[fieldPixel + 1]) + light);
    target[fieldPixel + 2] = clamp((samples ? blue / samples : density[fieldPixel + 2]) + light);
    target[fieldPixel + 3] = clamp(amount * (96 + amount * 114));
  }
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const amount = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return amount * amount * (3 - 2 * amount);
}

function clamp(value: number): number { return Math.max(0, Math.min(255, Math.round(value))); }
