import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

export const EXPLOSIVE_POWDER_GRAPHICS_ATLAS_COLUMNS = 7;
export const EXPLOSIVE_POWDER_GRAPHICS_ATLAS_ROWS = 2;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 4;
const CARD_ORIGIN_Y = 4;
const CARD_STRIDE_X = 86;
const CARD_STRIDE_Y = 184;
const CARD_WIDTH = 82;
const CARD_HEIGHT = 168;

const EXPLOSIVE_POWDER_DEFINITIONS = [
  { material: Material.Gunpowder, code: 'GUNP', color: '#5d554d' },
  { material: Material.Thermite, code: 'THRM', color: '#9f4b32' },
  { material: Material.C4, code: 'PLEX', color: '#c8c4a6' },
  { material: Material.Firework, code: 'FWRK', color: '#9c72c7' },
  { material: Material.BANG, code: 'BANG', color: '#c05050' },
  { material: Material.BOMB, code: 'BOMB', color: '#fff288' },
  { material: Material.C5, code: 'C5', color: '#2050e0' },
  { material: Material.DEST, code: 'DEST', color: '#ff3311' },
  { material: Material.FIRW, code: 'FIRW', color: '#ffa040' },
  { material: Material.FSEP, code: 'FSEP', color: '#63ad5f' },
  { material: Material.FUSE, code: 'FUSE', color: '#0a5706' },
  { material: Material.IGNT, code: 'IGNT', color: '#c0b050' },
  { material: Material.LITH, code: 'LITH', color: '#b6aabf' },
  { material: Material.RBDM, code: 'RBDM', color: '#cccccc' },
] as const;

export interface ExplosivePowderGraphicsPoint {
  readonly x: number;
  readonly y: number;
}

export interface ExplosivePowderGraphicsRect extends ExplosivePowderGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

export interface ExplosivePowderContactControl {
  /** Exact explosive-powder material on the left side of the contact seam. */
  readonly owner: ExplosivePowderGraphicsRect;
  /** A disjoint Sand control abutting the owner's right edge. */
  readonly unlike: ExplosivePowderGraphicsRect;
  readonly unlikeMaterial: Material.Sand;
}

export interface ExplosivePowderGraphicsAtlasEntry {
  readonly material: Material;
  readonly code: string;
  readonly color: string;
  readonly index: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly card: ExplosivePowderGraphicsRect;
  readonly body: ExplosivePowderGraphicsRect;
  readonly hole: ExplosivePowderGraphicsRect;
  /** Three vertically adjacent empty cells open through the body's right edge. */
  readonly openNotch: readonly ExplosivePowderGraphicsPoint[];
  readonly thinColumn: ExplosivePowderGraphicsRect;
  readonly isolated: ExplosivePowderGraphicsPoint;
  readonly guardedBlank: ExplosivePowderGraphicsRect;
  readonly contact: ExplosivePowderContactControl;
  /** Wrong-phase control which explosive-powder styling must leave unchanged. */
  readonly waterControl: ExplosivePowderGraphicsRect;
  /** Solid control which explosive-powder styling must leave unchanged. */
  readonly metalControl: ExplosivePowderGraphicsRect;
}

export interface ExplosivePowderGraphicsAuditSnapshot {
  readonly cards: readonly ExplosivePowderGraphicsAtlasEntry[];
  readonly holes: readonly ExplosivePowderGraphicsPoint[];
  readonly openNotches: readonly ExplosivePowderGraphicsPoint[];
  readonly thinColumns: readonly ExplosivePowderGraphicsPoint[];
  readonly isolated: readonly ExplosivePowderGraphicsPoint[];
  readonly guardedBlanks: readonly ExplosivePowderGraphicsRect[];
  readonly contacts: readonly ExplosivePowderContactControl[];
  readonly waterControls: readonly ExplosivePowderGraphicsRect[];
  readonly metalControls: readonly ExplosivePowderGraphicsRect[];
}

/** Stable 7x2 atlas shared by paired Canvas/WebGL explosive-powder style gates. */
export const EXPLOSIVE_POWDER_GRAPHICS_ATLAS: readonly ExplosivePowderGraphicsAtlasEntry[] =
  EXPLOSIVE_POWDER_DEFINITIONS.map(({ material, code, color }, index) => {
    const column = index % EXPLOSIVE_POWDER_GRAPHICS_ATLAS_COLUMNS;
    const row = Math.floor(index / EXPLOSIVE_POWDER_GRAPHICS_ATLAS_COLUMNS);
    const card = {
      x: CARD_ORIGIN_X + column * CARD_STRIDE_X,
      y: CARD_ORIGIN_Y + row * CARD_STRIDE_Y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    };
    const body = { x: card.x + 5, y: card.y + 8, width: 42, height: 62 };
    const contactY = card.y + 112;
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
      hole: { x: body.x + 19, y: body.y + 29, width: 2, height: 2 },
      openNotch: Array.from({ length: 3 }, (_, offset) => ({
        x: body.x + body.width - 1,
        y: body.y + 41 + offset,
      })),
      thinColumn: { x: card.x + 54, y: card.y + 10, width: 1, height: 58 },
      isolated: { x: card.x + 72, y: card.y + 18 },
      guardedBlank: { x: card.x + 52, y: card.y + 78, width: 24, height: 18 },
      contact: {
        owner: { x: card.x + 7, y: contactY, width: 7, height: 10 },
        unlike: { x: card.x + 14, y: contactY, width: 7, height: 10 },
        unlikeMaterial: Material.Sand,
      },
      waterControl: { x: card.x + 39, y: contactY, width: 7, height: 10 },
      metalControl: { x: card.x + 60, y: contactY, width: 7, height: 10 },
    };
  });

export const EXPLOSIVE_POWDER_GRAPHICS_AUDIT: ExplosivePowderGraphicsAuditSnapshot = {
  cards: EXPLOSIVE_POWDER_GRAPHICS_ATLAS,
  holes: EXPLOSIVE_POWDER_GRAPHICS_ATLAS.flatMap(({ hole }) => rectPoints(hole)),
  openNotches: EXPLOSIVE_POWDER_GRAPHICS_ATLAS.flatMap(({ openNotch }) => openNotch),
  thinColumns: EXPLOSIVE_POWDER_GRAPHICS_ATLAS.flatMap(({ thinColumn }) => rectPoints(thinColumn)),
  isolated: EXPLOSIVE_POWDER_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
  guardedBlanks: EXPLOSIVE_POWDER_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
  contacts: EXPLOSIVE_POWDER_GRAPHICS_ATLAS.map(({ contact }) => contact),
  waterControls: EXPLOSIVE_POWDER_GRAPHICS_ATLAS.map(({ waterControl }) => waterControl),
  metalControls: EXPLOSIVE_POWDER_GRAPHICS_ATLAS.map(({ metalControl }) => metalControl),
};

/** Direct-fills the paused deterministic backend without crossing the particle-brush ABI. */
export function prepareExplosivePowderGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (simulation.name !== 'TypeScript deterministic fallback') {
    throw new Error('Explosive powder graphics audit fixture requires the deterministic backend');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Explosive powder graphics audit fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of EXPLOSIVE_POWDER_GRAPHICS_ATLAS) {
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
    fillRect(cells, simulation.width, entry.waterControl, Material.Water);
    fillRect(cells, simulation.width, entry.metalControl, Material.Metal);
  }
}

function fillRect(
  cells: Uint8Array,
  worldWidth: number,
  rect: ExplosivePowderGraphicsRect,
  material: Material,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * worldWidth + rect.x, y * worldWidth + rect.x + rect.width);
  }
}

function rectPoints(rect: ExplosivePowderGraphicsRect): ExplosivePowderGraphicsPoint[] {
  const points: ExplosivePowderGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}
