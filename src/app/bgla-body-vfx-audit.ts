import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CONDUCTIVE_WALL = 1;
const WALL_BLOCK_SIZE = 4;

export interface BglaBodyVfxPoint { readonly x: number; readonly y: number }
export interface BglaBodyVfxRect extends BglaBodyVfxPoint {
  readonly width: number;
  readonly height: number;
}

/** Aligned native bmap checker; BGLA remains the exact semantic owner throughout. */
export interface BglaBodyVfxWallPattern {
  readonly kind: 'native-wall-checker';
  readonly region: BglaBodyVfxRect;
  readonly blockSize: 4;
  readonly occupiedParity: 0;
  readonly wallProbe: BglaBodyVfxPoint;
  readonly clearProbe: BglaBodyVfxPoint;
}

export interface BglaBodyVfxBoundary {
  readonly code: 'BGLA_ROCK' | 'BGLA_METL' | 'BGLA_WATR';
  readonly bgla: BglaBodyVfxRect;
  readonly other: BglaBodyVfxRect;
  readonly otherMaterial: Material.ROCK | Material.Metal | Material.Water;
  readonly bglaProbe: BglaBodyVfxPoint;
  readonly otherProbe: BglaBodyVfxPoint;
}

export interface BglaBodyVfxSuspensionControl {
  readonly region: BglaBodyVfxRect;
  /** Exact 2:1 BGLA/Water weave rejects wet-body ownership. */
  readonly bglaPoints: readonly BglaBodyVfxPoint[];
  readonly bglaProbe: BglaBodyVfxPoint;
  readonly waterProbe: BglaBodyVfxPoint;
}

type MaterialControl<M extends Material> = BglaBodyVfxRect & { readonly material: M };

export interface BglaBodyVfxAuditSnapshot {
  readonly version: 1;
  readonly world: { readonly width: 612; readonly height: 384 };
  readonly target: {
    readonly code: 'BGLA';
    readonly material: Material.BGLA;
    readonly body: BglaBodyVfxRect;
    readonly core: BglaBodyVfxRect;
    readonly crown: BglaBodyVfxRect;
    readonly pocket: BglaBodyVfxRect;
    readonly authoredHole: BglaBodyVfxRect;
    readonly openChannel: BglaBodyVfxRect;
    readonly wallCoexistence: BglaBodyVfxWallPattern;
  };
  readonly fineTopology: {
    readonly column: BglaBodyVfxRect;
    readonly line: BglaBodyVfxRect;
    readonly isolated: BglaBodyVfxPoint;
  };
  /** Deliberately unsettled BGLA: it is a protected exact-no-op control. */
  readonly movingControl: BglaBodyVfxRect & {
    readonly velocityX: 31;
    readonly velocityY: -17;
  };
  readonly suspensionControl: BglaBodyVfxSuspensionControl;
  readonly powderStyleMatrix: readonly [
    { readonly style: 'smooth'; readonly expectation: 'target' },
    { readonly style: 'local'; readonly expectation: 'exact-no-op' },
    { readonly style: 'grains'; readonly expectation: 'exact-no-op' },
  ];
  readonly materialControls: {
    readonly salt: MaterialControl<Material.Salt>;
    readonly snow: MaterialControl<Material.Snow>;
    readonly quartz: MaterialControl<Material.Quartz>;
    readonly frzz: MaterialControl<Material.FRZZ>;
    readonly slcn: MaterialControl<Material.SLCN>;
    readonly sand: MaterialControl<Material.Sand>;
    readonly thermite: MaterialControl<Material.Thermite>;
    readonly c4: MaterialControl<Material.C4>;
    readonly ice: MaterialControl<Material.Ice>;
    readonly oil: MaterialControl<Material.Oil>;
  };
  readonly contacts: {
    readonly rock: BglaBodyVfxBoundary;
    readonly metal: BglaBodyVfxBoundary;
    readonly water: BglaBodyVfxBoundary;
  };
  readonly guardedBlank: BglaBodyVfxRect;
  readonly conductiveWall: 1;
  readonly expected: {
    readonly occupiedCells: 101_593;
    readonly bglaCells: 64_441;
    readonly waterCells: 3_872;
    readonly rockCells: 1_280;
    readonly metalCells: 1_280;
    readonly cellsPerMaterialControl: 3_072;
    readonly suspensionBglaCells: 5_184;
    readonly suspensionWaterCells: 2_592;
    readonly movingVelocityCells: 4_480;
    readonly wallCells: 2_048;
  };
}

const body = { x: 20, y: 20, width: 340, height: 150 } as const;
const wallCoexistence: BglaBodyVfxWallPattern = {
  kind: 'native-wall-checker',
  region: { x: 288, y: 92, width: 64, height: 64 },
  blockSize: WALL_BLOCK_SIZE,
  occupiedParity: 0,
  wallProbe: { x: 289, y: 93 },
  clearProbe: { x: 293, y: 93 },
};
const suspensionRegion = { x: 488, y: 20, width: 108, height: 72 } as const;

function boundary(
  code: BglaBodyVfxBoundary['code'], x: number,
  otherMaterial: BglaBodyVfxBoundary['otherMaterial'],
): BglaBodyVfxBoundary {
  const bgla = { x, y: 196, width: 40, height: 40 };
  const other = { x: x + bgla.width, y: bgla.y, width: 32, height: bgla.height };
  return {
    code, bgla, other, otherMaterial,
    bglaProbe: { x: bgla.x + bgla.width - 1, y: bgla.y + 20 },
    otherProbe: { x: other.x, y: other.y + 20 },
  };
}

/** Paused exact-owner contract for the E52 BGLA settled shard-pack experiment. */
export const BGLA_BODY_VFX_AUDIT: BglaBodyVfxAuditSnapshot = {
  version: 1,
  world: { width: WORLD_WIDTH, height: WORLD_HEIGHT },
  target: {
    code: 'BGLA', material: Material.BGLA, body,
    core: { x: 48, y: 56, width: 48, height: 32 },
    crown: { x: 242, y: 42, width: 16, height: 12 },
    pocket: { x: 224, y: 42, width: 16, height: 12 },
    authoredHole: { x: 136, y: 92, width: 16, height: 16 },
    openChannel: { x: 166, y: body.y, width: 14, height: 64 },
    wallCoexistence,
  },
  fineTopology: {
    column: { x: 388, y: 96, width: 1, height: 64 },
    line: { x: 408, y: 108, width: 64, height: 1 },
    isolated: { x: 472, y: 148 },
  },
  movingControl: { x: 388, y: 20, width: 80, height: 56, velocityX: 31, velocityY: -17 },
  suspensionControl: {
    region: suspensionRegion,
    bglaPoints: buildSuspendedBglaPoints(suspensionRegion),
    bglaProbe: { x: 542, y: 56 },
    waterProbe: { x: 544, y: 56 },
  },
  powderStyleMatrix: [
    { style: 'smooth', expectation: 'target' },
    { style: 'local', expectation: 'exact-no-op' },
    { style: 'grains', expectation: 'exact-no-op' },
  ],
  materialControls: {
    salt: { x: 280, y: 196, width: 64, height: 48, material: Material.Salt },
    snow: { x: 352, y: 196, width: 64, height: 48, material: Material.Snow },
    quartz: { x: 424, y: 196, width: 64, height: 48, material: Material.Quartz },
    frzz: { x: 496, y: 196, width: 64, height: 48, material: Material.FRZZ },
    slcn: { x: 16, y: 260, width: 64, height: 48, material: Material.SLCN },
    sand: { x: 88, y: 260, width: 64, height: 48, material: Material.Sand },
    thermite: { x: 160, y: 260, width: 64, height: 48, material: Material.Thermite },
    c4: { x: 232, y: 260, width: 64, height: 48, material: Material.C4 },
    ice: { x: 304, y: 260, width: 64, height: 48, material: Material.Ice },
    oil: { x: 376, y: 260, width: 64, height: 48, material: Material.Oil },
  },
  contacts: {
    rock: boundary('BGLA_ROCK', 16, Material.ROCK),
    metal: boundary('BGLA_METL', 104, Material.Metal),
    water: boundary('BGLA_WATR', 192, Material.Water),
  },
  guardedBlank: { x: 16, y: 340, width: 560, height: 36 },
  conductiveWall: CONDUCTIVE_WALL,
  expected: {
    occupiedCells: 101_593,
    bglaCells: 64_441,
    waterCells: 3_872,
    rockCells: 1_280,
    metalCells: 1_280,
    cellsPerMaterialControl: 3_072,
    suspensionBglaCells: 5_184,
    suspensionWaterCells: 2_592,
    movingVelocityCells: 4_480,
    wallCells: 2_048,
  },
};

interface BglaBodyVfxFixtureBackend extends SimulationBackend {
  paintWall(x: number, y: number, wall: number, radius: number): void;
  walls(): Uint8Array;
  velocity(): Int8Array;
  setFixtureVelocityRect(
    x: number, y: number, width: number, height: number,
    velocityX: number, velocityY: number,
  ): void;
}

/** Direct-fills the canonical paused RenderLab planes without stepping physics. */
export function prepareBglaBodyVfxAuditFixture(simulation: SimulationBackend): void {
  if (!supportsFixture(simulation)) {
    throw new Error('BGLA body VFX fixture requires a canonical RenderLab wall and velocity plane');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`BGLA body VFX fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  const fixture = BGLA_BODY_VFX_AUDIT;

  fillRect(cells, simulation.width, fixture.target.body, fixture.target.material);
  fillRect(cells, simulation.width, fixture.target.authoredHole, Material.Empty);
  fillRect(cells, simulation.width, fixture.target.openChannel, Material.Empty);
  paintWallPattern(simulation, fixture.target.wallCoexistence);

  fillRect(cells, simulation.width, fixture.fineTopology.column, fixture.target.material);
  fillRect(cells, simulation.width, fixture.fineTopology.line, fixture.target.material);
  setPoint(cells, simulation.width, fixture.fineTopology.isolated, fixture.target.material);
  fillRect(cells, simulation.width, fixture.movingControl, fixture.target.material);
  simulation.setFixtureVelocityRect(
    fixture.movingControl.x, fixture.movingControl.y,
    fixture.movingControl.width, fixture.movingControl.height,
    fixture.movingControl.velocityX, fixture.movingControl.velocityY,
  );

  fillRect(cells, simulation.width, fixture.suspensionControl.region, Material.Water);
  for (const point of fixture.suspensionControl.bglaPoints) {
    setPoint(cells, simulation.width, point, fixture.target.material);
  }
  for (const entry of Object.values(fixture.materialControls)) {
    fillRect(cells, simulation.width, entry, entry.material);
  }
  for (const entry of Object.values(fixture.contacts)) {
    fillRect(cells, simulation.width, entry.bgla, fixture.target.material);
    fillRect(cells, simulation.width, entry.other, entry.otherMaterial);
  }
  fillRect(cells, simulation.width, fixture.guardedBlank, Material.Empty);
}

function supportsFixture(simulation: SimulationBackend): simulation is BglaBodyVfxFixtureBackend {
  const candidate = simulation as Partial<BglaBodyVfxFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.paintWall === 'function'
    && typeof candidate.velocity === 'function'
    && typeof candidate.setFixtureVelocityRect === 'function';
}

function paintWallPattern(
  simulation: BglaBodyVfxFixtureBackend,
  pattern: BglaBodyVfxWallPattern,
): void {
  for (let offsetY = 0; offsetY < pattern.region.height; offsetY += WALL_BLOCK_SIZE) {
    for (let offsetX = 0; offsetX < pattern.region.width; offsetX += WALL_BLOCK_SIZE) {
      if ((offsetX / WALL_BLOCK_SIZE + offsetY / WALL_BLOCK_SIZE) % 2
        !== pattern.occupiedParity) continue;
      simulation.paintWall(pattern.region.x + offsetX, pattern.region.y + offsetY, CONDUCTIVE_WALL, 0);
    }
  }
}

function buildSuspendedBglaPoints(rect: BglaBodyVfxRect): readonly BglaBodyVfxPoint[] {
  const points: BglaBodyVfxPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      if ((x - rect.x + y - rect.y) % 3 !== 2) points.push({ x, y });
    }
  }
  return points;
}

function fillRect(
  cells: Uint8Array, width: number, rect: BglaBodyVfxRect, material: Material,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * width + rect.x, y * width + rect.x + rect.width);
  }
}

function setPoint(
  cells: Uint8Array, width: number, point: BglaBodyVfxPoint, material: Material,
): void {
  cells[point.y * width + point.x] = material;
}
