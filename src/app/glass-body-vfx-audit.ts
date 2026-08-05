import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CONDUCTIVE_WALL = 1;
const WALL_BLOCK_SIZE = 4;

export interface GlassBodyVfxPoint { readonly x: number; readonly y: number }
export interface GlassBodyVfxRect extends GlassBodyVfxPoint {
  readonly width: number;
  readonly height: number;
}

export interface GlassBodyVfxWallPattern {
  readonly kind: 'native-wall-checker';
  /** Exact Glass remains authoritative throughout this co-located wall region. */
  readonly region: GlassBodyVfxRect;
  readonly blockSize: 4;
  /** Local 4x4 blocks with (column + row) % 2 === occupiedParity own the wall. */
  readonly occupiedParity: 0;
  readonly wallProbe: GlassBodyVfxPoint;
  readonly clearProbe: GlassBodyVfxPoint;
}

export interface GlassBodyVfxPane {
  readonly code: 'AIR_BACKED' | 'WALL_BACKED';
  readonly material: Material.Glass;
  readonly body: GlassBodyVfxRect;
  readonly backing: { readonly kind: 'air' } | GlassBodyVfxWallPattern;
  /** Exact semantic surface layer; its solid-optical-depth byte is zero. */
  readonly surfaceLayer: GlassBodyVfxRect;
  /** Protected first interior layer, exact solid-optical-depth byte 6. */
  readonly firstInnerLayer: GlassBodyVfxRect;
  /** Shallow transmission target, exact depth bytes 12--30. */
  readonly shallowBand: GlassBodyVfxRect;
  /** Body transition target, exact depth bytes 36--66. */
  readonly transitionBand: GlassBodyVfxRect;
  /** Broad exact Glass core spanning exact depth bytes 192--255. */
  readonly deepCore: GlassBodyVfxRect;
  /** Authored multi-cell air remains a real hole rather than optical support. */
  readonly authoredHole: GlassBodyVfxRect;
  /** Authored air channel open through the body's right silhouette. */
  readonly openNotch: GlassBodyVfxRect;
  /** One enclosed Empty cell which conservative cavity reconstruction may fill. */
  readonly reconstructableCavity: GlassBodyVfxPoint;
}

export interface GlassBodyVfxContact {
  readonly glass: GlassBodyVfxRect;
  readonly other: GlassBodyVfxRect;
  readonly otherMaterial: Material.Ice | Material.Metal | Material.Water;
  readonly glassProbe: GlassBodyVfxPoint;
  readonly otherProbe: GlassBodyVfxPoint;
}

export interface GlassBodyVfxAuditSnapshot {
  readonly panes: readonly GlassBodyVfxPane[];
  /** Disjoint one-cell owner: it must never inherit broad-body treatment. */
  readonly thinLine: GlassBodyVfxRect;
  readonly isolated: GlassBodyVfxPoint;
  readonly contacts: {
    readonly glassIce: GlassBodyVfxContact;
    readonly glassMetal: GlassBodyVfxContact;
    readonly glassWater: GlassBodyVfxContact;
  };
  readonly controls: {
    readonly ice: GlassBodyVfxRect;
    readonly qrtz: GlassBodyVfxRect;
    readonly metal: GlassBodyVfxRect;
    readonly emitterTrait: GlassBodyVfxRect;
    readonly emissiveLava: GlassBodyVfxRect;
    readonly sand: GlassBodyVfxRect;
    readonly water: GlassBodyVfxRect;
    readonly guardedBlank: GlassBodyVfxRect;
  };
  readonly conductiveWall: number;
}

const pane = (
  code: GlassBodyVfxPane['code'],
  x: number,
  backing: GlassBodyVfxPane['backing'],
): GlassBodyVfxPane => {
  const y = 16;
  const body = { x, y, width: 264, height: 144 };
  return {
    code,
    material: Material.Glass,
    body,
    backing,
    // These bands share a row range far from top/bottom silhouettes, voids,
    // and the optional wall pattern, so their exact depth bytes are stable.
    surfaceLayer: { x, y: y + 44, width: 1, height: 44 },
    firstInnerLayer: { x: x + 1, y: y + 44, width: 1, height: 44 },
    shallowBand: { x: x + 2, y: y + 44, width: 4, height: 44 },
    transitionBand: { x: x + 6, y: y + 44, width: 6, height: 44 },
    deepCore: { x: x + 48, y: y + 44, width: 24, height: 28 },
    authoredHole: { x: x + 104, y: y + 52, width: 16, height: 16 },
    openNotch: { x: x + body.width - 12, y: y + 112, width: 12, height: 12 },
    reconstructableCavity: { x: x + 132, y: y + 104 },
  };
};

const wallPattern: GlassBodyVfxWallPattern = {
  kind: 'native-wall-checker',
  // All bounds are multiples of four, so RenderLab's native bmap proxy cannot
  // spill outside this semantic Glass-backed diagnostic region.
  region: { x: 484, y: 40, width: 96, height: 64 },
  blockSize: WALL_BLOCK_SIZE,
  occupiedParity: 0,
  wallProbe: { x: 485, y: 41 },
  clearProbe: { x: 489, y: 41 },
};

const contact = (
  x: number,
  otherMaterial: GlassBodyVfxContact['otherMaterial'],
): GlassBodyVfxContact => ({
  glass: { x, y: 200, width: 48, height: 32 },
  other: { x: x + 48, y: 200, width: 48, height: 32 },
  otherMaterial,
  glassProbe: { x: x + 47, y: 216 },
  otherProbe: { x: x + 48, y: 216 },
});

/**
 * Paused exact-Glass scene for thick-body transmission experiments. It owns
 * only deterministic matter and native-wall topology; browser gates own VFX.
 */
export const GLASS_BODY_VFX_AUDIT: GlassBodyVfxAuditSnapshot = {
  panes: [
    pane('AIR_BACKED', 16, { kind: 'air' }),
    pane('WALL_BACKED', 332, wallPattern),
  ],
  thinLine: { x: 300, y: 20, width: 1, height: 96 },
  isolated: { x: 306, y: 132 },
  contacts: {
    glassIce: contact(16, Material.Ice),
    glassMetal: contact(132, Material.Metal),
    glassWater: contact(248, Material.Water),
  },
  controls: {
    ice: { x: 368, y: 200, width: 28, height: 28 },
    qrtz: { x: 408, y: 200, width: 28, height: 28 },
    metal: { x: 448, y: 200, width: 28, height: 28 },
    emitterTrait: { x: 488, y: 200, width: 28, height: 28 },
    emissiveLava: { x: 528, y: 200, width: 28, height: 28 },
    sand: { x: 568, y: 200, width: 28, height: 28 },
    water: { x: 368, y: 248, width: 40, height: 28 },
    guardedBlank: { x: 424, y: 248, width: 172, height: 40 },
  },
  conductiveWall: CONDUCTIVE_WALL,
};

interface GlassBodyFixtureBackend extends SimulationBackend {
  paintWall(x: number, y: number, wall: number, radius: number): void;
  walls(): Uint8Array;
}

/** Direct-fills the paused RenderLab backend without brush or physics steps. */
export function prepareGlassBodyVfxFixture(simulation: SimulationBackend): void {
  if (!supportsFixture(simulation)) {
    throw new Error('Glass body VFX fixture requires a RenderLab native wall plane');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Glass body VFX fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }

  simulation.clear();
  const cells = simulation.cells();
  for (const entry of GLASS_BODY_VFX_AUDIT.panes) {
    fillRect(cells, simulation.width, entry.body, Material.Glass);
    fillRect(cells, simulation.width, entry.authoredHole, Material.Empty);
    fillRect(cells, simulation.width, entry.openNotch, Material.Empty);
    setPoint(cells, simulation.width, entry.reconstructableCavity, Material.Empty);
    if (entry.backing.kind === 'native-wall-checker') {
      paintWallPattern(simulation, entry.backing);
    }
  }

  fillRect(cells, simulation.width, GLASS_BODY_VFX_AUDIT.thinLine, Material.Glass);
  setPoint(cells, simulation.width, GLASS_BODY_VFX_AUDIT.isolated, Material.Glass);
  for (const entry of Object.values(GLASS_BODY_VFX_AUDIT.contacts)) {
    fillRect(cells, simulation.width, entry.glass, Material.Glass);
    fillRect(cells, simulation.width, entry.other, entry.otherMaterial);
  }

  const { controls } = GLASS_BODY_VFX_AUDIT;
  fillRect(cells, simulation.width, controls.ice, Material.Ice);
  fillRect(cells, simulation.width, controls.qrtz, Material.QRTZ);
  fillRect(cells, simulation.width, controls.metal, Material.Metal);
  fillRect(cells, simulation.width, controls.emitterTrait, Material.CLNE);
  fillRect(cells, simulation.width, controls.emissiveLava, Material.Lava);
  fillRect(cells, simulation.width, controls.sand, Material.Sand);
  fillRect(cells, simulation.width, controls.water, Material.Water);
  fillRect(cells, simulation.width, controls.guardedBlank, Material.Empty);
}

function supportsFixture(simulation: SimulationBackend): simulation is GlassBodyFixtureBackend {
  const candidate = simulation as Partial<GlassBodyFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.paintWall === 'function';
}

function paintWallPattern(
  simulation: GlassBodyFixtureBackend,
  pattern: GlassBodyVfxWallPattern,
): void {
  for (let offsetY = 0; offsetY < pattern.region.height; offsetY += WALL_BLOCK_SIZE) {
    for (let offsetX = 0; offsetX < pattern.region.width; offsetX += WALL_BLOCK_SIZE) {
      const blockX = offsetX / WALL_BLOCK_SIZE;
      const blockY = offsetY / WALL_BLOCK_SIZE;
      if ((blockX + blockY) % 2 !== pattern.occupiedParity) continue;
      simulation.paintWall(pattern.region.x + offsetX, pattern.region.y + offsetY, CONDUCTIVE_WALL, 0);
    }
  }
}

function fillRect(cells: Uint8Array, width: number, rect: GlassBodyVfxRect, material: Material): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * width + rect.x, y * width + rect.x + rect.width);
  }
}

function setPoint(cells: Uint8Array, width: number, point: GlassBodyVfxPoint, material: Material): void {
  cells[point.y * width + point.x] = material;
}
