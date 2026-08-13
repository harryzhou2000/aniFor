import { Material } from '../shared/materials';
import { LIQUID_MOTION_VFX_ATLAS_CATALOG } from '../shared/liquid-motion-vfx-atlas-catalog.js';
import type {
  LiquidMotionVfxAuditSnapshot,
  LiquidMotionVfxPoint,
  LiquidMotionVfxPool,
  LiquidMotionVfxRect,
  LiquidMotionVfxWallPattern,
} from '../shared/liquid-motion-vfx-atlas-catalog.js';
import type { SimulationBackend } from '../simulation';

export type {
  LiquidMotionVfxAuditSnapshot,
  LiquidMotionVfxBoundary,
  LiquidMotionVfxPoint,
  LiquidMotionVfxPool,
  LiquidMotionVfxRect,
  LiquidMotionVfxVector,
  LiquidMotionVfxWallPattern,
} from '../shared/liquid-motion-vfx-atlas-catalog.js';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CONDUCTIVE_WALL = 1;
const WALL_BLOCK_SIZE = 4;

/** The paused scene is topologically identical in both modes; only these bytes vary. */
export type LiquidMotionVfxFixtureMode = 'still' | 'moving';

/**
 * Paused E65 Water-motion fixture. The still/moving comparison changes only
 * exact owned velocity bytes, keeping matter, holes, contacts, wall, and air
 * topology byte-identical so a visual response cannot infer motion from shape.
 */
export const LIQUID_MOTION_VFX_AUDIT: LiquidMotionVfxAuditSnapshot = (
  LIQUID_MOTION_VFX_ATLAS_CATALOG.atlases[0].descriptor.fixture
);

interface LiquidMotionVfxFixtureBackend extends SimulationBackend {
  walls(): Uint8Array;
  velocity(): Int8Array;
  paintWall(x: number, y: number, wall: number, radius: number): void;
  setFixtureVelocityRect(
    x: number, y: number, width: number, height: number, velocityX: number, velocityY: number,
  ): void;
}

export function prepareLiquidMotionVfxFixture(
  simulation: SimulationBackend,
  mode: LiquidMotionVfxFixtureMode,
): void {
  if (!supportsFixture(simulation)) {
    throw new Error('Liquid-motion VFX fixture requires render-lab velocity and wall planes');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Liquid-motion VFX fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  const fixture = LIQUID_MOTION_VFX_AUDIT;

  for (const entry of fixture.pools) {
    fillRect(cells, simulation.width, entry.body, entry.material);
    fillRect(cells, simulation.width, entry.authoredHole, Material.Empty);
    fillRect(cells, simulation.width, entry.openChimney, Material.Empty);
  }
  const { strand, isolated, oil, acid } = fixture.moving;
  fillRect(cells, simulation.width, strand, strand.material);
  setPoint(cells, simulation.width, isolated, isolated.material);
  fillRect(cells, simulation.width, oil, oil.material);
  fillRect(cells, simulation.width, acid, acid.material);
  for (const entry of Object.values(fixture.contacts)) {
    fillRect(cells, simulation.width, entry.water, Material.Water);
    fillRect(cells, simulation.width, entry.other, entry.otherMaterial);
  }
  fillRect(cells, simulation.width, fixture.guardedBlank, Material.Empty);
  paintWallPattern(simulation, fixture.wallCoexistence);

  if (mode === 'moving') {
    setExactOwnerVelocityRuns(simulation, cells, fixture.pools[1]);
    simulation.setFixtureVelocityRect(
      strand.x, strand.y, strand.width, strand.height, strand.velocity.x, strand.velocity.y,
    );
    simulation.setFixtureVelocityRect(isolated.x, isolated.y, 1, 1, isolated.velocity.x, isolated.velocity.y);
    for (const entry of [oil, acid]) simulation.setFixtureVelocityRect(
      entry.x, entry.y, entry.width, entry.height, entry.velocity.x, entry.velocity.y,
    );
  }
}

function supportsFixture(simulation: SimulationBackend): simulation is LiquidMotionVfxFixtureBackend {
  const candidate = simulation as Partial<LiquidMotionVfxFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.velocity === 'function'
    && typeof candidate.paintWall === 'function' && typeof candidate.setFixtureVelocityRect === 'function';
}

/** Does not paint through holes/chimneys: only exact Water owns motion. */
function setExactOwnerVelocityRuns(
  simulation: LiquidMotionVfxFixtureBackend, cells: Uint8Array, entry: LiquidMotionVfxPool,
): void {
  const right = entry.body.x + entry.body.width;
  for (let y = entry.body.y; y < entry.body.y + entry.body.height; y++) {
    for (let x = entry.body.x; x < right;) {
      while (x < right && cells[y * simulation.width + x] !== entry.material) x++;
      const start = x;
      while (x < right && cells[y * simulation.width + x] === entry.material) x++;
      if (x > start) simulation.setFixtureVelocityRect(
        start, y, x - start, 1, entry.velocity.x, entry.velocity.y,
      );
    }
  }
}

function paintWallPattern(
  simulation: LiquidMotionVfxFixtureBackend, pattern: LiquidMotionVfxWallPattern,
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

function fillRect(cells: Uint8Array, width: number, rect: LiquidMotionVfxRect, material: Material): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * width + rect.x, y * width + rect.x + rect.width);
  }
}

function setPoint(cells: Uint8Array, width: number, point: LiquidMotionVfxPoint, material: Material): void {
  cells[point.y * width + point.x] = material;
}
