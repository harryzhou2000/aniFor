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
}
