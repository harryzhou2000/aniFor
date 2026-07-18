import type { FieldRect } from './dirty-chunk-grid';

/** Packs renderer semantics into RGBA8 without allocating per sample. */
export function packSemanticRect(
  target: Uint8Array,
  fieldWidth: number,
  materials: Uint8Array,
  temperatures: Uint16Array | undefined,
  velocities: Int8Array | undefined,
  rect: FieldRect,
): void {
  const right = Math.min(fieldWidth, rect.x + rect.width);
  const fieldHeight = Math.floor(materials.length / fieldWidth);
  const bottom = Math.min(fieldHeight, rect.y + rect.height);
  for (let y = Math.max(0, rect.y); y < bottom; y++) {
    for (let x = Math.max(0, rect.x); x < right; x++) {
      const index = y * fieldWidth + x;
      const offset = index * 4;
      target[offset] = materials[index];
      target[offset + 1] = temperatures ? temperatures[index] >>> 8 : 0;
      target[offset + 2] = velocities ? clampByte(velocities[index * 2] + 128) : 128;
      target[offset + 3] = velocities ? clampByte(velocities[index * 2 + 1] + 128) : 128;
    }
  }
}

function clampByte(value: number): number { return Math.max(0, Math.min(255, value)); }
