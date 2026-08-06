import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CONDUCTIVE_WALL = 1;
const WALL_BLOCK_SIZE = 4;

export interface SootyPowderBodyVfxPoint { readonly x: number; readonly y: number }
export interface SootyPowderBodyVfxRect extends SootyPowderBodyVfxPoint {
  readonly width: number;
  readonly height: number;
}

/** Aligned bmap pattern; matter remains the exact target owner throughout. */
export interface SootyPowderBodyVfxWallPattern {
  readonly kind: 'native-wall-checker';
  readonly region: SootyPowderBodyVfxRect;
  readonly blockSize: 4;
  readonly occupiedParity: 0;
  readonly wallProbe: SootyPowderBodyVfxPoint;
  readonly clearProbe: SootyPowderBodyVfxPoint;
}

export interface SootyPowderBodyVfxTarget {
  readonly code: 'GUNP' | 'BCOL';
  /** Exact powder owners, never broad explosive/granular categories. */
  readonly material: Material.Gunpowder | Material.BCOL;
  readonly card: SootyPowderBodyVfxRect;
  readonly body: SootyPowderBodyVfxRect;
  /** Shallow stable body probe near the crown, but off the silhouette. */
  readonly crown: SootyPowderBodyVfxRect;
  /** Stable broad interior used for the absorptive pocket calibration. */
  readonly pocket: SootyPowderBodyVfxRect;
  /** Stable deep interior target. */
  readonly core: SootyPowderBodyVfxRect;
  readonly authoredHole: SootyPowderBodyVfxRect;
  /** Empty channel deliberately opening at the upper silhouette. */
  readonly openChimney: SootyPowderBodyVfxRect;
  /** Fine semantic powder topology, intentionally not a broad body. */
  readonly thinColumn: SootyPowderBodyVfxRect;
  readonly isolated: SootyPowderBodyVfxPoint;
  /** Exact target material with authored paused velocity; must remain excluded. */
  readonly unstable: SootyPowderBodyVfxRect & { readonly velocityX: number; readonly velocityY: number };
  readonly backing: { readonly kind: 'air' } | SootyPowderBodyVfxWallPattern;
}

export type SootyPowderBodyVfxControlMaterial = Material.Coal | Material.Sand | Material.Salt
  | Material.Thermite | Material.C4 | Material.BREC | Material.BRMT | Material.SING;

export interface SootyPowderBodyVfxBoundary {
  readonly code: 'SAND_WATER' | 'GUNP_METL' | 'BCOL_FIRE';
  readonly target: SootyPowderBodyVfxRect;
  readonly other: SootyPowderBodyVfxRect;
  readonly targetMaterial: Material.Sand | Material.Gunpowder | Material.BCOL;
  readonly otherMaterial: Material.Water | Material.Metal | Material.Fire;
  readonly targetProbe: SootyPowderBodyVfxPoint;
  readonly otherProbe: SootyPowderBodyVfxPoint;
}

export interface SootyPowderBodyVfxWetTarget {
  readonly code: 'WET_GUNP' | 'WET_BCOL';
  readonly material: Material.Gunpowder | Material.BCOL;
  readonly region: SootyPowderBodyVfxRect;
  readonly powderPoints: readonly SootyPowderBodyVfxPoint[];
  readonly centre: SootyPowderBodyVfxPoint;
}

export interface SootyPowderBodyVfxAuditSnapshot {
  readonly targets: readonly SootyPowderBodyVfxTarget[];
  /** Exact owner and granular-family control cards, intentionally disjoint. */
  readonly materialControls: {
    readonly coal: SootyPowderBodyVfxRect & { readonly material: Material.Coal };
    readonly sand: SootyPowderBodyVfxRect & { readonly material: Material.Sand };
    readonly salt: SootyPowderBodyVfxRect & { readonly material: Material.Salt };
    readonly thermite: SootyPowderBodyVfxRect & { readonly material: Material.Thermite };
    readonly c4: SootyPowderBodyVfxRect & { readonly material: Material.C4 };
    readonly brec: SootyPowderBodyVfxRect & { readonly material: Material.BREC };
    readonly brmt: SootyPowderBodyVfxRect & { readonly material: Material.BRMT };
    readonly sing: SootyPowderBodyVfxRect & { readonly material: Material.SING };
  };
  readonly wetSandWater: SootyPowderBodyVfxBoundary;
  /** Genuine 2:1 one-cell Sand/Water weave for suspension-field rejection. */
  readonly wetMixture: {
    readonly region: SootyPowderBodyVfxRect;
    readonly sandPoints: readonly SootyPowderBodyVfxPoint[];
    readonly centre: SootyPowderBodyVfxPoint;
  };
  /** Exact sooty owners in genuine aqueous support; E40 must remain dry-only. */
  readonly wetTargets: {
    readonly gunpowder: SootyPowderBodyVfxWetTarget;
    readonly bcol: SootyPowderBodyVfxWetTarget;
  };
  readonly contacts: {
    readonly gunpowderMetal: SootyPowderBodyVfxBoundary;
    readonly bcolFire: SootyPowderBodyVfxBoundary;
  };
  readonly guardedBlank: SootyPowderBodyVfxRect;
  readonly conductiveWall: number;
}

const target = (
  code: SootyPowderBodyVfxTarget['code'],
  material: SootyPowderBodyVfxTarget['material'],
  baseX: number,
  backing: SootyPowderBodyVfxTarget['backing'],
): SootyPowderBodyVfxTarget => {
  const body = { x: baseX + 12, y: 20, width: 224, height: 142 };
  const crown = code === 'GUNP'
    ? { x: body.x + 120, y: body.y + 28, width: 16, height: 10 }
    : { x: body.x + 112, y: body.y + 64, width: 16, height: 10 };
  const pocket = code === 'GUNP'
    ? { x: body.x + 176, y: body.y + 84, width: 16, height: 10 }
    : { x: body.x + 44, y: body.y + 88, width: 16, height: 10 };
  return {
    code,
    material,
    card: { x: baseX, y: 8, width: 280, height: 176 },
    body,
    crown,
    pocket,
    core: { x: body.x + 160, y: body.y + 38, width: 42, height: 28 },
    authoredHole: { x: body.x + 92, y: body.y + 62, width: 14, height: 14 },
    openChimney: { x: body.x + 142, y: body.y, width: 12, height: 58 },
    thinColumn: { x: baseX + 260, y: 28, width: 1, height: 86 },
    isolated: { x: baseX + 268, y: 128 },
    // Keep this wall-free for both owners so the exclusion proves authored
    // motion independently of the BCOL native-wall control.
    unstable: { x: body.x + 72, y: body.y + 108, width: 24, height: 30, velocityX: 37, velocityY: -19 },
    backing,
  };
};

const bcolWallChecker: SootyPowderBodyVfxWallPattern = {
  kind: 'native-wall-checker',
  // 96x64 cells / 16-cell blocks / half occupied = exactly 3,072 bmap cells.
  region: { x: 440, y: 96, width: 96, height: 64 },
  blockSize: WALL_BLOCK_SIZE,
  occupiedParity: 0,
  wallProbe: { x: 441, y: 97 },
  clearProbe: { x: 445, y: 97 },
};

const boundary = (
  code: SootyPowderBodyVfxBoundary['code'], x: number,
  targetMaterial: SootyPowderBodyVfxBoundary['targetMaterial'],
  otherMaterial: SootyPowderBodyVfxBoundary['otherMaterial'],
): SootyPowderBodyVfxBoundary => ({
  code,
  target: { x, y: 276, width: 28, height: 36 },
  other: { x: x + 28, y: 276, width: 28, height: 36 },
  targetMaterial,
  otherMaterial,
  targetProbe: { x: x + 27, y: 294 },
  otherProbe: { x: x + 28, y: 294 },
});

const wetTarget = (
  code: SootyPowderBodyVfxWetTarget['code'], x: number,
  material: SootyPowderBodyVfxWetTarget['material'],
): SootyPowderBodyVfxWetTarget => ({
  code,
  material,
  region: { x, y: 276, width: 80, height: 36 },
  powderPoints: buildWetPowderPoints(x, 276, 80, 36),
  centre: { x: x + 40, y: 294 },
});

/**
 * Paused exact-owner material plane for E40 sooty-powder body experiments.
 * The fixture owns semantic matter, bmap, and paused velocity only; selector
 * changes and all framebuffer assertions remain browser-gate responsibilities.
 */
export const SOOTY_POWDER_BODY_VFX_AUDIT: SootyPowderBodyVfxAuditSnapshot = {
  targets: [
    target('GUNP', Material.Gunpowder, 16, { kind: 'air' }),
    target('BCOL', Material.BCOL, 316, bcolWallChecker),
  ],
  materialControls: {
    coal: { x: 8, y: 200, width: 64, height: 48, material: Material.Coal },
    sand: { x: 80, y: 200, width: 64, height: 48, material: Material.Sand },
    salt: { x: 152, y: 200, width: 64, height: 48, material: Material.Salt },
    thermite: { x: 224, y: 200, width: 64, height: 48, material: Material.Thermite },
    c4: { x: 296, y: 200, width: 64, height: 48, material: Material.C4 },
    brec: { x: 368, y: 200, width: 64, height: 48, material: Material.BREC },
    brmt: { x: 440, y: 200, width: 64, height: 48, material: Material.BRMT },
    sing: { x: 512, y: 200, width: 64, height: 48, material: Material.SING },
  },
  wetSandWater: boundary('SAND_WATER', 16, Material.Sand, Material.Water),
  wetMixture: {
    region: { x: 280, y: 276, width: 120, height: 36 },
    sandPoints: buildWetPowderPoints(280, 276, 120, 36),
    centre: { x: 340, y: 294 },
  },
  wetTargets: {
    gunpowder: wetTarget('WET_GUNP', 416, Material.Gunpowder),
    bcol: wetTarget('WET_BCOL', 512, Material.BCOL),
  },
  contacts: {
    gunpowderMetal: boundary('GUNP_METL', 104, Material.Gunpowder, Material.Metal),
    bcolFire: boundary('BCOL_FIRE', 192, Material.BCOL, Material.Fire),
  },
  guardedBlank: { x: 16, y: 336, width: 560, height: 40 },
  conductiveWall: CONDUCTIVE_WALL,
};

interface SootyPowderBodyFixtureBackend extends SimulationBackend {
  paintWall(x: number, y: number, wall: number, radius: number): void;
  walls(): Uint8Array;
  velocity(): Int8Array;
  setFixtureVelocityRect(x: number, y: number, width: number, height: number, velocityX: number, velocityY: number): void;
}

/** Direct-fills the paused canonical RenderLab world without brush or physics steps. */
export function prepareSootyPowderBodyVfxFixture(simulation: SimulationBackend): void {
  if (!supportsFixture(simulation)) {
    throw new Error('Sooty powder body VFX fixture requires a canonical RenderLab wall and velocity plane');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Sooty powder body VFX fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of SOOTY_POWDER_BODY_VFX_AUDIT.targets) {
    fillRect(cells, simulation.width, entry.body, entry.material);
    fillRect(cells, simulation.width, entry.authoredHole, Material.Empty);
    fillRect(cells, simulation.width, entry.openChimney, Material.Empty);
    fillRect(cells, simulation.width, entry.thinColumn, entry.material);
    setPoint(cells, simulation.width, entry.isolated, entry.material);
    fillRect(cells, simulation.width, entry.unstable, entry.material);
    simulation.setFixtureVelocityRect(
      entry.unstable.x, entry.unstable.y, entry.unstable.width, entry.unstable.height,
      entry.unstable.velocityX, entry.unstable.velocityY,
    );
    if (entry.backing.kind === 'native-wall-checker') paintWallPattern(simulation, entry.backing);
  }
  const {
    materialControls, wetSandWater, wetMixture, wetTargets, contacts,
  } = SOOTY_POWDER_BODY_VFX_AUDIT;
  for (const entry of Object.values(materialControls)) fillRect(cells, simulation.width, entry, entry.material);
  for (const entry of [wetSandWater, ...Object.values(contacts)]) {
    fillRect(cells, simulation.width, entry.target, entry.targetMaterial);
    fillRect(cells, simulation.width, entry.other, entry.otherMaterial);
  }
  fillRect(cells, simulation.width, wetMixture.region, Material.Water);
  for (const point of wetMixture.sandPoints) {
    setPoint(cells, simulation.width, point, Material.Sand);
  }
  for (const entry of Object.values(wetTargets)) {
    fillRect(cells, simulation.width, entry.region, Material.Water);
    for (const point of entry.powderPoints) {
      setPoint(cells, simulation.width, point, entry.material);
    }
  }
  fillRect(cells, simulation.width, SOOTY_POWDER_BODY_VFX_AUDIT.guardedBlank, Material.Empty);
}

function supportsFixture(simulation: SimulationBackend): simulation is SootyPowderBodyFixtureBackend {
  const candidate = simulation as Partial<SootyPowderBodyFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.paintWall === 'function'
    && typeof candidate.velocity === 'function' && typeof candidate.setFixtureVelocityRect === 'function';
}

function paintWallPattern(simulation: SootyPowderBodyFixtureBackend, pattern: SootyPowderBodyVfxWallPattern): void {
  for (let offsetY = 0; offsetY < pattern.region.height; offsetY += WALL_BLOCK_SIZE) {
    for (let offsetX = 0; offsetX < pattern.region.width; offsetX += WALL_BLOCK_SIZE) {
      if ((offsetX / WALL_BLOCK_SIZE + offsetY / WALL_BLOCK_SIZE) % 2 !== pattern.occupiedParity) continue;
      simulation.paintWall(pattern.region.x + offsetX, pattern.region.y + offsetY, CONDUCTIVE_WALL, 0);
    }
  }
}

function fillRect(cells: Uint8Array, width: number, rect: SootyPowderBodyVfxRect, material: Material): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * width + rect.x, y * width + rect.x + rect.width);
  }
}

function setPoint(cells: Uint8Array, width: number, point: SootyPowderBodyVfxPoint, material: Material): void {
  cells[point.y * width + point.x] = material;
}

function buildWetPowderPoints(
  x: number, y: number, width: number, height: number,
): readonly SootyPowderBodyVfxPoint[] {
  const points: SootyPowderBodyVfxPoint[] = [];
  for (let py = y; py < y + height; py++) for (let px = x; px < x + width; px++) {
    if ((px - x + py - y) % 3 !== 2) points.push({ x: px, y: py });
  }
  return points;
}
