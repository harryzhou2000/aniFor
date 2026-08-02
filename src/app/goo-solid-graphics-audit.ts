import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CONDUCTIVE_WALL = 1;

export interface GooSolidGraphicsPoint { readonly x: number; readonly y: number }
export interface GooSolidGraphicsRect extends GooSolidGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

/**
 * One paused, exact-owner GOO fixture. GOO is a native pressure-reactive
 * solid, so this fixture deliberately carries no synthetic pressure/state:
 * later body optics must not reinterpret its physics.
 */
export interface GooSolidGraphicsAuditSnapshot {
  readonly material: Material.GOO;
  readonly code: 'GOO';
  readonly color: '#804000';
  readonly card: GooSolidGraphicsRect;
  /** Large exact-material support for a future deep-body presentation probe. */
  readonly body: GooSolidGraphicsRect;
  readonly coreProbe: GooSolidGraphicsRect;
  readonly surfaceProbe: GooSolidGraphicsRect;
  /** A real empty void which must never be filled by GOO presentation. */
  readonly authoredHole: GooSolidGraphicsRect;
  /** A real open edge prevents a body pass from mistaking the hole for a cavity. */
  readonly openNotch: GooSolidGraphicsRect;
  /** Fine semantic controls, intentionally not eligible for deep-body styling. */
  readonly thinColumn: GooSolidGraphicsRect;
  readonly isolated: GooSolidGraphicsPoint;
  /** Matter and a native bmap wall coexist independently in this exact region. */
  readonly wallCoexistence: GooSolidGraphicsRect;
  /** Direct foreign-phase contacts remain semantic controls rather than body support. */
  readonly contacts: {
    readonly goo: GooSolidGraphicsRect;
    readonly water: GooSolidGraphicsRect;
    readonly metal: GooSolidGraphicsRect;
  };
  readonly guardedBlank: GooSolidGraphicsRect;
  readonly conductiveWall: number;
}

export const GOO_SOLID_GRAPHICS_AUDIT: GooSolidGraphicsAuditSnapshot = {
  material: Material.GOO,
  code: 'GOO',
  color: '#804000',
  card: { x: 12, y: 8, width: 588, height: 368 },
  body: { x: 32, y: 24, width: 118, height: 116 },
  coreProbe: { x: 88, y: 80, width: 16, height: 16 },
  surfaceProbe: { x: 40, y: 32, width: 16, height: 16 },
  authoredHole: { x: 74, y: 66, width: 8, height: 8 },
  openNotch: { x: 142, y: 96, width: 8, height: 12 },
  thinColumn: { x: 172, y: 28, width: 1, height: 76 },
  isolated: { x: 182, y: 122 },
  wallCoexistence: { x: 212, y: 28, width: 28, height: 28 },
  contacts: {
    goo: { x: 32, y: 168, width: 28, height: 24 },
    water: { x: 60, y: 168, width: 28, height: 24 },
    metal: { x: 88, y: 168, width: 28, height: 24 },
  },
  guardedBlank: { x: 32, y: 232, width: 136, height: 72 },
  conductiveWall: CONDUCTIVE_WALL,
};

interface GooSolidFixtureBackend extends SimulationBackend {
  paintWall(x: number, y: number, wall: number, radius: number): void;
  walls(): Uint8Array;
}

/** Direct-fill a paused world so the fixture never exercises a brush or reaction ABI. */
export function prepareGooSolidGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (!supportsGooSolidFixture(simulation)) {
    throw new Error('GOO solid fixture requires a render-lab native wall plane');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`GOO solid fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  const fixture = GOO_SOLID_GRAPHICS_AUDIT;
  fillRect(cells, simulation.width, fixture.body, Material.GOO);
  fillRect(cells, simulation.width, fixture.authoredHole, Material.Empty);
  fillRect(cells, simulation.width, fixture.openNotch, Material.Empty);
  fillRect(cells, simulation.width, fixture.thinColumn, Material.GOO);
  cells[fixture.isolated.y * simulation.width + fixture.isolated.x] = Material.GOO;
  fillRect(cells, simulation.width, fixture.wallCoexistence, Material.GOO);
  for (let y = fixture.wallCoexistence.y; y < fixture.wallCoexistence.y + fixture.wallCoexistence.height; y += 4) {
    for (let x = fixture.wallCoexistence.x; x < fixture.wallCoexistence.x + fixture.wallCoexistence.width; x += 4) {
      simulation.paintWall(x, y, CONDUCTIVE_WALL, 0);
    }
  }
  fillRect(cells, simulation.width, fixture.contacts.goo, Material.GOO);
  fillRect(cells, simulation.width, fixture.contacts.water, Material.Water);
  fillRect(cells, simulation.width, fixture.contacts.metal, Material.Metal);
  fillRect(cells, simulation.width, fixture.guardedBlank, Material.Empty);
}

function supportsGooSolidFixture(simulation: SimulationBackend): simulation is GooSolidFixtureBackend {
  const candidate = simulation as Partial<GooSolidFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.paintWall === 'function';
}

function fillRect(cells: Uint8Array, width: number, rect: GooSolidGraphicsRect, material: Material): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * width + rect.x, y * width + rect.x + rect.width);
  }
}
