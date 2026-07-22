import type { FieldRect } from './dirty-chunk-grid';

/**
 * Packs native wall IDs into R while preserving exterior air in G and the
 * independent native presentation state in B/A.
 */
export function packWallRect(target: Uint8Array, fieldWidth: number, walls: Uint8Array, rect: FieldRect): void {
  const right = Math.min(fieldWidth, rect.x + rect.width);
  const fieldHeight = Math.floor(walls.length / fieldWidth);
  const bottom = Math.min(fieldHeight, rect.y + rect.height);
  for (let y = Math.max(0, rect.y); y < bottom; y++) for (let x = Math.max(0, rect.x); x < right; x++) {
    const index = y * fieldWidth + x;
    const offset = index * 4;
    target[offset] = walls[index];
  }
}

/** Packs exact border-connected air into the unused G channel without another texture. */
export function packExteriorAir(target: Uint8Array, exteriorAir: Uint8Array): void {
  if (target.length !== exteriorAir.length * 4) throw new Error('Exterior-air field size mismatch');
  for (let index = 0; index < exteriorAir.length; index++) {
    target[index * 4 + 1] = exteriorAir[index];
  }
}

/**
 * Packs one exact world-space native presentation value into the otherwise
 * unused B/A wall channels. Wall and exterior-air ownership remain untouched.
 */
export function packPresentationStateRect(
  target: Uint8Array,
  fieldWidth: number,
  presentationState: Uint16Array,
  rect: FieldRect,
): void {
  if (target.length !== presentationState.length * 4) {
    throw new Error('Presentation-state field size mismatch');
  }
  const right = Math.min(fieldWidth, rect.x + rect.width);
  const fieldHeight = Math.floor(presentationState.length / fieldWidth);
  const bottom = Math.min(fieldHeight, rect.y + rect.height);
  for (let y = Math.max(0, rect.y); y < bottom; y++) {
    for (let x = Math.max(0, rect.x); x < right; x++) {
      const index = y * fieldWidth + x;
      const offset = index * 4;
      const state = presentationState[index];
      target[offset + 2] = state & 0xFF;
      target[offset + 3] = state >>> 8;
    }
  }
}
