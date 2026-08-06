import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CONDUCTIVE_WALL = 1;
const WALL_BLOCK_SIZE = 4;

export interface SnowpackBodyVfxPoint { readonly x: number; readonly y: number }
export interface SnowpackBodyVfxRect extends SnowpackBodyVfxPoint {
  readonly width: number;
  readonly height: number;
}

/** Aligned native bmap checker; every semantic cell remains exact Snow. */
export interface SnowpackBodyVfxWallPattern {
  readonly kind: 'native-wall-checker';
  readonly region: SnowpackBodyVfxRect;
  readonly blockSize: 4;
  readonly occupiedParity: 0;
  readonly wallProbe: SnowpackBodyVfxPoint;
  readonly clearProbe: SnowpackBodyVfxPoint;
}

export interface SnowpackBodyVfxBoundary {
  readonly code: 'SNOW_METL' | 'SNOW_WATR';
  readonly snow: SnowpackBodyVfxRect;
  readonly other: SnowpackBodyVfxRect;
  readonly otherMaterial: Material.Metal | Material.Water;
  readonly snowProbe: SnowpackBodyVfxPoint;
  readonly otherProbe: SnowpackBodyVfxPoint;
}

export interface SnowpackBodyVfxSuspensionControl {
  readonly region: SnowpackBodyVfxRect;
  /** Exact 2:1 Snow/Water weave used to reject aqueous or wet-sediment ownership. */
  readonly snowPoints: readonly SnowpackBodyVfxPoint[];
  readonly snowProbe: SnowpackBodyVfxPoint;
  readonly waterProbe: SnowpackBodyVfxPoint;
}

export type SnowpackBodyVfxPowderStyle = 'smooth' | 'local' | 'grains';

type MaterialControl<M extends Material> = SnowpackBodyVfxRect & { readonly material: M };

export interface SnowpackBodyVfxAuditSnapshot {
  readonly version: 1;
  readonly world: { readonly width: 612; readonly height: 384 };
  readonly target: {
    readonly code: 'SNOW';
    /** Native Snow is exact projected material ID 18. */
    readonly material: Material.Snow;
    /** Broad paused, zero-velocity snowpack used by the canonical Smooth gate. */
    readonly body: SnowpackBodyVfxRect;
    readonly core: SnowpackBodyVfxRect;
    readonly crown: SnowpackBodyVfxRect;
    readonly pocket: SnowpackBodyVfxRect;
    readonly authoredHole: SnowpackBodyVfxRect;
    /** Empty channel deliberately reaches the upper silhouette. */
    readonly openChannel: SnowpackBodyVfxRect;
    readonly wallCoexistence: SnowpackBodyVfxWallPattern;
  };
  readonly fineTopology: {
    readonly column: SnowpackBodyVfxRect;
    readonly line: SnowpackBodyVfxRect;
    readonly isolated: SnowpackBodyVfxPoint;
  };
  /** Exact Snow with authored velocity; snowpack optics must reject it. */
  readonly movingControl: SnowpackBodyVfxRect & {
    readonly velocityX: 31;
    readonly velocityY: -17;
  };
  readonly suspensionControl: SnowpackBodyVfxSuspensionControl;
  /** The same semantic fixture is rerendered; Local and Grains are exact controls. */
  readonly powderStyleMatrix: readonly [
    { readonly style: 'smooth'; readonly expectation: 'target' },
    { readonly style: 'local'; readonly expectation: 'exact-no-op' },
    { readonly style: 'grains'; readonly expectation: 'exact-no-op' },
  ];
  readonly materialControls: {
    readonly salt: MaterialControl<Material.Salt>;
    readonly quartz: MaterialControl<Material.Quartz>;
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
    readonly metal: SnowpackBodyVfxBoundary;
    readonly water: SnowpackBodyVfxBoundary;
  };
  readonly guardedBlank: SnowpackBodyVfxRect;
  readonly conductiveWall: 1;
  /** Frozen semantic/native-plane cardinalities for the deterministic v1 fixture. */
  readonly expected: {
    readonly occupiedCells: 98_713;
    readonly snowCells: 62_841;
    readonly waterCells: 3_872;
    readonly metalCells: 1_280;
    readonly cellsPerMaterialControl: 3_072;
    readonly suspensionSnowCells: 5_184;
    readonly suspensionWaterCells: 2_592;
    readonly movingVelocityCells: 4_480;
    readonly wallCells: 2_048;
  };
}

const body = { x: 20, y: 20, width: 340, height: 150 } as const;
const wallCoexistence: SnowpackBodyVfxWallPattern = {
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
  code: SnowpackBodyVfxBoundary['code'], x: number,
  otherMaterial: SnowpackBodyVfxBoundary['otherMaterial'],
): SnowpackBodyVfxBoundary {
  const snow = { x, y: 196, width: 40, height: 40 };
  const other = { x: x + snow.width, y: snow.y, width: 32, height: snow.height };
  return {
    code,
    snow,
    other,
    otherMaterial,
    snowProbe: { x: snow.x + snow.width - 1, y: snow.y + 20 },
    otherProbe: { x: other.x, y: other.y + 20 },
  };
}

/**
 * Paused exact-owner contract for the E48 Snow snowpack experiment. The fixture
 * owns semantic matter, native walls, and signed velocity only; powder-style
 * selection and framebuffer comparisons remain browser-gate responsibilities.
 */
export const SNOWPACK_BODY_VFX_AUDIT: SnowpackBodyVfxAuditSnapshot = {
  version: 1,
  world: { width: WORLD_WIDTH, height: WORLD_HEIGHT },
  target: {
    code: 'SNOW',
    material: Material.Snow,
    body,
    core: { x: 48, y: 56, width: 48, height: 32 },
    // Adjacent broad regions sit on opposite inherited E05 facet lobes while
    // remaining far from the silhouette, authored openings, walls, and contacts.
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
    snowPoints: buildSuspendedSnowPoints(suspensionRegion),
    snowProbe: { x: 542, y: 56 },
    waterProbe: { x: 544, y: 56 },
  },
  powderStyleMatrix: [
    { style: 'smooth', expectation: 'target' },
    { style: 'local', expectation: 'exact-no-op' },
    { style: 'grains', expectation: 'exact-no-op' },
  ],
  materialControls: {
    salt: { x: 16, y: 196, width: 64, height: 48, material: Material.Salt },
    quartz: { x: 88, y: 196, width: 64, height: 48, material: Material.Quartz },
    bgla: { x: 160, y: 196, width: 64, height: 48, material: Material.BGLA },
    frzz: { x: 232, y: 196, width: 64, height: 48, material: Material.FRZZ },
    slcn: { x: 504, y: 196, width: 64, height: 48, material: Material.SLCN },
    sand: { x: 16, y: 260, width: 64, height: 48, material: Material.Sand },
    thermite: { x: 88, y: 260, width: 64, height: 48, material: Material.Thermite },
    c4: { x: 160, y: 260, width: 64, height: 48, material: Material.C4 },
    ice: { x: 232, y: 260, width: 64, height: 48, material: Material.Ice },
    qrtz: { x: 304, y: 260, width: 64, height: 48, material: Material.QRTZ },
  },
  contacts: {
    metal: boundary('SNOW_METL', 320, Material.Metal),
    water: boundary('SNOW_WATR', 416, Material.Water),
  },
  guardedBlank: { x: 16, y: 340, width: 560, height: 36 },
  conductiveWall: CONDUCTIVE_WALL,
  expected: {
    occupiedCells: 98_713,
    snowCells: 62_841,
    waterCells: 3_872,
    metalCells: 1_280,
    cellsPerMaterialControl: 3_072,
    suspensionSnowCells: 5_184,
    suspensionWaterCells: 2_592,
    movingVelocityCells: 4_480,
    wallCells: 2_048,
  },
};

interface SnowpackBodyVfxFixtureBackend extends SimulationBackend {
  paintWall(x: number, y: number, wall: number, radius: number): void;
  walls(): Uint8Array;
  velocity(): Int8Array;
  setFixtureVelocityRect(
    x: number, y: number, width: number, height: number,
    velocityX: number, velocityY: number,
  ): void;
}

/** Direct-fills the canonical paused RenderLab world without stepping physics. */
export function prepareSnowpackBodyVfxAuditFixture(simulation: SimulationBackend): void {
  if (!supportsFixture(simulation)) {
    throw new Error('Snowpack body VFX fixture requires a canonical RenderLab wall and velocity plane');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Snowpack body VFX fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  const fixture = SNOWPACK_BODY_VFX_AUDIT;

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
  for (const point of fixture.suspensionControl.snowPoints) {
    setPoint(cells, simulation.width, point, fixture.target.material);
  }
  for (const entry of Object.values(fixture.materialControls)) {
    fillRect(cells, simulation.width, entry, entry.material);
  }
  for (const entry of Object.values(fixture.contacts)) {
    fillRect(cells, simulation.width, entry.snow, fixture.target.material);
    fillRect(cells, simulation.width, entry.other, entry.otherMaterial);
  }
  fillRect(cells, simulation.width, fixture.guardedBlank, Material.Empty);
}

function supportsFixture(simulation: SimulationBackend): simulation is SnowpackBodyVfxFixtureBackend {
  const candidate = simulation as Partial<SnowpackBodyVfxFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.paintWall === 'function'
    && typeof candidate.velocity === 'function'
    && typeof candidate.setFixtureVelocityRect === 'function';
}

function paintWallPattern(
  simulation: SnowpackBodyVfxFixtureBackend,
  pattern: SnowpackBodyVfxWallPattern,
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

function buildSuspendedSnowPoints(rect: SnowpackBodyVfxRect): readonly SnowpackBodyVfxPoint[] {
  const points: SnowpackBodyVfxPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      if ((x - rect.x + y - rect.y) % 3 !== 2) points.push({ x, y });
    }
  }
  return points;
}

function fillRect(
  cells: Uint8Array, width: number, rect: SnowpackBodyVfxRect, material: Material,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * width + rect.x, y * width + rect.x + rect.width);
  }
}

function setPoint(
  cells: Uint8Array, width: number, point: SnowpackBodyVfxPoint, material: Material,
): void {
  cells[point.y * width + point.x] = material;
}
