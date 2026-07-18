import type { FieldRect } from './dirty-chunk-grid';

/** Packs native wall IDs into an independent RGBA texture. */
export function packWallRect(target: Uint8Array, fieldWidth: number, walls: Uint8Array, rect: FieldRect): void {
  const right = Math.min(fieldWidth, rect.x + rect.width);
  const fieldHeight = Math.floor(walls.length / fieldWidth);
  const bottom = Math.min(fieldHeight, rect.y + rect.height);
  for (let y = Math.max(0, rect.y); y < bottom; y++) for (let x = Math.max(0, rect.x); x < right; x++) {
    const index = y * fieldWidth + x;
    const offset = index * 4;
    target[offset] = walls[index];
    target[offset + 1] = 0;
    target[offset + 2] = 0;
    target[offset + 3] = 255;
  }
}
