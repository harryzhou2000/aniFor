import { canvasLiquidFieldRelief } from './canvas-liquid-light';

// The 3x3 density kernel gives an isolated droplet's strongest empty neighbour
// 45/255 support. Staying above that value admits connected curved shores while
// keeping a lone semantic cell inside its original presentation footprint.
const LIQUID_HOLE_THRESHOLD = 56;
const LIQUID_INTERIOR_FIELD_ALPHA = 224;
const LIQUID_INTERIOR_PIXEL_ALPHA = 176;
const LIQUID_DONOR_PIXEL_ALPHA = 96;
// Dense pools retain their silhouette and alpha while carrying a little more
// of their same-species cardinal colour. This deliberately stays below a
// half-neighbour average so authored shading and caustics remain visible.
const LIQUID_INTERIOR_BLEND = 0.72;
const LIQUID_NEIGHBOUR_GAIN = LIQUID_INTERIOR_BLEND / 8;
const LIQUID_ROW_COUNT = 3;

export interface LiquidSurfaceScratch {
  readonly sourcePixels: Uint32Array;
  readonly sourceRows: readonly Uint32Array[];
  readonly rowBytes: Uint8ClampedArray;
  readonly rowPixels: Uint32Array;
}

export function liquidSurfaceScratchByteLength(width: number): number {
  return width * LIQUID_ROW_COUNT * 4;
}

export function createLiquidSurfaceScratch(
  target: Uint8ClampedArray,
  width: number,
): LiquidSurfaceScratch {
  const rowBytes = new Uint8ClampedArray(liquidSurfaceScratchByteLength(width));
  const sourcePixels = new Uint32Array(target.buffer, target.byteOffset, target.byteLength / 4);
  const height = sourcePixels.length / width;
  if (!Number.isInteger(height)) throw new Error('Canvas liquid surface size mismatch');
  const sourceRows = Array.from({ length: height }, (_, y) => new Uint32Array(
    target.buffer, target.byteOffset + y * width * 4, width,
  ));
  return {
    sourcePixels,
    sourceRows,
    rowBytes,
    rowPixels: new Uint32Array(rowBytes.buffer, rowBytes.byteOffset, rowBytes.byteLength / 4),
  };
}

/**
 * Closes small empty pinholes in a Canvas liquid layer using the same density
 * field as WebGL, then reduces cell-scale colour variance only inside strongly
 * supported same-species liquid interiors. Alpha, semantic cells, shorelines,
 * and unlike-liquid boundaries remain untouched by the cohesion pass.
 */
export function reconstructLiquidSurface(
  target: Uint8ClampedArray,
  materials: Uint8Array,
  density: Uint8Array,
  liquidByMaterial: Uint8Array,
  colorByMaterial: Uint8Array,
  styleByMaterial: Uint8Array,
  scratch: LiquidSurfaceScratch,
  width: number,
  height: number,
): void {
  if (materials.length !== width * height
    || target.length !== materials.length * 4
    || density.length !== materials.length * 4
    || scratch.sourcePixels.buffer !== target.buffer
    || scratch.sourcePixels.byteOffset !== target.byteOffset
    || scratch.sourcePixels.length !== materials.length
    || scratch.sourceRows.length !== height
    || scratch.rowBytes.length !== liquidSurfaceScratchByteLength(width)
    || scratch.rowPixels.length !== width * LIQUID_ROW_COUNT) {
    throw new Error('Canvas liquid surface size mismatch');
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = y * width + x;
    const fieldPixel = index * 4;
    if (materials[index] !== 0 || density[fieldPixel + 3] < LIQUID_HOLE_THRESHOLD) continue;
    const amount = smoothstep(0.22, 0.68, density[fieldPixel + 3] / 255);
    if (amount <= 0) continue;
    const reliefScale = 1 + canvasLiquidFieldRelief(density, width, height, x, y);
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
    target[fieldPixel] = clamp((samples ? red / samples : density[fieldPixel]) * reliefScale);
    target[fieldPixel + 1] = clamp((samples ? green / samples : density[fieldPixel + 1]) * reliefScale);
    target[fieldPixel + 2] = clamp((samples ? blue / samples : density[fieldPixel + 2]) * reliefScale);
    target[fieldPixel + 3] = clamp(amount * (96 + amount * 114));
  }

  smoothDenseLiquidInteriors(
    target, materials, density, liquidByMaterial, colorByMaterial,
    styleByMaterial, scratch, width, height,
  );
}

/**
 * Uses a three-row ring so every donor is read from the post-reconstruction,
 * pre-smoothing image. The filter therefore cannot cascade with scan order and
 * costs only width * 12 persistent bytes plus one bounded source view per row
 * instead of another full-frame copy or per-frame subarray allocations.
 */
function smoothDenseLiquidInteriors(
  target: Uint8ClampedArray,
  materials: Uint8Array,
  density: Uint8Array,
  liquidByMaterial: Uint8Array,
  colorByMaterial: Uint8Array,
  styleByMaterial: Uint8Array,
  scratch: LiquidSurfaceScratch,
  width: number,
  height: number,
): void {
  if (width < 3 || height < 3) return;
  const rows = scratch.rowBytes;
  const rowLength = width * 4;
  copyPixelRow(scratch.sourceRows[0], scratch.rowPixels, 0);
  copyPixelRow(scratch.sourceRows[1], scratch.rowPixels, width);

  for (let y = 1; y < height - 1; y++) {
    if (y + 1 < height) {
      copyPixelRow(
        scratch.sourceRows[y + 1], scratch.rowPixels,
        ((y + 1) % LIQUID_ROW_COUNT) * width,
      );
    }
    const previousRow = ((y - 1) % LIQUID_ROW_COUNT) * rowLength;
    const currentRow = (y % LIQUID_ROW_COUNT) * rowLength;
    const nextRow = ((y + 1) % LIQUID_ROW_COUNT) * rowLength;

    for (let x = 1; x < width - 1; x++) {
      const index = y * width + x;
      const pixel = index * 4;
      const localPixel = x * 4;
      if (density[pixel + 3] < LIQUID_INTERIOR_FIELD_ALPHA
        || rows[currentRow + localPixel + 3] < LIQUID_INTERIOR_PIXEL_ALPHA) continue;

      const material = materials[index];
      const topIndex = index - width;
      const leftIndex = index - 1;
      const rightIndex = index + 1;
      const bottomIndex = index + width;
      const species = material || materials[topIndex];
      if (!species || !isSmoothLiquidMaterial(species, liquidByMaterial, styleByMaterial)) continue;
      const color = species * 3;
      if (material === 0 && !matchesCanonicalField(density, pixel, colorByMaterial, color)) continue;
      if (rows[previousRow + localPixel + 3] < LIQUID_DONOR_PIXEL_ALPHA
        || rows[currentRow + localPixel - 1] < LIQUID_DONOR_PIXEL_ALPHA
        || rows[currentRow + localPixel + 7] < LIQUID_DONOR_PIXEL_ALPHA
        || rows[nextRow + localPixel + 3] < LIQUID_DONOR_PIXEL_ALPHA) continue;
      if ((materials[topIndex] !== species && !isDenseReconstructedSpecies(
        materials[topIndex], density, topIndex * 4, colorByMaterial, color,
      )) || (materials[leftIndex] !== species && !isDenseReconstructedSpecies(
        materials[leftIndex], density, leftIndex * 4, colorByMaterial, color,
      )) || (materials[rightIndex] !== species && !isDenseReconstructedSpecies(
        materials[rightIndex], density, rightIndex * 4, colorByMaterial, color,
      )) || (materials[bottomIndex] !== species && !isDenseReconstructedSpecies(
        materials[bottomIndex], density, bottomIndex * 4, colorByMaterial, color,
      ))) continue;

      const topLeft = index - width - 1;
      const topRight = index - width + 1;
      const bottomLeft = index + width - 1;
      const bottomRight = index + width + 1;
      if (!(
        (materials[topLeft] === species && rows[previousRow + localPixel - 1] >= LIQUID_DONOR_PIXEL_ALPHA)
        || (materials[topRight] === species && rows[previousRow + localPixel + 7] >= LIQUID_DONOR_PIXEL_ALPHA)
        || (materials[bottomLeft] === species && rows[nextRow + localPixel - 1] >= LIQUID_DONOR_PIXEL_ALPHA)
        || (materials[bottomRight] === species && rows[nextRow + localPixel + 7] >= LIQUID_DONOR_PIXEL_ALPHA)
      )) continue;

      const centerRed = rows[currentRow + localPixel];
      const centerGreen = rows[currentRow + localPixel + 1];
      const centerBlue = rows[currentRow + localPixel + 2];
      target[pixel] = centerRed + LIQUID_NEIGHBOUR_GAIN * (
        rows[previousRow + localPixel] + rows[currentRow + localPixel - 4]
        + rows[currentRow + localPixel + 4] + rows[nextRow + localPixel] - centerRed * 4
      );
      target[pixel + 1] = centerGreen + LIQUID_NEIGHBOUR_GAIN * (
        rows[previousRow + localPixel + 1] + rows[currentRow + localPixel - 3]
        + rows[currentRow + localPixel + 5] + rows[nextRow + localPixel + 1] - centerGreen * 4
      );
      target[pixel + 2] = centerBlue + LIQUID_NEIGHBOUR_GAIN * (
        rows[previousRow + localPixel + 2] + rows[currentRow + localPixel - 2]
        + rows[currentRow + localPixel + 6] + rows[nextRow + localPixel + 2] - centerBlue * 4
      );
    }
  }
}

function isDenseReconstructedSpecies(
  material: number,
  density: Uint8Array,
  pixel: number,
  colorByMaterial: Uint8Array,
  color: number,
): boolean {
  return material === 0 && density[pixel + 3] >= LIQUID_INTERIOR_FIELD_ALPHA
    && matchesCanonicalField(density, pixel, colorByMaterial, color);
}

function matchesCanonicalField(
  density: Uint8Array,
  pixel: number,
  colorByMaterial: Uint8Array,
  color: number,
): boolean {
  return colorByMaterial[color] === density[pixel]
    && colorByMaterial[color + 1] === density[pixel + 1]
    && colorByMaterial[color + 2] === density[pixel + 2];
}

function isSmoothLiquidMaterial(
  material: number,
  liquidByMaterial: Uint8Array,
  styleByMaterial: Uint8Array,
): boolean {
  return liquidByMaterial[material] !== 0
    && styleByMaterial[material * 4 + 2] === 0
    && styleByMaterial[material * 4 + 3] === 0;
}

function copyPixelRow(
  source: Uint32Array,
  target: Uint32Array,
  targetOffset: number,
): void {
  target.set(source, targetOffset);
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const amount = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return amount * amount * (3 - 2 * amount);
}

function clamp(value: number): number { return Math.max(0, Math.min(255, Math.round(value))); }
