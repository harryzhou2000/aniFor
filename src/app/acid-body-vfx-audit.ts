import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CONDUCTIVE_WALL = 1;
const WALL_BLOCK_SIZE = 4;

export interface AcidBodyVfxPoint { readonly x: number; readonly y: number }
export interface AcidBodyVfxRect extends AcidBodyVfxPoint {
  readonly width: number;
  readonly height: number;
}

export interface AcidBodyVfxWallPattern {
  readonly kind: 'native-wall-checker';
  /** Exact Acid remains authoritative at every co-located native wall cell. */
  readonly region: AcidBodyVfxRect;
  readonly blockSize: 4;
  readonly occupiedParity: 0;
  readonly wallProbe: AcidBodyVfxPoint;
  readonly clearProbe: AcidBodyVfxPoint;
}

export interface AcidBodyVfxPane {
  readonly code: 'OPEN_POOL' | 'WALL_CONTROL';
  /** Native Acid is material 13; SaltWater is independently material 16. */
  readonly material: Material.Acid;
  readonly body: AcidBodyVfxRect;
  readonly backing: { readonly kind: 'air' } | AcidBodyVfxWallPattern;
  /** Exact vertical liquid optical-depth byte 0. */
  readonly surfaceLayer: AcidBodyVfxRect;
  /** Exact vertical liquid optical-depth byte 6. */
  readonly firstInnerLayer: AcidBodyVfxRect;
  /** Exact vertical liquid optical-depth bytes 12--30. */
  readonly shallowBand: AcidBodyVfxRect;
  /** Exact vertical liquid optical-depth bytes 36--66. */
  readonly transitionBand: AcidBodyVfxRect;
  /** Exact vertical liquid optical-depth bytes 72--126. */
  readonly midBand: AcidBodyVfxRect;
  /** Exact vertical liquid optical-depth bytes 192--255. */
  readonly deepCore: AcidBodyVfxRect;
  readonly authoredHole: AcidBodyVfxRect;
  readonly openChimney: AcidBodyVfxRect;
  /** Enclosed Empty may reconstruct in the shared liquid field, never semantically. */
  readonly reconstructablePinhole: AcidBodyVfxPoint;
}

export type AcidBodyVfxOtherMaterial = Material.SaltWater | Material.Water | Material.Oil
  | Material.Lava | Material.BASE | Material.Glass | Material.Metal | Material.Sand | Material.Smoke;

export interface AcidBodyVfxBoundary {
  readonly code: 'ACID_SLTW' | 'ACID_WATR' | 'ACID_OIL' | 'ACID_LAVA' | 'ACID_BASE'
    | 'ACID_GLAS' | 'ACID_METL' | 'ACID_SAND' | 'ACID_SMKE';
  readonly acid: AcidBodyVfxRect;
  readonly other: AcidBodyVfxRect;
  readonly otherMaterial: AcidBodyVfxOtherMaterial;
  readonly acidProbe: AcidBodyVfxPoint;
  readonly otherProbe: AcidBodyVfxPoint;
}

export interface AcidBodyVfxAuditSnapshot {
  readonly panes: readonly AcidBodyVfxPane[];
  readonly sparse: {
    readonly thinStrand: AcidBodyVfxRect;
    readonly droplet: AcidBodyVfxRect;
    readonly isolated: AcidBodyVfxPoint;
  };
  /** Exact-material and reactive-family controls for an Acid-only finish. */
  readonly materialControls: {
    readonly saltWater: AcidBodyVfxRect & { readonly material: Material.SaltWater };
    readonly water: AcidBodyVfxRect & { readonly material: Material.Water };
    readonly oil: AcidBodyVfxRect & { readonly material: Material.Oil };
    readonly lava: AcidBodyVfxRect & { readonly material: Material.Lava };
    readonly base: AcidBodyVfxRect & { readonly material: Material.BASE };
    readonly distilledWater: AcidBodyVfxRect & { readonly material: Material.DistilledWater };
  };
  readonly seams: {
    readonly acidSaltWater: AcidBodyVfxBoundary;
    readonly acidWater: AcidBodyVfxBoundary;
    readonly acidOil: AcidBodyVfxBoundary;
    readonly acidLava: AcidBodyVfxBoundary;
    readonly acidBase: AcidBodyVfxBoundary;
  };
  readonly contacts: {
    readonly acidGlass: AcidBodyVfxBoundary;
    readonly acidMetal: AcidBodyVfxBoundary;
    readonly acidSand: AcidBodyVfxBoundary;
    readonly acidSmoke: AcidBodyVfxBoundary;
  };
  readonly guardedBlank: AcidBodyVfxRect;
  readonly conductiveWall: number;
}

const pane = (
  code: AcidBodyVfxPane['code'],
  x: number,
  backing: AcidBodyVfxPane['backing'],
): AcidBodyVfxPane => {
  const y = 16;
  const body = { x, y, width: 264, height: 176 };
  const calibrationX = x + 20;
  return {
    code,
    material: Material.Acid,
    body,
    backing,
    // Wall-free calibration columns make the exact top-edge distance the only
    // contributor to each optical-depth byte range.
    surfaceLayer: { x: calibrationX, y, width: 64, height: 1 },
    firstInnerLayer: { x: calibrationX, y: y + 1, width: 64, height: 1 },
    shallowBand: { x: calibrationX, y: y + 2, width: 64, height: 4 },
    transitionBand: { x: calibrationX, y: y + 6, width: 64, height: 6 },
    midBand: { x: calibrationX, y: y + 12, width: 64, height: 10 },
    deepCore: { x: calibrationX, y: y + 32, width: 64, height: 28 },
    authoredHole: { x: x + 108, y: y + 72, width: 16, height: 16 },
    openChimney: { x: x + 136, y, width: 12, height: 72 },
    reconstructablePinhole: { x: x + 176, y: y + 120 },
  };
};

const wallPattern: AcidBodyVfxWallPattern = {
  kind: 'native-wall-checker',
  // Half of the 96x64 aligned 4x4 blocks are walls: exactly 3,072 cells.
  // This begins at the Acid surface; the calibration columns remain clear.
  region: { x: 484, y: 16, width: 96, height: 64 },
  blockSize: WALL_BLOCK_SIZE,
  occupiedParity: 0,
  wallProbe: { x: 485, y: 17 },
  clearProbe: { x: 489, y: 17 },
};

const boundary = (
  code: AcidBodyVfxBoundary['code'],
  x: number,
  otherMaterial: AcidBodyVfxOtherMaterial,
): AcidBodyVfxBoundary => ({
  code,
  acid: { x, y: 292, width: 32, height: 32 },
  other: { x: x + 32, y: 292, width: 32, height: 32 },
  otherMaterial,
  acidProbe: { x: x + 31, y: 308 },
  otherProbe: { x: x + 32, y: 308 },
});

/**
 * Paused native Acid scene for the E39 body-optics experiment. This fixture
 * owns matter and bmap topology only; selectors and framebuffer assertions are
 * deliberately left to the browser gate.
 */
export const ACID_BODY_VFX_AUDIT: AcidBodyVfxAuditSnapshot = {
  panes: [
    pane('OPEN_POOL', 16, { kind: 'air' }),
    pane('WALL_CONTROL', 332, wallPattern),
  ],
  sparse: {
    thinStrand: { x: 304, y: 20, width: 1, height: 96 },
    droplet: { x: 296, y: 132, width: 4, height: 4 },
    isolated: { x: 312, y: 160 },
  },
  materialControls: {
    saltWater: { x: 8, y: 208, width: 72, height: 64, material: Material.SaltWater },
    water: { x: 96, y: 208, width: 72, height: 64, material: Material.Water },
    oil: { x: 184, y: 208, width: 72, height: 64, material: Material.Oil },
    lava: { x: 272, y: 208, width: 72, height: 64, material: Material.Lava },
    base: { x: 360, y: 208, width: 72, height: 64, material: Material.BASE },
    distilledWater: {
      x: 448, y: 208, width: 72, height: 64, material: Material.DistilledWater,
    },
  },
  seams: {
    acidSaltWater: boundary('ACID_SLTW', 16, Material.SaltWater),
    acidWater: boundary('ACID_WATR', 80, Material.Water),
    acidOil: boundary('ACID_OIL', 144, Material.Oil),
    acidLava: boundary('ACID_LAVA', 208, Material.Lava),
    acidBase: boundary('ACID_BASE', 272, Material.BASE),
  },
  contacts: {
    acidGlass: boundary('ACID_GLAS', 336, Material.Glass),
    acidMetal: boundary('ACID_METL', 400, Material.Metal),
    acidSand: boundary('ACID_SAND', 464, Material.Sand),
    acidSmoke: boundary('ACID_SMKE', 528, Material.Smoke),
  },
  guardedBlank: { x: 16, y: 344, width: 560, height: 32 },
  conductiveWall: CONDUCTIVE_WALL,
};

interface AcidBodyFixtureBackend extends SimulationBackend {
  paintWall(x: number, y: number, wall: number, radius: number): void;
  walls(): Uint8Array;
}

/** Direct-fills the paused RenderLab backend without brush or physics steps. */
export function prepareAcidBodyVfxFixture(simulation: SimulationBackend): void {
  if (!supportsFixture(simulation)) {
    throw new Error('Acid body VFX fixture requires a RenderLab native wall plane');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Acid body VFX fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of ACID_BODY_VFX_AUDIT.panes) {
    fillRect(cells, simulation.width, entry.body, Material.Acid);
    fillRect(cells, simulation.width, entry.authoredHole, Material.Empty);
    fillRect(cells, simulation.width, entry.openChimney, Material.Empty);
    setPoint(cells, simulation.width, entry.reconstructablePinhole, Material.Empty);
    if (entry.backing.kind === 'native-wall-checker') paintWallPattern(simulation, entry.backing);
  }
  const { sparse, materialControls, seams, contacts } = ACID_BODY_VFX_AUDIT;
  fillRect(cells, simulation.width, sparse.thinStrand, Material.Acid);
  fillRect(cells, simulation.width, sparse.droplet, Material.Acid);
  setPoint(cells, simulation.width, sparse.isolated, Material.Acid);
  for (const entry of Object.values(materialControls)) fillRect(cells, simulation.width, entry, entry.material);
  for (const entry of [...Object.values(seams), ...Object.values(contacts)]) {
    fillRect(cells, simulation.width, entry.acid, Material.Acid);
    fillRect(cells, simulation.width, entry.other, entry.otherMaterial);
  }
  fillRect(cells, simulation.width, ACID_BODY_VFX_AUDIT.guardedBlank, Material.Empty);
}

function supportsFixture(simulation: SimulationBackend): simulation is AcidBodyFixtureBackend {
  const candidate = simulation as Partial<AcidBodyFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.paintWall === 'function';
}

function paintWallPattern(simulation: AcidBodyFixtureBackend, pattern: AcidBodyVfxWallPattern): void {
  for (let offsetY = 0; offsetY < pattern.region.height; offsetY += WALL_BLOCK_SIZE) {
    for (let offsetX = 0; offsetX < pattern.region.width; offsetX += WALL_BLOCK_SIZE) {
      if ((offsetX / WALL_BLOCK_SIZE + offsetY / WALL_BLOCK_SIZE) % 2 !== pattern.occupiedParity) continue;
      simulation.paintWall(pattern.region.x + offsetX, pattern.region.y + offsetY, CONDUCTIVE_WALL, 0);
    }
  }
}

function fillRect(cells: Uint8Array, width: number, rect: AcidBodyVfxRect, material: Material): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * width + rect.x, y * width + rect.x + rect.width);
  }
}

function setPoint(cells: Uint8Array, width: number, point: AcidBodyVfxPoint, material: Material): void {
  cells[point.y * width + point.x] = material;
}
