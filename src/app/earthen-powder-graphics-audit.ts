import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

export const EARTHEN_POWDER_GRAPHICS_ATLAS_COLUMNS = 2;
export const EARTHEN_POWDER_GRAPHICS_ATLAS_ROWS = 2;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 8;
const CARD_ORIGIN_Y = 8;
const CARD_STRIDE_X = 180;
const CARD_STRIDE_Y = 184;
const CARD_WIDTH = 168;
const CARD_HEIGHT = 168;

const EARTHEN_POWDER_DEFINITIONS = [
  { material: Material.Dust, code: 'DUST', color: '#c9b58d' },
  { material: Material.Stone, code: 'STNE', color: '#77736d' },
  { material: Material.Concrete, code: 'CNCT', color: '#86837d' },
  { material: Material.Clay, code: 'CLAY', color: '#b87955' },
] as const;

export interface EarthenPowderGraphicsPoint {
  readonly x: number;
  readonly y: number;
}

export interface EarthenPowderGraphicsRect extends EarthenPowderGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

export interface EarthenPowderContactControl {
  /** Exact card material on the left side of the contact seam. */
  readonly owner: EarthenPowderGraphicsRect;
  /** A disjoint Metal control abutting the owner's right edge. */
  readonly unlike: EarthenPowderGraphicsRect;
  readonly unlikeMaterial: Material.Metal;
}

export interface EarthenPowderGraphicsAtlasEntry {
  readonly material: Material;
  readonly code: string;
  readonly color: string;
  readonly index: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly card: EarthenPowderGraphicsRect;
  /** A dense settled pile/column, deliberately large enough for body shading. */
  readonly body: EarthenPowderGraphicsRect;
  /** A deliberately non-reconstructable 6x6 authored cavity. */
  readonly hole: EarthenPowderGraphicsRect;
  /** Three vertically adjacent empty cells open through the body's right edge. */
  readonly openNotch: readonly EarthenPowderGraphicsPoint[];
  /** A one-cell-wide free-standing fine column. */
  readonly thinColumn: EarthenPowderGraphicsRect;
  readonly isolated: EarthenPowderGraphicsPoint;
  readonly guardedBlank: EarthenPowderGraphicsRect;
  readonly contact: EarthenPowderContactControl;
}

export interface EarthenPowderGraphicsAuditSnapshot {
  readonly cards: readonly EarthenPowderGraphicsAtlasEntry[];
  readonly holes: readonly EarthenPowderGraphicsPoint[];
  readonly openNotches: readonly EarthenPowderGraphicsPoint[];
  readonly thinColumns: readonly EarthenPowderGraphicsPoint[];
  readonly isolated: readonly EarthenPowderGraphicsPoint[];
  readonly guardedBlanks: readonly EarthenPowderGraphicsRect[];
  readonly contacts: readonly EarthenPowderContactControl[];
}

/** Stable four-card atlas for true-8x earthen powder identity and topology gates. */
export const EARTHEN_POWDER_GRAPHICS_ATLAS: readonly EarthenPowderGraphicsAtlasEntry[] =
  EARTHEN_POWDER_DEFINITIONS.map(({ material, code, color }, index) => {
    const card = {
      x: CARD_ORIGIN_X + (index % EARTHEN_POWDER_GRAPHICS_ATLAS_COLUMNS) * CARD_STRIDE_X,
      y: CARD_ORIGIN_Y + Math.floor(index / EARTHEN_POWDER_GRAPHICS_ATLAS_COLUMNS) * CARD_STRIDE_Y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    };
    const body = { x: card.x + 8, y: card.y + 10, width: 68, height: 64 };
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
      hole: { x: body.x + 30, y: body.y + 28, width: 6, height: 6 },
      openNotch: Array.from({ length: 3 }, (_, offset) => ({
        x: body.x + body.width - 1,
        y: body.y + 42 + offset,
      })),
      thinColumn: { x: card.x + 98, y: card.y + 12, width: 1, height: 58 },
      isolated: { x: card.x + 124, y: card.y + 18 },
      guardedBlank: { x: card.x + 94, y: card.y + 86, width: 48, height: 20 },
      contact: {
        owner: { x: card.x + 12, y: contactY, width: 8, height: 12 },
        unlike: { x: card.x + 20, y: contactY, width: 8, height: 12 },
        unlikeMaterial: Material.Metal,
      },
    };
  });

export const EARTHEN_POWDER_GRAPHICS_AUDIT: EarthenPowderGraphicsAuditSnapshot = {
  cards: EARTHEN_POWDER_GRAPHICS_ATLAS,
  holes: EARTHEN_POWDER_GRAPHICS_ATLAS.flatMap(({ hole }) => rectPoints(hole)),
  openNotches: EARTHEN_POWDER_GRAPHICS_ATLAS.flatMap(({ openNotch }) => openNotch),
  thinColumns: EARTHEN_POWDER_GRAPHICS_ATLAS.flatMap(({ thinColumn }) => rectPoints(thinColumn)),
  isolated: EARTHEN_POWDER_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
  guardedBlanks: EARTHEN_POWDER_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
  contacts: EARTHEN_POWDER_GRAPHICS_ATLAS.map(({ contact }) => contact),
};

/** Direct-fill only: audit topology must not exercise powder motion or the brush ABI. */
export function prepareEarthenPowderGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (simulation.name !== 'TypeScript deterministic fallback') {
    throw new Error('Earthen powder graphics audit fixture requires the deterministic backend');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Earthen powder graphics audit fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of EARTHEN_POWDER_GRAPHICS_ATLAS) {
    fillRect(cells, simulation.width, entry.body, entry.material);
    fillRect(cells, simulation.width, entry.hole, Material.Empty);
    for (const point of entry.openNotch) cells[point.y * simulation.width + point.x] = Material.Empty;
    fillRect(cells, simulation.width, entry.thinColumn, entry.material);
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = entry.material;
    fillRect(cells, simulation.width, entry.guardedBlank, Material.Empty);
    fillRect(cells, simulation.width, entry.contact.owner, entry.material);
    fillRect(cells, simulation.width, entry.contact.unlike, entry.contact.unlikeMaterial);
  }
}

function fillRect(cells: Uint8Array, worldWidth: number, rect: EarthenPowderGraphicsRect, material: Material): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * worldWidth + rect.x, y * worldWidth + rect.x + rect.width);
  }
}

function rectPoints(rect: EarthenPowderGraphicsRect): EarthenPowderGraphicsPoint[] {
  const points: EarthenPowderGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}
