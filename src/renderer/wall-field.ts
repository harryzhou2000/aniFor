import type { FieldRect } from './dirty-chunk-grid';

/** Packs native wall IDs into R while preserving the shared exterior-air G byte. */
export function packWallRect(target: Uint8Array, fieldWidth: number, walls: Uint8Array, rect: FieldRect): void {
  const right = Math.min(fieldWidth, rect.x + rect.width);
  const fieldHeight = Math.floor(walls.length / fieldWidth);
  const bottom = Math.min(fieldHeight, rect.y + rect.height);
  for (let y = Math.max(0, rect.y); y < bottom; y++) for (let x = Math.max(0, rect.x); x < right; x++) {
    const index = y * fieldWidth + x;
    const offset = index * 4;
    target[offset] = walls[index];
    target[offset + 2] = 0;
    target[offset + 3] = 255;
  }
}

/** Packs exact border-connected air into the unused G channel without another texture. */
export function packExteriorAir(target: Uint8Array, exteriorAir: Uint8Array): void {
  if (target.length !== exteriorAir.length * 4) throw new Error('Exterior-air field size mismatch');
  for (let index = 0; index < exteriorAir.length; index++) {
    target[index * 4 + 1] = exteriorAir[index];
  }
}
