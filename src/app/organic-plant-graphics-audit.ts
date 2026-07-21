import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

export const ORGANIC_PLANT_GRAPHICS_ATLAS_COLUMNS = 3;
export const ORGANIC_PLANT_GRAPHICS_ATLAS_ROWS = 2;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 4;
const CARD_ORIGIN_Y = 4;
const CARD_STRIDE_X = 202;
const CARD_STRIDE_Y = 188;
const CARD_WIDTH = 196;
const CARD_HEIGHT = 180;

export type OrganicPlantAuditPhase = 'powder' | 'solid';

/**
 * Exact native growth materials represented by the current renderer catalog.
 * DYST is the retained, non-selectable product of dead yeast. Actor-like Life
 * particles and cellular-automata presets are deliberately outside this atlas.
 */
export const ORGANIC_PLANT_GRAPHICS_DEFINITIONS = [
  { material: Material.Wood, code: 'WOOD', color: '#9b6038', phase: 'solid', nativeProduct: false },
  { material: Material.Plant, code: 'PLNT', color: '#65a95f', phase: 'solid', nativeProduct: false },
  { material: Material.SEED, code: 'SEED', color: '#88e788', phase: 'powder', nativeProduct: false },
  { material: Material.YEST, code: 'YEST', color: '#eee0c0', phase: 'powder', nativeProduct: false },
  { material: Material.VINE, code: 'VINE', color: '#079a00', phase: 'solid', nativeProduct: false },
  { material: Material.DYST, code: 'DYST', color: '#bbb0a0', phase: 'powder', nativeProduct: true },
] as const satisfies readonly {
  material: Material;
  code: string;
  color: string;
  phase: OrganicPlantAuditPhase;
  nativeProduct: boolean;
}[];

export interface OrganicPlantGraphicsPoint {
  readonly x: number;
  readonly y: number;
}

export interface OrganicPlantGraphicsRect extends OrganicPlantGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

export interface OrganicPlantContactControl {
  readonly owner: OrganicPlantGraphicsRect;
  readonly neighbour: OrganicPlantGraphicsRect;
  readonly neighbourMaterial: Material.Sand | Material.Water;
}

export interface OrganicPlantGraphicsAtlasEntry {
  readonly material: (typeof ORGANIC_PLANT_GRAPHICS_DEFINITIONS)[number]['material'];
  readonly code: string;
  readonly color: string;
  readonly phase: OrganicPlantAuditPhase;
  readonly nativeProduct: boolean;
  readonly index: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly card: OrganicPlantGraphicsRect;
  /** Dense material body for organic volume, relief, and cavity probes. */
  readonly body: OrganicPlantGraphicsRect;
  readonly surfaceProbe: OrganicPlantGraphicsRect;
  readonly coreProbe: OrganicPlantGraphicsRect;
  /** Exact enclosed air that body styling must not claim. */
  readonly authoredCavity: OrganicPlantGraphicsRect;
  /** A separate open notch guarding against accidental closure. */
  readonly openGap: OrganicPlantGraphicsRect;
  /** One-cell stem, branches, and leaf tips modelling native growth topology. */
  readonly stem: OrganicPlantGraphicsRect;
  readonly branches: readonly OrganicPlantGraphicsPoint[];
  readonly leaves: readonly OrganicPlantGraphicsPoint[];
  readonly canopyGap: OrganicPlantGraphicsRect;
  /** A single seed or retained reaction product away from reconstructed support. */
  readonly isolatedSeedProduct: OrganicPlantGraphicsPoint;
  readonly guardedBlank: OrganicPlantGraphicsRect;
  readonly soilContact: OrganicPlantContactControl;
  readonly waterContact: OrganicPlantContactControl;
}

export interface OrganicPlantGraphicsAuditSnapshot {
  readonly cards: readonly OrganicPlantGraphicsAtlasEntry[];
  readonly solidCards: readonly OrganicPlantGraphicsAtlasEntry[];
  readonly powderCards: readonly OrganicPlantGraphicsAtlasEntry[];
  readonly nativeProductCards: readonly OrganicPlantGraphicsAtlasEntry[];
  readonly cavities: readonly OrganicPlantGraphicsPoint[];
  readonly openGaps: readonly OrganicPlantGraphicsPoint[];
  readonly growthTopology: readonly OrganicPlantGraphicsPoint[];
  readonly canopyGaps: readonly OrganicPlantGraphicsRect[];
  readonly isolatedSeedProducts: readonly OrganicPlantGraphicsPoint[];
  readonly guardedBlanks: readonly OrganicPlantGraphicsRect[];
  readonly soilContacts: readonly OrganicPlantContactControl[];
  readonly waterContacts: readonly OrganicPlantContactControl[];
}

const BRANCH_OFFSETS = buildBranchOffsets();
const LEAF_OFFSETS = [
  { x: 84, y: 34 }, { x: 84, y: 35 }, { x: 84, y: 36 },
  { x: 85, y: 33 }, { x: 85, y: 36 },
  { x: 115, y: 45 }, { x: 116, y: 46 }, { x: 115, y: 48 },
  { x: 116, y: 48 }, { x: 114, y: 49 },
  { x: 90, y: 30 }, { x: 91, y: 30 }, { x: 90, y: 31 },
] as const;

/** Stable six-card scene shared by future Canvas, WebGL, and true-8x gates. */
export const ORGANIC_PLANT_GRAPHICS_ATLAS: readonly OrganicPlantGraphicsAtlasEntry[] =
  ORGANIC_PLANT_GRAPHICS_DEFINITIONS.map((definition, index) => {
    const column = index % ORGANIC_PLANT_GRAPHICS_ATLAS_COLUMNS;
    const row = Math.floor(index / ORGANIC_PLANT_GRAPHICS_ATLAS_COLUMNS);
    const card = {
      x: CARD_ORIGIN_X + column * CARD_STRIDE_X,
      y: CARD_ORIGIN_Y + row * CARD_STRIDE_Y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    };
    const body = { x: card.x + 6, y: card.y + 8, width: 54, height: 52 };
    return {
      ...definition,
      index,
      left: card.x,
      top: card.y,
      width: card.width,
      height: card.height,
      card,
      body,
      surfaceProbe: { x: body.x + 5, y: body.y + 4, width: 8, height: 6 },
      coreProbe: { x: body.x + 6, y: body.y + 38, width: 8, height: 7 },
      authoredCavity: { x: body.x + 23, y: body.y + 21, width: 5, height: 5 },
      openGap: { x: body.x, y: body.y + 12, width: 3, height: 10 },
      stem: { x: card.x + 100, y: card.y + 24, width: 1, height: 66 },
      branches: BRANCH_OFFSETS.map(({ x, y }) => ({ x: card.x + x, y: card.y + y })),
      leaves: LEAF_OFFSETS.map(({ x, y }) => ({ x: card.x + x, y: card.y + y })),
      canopyGap: { x: card.x + 120, y: card.y + 25, width: 8, height: 8 },
      isolatedSeedProduct: { x: card.x + 178, y: card.y + 72 },
      guardedBlank: { x: card.x + 122, y: card.y + 92, width: 62, height: 24 },
      soilContact: {
        owner: { x: card.x + 8, y: card.y + 144, width: 8, height: 9 },
        neighbour: { x: card.x + 16, y: card.y + 144, width: 12, height: 9 },
        neighbourMaterial: Material.Sand,
      },
      waterContact: {
        owner: { x: card.x + 66, y: card.y + 144, width: 8, height: 9 },
        neighbour: { x: card.x + 74, y: card.y + 144, width: 12, height: 9 },
        neighbourMaterial: Material.Water,
      },
    };
  });

export const ORGANIC_PLANT_GRAPHICS_AUDIT: OrganicPlantGraphicsAuditSnapshot = {
  cards: ORGANIC_PLANT_GRAPHICS_ATLAS,
  solidCards: ORGANIC_PLANT_GRAPHICS_ATLAS.filter(({ phase }) => phase === 'solid'),
  powderCards: ORGANIC_PLANT_GRAPHICS_ATLAS.filter(({ phase }) => phase === 'powder'),
  nativeProductCards: ORGANIC_PLANT_GRAPHICS_ATLAS.filter(({ nativeProduct }) => nativeProduct),
  cavities: ORGANIC_PLANT_GRAPHICS_ATLAS.flatMap(({ authoredCavity }) => rectPoints(authoredCavity)),
  openGaps: ORGANIC_PLANT_GRAPHICS_ATLAS.flatMap(({ openGap }) => rectPoints(openGap)),
  growthTopology: ORGANIC_PLANT_GRAPHICS_ATLAS.flatMap(({ stem, branches, leaves }) => [
    ...rectPoints(stem), ...branches, ...leaves,
  ]),
  canopyGaps: ORGANIC_PLANT_GRAPHICS_ATLAS.map(({ canopyGap }) => canopyGap),
  isolatedSeedProducts: ORGANIC_PLANT_GRAPHICS_ATLAS.map(({ isolatedSeedProduct }) => isolatedSeedProduct),
  guardedBlanks: ORGANIC_PLANT_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
  soilContacts: ORGANIC_PLANT_GRAPHICS_ATLAS.map(({ soilContact }) => soilContact),
  waterContacts: ORGANIC_PLANT_GRAPHICS_ATLAS.map(({ waterContact }) => waterContact),
};

/** Direct-fills a paused deterministic world without crossing particle or tool ABIs. */
export function prepareOrganicPlantGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (simulation.name !== 'TypeScript deterministic fallback') {
    throw new Error('Organic/plant graphics audit fixture requires the deterministic backend');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Organic/plant graphics audit fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of ORGANIC_PLANT_GRAPHICS_ATLAS) {
    fillRect(cells, simulation.width, entry.body, entry.material);
    fillRect(cells, simulation.width, entry.authoredCavity, Material.Empty);
    fillRect(cells, simulation.width, entry.openGap, Material.Empty);
    fillRect(cells, simulation.width, entry.stem, entry.material);
    fillPoints(cells, simulation.width, entry.branches, entry.material);
    fillPoints(cells, simulation.width, entry.leaves, entry.material);
    fillRect(cells, simulation.width, entry.canopyGap, Material.Empty);
    cells[entry.isolatedSeedProduct.y * simulation.width + entry.isolatedSeedProduct.x] = entry.material;
    fillRect(cells, simulation.width, entry.guardedBlank, Material.Empty);
    fillRect(cells, simulation.width, entry.soilContact.owner, entry.material);
    fillRect(cells, simulation.width, entry.soilContact.neighbour, entry.soilContact.neighbourMaterial);
    fillRect(cells, simulation.width, entry.waterContact.owner, entry.material);
    fillRect(cells, simulation.width, entry.waterContact.neighbour, entry.waterContact.neighbourMaterial);
  }
}

function buildBranchOffsets(): readonly OrganicPlantGraphicsPoint[] {
  const points: OrganicPlantGraphicsPoint[] = [];
  for (let step = 1; step <= 14; step++) {
    points.push({ x: 100 - step, y: 42 - Math.floor(step / 2) });
  }
  for (let step = 1; step <= 14; step++) {
    points.push({ x: 100 + step, y: 54 - Math.floor(step / 2) });
  }
  for (let step = 1; step <= 8; step++) {
    points.push({ x: 100 - step, y: 28 + Math.floor(step / 2) });
  }
  return points;
}

function fillRect(
  cells: Uint8Array,
  worldWidth: number,
  rect: OrganicPlantGraphicsRect,
  material: Material,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * worldWidth + rect.x, y * worldWidth + rect.x + rect.width);
  }
}

function fillPoints(
  cells: Uint8Array,
  worldWidth: number,
  points: readonly OrganicPlantGraphicsPoint[],
  material: Material,
): void {
  for (const point of points) cells[point.y * worldWidth + point.x] = material;
}

function rectPoints(rect: OrganicPlantGraphicsRect): OrganicPlantGraphicsPoint[] {
  const points: OrganicPlantGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}
