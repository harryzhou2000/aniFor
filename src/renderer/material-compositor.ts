import { MaterialId, type SimulationView } from "../simulation/contracts";

export type Rgba = readonly [number, number, number, number];

/** Deterministic, renderer-only cell treatment. It reads a borrowed view and never mutates it. */
export function sampleCompositedPixel(view: SimulationView, x: number, y: number): Rgba {
  const packed = composePacked(view, x, y);
  return [(packed >>> 24) & 255, (packed >>> 16) & 255, (packed >>> 8) & 255, packed & 255];
}

/** Allocation-free hot-path writer for the single packed full-texture upload. */
export function writeCompositedPixel(view: SimulationView, index: number, target: Uint8Array): void {
  const x = index % view.width;
  const y = (index - x) / view.width;
  const color = composePacked(view, x, y);
  const pixel = index * 4;
  target[pixel] = color >>> 24; target[pixel + 1] = (color >>> 16) & 255; target[pixel + 2] = (color >>> 8) & 255; target[pixel + 3] = color & 255;
}

function composePacked(view: SimulationView, x: number, y: number): number {
  const index = y * view.width + x;
  const material = view.material[index] ?? MaterialId.Empty;
  const life = view.lifetime[index] ?? 0;
  const temperature = view.temperature[index] ?? 200;
  const grain = ((x * 17 + y * 31 + (x ^ y) * 7) & 7) - 3;
  const exposed = exposedEdges(view, x, y, material);
  const same = sameNeighbors(view, x, y, material);

  switch (material) {
    case MaterialId.Wall: return pack(98 + grain + exposed * 4, 88 + grain + exposed * 3, 77 + grain, 255);
    case MaterialId.Sand: return pack(216 + grain, 177 + grain, 101 + grain - exposed * 3, 255);
    case MaterialId.Water: return pack(54 + exposed * 7, 127 + exposed * 10, 177 + exposed * 13, 255);
    case MaterialId.Oil: return pack(64 + exposed * 5, 73 + grain, 64 + exposed * 3, 255);
    case MaterialId.Wood: return pack(128 + grain * 2, 78 + grain, 47 + (same & 1) * 5, 255);
    case MaterialId.Ice: return pack(160 + exposed * 9, 208 + exposed * 7, 222 + grain, 235);
    case MaterialId.Acid: return pack(135 + exposed * 9, 190 + grain, 77 + exposed * 8, 255);
    case MaterialId.Fire: return fire(life, temperature, grain);
    case MaterialId.Smoke: return smoke(life, temperature, grain);
    case MaterialId.Steam: return steam(life, temperature, grain, exposed);
    default: return pack(20, 28, 40, 255); // Defined empty-world background, distinct from the outer stage.
  }
}

function exposedEdges(view: SimulationView, x: number, y: number, material: number): number {
  let edges = 0;
  if (x === 0 || view.material[y * view.width + x - 1] !== material) edges += 1;
  if (x === view.width - 1 || view.material[y * view.width + x + 1] !== material) edges += 1;
  if (y === 0 || view.material[(y - 1) * view.width + x] !== material) edges += 1;
  if (y === view.height - 1 || view.material[(y + 1) * view.width + x] !== material) edges += 1;
  return edges;
}

function sameNeighbors(view: SimulationView, x: number, y: number, material: number): number { return 4 - exposedEdges(view, x, y, material); }
function fire(life: number, temperature: number, grain: number): number {
  const heat = Math.max(0, Math.min(1, (temperature - 500) / 900));
  const fade = Math.max(.25, Math.min(1, life / 90));
  return pack(205 + Math.round(45 * heat), 58 + Math.round(104 * fade) + grain, 25 + Math.round(35 * (1 - heat)), 255);
}
function smoke(life: number, temperature: number, grain: number): number {
  const fade = Math.max(0, Math.min(1, life / 120));
  return pack(104 + grain, 117 + grain, 132 + Math.round((temperature - 200) / 80), Math.round(70 + 130 * fade));
}
function steam(life: number, temperature: number, grain: number, exposed: number): number {
  const heat = Math.max(0, Math.min(1, (temperature - 700) / 500));
  return pack(173 + exposed * 5, 201 + grain, 213 + Math.round(20 * heat), Math.round(95 + 110 * Math.min(1, life / 180)));
}
function pack(r: number, g: number, b: number, a: number): number { return ((clampByte(r) << 24) | (clampByte(g) << 16) | (clampByte(b) << 8) | clampByte(a)) >>> 0; }
function clampByte(value: number): number { return Math.max(0, Math.min(255, Math.round(value))); }
