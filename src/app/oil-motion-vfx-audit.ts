import { Material } from '../shared/materials';
import { OIL_MOTION_VFX_ATLAS_CATALOG } from '../shared/oil-motion-vfx-atlas-catalog.js';
import type {
  OilMotionVfxAuditSnapshot,
  OilMotionVfxPoint,
  OilMotionVfxRect,
  OilMotionVfxVector,
  OilMotionVfxWallRegion,
} from '../shared/oil-motion-vfx-atlas-catalog.js';
import type { SimulationBackend } from '../simulation';

export type {
  OilMotionVfxAuditSnapshot,
  OilMotionVfxBoundary,
  OilMotionVfxPoint,
  OilMotionVfxRect,
  OilMotionVfxTarget,
  OilMotionVfxVector,
  OilMotionVfxWallRegion,
} from '../shared/oil-motion-vfx-atlas-catalog.js';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;

/** Paused E69 variants share every authored plane; only exact-owner velocity changes. */
export type OilMotionVfxFixtureMode = 'still' | 'moving' | 'reversed';
export const OIL_MOTION_VFX_AUDIT: OilMotionVfxAuditSnapshot = (
  OIL_MOTION_VFX_ATLAS_CATALOG.atlases[0].descriptor.fixture
);

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
