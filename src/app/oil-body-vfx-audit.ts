import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CONDUCTIVE_WALL = 1;
const WALL_BLOCK_SIZE = 4;

export interface OilBodyVfxPoint { readonly x: number; readonly y: number }
export interface OilBodyVfxRect extends OilBodyVfxPoint {
  readonly width: number;
  readonly height: number;
}

export interface OilBodyVfxWallPattern {
  readonly kind: 'native-wall-checker';
  /** Exact Oil remains authoritative throughout this co-located wall region. */
  readonly region: OilBodyVfxRect;
  readonly blockSize: 4;
  /** Local 4x4 blocks with (column + row) % 2 === occupiedParity own the wall. */
  readonly occupiedParity: 0;
  readonly wallProbe: OilBodyVfxPoint;
  readonly clearProbe: OilBodyVfxPoint;
}

export interface OilBodyVfxPane {
  readonly code: 'OPEN_POOL' | 'WALL_CONTROL';
  readonly material: Material.Oil;
  readonly body: OilBodyVfxRect;
  readonly backing: { readonly kind: 'air' } | OilBodyVfxWallPattern;
  /** Exact exposed row; its vertical liquid-optical-depth byte is zero. */
  readonly surfaceLayer: OilBodyVfxRect;
  /** Protected first interior row, exact liquid-optical-depth byte 6. */
  readonly firstInnerLayer: OilBodyVfxRect;
  /** Existing E03 hand-off band, exact depth bytes 12--30. */
  readonly shallowBand: OilBodyVfxRect;
  /** Candidate body transition, exact depth bytes 36--66. */
  readonly transitionBand: OilBodyVfxRect;
  /** Intermediate body range, exact depth bytes 72--126. */
  readonly midBand: OilBodyVfxRect;
  /** Broad exact-Oil core spanning exact depth bytes 192--255. */
  readonly deepCore: OilBodyVfxRect;
  /** Authored multi-cell air remains open instead of becoming Oil support. */
  readonly authoredHole: OilBodyVfxRect;
  /** Authored air path open from the top silhouette into the body. */
  readonly openChimney: OilBodyVfxRect;
  /** Enclosed Empty cell which the shared liquid field may reconstruct visually. */
  readonly reconstructablePinhole: OilBodyVfxPoint;
}

export type OilBodyVfxOtherMaterial = Material.Diesel | Material.Water
  | Material.Glass | Material.Metal | Material.Sand | Material.Smoke;

export interface OilBodyVfxBoundary {
  readonly code: 'OIL_DESL' | 'OIL_WATR' | 'OIL_GLAS'
    | 'OIL_METL' | 'OIL_SAND' | 'OIL_SMKE';
  readonly oil: OilBodyVfxRect;
  readonly other: OilBodyVfxRect;
  readonly otherMaterial: OilBodyVfxOtherMaterial;
  readonly oilProbe: OilBodyVfxPoint;
  readonly otherProbe: OilBodyVfxPoint;
}

export interface OilBodyVfxAuditSnapshot {
  readonly panes: readonly OilBodyVfxPane[];
  readonly sparse: {
    readonly thinStrand: OilBodyVfxRect;
    readonly droplet: OilBodyVfxRect;
    readonly isolated: OilBodyVfxPoint;
  };
  /** Oily siblings are especially important: an exact-Oil effect must not follow optics alone. */
  readonly materialControls: {
    readonly diesel: OilBodyVfxRect & { readonly material: Material.Diesel };
    readonly nitro: OilBodyVfxRect & { readonly material: Material.Nitro };
    readonly water: OilBodyVfxRect & { readonly material: Material.Water };
    readonly acid: OilBodyVfxRect & { readonly material: Material.Acid };
    readonly lava: OilBodyVfxRect & { readonly material: Material.Lava };
    readonly soap: OilBodyVfxRect & { readonly material: Material.Soap };
  };
  readonly seams: {
    readonly oilDiesel: OilBodyVfxBoundary;
    readonly oilWater: OilBodyVfxBoundary;
  };
  readonly contacts: {
    readonly oilGlass: OilBodyVfxBoundary;
    readonly oilMetal: OilBodyVfxBoundary;
    readonly oilSand: OilBodyVfxBoundary;
    readonly oilSmoke: OilBodyVfxBoundary;
  };
  readonly guardedBlank: OilBodyVfxRect;
  readonly conductiveWall: number;
}

const pane = (
  code: OilBodyVfxPane['code'],
  x: number,
  backing: OilBodyVfxPane['backing'],
): OilBodyVfxPane => {
  const y = 16;
  const body = { x, y, width: 264, height: 176 };
  const calibrationX = x + 20;
  return {
    code,
    material: Material.Oil,
    body,
    backing,
    // Every calibration rectangle occupies the same wall-free columns. Vertical
    // distance from the exact top row therefore determines its depth byte alone.
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

const wallPattern: OilBodyVfxWallPattern = {
  kind: 'native-wall-checker',
  // Aligned bounds ensure RenderLab's 4x4 bmap proxy cannot spill outside the
  // exact Oil pane. Half of 96x64 cells are occupied: exactly 3,072 cells.
  // Start at the Oil surface. Every clear vertical run therefore begins at
  // depth zero and reaches at most 18 before the next occupied four-row block.
  region: { x: 484, y: 16, width: 96, height: 64 },
  blockSize: WALL_BLOCK_SIZE,
  occupiedParity: 0,
  wallProbe: { x: 485, y: 17 },
  clearProbe: { x: 489, y: 17 },
};

const boundary = (
  code: OilBodyVfxBoundary['code'],
  x: number,
  otherMaterial: OilBodyVfxOtherMaterial,
): OilBodyVfxBoundary => ({
  code,
  oil: { x, y: 292, width: 40, height: 32 },
  other: { x: x + 40, y: 292, width: 40, height: 32 },
  otherMaterial,
  oilProbe: { x: x + 39, y: 308 },
  otherProbe: { x: x + 40, y: 308 },
});

/**
 * Paused exact-Oil scene for a body-optics experiment composed over the accepted
 * liquid body, surface, and contact layers. It owns deterministic matter and
 * native-wall topology only; browser gates own the presentation selector.
 */
export const OIL_BODY_VFX_AUDIT: OilBodyVfxAuditSnapshot = {
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
    diesel: { x: 16, y: 208, width: 72, height: 64, material: Material.Diesel },
    nitro: { x: 104, y: 208, width: 72, height: 64, material: Material.Nitro },
    water: { x: 192, y: 208, width: 72, height: 64, material: Material.Water },
    acid: { x: 280, y: 208, width: 72, height: 64, material: Material.Acid },
    lava: { x: 368, y: 208, width: 72, height: 64, material: Material.Lava },
    soap: { x: 456, y: 208, width: 72, height: 64, material: Material.Soap },
  },
  seams: {
    oilDiesel: boundary('OIL_DESL', 16, Material.Diesel),
    oilWater: boundary('OIL_WATR', 112, Material.Water),
  },
  contacts: {
    oilGlass: boundary('OIL_GLAS', 208, Material.Glass),
    oilMetal: boundary('OIL_METL', 304, Material.Metal),
    oilSand: boundary('OIL_SAND', 400, Material.Sand),
    oilSmoke: boundary('OIL_SMKE', 496, Material.Smoke),
  },
  guardedBlank: { x: 16, y: 344, width: 560, height: 32 },
  conductiveWall: CONDUCTIVE_WALL,
};

interface OilBodyFixtureBackend extends SimulationBackend {
  paintWall(x: number, y: number, wall: number, radius: number): void;
  walls(): Uint8Array;
}

/** Direct-fills the paused RenderLab backend without brush or physics steps. */
export function prepareOilBodyVfxFixture(simulation: SimulationBackend): void {
  if (!supportsFixture(simulation)) {
    throw new Error('Oil body VFX fixture requires a RenderLab native wall plane');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Oil body VFX fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }

  simulation.clear();
  const cells = simulation.cells();
  for (const entry of OIL_BODY_VFX_AUDIT.panes) {
    fillRect(cells, simulation.width, entry.body, Material.Oil);
    fillRect(cells, simulation.width, entry.authoredHole, Material.Empty);
    fillRect(cells, simulation.width, entry.openChimney, Material.Empty);
    setPoint(cells, simulation.width, entry.reconstructablePinhole, Material.Empty);
    if (entry.backing.kind === 'native-wall-checker') {
      paintWallPattern(simulation, entry.backing);
    }
  }

  const { sparse, materialControls, seams, contacts } = OIL_BODY_VFX_AUDIT;
  fillRect(cells, simulation.width, sparse.thinStrand, Material.Oil);
  fillRect(cells, simulation.width, sparse.droplet, Material.Oil);
  setPoint(cells, simulation.width, sparse.isolated, Material.Oil);
  for (const entry of Object.values(materialControls)) {
    fillRect(cells, simulation.width, entry, entry.material);
  }
  for (const entry of [...Object.values(seams), ...Object.values(contacts)]) {
    fillRect(cells, simulation.width, entry.oil, Material.Oil);
    fillRect(cells, simulation.width, entry.other, entry.otherMaterial);
  }
  fillRect(cells, simulation.width, OIL_BODY_VFX_AUDIT.guardedBlank, Material.Empty);
}

function supportsFixture(simulation: SimulationBackend): simulation is OilBodyFixtureBackend {
  const candidate = simulation as Partial<OilBodyFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.paintWall === 'function';
}

function paintWallPattern(
  simulation: OilBodyFixtureBackend,
  pattern: OilBodyVfxWallPattern,
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
  rect: OilBodyVfxRect,
  material: Material,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * width + rect.x, y * width + rect.x + rect.width);
  }
}

function setPoint(
  cells: Uint8Array,
  width: number,
  point: OilBodyVfxPoint,
  material: Material,
): void {
  cells[point.y * width + point.x] = material;
}
