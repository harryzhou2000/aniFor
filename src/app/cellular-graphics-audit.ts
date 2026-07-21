import { LIFE_PRESETS, Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

export const CELLULAR_GRAPHICS_ATLAS_COLUMNS = 6;
export const CELLULAR_GRAPHICS_ATLAS_ROWS = 4;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 8;
const CARD_ORIGIN_Y = 8;
const CARD_STRIDE_X = 100;
const CARD_STRIDE_Y = 92;
const CARD_WIDTH = 96;
const CARD_HEIGHT = 84;

export interface CellularGraphicsPoint {
  readonly x: number;
  readonly y: number;
}

export interface CellularGraphicsRect extends CellularGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

export interface CellularGraphicsAtlasEntry {
  readonly material: Material;
  /** Native PT_LIFE ctype index. */
  readonly preset: number;
  readonly code: string;
  readonly color: string;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly card: CellularGraphicsRect;
  readonly body: CellularGraphicsRect;
  readonly hole: CellularGraphicsRect;
  readonly tendril: readonly CellularGraphicsPoint[];
  readonly isolated: CellularGraphicsPoint;
  /** An explicit empty control region protected from the authored geometry. */
  readonly guardedBlank: CellularGraphicsRect;
}

export interface CellularGraphicsAuditSnapshot {
  readonly cards: readonly CellularGraphicsAtlasEntry[];
  readonly holes: readonly CellularGraphicsPoint[];
  readonly isolated: readonly CellularGraphicsPoint[];
}

/** Stable 6x4 atlas shared by Canvas, WebGL, and true-8x browser gates. */
export const CELLULAR_GRAPHICS_ATLAS: readonly CellularGraphicsAtlasEntry[] = LIFE_PRESETS.map(
  ({ preset, material, code, color }, index) => {
    const column = index % CELLULAR_GRAPHICS_ATLAS_COLUMNS;
    const row = Math.floor(index / CELLULAR_GRAPHICS_ATLAS_COLUMNS);
    const card = {
      x: CARD_ORIGIN_X + column * CARD_STRIDE_X,
      y: CARD_ORIGIN_Y + row * CARD_STRIDE_Y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    };
    const body = { x: card.x + 8, y: card.y + 8, width: 54, height: 42 };
    return {
      material,
      preset,
      code,
      color,
      left: card.x,
      top: card.y,
      width: card.width,
      height: card.height,
      card,
      body,
      hole: { x: body.x + 25, y: body.y + 19, width: 2, height: 2 },
      tendril: Array.from({ length: 6 }, (_, offset) => ({
        x: body.x + body.width + offset,
        y: body.y + body.height - 1 + offset,
      })),
      isolated: { x: card.x + 78, y: card.y + 18 },
      guardedBlank: { x: card.x + 72, y: card.y + 55, width: 18, height: 20 },
    };
  },
);

export const CELLULAR_GRAPHICS_AUDIT: CellularGraphicsAuditSnapshot = {
  cards: CELLULAR_GRAPHICS_ATLAS,
  holes: CELLULAR_GRAPHICS_ATLAS.flatMap(({ hole }) => rectPoints(hole)),
  isolated: CELLULAR_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
};

/**
 * Direct-fills the paused deterministic backend so projection-only LIFE IDs
 * cannot accidentally cross the ordinary particle-brush ABI.
 */
export function prepareCellularGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (simulation.name !== 'TypeScript deterministic fallback') {
    throw new Error('Cellular graphics audit fixture requires the deterministic backend');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Cellular graphics audit fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of CELLULAR_GRAPHICS_ATLAS) {
    fillRect(cells, simulation.width, entry.body, entry.material);
    fillRect(cells, simulation.width, entry.hole, Material.Empty);
    for (const point of entry.tendril) cells[point.y * simulation.width + point.x] = entry.material;
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = entry.material;
    fillRect(cells, simulation.width, entry.guardedBlank, Material.Empty);
  }
}

function fillRect(
  cells: Uint8Array,
  worldWidth: number,
  rect: CellularGraphicsRect,
  material: Material,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * worldWidth + rect.x, y * worldWidth + rect.x + rect.width);
  }
}

function rectPoints(rect: CellularGraphicsRect): CellularGraphicsPoint[] {
  const points: CellularGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}
