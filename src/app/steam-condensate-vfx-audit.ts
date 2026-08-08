import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CONDUCTIVE_WALL = 1;

export interface SteamCondensateVfxPoint { readonly x: number; readonly y: number }
export interface SteamCondensateVfxRect extends SteamCondensateVfxPoint {
  readonly width: number;
  readonly height: number;
}

export interface SteamCondensateVfxAuditSnapshot {
  readonly version: 1;
  readonly world: { readonly width: 612; readonly height: 384 };
  readonly target: {
    readonly material: Material.Steam;
    readonly code: 'WTRV';
    /** Exact propagated atmosphere identity style for native Steam. */
    readonly atmosphereStyle: 2;
    readonly body: SteamCondensateVfxRect;
    readonly broad: SteamCondensateVfxRect;
    readonly core: SteamCondensateVfxRect;
    readonly crown: SteamCondensateVfxRect;
    readonly pocket: SteamCondensateVfxRect;
    readonly shoulders: readonly [SteamCondensateVfxRect, SteamCondensateVfxRect];
    readonly authoredVoid: SteamCondensateVfxRect;
    readonly openChannel: SteamCondensateVfxRect;
  };
  /** Every native atmosphere identity which must not be promoted as Steam. */
  readonly protectedGases: readonly {
    readonly material: Material.Smoke | Material.Gas | Material.Oxygen | Material.Hydrogen
      | Material.CarbonDioxide | Material.NobleGas | Material.BOYL | Material.CAUS
      | Material.FOG | Material.RFRG | Material.CFLM | Material.AMTR | Material.WARP
      | Material.BIZRG | Material.MORT | Material.VRSG;
    readonly code: 'SMKE' | 'GAS' | 'O2' | 'H2' | 'CO2' | 'NBLE' | 'BOYL' | 'CAUS'
      | 'FOG' | 'RFRG' | 'CFLM' | 'AMTR' | 'WARP' | 'BIZG' | 'MORT' | 'VRSG';
    readonly atmosphereStyle: 1 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17;
    readonly body: SteamCondensateVfxRect;
    readonly probe: SteamCondensateVfxPoint;
  }[];
  readonly sparseWisps: {
    readonly material: Material.Steam;
    readonly carriers: readonly [SteamCondensateVfxPoint, SteamCondensateVfxPoint];
    readonly midpoint: SteamCondensateVfxPoint;
    readonly gap: SteamCondensateVfxPoint;
    readonly thin: SteamCondensateVfxRect;
    readonly isolated: SteamCondensateVfxPoint;
  };
  readonly gasSeam: {
    readonly steam: SteamCondensateVfxRect;
    readonly foreignGas: SteamCondensateVfxRect;
    readonly foreignMaterial: Material.FOG;
    readonly steamProbe: SteamCondensateVfxPoint;
    readonly foreignProbe: SteamCondensateVfxPoint;
  };
  readonly waterContact: {
    readonly steam: SteamCondensateVfxRect;
    readonly water: SteamCondensateVfxRect;
    readonly steamProbe: SteamCondensateVfxPoint;
    readonly waterProbe: SteamCondensateVfxPoint;
  };
  readonly metalContact: {
    readonly steam: SteamCondensateVfxRect;
    readonly metal: SteamCondensateVfxRect;
    readonly steamProbe: SteamCondensateVfxPoint;
    readonly metalProbe: SteamCondensateVfxPoint;
  };
  readonly nativeWall: {
    readonly steam: SteamCondensateVfxRect;
    readonly wallAnchor: SteamCondensateVfxPoint;
  };
  readonly guardedBlank: SteamCondensateVfxRect;
  readonly materialCounts: Readonly<Record<
    'steam' | 'smoke' | 'gas' | 'oxygen' | 'hydrogen' | 'carbonDioxide' | 'nobleGas'
      | 'boyl' | 'caus' | 'fog' | 'rfrg' | 'cflm' | 'amtr' | 'warp' | 'bizrg'
      | 'mort' | 'vrsg' | 'water' | 'metal', number
  >>;
  readonly conductiveWall: number;
}

/**
 * Stable paused-world contract for a dense exact-Steam condensate volume.
 * This fixture deliberately has no clock or motion input: it freezes the
 * native style-2 atmosphere ownership, body topology, and contact controls.
 */
export const STEAM_CONDENSATE_VFX_AUDIT: SteamCondensateVfxAuditSnapshot = {
  version: 1,
  world: { width: WORLD_WIDTH, height: WORLD_HEIGHT },
  target: {
    material: Material.Steam,
    code: 'WTRV',
    atmosphereStyle: 2,
    body: { x: 20, y: 20, width: 280, height: 160 },
    broad: { x: 44, y: 116, width: 100, height: 40 },
    core: { x: 72, y: 82, width: 28, height: 24 },
    // These two probes mirror E04's strongest deterministic positive/negative
    // macro lobes. Their polarity is part of the browser acceptance contract.
    crown: { x: 158, y: 127, width: 16, height: 10 },
    pocket: { x: 29, y: 45, width: 16, height: 10 },
    shoulders: [{ x: 44, y: 92, width: 18, height: 24 }, { x: 238, y: 92, width: 18, height: 24 }],
    authoredVoid: { x: 154, y: 88, width: 20, height: 18 },
    openChannel: { x: 250, y: 20, width: 24, height: 50 },
  },
  protectedGases: [
    { material: Material.Smoke, code: 'SMKE', atmosphereStyle: 1,
      body: { x: 20, y: 208, width: 60, height: 20 }, probe: { x: 50, y: 218 } },
    { material: Material.Gas, code: 'GAS', atmosphereStyle: 3,
      body: { x: 92, y: 208, width: 60, height: 20 }, probe: { x: 122, y: 218 } },
    { material: Material.Oxygen, code: 'O2', atmosphereStyle: 4,
      body: { x: 164, y: 208, width: 60, height: 20 }, probe: { x: 194, y: 218 } },
    { material: Material.Hydrogen, code: 'H2', atmosphereStyle: 5,
      body: { x: 236, y: 208, width: 60, height: 20 }, probe: { x: 266, y: 218 } },
    { material: Material.CarbonDioxide, code: 'CO2', atmosphereStyle: 6,
      body: { x: 308, y: 208, width: 60, height: 20 }, probe: { x: 338, y: 218 } },
    { material: Material.NobleGas, code: 'NBLE', atmosphereStyle: 7,
      body: { x: 380, y: 208, width: 60, height: 20 }, probe: { x: 410, y: 218 } },
    { material: Material.FOG, code: 'FOG', atmosphereStyle: 10,
      body: { x: 452, y: 208, width: 60, height: 20 }, probe: { x: 482, y: 218 } },
    { material: Material.CFLM, code: 'CFLM', atmosphereStyle: 12,
      body: { x: 524, y: 208, width: 60, height: 20 }, probe: { x: 554, y: 218 } },
    { material: Material.BOYL, code: 'BOYL', atmosphereStyle: 8,
      body: { x: 20, y: 232, width: 60, height: 20 }, probe: { x: 50, y: 242 } },
    { material: Material.CAUS, code: 'CAUS', atmosphereStyle: 9,
      body: { x: 92, y: 232, width: 60, height: 20 }, probe: { x: 122, y: 242 } },
    { material: Material.RFRG, code: 'RFRG', atmosphereStyle: 11,
      body: { x: 164, y: 232, width: 60, height: 20 }, probe: { x: 194, y: 242 } },
    { material: Material.AMTR, code: 'AMTR', atmosphereStyle: 13,
      body: { x: 236, y: 232, width: 60, height: 20 }, probe: { x: 266, y: 242 } },
    { material: Material.WARP, code: 'WARP', atmosphereStyle: 14,
      body: { x: 308, y: 232, width: 60, height: 20 }, probe: { x: 338, y: 242 } },
    { material: Material.BIZRG, code: 'BIZG', atmosphereStyle: 15,
      body: { x: 380, y: 232, width: 60, height: 20 }, probe: { x: 410, y: 242 } },
    { material: Material.MORT, code: 'MORT', atmosphereStyle: 16,
      body: { x: 452, y: 232, width: 60, height: 20 }, probe: { x: 482, y: 242 } },
    { material: Material.VRSG, code: 'VRSG', atmosphereStyle: 17,
      body: { x: 524, y: 232, width: 60, height: 20 }, probe: { x: 554, y: 242 } },
  ],
  sparseWisps: {
    material: Material.Steam,
    carriers: [{ x: 20, y: 350 }, { x: 22, y: 350 }],
    midpoint: { x: 21, y: 350 }, gap: { x: 40, y: 350 },
    thin: { x: 78, y: 338, width: 1, height: 30 }, isolated: { x: 58, y: 350 },
  },
  gasSeam: {
    steam: { x: 96, y: 270, width: 40, height: 32 }, foreignGas: { x: 136, y: 270, width: 24, height: 32 },
    foreignMaterial: Material.FOG, steamProbe: { x: 135, y: 286 }, foreignProbe: { x: 136, y: 286 },
  },
  waterContact: {
    steam: { x: 184, y: 270, width: 34, height: 32 }, water: { x: 218, y: 270, width: 22, height: 32 },
    steamProbe: { x: 217, y: 286 }, waterProbe: { x: 218, y: 286 },
  },
  metalContact: {
    steam: { x: 264, y: 270, width: 34, height: 32 }, metal: { x: 298, y: 270, width: 22, height: 32 },
    steamProbe: { x: 297, y: 286 }, metalProbe: { x: 298, y: 286 },
  },
  nativeWall: { steam: { x: 344, y: 270, width: 52, height: 36 }, wallAnchor: { x: 370, y: 288 } },
  guardedBlank: { x: 430, y: 270, width: 150, height: 36 },
  materialCounts: {
    steam: 45520, smoke: 1200, gas: 1200, oxygen: 1200, hydrogen: 1200,
    carbonDioxide: 1200, nobleGas: 1200, boyl: 1200, caus: 1200, fog: 1968,
    rfrg: 1200, cflm: 1200, amtr: 1200, warp: 1200, bizrg: 1200,
    mort: 1200, vrsg: 1200, water: 704, metal: 704,
  },
  conductiveWall: CONDUCTIVE_WALL,
};

interface SteamCondensateFixtureBackend extends SimulationBackend {
  walls(): Uint8Array;
  paintWall(x: number, y: number, wall: number, radius: number): void;
}

/** Direct-fills the deterministic paused scene without advancing native physics. */
export function prepareSteamCondensateVfxFixture(simulation: SimulationBackend): void {
  if (!supportsSteamCondensateFixture(simulation)) {
    throw new Error('Steam-condensate VFX fixture requires RenderLab wall plane');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Steam-condensate VFX fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  const fixture = STEAM_CONDENSATE_VFX_AUDIT;
  fillRoundedBody(cells, simulation.width, fixture.target.body, Material.Steam);
  fillRect(cells, simulation.width, fixture.target.authoredVoid, Material.Empty);
  fillRect(cells, simulation.width, fixture.target.openChannel, Material.Empty);
  for (const control of fixture.protectedGases) fillRect(cells, simulation.width, control.body, control.material);
  for (const carrier of fixture.sparseWisps.carriers) setPoint(cells, simulation.width, carrier, Material.Steam);
  fillRect(cells, simulation.width, fixture.sparseWisps.thin, Material.Steam);
  setPoint(cells, simulation.width, fixture.sparseWisps.isolated, Material.Steam);
  fillRect(cells, simulation.width, fixture.gasSeam.steam, Material.Steam);
  fillRect(cells, simulation.width, fixture.gasSeam.foreignGas, fixture.gasSeam.foreignMaterial);
  fillRect(cells, simulation.width, fixture.waterContact.steam, Material.Steam);
  fillRect(cells, simulation.width, fixture.waterContact.water, Material.Water);
  fillRect(cells, simulation.width, fixture.metalContact.steam, Material.Steam);
  fillRect(cells, simulation.width, fixture.metalContact.metal, Material.Metal);
  fillRect(cells, simulation.width, fixture.nativeWall.steam, Material.Steam);
  simulation.paintWall(fixture.nativeWall.wallAnchor.x, fixture.nativeWall.wallAnchor.y, fixture.conductiveWall, 0);
  fillRect(cells, simulation.width, fixture.guardedBlank, Material.Empty);
}

function supportsSteamCondensateFixture(
  simulation: SimulationBackend,
): simulation is SteamCondensateFixtureBackend {
  const candidate = simulation as Partial<SteamCondensateFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.paintWall === 'function';
}

function fillRect(cells: Uint8Array, worldWidth: number, rect: SteamCondensateVfxRect, material: Material): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * worldWidth + rect.x, y * worldWidth + rect.x + rect.width);
  }
}

function fillRoundedBody(cells: Uint8Array, worldWidth: number, rect: SteamCondensateVfxRect, material: Material): void {
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

function setPoint(cells: Uint8Array, worldWidth: number, point: SteamCondensateVfxPoint, material: Material): void {
  cells[point.y * worldWidth + point.x] = material;
}
