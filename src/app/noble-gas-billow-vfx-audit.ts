import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CONDUCTIVE_WALL = 1;

export interface NobleGasBillowVfxPoint { readonly x: number; readonly y: number }
export interface NobleGasBillowVfxRect extends NobleGasBillowVfxPoint {
  readonly width: number;
  readonly height: number;
}

export interface NobleGasBillowVfxTargetProbe {
  readonly code: 'CROWN' | 'POCKET';
  readonly region: NobleGasBillowVfxRect;
  readonly centre: NobleGasBillowVfxPoint;
  /** Frozen mirror of E04's world-anchored macro billow at `centre`. */
  readonly billow: number;
}

export interface NobleGasBillowVfxAuditSnapshot {
  readonly version: 1;
  readonly world: { readonly width: 612; readonly height: 384 };
  readonly target: {
    readonly material: Material.NobleGas;
    readonly code: 'NOBL';
    readonly body: NobleGasBillowVfxRect;
    readonly deepCore: NobleGasBillowVfxRect;
    readonly billowProbes: readonly [
      NobleGasBillowVfxTargetProbe,
      NobleGasBillowVfxTargetProbe,
    ];
    readonly authoredVoid: NobleGasBillowVfxRect;
    readonly openChannel: NobleGasBillowVfxRect;
  };
  readonly protectedGases: readonly {
    readonly material: Material.Smoke | Material.Oxygen | Material.Hydrogen
      | Material.FOG | Material.CFLM;
    readonly code: 'SMKE' | 'O2' | 'H2' | 'FOG' | 'CFLM';
    readonly body: NobleGasBillowVfxRect;
    readonly probe: NobleGasBillowVfxPoint;
  }[];
  readonly sparse: {
    readonly material: Material.NobleGas;
    readonly carriers: readonly [NobleGasBillowVfxPoint, NobleGasBillowVfxPoint];
    readonly midpoint: NobleGasBillowVfxPoint;
    readonly gap: NobleGasBillowVfxPoint;
    readonly isolated: NobleGasBillowVfxPoint;
  };
  readonly gasSeam: {
    readonly gas: NobleGasBillowVfxRect;
    readonly foreignGas: NobleGasBillowVfxRect;
    readonly foreignMaterial: Material.FOG;
    readonly gasProbe: NobleGasBillowVfxPoint;
    readonly foreignProbe: NobleGasBillowVfxPoint;
  };
  readonly waterContact: {
    readonly gas: NobleGasBillowVfxRect;
    readonly water: NobleGasBillowVfxRect;
    readonly gasProbe: NobleGasBillowVfxPoint;
    readonly waterProbe: NobleGasBillowVfxPoint;
  };
  readonly metalContact: {
    readonly gas: NobleGasBillowVfxRect;
    readonly metal: NobleGasBillowVfxRect;
    readonly gasProbe: NobleGasBillowVfxPoint;
    readonly metalProbe: NobleGasBillowVfxPoint;
  };
  readonly nativeWall: {
    readonly gas: NobleGasBillowVfxRect;
    readonly wallAnchor: NobleGasBillowVfxPoint;
  };
  readonly guardedBlank: NobleGasBillowVfxRect;
  readonly conductiveWall: number;
}

/** Mirrors E04's immutable three-wave body basis for deterministic probe placement. */
export function nobleGasBillowVfxBillowAt(point: NobleGasBillowVfxPoint): number {
  const waveA = Math.sin(point.x * 0.055 + point.y * 0.031 + 0.80);
  const waveB = Math.sin(point.x * -0.029 + point.y * 0.081 + 2.15);
  const waveC = Math.sin(point.x * 0.097 + point.y * -0.043 + 4.05);
  return Math.max(-1, Math.min(1, waveA * 0.50 + waveB * 0.31 + waveC * 0.19));
}

const crownCentre = { x: 166, y: 132 } as const;
const pocketCentre = { x: 37, y: 50 } as const;

/**
 * Stable paused-world contract for E25. Two broad regions inside the exact
 * NBLE body pin opposite E04 billow polarities at composed-frame scale. The
 * same body owns production topology, void, and channel controls. The deep
 * core is a bounded-response calibration target; every sibling/contact/
 * topology region remains an explicit no-op control.
 */
export const NOBLE_GAS_BILLOW_VFX_AUDIT: NobleGasBillowVfxAuditSnapshot = {
  version: 1,
  world: { width: WORLD_WIDTH, height: WORLD_HEIGHT },
  target: {
    material: Material.NobleGas,
    code: 'NOBL',
    body: { x: 20, y: 20, width: 280, height: 160 },
    deepCore: { x: 72, y: 82, width: 28, height: 24 },
    billowProbes: [
      {
        code: 'CROWN', region: { x: 158, y: 127, width: 16, height: 10 },
        centre: crownCentre, billow: nobleGasBillowVfxBillowAt(crownCentre),
      },
      {
        code: 'POCKET', region: { x: 29, y: 45, width: 16, height: 10 },
        centre: pocketCentre, billow: nobleGasBillowVfxBillowAt(pocketCentre),
      },
    ],
    authoredVoid: { x: 154, y: 88, width: 20, height: 18 },
    // Wider than the half-resolution atmosphere kernel's two-sided reach.
    openChannel: { x: 250, y: 20, width: 24, height: 50 },
  },
  protectedGases: [
    {
      material: Material.Smoke, code: 'SMKE',
      body: { x: 20, y: 208, width: 90, height: 44 }, probe: { x: 64, y: 230 },
    },
    {
      material: Material.Oxygen, code: 'O2',
      body: { x: 126, y: 208, width: 90, height: 44 }, probe: { x: 170, y: 230 },
    },
    {
      material: Material.Hydrogen, code: 'H2',
      body: { x: 232, y: 208, width: 90, height: 44 }, probe: { x: 276, y: 230 },
    },
    {
      material: Material.FOG, code: 'FOG',
      body: { x: 338, y: 208, width: 90, height: 44 }, probe: { x: 382, y: 230 },
    },
    {
      material: Material.CFLM, code: 'CFLM',
      body: { x: 444, y: 208, width: 90, height: 44 }, probe: { x: 488, y: 230 },
    },
  ],
  sparse: {
    material: Material.NobleGas,
    carriers: [{ x: 20, y: 350 }, { x: 22, y: 350 }],
    midpoint: { x: 21, y: 350 },
    gap: { x: 40, y: 350 },
    isolated: { x: 58, y: 350 },
  },
  gasSeam: {
    gas: { x: 96, y: 270, width: 40, height: 32 },
    foreignGas: { x: 136, y: 270, width: 24, height: 32 },
    foreignMaterial: Material.FOG,
    gasProbe: { x: 135, y: 286 }, foreignProbe: { x: 136, y: 286 },
  },
  waterContact: {
    gas: { x: 184, y: 270, width: 34, height: 32 },
    water: { x: 218, y: 270, width: 22, height: 32 },
    gasProbe: { x: 217, y: 286 }, waterProbe: { x: 218, y: 286 },
  },
  metalContact: {
    gas: { x: 264, y: 270, width: 34, height: 32 },
    metal: { x: 298, y: 270, width: 22, height: 32 },
    gasProbe: { x: 297, y: 286 }, metalProbe: { x: 298, y: 286 },
  },
  nativeWall: {
    gas: { x: 344, y: 270, width: 52, height: 36 },
    wallAnchor: { x: 370, y: 288 },
  },
  guardedBlank: { x: 430, y: 270, width: 150, height: 36 },
  conductiveWall: CONDUCTIVE_WALL,
};

interface NobleGasBillowFixtureBackend extends SimulationBackend {
  walls(): Uint8Array;
  paintWall(x: number, y: number, wall: number, radius: number): void;
}

/** Direct-fills the deterministic E25 scene without advancing native physics. */
export function prepareNobleGasBillowVfxFixture(simulation: SimulationBackend): void {
  if (!supportsNobleGasBillowFixture(simulation)) {
    throw new Error('Noble-gas-billow VFX fixture requires RenderLab wall plane');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Noble-gas-billow VFX fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }

  simulation.clear();
  const cells = simulation.cells();
  const fixture = NOBLE_GAS_BILLOW_VFX_AUDIT;

  fillRoundedBody(cells, simulation.width, fixture.target.body, fixture.target.material);
  fillRect(cells, simulation.width, fixture.target.authoredVoid, Material.Empty);
  fillRect(cells, simulation.width, fixture.target.openChannel, Material.Empty);
  for (const control of fixture.protectedGases) {
    fillRect(cells, simulation.width, control.body, control.material);
  }
  for (const carrier of fixture.sparse.carriers) {
    setPoint(cells, simulation.width, carrier, fixture.sparse.material);
  }
  setPoint(cells, simulation.width, fixture.sparse.isolated, fixture.sparse.material);

  fillRect(cells, simulation.width, fixture.gasSeam.gas, Material.NobleGas);
  fillRect(cells, simulation.width, fixture.gasSeam.foreignGas, fixture.gasSeam.foreignMaterial);
  fillRect(cells, simulation.width, fixture.waterContact.gas, Material.NobleGas);
  fillRect(cells, simulation.width, fixture.waterContact.water, Material.Water);
  fillRect(cells, simulation.width, fixture.metalContact.gas, Material.NobleGas);
  fillRect(cells, simulation.width, fixture.metalContact.metal, Material.Metal);
  fillRect(cells, simulation.width, fixture.nativeWall.gas, Material.NobleGas);
  simulation.paintWall(
    fixture.nativeWall.wallAnchor.x,
    fixture.nativeWall.wallAnchor.y,
    fixture.conductiveWall,
    0,
  );
  fillRect(cells, simulation.width, fixture.guardedBlank, Material.Empty);
}

function supportsNobleGasBillowFixture(
  simulation: SimulationBackend,
): simulation is NobleGasBillowFixtureBackend {
  const candidate = simulation as Partial<NobleGasBillowFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.paintWall === 'function';
}

function fillRect(
  cells: Uint8Array, worldWidth: number, rect: NobleGasBillowVfxRect, material: Material,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * worldWidth + rect.x, y * worldWidth + rect.x + rect.width);
  }
}

function fillRoundedBody(
  cells: Uint8Array, worldWidth: number, rect: NobleGasBillowVfxRect, material: Material,
): void {
  const radiusX = rect.width * 0.5;
  const radiusY = rect.height * 0.5;
  const centreX = rect.x + radiusX;
  const centreY = rect.y + radiusY;
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      const normalizedX = Math.abs((x + 0.5 - centreX) / radiusX);
      const normalizedY = Math.abs((y + 0.5 - centreY) / radiusY);
      if (normalizedX ** 4 + normalizedY ** 4 <= 1) {
        cells[y * worldWidth + x] = material;
      }
    }
  }
}

function setPoint(
  cells: Uint8Array, worldWidth: number, point: NobleGasBillowVfxPoint, material: Material,
): void {
  cells[point.y * worldWidth + point.x] = material;
}
