import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CONDUCTIVE_WALL = 1;

export interface PowderSolidContactVfxPoint { readonly x: number; readonly y: number }
export interface PowderSolidContactVfxRect extends PowderSolidContactVfxPoint {
  readonly width: number;
  readonly height: number;
}

export interface PowderSolidContactVfxTarget {
  readonly code: 'SAND_BRICK' | 'CLAY_METAL' | 'CONCRETE_GLASS';
  readonly powderMaterial: Material.Sand | Material.Clay | Material.Concrete;
  readonly solidMaterial: Material.Brick | Material.Metal | Material.Glass;
  /** Dense static powder immediately above a broad exact-solid support. */
  readonly powder: PowderSolidContactVfxRect;
  readonly solid: PowderSolidContactVfxRect;
  /** Centre of the exact horizontal Powder/Solid ownership boundary. */
  readonly seam: PowderSolidContactVfxPoint;
}

export interface PowderSolidContactVfxAuditSnapshot {
  readonly targets: readonly PowderSolidContactVfxTarget[];
  readonly moving: {
    readonly powder: PowderSolidContactVfxRect;
    readonly solid: PowderSolidContactVfxRect;
    readonly velocity: readonly [number, number];
    readonly probe: PowderSolidContactVfxPoint;
  };
  readonly fine: {
    readonly powder: PowderSolidContactVfxRect;
    readonly solid: PowderSolidContactVfxRect;
    readonly probe: PowderSolidContactVfxPoint;
  };
  readonly isolated: {
    readonly powder: PowderSolidContactVfxPoint;
    readonly solid: PowderSolidContactVfxRect;
  };
  readonly wet: {
    readonly water: PowderSolidContactVfxRect;
    readonly sandPoints: readonly PowderSolidContactVfxPoint[];
    readonly probe: PowderSolidContactVfxPoint;
  };
  readonly wall: {
    readonly powder: PowderSolidContactVfxRect;
    readonly solid: PowderSolidContactVfxRect;
    /** Powder/Solid contact cell co-located with the native wall block. */
    readonly probe: PowderSolidContactVfxPoint;
    readonly wallPoint: PowderSolidContactVfxPoint;
  };
  readonly unlikePowder: {
    readonly sand: PowderSolidContactVfxRect;
    readonly clay: PowderSolidContactVfxRect;
    readonly solid: PowderSolidContactVfxRect;
    readonly seam: PowderSolidContactVfxPoint;
  };
  readonly airGap: {
    readonly powder: PowderSolidContactVfxRect;
    readonly gap: PowderSolidContactVfxRect;
    readonly solid: PowderSolidContactVfxRect;
    readonly probe: PowderSolidContactVfxPoint;
  };
  readonly conductiveWall: number;
}

const target = (
  code: PowderSolidContactVfxTarget['code'],
  powderMaterial: PowderSolidContactVfxTarget['powderMaterial'],
  solidMaterial: PowderSolidContactVfxTarget['solidMaterial'],
  x: number,
): PowderSolidContactVfxTarget => ({
  code,
  powderMaterial,
  solidMaterial,
  powder: { x: x + 20, y: 28, width: 140, height: 72 },
  solid: { x: x + 8, y: 100, width: 164, height: 36 },
  seam: { x: x + 90, y: 99 },
});

/**
 * Paused exact-owner scene for E09's normal-detail Powder/Solid contact study.
 * It intentionally owns no renderer toggle: it supplies the semantic fixtures
 * that a later browser gate can capture off -> on -> off.
 */
export const POWDER_SOLID_CONTACT_VFX_AUDIT: PowderSolidContactVfxAuditSnapshot = {
  targets: [
    target('SAND_BRICK', Material.Sand, Material.Brick, 24),
    target('CLAY_METAL', Material.Clay, Material.Metal, 216),
    target('CONCRETE_GLASS', Material.Concrete, Material.Glass, 408),
  ],
  moving: {
    powder: { x: 24, y: 176, width: 72, height: 48 },
    solid: { x: 16, y: 224, width: 88, height: 24 },
    velocity: [12, 0],
    probe: { x: 60, y: 223 },
  },
  fine: {
    powder: { x: 134, y: 188, width: 1, height: 36 },
    solid: { x: 126, y: 224, width: 17, height: 24 },
    probe: { x: 134, y: 223 },
  },
  isolated: {
    powder: { x: 174, y: 223 },
    solid: { x: 166, y: 224, width: 17, height: 24 },
  },
  wet: {
    water: { x: 216, y: 184, width: 92, height: 64 },
    sandPoints: buildWetSandPoints(216, 184, 92, 64),
    probe: { x: 253, y: 204 },
  },
  wall: {
    powder: { x: 336, y: 176, width: 64, height: 48 },
    solid: { x: 328, y: 224, width: 80, height: 24 },
    // Sample from the horizontal interior of the 4x4 bmap proxy block so the
    // 1x capture footprint cannot alias the neighbouring un-walled contact.
    probe: { x: 361, y: 223 },
    // RenderLabBackend's bmap proxy writes 4x4 blocks along this anchor row.
    wallPoint: { x: 360, y: 220 },
  },
  unlikePowder: {
    sand: { x: 432, y: 176, width: 36, height: 48 },
    clay: { x: 468, y: 176, width: 36, height: 48 },
    solid: { x: 424, y: 224, width: 88, height: 24 },
    seam: { x: 468, y: 200 },
  },
  airGap: {
    powder: { x: 24, y: 288, width: 72, height: 32 },
    gap: { x: 16, y: 320, width: 88, height: 1 },
    solid: { x: 16, y: 321, width: 88, height: 24 },
    probe: { x: 60, y: 320 },
  },
  conductiveWall: CONDUCTIVE_WALL,
};

interface PowderSolidContactFixtureBackend extends SimulationBackend {
  walls(): Uint8Array;
  velocity(): Int8Array;
  paintWall(x: number, y: number, wall: number, radius: number): void;
  setFixtureVelocityRect(
    x: number, y: number, width: number, height: number, velocityX: number, velocityY: number,
  ): void;
}

/** Direct-fills a paused RenderLabBackend; it must never route through native physics or a brush ABI. */
export function preparePowderSolidContactVfxAudit(simulation: SimulationBackend): void {
  if (!supportsPowderSolidContactFixture(simulation)) {
    throw new Error('Powder/Solid contact VFX fixture requires the render-lab wall and velocity planes');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Powder/Solid contact VFX fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of POWDER_SOLID_CONTACT_VFX_AUDIT.targets) {
    fillRect(cells, simulation.width, entry.powder, entry.powderMaterial);
    fillRect(cells, simulation.width, entry.solid, entry.solidMaterial);
  }

  const { moving, fine, isolated, wet, wall, unlikePowder, airGap } = POWDER_SOLID_CONTACT_VFX_AUDIT;
  fillRect(cells, simulation.width, moving.powder, Material.Sand);
  fillRect(cells, simulation.width, moving.solid, Material.Brick);
  simulation.setFixtureVelocityRect(...rectValues(moving.powder), ...moving.velocity);

  fillRect(cells, simulation.width, fine.powder, Material.Clay);
  fillRect(cells, simulation.width, fine.solid, Material.Metal);
  cells[isolated.powder.y * simulation.width + isolated.powder.x] = Material.Sand;
  fillRect(cells, simulation.width, isolated.solid, Material.Glass);

  fillRect(cells, simulation.width, wet.water, Material.Water);
  for (const point of wet.sandPoints) cells[point.y * simulation.width + point.x] = Material.Sand;

  fillRect(cells, simulation.width, wall.powder, Material.Concrete);
  fillRect(cells, simulation.width, wall.solid, Material.Brick);
  // Use a broad co-located wall strip so the normal 1x capture footprint is
  // entirely wall-owned instead of aliasing a neighbouring eligible contact.
  for (let x = wall.wallPoint.x - 8; x <= wall.wallPoint.x + 8; x += 4) {
    simulation.paintWall(x, wall.wallPoint.y, CONDUCTIVE_WALL, 0);
  }

  fillRect(cells, simulation.width, unlikePowder.sand, Material.Sand);
  fillRect(cells, simulation.width, unlikePowder.clay, Material.Clay);
  fillRect(cells, simulation.width, unlikePowder.solid, Material.Brick);

  fillRect(cells, simulation.width, airGap.powder, Material.Sand);
  fillRect(cells, simulation.width, airGap.gap, Material.Empty);
  fillRect(cells, simulation.width, airGap.solid, Material.Brick);
}

function supportsPowderSolidContactFixture(
  simulation: SimulationBackend,
): simulation is PowderSolidContactFixtureBackend {
  const candidate = simulation as Partial<PowderSolidContactFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.velocity === 'function'
    && typeof candidate.paintWall === 'function' && typeof candidate.setFixtureVelocityRect === 'function';
}

function fillRect(cells: Uint8Array, width: number, rect: PowderSolidContactVfxRect, material: Material): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * width + rect.x, y * width + rect.x + rect.width);
  }
}

function rectValues(rect: PowderSolidContactVfxRect): [number, number, number, number] {
  return [rect.x, rect.y, rect.width, rect.height];
}

function buildWetSandPoints(x: number, y: number, width: number, height: number): readonly PowderSolidContactVfxPoint[] {
  const points: PowderSolidContactVfxPoint[] = [];
  for (let py = y; py < y + height; py++) for (let px = x; px < x + width; px++) {
    if ((px - x + py - y) % 3 !== 2) points.push({ x: px, y: py });
  }
  return points;
}
