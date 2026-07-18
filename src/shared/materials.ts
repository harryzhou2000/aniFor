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
  // Native reaction products. These IDs are part of the rendering ABI but are
  // intentionally omitted from MATERIALS, so they do not become brush tools.
  Steam = 15,
  SaltWater = 16,
  Gas = 17,
  Snow = 18,
  Coal = 19,
  Plasma = 20,
  Stone = 21,
  Brick = 22,
  Metal = 23,
  Glass = 24,
  Ceramic = 25,
  Concrete = 26,
  Wax = 27,
  Clay = 28,
  Quartz = 29,
  Thermite = 30,
  C4 = 31,
  Nitro = 32,
  Firework = 33,
  DistilledWater = 34,
  Diesel = 35,
  Mercury = 36,
  LiquidNitrogen = 37,
  Soap = 38,
  Oxygen = 39,
  Hydrogen = 40,
  CarbonDioxide = 41,
  NobleGas = 42,
}

export type MaterialCategory = 'powders' | 'liquids' | 'solids' | 'gases' | 'energy' | 'explosives' | 'special';

export interface MaterialInfo {
  readonly id: Material;
  readonly name: string;
  readonly description: string;
  readonly color: string;
  readonly icon: string;
  readonly category: MaterialCategory;
  readonly selectable: boolean;
}

export const ALL_MATERIALS: readonly MaterialInfo[] = [
  { id: Material.Sand, name: 'Sand', description: 'Pours and settles', color: '#d7aa68', icon: '●', category: 'powders', selectable: true },
  { id: Material.Water, name: 'Water', description: 'Flows into spaces', color: '#5cb9c8', icon: '●', category: 'liquids', selectable: true },
  { id: Material.Wall, name: 'Diamond', description: 'Indestructible walls', color: '#8b8174', icon: '■', category: 'solids', selectable: true },
  { id: Material.Fire, name: 'Fire', description: 'Ignites flammable materials', color: '#ff8052', icon: '◆', category: 'energy', selectable: true },
  { id: Material.Smoke, name: 'Smoke', description: 'Drifts upward', color: '#9d9891', icon: '○', category: 'gases', selectable: true },
  { id: Material.Dust, name: 'Dust', description: 'Light flammable powder', color: '#c9b58d', icon: '·', category: 'powders', selectable: true },
  { id: Material.Salt, name: 'Salt', description: 'Crystals that dissolve', color: '#eee6d5', icon: '✦', category: 'powders', selectable: true },
  { id: Material.Oil, name: 'Oil', description: 'Flammable liquid', color: '#8f7040', icon: '●', category: 'liquids', selectable: true },
  { id: Material.Wood, name: 'Wood', description: 'A combustible solid', color: '#9b6038', icon: '▥', category: 'solids', selectable: true },
  { id: Material.Plant, name: 'Plant', description: 'Drinks water and grows', color: '#65a95f', icon: '✳', category: 'solids', selectable: true },
  { id: Material.Lava, name: 'Lava', description: 'Molten and intensely hot', color: '#ff4d21', icon: '◆', category: 'liquids', selectable: true },
  { id: Material.Ice, name: 'Ice', description: 'Frozen water', color: '#a7e5ec', icon: '◇', category: 'solids', selectable: true },
  { id: Material.Acid, name: 'Acid', description: 'Corrodes many materials', color: '#d35ee8', icon: '●', category: 'liquids', selectable: true },
  { id: Material.Gunpowder, name: 'Gunpowder', description: 'Explodes when ignited', color: '#5d554d', icon: '⁙', category: 'explosives', selectable: true },
  { id: Material.Steam, name: 'Steam', description: 'Hot water vapour', color: '#b9dce2', icon: '○', category: 'gases', selectable: false },
  { id: Material.SaltWater, name: 'Salt Water', description: 'Conductive saline water', color: '#5c9fb6', icon: '●', category: 'liquids', selectable: false },
  { id: Material.Gas, name: 'Gas', description: 'Flammable hydrocarbon gas', color: '#c6b35d', icon: '○', category: 'gases', selectable: false },
  { id: Material.Snow, name: 'Snow', description: 'Powdered ice', color: '#e4f5f7', icon: '·', category: 'powders', selectable: false },
  { id: Material.Coal, name: 'Coal', description: 'Slow-burning carbon', color: '#2d2926', icon: '■', category: 'solids', selectable: false },
  { id: Material.Plasma, name: 'Plasma', description: 'Extremely hot ionized gas', color: '#d879ff', icon: '◆', category: 'energy', selectable: false },
  { id: Material.Stone, name: 'Stone', description: 'Heavy breakable stone', color: '#77736d', icon: '■', category: 'powders', selectable: true },
  { id: Material.Brick, name: 'Brick', description: 'Rigid breakable brick', color: '#a65e4b', icon: '▦', category: 'solids', selectable: true },
  { id: Material.Metal, name: 'Metal', description: 'Conductive meltable solid', color: '#667086', icon: '■', category: 'solids', selectable: true },
  { id: Material.Glass, name: 'Glass', description: 'Transparent pressure-resistant solid', color: '#b9d8d2', icon: '□', category: 'solids', selectable: true },
  { id: Material.Ceramic, name: 'Ceramic', description: 'Heat-resistant brittle solid', color: '#d8d0be', icon: '■', category: 'solids', selectable: true },
  { id: Material.Concrete, name: 'Concrete', description: 'Heavy structural powder', color: '#86837d', icon: '⁙', category: 'powders', selectable: true },
  { id: Material.Wax, name: 'Wax', description: 'Melts and burns', color: '#e0c278', icon: '■', category: 'solids', selectable: true },
  { id: Material.Clay, name: 'Clay', description: 'Wettable clay dust', color: '#b87955', icon: '·', category: 'powders', selectable: true },
  { id: Material.Quartz, name: 'Quartz', description: 'Pressure-sensitive crystal powder', color: '#d8b0c2', icon: '✦', category: 'powders', selectable: true },
  { id: Material.Thermite, name: 'Thermite', description: 'Burns into molten metal', color: '#9f4b32', icon: '⁙', category: 'explosives', selectable: true },
  { id: Material.C4, name: 'C-4', description: 'Pressure-sensitive explosive', color: '#c8c4a6', icon: '⁙', category: 'explosives', selectable: true },
  { id: Material.Nitro, name: 'Nitro', description: 'Explosive liquid', color: '#b7a66a', icon: '●', category: 'explosives', selectable: true },
  { id: Material.Firework, name: 'Firework', description: 'Colourful explosive powder', color: '#9c72c7', icon: '✦', category: 'explosives', selectable: true },
  { id: Material.DistilledWater, name: 'Distilled', description: 'Pure non-conductive water', color: '#75cfdf', icon: '●', category: 'liquids', selectable: true },
  { id: Material.Diesel, name: 'Diesel', description: 'Combustible liquid fuel', color: '#9b7d3d', icon: '●', category: 'liquids', selectable: true },
  { id: Material.Mercury, name: 'Mercury', description: 'Dense conductive liquid metal', color: '#a8afba', icon: '●', category: 'liquids', selectable: true },
  { id: Material.LiquidNitrogen, name: 'Liquid N₂', description: 'Cryogenic liquid', color: '#9bdaf2', icon: '●', category: 'liquids', selectable: true },
  { id: Material.Soap, name: 'Soap', description: 'Forms bubbles in water', color: '#a8d8bc', icon: '●', category: 'liquids', selectable: true },
  { id: Material.Oxygen, name: 'Oxygen', description: 'Supports combustion', color: '#80b8e8', icon: '○', category: 'gases', selectable: true },
  { id: Material.Hydrogen, name: 'Hydrogen', description: 'Light explosive gas', color: '#e4e0d5', icon: '○', category: 'gases', selectable: true },
  { id: Material.CarbonDioxide, name: 'CO₂', description: 'Suppresses fire', color: '#8d9293', icon: '○', category: 'gases', selectable: true },
  { id: Material.NobleGas, name: 'Noble Gas', description: 'Glows when electrically charged', color: '#c277d7', icon: '○', category: 'gases', selectable: true },
];

export const MATERIALS: readonly MaterialInfo[] = ALL_MATERIALS.filter(({ selectable }) => selectable);
