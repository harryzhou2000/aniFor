import { Material } from '../shared/materials';

export interface CellStyle { color: number; alpha: number; radius: number; glow?: number }

const styles: Record<number, CellStyle> = {
  [Material.Sand]: { color: 0xd7aa68, alpha: 0.96, radius: 0.48 },
  [Material.Water]: { color: 0x55b7c8, alpha: 0.72, radius: 0.56 },
  [Material.Wall]: { color: 0x898077, alpha: 1, radius: 0.45 },
  [Material.Fire]: { color: 0xff7145, alpha: 0.9, radius: 0.62, glow: 0xff9c55 },
  [Material.Smoke]: { color: 0xa6a09a, alpha: 0.32, radius: 0.68 },
};

export function cellStyle(material: Material): CellStyle | undefined { return styles[material]; }

export function tintVariation(index: number): number {
  let value = Math.imul(index + 41, 2654435761);
  value ^= value >>> 16;
  return ((value >>> 28) - 8) / 110;
}
