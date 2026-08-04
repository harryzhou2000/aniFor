import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CONDUCTIVE_WALL = 1;

export type GasMotionVfxFixtureMode = 'directed' | 'reversed' | 'still';

export interface GasMotionVfxPoint { readonly x: number; readonly y: number }
export interface GasMotionVfxRect extends GasMotionVfxPoint {
  readonly width: number;
  readonly height: number;
}
export interface GasMotionVector { readonly x: number; readonly y: number }

export interface GasMotionVfxCard {
  readonly material: Material.Smoke | Material.FOG | Material.CFLM;
  readonly code: 'SMKE' | 'FOG' | 'CFLM';
  readonly body: GasMotionVfxRect;
  readonly coreProbe: GasMotionVfxRect;
  readonly authoredHole: GasMotionVfxRect;
  readonly openChannel: GasMotionVfxRect;
  readonly leftShoulder: GasMotionVfxRect;
  readonly rightShoulder: GasMotionVfxRect;
  readonly topShoulder: GasMotionVfxRect;
  readonly bottomShoulder: GasMotionVfxRect;
  readonly velocity: GasMotionVector;
}

export interface GasMotionSparseChain {
  readonly material: Material.Smoke | Material.FOG | Material.CFLM;
  readonly code: 'SMKE' | 'FOG' | 'CFLM';
  readonly carriers: readonly [GasMotionVfxPoint, GasMotionVfxPoint];
  /** Reconstructed atmosphere between two exact carriers. */
  readonly midpoint: GasMotionVfxPoint;
  /** Far enough from either carrier to remain authored transparent air. */
  readonly gap: GasMotionVfxPoint;
  readonly isolated: GasMotionVfxPoint;
}

export interface GasMotionVfxAuditSnapshot {
  readonly cards: readonly GasMotionVfxCard[];
  /** Dense noisy-flow control: its semantic body stays fixed while adjacent
   * exact owners alternate opposite horizontal velocity bytes. */
  readonly counterflow: {
    readonly material: Material.Smoke;
    readonly body: GasMotionVfxRect;
    readonly authoredHole: GasMotionVfxRect;
    readonly openChannel: GasMotionVfxRect;
    readonly leftProbe: GasMotionVfxRect;
    readonly rightProbe: GasMotionVfxRect;
    readonly velocityMagnitude: 48;
  };
  readonly stillCloud: {
    readonly material: Material.Oxygen;
    readonly body: GasMotionVfxRect;
    readonly coreProbe: GasMotionVfxRect;
    readonly authoredHole: GasMotionVfxRect;
  };
  readonly sparseChains: readonly GasMotionSparseChain[];
  readonly solidContact: {
    readonly gas: GasMotionVfxRect;
    readonly solid: GasMotionVfxRect;
  };
  readonly liquidContact: {
    readonly gas: GasMotionVfxRect;
    readonly liquid: GasMotionVfxRect;
  };
  readonly nativeWall: GasMotionVfxPoint;
  readonly guardedBlank: GasMotionVfxRect;
}

function card(
  material: GasMotionVfxCard['material'],
  code: GasMotionVfxCard['code'],
  x: number,
  velocity: GasMotionVector,
): GasMotionVfxCard {
  const body = { x, y: 28, width: 156, height: 112 };
  return {
    material, code, body, velocity,
    coreProbe: { x: x + 32, y: body.y + 43, width: 28, height: 28 },
    authoredHole: { x: x + 70, y: body.y + 50, width: 10, height: 10 },
    openChannel: { x: x + 112, y: body.y, width: 7, height: 34 },
    // Probe the exact-owner surface layer, not the already saturated interior:
    // E07 reads direction only where the shared atmosphere still has a slope.
    leftShoulder: { x, y: body.y + 45, width: 6, height: 22 },
    rightShoulder: { x: x + body.width - 6, y: body.y + 45, width: 6, height: 22 },
    topShoulder: { x: x + 62, y: body.y, width: 28, height: 6 },
    bottomShoulder: { x: x + 62, y: body.y + body.height - 6, width: 28, height: 6 },
  };
}

export const GAS_MOTION_VFX_AUDIT: GasMotionVfxAuditSnapshot = {
  cards: [
    card(Material.Smoke, 'SMKE', 20, { x: 48, y: 0 }),
    card(Material.FOG, 'FOG', 228, { x: -48, y: 0 }),
    card(Material.CFLM, 'CFLM', 436, { x: 0, y: 48 }),
  ],
  counterflow: {
    material: Material.Smoke,
    body: { x: 24, y: 332, width: 160, height: 40 },
    authoredHole: { x: 94, y: 348, width: 6, height: 6 },
    openChannel: { x: 132, y: 332, width: 4, height: 10 },
    leftProbe: { x: 32, y: 344, width: 8, height: 16 },
    rightProbe: { x: 168, y: 344, width: 8, height: 16 },
    velocityMagnitude: 48,
  },
  stillCloud: {
    material: Material.Oxygen,
    body: { x: 26, y: 214, width: 158, height: 104 },
    coreProbe: { x: 60, y: 248, width: 28, height: 28 },
    authoredHole: { x: 96, y: 260, width: 10, height: 10 },
  },
  sparseChains: [
    chain(Material.Smoke, 'SMKE', 232, 220),
    chain(Material.FOG, 'FOG', 232, 264),
    chain(Material.CFLM, 'CFLM', 232, 308),
  ],
  solidContact: {
    gas: { x: 438, y: 218, width: 36, height: 32 },
    solid: { x: 474, y: 218, width: 20, height: 32 },
  },
  liquidContact: {
    gas: { x: 438, y: 278, width: 36, height: 32 },
    liquid: { x: 474, y: 278, width: 20, height: 32 },
  },
  nativeWall: { x: 544, y: 244 },
  guardedBlank: { x: 518, y: 334, width: 68, height: 30 },
};

interface GasMotionFixtureBackend extends SimulationBackend {
  walls(): Uint8Array;
  velocity(): Int8Array;
  paintWall(x: number, y: number, wall: number, radius: number): void;
  setFixtureVelocityRect(
    x: number, y: number, width: number, height: number,
    velocityX: number, velocityY: number,
  ): void;
}

/**
 * Builds a paused, topology-identical E07 comparison. `directed` changes only
 * the render-lab velocity bytes under exact dense gas owners; every atmosphere
 * source, hole, contact, wall, and sparse carrier remains byte-identical to
 * `still`. The renderer therefore has no excuse to infer motion from support.
 */
export function prepareGasMotionVfxFixture(
  simulation: SimulationBackend,
  mode: GasMotionVfxFixtureMode,
): void {
  if (!supportsGasMotionFixture(simulation)) {
    throw new Error('Gas-motion VFX fixture requires render-lab velocity and wall planes');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Gas-motion VFX fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();

  for (const entry of GAS_MOTION_VFX_AUDIT.cards) {
    fillRoundedBody(cells, simulation.width, entry.body, entry.material);
    fillRect(cells, simulation.width, entry.authoredHole, Material.Empty);
    fillRect(cells, simulation.width, entry.openChannel, Material.Empty);
  }
  const counterflow = GAS_MOTION_VFX_AUDIT.counterflow;
  // Keep this control aligned to complete 2x2 atmosphere seed blocks. Every
  // supported field texel then receives an exact +v/-v checker pair, so any
  // residual E07 response is a presentation bug rather than rounded-edge bias.
  fillRect(cells, simulation.width, counterflow.body, counterflow.material);
  fillRect(cells, simulation.width, counterflow.authoredHole, Material.Empty);
  fillRect(cells, simulation.width, counterflow.openChannel, Material.Empty);
  fillRoundedBody(
    cells, simulation.width, GAS_MOTION_VFX_AUDIT.stillCloud.body,
    GAS_MOTION_VFX_AUDIT.stillCloud.material,
  );
  fillRect(
    cells, simulation.width, GAS_MOTION_VFX_AUDIT.stillCloud.authoredHole, Material.Empty,
  );

  for (const entry of GAS_MOTION_VFX_AUDIT.sparseChains) {
    for (const point of entry.carriers) setPoint(cells, simulation.width, point, entry.material);
    setPoint(cells, simulation.width, entry.isolated, entry.material);
  }
  fillRect(cells, simulation.width, GAS_MOTION_VFX_AUDIT.solidContact.gas, Material.Smoke);
  fillRect(cells, simulation.width, GAS_MOTION_VFX_AUDIT.solidContact.solid, Material.Metal);
  fillRect(cells, simulation.width, GAS_MOTION_VFX_AUDIT.liquidContact.gas, Material.FOG);
  fillRect(cells, simulation.width, GAS_MOTION_VFX_AUDIT.liquidContact.liquid, Material.Water);
  fillRect(cells, simulation.width, GAS_MOTION_VFX_AUDIT.guardedBlank, Material.Empty);
  simulation.paintWall(
    GAS_MOTION_VFX_AUDIT.nativeWall.x, GAS_MOTION_VFX_AUDIT.nativeWall.y,
    CONDUCTIVE_WALL, 0,
  );

  if (mode !== 'still') {
    for (const entry of GAS_MOTION_VFX_AUDIT.cards) {
      setExactOwnerVelocityRuns(simulation, cells, entry, mode === 'reversed' ? -1 : 1);
    }
    setCounterflowVelocityRuns(simulation, cells, counterflow, mode === 'reversed' ? -1 : 1);
  }
}

function chain(
  material: GasMotionSparseChain['material'], code: GasMotionSparseChain['code'],
  x: number, y: number,
): GasMotionSparseChain {
  return {
    material, code,
    carriers: [{ x, y }, { x: x + 2, y }],
    midpoint: { x: x + 1, y },
    gap: { x: x + 16, y },
    isolated: { x: x + 34, y },
  };
}

function supportsGasMotionFixture(
  simulation: SimulationBackend,
): simulation is GasMotionFixtureBackend {
  const candidate = simulation as Partial<GasMotionFixtureBackend>;
  return typeof candidate.walls === 'function'
    && typeof candidate.velocity === 'function'
    && typeof candidate.paintWall === 'function'
    && typeof candidate.setFixtureVelocityRect === 'function';
}

function fillRoundedBody(
  cells: Uint8Array, worldWidth: number, rect: GasMotionVfxRect, material: Material,
): void {
  const radiusX = rect.width * 0.5;
  const radiusY = rect.height * 0.5;
  const centreX = rect.x + radiusX;
  const centreY = rect.y + radiusY;
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      const normalizedX = Math.abs((x + 0.5 - centreX) / radiusX);
      const normalizedY = Math.abs((y + 0.5 - centreY) / radiusY);
      if (normalizedX ** 4 + normalizedY ** 4 <= 1) cells[y * worldWidth + x] = material;
    }
  }
}

function setExactOwnerVelocityRuns(
  simulation: GasMotionFixtureBackend,
  cells: Uint8Array,
  entry: GasMotionVfxCard,
  direction: -1 | 1,
): void {
  const right = entry.body.x + entry.body.width;
  for (let y = entry.body.y; y < entry.body.y + entry.body.height; y++) {
    let x = entry.body.x;
    while (x < right) {
      while (x < right && cells[y * simulation.width + x] !== entry.material) x++;
      const start = x;
      while (x < right && cells[y * simulation.width + x] === entry.material) x++;
      if (x > start) {
        simulation.setFixtureVelocityRect(
          start, y, x - start, 1,
          entry.velocity.x * direction, entry.velocity.y * direction,
        );
      }
    }
  }
}

/** Writes only exact Smoke owners so holes and channels remain zero-velocity
 * controls even when neighbouring owners alternate. */
function setCounterflowVelocityRuns(
  simulation: GasMotionFixtureBackend,
  cells: Uint8Array,
  entry: GasMotionVfxAuditSnapshot['counterflow'],
  direction: -1 | 1,
): void {
  for (let y = entry.body.y; y < entry.body.y + entry.body.height; y++) {
    for (let x = entry.body.x; x < entry.body.x + entry.body.width; x++) {
      if (cells[y * simulation.width + x] !== entry.material) continue;
      const velocityX = ((x + y) & 1) === 0
        ? entry.velocityMagnitude * direction : -entry.velocityMagnitude * direction;
      simulation.setFixtureVelocityRect(x, y, 1, 1, velocityX, 0);
    }
  }
}

function fillRect(
  cells: Uint8Array, worldWidth: number, rect: GasMotionVfxRect, material: Material,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * worldWidth + rect.x, y * worldWidth + rect.x + rect.width);
  }
}

function setPoint(
  cells: Uint8Array, worldWidth: number, point: GasMotionVfxPoint, material: Material,
): void {
  cells[point.y * worldWidth + point.x] = material;
}
