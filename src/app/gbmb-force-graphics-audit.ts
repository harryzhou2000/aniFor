import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CONDUCTIVE_WALL = 1;

export interface GbmbForceGraphicsPoint { readonly x: number; readonly y: number }
export interface GbmbForceGraphicsRect extends GbmbForceGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

/**
 * One paused exact-owner GBMB fixture. Newtonian gravity is intentionally
 * unavailable in this build, so the fixture preserves only native material
 * ownership and topology; it does not manufacture gravity or attachment state.
 */
export interface GbmbForceGraphicsAuditSnapshot {
  readonly material: Material.GBMB;
  readonly code: 'GBMB';
  readonly color: '#1144bb';
  readonly card: GbmbForceGraphicsRect;
  readonly body: GbmbForceGraphicsRect;
  /** Future force-core/body probes; each remains an exact GBMB semantic cell. */
  readonly coreProbe: GbmbForceGraphicsRect;
  readonly ringProbe: GbmbForceGraphicsRect;
  readonly backgroundProbe: GbmbForceGraphicsRect;
  readonly authoredHole: GbmbForceGraphicsRect;
  readonly openChannel: GbmbForceGraphicsRect;
  readonly thinColumn: GbmbForceGraphicsRect;
  readonly isolated: GbmbForceGraphicsPoint;
  /** Independent bmap wall and powder owner coexist in this region. */
  readonly wallCoexistence: GbmbForceGraphicsRect;
  readonly contacts: {
    readonly gbmb: GbmbForceGraphicsRect;
    readonly water: GbmbForceGraphicsRect;
    readonly metal: GbmbForceGraphicsRect;
  };
  /** DMG is another force powder and must remain a strict wrong-owner control. */
  readonly wrongOwner: GbmbForceGraphicsRect;
  readonly guardedBlank: GbmbForceGraphicsRect;
  readonly conductiveWall: number;
}

export const GBMB_FORCE_GRAPHICS_AUDIT: GbmbForceGraphicsAuditSnapshot = {
  material: Material.GBMB,
  code: 'GBMB',
  color: '#1144bb',
  card: { x: 12, y: 8, width: 588, height: 368 },
  body: { x: 32, y: 24, width: 160, height: 116 },
  coreProbe: { x: 72, y: 72, width: 16, height: 16 },
  ringProbe: { x: 108, y: 72, width: 16, height: 16 },
  backgroundProbe: { x: 156, y: 72, width: 16, height: 16 },
  authoredHole: { x: 96, y: 58, width: 8, height: 8 },
  openChannel: { x: 184, y: 96, width: 8, height: 12 },
  thinColumn: { x: 212, y: 28, width: 1, height: 76 },
  isolated: { x: 224, y: 122 },
  wallCoexistence: { x: 252, y: 28, width: 28, height: 28 },
  contacts: {
    gbmb: { x: 32, y: 168, width: 28, height: 24 },
    water: { x: 60, y: 168, width: 28, height: 24 },
    metal: { x: 88, y: 168, width: 28, height: 24 },
  },
  wrongOwner: { x: 144, y: 168, width: 28, height: 24 },
  guardedBlank: { x: 32, y: 232, width: 160, height: 72 },
  conductiveWall: CONDUCTIVE_WALL,
};

interface GbmbForceFixtureBackend extends SimulationBackend {
  paintWall(x: number, y: number, wall: number, radius: number): void;
  walls(): Uint8Array;
}

/** Direct-fill paused semantics; this does not invoke a brush or unavailable gravity ABI. */
export function prepareGbmbForceGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (!supportsGbmbForceFixture(simulation)) {
    throw new Error('GBMB force graphics fixture requires a render-lab native wall plane');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`GBMB force graphics fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  const fixture = GBMB_FORCE_GRAPHICS_AUDIT;
  fillRect(cells, simulation.width, fixture.body, Material.GBMB);
  fillRect(cells, simulation.width, fixture.authoredHole, Material.Empty);
  fillRect(cells, simulation.width, fixture.openChannel, Material.Empty);
  fillRect(cells, simulation.width, fixture.thinColumn, Material.GBMB);
  cells[fixture.isolated.y * simulation.width + fixture.isolated.x] = Material.GBMB;
  fillRect(cells, simulation.width, fixture.wallCoexistence, Material.GBMB);
  for (let y = fixture.wallCoexistence.y; y < fixture.wallCoexistence.y + fixture.wallCoexistence.height; y += 4) {
    for (let x = fixture.wallCoexistence.x; x < fixture.wallCoexistence.x + fixture.wallCoexistence.width; x += 4) {
      simulation.paintWall(x, y, CONDUCTIVE_WALL, 0);
    }
  }
  fillRect(cells, simulation.width, fixture.contacts.gbmb, Material.GBMB);
  fillRect(cells, simulation.width, fixture.contacts.water, Material.Water);
  fillRect(cells, simulation.width, fixture.contacts.metal, Material.Metal);
  fillRect(cells, simulation.width, fixture.wrongOwner, Material.DMG);
  fillRect(cells, simulation.width, fixture.guardedBlank, Material.Empty);
}

function supportsGbmbForceFixture(simulation: SimulationBackend): simulation is GbmbForceFixtureBackend {
  const candidate = simulation as Partial<GbmbForceFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.paintWall === 'function';
}

function fillRect(cells: Uint8Array, width: number, rect: GbmbForceGraphicsRect, material: Material): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * width + rect.x, y * width + rect.x + rect.width);
  }
}
