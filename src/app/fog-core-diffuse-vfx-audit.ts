import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CONDUCTIVE_WALL = 1;

export interface FogCoreDiffuseVfxPoint { readonly x: number; readonly y: number }
export interface FogCoreDiffuseVfxRect extends FogCoreDiffuseVfxPoint {
  readonly width: number;
  readonly height: number;
}

export interface FogCoreDiffuseVfxProbe {
  readonly code: 'CROWN' | 'POCKET';
  readonly region: FogCoreDiffuseVfxRect;
  readonly centre: FogCoreDiffuseVfxPoint;
  /** Frozen mirror of E04's world-anchored three-wave billow at `centre`. */
  readonly billow: number;
}

export interface FogCoreDiffuseVfxAuditSnapshot {
  readonly version: 1;
  readonly world: { readonly width: 612; readonly height: 384 };
  readonly target: {
    readonly material: Material.FOG;
    readonly code: 'FOG';
    /** Exact propagated atmosphere identity style for native FOG. */
    readonly atmosphereStyle: 10;
    readonly body: FogCoreDiffuseVfxRect;
    readonly deepCore: FogCoreDiffuseVfxRect;
    readonly billowProbes: readonly [FogCoreDiffuseVfxProbe, FogCoreDiffuseVfxProbe];
    readonly authoredVoid: FogCoreDiffuseVfxRect;
    readonly openChannel: FogCoreDiffuseVfxRect;
  };
  readonly protectedGases: readonly {
    readonly material: Material.Smoke | Material.Steam | Material.Oxygen | Material.Hydrogen
      | Material.CarbonDioxide | Material.NobleGas | Material.CFLM;
    readonly code: 'SMKE' | 'WTRV' | 'O2' | 'H2' | 'CO2' | 'NBLE' | 'CFLM';
    readonly atmosphereStyle: 1 | 2 | 4 | 5 | 6 | 7 | 12;
    readonly body: FogCoreDiffuseVfxRect;
    readonly probe: FogCoreDiffuseVfxPoint;
  }[];
  readonly sparse: {
    readonly material: Material.FOG;
    readonly carriers: readonly [FogCoreDiffuseVfxPoint, FogCoreDiffuseVfxPoint];
    readonly midpoint: FogCoreDiffuseVfxPoint;
    readonly gap: FogCoreDiffuseVfxPoint;
    readonly isolated: FogCoreDiffuseVfxPoint;
  };
  readonly gasSeam: {
    readonly gas: FogCoreDiffuseVfxRect;
    readonly foreignGas: FogCoreDiffuseVfxRect;
    readonly foreignMaterial: Material.CarbonDioxide;
    readonly gasProbe: FogCoreDiffuseVfxPoint;
    readonly foreignProbe: FogCoreDiffuseVfxPoint;
  };
  readonly waterContact: {
    readonly gas: FogCoreDiffuseVfxRect;
    readonly water: FogCoreDiffuseVfxRect;
    readonly gasProbe: FogCoreDiffuseVfxPoint;
    readonly waterProbe: FogCoreDiffuseVfxPoint;
  };
  readonly metalContact: {
    readonly gas: FogCoreDiffuseVfxRect;
    readonly metal: FogCoreDiffuseVfxRect;
    readonly gasProbe: FogCoreDiffuseVfxPoint;
    readonly metalProbe: FogCoreDiffuseVfxPoint;
  };
  readonly nativeWall: {
    readonly gas: FogCoreDiffuseVfxRect;
    readonly wallAnchor: FogCoreDiffuseVfxPoint;
  };
  readonly guardedBlank: FogCoreDiffuseVfxRect;
  readonly conductiveWall: number;
}

/** Mirrors E04's immutable macro carrier for deterministic E57 probe placement. */
export function fogCoreDiffuseVfxBillowAt(point: FogCoreDiffuseVfxPoint): number {
  const waveA = Math.sin(point.x * 0.055 + point.y * 0.031 + 0.80);
  const waveB = Math.sin(point.x * -0.029 + point.y * 0.081 + 2.15);
  const waveC = Math.sin(point.x * 0.097 + point.y * -0.043 + 4.05);
  return Math.max(-1, Math.min(1, waveA * 0.50 + waveB * 0.31 + waveC * 0.19));
}

const crownCentre = { x: 166, y: 132 } as const;
const pocketCentre = { x: 37, y: 50 } as const;

/**
 * Stable paused-world contract for E57. The dense exact-FOG superellipse pins
 * broad opposing E04 billow lobes; all cutouts, controls, and topology remain
 * explicitly owned by their existing material or field paths.
 */
export const FOG_CORE_DIFFUSE_VFX_AUDIT: FogCoreDiffuseVfxAuditSnapshot = {
  version: 1,
  world: { width: WORLD_WIDTH, height: WORLD_HEIGHT },
  target: {
    material: Material.FOG,
    code: 'FOG',
    atmosphereStyle: 10,
    body: { x: 20, y: 20, width: 280, height: 160 },
    deepCore: { x: 72, y: 82, width: 28, height: 24 },
    billowProbes: [
      { code: 'CROWN', region: { x: 158, y: 127, width: 16, height: 10 }, centre: crownCentre,
        billow: fogCoreDiffuseVfxBillowAt(crownCentre) },
      { code: 'POCKET', region: { x: 29, y: 45, width: 16, height: 10 }, centre: pocketCentre,
        billow: fogCoreDiffuseVfxBillowAt(pocketCentre) },
    ],
    authoredVoid: { x: 154, y: 88, width: 20, height: 18 },
    openChannel: { x: 250, y: 20, width: 24, height: 50 },
  },
  protectedGases: [
    { material: Material.Smoke, code: 'SMKE', atmosphereStyle: 1,
      body: { x: 20, y: 208, width: 64, height: 44 }, probe: { x: 52, y: 230 } },
    { material: Material.Steam, code: 'WTRV', atmosphereStyle: 2,
      body: { x: 92, y: 208, width: 64, height: 44 }, probe: { x: 124, y: 230 } },
    { material: Material.Oxygen, code: 'O2', atmosphereStyle: 4,
      body: { x: 164, y: 208, width: 64, height: 44 }, probe: { x: 196, y: 230 } },
    { material: Material.Hydrogen, code: 'H2', atmosphereStyle: 5,
      body: { x: 236, y: 208, width: 64, height: 44 }, probe: { x: 268, y: 230 } },
    { material: Material.CarbonDioxide, code: 'CO2', atmosphereStyle: 6,
      body: { x: 308, y: 208, width: 64, height: 44 }, probe: { x: 340, y: 230 } },
    { material: Material.NobleGas, code: 'NBLE', atmosphereStyle: 7,
      body: { x: 380, y: 208, width: 64, height: 44 }, probe: { x: 412, y: 230 } },
    { material: Material.CFLM, code: 'CFLM', atmosphereStyle: 12,
      body: { x: 452, y: 208, width: 64, height: 44 }, probe: { x: 484, y: 230 } },
  ],
  sparse: {
    material: Material.FOG,
    carriers: [{ x: 20, y: 350 }, { x: 22, y: 350 }],
    midpoint: { x: 21, y: 350 }, gap: { x: 40, y: 350 }, isolated: { x: 58, y: 350 },
  },
  gasSeam: {
    gas: { x: 96, y: 270, width: 40, height: 32 },
    foreignGas: { x: 136, y: 270, width: 24, height: 32 },
    foreignMaterial: Material.CarbonDioxide,
    gasProbe: { x: 135, y: 286 }, foreignProbe: { x: 136, y: 286 },
  },
  waterContact: {
    gas: { x: 184, y: 270, width: 34, height: 32 }, water: { x: 218, y: 270, width: 22, height: 32 },
    gasProbe: { x: 217, y: 286 }, waterProbe: { x: 218, y: 286 },
  },
  metalContact: {
    gas: { x: 264, y: 270, width: 34, height: 32 }, metal: { x: 298, y: 270, width: 22, height: 32 },
    gasProbe: { x: 297, y: 286 }, metalProbe: { x: 298, y: 286 },
  },
  nativeWall: { gas: { x: 344, y: 270, width: 52, height: 36 }, wallAnchor: { x: 370, y: 288 } },
  guardedBlank: { x: 430, y: 270, width: 150, height: 36 },
  conductiveWall: CONDUCTIVE_WALL,
};

interface FogCoreDiffuseVfxFixtureBackend extends SimulationBackend {
  walls(): Uint8Array;
  paintWall(x: number, y: number, wall: number, radius: number): void;
}

/** Direct-fills the deterministic E57 scene without advancing native physics. */
export function prepareFogCoreDiffuseVfxFixture(simulation: SimulationBackend): void {
  if (!supportsFogCoreDiffuseVfxFixture(simulation)) {
    throw new Error('Fog-core-diffuse VFX fixture requires RenderLab wall plane');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Fog-core-diffuse VFX fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  const fixture = FOG_CORE_DIFFUSE_VFX_AUDIT;
  fillSuperellipse(cells, simulation.width, fixture.target.body, fixture.target.material);
  fillRect(cells, simulation.width, fixture.target.authoredVoid, Material.Empty);
  fillRect(cells, simulation.width, fixture.target.openChannel, Material.Empty);
  for (const control of fixture.protectedGases) fillRect(cells, simulation.width, control.body, control.material);
  for (const carrier of fixture.sparse.carriers) setPoint(cells, simulation.width, carrier, fixture.sparse.material);
  setPoint(cells, simulation.width, fixture.sparse.isolated, fixture.sparse.material);
  fillRect(cells, simulation.width, fixture.gasSeam.gas, Material.FOG);
  fillRect(cells, simulation.width, fixture.gasSeam.foreignGas, Material.CarbonDioxide);
  fillRect(cells, simulation.width, fixture.waterContact.gas, Material.FOG);
  fillRect(cells, simulation.width, fixture.waterContact.water, Material.Water);
  fillRect(cells, simulation.width, fixture.metalContact.gas, Material.FOG);
  fillRect(cells, simulation.width, fixture.metalContact.metal, Material.Metal);
  fillRect(cells, simulation.width, fixture.nativeWall.gas, Material.FOG);
  simulation.paintWall(fixture.nativeWall.wallAnchor.x, fixture.nativeWall.wallAnchor.y, fixture.conductiveWall, 0);
  fillRect(cells, simulation.width, fixture.guardedBlank, Material.Empty);
}

function supportsFogCoreDiffuseVfxFixture(
  simulation: SimulationBackend,
): simulation is FogCoreDiffuseVfxFixtureBackend {
  const candidate = simulation as Partial<FogCoreDiffuseVfxFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.paintWall === 'function';
}

function fillRect(cells: Uint8Array, worldWidth: number, rect: FogCoreDiffuseVfxRect, material: Material): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * worldWidth + rect.x, y * worldWidth + rect.x + rect.width);
  }
}

function fillSuperellipse(
  cells: Uint8Array, worldWidth: number, rect: FogCoreDiffuseVfxRect, material: Material,
): void {
  const radiusX = rect.width * 0.5;
  const radiusY = rect.height * 0.5;
  const centreX = rect.x + radiusX;
  const centreY = rect.y + radiusY;
  for (let y = rect.y; y < rect.y + rect.height; y++) for (let x = rect.x; x < rect.x + rect.width; x++) {
    const normalizedX = Math.abs((x + 0.5 - centreX) / radiusX);
    const normalizedY = Math.abs((y + 0.5 - centreY) / radiusY);
    if (normalizedX ** 4 + normalizedY ** 4 <= 1) cells[y * worldWidth + x] = material;
  }
}

function setPoint(cells: Uint8Array, worldWidth: number, point: FogCoreDiffuseVfxPoint, material: Material): void {
  cells[point.y * worldWidth + point.x] = material;
}
