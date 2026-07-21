import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

export const UNUSUAL_POWDER_GRAPHICS_ATLAS_COLUMNS = 5;
export const UNUSUAL_POWDER_GRAPHICS_ATLAS_ROWS = 2;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 8;
const CARD_ORIGIN_Y = 8;
const CARD_STRIDE_X = 120;
const CARD_STRIDE_Y = 184;
const CARD_WIDTH = 112;
const CARD_HEIGHT = 168;

const UNUSUAL_POWDER_DEFINITIONS = [
  { material: Material.ANAR, code: 'ANAR', color: '#ffffee' },
  { material: Material.BGLA, code: 'BGLA', color: '#606060' },
  { material: Material.BREC, code: 'BREC', color: '#707060' },
  { material: Material.BRMT, code: 'BRMT', color: '#705060' },
  { material: Material.FRZZ, code: 'FRZZ', color: '#c0e0ff' },
  { material: Material.GRAV, code: 'GRAV', color: '#202020' },
  { material: Material.SAWD, code: 'SAWD', color: '#f0f0a0' },
  { material: Material.SLCN, code: 'SLCN', color: '#bccddf' },
  { material: Material.DYST, code: 'DYST', color: '#bbb0a0' },
  { material: Material.BCOL, code: 'BCOL', color: '#333333' },
] as const;

export interface UnusualPowderGraphicsPoint {
  readonly x: number;
  readonly y: number;
}

export interface UnusualPowderGraphicsRect extends UnusualPowderGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

export interface UnusualPowderContactControl {
  /** Exact card material on the left side of the contact seam. */
  readonly owner: UnusualPowderGraphicsRect;
  /** A disjoint Sand control abutting the owner's right edge. */
  readonly unlike: UnusualPowderGraphicsRect;
  readonly unlikeMaterial: Material.Sand;
}

export interface UnusualPowderGraphicsAtlasEntry {
  readonly material: Material;
  readonly code: string;
  readonly color: string;
  readonly index: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly card: UnusualPowderGraphicsRect;
  readonly body: UnusualPowderGraphicsRect;
  readonly hole: UnusualPowderGraphicsRect;
  /** Three vertically adjacent empty cells open through the body's right edge. */
  readonly openNotch: readonly UnusualPowderGraphicsPoint[];
  readonly thinColumn: UnusualPowderGraphicsRect;
  readonly isolated: UnusualPowderGraphicsPoint;
  readonly guardedBlank: UnusualPowderGraphicsRect;
  readonly contact: UnusualPowderContactControl;
}

export interface UnusualPowderGraphicsAuditSnapshot {
  readonly cards: readonly UnusualPowderGraphicsAtlasEntry[];
  readonly holes: readonly UnusualPowderGraphicsPoint[];
  readonly openNotches: readonly UnusualPowderGraphicsPoint[];
  readonly thinColumns: readonly UnusualPowderGraphicsPoint[];
  readonly isolated: readonly UnusualPowderGraphicsPoint[];
  readonly guardedBlanks: readonly UnusualPowderGraphicsRect[];
  readonly contacts: readonly UnusualPowderContactControl[];
}

/** Stable 5x2 atlas shared by paired Canvas/WebGL material-style gates. */
export const UNUSUAL_POWDER_GRAPHICS_ATLAS: readonly UnusualPowderGraphicsAtlasEntry[] =
  UNUSUAL_POWDER_DEFINITIONS.map(({ material, code, color }, index) => {
    const column = index % UNUSUAL_POWDER_GRAPHICS_ATLAS_COLUMNS;
    const row = Math.floor(index / UNUSUAL_POWDER_GRAPHICS_ATLAS_COLUMNS);
    const card = {
      x: CARD_ORIGIN_X + column * CARD_STRIDE_X,
      y: CARD_ORIGIN_Y + row * CARD_STRIDE_Y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    };
    const body = { x: card.x + 8, y: card.y + 10, width: 58, height: 64 };
    const contactY = card.y + 120;
    return {
      material,
      code,
      color,
      index,
      left: card.x,
      top: card.y,
      width: card.width,
      height: card.height,
      card,
      body,
      hole: { x: body.x + 26, y: body.y + 30, width: 2, height: 2 },
      openNotch: Array.from({ length: 3 }, (_, offset) => ({
        x: body.x + body.width - 1,
        y: body.y + 42 + offset,
      })),
      thinColumn: { x: card.x + 79, y: card.y + 12, width: 1, height: 58 },
      isolated: { x: card.x + 97, y: card.y + 18 },
      guardedBlank: { x: card.x + 76, y: card.y + 86, width: 28, height: 20 },
      contact: {
        owner: { x: card.x + 12, y: contactY, width: 8, height: 12 },
        unlike: { x: card.x + 20, y: contactY, width: 8, height: 12 },
        unlikeMaterial: Material.Sand,
      },
    };
  });

export const UNUSUAL_POWDER_GRAPHICS_AUDIT: UnusualPowderGraphicsAuditSnapshot = {
  cards: UNUSUAL_POWDER_GRAPHICS_ATLAS,
  holes: UNUSUAL_POWDER_GRAPHICS_ATLAS.flatMap(({ hole }) => rectPoints(hole)),
  openNotches: UNUSUAL_POWDER_GRAPHICS_ATLAS.flatMap(({ openNotch }) => openNotch),
  thinColumns: UNUSUAL_POWDER_GRAPHICS_ATLAS.flatMap(({ thinColumn }) => rectPoints(thinColumn)),
  isolated: UNUSUAL_POWDER_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
  guardedBlanks: UNUSUAL_POWDER_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
  contacts: UNUSUAL_POWDER_GRAPHICS_ATLAS.map(({ contact }) => contact),
};

/**
 * Direct-fills the paused deterministic backend. This deliberately supports the
 * render-only DYST projection and never crosses the ordinary particle-brush ABI.
 */
export function prepareUnusualPowderGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (simulation.name !== 'TypeScript deterministic fallback') {
    throw new Error('Unusual powder graphics audit fixture requires the deterministic backend');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Unusual powder graphics audit fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of UNUSUAL_POWDER_GRAPHICS_ATLAS) {
    fillRect(cells, simulation.width, entry.body, entry.material);
    fillRect(cells, simulation.width, entry.hole, Material.Empty);
    for (const point of entry.openNotch) {
      cells[point.y * simulation.width + point.x] = Material.Empty;
    }
    fillRect(cells, simulation.width, entry.thinColumn, entry.material);
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = entry.material;
    fillRect(cells, simulation.width, entry.guardedBlank, Material.Empty);
    fillRect(cells, simulation.width, entry.contact.owner, entry.material);
    fillRect(cells, simulation.width, entry.contact.unlike, entry.contact.unlikeMaterial);
  }
}

function fillRect(
  cells: Uint8Array,
  worldWidth: number,
  rect: UnusualPowderGraphicsRect,
  material: Material,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * worldWidth + rect.x, y * worldWidth + rect.x + rect.width);
  }
}

function rectPoints(rect: UnusualPowderGraphicsRect): UnusualPowderGraphicsPoint[] {
  const points: UnusualPowderGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}
