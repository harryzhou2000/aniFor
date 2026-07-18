import { ALL_MATERIALS, Material } from '../shared/materials';

export interface CellStyle { color: number; alpha: number; radius: number; glow?: number }

const styles: Record<number, CellStyle> = {
  [Material.Sand]: { color: 0xd7aa68, alpha: 0.96, radius: 0.48 },
  [Material.Water]: { color: 0x55b7c8, alpha: 0.72, radius: 0.56 },
  [Material.Wall]: { color: 0x898077, alpha: 1, radius: 0.45 },
  [Material.Fire]: { color: 0xff7145, alpha: 0.9, radius: 0.62, glow: 0xff9c55 },
  [Material.Smoke]: { color: 0xa6a09a, alpha: 0.32, radius: 0.68 },
  [Material.Dust]: { color: 0xc9b58d, alpha: 0.86, radius: 0.42 },
  [Material.Salt]: { color: 0xeee6d5, alpha: 0.98, radius: 0.44 },
  [Material.Oil]: { color: 0x8f7040, alpha: 0.78, radius: 0.56 },
  [Material.Wood]: { color: 0x9b6038, alpha: 1, radius: 0.48 },
  [Material.Plant]: { color: 0x65a95f, alpha: 0.96, radius: 0.5 },
  [Material.Lava]: { color: 0xff4d21, alpha: 0.96, radius: 0.58, glow: 0xff7a32 },
  [Material.Ice]: { color: 0xa7e5ec, alpha: 0.9, radius: 0.5 },
  [Material.Acid]: { color: 0xa9db55, alpha: 0.76, radius: 0.56 },
  [Material.Gunpowder]: { color: 0x5d554d, alpha: 0.98, radius: 0.44 },
};

for (const material of ALL_MATERIALS) {
  if (styles[material.id]) continue;
  const gas = material.category === 'gases';
  const energy = material.category === 'energy';
  const liquid = material.category === 'liquids';
  styles[material.id] = {
    color: Number.parseInt(material.color.slice(1), 16),
    alpha: gas ? 0.38 : liquid ? 0.8 : 0.96,
    radius: gas ? 0.68 : liquid ? 0.56 : 0.48,
    ...(energy ? { glow: Number.parseInt(material.color.slice(1), 16) } : {}),
  };
}

export function cellStyle(material: Material): CellStyle | undefined { return styles[material]; }

export function tintVariation(index: number): number {
  let value = Math.imul(index + 41, 2654435761);
  value ^= value >>> 16;
  return ((value >>> 28) - 8) / 110;
}
