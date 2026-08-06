import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CONDUCTIVE_WALL = 1;

export interface CarbonDioxideBodyVfxPoint { readonly x: number; readonly y: number }
export interface CarbonDioxideBodyVfxRect extends CarbonDioxideBodyVfxPoint {
  readonly width: number;
  readonly height: number;
}

export interface CarbonDioxideBodyVfxProbe {
  readonly code: 'CROWN' | 'POCKET';
  readonly region: CarbonDioxideBodyVfxRect;
  readonly centre: CarbonDioxideBodyVfxPoint;
  /** Frozen mirror of E04's world-anchored three-wave billow at `centre`. */
  readonly billow: number;
}

export interface CarbonDioxideBodyVfxAuditSnapshot {
  readonly version: 1;
  readonly world: { readonly width: 612; readonly height: 384 };
  readonly target: {
    readonly material: Material.CarbonDioxide;
    readonly code: 'CO2';
    /** Exact propagated atmosphere identity style for native Carbon Dioxide. */
    readonly atmosphereStyle: 6;
    readonly body: CarbonDioxideBodyVfxRect;
    readonly deepCore: CarbonDioxideBodyVfxRect;
    readonly billowProbes: readonly [CarbonDioxideBodyVfxProbe, CarbonDioxideBodyVfxProbe];
    readonly authoredVoid: CarbonDioxideBodyVfxRect;
    readonly openChannel: CarbonDioxideBodyVfxRect;
  };
  readonly protectedGases: readonly {
    readonly material: Material.Smoke | Material.Oxygen | Material.NobleGas | Material.FOG
      | Material.CFLM | Material.Steam | Material.Hydrogen;
    readonly code: 'SMKE' | 'O2' | 'NBLE' | 'FOG' | 'CFLM' | 'WTRV' | 'H2';
    readonly atmosphereStyle: 1 | 2 | 4 | 5 | 7 | 10 | 12;
    readonly body: CarbonDioxideBodyVfxRect;
    readonly probe: CarbonDioxideBodyVfxPoint;
  }[];
  readonly sparse: {
    readonly material: Material.CarbonDioxide;
    readonly carriers: readonly [CarbonDioxideBodyVfxPoint, CarbonDioxideBodyVfxPoint];
    readonly midpoint: CarbonDioxideBodyVfxPoint;
    readonly gap: CarbonDioxideBodyVfxPoint;
    readonly isolated: CarbonDioxideBodyVfxPoint;
  };
  readonly gasSeam: {
    readonly gas: CarbonDioxideBodyVfxRect;
    readonly foreignGas: CarbonDioxideBodyVfxRect;
    readonly foreignMaterial: Material.FOG;
    readonly gasProbe: CarbonDioxideBodyVfxPoint;
    readonly foreignProbe: CarbonDioxideBodyVfxPoint;
  };
  readonly waterContact: {
    readonly gas: CarbonDioxideBodyVfxRect;
    readonly water: CarbonDioxideBodyVfxRect;
    readonly gasProbe: CarbonDioxideBodyVfxPoint;
    readonly waterProbe: CarbonDioxideBodyVfxPoint;
  };
  readonly metalContact: {
    readonly gas: CarbonDioxideBodyVfxRect;
    readonly metal: CarbonDioxideBodyVfxRect;
    readonly gasProbe: CarbonDioxideBodyVfxPoint;
    readonly metalProbe: CarbonDioxideBodyVfxPoint;
  };
  readonly nativeWall: {
    readonly gas: CarbonDioxideBodyVfxRect;
    readonly wallAnchor: CarbonDioxideBodyVfxPoint;
  };
  readonly guardedBlank: CarbonDioxideBodyVfxRect;
  readonly conductiveWall: number;
}

/** Mirrors E04's immutable macro carrier for deterministic E44 probe placement. */
export function carbonDioxideBodyVfxBillowAt(point: CarbonDioxideBodyVfxPoint): number {
  const waveA = Math.sin(point.x * 0.055 + point.y * 0.031 + 0.80);
  const waveB = Math.sin(point.x * -0.029 + point.y * 0.081 + 2.15);
  const waveC = Math.sin(point.x * 0.097 + point.y * -0.043 + 4.05);
  return Math.max(-1, Math.min(1, waveA * 0.50 + waveB * 0.31 + waveC * 0.19));
}

const crownCentre = { x: 166, y: 132 } as const;
const pocketCentre = { x: 37, y: 50 } as const;

/**
 * Stable paused-world contract for E44. The dense exact-Carbon-Dioxide body
 * pins broad opposing E04 billow lobes while voids, sparse carriers, contacts,
 * walls, and every sibling atmosphere style retain explicit control ownership.
 */
export const CARBON_DIOXIDE_BODY_VFX_AUDIT: CarbonDioxideBodyVfxAuditSnapshot = {
  version: 1,
  world: { width: WORLD_WIDTH, height: WORLD_HEIGHT },
  target: {
    material: Material.CarbonDioxide,
    code: 'CO2',
    atmosphereStyle: 6,
    body: { x: 20, y: 20, width: 280, height: 160 },
    deepCore: { x: 72, y: 82, width: 28, height: 24 },
    billowProbes: [
      {
        code: 'CROWN', region: { x: 158, y: 127, width: 16, height: 10 },
        centre: crownCentre, billow: carbonDioxideBodyVfxBillowAt(crownCentre),
      },
      {
        code: 'POCKET', region: { x: 29, y: 45, width: 16, height: 10 },
        centre: pocketCentre, billow: carbonDioxideBodyVfxBillowAt(pocketCentre),
      },
    ],
    authoredVoid: { x: 154, y: 88, width: 20, height: 18 },
    openChannel: { x: 250, y: 20, width: 24, height: 50 },
  },
  protectedGases: [
    { material: Material.Smoke, code: 'SMKE', atmosphereStyle: 1,
      body: { x: 20, y: 208, width: 74, height: 44 }, probe: { x: 57, y: 230 } },
    { material: Material.Oxygen, code: 'O2', atmosphereStyle: 4,
      body: { x: 102, y: 208, width: 74, height: 44 }, probe: { x: 139, y: 230 } },
    { material: Material.NobleGas, code: 'NBLE', atmosphereStyle: 7,
      body: { x: 184, y: 208, width: 74, height: 44 }, probe: { x: 221, y: 230 } },
    { material: Material.FOG, code: 'FOG', atmosphereStyle: 10,
      body: { x: 266, y: 208, width: 74, height: 44 }, probe: { x: 303, y: 230 } },
    { material: Material.CFLM, code: 'CFLM', atmosphereStyle: 12,
      body: { x: 348, y: 208, width: 74, height: 44 }, probe: { x: 385, y: 230 } },
    { material: Material.Steam, code: 'WTRV', atmosphereStyle: 2,
      body: { x: 430, y: 208, width: 74, height: 44 }, probe: { x: 467, y: 230 } },
    { material: Material.Hydrogen, code: 'H2', atmosphereStyle: 5,
      body: { x: 512, y: 208, width: 74, height: 44 }, probe: { x: 549, y: 230 } },
  ],
  sparse: {
    material: Material.CarbonDioxide,
    carriers: [{ x: 20, y: 350 }, { x: 22, y: 350 }],
    midpoint: { x: 21, y: 350 }, gap: { x: 40, y: 350 }, isolated: { x: 58, y: 350 },
  },
  gasSeam: {
    gas: { x: 96, y: 270, width: 40, height: 32 },
    foreignGas: { x: 136, y: 270, width: 24, height: 32 },
    foreignMaterial: Material.FOG,
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

interface CarbonDioxideBodyVfxFixtureBackend extends SimulationBackend {
  walls(): Uint8Array;
  paintWall(x: number, y: number, wall: number, radius: number): void;
}

/** Direct-fills the deterministic E44 scene without advancing native physics. */
export function prepareCarbonDioxideBodyVfxFixture(simulation: SimulationBackend): void {
  if (!supportsCarbonDioxideBodyVfxFixture(simulation)) {
    throw new Error('Carbon-Dioxide-body VFX fixture requires RenderLab wall plane');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Carbon-Dioxide-body VFX fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  const fixture = CARBON_DIOXIDE_BODY_VFX_AUDIT;
  fillRoundedBody(cells, simulation.width, fixture.target.body, fixture.target.material);
  fillRect(cells, simulation.width, fixture.target.authoredVoid, Material.Empty);
  fillRect(cells, simulation.width, fixture.target.openChannel, Material.Empty);
  for (const control of fixture.protectedGases) fillRect(cells, simulation.width, control.body, control.material);
  for (const carrier of fixture.sparse.carriers) setPoint(cells, simulation.width, carrier, fixture.sparse.material);
  setPoint(cells, simulation.width, fixture.sparse.isolated, fixture.sparse.material);
  fillRect(cells, simulation.width, fixture.gasSeam.gas, Material.CarbonDioxide);
  fillRect(cells, simulation.width, fixture.gasSeam.foreignGas, Material.FOG);
  fillRect(cells, simulation.width, fixture.waterContact.gas, Material.CarbonDioxide);
  fillRect(cells, simulation.width, fixture.waterContact.water, Material.Water);
  fillRect(cells, simulation.width, fixture.metalContact.gas, Material.CarbonDioxide);
  fillRect(cells, simulation.width, fixture.metalContact.metal, Material.Metal);
  fillRect(cells, simulation.width, fixture.nativeWall.gas, Material.CarbonDioxide);
  simulation.paintWall(fixture.nativeWall.wallAnchor.x, fixture.nativeWall.wallAnchor.y, fixture.conductiveWall, 0);
  fillRect(cells, simulation.width, fixture.guardedBlank, Material.Empty);
}

function supportsCarbonDioxideBodyVfxFixture(
  simulation: SimulationBackend,
): simulation is CarbonDioxideBodyVfxFixtureBackend {
  const candidate = simulation as Partial<CarbonDioxideBodyVfxFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.paintWall === 'function';
}

function fillRect(
  cells: Uint8Array,
  worldWidth: number,
  rect: CarbonDioxideBodyVfxRect,
  material: Material,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * worldWidth + rect.x, y * worldWidth + rect.x + rect.width);
  }
}

function fillRoundedBody(
  cells: Uint8Array,
  worldWidth: number,
  rect: CarbonDioxideBodyVfxRect,
  material: Material,
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

function setPoint(
  cells: Uint8Array,
  worldWidth: number,
  point: CarbonDioxideBodyVfxPoint,
  material: Material,
): void {
  cells[point.y * worldWidth + point.x] = material;
}
