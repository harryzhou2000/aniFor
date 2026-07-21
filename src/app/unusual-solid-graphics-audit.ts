import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

export const UNUSUAL_SOLID_GRAPHICS_ATLAS_COLUMNS = 7;
export const UNUSUAL_SOLID_GRAPHICS_ATLAS_ROWS = 1;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 6;
const CARD_ORIGIN_Y = 8;
const CARD_STRIDE_X = 86;
const CARD_WIDTH = 80;
const CARD_HEIGHT = 168;

const UNUSUAL_SOLID_DEFINITIONS = [
  { material: Material.BIZRS, code: 'BIZRS', color: '#00e455' },
  { material: Material.PSTS, code: 'PSTS', color: '#776677' },
  { material: Material.SHLD1, code: 'SHLD1', color: '#aaaaaa' },
  { material: Material.SHLD2, code: 'SHLD2', color: '#777777' },
  { material: Material.SHLD3, code: 'SHLD3', color: '#444444' },
  { material: Material.SHLD4, code: 'SHLD4', color: '#212121' },
  { material: Material.VRSS, code: 'VRSS', color: '#d408cd' },
] as const;

export interface UnusualSolidGraphicsPoint {
  readonly x: number;
  readonly y: number;
}

export interface UnusualSolidGraphicsRect extends UnusualSolidGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

export interface UnusualSolidShellControl {
  readonly outer: UnusualSolidGraphicsRect;
  readonly interior: UnusualSolidGraphicsRect;
}

export interface UnusualSolidContactControl {
  /** Exact card material on the left side of the contact seam. */
  readonly owner: UnusualSolidGraphicsRect;
  /** A disjoint Metal control abutting the owner's right edge. */
  readonly unlike: UnusualSolidGraphicsRect;
  readonly unlikeMaterial: Material.Metal;
}

export interface UnusualSolidGraphicsAtlasEntry {
  readonly material: Material;
  readonly code: string;
  readonly color: string;
  readonly index: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly card: UnusualSolidGraphicsRect;
  readonly body: UnusualSolidGraphicsRect;
  /** A deliberately non-reconstructable 6x6 authored cavity. */
  readonly hole: UnusualSolidGraphicsRect;
  /** Three vertically adjacent empty cells open through the body's right edge. */
  readonly openNotch: readonly UnusualSolidGraphicsPoint[];
  /** A disjoint one-cell-thick closed ring with an authored empty interior. */
  readonly shell: UnusualSolidShellControl;
  /** A one-cell-wide body-attached fine structure. */
  readonly spur: UnusualSolidGraphicsRect;
  readonly isolated: UnusualSolidGraphicsPoint;
  readonly guardedBlank: UnusualSolidGraphicsRect;
  readonly contact: UnusualSolidContactControl;
}

export interface UnusualSolidGraphicsAuditSnapshot {
  readonly cards: readonly UnusualSolidGraphicsAtlasEntry[];
  readonly holes: readonly UnusualSolidGraphicsPoint[];
  readonly openNotches: readonly UnusualSolidGraphicsPoint[];
  readonly shellCells: readonly UnusualSolidGraphicsPoint[];
  readonly shellInteriors: readonly UnusualSolidGraphicsPoint[];
  readonly spurs: readonly UnusualSolidGraphicsPoint[];
  readonly isolated: readonly UnusualSolidGraphicsPoint[];
  readonly guardedBlanks: readonly UnusualSolidGraphicsRect[];
  readonly contacts: readonly UnusualSolidContactControl[];
}

/** Stable seven-card atlas shared by paired Canvas/WebGL material-style gates. */
export const UNUSUAL_SOLID_GRAPHICS_ATLAS: readonly UnusualSolidGraphicsAtlasEntry[] =
  UNUSUAL_SOLID_DEFINITIONS.map(({ material, code, color }, index) => {
    const card = {
      x: CARD_ORIGIN_X + index * CARD_STRIDE_X,
      y: CARD_ORIGIN_Y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    };
    const body = { x: card.x + 5, y: card.y + 8, width: 48, height: 48 };
    const shellOuter = { x: card.x + 7, y: card.y + 70, width: 18, height: 18 };
    const contactY = card.y + 116;
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
      hole: { x: body.x + 20, y: body.y + 20, width: 6, height: 6 },
      openNotch: Array.from({ length: 3 }, (_, offset) => ({
        x: body.x + body.width - 1,
        y: body.y + 32 + offset,
      })),
      shell: {
        outer: shellOuter,
        interior: {
          x: shellOuter.x + 1,
          y: shellOuter.y + 1,
          width: shellOuter.width - 2,
          height: shellOuter.height - 2,
        },
      },
      spur: { x: body.x + 23, y: body.y + body.height, width: 1, height: 10 },
      isolated: { x: card.x + 70, y: card.y + 18 },
      guardedBlank: { x: card.x + 40, y: card.y + 74, width: 32, height: 22 },
      contact: {
        owner: { x: card.x + 10, y: contactY, width: 8, height: 12 },
        unlike: { x: card.x + 18, y: contactY, width: 8, height: 12 },
        unlikeMaterial: Material.Metal,
      },
    };
  });

export const UNUSUAL_SOLID_GRAPHICS_AUDIT: UnusualSolidGraphicsAuditSnapshot = {
  cards: UNUSUAL_SOLID_GRAPHICS_ATLAS,
  holes: UNUSUAL_SOLID_GRAPHICS_ATLAS.flatMap(({ hole }) => rectPoints(hole)),
  openNotches: UNUSUAL_SOLID_GRAPHICS_ATLAS.flatMap(({ openNotch }) => openNotch),
  shellCells: UNUSUAL_SOLID_GRAPHICS_ATLAS.flatMap(({ shell }) => shellPoints(shell)),
  shellInteriors: UNUSUAL_SOLID_GRAPHICS_ATLAS.flatMap(({ shell }) => rectPoints(shell.interior)),
  spurs: UNUSUAL_SOLID_GRAPHICS_ATLAS.flatMap(({ spur }) => rectPoints(spur)),
  isolated: UNUSUAL_SOLID_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
  guardedBlanks: UNUSUAL_SOLID_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
  contacts: UNUSUAL_SOLID_GRAPHICS_ATLAS.map(({ contact }) => contact),
};

/**
 * Direct-fills the paused deterministic backend. Projection-only solids must
 * never cross the ordinary particle-brush ABI during audit setup.
 */
export function prepareUnusualSolidGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (simulation.name !== 'TypeScript deterministic fallback') {
    throw new Error('Unusual solid graphics audit fixture requires the deterministic backend');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Unusual solid graphics audit fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of UNUSUAL_SOLID_GRAPHICS_ATLAS) {
    fillRect(cells, simulation.width, entry.body, entry.material);
    fillRect(cells, simulation.width, entry.hole, Material.Empty);
    for (const point of entry.openNotch) {
      cells[point.y * simulation.width + point.x] = Material.Empty;
    }
    fillRect(cells, simulation.width, entry.shell.outer, entry.material);
    fillRect(cells, simulation.width, entry.shell.interior, Material.Empty);
    fillRect(cells, simulation.width, entry.spur, entry.material);
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = entry.material;
    fillRect(cells, simulation.width, entry.guardedBlank, Material.Empty);
    fillRect(cells, simulation.width, entry.contact.owner, entry.material);
    fillRect(cells, simulation.width, entry.contact.unlike, entry.contact.unlikeMaterial);
  }
}

function fillRect(
  cells: Uint8Array,
  worldWidth: number,
  rect: UnusualSolidGraphicsRect,
  material: Material,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * worldWidth + rect.x, y * worldWidth + rect.x + rect.width);
  }
}

function rectPoints(rect: UnusualSolidGraphicsRect): UnusualSolidGraphicsPoint[] {
  const points: UnusualSolidGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}

function shellPoints(shell: UnusualSolidShellControl): UnusualSolidGraphicsPoint[] {
  return rectPoints(shell.outer).filter(({ x, y }) => (
    x < shell.interior.x || x >= shell.interior.x + shell.interior.width
      || y < shell.interior.y || y >= shell.interior.y + shell.interior.height
  ));
}
