import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

export const POWDER_MESOSTRATA_GRAPHICS_ATLAS_COLUMNS = 3;
export const POWDER_MESOSTRATA_GRAPHICS_ATLAS_ROWS = 1;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 8;
const CARD_ORIGIN_Y = 8;
const CARD_STRIDE_X = 200;
const CARD_WIDTH = 192;
const CONDUCTIVE_WALL = 1;

const POWDER_MESOSTRATA_DEFINITIONS = [
  { material: Material.Sand, code: 'SAND', color: '#c2a36a' },
  { material: Material.Clay, code: 'CLAY', color: '#b87955' },
  { material: Material.Concrete, code: 'CNCT', color: '#86837d' },
] as const;

export interface PowderMesostrataPoint { readonly x: number; readonly y: number }
export interface PowderMesostrataRect extends PowderMesostrataPoint {
  readonly width: number;
  readonly height: number;
}
export interface PowderMesostrataGraphicsAtlasEntry {
  readonly material: (typeof POWDER_MESOSTRATA_DEFINITIONS)[number]['material'];
  readonly code: string;
  readonly color: string;
  readonly index: number;
  readonly card: PowderMesostrataRect;
  /** Dense ordinary same-owner support for the proposed settled Smooth strata. */
  readonly settledBody: PowderMesostrataRect;
  readonly coreProbe: PowderMesostrataRect;
  readonly surfaceProbe: PowderMesostrataRect;
  readonly authoredHole: PowderMesostrataRect;
  readonly thinColumn: PowderMesostrataRect;
  readonly singleGrain: PowderMesostrataPoint;
  /** Two unsupported cells: no temporal support, hence not a stable body. */
  readonly unstablePair: readonly PowderMesostrataPoint[];
  /** Exact powder next to liquid; wet-sediment is explicitly not mesostrata. */
  readonly wetContact: { readonly powder: PowderMesostrataRect; readonly water: PowderMesostrataRect };
  /** A bmap wall coexists independently with settled powder. */
  readonly wallCoexistence: PowderMesostrataRect;
  readonly guardedBlank: PowderMesostrataRect;
}
export interface PowderMesostrataGraphicsAuditSnapshot {
  readonly cards: readonly PowderMesostrataGraphicsAtlasEntry[];
  readonly authoredHoles: readonly PowderMesostrataPoint[];
  readonly thinColumns: readonly PowderMesostrataPoint[];
  readonly singleGrains: readonly PowderMesostrataPoint[];
  readonly unstablePairs: readonly PowderMesostrataPoint[];
  readonly wetContacts: readonly PowderMesostrataGraphicsAtlasEntry['wetContact'][];
  readonly wallCoexistence: readonly PowderMesostrataRect[];
  readonly guardedBlanks: readonly PowderMesostrataRect[];
  readonly conductiveWall: number;
}

/** Dense settled powder bodies plus exact no-op topology/contact controls. */
export const POWDER_MESOSTRATA_GRAPHICS_ATLAS: readonly PowderMesostrataGraphicsAtlasEntry[] =
  POWDER_MESOSTRATA_DEFINITIONS.map(({ material, code, color }, index) => {
    const card = { x: CARD_ORIGIN_X + index * CARD_STRIDE_X, y: CARD_ORIGIN_Y, width: CARD_WIDTH, height: 368 };
    const settledBody = { x: card.x + 8, y: card.y + 12, width: 92, height: 86 };
    const wallX = card.x + 124 + ((4 - ((card.x + 124) % 4)) % 4);
    return {
      material, code, color, index, card, settledBody,
      coreProbe: { x: settledBody.x + 38, y: settledBody.y + 54, width: 12, height: 12 },
      surfaceProbe: { x: settledBody.x + 22, y: settledBody.y + 7, width: 12, height: 10 },
      authoredHole: { x: settledBody.x + 42, y: settledBody.y + 36, width: 7, height: 7 },
      thinColumn: { x: card.x + 112, y: card.y + 16, width: 1, height: 52 },
      singleGrain: { x: card.x + 128, y: card.y + 22 },
      unstablePair: [{ x: card.x + 144, y: card.y + 22 }, { x: card.x + 145, y: card.y + 23 }],
      wetContact: {
        powder: { x: card.x + 8, y: card.y + 120, width: 24, height: 18 },
        water: { x: card.x + 32, y: card.y + 120, width: 24, height: 18 },
      },
      wallCoexistence: { x: wallX, y: card.y + 116, width: 20, height: 20 },
      guardedBlank: { x: card.x + 72, y: card.y + 166, width: 72, height: 54 },
    } satisfies PowderMesostrataGraphicsAtlasEntry;
  });

export const POWDER_MESOSTRATA_GRAPHICS_AUDIT: PowderMesostrataGraphicsAuditSnapshot = {
  cards: POWDER_MESOSTRATA_GRAPHICS_ATLAS,
  authoredHoles: POWDER_MESOSTRATA_GRAPHICS_ATLAS.flatMap(({ authoredHole }) => rectPoints(authoredHole)),
  thinColumns: POWDER_MESOSTRATA_GRAPHICS_ATLAS.flatMap(({ thinColumn }) => rectPoints(thinColumn)),
  singleGrains: POWDER_MESOSTRATA_GRAPHICS_ATLAS.map(({ singleGrain }) => singleGrain),
  unstablePairs: POWDER_MESOSTRATA_GRAPHICS_ATLAS.flatMap(({ unstablePair }) => unstablePair),
  wetContacts: POWDER_MESOSTRATA_GRAPHICS_ATLAS.map(({ wetContact }) => wetContact),
  wallCoexistence: POWDER_MESOSTRATA_GRAPHICS_ATLAS.map(({ wallCoexistence }) => wallCoexistence),
  guardedBlanks: POWDER_MESOSTRATA_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
  conductiveWall: CONDUCTIVE_WALL,
};

interface PowderMesostrataFixtureBackend extends SimulationBackend {
  walls(): Uint8Array;
  paintWall(x: number, y: number, wall: number, radius: number): void;
}

/** Direct-fill paused bodies: mesostrata must never depend on a physics/brush write. */
export function preparePowderMesostrataGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (!supportsPowderMesostrataFixture(simulation)) {
    throw new Error('Powder mesostrata fixture requires a render-lab native wall plane');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Powder mesostrata fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of POWDER_MESOSTRATA_GRAPHICS_ATLAS) {
    fillRect(cells, simulation.width, entry.settledBody, entry.material);
    fillRect(cells, simulation.width, entry.authoredHole, Material.Empty);
    fillRect(cells, simulation.width, entry.thinColumn, entry.material);
    cells[entry.singleGrain.y * simulation.width + entry.singleGrain.x] = entry.material;
    for (const point of entry.unstablePair) cells[point.y * simulation.width + point.x] = entry.material;
    fillRect(cells, simulation.width, entry.wetContact.powder, entry.material);
    fillRect(cells, simulation.width, entry.wetContact.water, Material.Water);
    fillRect(cells, simulation.width, entry.wallCoexistence, entry.material);
    for (let y = entry.wallCoexistence.y; y < entry.wallCoexistence.y + entry.wallCoexistence.height; y += 4) {
      for (let x = entry.wallCoexistence.x; x < entry.wallCoexistence.x + entry.wallCoexistence.width; x += 4) {
        simulation.paintWall(x, y, CONDUCTIVE_WALL, 0);
      }
    }
    fillRect(cells, simulation.width, entry.guardedBlank, Material.Empty);
  }
}

function supportsPowderMesostrataFixture(simulation: SimulationBackend): simulation is PowderMesostrataFixtureBackend {
  const candidate = simulation as Partial<PowderMesostrataFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.paintWall === 'function';
}

function fillRect(cells: Uint8Array, width: number, rect: PowderMesostrataRect, material: Material): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * width + rect.x, y * width + rect.x + rect.width);
  }
}

function rectPoints(rect: PowderMesostrataRect): PowderMesostrataPoint[] {
  const points: PowderMesostrataPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}
