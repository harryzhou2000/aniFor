import type { FieldRect } from './dirty-chunk-grid';
import { Material } from '../shared/materials';
import { RenderPhase } from './render-profile';

export const BOUNDARY_STABILITY_STEP = 48;
export const POWDER_SETTLE_SPEED = 3;
export const POWDER_RELEASE_SPEED = 10;
export const POWDER_SETTLE_SUPPORT = 2;
/** WebGL-only packed marker for a fully settled powder cell touching ordinary solid matter. */
export const POWDER_SOLID_CONTACT_STABILITY = 254;

/**
 * Advances presentation-only powder settling with temporal hysteresis while
 * preserving same-owner Liquid/Solid bytes for their independent depth scans.
 *
 * A powder cell must keep both its semantic owner and compatible contact while
 * slow for several refreshes before it joins a bulk contour. Intermediate
 * velocity preserves the previous state; definite motion, lost contact, or an
 * owner change releases it immediately. Phase/owner changes clear depth bytes,
 * so nearby gas/liquid motion cannot perturb a rigid edge or retain stale depth.
 */
export function updateBoundaryStabilityRect(
  target: Uint8Array,
  previousMaterials: Uint8Array,
  materials: Uint8Array,
  velocities: Int8Array | undefined,
  styleBytes: Uint8Array,
  fieldWidth: number,
  rect: FieldRect,
  dirty?: { markCell(index: number): void },
  encodePowderSolidContact = false,
  walls?: Uint8Array,
): void {
  const fieldHeight = Math.floor(materials.length / fieldWidth);
  if (target.length !== materials.length || previousMaterials.length !== materials.length
    || (walls !== undefined && walls.length !== materials.length)) {
    throw new Error('Boundary stability field size mismatch');
  }
  const left = Math.max(0, rect.x);
  const top = Math.max(0, rect.y);
  const right = Math.min(fieldWidth, rect.x + rect.width);
  const bottom = Math.min(fieldHeight, rect.y + rect.height);
  for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
    const index = y * fieldWidth + x;
    const material = materials[index];
    const phase = material ? styleBytes[material * 4] : -1;
    if (phase === RenderPhase.Liquid || phase === RenderPhase.Solid) {
      if (previousMaterials[index] !== material) {
        if (target[index] !== 0) dirty?.markCell(index);
        target[index] = 0;
      }
      previousMaterials[index] = material;
      continue;
    }
    if (phase !== RenderPhase.Powder) {
      if (target[index] !== 0) dirty?.markCell(index);
      target[index] = 0;
      previousMaterials[index] = material;
      continue;
    }

    const support = compatiblePowderSupport(materials, styleBytes, fieldWidth, fieldHeight, x, y);
    const sameOwner = previousMaterials[index] === material;
    // Byte 254 is reserved for this Powder-only marker. Always restore the
    // logical settled value before evolution so disabling E09 clears it without
    // a second state plane; Liquid/Solid bytes returned above remain untouched.
    let stability = target[index] === POWDER_SOLID_CONTACT_STABILITY ? 255 : target[index];
    if (support < POWDER_SETTLE_SUPPORT) {
      stability = 0;
    } else if (!velocities) {
      stability = 255;
    } else if (!sameOwner) {
      stability = 0;
    } else {
      const velocityX = velocities[index * 2];
      const velocityY = velocities[index * 2 + 1];
      const speedSquared = velocityX * velocityX + velocityY * velocityY;
      if (speedSquared >= POWDER_RELEASE_SPEED * POWDER_RELEASE_SPEED) {
        stability = 0;
      } else if (speedSquared <= POWDER_SETTLE_SPEED * POWDER_SETTLE_SPEED) {
        stability = Math.min(255, stability + BOUNDARY_STABILITY_STEP);
      }
    }
    const packedStability = encodePowderSolidContact && stability === 255
      && hasOrdinaryPowderSolidContact(
        materials, walls, styleBytes, fieldWidth, fieldHeight, x, y,
      )
      ? POWDER_SOLID_CONTACT_STABILITY : stability;
    if (target[index] !== packedStability) dirty?.markCell(index);
    target[index] = packedStability;
    previousMaterials[index] = material;
  }
}

function hasOrdinaryPowderSolidContact(
  materials: Uint8Array,
  walls: Uint8Array | undefined,
  styleBytes: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
): boolean {
  const sourceIndex = y * width + x;
  const source = materials[sourceIndex];
  const sourceStyleOffset = source * 4;
  if (!source || (walls && walls[sourceIndex] !== 0)
    || styleBytes[sourceStyleOffset] !== RenderPhase.Powder
    || styleBytes[sourceStyleOffset + 2] !== 0 || styleBytes[sourceStyleOffset + 3] !== 0) {
    return false;
  }
  // E09 is a settled-body cue, not a one-cell grain/column effect. Requiring
  // exact Powder ownership on both horizontal sides keeps the packed marker
  // categorical and output-scale independent without adding a density field.
  if (x <= 0 || x + 1 >= width) return false;
  const left = materials[sourceIndex - 1];
  const right = materials[sourceIndex + 1];
  if (!left || !right || styleBytes[left * 4] !== RenderPhase.Powder
    || styleBytes[right * 4] !== RenderPhase.Powder) return false;
  // Left/right are already proven Powder, so only the vertical cardinals can
  // be the required Solid contact. Keep this hot full-grid path allocation-free.
  return (y > 0 && ordinarySolidAt(materials, walls, styleBytes, sourceIndex - width))
    || (y + 1 < height
      && ordinarySolidAt(materials, walls, styleBytes, sourceIndex + width));
}

function ordinarySolidAt(
  materials: Uint8Array,
  walls: Uint8Array | undefined,
  styleBytes: Uint8Array,
  index: number,
): boolean {
  const candidate = materials[index];
  if (!candidate || candidate === Material.Wall || (walls && walls[index] !== 0)) return false;
  const styleOffset = candidate * 4;
  return styleBytes[styleOffset] === RenderPhase.Solid
    && styleBytes[styleOffset + 2] === 0 && styleBytes[styleOffset + 3] === 0;
}

function compatiblePowderSupport(
  materials: Uint8Array,
  styleBytes: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  let support = 0;
  for (let offsetY = -1; offsetY <= 1; offsetY++) for (let offsetX = -1; offsetX <= 1; offsetX++) {
    if (offsetX === 0 && offsetY === 0) continue;
    const candidateX = x + offsetX;
    const candidateY = y + offsetY;
    if (candidateX < 0 || candidateY < 0 || candidateX >= width || candidateY >= height) continue;
    const candidate = materials[candidateY * width + candidateX];
    if (!candidate) continue;
    const phase = styleBytes[candidate * 4];
    if (phase === RenderPhase.Powder || phase === RenderPhase.Solid) support++;
  }
  return support;
}
