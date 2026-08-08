import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CONDUCTIVE_WALL = 1;
const WALL_BLOCK_SIZE = 4;

/** Paused E69 variants share every authored plane; only exact-owner velocity changes. */
export type OilMotionVfxFixtureMode = 'still' | 'moving' | 'reversed';

export interface OilMotionVfxPoint { readonly x: number; readonly y: number }
export interface OilMotionVfxRect extends OilMotionVfxPoint {
  readonly width: number;
  readonly height: number;
}
export interface OilMotionVfxVector { readonly x: number; readonly y: number }

export interface OilMotionVfxTarget {
  readonly material: Material.Oil;
  readonly body: OilMotionVfxRect;
  readonly airFacingTop: OilMotionVfxRect;
  readonly airFacingLeft: OilMotionVfxRect;
  readonly airFacingRight: OilMotionVfxRect;
  readonly core: OilMotionVfxRect;
  readonly authoredHole: OilMotionVfxRect;
  readonly openChimney: OilMotionVfxRect;
  readonly velocity: OilMotionVfxVector;
}

export interface OilMotionVfxBoundary {
  readonly code: 'OIL_WATR' | 'OIL_DESL';
  readonly oil: OilMotionVfxRect;
  readonly other: OilMotionVfxRect;
  readonly otherMaterial: Material.Water | Material.Diesel;
  readonly oilProbe: OilMotionVfxPoint;
  readonly otherProbe: OilMotionVfxPoint;
  /** Only the Oil owner moves; the unlike neighbour remains a static contact control. */
  readonly velocity: OilMotionVfxVector;
}

export interface OilMotionVfxWallRegion {
  readonly region: OilMotionVfxRect;
  readonly blockSize: 4;
  readonly wall: 1;
  readonly wallProbe: OilMotionVfxPoint;
}

export interface OilMotionVfxAuditSnapshot {
  readonly version: 1;
  readonly world: { readonly width: 612; readonly height: 384 };
  readonly target: OilMotionVfxTarget;
  readonly stationaryOil: OilMotionVfxRect & { readonly material: Material.Oil };
  readonly movingSiblings: {
    readonly water: OilMotionVfxRect & { readonly material: Material.Water; readonly velocity: OilMotionVfxVector };
    readonly acid: OilMotionVfxRect & { readonly material: Material.Acid; readonly velocity: OilMotionVfxVector };
    readonly diesel: OilMotionVfxRect & { readonly material: Material.Diesel; readonly velocity: OilMotionVfxVector };
    readonly nitro: OilMotionVfxRect & { readonly material: Material.Nitro; readonly velocity: OilMotionVfxVector };
  };
  readonly movingOil: {
    readonly thin: OilMotionVfxRect & { readonly material: Material.Oil; readonly velocity: OilMotionVfxVector };
    readonly isolated: OilMotionVfxPoint & { readonly material: Material.Oil; readonly velocity: OilMotionVfxVector };
  };
  readonly seams: readonly [OilMotionVfxBoundary, OilMotionVfxBoundary];
  /** Oil remains the semantic owner under this independent broad native-wall plane. */
  readonly wallCoexistence: OilMotionVfxWallRegion;
  readonly guardedBlank: OilMotionVfxRect;
  readonly expected: {
    readonly oilCells: 60_549;
    readonly waterCells: 7_936;
    readonly acidCells: 5_376;
    readonly dieselCells: 7_936;
    readonly nitroCells: 5_376;
    readonly wallCells: 2_304;
    readonly movingVelocityCells: 66_053;
  };
}

const target: OilMotionVfxTarget = {
  material: Material.Oil,
  body: { x: 20, y: 24, width: 260, height: 150 },
  // Kept disjoint from the wall-backed surface control at the left shoulder.
  airFacingTop: { x: 100, y: 24, width: 108, height: 1 },
  airFacingLeft: { x: 20, y: 64, width: 1, height: 72 },
  airFacingRight: { x: 279, y: 64, width: 1, height: 72 },
  core: { x: 52, y: 112, width: 40, height: 24 },
  authoredHole: { x: 112, y: 82, width: 18, height: 16 },
  openChimney: { x: 220, y: 24, width: 12, height: 52 },
  velocity: { x: 30, y: -18 },
};

const boundary = (
  code: OilMotionVfxBoundary['code'], x: number, otherMaterial: OilMotionVfxBoundary['otherMaterial'],
  velocity: OilMotionVfxVector,
): OilMotionVfxBoundary => ({
  code,
  oil: { x, y: 300, width: 80, height: 40 },
  other: { x: x + 80, y: 300, width: 64, height: 40 },
  otherMaterial,
  // The top interface is simultaneously air-facing and unlike-material-facing,
  // so it reaches E08's contact rejection with authentic Oil velocity.
  oilProbe: { x: x + 79, y: 300 },
  otherProbe: { x: x + 80, y: 300 },
  velocity,
});

export const OIL_MOTION_VFX_AUDIT: OilMotionVfxAuditSnapshot = {
  version: 1,
  world: { width: WORLD_WIDTH, height: WORLD_HEIGHT },
  target,
  stationaryOil: { x: 320, y: 24, width: 160, height: 100, material: Material.Oil },
  movingSiblings: {
    water: { x: 20, y: 204, width: 96, height: 56, material: Material.Water, velocity: { x: -26, y: 16 } },
    acid: { x: 132, y: 204, width: 96, height: 56, material: Material.Acid, velocity: { x: 20, y: 22 } },
    diesel: { x: 244, y: 204, width: 96, height: 56, material: Material.Diesel, velocity: { x: 24, y: -14 } },
    nitro: { x: 356, y: 204, width: 96, height: 56, material: Material.Nitro, velocity: { x: -18, y: -20 } },
  },
  movingOil: {
    thin: { x: 494, y: 196, width: 1, height: 60, material: Material.Oil, velocity: { x: 28, y: -16 } },
    isolated: { x: 540, y: 220, material: Material.Oil, velocity: { x: -32, y: 18 } },
  },
  seams: [
    boundary('OIL_WATR', 20, Material.Water, { x: 24, y: -16 }),
    boundary('OIL_DESL', 220, Material.Diesel, { x: -22, y: -18 }),
  ],
  wallCoexistence: {
    // Begin on the exact top silhouette: the wall probe otherwise returns at
    // E08's dense-interior guard before it can prove E69's wall exclusion.
    region: { x: 20, y: 24, width: 72, height: 32 },
    blockSize: WALL_BLOCK_SIZE,
    wall: CONDUCTIVE_WALL,
    wallProbe: { x: 21, y: 24 },
  },
  guardedBlank: { x: 24, y: 352, width: 548, height: 20 },
  expected: {
    oilCells: 60_549,
    waterCells: 7_936,
    acidCells: 5_376,
    dieselCells: 7_936,
    nitroCells: 5_376,
    wallCells: 2_304,
    movingVelocityCells: 66_053,
  },
};

interface OilMotionVfxFixtureBackend extends SimulationBackend {
  walls(): Uint8Array;
  velocity(): Int8Array;
  paintWall(x: number, y: number, wall: number, radius: number): void;
  setFixtureVelocityRect(
    x: number, y: number, width: number, height: number, velocityX: number, velocityY: number,
  ): void;
}

/** Builds topology-identical paused E69 variants and stages motion only under exact owners. */
export function prepareOilMotionVfxFixture(
  simulation: SimulationBackend,
  mode: OilMotionVfxFixtureMode,
): void {
  if (!supportsFixture(simulation)) {
    throw new Error('Oil-motion VFX fixture requires render-lab velocity and wall planes');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Oil-motion VFX fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  const fixture = OIL_MOTION_VFX_AUDIT;

  fillRect(cells, simulation.width, fixture.target.body, Material.Oil);
  fillRect(cells, simulation.width, fixture.target.authoredHole, Material.Empty);
  fillRect(cells, simulation.width, fixture.target.openChimney, Material.Empty);
  fillRect(cells, simulation.width, fixture.stationaryOil, Material.Oil);
  for (const entry of Object.values(fixture.movingSiblings)) {
    fillRect(cells, simulation.width, entry, entry.material);
  }
  fillRect(cells, simulation.width, fixture.movingOil.thin, Material.Oil);
  setPoint(cells, simulation.width, fixture.movingOil.isolated, Material.Oil);
  for (const entry of fixture.seams) {
    fillRect(cells, simulation.width, entry.oil, Material.Oil);
    fillRect(cells, simulation.width, entry.other, entry.otherMaterial);
  }
  fillRect(cells, simulation.width, fixture.guardedBlank, Material.Empty);
  paintWallRegion(simulation, fixture.wallCoexistence);

  if (mode !== 'still') {
    const direction = mode === 'reversed' ? -1 : 1;
    setExactMaterialVelocityRuns(
      simulation, cells, fixture.target.body, Material.Oil, fixture.target.velocity, direction,
    );
    for (const entry of Object.values(fixture.movingSiblings)) {
      setExactMaterialVelocityRuns(simulation, cells, entry, entry.material, entry.velocity, direction);
    }
    for (const entry of fixture.seams) {
      setExactMaterialVelocityRuns(
        simulation, cells, entry.oil, Material.Oil, entry.velocity, direction,
      );
    }
    setExactMaterialVelocityRuns(
      simulation, cells, fixture.movingOil.thin, Material.Oil, fixture.movingOil.thin.velocity, direction,
    );
    const isolated = fixture.movingOil.isolated;
    if (cells[isolated.y * simulation.width + isolated.x] === Material.Oil) {
      simulation.setFixtureVelocityRect(
        isolated.x, isolated.y, 1, 1, isolated.velocity.x * direction, isolated.velocity.y * direction,
      );
    }
  }
}

function supportsFixture(simulation: SimulationBackend): simulation is OilMotionVfxFixtureBackend {
  const candidate = simulation as Partial<OilMotionVfxFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.velocity === 'function'
    && typeof candidate.paintWall === 'function' && typeof candidate.setFixtureVelocityRect === 'function';
}

/** Stages contiguous runs only where the exact semantic owner is still present. */
function setExactMaterialVelocityRuns(
  simulation: OilMotionVfxFixtureBackend,
  cells: Uint8Array,
  rect: OilMotionVfxRect,
  material: Material,
  velocity: OilMotionVfxVector,
  direction: -1 | 1,
): void {
  const right = rect.x + rect.width;
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < right;) {
      while (x < right && cells[y * simulation.width + x] !== material) x++;
      const start = x;
      while (x < right && cells[y * simulation.width + x] === material) x++;
      if (x > start) simulation.setFixtureVelocityRect(
        start, y, x - start, 1, velocity.x * direction, velocity.y * direction,
      );
    }
  }
}

function paintWallRegion(simulation: OilMotionVfxFixtureBackend, wall: OilMotionVfxWallRegion): void {
  for (let y = wall.region.y; y < wall.region.y + wall.region.height; y += wall.blockSize) {
    for (let x = wall.region.x; x < wall.region.x + wall.region.width; x += wall.blockSize) {
      simulation.paintWall(x, y, wall.wall, 0);
    }
  }
}

function fillRect(cells: Uint8Array, width: number, rect: OilMotionVfxRect, material: Material): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * width + rect.x, y * width + rect.x + rect.width);
  }
}

function setPoint(cells: Uint8Array, width: number, point: OilMotionVfxPoint, material: Material): void {
  cells[point.y * width + point.x] = material;
}
