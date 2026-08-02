import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

export const GEOLOGICAL_SOLID_GRAPHICS_ATLAS_COLUMNS = 2;
export const GEOLOGICAL_SOLID_GRAPHICS_ATLAS_ROWS = 1;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 8;
const CARD_ORIGIN_Y = 8;
const CARD_STRIDE_X = 302;
const CARD_WIDTH = 294;
const CONDUCTIVE_WALL = 1;

const GEOLOGICAL_SOLID_DEFINITIONS = [
  { material: Material.Coal, code: 'COAL', color: '#2d2926' },
  { material: Material.ROCK, code: 'ROCK', color: '#727272' },
] as const;

export interface GeologicalSolidPoint { readonly x: number; readonly y: number }
export interface GeologicalSolidRect extends GeologicalSolidPoint {
  readonly width: number;
  readonly height: number;
}

export interface GeologicalSolidGraphicsAtlasEntry {
  readonly material: (typeof GEOLOGICAL_SOLID_DEFINITIONS)[number]['material'];
  readonly code: string;
  readonly color: string;
  readonly index: number;
  readonly card: GeologicalSolidRect;
  /** Exact-material dense support, large enough to prove solid optical depth. */
  readonly body: GeologicalSolidRect;
  readonly coreProbe: GeologicalSolidRect;
  readonly authoredHole: GeologicalSolidRect;
  readonly thinColumn: GeologicalSolidRect;
  readonly isolated: GeologicalSolidPoint;
  /** A bmap wall independently coexists with this solid owner. */
  readonly wallCoexistence: GeologicalSolidRect;
  /** Exact direct Solid/Liquid contact: geological optics must not shade it. */
  readonly contact: {
    readonly solid: GeologicalSolidRect;
    readonly water: GeologicalSolidRect;
  };
  readonly guardedBlank: GeologicalSolidRect;
}

export interface GeologicalSolidGraphicsAuditSnapshot {
  readonly cards: readonly GeologicalSolidGraphicsAtlasEntry[];
  readonly authoredHoles: readonly GeologicalSolidPoint[];
  readonly thinColumns: readonly GeologicalSolidPoint[];
  readonly isolated: readonly GeologicalSolidPoint[];
  readonly wallCoexistence: readonly GeologicalSolidRect[];
  readonly contacts: readonly GeologicalSolidGraphicsAtlasEntry['contact'][];
  readonly guardedBlanks: readonly GeologicalSolidRect[];
  readonly conductiveWall: number;
}

/** Paused two-card atlas for Coal/ROCK deep core geological optics. */
export const GEOLOGICAL_SOLID_GRAPHICS_ATLAS: readonly GeologicalSolidGraphicsAtlasEntry[] =
  GEOLOGICAL_SOLID_DEFINITIONS.map(({ material, code, color }, index) => {
    const card = { x: CARD_ORIGIN_X + index * CARD_STRIDE_X, y: CARD_ORIGIN_Y, width: CARD_WIDTH, height: 368 };
    const body = { x: card.x + 10, y: card.y + 14, width: 156, height: 116 };
    const wallX = card.x + 204 + ((4 - ((card.x + 204) % 4)) % 4);
    return {
      material, code, color, index, card, body,
      coreProbe: { x: body.x + 82, y: body.y + 68, width: 16, height: 16 },
      authoredHole: { x: body.x + 58, y: body.y + 42, width: 8, height: 8 },
      thinColumn: { x: card.x + 178, y: card.y + 18, width: 1, height: 76 },
      isolated: { x: card.x + 190, y: card.y + 24 },
      wallCoexistence: { x: wallX, y: card.y + 24, width: 28, height: 28 },
      contact: {
        solid: { x: card.x + 12, y: card.y + 158, width: 32, height: 24 },
        water: { x: card.x + 44, y: card.y + 158, width: 32, height: 24 },
      },
      guardedBlank: { x: card.x + 92, y: card.y + 226, width: 96, height: 68 },
    } satisfies GeologicalSolidGraphicsAtlasEntry;
  });

export const GEOLOGICAL_SOLID_GRAPHICS_AUDIT: GeologicalSolidGraphicsAuditSnapshot = {
  cards: GEOLOGICAL_SOLID_GRAPHICS_ATLAS,
  authoredHoles: GEOLOGICAL_SOLID_GRAPHICS_ATLAS.flatMap(({ authoredHole }) => rectPoints(authoredHole)),
  thinColumns: GEOLOGICAL_SOLID_GRAPHICS_ATLAS.flatMap(({ thinColumn }) => rectPoints(thinColumn)),
  isolated: GEOLOGICAL_SOLID_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
  wallCoexistence: GEOLOGICAL_SOLID_GRAPHICS_ATLAS.map(({ wallCoexistence }) => wallCoexistence),
  contacts: GEOLOGICAL_SOLID_GRAPHICS_ATLAS.map(({ contact }) => contact),
  guardedBlanks: GEOLOGICAL_SOLID_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
  conductiveWall: CONDUCTIVE_WALL,
};

interface GeologicalSolidFixtureBackend extends SimulationBackend {
  paintWall(x: number, y: number, wall: number, radius: number): void;
  walls(): Uint8Array;
}

/** Direct-fill a paused scene: visual topology is never a particle-brush outcome. */
export function prepareGeologicalSolidGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (!supportsGeologicalSolidFixture(simulation)) {
    throw new Error('Geological solid graphics fixture requires a render-lab native wall plane');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Geological solid graphics fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of GEOLOGICAL_SOLID_GRAPHICS_ATLAS) {
    fillRect(cells, simulation.width, entry.body, entry.material);
    fillRect(cells, simulation.width, entry.authoredHole, Material.Empty);
    fillRect(cells, simulation.width, entry.thinColumn, entry.material);
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = entry.material;
    fillRect(cells, simulation.width, entry.wallCoexistence, entry.material);
    for (let y = entry.wallCoexistence.y; y < entry.wallCoexistence.y + entry.wallCoexistence.height; y += 4) {
      for (let x = entry.wallCoexistence.x; x < entry.wallCoexistence.x + entry.wallCoexistence.width; x += 4) {
        simulation.paintWall(x, y, CONDUCTIVE_WALL, 0);
      }
    }
    fillRect(cells, simulation.width, entry.contact.solid, entry.material);
    fillRect(cells, simulation.width, entry.contact.water, Material.Water);
    fillRect(cells, simulation.width, entry.guardedBlank, Material.Empty);
  }
}

function supportsGeologicalSolidFixture(simulation: SimulationBackend): simulation is GeologicalSolidFixtureBackend {
  const candidate = simulation as Partial<GeologicalSolidFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.paintWall === 'function';
}

function fillRect(cells: Uint8Array, width: number, rect: GeologicalSolidRect, material: Material): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * width + rect.x, y * width + rect.x + rect.width);
  }
}

function rectPoints(rect: GeologicalSolidRect): GeologicalSolidPoint[] {
  const points: GeologicalSolidPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}
