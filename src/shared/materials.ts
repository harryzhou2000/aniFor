export const enum Material {
  Empty = 0,
  Sand = 1,
  Water = 2,
  Wall = 3,
  Fire = 4,
  Smoke = 5,
  Dust = 6,
  Salt = 7,
  Oil = 8,
  Wood = 9,
  Plant = 10,
  Lava = 11,
  Ice = 12,
  Acid = 13,
  Gunpowder = 14,
}

export interface MaterialInfo {
  readonly id: Material;
  readonly name: string;
  readonly description: string;
  readonly color: string;
  readonly icon: string;
}

export const MATERIALS: readonly MaterialInfo[] = [
  { id: Material.Sand, name: 'Sand', description: 'Pours and settles', color: '#d7aa68', icon: '●' },
  { id: Material.Water, name: 'Water', description: 'Flows into spaces', color: '#5cb9c8', icon: '●' },
  { id: Material.Wall, name: 'Stone', description: 'Shapes the world', color: '#8b8174', icon: '■' },
  { id: Material.Fire, name: 'Ember', description: 'Rises and fades', color: '#ff8052', icon: '◆' },
  { id: Material.Smoke, name: 'Mist', description: 'Drifts upward', color: '#9d9891', icon: '○' },
  { id: Material.Dust, name: 'Dust', description: 'Fine airborne powder', color: '#c9b58d', icon: '·' },
  { id: Material.Salt, name: 'Salt', description: 'Crystals that dissolve', color: '#eee6d5', icon: '✦' },
  { id: Material.Oil, name: 'Oil', description: 'Flammable heavy liquid', color: '#8f7040', icon: '●' },
  { id: Material.Wood, name: 'Wood', description: 'A combustible solid', color: '#9b6038', icon: '▥' },
  { id: Material.Plant, name: 'Plant', description: 'Grows when watered', color: '#65a95f', icon: '✳' },
  { id: Material.Lava, name: 'Lava', description: 'Molten and intensely hot', color: '#ff4d21', icon: '◆' },
  { id: Material.Ice, name: 'Ice', description: 'Frozen water', color: '#a7e5ec', icon: '◇' },
  { id: Material.Acid, name: 'Acid', description: 'Corrodes many materials', color: '#a9db55', icon: '●' },
  { id: Material.Gunpowder, name: 'Powder', description: 'Explodes when ignited', color: '#5d554d', icon: '⁙' },
];
