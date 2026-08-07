import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CONDUCTIVE_WALL = 1;
const WALL_BLOCK_SIZE = 4;

/** Paused modes share every plane except the documented owned velocity bytes. */
export type WaterCurvatureVfxFixtureMode = 'still' | 'moving';

export interface WaterCurvatureVfxPoint { readonly x: number; readonly y: number }
export interface WaterCurvatureVfxRect extends WaterCurvatureVfxPoint {
  readonly width: number;
  readonly height: number;
}
export interface WaterCurvatureVfxVector { readonly x: number; readonly y: number }

export interface WaterCurvatureVfxBody {
  readonly material: Material.Water;
  readonly bounds: WaterCurvatureVfxRect;
  /** Flat air-facing lip: curvature treatment must remain an exact no-op. */
  readonly straightShore: WaterCurvatureVfxRect;
  /** Raised, broad, gentle shore with a positive curvature target. */
  readonly convexCrest: WaterCurvatureVfxRect;
  /** Air-connected inward notch with a negative curvature target. */
  readonly concaveInlet: WaterCurvatureVfxRect;
  readonly authoredHole: WaterCurvatureVfxRect;
  readonly openChannel: WaterCurvatureVfxRect;
  readonly deepCore: WaterCurvatureVfxRect;
  readonly velocity: WaterCurvatureVfxVector;
}

export interface WaterCurvatureVfxBoundary {
  readonly code: 'WATR_METL' | 'WATR_OIL';
  readonly water: WaterCurvatureVfxRect;
  readonly other: WaterCurvatureVfxRect;
  readonly otherMaterial: Material.Metal | Material.Oil;
  readonly waterProbe: WaterCurvatureVfxPoint;
  readonly otherProbe: WaterCurvatureVfxPoint;
}

export interface WaterCurvatureVfxWallPattern {
  readonly region: WaterCurvatureVfxRect;
  readonly blockSize: 4;
  readonly occupiedParity: 0;
  readonly wallProbe: WaterCurvatureVfxPoint;
  readonly clearProbe: WaterCurvatureVfxPoint;
}

export interface WaterCurvatureVfxAuditSnapshot {
  readonly version: 1;
  readonly world: { readonly width: 612; readonly height: 384 };
  readonly body: WaterCurvatureVfxBody;
  readonly moving: {
    readonly oil: WaterCurvatureVfxRect & { readonly material: Material.Oil; readonly velocity: WaterCurvatureVfxVector };
    readonly acid: WaterCurvatureVfxRect & { readonly material: Material.Acid; readonly velocity: WaterCurvatureVfxVector };
    readonly strand: WaterCurvatureVfxRect & { readonly material: Material.Water; readonly velocity: WaterCurvatureVfxVector };
    readonly isolated: WaterCurvatureVfxPoint & { readonly material: Material.Water; readonly velocity: WaterCurvatureVfxVector };
  };
  readonly contacts: {
    readonly waterMetal: WaterCurvatureVfxBoundary;
    readonly waterOil: WaterCurvatureVfxBoundary;
  };
  readonly wallCoexistence: WaterCurvatureVfxWallPattern;
  readonly guardedBlank: WaterCurvatureVfxRect;
  readonly conductiveWall: 1;
  readonly expected: {
    readonly waterCells: 48_023;
    readonly oilCells: 5_376;
    readonly acidCells: 3_024;
    readonly metalCells: 2_352;
    readonly wallCells: 768;
    readonly movingVelocityCells: 48_191;
  };
}

const body: WaterCurvatureVfxBody = {
  material: Material.Water,
  bounds: { x: 24, y: 54, width: 356, height: 132 },
  straightShore: { x: 40, y: 66, width: 64, height: 1 },
  convexCrest: { x: 120, y: 54, width: 80, height: 12 },
  concaveInlet: { x: 252, y: 66, width: 20, height: 26 },
  authoredHole: { x: 152, y: 128, width: 14, height: 12 },
  openChannel: { x: 320, y: 66, width: 12, height: 38 },
  deepCore: { x: 60, y: 146, width: 48, height: 24 },
  velocity: { x: 30, y: -14 },
};

const boundary = (
  code: WaterCurvatureVfxBoundary['code'], x: number,
  otherMaterial: WaterCurvatureVfxBoundary['otherMaterial'],
): WaterCurvatureVfxBoundary => ({
  code,
  water: { x, y: 250, width: 70, height: 42 },
  other: { x: x + 70, y: 250, width: 56, height: 42 },
  otherMaterial,
  waterProbe: { x: x + 69, y: 271 },
  otherProbe: { x: x + 70, y: 271 },
});

const wallCoexistence: WaterCurvatureVfxWallPattern = {
  // Twelve by eight four-cell blocks: 48 occupied blocks, or 768 native cells.
  region: { x: 280, y: 104, width: 48, height: 32 },
  blockSize: WALL_BLOCK_SIZE,
  occupiedParity: 0,
  wallProbe: { x: 281, y: 107 },
  clearProbe: { x: 285, y: 107 },
};

/**
 * Paused E66 curvature fixture. The moving and still forms retain byte-identical
 * material, wall, cavity, contact, and silhouette evidence. Only eligible
 * authored owners receive velocity, so curvature can never be inferred from
 * motion or topology alone.
 */
export const WATER_CURVATURE_VFX_AUDIT: WaterCurvatureVfxAuditSnapshot = {
  version: 1,
  world: { width: WORLD_WIDTH, height: WORLD_HEIGHT },
  body,
  moving: {
    oil: { x: 412, y: 36, width: 72, height: 42, material: Material.Oil, velocity: { x: -24, y: 16 } },
    acid: { x: 508, y: 36, width: 72, height: 42, material: Material.Acid, velocity: { x: 20, y: 22 } },
    strand: { x: 412, y: 104, width: 1, height: 50, material: Material.Water, velocity: { x: 28, y: -20 } },
    isolated: { x: 456, y: 124, material: Material.Water, velocity: { x: -32, y: 18 } },
  },
  contacts: {
    waterMetal: boundary('WATR_METL', 24, Material.Metal),
    waterOil: boundary('WATR_OIL', 200, Material.Oil),
  },
  wallCoexistence,
  guardedBlank: { x: 16, y: 336, width: 568, height: 28 },
  conductiveWall: CONDUCTIVE_WALL,
  expected: {
    waterCells: 48_023, oilCells: 5_376, acidCells: 3_024, metalCells: 2_352,
    wallCells: 768, movingVelocityCells: 48_191,
  },
};

interface WaterCurvatureFixtureBackend extends SimulationBackend {
  walls(): Uint8Array;
  velocity(): Int8Array;
  paintWall(x: number, y: number, wall: number, radius: number): void;
  setFixtureVelocityRect(
    x: number, y: number, width: number, height: number, velocityX: number, velocityY: number,
  ): void;
}

export function prepareWaterCurvatureVfxFixture(
  simulation: SimulationBackend,
  mode: WaterCurvatureVfxFixtureMode,
): void {
  if (!supportsFixture(simulation)) {
    throw new Error('Water-curvature VFX fixture requires render-lab velocity and wall planes');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Water-curvature VFX fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  const fixture = WATER_CURVATURE_VFX_AUDIT;

  fillCurvedWaterBody(cells, simulation.width, fixture.body);
  fillRect(cells, simulation.width, fixture.body.concaveInlet, Material.Empty);
  fillRect(cells, simulation.width, fixture.body.authoredHole, Material.Empty);
  fillRect(cells, simulation.width, fixture.body.openChannel, Material.Empty);
  const { oil, acid, strand, isolated } = fixture.moving;
  fillRect(cells, simulation.width, oil, oil.material);
  fillRect(cells, simulation.width, acid, acid.material);
  fillRect(cells, simulation.width, strand, strand.material);
  setPoint(cells, simulation.width, isolated, isolated.material);
  for (const contact of Object.values(fixture.contacts)) {
    fillRect(cells, simulation.width, contact.water, Material.Water);
    fillRect(cells, simulation.width, contact.other, contact.otherMaterial);
  }
  fillRect(cells, simulation.width, fixture.guardedBlank, Material.Empty);
  paintWallPattern(simulation, fixture.wallCoexistence);

  if (mode === 'moving') {
    setExactOwnerVelocityRuns(simulation, cells, fixture.body.bounds, Material.Water, fixture.body.velocity);
    for (const entry of [oil, acid, strand]) simulation.setFixtureVelocityRect(
      entry.x, entry.y, entry.width, entry.height, entry.velocity.x, entry.velocity.y,
    );
    simulation.setFixtureVelocityRect(
      isolated.x, isolated.y, 1, 1, isolated.velocity.x, isolated.velocity.y,
    );
  }
}

function supportsFixture(simulation: SimulationBackend): simulation is WaterCurvatureFixtureBackend {
  const candidate = simulation as Partial<WaterCurvatureFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.velocity === 'function'
    && typeof candidate.paintWall === 'function' && typeof candidate.setFixtureVelocityRect === 'function';
}

/** A broad flat shore with one gentle positive crest; negative curvature is an air inlet. */
function fillCurvedWaterBody(
  cells: Uint8Array, width: number, entry: WaterCurvatureVfxBody,
): void {
  const bottom = entry.bounds.y + entry.bounds.height;
  for (let x = entry.bounds.x; x < entry.bounds.x + entry.bounds.width; x++) {
    const crestDistance = Math.abs(x - 159);
    const crestRise = x >= entry.convexCrest.x && x < entry.convexCrest.x + entry.convexCrest.width
      ? Math.max(0, 12 - Math.floor(crestDistance * 12 / 40)) : 0;
    const top = entry.straightShore.y - crestRise;
    for (let y = top; y < bottom; y++) cells[y * width + x] = entry.material;
  }
}

/** Writes velocity only through Water runs, retaining all authored air cutouts. */
function setExactOwnerVelocityRuns(
  simulation: WaterCurvatureFixtureBackend,
  cells: Uint8Array,
  bounds: WaterCurvatureVfxRect,
  material: Material,
  velocity: WaterCurvatureVfxVector,
): void {
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;
  for (let y = bounds.y; y < bottom; y++) {
    for (let x = bounds.x; x < right;) {
      while (x < right && cells[y * simulation.width + x] !== material) x++;
      const start = x;
      while (x < right && cells[y * simulation.width + x] === material) x++;
      if (x > start) simulation.setFixtureVelocityRect(
        start, y, x - start, 1, velocity.x, velocity.y,
      );
    }
  }
}

function paintWallPattern(
  simulation: WaterCurvatureFixtureBackend, pattern: WaterCurvatureVfxWallPattern,
): void {
  for (let y = pattern.region.y; y < pattern.region.y + pattern.region.height; y += WALL_BLOCK_SIZE) {
    for (let x = pattern.region.x; x < pattern.region.x + pattern.region.width; x += WALL_BLOCK_SIZE) {
      const blockX = (x - pattern.region.x) / WALL_BLOCK_SIZE;
      const blockY = (y - pattern.region.y) / WALL_BLOCK_SIZE;
      if ((blockX + blockY) % 2 === pattern.occupiedParity) {
        simulation.paintWall(x, y, CONDUCTIVE_WALL, 0);
      }
    }
  }
}

function fillRect(cells: Uint8Array, width: number, rect: WaterCurvatureVfxRect, material: Material): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * width + rect.x, y * width + rect.x + rect.width);
  }
}

function setPoint(cells: Uint8Array, width: number, point: WaterCurvatureVfxPoint, material: Material): void {
  cells[point.y * width + point.x] = material;
}
