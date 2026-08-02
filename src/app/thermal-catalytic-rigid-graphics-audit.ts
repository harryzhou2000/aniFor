import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

export const THERMAL_CATALYTIC_RIGID_GRAPHICS_ATLAS_COLUMNS = 3;
export const THERMAL_CATALYTIC_RIGID_GRAPHICS_ATLAS_ROWS = 1;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 6;
const CARD_ORIGIN_Y = 8;
const CARD_STRIDE_X = 200;
const CARD_WIDTH = 194;
const CONDUCTIVE_WALL = 1;

/** Native solid owners whose next body-optics slice must remain exact-owner. */
const THERMAL_CATALYTIC_RIGID_DEFINITIONS = [
  { material: Material.HEAC, code: 'HEAC', color: '#cb6351' },
  { material: Material.PTNM, code: 'PTNM', color: '#d5e0eb' },
  { material: Material.RSSS, code: 'RSSS', color: '#c43626' },
] as const;

export interface ThermalCatalyticRigidPoint { readonly x: number; readonly y: number }
export interface ThermalCatalyticRigidRect extends ThermalCatalyticRigidPoint {
  readonly width: number;
  readonly height: number;
}

export interface ThermalCatalyticRigidGraphicsAtlasEntry {
  readonly material: (typeof THERMAL_CATALYTIC_RIGID_DEFINITIONS)[number]['material'];
  readonly code: string;
  readonly color: string;
  readonly index: number;
  readonly card: ThermalCatalyticRigidRect;
  /** Exact-material dense support, large enough to prove a solid optical core. */
  readonly body: ThermalCatalyticRigidRect;
  readonly coreProbe: ThermalCatalyticRigidRect;
  readonly authoredHole: ThermalCatalyticRigidRect;
  readonly thinColumn: ThermalCatalyticRigidRect;
  readonly isolated: ThermalCatalyticRigidPoint;
  /** A native bmap wall intentionally coexists with the exact solid owner. */
  readonly wallCoexistence: ThermalCatalyticRigidRect;
  /** A direct Solid/Liquid seam that must remain owned by its native materials. */
  readonly contact: {
    readonly solid: ThermalCatalyticRigidRect;
    readonly water: ThermalCatalyticRigidRect;
  };
  readonly guardedBlank: ThermalCatalyticRigidRect;
}

export interface ThermalCatalyticRigidGraphicsAuditSnapshot {
  readonly cards: readonly ThermalCatalyticRigidGraphicsAtlasEntry[];
  readonly authoredHoles: readonly ThermalCatalyticRigidPoint[];
  readonly thinColumns: readonly ThermalCatalyticRigidPoint[];
  readonly isolated: readonly ThermalCatalyticRigidPoint[];
  readonly wallCoexistence: readonly ThermalCatalyticRigidRect[];
  readonly contacts: readonly ThermalCatalyticRigidGraphicsAtlasEntry['contact'][];
  readonly guardedBlanks: readonly ThermalCatalyticRigidRect[];
  readonly conductiveWall: number;
}

/** Paused three-card atlas for the next exact-owner rigid-material style slice. */
export const THERMAL_CATALYTIC_RIGID_GRAPHICS_ATLAS: readonly ThermalCatalyticRigidGraphicsAtlasEntry[] =
  THERMAL_CATALYTIC_RIGID_DEFINITIONS.map(({ material, code, color }, index) => {
    const card = { x: CARD_ORIGIN_X + index * CARD_STRIDE_X, y: CARD_ORIGIN_Y, width: CARD_WIDTH, height: 368 };
    const body = { x: card.x + 8, y: card.y + 14, width: 118, height: 116 };
    const wallX = card.x + 146 + ((4 - ((card.x + 146) % 4)) % 4);
    return {
      material, code, color, index, card, body,
      coreProbe: { x: body.x + 56, y: body.y + 56, width: 16, height: 16 },
      authoredHole: { x: body.x + 42, y: body.y + 42, width: 8, height: 8 },
      thinColumn: { x: card.x + 134, y: card.y + 18, width: 1, height: 76 },
      isolated: { x: card.x + 140, y: card.y + 112 },
      wallCoexistence: { x: wallX, y: card.y + 24, width: 28, height: 28 },
      contact: {
        solid: { x: card.x + 10, y: card.y + 158, width: 28, height: 24 },
        water: { x: card.x + 38, y: card.y + 158, width: 28, height: 24 },
      },
      guardedBlank: { x: card.x + 20, y: card.y + 224, width: 116, height: 68 },
    } satisfies ThermalCatalyticRigidGraphicsAtlasEntry;
  });

export const THERMAL_CATALYTIC_RIGID_GRAPHICS_AUDIT: ThermalCatalyticRigidGraphicsAuditSnapshot = {
  cards: THERMAL_CATALYTIC_RIGID_GRAPHICS_ATLAS,
  authoredHoles: THERMAL_CATALYTIC_RIGID_GRAPHICS_ATLAS.flatMap(({ authoredHole }) => rectPoints(authoredHole)),
  thinColumns: THERMAL_CATALYTIC_RIGID_GRAPHICS_ATLAS.flatMap(({ thinColumn }) => rectPoints(thinColumn)),
  isolated: THERMAL_CATALYTIC_RIGID_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
  wallCoexistence: THERMAL_CATALYTIC_RIGID_GRAPHICS_ATLAS.map(({ wallCoexistence }) => wallCoexistence),
  contacts: THERMAL_CATALYTIC_RIGID_GRAPHICS_ATLAS.map(({ contact }) => contact),
  guardedBlanks: THERMAL_CATALYTIC_RIGID_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
  conductiveWall: CONDUCTIVE_WALL,
};

interface ThermalCatalyticRigidFixtureBackend extends SimulationBackend {
  paintWall(x: number, y: number, wall: number, radius: number): void;
  walls(): Uint8Array;
}

/** Direct-fill a paused fixture so renderer work cannot affect native material semantics. */
export function prepareThermalCatalyticRigidGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (!supportsThermalCatalyticRigidFixture(simulation)) {
    throw new Error('Thermal/catalytic rigid fixture requires a render-lab native wall plane');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Thermal/catalytic rigid fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of THERMAL_CATALYTIC_RIGID_GRAPHICS_ATLAS) {
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

function supportsThermalCatalyticRigidFixture(
  simulation: SimulationBackend,
): simulation is ThermalCatalyticRigidFixtureBackend {
  const candidate = simulation as Partial<ThermalCatalyticRigidFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.paintWall === 'function';
}

function fillRect(cells: Uint8Array, width: number, rect: ThermalCatalyticRigidRect, material: Material): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * width + rect.x, y * width + rect.x + rect.width);
  }
}

function rectPoints(rect: ThermalCatalyticRigidRect): ThermalCatalyticRigidPoint[] {
  const points: ThermalCatalyticRigidPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}
