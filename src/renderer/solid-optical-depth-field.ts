import { RenderPhase } from './render-profile';
import { Material } from '../shared/materials';

/** Six bytes per exact-species cell reaches full absorption after 43 cells. */
export const SOLID_OPTICAL_DEPTH_STEP = 6;

/**
 * Writes a two-pass exact-species distance-to-surface field into the phase-local
 * auxiliary byte already shared by powder stability and liquid column depth.
 *
 * Only ordinary solid cells are touched. World/native-wall edges and every
 * unlike-material contact are surfaces at depth zero. The forward/reverse
 * Manhattan passes then measure thickness without allocating scratch storage.
 * Coverage and ownership never consume this field, so thin authored strokes,
 * holes, seams, and single particles remain categorical and byte-exact.
 */
export function writeSolidOpticalDepth(
  materials: Uint8Array,
  target: Uint8Array,
  styleBytes: Uint8Array,
  width: number,
  walls?: Uint8Array,
  spongePorosity = true,
): void {
  if (width <= 0 || materials.length % width !== 0
    || target.length !== materials.length
    || (walls !== undefined && walls.length !== materials.length)) {
    throw new Error('Solid optical depth field size mismatch');
  }
  const height = materials.length / width;

  if (walls === undefined) {
    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        const index = row + x;
        const material = materials[index];
        if (material === 0 || material === Material.Wall
          || styleBytes[material * 4] !== RenderPhase.Solid) continue;
        const exposed = x === 0 || y === 0 || x + 1 === width || y + 1 === height
          || materials[index - 1] !== material || materials[index + 1] !== material
          || materials[index - width] !== material || materials[index + width] !== material;
        target[index] = exposed ? 0 : 255;
      }
    }
  } else {
    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        const index = row + x;
        const material = materials[index];
        if (material === 0 || material === Material.Wall
          || styleBytes[material * 4] !== RenderPhase.Solid) continue;
        const exposed = walls[index] !== 0
          || x === 0 || y === 0 || x + 1 === width || y + 1 === height
          || materials[index - 1] !== material || materials[index + 1] !== material
          || materials[index - width] !== material || materials[index + width] !== material
          || walls[index - 1] !== 0 || walls[index + 1] !== 0
          || walls[index - width] !== 0 || walls[index + width] !== 0;
        target[index] = exposed ? 0 : 255;
      }
    }
  }

  for (let y = 1; y + 1 < height; y++) for (let x = 1; x + 1 < width; x++) {
    const index = y * width + x;
    if (target[index] !== 255) continue;
    const material = materials[index];
    if (material === 0 || material === Material.Wall
      || styleBytes[material * 4] !== RenderPhase.Solid) continue;
    target[index] = Math.min(
      255,
      Math.min(target[index - 1], target[index - width]) + SOLID_OPTICAL_DEPTH_STEP,
    );
  }

  for (let y = height - 2; y > 0; y--) for (let x = width - 2; x > 0; x--) {
    const index = y * width + x;
    const material = materials[index];
    if (material === 0 || material === Material.Wall
      || styleBytes[material * 4] !== RenderPhase.Solid) continue;
    target[index] = Math.min(
      target[index],
      Math.min(255, Math.min(target[index + 1], target[index + width]) + SOLID_OPTICAL_DEPTH_STEP),
    );
  }

  if (spongePorosity) applySpongeOpticalPorosity(materials, target, width, height);
}

/**
 * Encodes pore relief in the existing phase-local depth byte after the exact
 * distance transform is complete. The fragment shader already consumes this
 * field, so SPNG gains volume without another branch, sampler, upload, or
 * output-resolution resource. Surface/thin cells stay at their exact depth.
 */
function applySpongeOpticalPorosity(
  materials: Uint8Array,
  target: Uint8Array,
  width: number,
  height: number,
): void {
  for (let y = 1; y + 1 < height; y++) for (let x = 1; x + 1 < width; x++) {
    const index = y * width + x;
    const depth = target[index];
    if (materials[index] !== Material.SPNG || depth <= SOLID_OPTICAL_DEPTH_STEP) continue;
    const localX = x % 19;
    const localY = y % 19;
    const firstX = localX - 5;
    const firstY = localY - 5;
    const secondX = localX - 14;
    const secondY = localY - 12;
    const firstRadius = firstX * firstX + firstY * firstY;
    const secondRadius = secondX * secondX + secondY * secondY;
    const core = firstRadius <= 4 || secondRadius <= 3;
    const firstWall = firstRadius >= 5 && firstRadius <= 12;
    const secondWall = secondRadius >= 4 && secondRadius <= 10;
    const litLip = (firstWall && firstX + firstY <= -2)
      || (secondWall && secondX + secondY <= -2);
    if (litLip) target[index] = Math.max(SOLID_OPTICAL_DEPTH_STEP + 1, depth - 90);
    else if (core) target[index] = Math.min(255, depth + 36);
    else if (firstWall || secondWall) target[index] = Math.min(255, depth + 24);
  }
}
