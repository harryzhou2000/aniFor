import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

export const WALL_LAB_QUERY = 'wall-lab';

interface WallPlate {
  readonly wall: number;
  readonly first: Material;
  readonly second: Material;
}

const WALL_PLATES: readonly WallPlate[] = [
  { wall: 8, first: Material.Sand, second: Material.Water },
  { wall: 1, first: Material.Metal, second: Material.SPRK },
  { wall: 2, first: Material.PHOT, second: Material.NEUT },
  { wall: 3, first: Material.Dust, second: Material.PHOT },
  { wall: 6, first: Material.Water, second: Material.Oil },
  { wall: 9, first: Material.Smoke, second: Material.Oxygen },
  { wall: 10, first: Material.Sand, second: Material.Salt },
  { wall: 13, first: Material.Oxygen, second: Material.NobleGas },
  { wall: 15, first: Material.PHOT, second: Material.NEUT },
  { wall: 16, first: Material.Smoke, second: Material.Water },
];

export function wallLabRequested(search = globalThis.location?.search ?? ''): boolean {
  return new URLSearchParams(search).get('scene') === WALL_LAB_QUERY;
}

/** A paused native-TPT atlas proving that wall and particle semantics coexist independently. */
export function applyWallLabScene(simulation: SimulationBackend): void {
  if (!simulation.paintWall) throw new Error('Native wall lab requires wall painting support');
  simulation.clear();
  const plot = new WallLabPlotter(simulation);

  WALL_PLATES.forEach((plate, index) => {
    const column = index % 5;
    const row = Math.floor(index / 5);
    const x = 18 + column * 119;
    const y = 20 + row * 181;
    plot.mixedGradient(x + 8, y + 8, 86, 140, plate.first, plate.second, 811 + index * 17);
    // Paint bmap second: solid native walls reject later particle creation, but
    // an existing particle and wall are independent fields in a paused save.
    plot.wallRect(x, y, 102, 156, plate.wall);
  });
}

class WallLabPlotter {
  constructor(private readonly simulation: SimulationBackend) {}

  wallRect(x: number, y: number, width: number, height: number, wall: number): void {
    for (let py = y; py < y + height; py += 4) {
      for (let px = x; px < x + width; px += 4) this.simulation.paintWall!(px, py, wall, 0);
    }
  }

  mixedGradient(
    x: number,
    y: number,
    width: number,
    height: number,
    first: Material,
    second: Material,
    salt: number,
  ): void {
    for (let py = y; py < y + height; py++) {
      const progress = (py - y) / Math.max(1, height - 1);
      const density = 0.14 + progress * 0.80;
      for (let px = x; px < x + width; px++) {
        if (noise(px, py, salt) > density) continue;
        const material = noise(px, py, salt + 97) < 0.5 ? first : second;
        this.simulation.paint(px, py, material, 0);
      }
    }
  }
}

function noise(x: number, y: number, salt: number): number {
  let value = Math.imul(x + salt, 0x9E3779B1) ^ Math.imul(y - salt, 0x85EBCA77);
  value = Math.imul(value ^ (value >>> 15), 0xC2B2AE3D);
  return ((value ^ (value >>> 16)) >>> 0) / 0xFFFFFFFF;
}
