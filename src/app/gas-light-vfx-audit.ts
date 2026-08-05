import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CONDUCTIVE_WALL = 1;

export interface GasLightVfxPoint { readonly x: number; readonly y: number }
export interface GasLightVfxRect extends GasLightVfxPoint {
  readonly width: number;
  readonly height: number;
}

/**
 * One dense atmosphere-owned body and one deliberately external, non-gas
 * emitter. The two shoulder probes face toward/away from that emitter, while
 * the core is sufficiently deep to remain a transport no-op control.
 */
export interface GasLightVfxCard {
  readonly material: Material.Smoke | Material.FOG;
  readonly code: 'SMKE' | 'FOG';
  readonly body: GasLightVfxRect;
  readonly emitter: GasLightVfxRect & { readonly material: Material.Fire | Material.GRVT };
  readonly litShoulder: GasLightVfxRect;
  readonly unlitShoulder: GasLightVfxRect;
  readonly deepCore: GasLightVfxRect;
  readonly authoredHole: GasLightVfxRect;
  readonly openChannel: GasLightVfxRect;
}

export interface GasLightVfxSparseChain {
  readonly material: Material.Smoke | Material.FOG | Material.CFLM;
  readonly code: 'SMKE' | 'FOG' | 'CFLM';
  readonly carriers: readonly [GasLightVfxPoint, GasLightVfxPoint];
  readonly midpoint: GasLightVfxPoint;
  readonly gap: GasLightVfxPoint;
  readonly isolated: GasLightVfxPoint;
}

export interface GasLightVfxAuditSnapshot {
  readonly cards: readonly GasLightVfxCard[];
  /** E13 must not opt into any other propagated gas style, even under a light. */
  readonly protectedGases: readonly {
    readonly material: Material.Oxygen | Material.CFLM | Material.NobleGas;
    readonly code: 'O2' | 'CFLM' | 'NOBL';
    readonly body: GasLightVfxRect;
    readonly probe: GasLightVfxPoint;
    readonly emitter: GasLightVfxRect & { readonly material: Material.Fire | Material.GRVT };
  }[];
  readonly sparseChains: readonly GasLightVfxSparseChain[];
  readonly solidContact: {
    readonly gas: GasLightVfxRect;
    readonly solid: GasLightVfxRect;
    /** Exact gas owner against the foreign-material seam. */
    readonly gasProbe: GasLightVfxPoint;
  };
  readonly liquidContact: {
    readonly gas: GasLightVfxRect;
    readonly liquid: GasLightVfxRect;
    /** Exact gas owner against the foreign-material seam. */
    readonly gasProbe: GasLightVfxPoint;
  };
  /** Gas and a native wall deliberately co-occupy this exact world cell. */
  readonly nativeWall: { readonly gas: GasLightVfxRect; readonly wallAnchor: GasLightVfxPoint };
  readonly guardedBlank: GasLightVfxRect;
  readonly conductiveWall: number;
}

function card(
  material: GasLightVfxCard['material'], code: GasLightVfxCard['code'],
  body: GasLightVfxRect, emitter: GasLightVfxCard['emitter'], litOnLeft: boolean,
): GasLightVfxCard {
  const shoulderY = body.y + 42;
  const litX = litOnLeft ? body.x + 2 : body.x + body.width - 10;
  const unlitX = litOnLeft ? body.x + body.width - 10 : body.x + 2;
  return {
    material, code, body, emitter,
    litShoulder: { x: litX, y: shoulderY, width: 8, height: 28 },
    unlitShoulder: { x: unlitX, y: shoulderY, width: 8, height: 28 },
    // Keep the deep probe left of the central authored hole on both mirrored
    // cards; it measures a real dense owner rather than reconstructed support.
    deepCore: { x: body.x + 64, y: body.y + 38, width: 24, height: 36 },
    authoredHole: { x: body.x + 104, y: body.y + 50, width: 14, height: 12 },
    openChannel: litOnLeft
      ? { x: body.x + body.width - 10, y: body.y, width: 10, height: 34 }
      : { x: body.x, y: body.y, width: 10, height: 34 },
  };
}

function chain(
  material: GasLightVfxSparseChain['material'], code: GasLightVfxSparseChain['code'], x: number,
): GasLightVfxSparseChain {
  return {
    material, code,
    carriers: [{ x, y: 292 }, { x: x + 2, y: 292 }],
    midpoint: { x: x + 1, y: 292 },
    gap: { x: x + 18, y: 292 },
    isolated: { x: x + 38, y: 292 },
  };
}

export const GAS_LIGHT_VFX_AUDIT: GasLightVfxAuditSnapshot = {
  cards: [
    card(Material.Smoke, 'SMKE', { x: 28, y: 24, width: 220, height: 118 },
      { x: 20, y: 63, width: 6, height: 36, material: Material.Fire }, true),
    card(Material.FOG, 'FOG', { x: 332, y: 24, width: 220, height: 118 },
      { x: 554, y: 63, width: 6, height: 36, material: Material.GRVT }, false),
  ],
  protectedGases: [
    {
      material: Material.Oxygen, code: 'O2', body: { x: 24, y: 172, width: 124, height: 72 },
      probe: { x: 28, y: 204 }, emitter: { x: 16, y: 190, width: 6, height: 30, material: Material.Fire },
    },
    {
      material: Material.CFLM, code: 'CFLM', body: { x: 184, y: 172, width: 124, height: 72 },
      probe: { x: 304, y: 204 }, emitter: { x: 310, y: 190, width: 6, height: 30, material: Material.GRVT },
    },
    {
      material: Material.NobleGas, code: 'NOBL', body: { x: 344, y: 172, width: 124, height: 72 },
      probe: { x: 464, y: 204 }, emitter: { x: 470, y: 190, width: 6, height: 30, material: Material.Fire },
    },
  ],
  sparseChains: [
    chain(Material.Smoke, 'SMKE', 24),
    chain(Material.FOG, 'FOG', 152),
    chain(Material.CFLM, 'CFLM', 280),
  ],
  solidContact: {
    gas: { x: 424, y: 270, width: 34, height: 32 },
    solid: { x: 458, y: 270, width: 22, height: 32 },
    gasProbe: { x: 457, y: 286 },
  },
  liquidContact: {
    gas: { x: 424, y: 320, width: 34, height: 32 },
    liquid: { x: 458, y: 320, width: 22, height: 32 },
    gasProbe: { x: 457, y: 336 },
  },
  nativeWall: {
    gas: { x: 500, y: 270, width: 52, height: 36 },
    wallAnchor: { x: 526, y: 288 },
  },
  guardedBlank: { x: 498, y: 330, width: 92, height: 34 },
  conductiveWall: CONDUCTIVE_WALL,
};

interface GasLightFixtureBackend extends SimulationBackend {
  walls(): Uint8Array;
  paintWall(x: number, y: number, wall: number, radius: number): void;
}

/**
 * Direct-fills a paused 612x384 RenderLab scene. The E13 presenter must use
 * the existing atmosphere/emission refresh cadence; no physics step occurs
 * here, so each colour/geometry comparison has one deterministic source.
 */
export function prepareGasLightVfxFixture(simulation: SimulationBackend): void {
  if (!supportsGasLightFixture(simulation)) {
    throw new Error('Gas-light VFX fixture requires RenderLab wall plane');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Gas-light VFX fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();

  for (const entry of GAS_LIGHT_VFX_AUDIT.cards) {
    fillRect(cells, simulation.width, entry.body, entry.material);
    fillRect(cells, simulation.width, entry.emitter, entry.emitter.material);
    fillRect(cells, simulation.width, entry.authoredHole, Material.Empty);
    fillRect(cells, simulation.width, entry.openChannel, Material.Empty);
  }
  for (const entry of GAS_LIGHT_VFX_AUDIT.protectedGases) {
    fillRect(cells, simulation.width, entry.body, entry.material);
    fillRect(cells, simulation.width, entry.emitter, entry.emitter.material);
  }
  for (const entry of GAS_LIGHT_VFX_AUDIT.sparseChains) {
    for (const point of entry.carriers) set(cells, simulation.width, point, entry.material);
    set(cells, simulation.width, entry.isolated, entry.material);
  }
  fillRect(cells, simulation.width, GAS_LIGHT_VFX_AUDIT.solidContact.gas, Material.Smoke);
  fillRect(cells, simulation.width, GAS_LIGHT_VFX_AUDIT.solidContact.solid, Material.Metal);
  fillRect(cells, simulation.width, GAS_LIGHT_VFX_AUDIT.liquidContact.gas, Material.FOG);
  fillRect(cells, simulation.width, GAS_LIGHT_VFX_AUDIT.liquidContact.liquid, Material.Water);
  fillRect(cells, simulation.width, GAS_LIGHT_VFX_AUDIT.nativeWall.gas, Material.Smoke);
  simulation.paintWall(
    GAS_LIGHT_VFX_AUDIT.nativeWall.wallAnchor.x,
    GAS_LIGHT_VFX_AUDIT.nativeWall.wallAnchor.y,
    CONDUCTIVE_WALL, 0,
  );
  fillRect(cells, simulation.width, GAS_LIGHT_VFX_AUDIT.guardedBlank, Material.Empty);
}

function supportsGasLightFixture(simulation: SimulationBackend): simulation is GasLightFixtureBackend {
  const candidate = simulation as Partial<GasLightFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.paintWall === 'function';
}

function fillRect(cells: Uint8Array, width: number, rect: GasLightVfxRect, material: Material): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * width + rect.x, y * width + rect.x + rect.width);
  }
}

function set(cells: Uint8Array, width: number, point: GasLightVfxPoint, material: Material): void {
  cells[point.y * width + point.x] = material;
}
