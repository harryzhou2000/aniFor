import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CONDUCTIVE_WALL = 1;

export interface SmokeSoftnessVfxPoint { readonly x: number; readonly y: number }
export interface SmokeSoftnessVfxRect extends SmokeSoftnessVfxPoint {
  readonly width: number;
  readonly height: number;
}

export interface SmokeSoftnessVfxBillowProbe {
  readonly code: 'CROWN' | 'POCKET';
  readonly region: SmokeSoftnessVfxRect;
  readonly centre: SmokeSoftnessVfxPoint;
  /** Frozen mirror of E04's world-anchored macro billow at `centre`. */
  readonly billow: number;
}

/**
 * A compact, isolated density ladder for E27. Both probes are exact Smoke
 * owners, but the 2x2 seed and the one-cell seed intentionally pack to
 * different atmosphere-density bytes. The later browser gate freezes the
 * resulting alpha bands; this fixture only establishes deterministic sources.
 */
export interface SmokeSoftnessVfxDensityProfile {
  readonly material: Material.Smoke;
  readonly mid: SmokeSoftnessVfxRect;
  readonly midProbe: SmokeSoftnessVfxPoint;
  readonly rim: SmokeSoftnessVfxPoint;
  readonly rimProbe: SmokeSoftnessVfxPoint;
}

export interface SmokeSoftnessVfxAuditSnapshot {
  readonly version: 1;
  readonly world: { readonly width: 612; readonly height: 384 };
  readonly target: {
    readonly material: Material.Smoke;
    readonly code: 'SMKE';
    readonly body: SmokeSoftnessVfxRect;
    readonly deepCore: SmokeSoftnessVfxRect;
    readonly billowProbes: readonly [SmokeSoftnessVfxBillowProbe, SmokeSoftnessVfxBillowProbe];
    readonly authoredVoid: SmokeSoftnessVfxRect;
    readonly openChannel: SmokeSoftnessVfxRect;
  };
  readonly densityProfile: SmokeSoftnessVfxDensityProfile;
  readonly protectedGases: readonly {
    readonly material: Material.Oxygen | Material.Hydrogen | Material.FOG
      | Material.CFLM | Material.NobleGas;
    readonly code: 'O2' | 'H2' | 'FOG' | 'CFLM' | 'NOBL';
    readonly body: SmokeSoftnessVfxRect;
    readonly probe: SmokeSoftnessVfxPoint;
  }[];
  readonly sparse: {
    readonly material: Material.Smoke;
    readonly carriers: readonly [SmokeSoftnessVfxPoint, SmokeSoftnessVfxPoint];
    readonly midpoint: SmokeSoftnessVfxPoint;
    readonly gap: SmokeSoftnessVfxPoint;
    readonly isolated: SmokeSoftnessVfxPoint;
  };
  readonly gasSeam: {
    readonly gas: SmokeSoftnessVfxRect;
    readonly foreignGas: SmokeSoftnessVfxRect;
    readonly foreignMaterial: Material.FOG;
    readonly gasProbe: SmokeSoftnessVfxPoint;
    readonly foreignProbe: SmokeSoftnessVfxPoint;
  };
  readonly waterContact: {
    readonly gas: SmokeSoftnessVfxRect;
    readonly water: SmokeSoftnessVfxRect;
    readonly gasProbe: SmokeSoftnessVfxPoint;
    readonly waterProbe: SmokeSoftnessVfxPoint;
  };
  readonly metalContact: {
    readonly gas: SmokeSoftnessVfxRect;
    readonly metal: SmokeSoftnessVfxRect;
    readonly gasProbe: SmokeSoftnessVfxPoint;
    readonly metalProbe: SmokeSoftnessVfxPoint;
  };
  readonly nativeWall: {
    readonly gas: SmokeSoftnessVfxRect;
    readonly wallAnchor: SmokeSoftnessVfxPoint;
  };
  readonly guardedBlank: SmokeSoftnessVfxRect;
  readonly conductiveWall: number;
}

/** Mirrors E04's immutable three-wave body basis for deterministic probe placement. */
export function smokeSoftnessVfxBillowAt(point: SmokeSoftnessVfxPoint): number {
  const waveA = Math.sin(point.x * 0.055 + point.y * 0.031 + 0.80);
  const waveB = Math.sin(point.x * -0.029 + point.y * 0.081 + 2.15);
  const waveC = Math.sin(point.x * 0.097 + point.y * -0.043 + 4.05);
  return Math.max(-1, Math.min(1, waveA * 0.50 + waveB * 0.31 + waveC * 0.19));
}

const crownCentre = { x: 166, y: 132 } as const;
const pocketCentre = { x: 37, y: 50 } as const;

/**
 * Paused exact-Smoke E27 scaffold. It preserves the E25 control topology,
 * replacing only the target owner and adding a disjoint sparse-density ladder.
 */
export const SMOKE_SOFTNESS_VFX_AUDIT: SmokeSoftnessVfxAuditSnapshot = {
  version: 1,
  world: { width: WORLD_WIDTH, height: WORLD_HEIGHT },
  target: {
    material: Material.Smoke,
    code: 'SMKE',
    body: { x: 20, y: 20, width: 280, height: 160 },
    deepCore: { x: 72, y: 82, width: 28, height: 24 },
    billowProbes: [
      {
        code: 'CROWN', region: { x: 158, y: 127, width: 16, height: 10 },
        centre: crownCentre, billow: smokeSoftnessVfxBillowAt(crownCentre),
      },
      {
        code: 'POCKET', region: { x: 29, y: 45, width: 16, height: 10 },
        centre: pocketCentre, billow: smokeSoftnessVfxBillowAt(pocketCentre),
      },
    ],
    authoredVoid: { x: 154, y: 88, width: 20, height: 18 },
    openChannel: { x: 250, y: 20, width: 24, height: 50 },
  },
  densityProfile: {
    material: Material.Smoke,
    // A complete 2x2 atmosphere seed is intentionally neither the saturated
    // broad body nor a one-particle carrier.
    mid: { x: 96, y: 330, width: 2, height: 2 },
    midProbe: { x: 96, y: 330 },
    // A single exact owner in its own 2x2 field texel forms the lower-density rim.
    rim: { x: 112, y: 330 },
    rimProbe: { x: 112, y: 330 },
  },
  protectedGases: [
    { material: Material.Oxygen, code: 'O2', body: { x: 20, y: 208, width: 90, height: 44 }, probe: { x: 64, y: 230 } },
    { material: Material.Hydrogen, code: 'H2', body: { x: 126, y: 208, width: 90, height: 44 }, probe: { x: 170, y: 230 } },
    { material: Material.FOG, code: 'FOG', body: { x: 232, y: 208, width: 90, height: 44 }, probe: { x: 276, y: 230 } },
    { material: Material.CFLM, code: 'CFLM', body: { x: 338, y: 208, width: 90, height: 44 }, probe: { x: 382, y: 230 } },
    { material: Material.NobleGas, code: 'NOBL', body: { x: 444, y: 208, width: 90, height: 44 }, probe: { x: 488, y: 230 } },
  ],
  sparse: {
    material: Material.Smoke,
    carriers: [{ x: 20, y: 350 }, { x: 22, y: 350 }],
    midpoint: { x: 21, y: 350 }, gap: { x: 40, y: 350 }, isolated: { x: 58, y: 350 },
  },
  gasSeam: {
    gas: { x: 96, y: 270, width: 40, height: 32 },
    foreignGas: { x: 136, y: 270, width: 24, height: 32 }, foreignMaterial: Material.FOG,
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
  nativeWall: {
    gas: { x: 344, y: 270, width: 52, height: 36 }, wallAnchor: { x: 370, y: 288 },
  },
  guardedBlank: { x: 430, y: 270, width: 150, height: 36 },
  conductiveWall: CONDUCTIVE_WALL,
};

interface SmokeSoftnessVfxFixtureBackend extends SimulationBackend {
  walls(): Uint8Array;
  paintWall(x: number, y: number, wall: number, radius: number): void;
}

/** Direct-fills the deterministic E27 scene without advancing native physics. */
export function prepareSmokeSoftnessVfxFixture(simulation: SimulationBackend): void {
  if (!supportsSmokeSoftnessVfxFixture(simulation)) {
    throw new Error('Smoke-softness VFX fixture requires RenderLab wall plane');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Smoke-softness VFX fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }

  simulation.clear();
  const cells = simulation.cells();
  const fixture = SMOKE_SOFTNESS_VFX_AUDIT;
  fillRoundedBody(cells, simulation.width, fixture.target.body, fixture.target.material);
  fillRect(cells, simulation.width, fixture.target.authoredVoid, Material.Empty);
  fillRect(cells, simulation.width, fixture.target.openChannel, Material.Empty);
  fillRect(cells, simulation.width, fixture.densityProfile.mid, fixture.densityProfile.material);
  setPoint(cells, simulation.width, fixture.densityProfile.rim, fixture.densityProfile.material);
  for (const control of fixture.protectedGases) fillRect(cells, simulation.width, control.body, control.material);
  for (const carrier of fixture.sparse.carriers) setPoint(cells, simulation.width, carrier, fixture.sparse.material);
  setPoint(cells, simulation.width, fixture.sparse.isolated, fixture.sparse.material);
  fillRect(cells, simulation.width, fixture.gasSeam.gas, fixture.target.material);
  fillRect(cells, simulation.width, fixture.gasSeam.foreignGas, fixture.gasSeam.foreignMaterial);
  fillRect(cells, simulation.width, fixture.waterContact.gas, fixture.target.material);
  fillRect(cells, simulation.width, fixture.waterContact.water, Material.Water);
  fillRect(cells, simulation.width, fixture.metalContact.gas, fixture.target.material);
  fillRect(cells, simulation.width, fixture.metalContact.metal, Material.Metal);
  fillRect(cells, simulation.width, fixture.nativeWall.gas, fixture.target.material);
  simulation.paintWall(fixture.nativeWall.wallAnchor.x, fixture.nativeWall.wallAnchor.y, fixture.conductiveWall, 0);
  fillRect(cells, simulation.width, fixture.guardedBlank, Material.Empty);
}

function supportsSmokeSoftnessVfxFixture(
  simulation: SimulationBackend,
): simulation is SmokeSoftnessVfxFixtureBackend {
  const candidate = simulation as Partial<SmokeSoftnessVfxFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.paintWall === 'function';
}

function fillRect(
  cells: Uint8Array, worldWidth: number, rect: SmokeSoftnessVfxRect, material: Material,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * worldWidth + rect.x, y * worldWidth + rect.x + rect.width);
  }
}

function fillRoundedBody(
  cells: Uint8Array, worldWidth: number, rect: SmokeSoftnessVfxRect, material: Material,
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

function setPoint(
  cells: Uint8Array, worldWidth: number, point: SmokeSoftnessVfxPoint, material: Material,
): void {
  cells[point.y * worldWidth + point.x] = material;
}
