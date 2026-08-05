import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CONDUCTIVE_WALL = 1;

export interface PlasmaCoreVfxPoint { readonly x: number; readonly y: number }
export interface PlasmaCoreVfxRect extends PlasmaCoreVfxPoint {
  readonly width: number;
  readonly height: number;
}

export interface PlasmaCoreVfxSparseChain {
  readonly carriers: readonly [PlasmaCoreVfxPoint, PlasmaCoreVfxPoint];
  readonly midpoint: PlasmaCoreVfxPoint;
  readonly gap: PlasmaCoreVfxPoint;
  readonly isolated: PlasmaCoreVfxPoint;
}

export interface PlasmaCoreVfxAuditSnapshot {
  readonly material: Material.Plasma;
  readonly body: PlasmaCoreVfxRect;
  readonly core: PlasmaCoreVfxRect;
  readonly shoulder: PlasmaCoreVfxRect;
  /** Dense exact-owner edge band with hydrated shared-emission support. */
  readonly aura: PlasmaCoreVfxRect;
  readonly authoredHole: PlasmaCoreVfxRect;
  readonly openChannel: PlasmaCoreVfxRect;
  readonly isolated: PlasmaCoreVfxPoint;
  readonly sparseChain: PlasmaCoreVfxSparseChain;
  /** Other Energy owners must retain their established independent styling. */
  readonly protectedControls: readonly {
    readonly material: Material.Fire | Material.ELEC | Material.PHOT;
    readonly code: 'FIRE' | 'ELEC' | 'PHOT';
    readonly body: PlasmaCoreVfxRect;
    readonly probe: PlasmaCoreVfxPoint;
  }[];
  readonly liquidContact: {
    readonly plasma: PlasmaCoreVfxRect;
    readonly water: PlasmaCoreVfxRect;
    readonly plasmaProbe: PlasmaCoreVfxPoint;
  };
  readonly solidContact: {
    readonly plasma: PlasmaCoreVfxRect;
    readonly metal: PlasmaCoreVfxRect;
    readonly plasmaProbe: PlasmaCoreVfxPoint;
  };
  /** Co-located native wall data must suppress the exact Plasma response. */
  readonly nativeWall: {
    readonly plasma: PlasmaCoreVfxRect;
    readonly wallAnchor: PlasmaCoreVfxPoint;
  };
  readonly guardedBlank: PlasmaCoreVfxRect;
  readonly conductiveWall: number;
}

export const PLASMA_CORE_VFX_AUDIT: PlasmaCoreVfxAuditSnapshot = {
  material: Material.Plasma,
  body: { x: 36, y: 24, width: 264, height: 152 },
  core: { x: 112, y: 70, width: 60, height: 50 },
  shoulder: { x: 50, y: 78, width: 34, height: 36 },
  aura: { x: 216, y: 78, width: 34, height: 36 },
  authoredHole: { x: 184, y: 84, width: 18, height: 18 },
  // This channel reaches the body's top edge so it is an actual open route,
  // not an enclosed void whose glow can be mistaken for a dense core.
  openChannel: { x: 264, y: 24, width: 36, height: 46 },
  protectedControls: [
    { material: Material.Fire, code: 'FIRE', body: { x: 36, y: 206, width: 80, height: 42 }, probe: { x: 74, y: 226 } },
    { material: Material.ELEC, code: 'ELEC', body: { x: 150, y: 206, width: 80, height: 42 }, probe: { x: 188, y: 226 } },
    { material: Material.PHOT, code: 'PHOT', body: { x: 264, y: 206, width: 80, height: 42 }, probe: { x: 302, y: 226 } },
  ],
  sparseChain: {
    carriers: [{ x: 36, y: 350 }, { x: 38, y: 350 }],
    midpoint: { x: 37, y: 350 },
    gap: { x: 54, y: 350 },
    isolated: { x: 72, y: 350 },
  },
  isolated: { x: 72, y: 350 },
  liquidContact: {
    // A one-cell Plasma rail makes every target fragment contact-aware and
    // prevents a nearby eligible Plasma interior from changing HDR bloom at
    // the exact seam probe.
    plasma: { x: 36, y: 278, width: 1, height: 34 },
    water: { x: 37, y: 278, width: 24, height: 34 },
    plasmaProbe: { x: 36, y: 294 },
  },
  solidContact: {
    plasma: { x: 126, y: 278, width: 1, height: 34 },
    metal: { x: 127, y: 278, width: 24, height: 34 },
    plasmaProbe: { x: 126, y: 294 },
  },
  nativeWall: {
    plasma: { x: 224, y: 278, width: 1, height: 1 },
    wallAnchor: { x: 224, y: 278 },
  },
  guardedBlank: { x: 332, y: 278, width: 140, height: 42 },
  conductiveWall: CONDUCTIVE_WALL,
};

interface PlasmaCoreFixtureBackend extends SimulationBackend {
  walls(): Uint8Array;
  paintWall(x: number, y: number, wall: number, radius: number): void;
}

/** Direct-fills one deterministic paused 612x384 E16 fixture. */
export function preparePlasmaCoreVfxFixture(simulation: SimulationBackend): void {
  if (!supportsPlasmaCoreFixture(simulation)) {
    throw new Error('Plasma-core VFX fixture requires RenderLab wall plane');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Plasma-core VFX fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  fillRect(cells, simulation.width, PLASMA_CORE_VFX_AUDIT.body, Material.Plasma);
  fillRect(cells, simulation.width, PLASMA_CORE_VFX_AUDIT.authoredHole, Material.Empty);
  fillRect(cells, simulation.width, PLASMA_CORE_VFX_AUDIT.openChannel, Material.Empty);
  for (const control of PLASMA_CORE_VFX_AUDIT.protectedControls) {
    fillRect(cells, simulation.width, control.body, control.material);
  }
  for (const carrier of PLASMA_CORE_VFX_AUDIT.sparseChain.carriers) {
    set(cells, simulation.width, carrier, Material.Plasma);
  }
  set(cells, simulation.width, PLASMA_CORE_VFX_AUDIT.isolated, Material.Plasma);

  fillRect(cells, simulation.width, PLASMA_CORE_VFX_AUDIT.liquidContact.plasma, Material.Plasma);
  fillRect(cells, simulation.width, PLASMA_CORE_VFX_AUDIT.liquidContact.water, Material.Water);
  fillRect(cells, simulation.width, PLASMA_CORE_VFX_AUDIT.solidContact.plasma, Material.Plasma);
  fillRect(cells, simulation.width, PLASMA_CORE_VFX_AUDIT.solidContact.metal, Material.Metal);
  fillRect(cells, simulation.width, PLASMA_CORE_VFX_AUDIT.nativeWall.plasma, Material.Plasma);
  simulation.paintWall(
    PLASMA_CORE_VFX_AUDIT.nativeWall.wallAnchor.x,
    PLASMA_CORE_VFX_AUDIT.nativeWall.wallAnchor.y,
    CONDUCTIVE_WALL,
    0,
  );
  fillRect(cells, simulation.width, PLASMA_CORE_VFX_AUDIT.guardedBlank, Material.Empty);
}

function supportsPlasmaCoreFixture(simulation: SimulationBackend): simulation is PlasmaCoreFixtureBackend {
  const candidate = simulation as Partial<PlasmaCoreFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.paintWall === 'function';
}

function fillRect(cells: Uint8Array, width: number, rect: PlasmaCoreVfxRect, material: Material): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * width + rect.x, y * width + rect.x + rect.width);
  }
}

function set(cells: Uint8Array, width: number, point: PlasmaCoreVfxPoint, material: Material): void {
  cells[point.y * width + point.x] = material;
}
