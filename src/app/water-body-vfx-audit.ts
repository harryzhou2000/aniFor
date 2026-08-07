import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CONDUCTIVE_WALL = 1;
const WALL_BLOCK_SIZE = 4;

export interface WaterBodyVfxPoint { readonly x: number; readonly y: number }
export interface WaterBodyVfxRect extends WaterBodyVfxPoint {
  readonly width: number;
  readonly height: number;
}

export interface WaterBodyVfxWallPattern {
  readonly kind: 'native-wall-checker';
  /** Exact Water remains authoritative throughout this co-located wall region. */
  readonly region: WaterBodyVfxRect;
  readonly blockSize: 4;
  /** Local 4x4 blocks with (column + row) % 2 === occupiedParity own the wall. */
  readonly occupiedParity: 0;
  readonly wallProbe: WaterBodyVfxPoint;
  readonly clearProbe: WaterBodyVfxPoint;
}

export interface WaterBodyVfxPane {
  readonly code: 'OPEN_POOL' | 'WALL_CONTROL';
  readonly material: Material.Water;
  readonly body: WaterBodyVfxRect;
  readonly backing: { readonly kind: 'air' } | WaterBodyVfxWallPattern;
  /** Exact exposed row; its vertical liquid-optical-depth byte is zero. */
  readonly surfaceLayer: WaterBodyVfxRect;
  /** Protected first interior row, exact liquid-optical-depth byte 6. */
  readonly firstInnerLayer: WaterBodyVfxRect;
  /** Existing liquid-body hand-off band, exact depth bytes 12--30. */
  readonly shallowBand: WaterBodyVfxRect;
  /** Candidate Water-body transition, exact depth bytes 36--66. */
  readonly transitionBand: WaterBodyVfxRect;
  /** Intermediate Water-body range, exact depth bytes 72--126. */
  readonly midBand: WaterBodyVfxRect;
  /** Broad exact-Water core spanning exact depth bytes 192--255. */
  readonly deepCore: WaterBodyVfxRect;
  /** Exact first deep-body row at vertical liquid-optical-depth byte 192. */
  readonly deepEntry: WaterBodyVfxRect;
  /** Four-row deep-body ramp spanning exact depth bytes 198--216. */
  readonly deepRamp: WaterBodyVfxRect;
  /** Fully saturated lower deep-body rows at exact depth byte 255. */
  readonly saturatedCore: WaterBodyVfxRect;
  /** Authored multi-cell air remains open instead of becoming Water support. */
  readonly authoredHole: WaterBodyVfxRect;
  /** Authored air path open from the top silhouette into the body. */
  readonly openChimney: WaterBodyVfxRect;
  /** Enclosed Empty cell which the shared liquid field may reconstruct visually. */
  readonly reconstructablePinhole: WaterBodyVfxPoint;
}

export type WaterBodyVfxOtherMaterial = Material.SaltWater | Material.Oil
  | Material.Glass | Material.Metal | Material.Sand | Material.Smoke;

export interface WaterBodyVfxBoundary {
  readonly code: 'WATR_SLTW' | 'WATR_OIL' | 'WATR_GLAS'
    | 'WATR_METL' | 'WATR_SAND' | 'WATR_SMKE';
  readonly water: WaterBodyVfxRect;
  readonly other: WaterBodyVfxRect;
  readonly otherMaterial: WaterBodyVfxOtherMaterial;
  readonly waterProbe: WaterBodyVfxPoint;
  readonly otherProbe: WaterBodyVfxPoint;
}

export interface WaterBodyVfxAuditSnapshot {
  readonly panes: readonly WaterBodyVfxPane[];
  readonly sparse: {
    readonly thinStrand: WaterBodyVfxRect;
    readonly droplet: WaterBodyVfxRect;
    readonly isolated: WaterBodyVfxPoint;
  };
  /** Aqueous peers prove that an exact-Water effect cannot follow optics alone. */
  readonly materialControls: {
    readonly saltWater: WaterBodyVfxRect & { readonly material: Material.SaltWater };
    readonly distilledWater: WaterBodyVfxRect & { readonly material: Material.DistilledWater };
    readonly deut: WaterBodyVfxRect & { readonly material: Material.DEUT };
    readonly oil: WaterBodyVfxRect & { readonly material: Material.Oil };
    readonly acid: WaterBodyVfxRect & { readonly material: Material.Acid };
    readonly lava: WaterBodyVfxRect & { readonly material: Material.Lava };
  };
  readonly seams: {
    readonly waterSaltWater: WaterBodyVfxBoundary;
    readonly waterOil: WaterBodyVfxBoundary;
  };
  readonly contacts: {
    readonly waterGlass: WaterBodyVfxBoundary;
    readonly waterMetal: WaterBodyVfxBoundary;
    readonly waterSand: WaterBodyVfxBoundary;
    readonly waterSmoke: WaterBodyVfxBoundary;
  };
  readonly guardedBlank: WaterBodyVfxRect;
  readonly conductiveWall: number;
}

const pane = (
  code: WaterBodyVfxPane['code'],
  x: number,
  backing: WaterBodyVfxPane['backing'],
): WaterBodyVfxPane => {
  const y = 16;
  const body = { x, y, width: 264, height: 176 };
  const calibrationX = x + 20;
  const deepCore = { x: calibrationX, y: y + 32, width: 64, height: 28 };
  return {
    code,
    material: Material.Water,
    body,
    backing,
    // Every calibration rectangle occupies the same wall-free columns. Vertical
    // distance from the exact top row therefore determines its depth byte alone.
    surfaceLayer: { x: calibrationX, y, width: 64, height: 1 },
    firstInnerLayer: { x: calibrationX, y: y + 1, width: 64, height: 1 },
    shallowBand: { x: calibrationX, y: y + 2, width: 64, height: 4 },
    transitionBand: { x: calibrationX, y: y + 6, width: 64, height: 6 },
    midBand: { x: calibrationX, y: y + 12, width: 64, height: 10 },
    deepCore,
    deepEntry: { ...deepCore, height: 1 },
    deepRamp: { x: calibrationX, y: y + 33, width: 64, height: 4 },
    saturatedCore: { x: calibrationX, y: y + 43, width: 64, height: 17 },
    authoredHole: { x: x + 108, y: y + 72, width: 16, height: 16 },
    openChimney: { x: x + 136, y, width: 12, height: 72 },
    reconstructablePinhole: { x: x + 176, y: y + 120 },
  };
};

const wallPattern: WaterBodyVfxWallPattern = {
  kind: 'native-wall-checker',
  // Aligned bounds ensure RenderLab's 4x4 bmap proxy cannot spill outside the
  // exact Water pane. Half of 96x64 cells are occupied: exactly 3,072 cells.
  // Start at the Water surface. Every clear vertical run therefore begins at
  // depth zero and reaches at most 18 before the next occupied four-row block.
  region: { x: 484, y: 16, width: 96, height: 64 },
  blockSize: WALL_BLOCK_SIZE,
  occupiedParity: 0,
  wallProbe: { x: 485, y: 17 },
  clearProbe: { x: 489, y: 17 },
};

const boundary = (
  code: WaterBodyVfxBoundary['code'],
  x: number,
  otherMaterial: WaterBodyVfxOtherMaterial,
): WaterBodyVfxBoundary => ({
  code,
  water: { x, y: 292, width: 40, height: 32 },
  other: { x: x + 40, y: 292, width: 40, height: 32 },
  otherMaterial,
  waterProbe: { x: x + 39, y: 308 },
  otherProbe: { x: x + 40, y: 308 },
});

/**
 * Paused exact-Water scene for a body-optics experiment composed over the
 * accepted liquid body, surface, and contact layers. It owns deterministic
 * matter and native-wall topology only; browser gates own the presentation selector.
 */
export const WATER_BODY_VFX_AUDIT: WaterBodyVfxAuditSnapshot = {
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
    saltWater: { x: 16, y: 208, width: 72, height: 64, material: Material.SaltWater },
    distilledWater: {
      x: 104, y: 208, width: 72, height: 64, material: Material.DistilledWater,
    },
    deut: { x: 192, y: 208, width: 72, height: 64, material: Material.DEUT },
    oil: { x: 280, y: 208, width: 72, height: 64, material: Material.Oil },
    acid: { x: 368, y: 208, width: 72, height: 64, material: Material.Acid },
    lava: { x: 456, y: 208, width: 72, height: 64, material: Material.Lava },
  },
  seams: {
    waterSaltWater: boundary('WATR_SLTW', 16, Material.SaltWater),
    waterOil: boundary('WATR_OIL', 112, Material.Oil),
  },
  contacts: {
    waterGlass: boundary('WATR_GLAS', 208, Material.Glass),
    waterMetal: boundary('WATR_METL', 304, Material.Metal),
    waterSand: boundary('WATR_SAND', 400, Material.Sand),
    waterSmoke: boundary('WATR_SMKE', 496, Material.Smoke),
  },
  guardedBlank: { x: 16, y: 344, width: 560, height: 32 },
  conductiveWall: CONDUCTIVE_WALL,
};

interface WaterBodyFixtureBackend extends SimulationBackend {
  paintWall(x: number, y: number, wall: number, radius: number): void;
  walls(): Uint8Array;
}

/** Direct-fills the paused RenderLab backend without brush or physics steps. */
export function prepareWaterBodyVfxFixture(simulation: SimulationBackend): void {
  if (!supportsFixture(simulation)) {
    throw new Error('Water body VFX fixture requires a RenderLab native wall plane');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Water body VFX fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }

  simulation.clear();
  const cells = simulation.cells();
  for (const entry of WATER_BODY_VFX_AUDIT.panes) {
    fillRect(cells, simulation.width, entry.body, Material.Water);
    fillRect(cells, simulation.width, entry.authoredHole, Material.Empty);
    fillRect(cells, simulation.width, entry.openChimney, Material.Empty);
    setPoint(cells, simulation.width, entry.reconstructablePinhole, Material.Empty);
    if (entry.backing.kind === 'native-wall-checker') {
      paintWallPattern(simulation, entry.backing);
    }
  }

  const { sparse, materialControls, seams, contacts } = WATER_BODY_VFX_AUDIT;
  fillRect(cells, simulation.width, sparse.thinStrand, Material.Water);
  fillRect(cells, simulation.width, sparse.droplet, Material.Water);
  setPoint(cells, simulation.width, sparse.isolated, Material.Water);
  for (const entry of Object.values(materialControls)) {
    fillRect(cells, simulation.width, entry, entry.material);
  }
  for (const entry of [...Object.values(seams), ...Object.values(contacts)]) {
    fillRect(cells, simulation.width, entry.water, Material.Water);
    fillRect(cells, simulation.width, entry.other, entry.otherMaterial);
  }
  fillRect(cells, simulation.width, WATER_BODY_VFX_AUDIT.guardedBlank, Material.Empty);
}

function supportsFixture(simulation: SimulationBackend): simulation is WaterBodyFixtureBackend {
  const candidate = simulation as Partial<WaterBodyFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.paintWall === 'function';
}

function paintWallPattern(
  simulation: WaterBodyFixtureBackend,
  pattern: WaterBodyVfxWallPattern,
): void {
  for (let offsetY = 0; offsetY < pattern.region.height; offsetY += WALL_BLOCK_SIZE) {
    for (let offsetX = 0; offsetX < pattern.region.width; offsetX += WALL_BLOCK_SIZE) {
      const blockX = offsetX / WALL_BLOCK_SIZE;
      const blockY = offsetY / WALL_BLOCK_SIZE;
      if ((blockX + blockY) % 2 !== pattern.occupiedParity) continue;
      simulation.paintWall(
        pattern.region.x + offsetX,
        pattern.region.y + offsetY,
        CONDUCTIVE_WALL,
        0,
      );
    }
  }
}

function fillRect(
  cells: Uint8Array,
  width: number,
  rect: WaterBodyVfxRect,
  material: Material,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * width + rect.x, y * width + rect.x + rect.width);
  }
}

function setPoint(
  cells: Uint8Array,
  width: number,
  point: WaterBodyVfxPoint,
  material: Material,
): void {
  cells[point.y * width + point.x] = material;
}
