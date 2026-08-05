import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CONDUCTIVE_WALL = 1;
const WALL_BLOCK_SIZE = 4;

export interface RockRoughnessVfxPoint { readonly x: number; readonly y: number }
export interface RockRoughnessVfxRect extends RockRoughnessVfxPoint {
  readonly width: number;
  readonly height: number;
}

/**
 * Geometry-matched exact-Solid card used to distinguish a ROCK-only finish
 * from the accepted E17 Metal bevel. The left-facing calibration bands are
 * far from the top/bottom edges and authored voids, so their Manhattan-depth
 * bytes are exact and independent of browser output scale.
 */
export interface RockRoughnessVfxPane {
  readonly code: 'ROCK_TARGET' | 'METAL_REFERENCE';
  readonly material: Material.ROCK | Material.Metal;
  readonly body: RockRoughnessVfxRect;
  /** Exact semantic surface, solid-optical-depth byte 0. */
  readonly surfaceLayer: RockRoughnessVfxRect;
  /** Protected first interior layer, exact depth byte 6. */
  readonly firstInnerLayer: RockRoughnessVfxRect;
  /** Exact solid-depth bytes 12--30. */
  readonly shallowBand: RockRoughnessVfxRect;
  /** Exact solid-depth bytes 36--66. */
  readonly transitionBand: RockRoughnessVfxRect;
  /** Exact intermediate body bytes 72--126. */
  readonly midBand: RockRoughnessVfxRect;
  /** Exact broad-body range 192--255. */
  readonly deepCore: RockRoughnessVfxRect;
  readonly authoredHole: RockRoughnessVfxRect;
  /** Empty channel deliberately connected to the right silhouette. */
  readonly openNotch: RockRoughnessVfxRect;
}

export type RockRoughnessVfxContactMaterial = Material.Metal | Material.Water
  | Material.Sand | Material.Smoke;

export interface RockRoughnessVfxContact {
  readonly code: 'ROCK_METL' | 'ROCK_WATR' | 'ROCK_SAND' | 'ROCK_SMKE';
  readonly rock: RockRoughnessVfxRect;
  readonly other: RockRoughnessVfxRect;
  readonly otherMaterial: RockRoughnessVfxContactMaterial;
  readonly rockProbe: RockRoughnessVfxPoint;
  readonly otherProbe: RockRoughnessVfxPoint;
}

export interface RockRoughnessVfxAuditSnapshot {
  readonly panes: readonly [RockRoughnessVfxPane, RockRoughnessVfxPane];
  readonly thinLine: RockRoughnessVfxRect;
  readonly isolated: RockRoughnessVfxPoint;
  readonly nativeWall: {
    /** Exact ROCK and the native wall plane coexist; neither replaces the other. */
    readonly rock: RockRoughnessVfxRect;
    readonly wallRegion: RockRoughnessVfxRect;
    readonly wallProbe: RockRoughnessVfxPoint;
    readonly clearProbe: RockRoughnessVfxPoint;
  };
  readonly controls: {
    /** Geological Solid sibling with its own established identity grammar. */
    readonly coal: RockRoughnessVfxRect & { readonly material: Material.Coal };
    /** Native Powder despite its stone-like name. */
    readonly stone: RockRoughnessVfxRect & { readonly material: Material.Stone };
    readonly brick: RockRoughnessVfxRect & { readonly material: Material.Brick };
    readonly glass: RockRoughnessVfxRect & { readonly material: Material.Glass };
    readonly sand: RockRoughnessVfxRect & { readonly material: Material.Sand };
    readonly water: RockRoughnessVfxRect & { readonly material: Material.Water };
    readonly guardedBlank: RockRoughnessVfxRect & { readonly material: Material.Empty };
  };
  readonly contacts: {
    readonly rockMetal: RockRoughnessVfxContact;
    readonly rockWater: RockRoughnessVfxContact;
    readonly rockSand: RockRoughnessVfxContact;
    readonly rockSmoke: RockRoughnessVfxContact;
  };
  readonly conductiveWall: number;
}

const pane = (
  code: RockRoughnessVfxPane['code'],
  material: RockRoughnessVfxPane['material'],
  x: number,
): RockRoughnessVfxPane => {
  const y = 16;
  const body = { x, y, width: 264, height: 168 };
  return {
    code,
    material,
    body,
    surfaceLayer: { x, y: y + 44, width: 1, height: 40 },
    firstInnerLayer: { x: x + 1, y: y + 44, width: 1, height: 40 },
    shallowBand: { x: x + 2, y: y + 44, width: 4, height: 40 },
    transitionBand: { x: x + 6, y: y + 44, width: 6, height: 40 },
    midBand: { x: x + 12, y: y + 44, width: 10, height: 40 },
    deepCore: { x: x + 32, y: y + 48, width: 24, height: 28 },
    authoredHole: { x: x + 112, y: y + 92, width: 16, height: 16 },
    openNotch: { x: x + body.width - 12, y: y + 116, width: 12, height: 20 },
  };
};

const contact = (
  code: RockRoughnessVfxContact['code'],
  x: number,
  otherMaterial: RockRoughnessVfxContactMaterial,
): RockRoughnessVfxContact => ({
  code,
  rock: { x, y: 312, width: 40, height: 40 },
  other: { x: x + 40, y: 312, width: 40, height: 40 },
  otherMaterial,
  rockProbe: { x: x + 39, y: 332 },
  otherProbe: { x: x + 40, y: 332 },
});

/**
 * Paused exact-ROCK scene for the post-E17 rough-body correction. It owns only
 * deterministic semantic/native-wall topology; the browser audit owns selector
 * state and framebuffer comparisons.
 */
export const ROCK_ROUGHNESS_VFX_AUDIT: RockRoughnessVfxAuditSnapshot = {
  panes: [
    pane('ROCK_TARGET', Material.ROCK, 16),
    pane('METAL_REFERENCE', Material.Metal, 332),
  ],
  thinLine: { x: 480, y: 208, width: 1, height: 64 },
  isolated: { x: 488, y: 276 },
  nativeWall: {
    rock: { x: 500, y: 208, width: 80, height: 72 },
    wallRegion: { x: 524, y: 232, width: 24, height: 24 },
    wallProbe: { x: 525, y: 233 },
    clearProbe: { x: 508, y: 216 },
  },
  controls: {
    coal: { x: 16, y: 208, width: 56, height: 48, material: Material.Coal },
    stone: { x: 84, y: 208, width: 56, height: 48, material: Material.Stone },
    brick: { x: 152, y: 208, width: 56, height: 48, material: Material.Brick },
    glass: { x: 220, y: 208, width: 56, height: 48, material: Material.Glass },
    sand: { x: 288, y: 208, width: 56, height: 48, material: Material.Sand },
    water: { x: 356, y: 208, width: 56, height: 48, material: Material.Water },
    guardedBlank: { x: 424, y: 208, width: 52, height: 48, material: Material.Empty },
  },
  contacts: {
    rockMetal: contact('ROCK_METL', 16, Material.Metal),
    rockWater: contact('ROCK_WATR', 128, Material.Water),
    rockSand: contact('ROCK_SAND', 240, Material.Sand),
    rockSmoke: contact('ROCK_SMKE', 352, Material.Smoke),
  },
  conductiveWall: CONDUCTIVE_WALL,
};

interface RockRoughnessFixtureBackend extends SimulationBackend {
  paintWall(x: number, y: number, wall: number, radius: number): void;
  walls(): Uint8Array;
}

/** Direct-fills a paused 612x384 RenderLab scene without stepping physics. */
export function prepareRockRoughnessVfxFixture(simulation: SimulationBackend): void {
  if (!supportsFixture(simulation)) {
    throw new Error('ROCK roughness VFX fixture requires a RenderLab native wall plane');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`ROCK roughness VFX fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }

  simulation.clear();
  const cells = simulation.cells();
  for (const entry of ROCK_ROUGHNESS_VFX_AUDIT.panes) {
    fillRect(cells, simulation.width, entry.body, entry.material);
    fillRect(cells, simulation.width, entry.authoredHole, Material.Empty);
    fillRect(cells, simulation.width, entry.openNotch, Material.Empty);
  }

  fillRect(cells, simulation.width, ROCK_ROUGHNESS_VFX_AUDIT.thinLine, Material.ROCK);
  setPoint(cells, simulation.width, ROCK_ROUGHNESS_VFX_AUDIT.isolated, Material.ROCK);
  fillRect(cells, simulation.width, ROCK_ROUGHNESS_VFX_AUDIT.nativeWall.rock, Material.ROCK);
  paintWallRegion(simulation, ROCK_ROUGHNESS_VFX_AUDIT.nativeWall.wallRegion);

  for (const entry of Object.values(ROCK_ROUGHNESS_VFX_AUDIT.controls)) {
    fillRect(cells, simulation.width, entry, entry.material);
  }
  for (const entry of Object.values(ROCK_ROUGHNESS_VFX_AUDIT.contacts)) {
    fillRect(cells, simulation.width, entry.rock, Material.ROCK);
    fillRect(cells, simulation.width, entry.other, entry.otherMaterial);
  }
}

function supportsFixture(simulation: SimulationBackend): simulation is RockRoughnessFixtureBackend {
  const candidate = simulation as Partial<RockRoughnessFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.paintWall === 'function';
}

function paintWallRegion(
  simulation: RockRoughnessFixtureBackend,
  region: RockRoughnessVfxRect,
): void {
  for (let y = region.y; y < region.y + region.height; y += WALL_BLOCK_SIZE) {
    for (let x = region.x; x < region.x + region.width; x += WALL_BLOCK_SIZE) {
      simulation.paintWall(x, y, CONDUCTIVE_WALL, 0);
    }
  }
}

function fillRect(
  cells: Uint8Array,
  width: number,
  rect: RockRoughnessVfxRect,
  material: Material,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * width + rect.x, y * width + rect.x + rect.width);
  }
}

function setPoint(
  cells: Uint8Array,
  width: number,
  point: RockRoughnessVfxPoint,
  material: Material,
): void {
  cells[point.y * width + point.x] = material;
}
