import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CONDUCTIVE_WALL = 1;

export interface GasCoreDepthVfxPoint { readonly x: number; readonly y: number }
export interface GasCoreDepthVfxRect extends GasCoreDepthVfxPoint {
  readonly width: number;
  readonly height: number;
}

/**
 * A deliberately broad exact-owner atmosphere body. E15 may distinguish its
 * core, crown, and pocket only after this native owner survives the existing
 * atmosphere propagation; holes and channels are authored Empty, not support.
 */
export interface GasCoreDepthVfxCard {
  readonly material: Material.Smoke | Material.Oxygen | Material.NobleGas;
  readonly code: 'SMKE' | 'O2' | 'NOBL';
  readonly body: GasCoreDepthVfxRect;
  readonly core: GasCoreDepthVfxRect;
  readonly crown: GasCoreDepthVfxRect;
  readonly crownBillow: number;
  readonly pocket: GasCoreDepthVfxRect;
  readonly pocketBillow: number;
  readonly authoredHole: GasCoreDepthVfxRect;
  readonly openChannel: GasCoreDepthVfxRect;
}

export interface GasCoreDepthVfxSparseChain {
  readonly material: Material.Smoke | Material.Oxygen | Material.NobleGas;
  readonly code: 'SMKE' | 'O2' | 'NOBL';
  readonly carriers: readonly [GasCoreDepthVfxPoint, GasCoreDepthVfxPoint];
  readonly midpoint: GasCoreDepthVfxPoint;
  readonly gap: GasCoreDepthVfxPoint;
  readonly isolated: GasCoreDepthVfxPoint;
}

export interface GasCoreDepthVfxAuditSnapshot {
  readonly cards: readonly GasCoreDepthVfxCard[];
  /** Foreign atmosphere identities must not inherit E15's target style. */
  readonly protectedGases: readonly {
    readonly material: Material.FOG | Material.CFLM | Material.Hydrogen;
    readonly code: 'FOG' | 'CFLM' | 'H2';
    readonly body: GasCoreDepthVfxRect;
    readonly probe: GasCoreDepthVfxPoint;
  }[];
  readonly sparseChains: readonly GasCoreDepthVfxSparseChain[];
  readonly solidContact: {
    readonly gas: GasCoreDepthVfxRect;
    readonly solid: GasCoreDepthVfxRect;
    readonly gasProbe: GasCoreDepthVfxPoint;
  };
  readonly liquidContact: {
    readonly gas: GasCoreDepthVfxRect;
    readonly liquid: GasCoreDepthVfxRect;
    readonly gasProbe: GasCoreDepthVfxPoint;
  };
  /**
   * A target gas owner deliberately touches foreign FOG. The atmosphere may
   * retain the target grade up to its own side of a mixed-gas interface; the
   * foreign probe must never inherit that target identity or response.
   */
  readonly foreignGasContact: {
    readonly gas: GasCoreDepthVfxRect;
    readonly foreignGas: GasCoreDepthVfxRect;
    readonly gasProbe: GasCoreDepthVfxPoint;
    readonly foreignProbe: GasCoreDepthVfxPoint;
  };
  /** Co-located native wall data must suppress propagated target style. */
  readonly nativeWall: {
    readonly gas: GasCoreDepthVfxRect;
    readonly wallAnchor: GasCoreDepthVfxPoint;
  };
  /** CFLM is a gas-phase emissive control, never an E15 target owner. */
  readonly emissiveGas: { readonly body: GasCoreDepthVfxRect; readonly probe: GasCoreDepthVfxPoint };
  readonly guardedBlank: GasCoreDepthVfxRect;
  readonly conductiveWall: number;
}

function card(
  material: GasCoreDepthVfxCard['material'], code: GasCoreDepthVfxCard['code'], x: number,
  crownCentre: GasCoreDepthVfxPoint, pocketCentre: GasCoreDepthVfxPoint,
): GasCoreDepthVfxCard {
  const body = { x, y: 20, width: 176, height: 140 };
  return {
    material, code, body,
    core: { x: x + 70, y: body.y + 52, width: 24, height: 22 },
    // These centres deliberately exercise the existing E04 static billow at
    // >= +0.80 and <= -0.89 respectively for every species. E15 therefore has
    // one strong key and one strong absorption probe without introducing a
    // separate fixture-only wave or clock.
    crown: { x: crownCentre.x - 8, y: crownCentre.y - 6, width: 16, height: 12 },
    crownBillow: gasCoreDepthVfxBillowAt(crownCentre),
    pocket: { x: pocketCentre.x - 8, y: pocketCentre.y - 6, width: 16, height: 12 },
    pocketBillow: gasCoreDepthVfxBillowAt(pocketCentre),
    authoredHole: { x: x + 104, y: body.y + 58, width: 18, height: 18 },
    // Wider than the half-resolution atmosphere kernel's two-sided reach, so
    // its centre remains a real open-air control rather than a legitimately
    // reconstructed E04 fringe between two dense walls.
    openChannel: { x: x + 140, y: body.y, width: 22, height: 44 },
  };
}

/** Mirrors E04's static, world-anchored three-wave billow for fixture calibration. */
export function gasCoreDepthVfxBillowAt(point: GasCoreDepthVfxPoint): number {
  const waveA = Math.sin(point.x * 0.055 + point.y * 0.031 + 0.80);
  const waveB = Math.sin(point.x * -0.029 + point.y * 0.081 + 2.15);
  const waveC = Math.sin(point.x * 0.097 + point.y * -0.043 + 4.05);
  return Math.max(-1, Math.min(1, waveA * 0.50 + waveB * 0.31 + waveC * 0.19));
}

function chain(
  material: GasCoreDepthVfxSparseChain['material'], code: GasCoreDepthVfxSparseChain['code'], x: number,
): GasCoreDepthVfxSparseChain {
  return {
    material, code,
    carriers: [{ x, y: 356 }, { x: x + 2, y: 356 }],
    midpoint: { x: x + 1, y: 356 },
    gap: { x: x + 16, y: 356 },
    isolated: { x: x + 34, y: 356 },
  };
}

export const GAS_CORE_DEPTH_VFX_AUDIT: GasCoreDepthVfxAuditSnapshot = {
  cards: [
    card(Material.Smoke, 'SMKE', 20, { x: 78, y: 96 }, { x: 38, y: 50 }),
    card(Material.Oxygen, 'O2', 218, { x: 290, y: 104 }, { x: 330, y: 142 }),
    card(Material.NobleGas, 'NOBL', 416, { x: 532, y: 102 }, { x: 456, y: 122 }),
  ],
  protectedGases: [
    { material: Material.FOG, code: 'FOG', body: { x: 20, y: 190, width: 104, height: 54 }, probe: { x: 44, y: 214 } },
    { material: Material.CFLM, code: 'CFLM', body: { x: 142, y: 190, width: 104, height: 54 }, probe: { x: 166, y: 214 } },
    { material: Material.Hydrogen, code: 'H2', body: { x: 264, y: 190, width: 104, height: 54 }, probe: { x: 288, y: 214 } },
  ],
  sparseChains: [
    chain(Material.Smoke, 'SMKE', 20),
    chain(Material.Oxygen, 'O2', 96),
    chain(Material.NobleGas, 'NOBL', 172),
  ],
  solidContact: {
    gas: { x: 20, y: 274, width: 34, height: 32 },
    solid: { x: 54, y: 274, width: 22, height: 32 },
    gasProbe: { x: 53, y: 290 },
  },
  liquidContact: {
    gas: { x: 96, y: 274, width: 34, height: 32 },
    liquid: { x: 130, y: 274, width: 22, height: 32 },
    gasProbe: { x: 129, y: 290 },
  },
  foreignGasContact: {
    gas: { x: 172, y: 274, width: 34, height: 32 },
    foreignGas: { x: 206, y: 274, width: 22, height: 32 },
    gasProbe: { x: 205, y: 290 },
    foreignProbe: { x: 207, y: 290 },
  },
  nativeWall: {
    gas: { x: 264, y: 274, width: 52, height: 36 },
    wallAnchor: { x: 290, y: 292 },
  },
  emissiveGas: {
    body: { x: 344, y: 274, width: 42, height: 32 },
    probe: { x: 364, y: 290 },
  },
  guardedBlank: { x: 430, y: 274, width: 108, height: 40 },
  conductiveWall: CONDUCTIVE_WALL,
};

interface GasCoreDepthFixtureBackend extends SimulationBackend {
  walls(): Uint8Array;
  paintWall(x: number, y: number, wall: number, radius: number): void;
}

/**
 * Direct-fills one deterministic paused 612x384 RenderLab scene. It does not
 * advance physics: RenderFieldSet owns the only atmosphere propagation used by
 * the matching audit, keeping E15's optical-depth source reproducible.
 */
export function prepareGasCoreDepthVfxFixture(simulation: SimulationBackend): void {
  if (!supportsGasCoreDepthFixture(simulation)) {
    throw new Error('Gas-core-depth VFX fixture requires RenderLab wall plane');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Gas-core-depth VFX fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();

  for (const entry of GAS_CORE_DEPTH_VFX_AUDIT.cards) {
    fillRect(cells, simulation.width, entry.body, entry.material);
    fillRect(cells, simulation.width, entry.authoredHole, Material.Empty);
    fillRect(cells, simulation.width, entry.openChannel, Material.Empty);
  }
  for (const entry of GAS_CORE_DEPTH_VFX_AUDIT.protectedGases) {
    fillRect(cells, simulation.width, entry.body, entry.material);
  }
  for (const entry of GAS_CORE_DEPTH_VFX_AUDIT.sparseChains) {
    for (const point of entry.carriers) set(cells, simulation.width, point, entry.material);
    set(cells, simulation.width, entry.isolated, entry.material);
  }

  fillRect(cells, simulation.width, GAS_CORE_DEPTH_VFX_AUDIT.solidContact.gas, Material.Smoke);
  fillRect(cells, simulation.width, GAS_CORE_DEPTH_VFX_AUDIT.solidContact.solid, Material.Metal);
  fillRect(cells, simulation.width, GAS_CORE_DEPTH_VFX_AUDIT.liquidContact.gas, Material.Oxygen);
  fillRect(cells, simulation.width, GAS_CORE_DEPTH_VFX_AUDIT.liquidContact.liquid, Material.Water);
  fillRect(cells, simulation.width, GAS_CORE_DEPTH_VFX_AUDIT.foreignGasContact.gas, Material.NobleGas);
  fillRect(cells, simulation.width, GAS_CORE_DEPTH_VFX_AUDIT.foreignGasContact.foreignGas, Material.FOG);
  fillRect(cells, simulation.width, GAS_CORE_DEPTH_VFX_AUDIT.nativeWall.gas, Material.Smoke);
  simulation.paintWall(
    GAS_CORE_DEPTH_VFX_AUDIT.nativeWall.wallAnchor.x,
    GAS_CORE_DEPTH_VFX_AUDIT.nativeWall.wallAnchor.y,
    CONDUCTIVE_WALL, 0,
  );
  fillRect(cells, simulation.width, GAS_CORE_DEPTH_VFX_AUDIT.emissiveGas.body, Material.CFLM);
  fillRect(cells, simulation.width, GAS_CORE_DEPTH_VFX_AUDIT.guardedBlank, Material.Empty);
}

function supportsGasCoreDepthFixture(simulation: SimulationBackend): simulation is GasCoreDepthFixtureBackend {
  const candidate = simulation as Partial<GasCoreDepthFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.paintWall === 'function';
}

function fillRect(cells: Uint8Array, width: number, rect: GasCoreDepthVfxRect, material: Material): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * width + rect.x, y * width + rect.x + rect.width);
  }
}

function set(cells: Uint8Array, width: number, point: GasCoreDepthVfxPoint, material: Material): void {
  cells[point.y * width + point.x] = material;
}
