import type { FieldRect } from './dirty-chunk-grid';
import { RenderPhase } from './render-profile';

export const BOUNDARY_STABILITY_STEP = 48;
export const POWDER_SETTLE_SPEED = 3;
export const POWDER_RELEASE_SPEED = 10;
export const POWDER_SETTLE_SUPPORT = 2;

/**
 * Advances presentation-only powder settling with temporal hysteresis.
 *
 * A powder cell must keep both its semantic owner and compatible contact while
 * slow for several refreshes before it joins a bulk contour. Intermediate
 * velocity preserves the previous state; definite motion, lost contact, or an
 * owner change releases it immediately. Solids and fluids never contribute to
 * each other's state, so nearby gas/liquid motion cannot perturb a rigid edge.
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
): void {
  const fieldHeight = Math.floor(materials.length / fieldWidth);
  if (target.length !== materials.length || previousMaterials.length !== materials.length) {
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
    if (phase === RenderPhase.Liquid) {
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
    let stability = target[index];
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
    if (target[index] !== stability) dirty?.markCell(index);
    target[index] = stability;
    previousMaterials[index] = material;
  }
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
