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
  const support = new Uint8Array(256);
  const donorByMaterial = new Int32Array(256);
  donorByMaterial.fill(-1);
  const touchedMaterials = new Uint8Array(8);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = y * width + x;
    if (materials[index] !== 0 || density[index * 4] < LIQUID_HOLE_THRESHOLD) continue;
    const donor = supportedLiquid(
      materials, liquidByMaterial, width, height, x, y,
      support, donorByMaterial, touchedMaterials,
    );
    if (donor < 0) continue;
    const amount = smoothstep(0.30, 0.68, density[index * 4] / 255);
    if (amount <= 0) continue;
    const left = density[(y * width + Math.max(0, x - 1)) * 4] / 255;
    const right = density[(y * width + Math.min(width - 1, x + 1)) * 4] / 255;
    const top = density[(Math.max(0, y - 1) * width + x) * 4] / 255;
    const bottom = density[(Math.min(height - 1, y + 1) * width + x) * 4] / 255;
    const light = (left - right) * 28 + (top - bottom) * 36;
    const donorPixel = donor * 4;
    const material = materials[donor];
    const colorOffset = material * 3;
    const pixel = index * 4;
    target[pixel] = clamp((target[donorPixel] || colorByMaterial[colorOffset]) + light);
    target[pixel + 1] = clamp((target[donorPixel + 1] || colorByMaterial[colorOffset + 1]) + light);
    target[pixel + 2] = clamp((target[donorPixel + 2] || colorByMaterial[colorOffset + 2]) + light);
    target[pixel + 3] = clamp(118 + amount * 108);
  }
}

function supportedLiquid(
  materials: Uint8Array,
  liquidByMaterial: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  support: Uint8Array,
  donorByMaterial: Int32Array,
  touchedMaterials: Uint8Array,
): number {
  const neighbours = [
    [-1, 0, 2], [1, 0, 2], [0, -1, 2], [0, 1, 2],
    [-1, -1, 1], [1, -1, 1], [-1, 1, 1], [1, 1, 1],
  ] as const;
  let touchedCount = 0;
  for (const [ox, oy, weight] of neighbours) {
    const px = x + ox;
    const py = y + oy;
    if (px < 0 || py < 0 || px >= width || py >= height) continue;
    const index = py * width + px;
    const material = materials[index];
    if (!liquidByMaterial[material]) continue;
    if (support[material] === 0) touchedMaterials[touchedCount++] = material;
    support[material] += weight;
    if (donorByMaterial[material] < 0 || weight === 2) donorByMaterial[material] = index;
  }
  let bestMaterial = 0;
  let bestSupport = 0;
  let tied = false;
  for (let touched = 0; touched < touchedCount; touched++) {
    const material = touchedMaterials[touched];
    if (support[material] > bestSupport) {
      bestMaterial = material;
      bestSupport = support[material];
      tied = false;
    } else if (support[material] > 0 && support[material] === bestSupport) {
      tied = true;
    }
  }
  const donor = bestSupport > 0 && !tied ? donorByMaterial[bestMaterial] : -1;
  for (let touched = 0; touched < touchedCount; touched++) {
    const material = touchedMaterials[touched];
    support[material] = 0;
    donorByMaterial[material] = -1;
  }
  return donor;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const amount = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return amount * amount * (3 - 2 * amount);
}

function clamp(value: number): number { return Math.max(0, Math.min(255, Math.round(value))); }
