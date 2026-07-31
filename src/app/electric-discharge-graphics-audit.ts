import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

export const ELECTRIC_DISCHARGE_GRAPHICS_ATLAS_COLUMNS = 2;
export const ELECTRIC_DISCHARGE_GRAPHICS_ATLAS_ROWS = 1;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 8;
const CARD_ORIGIN_Y = 8;
const CARD_STRIDE_X = 298;
const CARD_WIDTH = 290;
const CARD_HEIGHT = 368;

const ELECTRIC_DISCHARGE_DEFINITIONS = [
  { material: Material.LIGH, code: 'LIGH', color: '#ffffaa' },
  { material: Material.THDR, code: 'THDR', color: '#88aaff' },
] as const;

export interface ElectricDischargeGraphicsPoint {
  readonly x: number;
  readonly y: number;
}

export interface ElectricDischargeGraphicsRect extends ElectricDischargeGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

export interface ElectricDischargeContactControl {
  /** Exact discharge material on the left side of the contact seam. */
  readonly owner: ElectricDischargeGraphicsRect;
  /** A disjoint ordinary material abutting the owner's right edge. */
  readonly unlike: ElectricDischargeGraphicsRect;
  readonly unlikeMaterial: Material.Metal | Material.Water;
}

export interface ElectricDischargeGraphicsAtlasEntry {
  readonly material: Material.LIGH | Material.THDR;
  readonly code: 'LIGH' | 'THDR';
  readonly color: string;
  readonly index: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly card: ElectricDischargeGraphicsRect;
  /** Large exact-material body for volume and density styling. */
  readonly body: ElectricDischargeGraphicsRect;
  /** Authored empty cavity which must never acquire semantic ownership. */
  readonly hole: ElectricDischargeGraphicsRect;
  /** Empty path that reaches the body's edge rather than forming a cavity. */
  readonly openChannel: readonly ElectricDischargeGraphicsPoint[];
  /** One-cell-wide exact-material conductor/stroke control. */
  readonly thinStem: ElectricDischargeGraphicsRect;
  /** Branched exact-material discharge topology, separate from the dense body. */
  readonly branch: readonly ElectricDischargeGraphicsPoint[];
  readonly isolated: ElectricDischargeGraphicsPoint;
  readonly guardedBlank: ElectricDischargeGraphicsRect;
  readonly metalContact: ElectricDischargeContactControl;
  readonly waterContact: ElectricDischargeContactControl;
  /**
   * THDR's semantic powder-mode column. It intentionally carries only THDR
   * material bytes; the eventual mode/style test selects powder presentation.
   */
  readonly powderColumn?: ElectricDischargeGraphicsRect;
  /** A one-cell branch from the THDR powder column. */
  readonly powderBranch?: readonly ElectricDischargeGraphicsPoint[];
  /** Authored empty interruption in the THDR powder column. */
  readonly powderGap?: ElectricDischargeGraphicsPoint;
}

export interface ElectricDischargeGraphicsAuditSnapshot {
  readonly cards: readonly ElectricDischargeGraphicsAtlasEntry[];
  readonly holes: readonly ElectricDischargeGraphicsPoint[];
  readonly openChannels: readonly ElectricDischargeGraphicsPoint[];
  readonly thinStems: readonly ElectricDischargeGraphicsPoint[];
  readonly branches: readonly ElectricDischargeGraphicsPoint[];
  readonly isolated: readonly ElectricDischargeGraphicsPoint[];
  readonly guardedBlanks: readonly ElectricDischargeGraphicsRect[];
  readonly metalContacts: readonly ElectricDischargeContactControl[];
  readonly waterContacts: readonly ElectricDischargeContactControl[];
  readonly thunderPowderColumns: readonly ElectricDischargeGraphicsRect[];
  readonly thunderPowderBranches: readonly ElectricDischargeGraphicsPoint[];
  readonly thunderPowderGaps: readonly ElectricDischargeGraphicsPoint[];
}

/** Stable 2-card atlas for LIGH/THDR Canvas and WebGL discharge styling gates. */
export const ELECTRIC_DISCHARGE_GRAPHICS_ATLAS: readonly ElectricDischargeGraphicsAtlasEntry[] =
  ELECTRIC_DISCHARGE_DEFINITIONS.map(({ material, code, color }, index) => {
    const card = { x: CARD_ORIGIN_X + index * CARD_STRIDE_X, y: CARD_ORIGIN_Y, width: CARD_WIDTH, height: CARD_HEIGHT };
    const body = { x: card.x + 22, y: card.y + 22, width: 126, height: 126 };
    const powderColumn = material === Material.THDR
      ? { x: card.x + 178, y: card.y + 30, width: 9, height: 116 }
      : undefined;
    const powderGap = powderColumn ? { x: powderColumn.x + 4, y: powderColumn.y + 56 } : undefined;
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
      hole: { x: body.x + 58, y: body.y + 58, width: 8, height: 8 },
      openChannel: Array.from({ length: 16 }, (_, offset) => ({
        x: body.x + body.width - 1 - offset,
        y: body.y + 90,
      })),
      thinStem: { x: card.x + 164, y: card.y + 176, width: 1, height: 112 },
      branch: [
        { x: card.x + 165, y: card.y + 210 }, { x: card.x + 166, y: card.y + 211 },
        { x: card.x + 167, y: card.y + 212 }, { x: card.x + 168, y: card.y + 213 },
        { x: card.x + 165, y: card.y + 246 }, { x: card.x + 166, y: card.y + 245 },
        { x: card.x + 167, y: card.y + 244 }, { x: card.x + 168, y: card.y + 243 },
      ],
      isolated: { x: card.x + 206, y: card.y + 178 },
      guardedBlank: { x: card.x + 192, y: card.y + 226, width: 66, height: 42 },
      metalContact: {
        owner: { x: card.x + 26, y: card.y + 308, width: 30, height: 22 },
        unlike: { x: card.x + 56, y: card.y + 308, width: 30, height: 22 },
        unlikeMaterial: Material.Metal,
      },
      waterContact: {
        owner: { x: card.x + 126, y: card.y + 308, width: 30, height: 22 },
        unlike: { x: card.x + 156, y: card.y + 308, width: 30, height: 22 },
        unlikeMaterial: Material.Water,
      },
      powderColumn,
      powderBranch: powderColumn ? [
        { x: powderColumn.x + powderColumn.width, y: powderColumn.y + 22 },
        { x: powderColumn.x + powderColumn.width + 1, y: powderColumn.y + 23 },
        { x: powderColumn.x + powderColumn.width + 2, y: powderColumn.y + 24 },
        { x: powderColumn.x - 1, y: powderColumn.y + 86 },
        { x: powderColumn.x - 2, y: powderColumn.y + 87 },
      ] : undefined,
      powderGap,
    };
  });

export const ELECTRIC_DISCHARGE_GRAPHICS_AUDIT: ElectricDischargeGraphicsAuditSnapshot = {
  cards: ELECTRIC_DISCHARGE_GRAPHICS_ATLAS,
  holes: ELECTRIC_DISCHARGE_GRAPHICS_ATLAS.flatMap(({ hole }) => rectPoints(hole)),
  openChannels: ELECTRIC_DISCHARGE_GRAPHICS_ATLAS.flatMap(({ openChannel }) => openChannel),
  thinStems: ELECTRIC_DISCHARGE_GRAPHICS_ATLAS.flatMap(({ thinStem }) => rectPoints(thinStem)),
  branches: ELECTRIC_DISCHARGE_GRAPHICS_ATLAS.flatMap(({ branch }) => branch),
  isolated: ELECTRIC_DISCHARGE_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
  guardedBlanks: ELECTRIC_DISCHARGE_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
  metalContacts: ELECTRIC_DISCHARGE_GRAPHICS_ATLAS.map(({ metalContact }) => metalContact),
  waterContacts: ELECTRIC_DISCHARGE_GRAPHICS_ATLAS.map(({ waterContact }) => waterContact),
  thunderPowderColumns: ELECTRIC_DISCHARGE_GRAPHICS_ATLAS.flatMap(({ powderColumn }) => powderColumn ? [powderColumn] : []),
  thunderPowderBranches: ELECTRIC_DISCHARGE_GRAPHICS_ATLAS.flatMap(({ powderBranch }) => powderBranch ?? []),
  thunderPowderGaps: ELECTRIC_DISCHARGE_GRAPHICS_ATLAS.flatMap(({ powderGap }) => powderGap ? [powderGap] : []),
};

/** Direct-fills the paused deterministic backend; no brush or powder-mode ABI is invoked. */
export function prepareElectricDischargeGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (simulation.name !== 'TypeScript deterministic fallback') {
    throw new Error('Electric discharge graphics audit fixture requires the deterministic backend');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Electric discharge graphics audit fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of ELECTRIC_DISCHARGE_GRAPHICS_ATLAS) {
    fillRect(cells, simulation.width, entry.body, entry.material);
    fillRect(cells, simulation.width, entry.hole, Material.Empty);
    for (const point of entry.openChannel) cells[point.y * simulation.width + point.x] = Material.Empty;
    fillRect(cells, simulation.width, entry.thinStem, entry.material);
    for (const point of entry.branch) cells[point.y * simulation.width + point.x] = entry.material;
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = entry.material;
    fillRect(cells, simulation.width, entry.guardedBlank, Material.Empty);
    fillRect(cells, simulation.width, entry.metalContact.owner, entry.material);
    fillRect(cells, simulation.width, entry.metalContact.unlike, Material.Metal);
    fillRect(cells, simulation.width, entry.waterContact.owner, entry.material);
    fillRect(cells, simulation.width, entry.waterContact.unlike, Material.Water);
    if (entry.powderColumn) fillRect(cells, simulation.width, entry.powderColumn, entry.material);
    for (const point of entry.powderBranch ?? []) cells[point.y * simulation.width + point.x] = entry.material;
    if (entry.powderGap) cells[entry.powderGap.y * simulation.width + entry.powderGap.x] = Material.Empty;
  }
}

function fillRect(cells: Uint8Array, worldWidth: number, rect: ElectricDischargeGraphicsRect, material: Material): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * worldWidth + rect.x, y * worldWidth + rect.x + rect.width);
  }
}

function rectPoints(rect: ElectricDischargeGraphicsRect): ElectricDischargeGraphicsPoint[] {
  const points: ElectricDischargeGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}
