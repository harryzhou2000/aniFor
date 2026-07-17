export const enum Material {
  Empty = 0,
  Sand = 1,
  Water = 2,
  Wall = 3,
  Fire = 4,
  Smoke = 5,
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
];
