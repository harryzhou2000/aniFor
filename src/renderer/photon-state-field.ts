import type { FieldRect } from './dirty-chunk-grid';

/** Packs the independent uint16 PHOT projection into a nearest RGBA8 texture. */
export function packPhotonStateRect(
  target: Uint8Array,
  fieldWidth: number,
  photonState: Uint16Array,
  rect: FieldRect,
): void {
  if (target.length !== photonState.length * 4) {
    throw new Error('Photon-state field size mismatch');
  }
  const right = Math.min(fieldWidth, rect.x + rect.width);
  const fieldHeight = Math.floor(photonState.length / fieldWidth);
  const bottom = Math.min(fieldHeight, rect.y + rect.height);
  for (let y = Math.max(0, rect.y); y < bottom; y++) {
    for (let x = Math.max(0, rect.x); x < right; x++) {
      const index = y * fieldWidth + x;
      const offset = index * 4;
      const state = photonState[index];
      target[offset] = state & 0xFF;
      target[offset + 1] = state >>> 8;
      target[offset + 2] = 0;
      target[offset + 3] = 0;
    }
  }
}
