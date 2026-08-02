import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CONDUCTIVE_WALL = 1;

export interface FrayForceGraphicsPoint { readonly x: number; readonly y: number }
export interface FrayForceGraphicsRect extends FrayForceGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

/**
 * One paused exact-owner FRAY fixture. FRAY's native force polarity is driven
 * by temperature, but this first visual fixture intentionally invents no
 * presentation-state projection or simulated force direction. It reserves
 * semantic/topology probes for the future owner-local force-nozzle grammar.
 */
export interface FrayForceGraphicsAuditSnapshot {
  readonly material: Material.FRAY;
  readonly code: 'FRAY';
  readonly color: '#00bbff';
  readonly card: FrayForceGraphicsRect;
  readonly body: FrayForceGraphicsRect;
  /** Future exact-owner nozzle/body samples; not a topology owner. */
  readonly throatProbe: FrayForceGraphicsRect;
  readonly axisProbe: FrayForceGraphicsRect;
  readonly backgroundProbe: FrayForceGraphicsRect;
  /** Real Empty cells must remain open through any force-emitter styling. */
  readonly authoredHole: FrayForceGraphicsRect;
  readonly openChannel: FrayForceGraphicsRect;
  readonly thinRail: FrayForceGraphicsRect;
  readonly isolated: FrayForceGraphicsPoint;
  /** Particle and bmap wall intentionally coexist at the same world cells. */
  readonly wallCoexistence: FrayForceGraphicsRect;
  /** Direct phase contacts must remain independent semantic owners. */
  readonly contacts: {
    readonly fray: FrayForceGraphicsRect;
    readonly water: FrayForceGraphicsRect;
    readonly metal: FrayForceGraphicsRect;
  };
  /** ARAY is an emitter control but must never receive FRAY-only styling. */
  readonly wrongOwner: FrayForceGraphicsRect;
  readonly guardedBlank: FrayForceGraphicsRect;
  readonly conductiveWall: number;
}

export const FRAY_FORCE_GRAPHICS_AUDIT: FrayForceGraphicsAuditSnapshot = {
  material: Material.FRAY,
  code: 'FRAY',
  color: '#00bbff',
  card: { x: 12, y: 8, width: 588, height: 368 },
  body: { x: 32, y: 24, width: 160, height: 116 },
  throatProbe: { x: 72, y: 72, width: 16, height: 16 },
  axisProbe: { x: 108, y: 72, width: 16, height: 16 },
  backgroundProbe: { x: 156, y: 72, width: 16, height: 16 },
  authoredHole: { x: 96, y: 58, width: 8, height: 8 },
  openChannel: { x: 184, y: 96, width: 8, height: 12 },
  thinRail: { x: 212, y: 28, width: 1, height: 76 },
  isolated: { x: 224, y: 122 },
  wallCoexistence: { x: 252, y: 28, width: 28, height: 28 },
  contacts: {
    fray: { x: 32, y: 168, width: 28, height: 24 },
    water: { x: 60, y: 168, width: 28, height: 24 },
    metal: { x: 88, y: 168, width: 28, height: 24 },
  },
  wrongOwner: { x: 144, y: 168, width: 28, height: 24 },
  guardedBlank: { x: 32, y: 232, width: 160, height: 72 },
  conductiveWall: CONDUCTIVE_WALL,
};

interface FrayForceFixtureBackend extends SimulationBackend {
  paintWall(x: number, y: number, wall: number, radius: number): void;
  walls(): Uint8Array;
}

/** Direct-fill paused semantic state; no brush, source, or force ABI is exercised. */
export function prepareFrayForceGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (!supportsFrayForceFixture(simulation)) {
    throw new Error('FRAY force graphics fixture requires a render-lab native wall plane');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`FRAY force graphics fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  const fixture = FRAY_FORCE_GRAPHICS_AUDIT;
  fillRect(cells, simulation.width, fixture.body, Material.FRAY);
  fillRect(cells, simulation.width, fixture.authoredHole, Material.Empty);
  fillRect(cells, simulation.width, fixture.openChannel, Material.Empty);
  fillRect(cells, simulation.width, fixture.thinRail, Material.FRAY);
  cells[fixture.isolated.y * simulation.width + fixture.isolated.x] = Material.FRAY;
  fillRect(cells, simulation.width, fixture.wallCoexistence, Material.FRAY);
  for (let y = fixture.wallCoexistence.y; y < fixture.wallCoexistence.y + fixture.wallCoexistence.height; y += 4) {
    for (let x = fixture.wallCoexistence.x; x < fixture.wallCoexistence.x + fixture.wallCoexistence.width; x += 4) {
      simulation.paintWall(x, y, CONDUCTIVE_WALL, 0);
    }
  }
  fillRect(cells, simulation.width, fixture.contacts.fray, Material.FRAY);
  fillRect(cells, simulation.width, fixture.contacts.water, Material.Water);
  fillRect(cells, simulation.width, fixture.contacts.metal, Material.Metal);
  fillRect(cells, simulation.width, fixture.wrongOwner, Material.ARAY);
  fillRect(cells, simulation.width, fixture.guardedBlank, Material.Empty);
}

function supportsFrayForceFixture(simulation: SimulationBackend): simulation is FrayForceFixtureBackend {
  const candidate = simulation as Partial<FrayForceFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.paintWall === 'function';
}

function fillRect(cells: Uint8Array, width: number, rect: FrayForceGraphicsRect, material: Material): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * width + rect.x, y * width + rect.x + rect.width);
  }
}
