import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CONDUCTIVE_WALL = 1;
const WALL_BLOCK_SIZE = 4;

export interface QuartzMesostructureVfxPoint { readonly x: number; readonly y: number }
export interface QuartzMesostructureVfxRect extends QuartzMesostructureVfxPoint {
  readonly width: number;
  readonly height: number;
}

export interface QuartzMesostructureVfxStateRegion extends QuartzMesostructureVfxRect {
  readonly speckle: 0 | 5 | 10;
}

/** Aligned native bmap checker; every semantic cell remains exact powder Quartz. */
export interface QuartzMesostructureVfxWallPattern {
  readonly kind: 'native-wall-checker';
  readonly region: QuartzMesostructureVfxRect;
  readonly blockSize: 4;
  readonly occupiedParity: 0;
  readonly wallProbe: QuartzMesostructureVfxPoint;
  readonly clearProbe: QuartzMesostructureVfxPoint;
}

export interface QuartzMesostructureVfxBoundary {
  readonly code: 'PQRT_METL' | 'PQRT_WATR';
  readonly quartz: QuartzMesostructureVfxRect;
  readonly other: QuartzMesostructureVfxRect;
  readonly otherMaterial: Material.Metal | Material.Water;
  readonly quartzProbe: QuartzMesostructureVfxPoint;
  readonly otherProbe: QuartzMesostructureVfxPoint;
}

export interface QuartzMesostructureVfxSuspensionControl {
  readonly region: QuartzMesostructureVfxRect;
  /** Exact 2:1 PQRT/Water weave used to reject wet-body ownership. */
  readonly quartzPoints: readonly QuartzMesostructureVfxPoint[];
  readonly quartzProbe: QuartzMesostructureVfxPoint;
  readonly waterProbe: QuartzMesostructureVfxPoint;
}

type MaterialControl<M extends Material> = QuartzMesostructureVfxRect & {
  readonly material: M;
  readonly speckle: number;
};

export interface QuartzMesostructureVfxAuditSnapshot {
  readonly version: 1;
  readonly world: { readonly width: 612; readonly height: 384 };
  readonly target: {
    readonly code: 'PQRT';
    /** Public/native powder Quartz is exact projected material ID 29. */
    readonly material: Material.Quartz;
    readonly neutralSpeckle: 5;
    readonly body: QuartzMesostructureVfxRect;
    readonly core: QuartzMesostructureVfxRect;
    readonly crown: QuartzMesostructureVfxRect;
    readonly pocket: QuartzMesostructureVfxRect;
    readonly authoredHole: QuartzMesostructureVfxRect;
    readonly openChannel: QuartzMesostructureVfxRect;
    readonly wallCoexistence: QuartzMesostructureVfxWallPattern;
    readonly stateRegions: {
      readonly dark: QuartzMesostructureVfxStateRegion;
      readonly neutral: QuartzMesostructureVfxStateRegion;
      readonly bright: QuartzMesostructureVfxStateRegion;
    };
  };
  readonly fineTopology: {
    readonly column: QuartzMesostructureVfxRect;
    readonly line: QuartzMesostructureVfxRect;
    readonly isolated: QuartzMesostructureVfxPoint;
  };
  readonly movingControl: QuartzMesostructureVfxRect & {
    readonly velocityX: 31;
    readonly velocityY: -17;
  };
  readonly suspensionControl: QuartzMesostructureVfxSuspensionControl;
  readonly powderStyleMatrix: readonly [
    { readonly style: 'smooth'; readonly expectation: 'target' },
    { readonly style: 'local'; readonly expectation: 'exact-no-op' },
    { readonly style: 'grains'; readonly expectation: 'exact-no-op' },
  ];
  readonly materialControls: {
    readonly salt: MaterialControl<Material.Salt>;
    readonly snow: MaterialControl<Material.Snow>;
    readonly bgla: MaterialControl<Material.BGLA>;
    readonly frzz: MaterialControl<Material.FRZZ>;
    readonly slcn: MaterialControl<Material.SLCN>;
    readonly sand: MaterialControl<Material.Sand>;
    readonly thermite: MaterialControl<Material.Thermite>;
    readonly c4: MaterialControl<Material.C4>;
    readonly ice: MaterialControl<Material.Ice>;
    readonly qrtz: MaterialControl<Material.QRTZ>;
  };
  readonly contacts: {
    readonly metal: QuartzMesostructureVfxBoundary;
    readonly water: QuartzMesostructureVfxBoundary;
  };
  readonly guardedBlank: QuartzMesostructureVfxRect;
  readonly conductiveWall: 1;
  readonly expected: {
    readonly occupiedCells: 98_713;
    readonly quartzCells: 62_841;
    readonly waterCells: 3_872;
    readonly metalCells: 1_280;
    readonly cellsPerMaterialControl: 3_072;
    readonly suspensionQuartzCells: 5_184;
    readonly suspensionWaterCells: 2_592;
    readonly movingVelocityCells: 4_480;
    readonly wallCells: 2_048;
    readonly stateCounts: { readonly dark: 768; readonly neutral: 61_305; readonly bright: 768 };
    readonly qrtzState: 10;
  };
}

const body = { x: 20, y: 20, width: 340, height: 150 } as const;
const wallCoexistence: QuartzMesostructureVfxWallPattern = {
  kind: 'native-wall-checker',
  region: { x: 288, y: 92, width: 64, height: 64 },
  blockSize: WALL_BLOCK_SIZE,
  occupiedParity: 0,
  wallProbe: { x: 289, y: 93 },
  clearProbe: { x: 293, y: 93 },
};
const suspensionRegion = { x: 488, y: 20, width: 108, height: 72 } as const;

function boundary(
  code: QuartzMesostructureVfxBoundary['code'], x: number,
  otherMaterial: QuartzMesostructureVfxBoundary['otherMaterial'],
): QuartzMesostructureVfxBoundary {
  const quartz = { x, y: 196, width: 40, height: 40 };
  const other = { x: x + quartz.width, y: quartz.y, width: 32, height: quartz.height };
  return {
    code, quartz, other, otherMaterial,
    quartzProbe: { x: quartz.x + quartz.width - 1, y: quartz.y + 20 },
    otherProbe: { x: other.x, y: other.y + 20 },
  };
}

/** Paused exact-owner/state contract for the E49 powder-Quartz experiment. */
export const QUARTZ_MESOSTRUCTURE_VFX_AUDIT: QuartzMesostructureVfxAuditSnapshot = {
  version: 1,
  world: { width: WORLD_WIDTH, height: WORLD_HEIGHT },
  target: {
    code: 'PQRT', material: Material.Quartz, neutralSpeckle: 5, body,
    core: { x: 48, y: 56, width: 48, height: 32 },
    crown: { x: 242, y: 42, width: 16, height: 12 },
    pocket: { x: 224, y: 42, width: 16, height: 12 },
    authoredHole: { x: 136, y: 92, width: 16, height: 16 },
    openChannel: { x: 166, y: body.y, width: 14, height: 64 },
    wallCoexistence,
    stateRegions: {
      dark: { x: 48, y: 124, width: 32, height: 24, speckle: 0 },
      neutral: { x: 88, y: 124, width: 32, height: 24, speckle: 5 },
      bright: { x: 208, y: 124, width: 32, height: 24, speckle: 10 },
    },
  },
  fineTopology: {
    column: { x: 388, y: 96, width: 1, height: 64 },
    line: { x: 408, y: 108, width: 64, height: 1 },
    isolated: { x: 472, y: 148 },
  },
  movingControl: { x: 388, y: 20, width: 80, height: 56, velocityX: 31, velocityY: -17 },
  suspensionControl: {
    region: suspensionRegion,
    quartzPoints: buildSuspendedQuartzPoints(suspensionRegion),
    quartzProbe: { x: 542, y: 56 },
    waterProbe: { x: 544, y: 56 },
  },
  powderStyleMatrix: [
    { style: 'smooth', expectation: 'target' },
    { style: 'local', expectation: 'exact-no-op' },
    { style: 'grains', expectation: 'exact-no-op' },
  ],
  materialControls: {
    salt: { x: 16, y: 196, width: 64, height: 48, material: Material.Salt, speckle: 0 },
    snow: { x: 88, y: 196, width: 64, height: 48, material: Material.Snow, speckle: 0 },
    bgla: { x: 160, y: 196, width: 64, height: 48, material: Material.BGLA, speckle: 0 },
    frzz: { x: 232, y: 196, width: 64, height: 48, material: Material.FRZZ, speckle: 0 },
    slcn: { x: 504, y: 196, width: 64, height: 48, material: Material.SLCN, speckle: 0 },
    sand: { x: 16, y: 260, width: 64, height: 48, material: Material.Sand, speckle: 0 },
    thermite: { x: 88, y: 260, width: 64, height: 48, material: Material.Thermite, speckle: 0 },
    c4: { x: 160, y: 260, width: 64, height: 48, material: Material.C4, speckle: 0 },
    ice: { x: 232, y: 260, width: 64, height: 48, material: Material.Ice, speckle: 0 },
    qrtz: { x: 304, y: 260, width: 64, height: 48, material: Material.QRTZ, speckle: 10 },
  },
  contacts: {
    metal: boundary('PQRT_METL', 320, Material.Metal),
    water: boundary('PQRT_WATR', 416, Material.Water),
  },
  guardedBlank: { x: 16, y: 340, width: 560, height: 36 },
  conductiveWall: CONDUCTIVE_WALL,
  expected: {
    occupiedCells: 98_713, quartzCells: 62_841, waterCells: 3_872, metalCells: 1_280,
    cellsPerMaterialControl: 3_072,
    suspensionQuartzCells: 5_184, suspensionWaterCells: 2_592,
    movingVelocityCells: 4_480, wallCells: 2_048,
    stateCounts: { dark: 768, neutral: 61_305, bright: 768 }, qrtzState: 10,
  },
};

interface QuartzMesostructureVfxFixtureBackend extends SimulationBackend {
  paintWall(x: number, y: number, wall: number, radius: number): void;
  walls(): Uint8Array;
  velocity(): Int8Array;
  presentationState(): Uint16Array;
  setFixtureVelocityRect(
    x: number, y: number, width: number, height: number,
    velocityX: number, velocityY: number,
  ): void;
}

/** Direct-fills the canonical paused RenderLab planes without stepping physics. */
export function prepareQuartzMesostructureVfxAuditFixture(simulation: SimulationBackend): void {
  if (!supportsFixture(simulation)) {
    throw new Error('Quartz mesostructure VFX fixture requires canonical wall, velocity, and state planes');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Quartz mesostructure VFX fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  const states = simulation.presentationState();
  const fixture = QUARTZ_MESOSTRUCTURE_VFX_AUDIT;

  fillRect(cells, states, simulation.width, fixture.target.body, fixture.target.material, 5);
  fillRect(cells, states, simulation.width, fixture.target.authoredHole, Material.Empty, 0);
  fillRect(cells, states, simulation.width, fixture.target.openChannel, Material.Empty, 0);
  for (const region of Object.values(fixture.target.stateRegions)) {
    fillRect(cells, states, simulation.width, region, fixture.target.material, region.speckle);
  }
  paintWallPattern(simulation, fixture.target.wallCoexistence);

  fillRect(cells, states, simulation.width, fixture.fineTopology.column, fixture.target.material, 5);
  fillRect(cells, states, simulation.width, fixture.fineTopology.line, fixture.target.material, 5);
  setPoint(cells, states, simulation.width, fixture.fineTopology.isolated, fixture.target.material, 5);
  fillRect(cells, states, simulation.width, fixture.movingControl, fixture.target.material, 5);
  simulation.setFixtureVelocityRect(
    fixture.movingControl.x, fixture.movingControl.y,
    fixture.movingControl.width, fixture.movingControl.height,
    fixture.movingControl.velocityX, fixture.movingControl.velocityY,
  );

  fillRect(cells, states, simulation.width, fixture.suspensionControl.region, Material.Water, 0);
  for (const point of fixture.suspensionControl.quartzPoints) {
    setPoint(cells, states, simulation.width, point, fixture.target.material, 5);
  }
  for (const entry of Object.values(fixture.materialControls)) {
    fillRect(cells, states, simulation.width, entry, entry.material, entry.speckle);
  }
  for (const entry of Object.values(fixture.contacts)) {
    fillRect(cells, states, simulation.width, entry.quartz, fixture.target.material, 5);
    fillRect(cells, states, simulation.width, entry.other, entry.otherMaterial, 0);
  }
  fillRect(cells, states, simulation.width, fixture.guardedBlank, Material.Empty, 0);
}

function supportsFixture(
  simulation: SimulationBackend,
): simulation is QuartzMesostructureVfxFixtureBackend {
  const candidate = simulation as Partial<QuartzMesostructureVfxFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.paintWall === 'function'
    && typeof candidate.velocity === 'function'
    && typeof candidate.presentationState === 'function'
    && typeof candidate.setFixtureVelocityRect === 'function';
}

function paintWallPattern(
  simulation: QuartzMesostructureVfxFixtureBackend,
  pattern: QuartzMesostructureVfxWallPattern,
): void {
  for (let offsetY = 0; offsetY < pattern.region.height; offsetY += WALL_BLOCK_SIZE) {
    for (let offsetX = 0; offsetX < pattern.region.width; offsetX += WALL_BLOCK_SIZE) {
      if ((offsetX / WALL_BLOCK_SIZE + offsetY / WALL_BLOCK_SIZE) % 2
        !== pattern.occupiedParity) continue;
      simulation.paintWall(pattern.region.x + offsetX, pattern.region.y + offsetY, CONDUCTIVE_WALL, 0);
    }
  }
}

function buildSuspendedQuartzPoints(
  rect: QuartzMesostructureVfxRect,
): readonly QuartzMesostructureVfxPoint[] {
  const points: QuartzMesostructureVfxPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      if ((x - rect.x + y - rect.y) % 3 !== 2) points.push({ x, y });
    }
  }
  return points;
}

function fillRect(
  cells: Uint8Array, states: Uint16Array, width: number,
  rect: QuartzMesostructureVfxRect, material: Material, state: number,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * width + rect.x, y * width + rect.x + rect.width);
    states.fill(state, y * width + rect.x, y * width + rect.x + rect.width);
  }
}

function setPoint(
  cells: Uint8Array, states: Uint16Array, width: number,
  point: QuartzMesostructureVfxPoint, material: Material, state: number,
): void {
  const index = point.y * width + point.x;
  cells[index] = material;
  states[index] = state;
}
