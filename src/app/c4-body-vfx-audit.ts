import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CONDUCTIVE_WALL = 1;
const WALL_BLOCK_SIZE = 4;

export interface C4BodyVfxPoint { readonly x: number; readonly y: number }
export interface C4BodyVfxRect extends C4BodyVfxPoint {
  readonly width: number;
  readonly height: number;
}

/** Aligned native bmap checker; every semantic cell remains exact C4. */
export interface C4BodyVfxWallPattern {
  readonly kind: 'native-wall-checker';
  readonly region: C4BodyVfxRect;
  readonly blockSize: 4;
  readonly occupiedParity: 0;
  readonly wallProbe: C4BodyVfxPoint;
  readonly clearProbe: C4BodyVfxPoint;
}

export interface C4BodyVfxBoundary {
  readonly code: 'C4_METL' | 'C4_WATR';
  readonly c4: C4BodyVfxRect;
  readonly other: C4BodyVfxRect;
  readonly otherMaterial: Material.Metal | Material.Water;
  readonly c4Probe: C4BodyVfxPoint;
  readonly otherProbe: C4BodyVfxPoint;
}

export interface C4BodyVfxSuspensionControl {
  readonly region: C4BodyVfxRect;
  /** Exact 2:1 C4/Water weave used to reject aqueous or wet-body ownership. */
  readonly c4Points: readonly C4BodyVfxPoint[];
  readonly c4Probe: C4BodyVfxPoint;
  readonly waterProbe: C4BodyVfxPoint;
}

type MaterialControl<M extends Material> = C4BodyVfxRect & { readonly material: M };

export interface C4BodyVfxAuditSnapshot {
  readonly version: 1;
  readonly world: { readonly width: 612; readonly height: 384 };
  readonly target: {
    readonly code: 'C4';
    /** Native C4 is exact projected material ID 31. */
    readonly material: Material.C4;
    /** Broad paused, zero-velocity C4 body used by the canonical Smooth gate. */
    readonly body: C4BodyVfxRect;
    readonly core: C4BodyVfxRect;
    readonly crown: C4BodyVfxRect;
    readonly pocket: C4BodyVfxRect;
    readonly authoredHole: C4BodyVfxRect;
    /** Empty channel deliberately reaches the upper silhouette. */
    readonly openChannel: C4BodyVfxRect;
    readonly wallCoexistence: C4BodyVfxWallPattern;
  };
  readonly fineTopology: {
    readonly column: C4BodyVfxRect;
    readonly line: C4BodyVfxRect;
    readonly isolated: C4BodyVfxPoint;
  };
  /** Exact C4 with authored velocity; body optics must reject it. */
  readonly movingControl: C4BodyVfxRect & {
    readonly velocityX: 31;
    readonly velocityY: -17;
  };
  readonly suspensionControl: C4BodyVfxSuspensionControl;
  /** The same semantic fixture is rerendered; Local and Grains are exact controls. */
  readonly powderStyleMatrix: readonly [
    { readonly style: 'smooth'; readonly expectation: 'target' },
    { readonly style: 'local'; readonly expectation: 'exact-no-op' },
    { readonly style: 'grains'; readonly expectation: 'exact-no-op' },
  ];
  readonly materialControls: {
    readonly sand: MaterialControl<Material.Sand>;
    readonly clay: MaterialControl<Material.Clay>;
    readonly dust: MaterialControl<Material.Dust>;
    readonly thermite: MaterialControl<Material.Thermite>;
    readonly firework: MaterialControl<Material.Firework>;
    readonly gunpowder: MaterialControl<Material.Gunpowder>;
    readonly snow: MaterialControl<Material.Snow>;
    readonly quartz: MaterialControl<Material.Quartz>;
    readonly brec: MaterialControl<Material.BREC>;
    readonly nitro: MaterialControl<Material.Nitro>;
  };
  readonly contacts: {
    readonly metal: C4BodyVfxBoundary;
    readonly water: C4BodyVfxBoundary;
  };
  readonly guardedBlank: C4BodyVfxRect;
  readonly conductiveWall: 1;
  /** Frozen semantic/native-plane cardinalities for the deterministic v1 fixture. */
  readonly expected: {
    readonly occupiedCells: 98_713;
    readonly c4Cells: 62_841;
    readonly waterCells: 3_872;
    readonly metalCells: 1_280;
    readonly cellsPerMaterialControl: 3_072;
    readonly suspensionC4Cells: 5_184;
    readonly suspensionWaterCells: 2_592;
    readonly movingVelocityCells: 4_480;
    readonly wallCells: 2_048;
    readonly presentationStateCells: 0;
  };
}

const body = { x: 20, y: 20, width: 340, height: 150 } as const;
const wallCoexistence: C4BodyVfxWallPattern = {
  kind: 'native-wall-checker',
  // 64x64 cells / 16-cell blocks / half occupied = exactly 2,048 bmap cells.
  region: { x: 288, y: 92, width: 64, height: 64 },
  blockSize: WALL_BLOCK_SIZE,
  occupiedParity: 0,
  wallProbe: { x: 289, y: 93 },
  clearProbe: { x: 293, y: 93 },
};

const suspensionRegion = { x: 488, y: 20, width: 108, height: 72 } as const;

function boundary(
  code: C4BodyVfxBoundary['code'], x: number,
  otherMaterial: C4BodyVfxBoundary['otherMaterial'],
): C4BodyVfxBoundary {
  const c4 = { x, y: 196, width: 40, height: 40 };
  const other = { x: x + c4.width, y: c4.y, width: 32, height: c4.height };
  return {
    code,
    c4,
    other,
    otherMaterial,
    c4Probe: { x: c4.x + c4.width - 1, y: c4.y + 20 },
    otherProbe: { x: other.x, y: other.y + 20 },
  };
}

/**
 * Paused exact-owner/state contract for the E50 C4 rough-powder experiment.
 * The fixture owns semantic matter, native walls, signed velocity, and a
 * deliberately all-zero state plane; rendering comparisons stay in the browser gate.
 */
export const C4_BODY_VFX_AUDIT: C4BodyVfxAuditSnapshot = {
  version: 1,
  world: { width: WORLD_WIDTH, height: WORLD_HEIGHT },
  target: {
    code: 'C4',
    material: Material.C4,
    body,
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
    c4Points: buildSuspendedC4Points(suspensionRegion),
    c4Probe: { x: 542, y: 56 },
    waterProbe: { x: 544, y: 56 },
  },
  powderStyleMatrix: [
    { style: 'smooth', expectation: 'target' },
    { style: 'local', expectation: 'exact-no-op' },
    { style: 'grains', expectation: 'exact-no-op' },
  ],
  materialControls: {
    sand: { x: 16, y: 196, width: 64, height: 48, material: Material.Sand },
    clay: { x: 88, y: 196, width: 64, height: 48, material: Material.Clay },
    dust: { x: 160, y: 196, width: 64, height: 48, material: Material.Dust },
    thermite: { x: 232, y: 196, width: 64, height: 48, material: Material.Thermite },
    firework: { x: 504, y: 196, width: 64, height: 48, material: Material.Firework },
    gunpowder: { x: 16, y: 260, width: 64, height: 48, material: Material.Gunpowder },
    snow: { x: 88, y: 260, width: 64, height: 48, material: Material.Snow },
    quartz: { x: 160, y: 260, width: 64, height: 48, material: Material.Quartz },
    brec: { x: 232, y: 260, width: 64, height: 48, material: Material.BREC },
    nitro: { x: 304, y: 260, width: 64, height: 48, material: Material.Nitro },
  },
  contacts: {
    metal: boundary('C4_METL', 320, Material.Metal),
    water: boundary('C4_WATR', 416, Material.Water),
  },
  guardedBlank: { x: 16, y: 340, width: 560, height: 36 },
  conductiveWall: CONDUCTIVE_WALL,
  expected: {
    occupiedCells: 98_713,
    c4Cells: 62_841,
    waterCells: 3_872,
    metalCells: 1_280,
    cellsPerMaterialControl: 3_072,
    suspensionC4Cells: 5_184,
    suspensionWaterCells: 2_592,
    movingVelocityCells: 4_480,
    wallCells: 2_048,
    presentationStateCells: 0,
  },
};

interface C4BodyVfxFixtureBackend extends SimulationBackend {
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
export function prepareC4BodyVfxAuditFixture(simulation: SimulationBackend): void {
  if (!supportsFixture(simulation)) {
    throw new Error('C4 body VFX fixture requires canonical wall, velocity, and state planes');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`C4 body VFX fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  // RenderLab clear already resets it. Reset explicitly so this contract holds
  // for any compatible deterministic backend too.
  simulation.presentationState().fill(0);
  const fixture = C4_BODY_VFX_AUDIT;

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
  for (const point of fixture.suspensionControl.c4Points) {
    setPoint(cells, simulation.width, point, fixture.target.material);
  }
  for (const entry of Object.values(fixture.materialControls)) {
    fillRect(cells, simulation.width, entry, entry.material);
  }
  for (const entry of Object.values(fixture.contacts)) {
    fillRect(cells, simulation.width, entry.c4, fixture.target.material);
    fillRect(cells, simulation.width, entry.other, entry.otherMaterial);
  }
  fillRect(cells, simulation.width, fixture.guardedBlank, Material.Empty);
}

function supportsFixture(simulation: SimulationBackend): simulation is C4BodyVfxFixtureBackend {
  const candidate = simulation as Partial<C4BodyVfxFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.paintWall === 'function'
    && typeof candidate.velocity === 'function' && typeof candidate.presentationState === 'function'
    && typeof candidate.setFixtureVelocityRect === 'function';
}

function paintWallPattern(
  simulation: C4BodyVfxFixtureBackend,
  pattern: C4BodyVfxWallPattern,
): void {
  for (let offsetY = 0; offsetY < pattern.region.height; offsetY += WALL_BLOCK_SIZE) {
    for (let offsetX = 0; offsetX < pattern.region.width; offsetX += WALL_BLOCK_SIZE) {
      if ((offsetX / WALL_BLOCK_SIZE + offsetY / WALL_BLOCK_SIZE) % 2
        !== pattern.occupiedParity) continue;
      simulation.paintWall(
        pattern.region.x + offsetX,
        pattern.region.y + offsetY,
        CONDUCTIVE_WALL,
        0,
      );
    }
  }
}

function buildSuspendedC4Points(rect: C4BodyVfxRect): readonly C4BodyVfxPoint[] {
  const points: C4BodyVfxPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      if ((x - rect.x + y - rect.y) % 3 !== 2) points.push({ x, y });
    }
  }
  return points;
}

function fillRect(
  cells: Uint8Array, width: number, rect: C4BodyVfxRect, material: Material,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * width + rect.x, y * width + rect.x + rect.width);
  }
}

function setPoint(
  cells: Uint8Array, width: number, point: C4BodyVfxPoint, material: Material,
): void {
  cells[point.y * width + point.x] = material;
}
