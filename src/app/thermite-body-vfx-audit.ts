import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CONDUCTIVE_WALL = 1;
const WALL_BLOCK_SIZE = 4;

export interface ThermiteBodyVfxPoint { readonly x: number; readonly y: number }
export interface ThermiteBodyVfxRect extends ThermiteBodyVfxPoint {
  readonly width: number;
  readonly height: number;
}

/** Aligned native bmap checker; every semantic cell remains exact Thermite. */
export interface ThermiteBodyVfxWallPattern {
  readonly kind: 'native-wall-checker';
  readonly region: ThermiteBodyVfxRect;
  readonly blockSize: 4;
  readonly occupiedParity: 0;
  readonly wallProbe: ThermiteBodyVfxPoint;
  readonly clearProbe: ThermiteBodyVfxPoint;
}

export interface ThermiteBodyVfxBoundary {
  readonly code: 'THRM_METL' | 'THRM_WATR';
  readonly thermite: ThermiteBodyVfxRect;
  readonly other: ThermiteBodyVfxRect;
  readonly otherMaterial: Material.Metal | Material.Water;
  readonly thermiteProbe: ThermiteBodyVfxPoint;
  readonly otherProbe: ThermiteBodyVfxPoint;
}

export interface ThermiteBodyVfxWetControl {
  readonly region: ThermiteBodyVfxRect;
  /** Exact 2:1 Thermite/Water weave used to reject aqueous support. */
  readonly thermitePoints: readonly ThermiteBodyVfxPoint[];
  readonly thermiteProbe: ThermiteBodyVfxPoint;
  readonly waterProbe: ThermiteBodyVfxPoint;
}

export type ThermiteBodyVfxPowderStyle = 'smooth' | 'local' | 'grains';

export interface ThermiteBodyVfxAuditSnapshot {
  readonly version: 1;
  readonly world: { readonly width: 612; readonly height: 384 };
  readonly target: {
    readonly code: 'THRM';
    /** Native Thermite is exact projected material ID 30. */
    readonly material: Material.Thermite;
    /** Broad paused, zero-velocity body used by the canonical Smooth gate. */
    readonly body: ThermiteBodyVfxRect;
    readonly core: ThermiteBodyVfxRect;
    readonly crown: ThermiteBodyVfxRect;
    readonly pocket: ThermiteBodyVfxRect;
    readonly authoredHole: ThermiteBodyVfxRect;
    /** Empty channel deliberately reaches the upper silhouette. */
    readonly openChannel: ThermiteBodyVfxRect;
    readonly wallCoexistence: ThermiteBodyVfxWallPattern;
  };
  readonly fineTopology: {
    readonly column: ThermiteBodyVfxRect;
    readonly line: ThermiteBodyVfxRect;
    readonly isolated: ThermiteBodyVfxPoint;
  };
  /** Exact Thermite with authored velocity; body optics must reject it. */
  readonly movingControl: ThermiteBodyVfxRect & {
    readonly velocityX: 31;
    readonly velocityY: -17;
  };
  readonly wetControl: ThermiteBodyVfxWetControl;
  /** The same semantic fixture is rerendered; Local and Grains are exact controls. */
  readonly powderStyleMatrix: readonly [
    { readonly style: 'smooth'; readonly expectation: 'target' },
    { readonly style: 'local'; readonly expectation: 'exact-no-op' },
    { readonly style: 'grains'; readonly expectation: 'exact-no-op' },
  ];
  readonly siblingPowders: {
    readonly gunpowder: ThermiteBodyVfxRect & { readonly material: Material.Gunpowder };
    readonly bcol: ThermiteBodyVfxRect & { readonly material: Material.BCOL };
    readonly coal: ThermiteBodyVfxRect & { readonly material: Material.Coal };
    readonly sand: ThermiteBodyVfxRect & { readonly material: Material.Sand };
    readonly brec: ThermiteBodyVfxRect & { readonly material: Material.BREC };
    readonly brmt: ThermiteBodyVfxRect & { readonly material: Material.BRMT };
    readonly bvbr: ThermiteBodyVfxRect & { readonly material: Material.BVBR };
    readonly plut: ThermiteBodyVfxRect & { readonly material: Material.PLUT };
    readonly polo: ThermiteBodyVfxRect & { readonly material: Material.POLO };
    readonly uran: ThermiteBodyVfxRect & { readonly material: Material.URAN };
    readonly c4: ThermiteBodyVfxRect & { readonly material: Material.C4 };
    readonly salt: ThermiteBodyVfxRect & { readonly material: Material.Salt };
    readonly sing: ThermiteBodyVfxRect & { readonly material: Material.SING };
    readonly lith: ThermiteBodyVfxRect & { readonly material: Material.LITH };
    readonly rbdm: ThermiteBodyVfxRect & { readonly material: Material.RBDM };
  };
  readonly contacts: {
    readonly metal: ThermiteBodyVfxBoundary;
    readonly water: ThermiteBodyVfxBoundary;
  };
  readonly guardedBlank: ThermiteBodyVfxRect;
  readonly conductiveWall: 1;
}

const body = { x: 20, y: 20, width: 340, height: 150 } as const;
const wallCoexistence: ThermiteBodyVfxWallPattern = {
  kind: 'native-wall-checker',
  // 64x64 cells / 16-cell blocks / half occupied = exactly 2,048 bmap cells.
  region: { x: 288, y: 92, width: 64, height: 64 },
  blockSize: WALL_BLOCK_SIZE,
  occupiedParity: 0,
  wallProbe: { x: 289, y: 93 },
  clearProbe: { x: 293, y: 93 },
};

const wetRegion = { x: 488, y: 20, width: 108, height: 72 } as const;

function boundary(
  code: ThermiteBodyVfxBoundary['code'], x: number,
  otherMaterial: ThermiteBodyVfxBoundary['otherMaterial'],
): ThermiteBodyVfxBoundary {
  const thermite = { x, y: 196, width: 40, height: 40 };
  const other = { x: x + thermite.width, y: thermite.y, width: 32, height: thermite.height };
  return {
    code,
    thermite,
    other,
    otherMaterial,
    thermiteProbe: { x: thermite.x + thermite.width - 1, y: thermite.y + 20 },
    otherProbe: { x: other.x, y: other.y + 20 },
  };
}

/**
 * Paused exact-owner contract for the E45 Thermite body experiment. The fixture
 * owns semantic matter, native walls, and signed velocity only; powder-style
 * selection and framebuffer comparisons remain browser-gate responsibilities.
 */
export const THERMITE_BODY_VFX_AUDIT: ThermiteBodyVfxAuditSnapshot = {
  version: 1,
  world: { width: WORLD_WIDTH, height: WORLD_HEIGHT },
  target: {
    code: 'THRM',
    material: Material.Thermite,
    body,
    core: { x: 48, y: 56, width: 48, height: 32 },
    // These adjacent broad regions sit on opposite E05 static-facet lobes at
    // every output scale, with a two-cell semantic gap between them.
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
  wetControl: {
    region: wetRegion,
    thermitePoints: buildWetThermitePoints(wetRegion),
    thermiteProbe: { x: 542, y: 56 },
    waterProbe: { x: 544, y: 56 },
  },
  powderStyleMatrix: [
    { style: 'smooth', expectation: 'target' },
    { style: 'local', expectation: 'exact-no-op' },
    { style: 'grains', expectation: 'exact-no-op' },
  ],
  siblingPowders: {
    gunpowder: { x: 16, y: 196, width: 64, height: 48, material: Material.Gunpowder },
    bcol: { x: 88, y: 196, width: 64, height: 48, material: Material.BCOL },
    coal: { x: 160, y: 196, width: 64, height: 48, material: Material.Coal },
    sand: { x: 232, y: 196, width: 64, height: 48, material: Material.Sand },
    // One final upper-row card and eight lower-row cards preserve the existing
    // target, wet weave, fine topology, contacts, and guarded-blank geometry.
    brec: { x: 504, y: 196, width: 64, height: 48, material: Material.BREC },
    brmt: { x: 16, y: 260, width: 64, height: 48, material: Material.BRMT },
    bvbr: { x: 88, y: 260, width: 64, height: 48, material: Material.BVBR },
    plut: { x: 160, y: 260, width: 64, height: 48, material: Material.PLUT },
    polo: { x: 232, y: 260, width: 64, height: 48, material: Material.POLO },
    uran: { x: 304, y: 260, width: 64, height: 48, material: Material.URAN },
    c4: { x: 376, y: 260, width: 64, height: 48, material: Material.C4 },
    salt: { x: 448, y: 260, width: 64, height: 48, material: Material.Salt },
    sing: { x: 520, y: 260, width: 64, height: 48, material: Material.SING },
    // Same native ReactiveMetal explosive family as Thermite; 24 rows still
    // contain a broad, fully settled interior while preserving the blank band.
    lith: { x: 16, y: 312, width: 64, height: 24, material: Material.LITH },
    rbdm: { x: 88, y: 312, width: 64, height: 24, material: Material.RBDM },
  },
  contacts: {
    metal: boundary('THRM_METL', 320, Material.Metal),
    water: boundary('THRM_WATR', 416, Material.Water),
  },
  guardedBlank: { x: 16, y: 340, width: 560, height: 36 },
  conductiveWall: CONDUCTIVE_WALL,
};

interface ThermiteBodyVfxFixtureBackend extends SimulationBackend {
  paintWall(x: number, y: number, wall: number, radius: number): void;
  walls(): Uint8Array;
  velocity(): Int8Array;
  setFixtureVelocityRect(
    x: number, y: number, width: number, height: number,
    velocityX: number, velocityY: number,
  ): void;
}

/** Direct-fills the canonical paused RenderLab world without stepping physics. */
export function prepareThermiteBodyVfxAuditFixture(simulation: SimulationBackend): void {
  if (!supportsFixture(simulation)) {
    throw new Error('Thermite body VFX fixture requires a canonical RenderLab wall and velocity plane');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Thermite body VFX fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  const fixture = THERMITE_BODY_VFX_AUDIT;

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

  fillRect(cells, simulation.width, fixture.wetControl.region, Material.Water);
  for (const point of fixture.wetControl.thermitePoints) {
    setPoint(cells, simulation.width, point, fixture.target.material);
  }
  for (const entry of Object.values(fixture.siblingPowders)) {
    fillRect(cells, simulation.width, entry, entry.material);
  }
  for (const entry of Object.values(fixture.contacts)) {
    fillRect(cells, simulation.width, entry.thermite, fixture.target.material);
    fillRect(cells, simulation.width, entry.other, entry.otherMaterial);
  }
  fillRect(cells, simulation.width, fixture.guardedBlank, Material.Empty);
}

function supportsFixture(simulation: SimulationBackend): simulation is ThermiteBodyVfxFixtureBackend {
  const candidate = simulation as Partial<ThermiteBodyVfxFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.paintWall === 'function'
    && typeof candidate.velocity === 'function'
    && typeof candidate.setFixtureVelocityRect === 'function';
}

function paintWallPattern(
  simulation: ThermiteBodyVfxFixtureBackend,
  pattern: ThermiteBodyVfxWallPattern,
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

function buildWetThermitePoints(rect: ThermiteBodyVfxRect): readonly ThermiteBodyVfxPoint[] {
  const points: ThermiteBodyVfxPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      if ((x - rect.x + y - rect.y) % 3 !== 2) points.push({ x, y });
    }
  }
  return points;
}

function fillRect(
  cells: Uint8Array, width: number, rect: ThermiteBodyVfxRect, material: Material,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * width + rect.x, y * width + rect.x + rect.width);
  }
}

function setPoint(
  cells: Uint8Array, width: number, point: ThermiteBodyVfxPoint, material: Material,
): void {
  cells[point.y * width + point.x] = material;
}
