import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

export const GAS_IDENTITY_GRAPHICS_ATLAS_COLUMNS = 6;
export const GAS_IDENTITY_GRAPHICS_ATLAS_ROWS = 3;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 4;
const CARD_ORIGIN_Y = 4;
const CARD_STRIDE_X = 101;
const CARD_STRIDE_Y = 124;
const CARD_WIDTH = 98;
const CARD_HEIGHT = 118;

const WISP_OFFSETS = [
  { x: 61, y: 11 }, { x: 63, y: 12 }, { x: 65, y: 11 },
  { x: 67, y: 13 }, { x: 69, y: 12 }, { x: 71, y: 14 },
  { x: 79, y: 18 }, { x: 81, y: 16 }, { x: 83, y: 17 },
  { x: 85, y: 15 }, { x: 87, y: 16 }, { x: 89, y: 14 },
] as const;

export const GAS_IDENTITY_GRAPHICS_DEFINITIONS = [
  { material: Material.Smoke, code: 'SMKE', color: '#9d9891' },
  { material: Material.Steam, code: 'WTRV', color: '#b9dce2' },
  { material: Material.Gas, code: 'GAS', color: '#c6b35d' },
  { material: Material.Oxygen, code: 'O2', color: '#80b8e8' },
  { material: Material.Hydrogen, code: 'H2', color: '#e4e0d5' },
  { material: Material.CarbonDioxide, code: 'CO2', color: '#8d9293' },
  { material: Material.NobleGas, code: 'NBLE', color: '#c277d7' },
  { material: Material.BOYL, code: 'BOYL', color: '#0a3200' },
  { material: Material.CAUS, code: 'CAUS', color: '#80ffa0' },
  { material: Material.FOG, code: 'FOG', color: '#aaaaaa' },
  { material: Material.RFRG, code: 'RFRG', color: '#72d2d4' },
  { material: Material.CFLM, code: 'CFLM', color: '#8080ff' },
  { material: Material.AMTR, code: 'AMTR', color: '#808080' },
  { material: Material.WARP, code: 'WARP', color: '#101010' },
  { material: Material.BIZRG, code: 'BIZG', color: '#00ffbb' },
  { material: Material.MORT, code: 'MORT', color: '#e0e0e0' },
  { material: Material.VRSG, code: 'VRSG', color: '#fe68fe' },
] as const;

export interface GasIdentityGraphicsPoint {
  readonly x: number;
  readonly y: number;
}

export interface GasIdentityGraphicsRect extends GasIdentityGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

export interface GasIdentityGraphicsContactControl {
  /** Exact card gas on the left side of the contact seam. */
  readonly owner: GasIdentityGraphicsRect;
  /** A disjoint control material abutting the owner's right edge. */
  readonly unlike: GasIdentityGraphicsRect;
  readonly unlikeMaterial: Material.Water | Material.Metal;
}

export interface GasIdentityGraphicsAtlasEntry {
  readonly material: (typeof GAS_IDENTITY_GRAPHICS_DEFINITIONS)[number]['material'];
  readonly code: string;
  readonly color: string;
  readonly index: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly card: GasIdentityGraphicsRect;
  /** Dense semantic seed; the atmosphere field, not this rectangle, owns its silhouette. */
  readonly cloudSeed: GasIdentityGraphicsRect;
  readonly denseProbe: GasIdentityGraphicsRect;
  /** Authored air retained at the centre of the dense seed. */
  readonly authoredVoid: GasIdentityGraphicsRect;
  /** Authored air joining the void to the cloud's upper edge. */
  readonly openChannel: GasIdentityGraphicsRect;
  /** Two sparse carrier arcs that should read as wisps rather than isolated beads. */
  readonly sparseWisps: readonly GasIdentityGraphicsPoint[];
  /** Deliberately wider empty gap between the two carrier arcs. */
  readonly wispGap: GasIdentityGraphicsRect;
  readonly isolated: GasIdentityGraphicsPoint;
  readonly guardedBlank: GasIdentityGraphicsRect;
  readonly liquidContact: GasIdentityGraphicsContactControl;
  readonly solidContact: GasIdentityGraphicsContactControl;
}

export interface GasIdentityGraphicsAuditSnapshot {
  readonly cards: readonly GasIdentityGraphicsAtlasEntry[];
  readonly authoredVoids: readonly GasIdentityGraphicsPoint[];
  readonly openChannels: readonly GasIdentityGraphicsPoint[];
  readonly sparseWisps: readonly GasIdentityGraphicsPoint[];
  readonly wispGaps: readonly GasIdentityGraphicsRect[];
  readonly isolated: readonly GasIdentityGraphicsPoint[];
  readonly guardedBlanks: readonly GasIdentityGraphicsRect[];
  readonly liquidContacts: readonly GasIdentityGraphicsContactControl[];
  readonly solidContacts: readonly GasIdentityGraphicsContactControl[];
}

/** Stable 17-card atlas shared by future Canvas, WebGL, and true-8x gas gates. */
export const GAS_IDENTITY_GRAPHICS_ATLAS: readonly GasIdentityGraphicsAtlasEntry[] =
  GAS_IDENTITY_GRAPHICS_DEFINITIONS.map(({ material, code, color }, index) => {
    const column = index % GAS_IDENTITY_GRAPHICS_ATLAS_COLUMNS;
    const row = Math.floor(index / GAS_IDENTITY_GRAPHICS_ATLAS_COLUMNS);
    const card = {
      x: CARD_ORIGIN_X + column * CARD_STRIDE_X,
      y: CARD_ORIGIN_Y + row * CARD_STRIDE_Y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    };
    const cloudSeed = { x: card.x + 5, y: card.y + 7, width: 49, height: 44 };
    const authoredVoid = { x: cloudSeed.x + 17, y: cloudSeed.y + 20, width: 7, height: 7 };
    const openChannel = {
      x: authoredVoid.x + 2,
      y: cloudSeed.y,
      width: 3,
      height: authoredVoid.y - cloudSeed.y,
    };
    const contactY = card.y + 94;
    return {
      material,
      code,
      color,
      index,
      left: card.x,
      top: card.y,
      width: card.width,
      height: card.height,
      card,
      cloudSeed,
      denseProbe: { x: cloudSeed.x + 6, y: cloudSeed.y + 27, width: 7, height: 7 },
      authoredVoid,
      openChannel,
      sparseWisps: WISP_OFFSETS.map(({ x, y }) => ({ x: card.x + x, y: card.y + y })),
      wispGap: { x: card.x + 74, y: card.y + 11, width: 3, height: 8 },
      isolated: { x: card.x + 91, y: card.y + 53 },
      guardedBlank: { x: card.x + 61, y: card.y + 68, width: 31, height: 15 },
      liquidContact: {
        owner: { x: card.x + 5, y: contactY, width: 8, height: 10 },
        unlike: { x: card.x + 13, y: contactY, width: 8, height: 10 },
        unlikeMaterial: Material.Water,
      },
      solidContact: {
        owner: { x: card.x + 38, y: contactY, width: 8, height: 10 },
        unlike: { x: card.x + 46, y: contactY, width: 8, height: 10 },
        unlikeMaterial: Material.Metal,
      },
    };
  });

export const GAS_IDENTITY_GRAPHICS_AUDIT: GasIdentityGraphicsAuditSnapshot = {
  cards: GAS_IDENTITY_GRAPHICS_ATLAS,
  authoredVoids: GAS_IDENTITY_GRAPHICS_ATLAS.flatMap(({ authoredVoid }) => (
    rectPoints(authoredVoid)
  )),
  openChannels: GAS_IDENTITY_GRAPHICS_ATLAS.flatMap(({ openChannel }) => (
    rectPoints(openChannel)
  )),
  sparseWisps: GAS_IDENTITY_GRAPHICS_ATLAS.flatMap(({ sparseWisps }) => sparseWisps),
  wispGaps: GAS_IDENTITY_GRAPHICS_ATLAS.map(({ wispGap }) => wispGap),
  isolated: GAS_IDENTITY_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
  guardedBlanks: GAS_IDENTITY_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
  liquidContacts: GAS_IDENTITY_GRAPHICS_ATLAS.map(({ liquidContact }) => liquidContact),
  solidContacts: GAS_IDENTITY_GRAPHICS_ATLAS.map(({ solidContact }) => solidContact),
};

/** Direct-fills a paused deterministic world without crossing the particle-brush ABI. */
export function prepareGasIdentityGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (simulation.name !== 'TypeScript deterministic fallback') {
    throw new Error('Gas identity graphics audit fixture requires the deterministic backend');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Gas identity graphics audit fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of GAS_IDENTITY_GRAPHICS_ATLAS) {
    fillRect(cells, simulation.width, entry.cloudSeed, entry.material);
    fillRect(cells, simulation.width, entry.authoredVoid, Material.Empty);
    fillRect(cells, simulation.width, entry.openChannel, Material.Empty);
    for (const point of entry.sparseWisps) {
      cells[point.y * simulation.width + point.x] = entry.material;
    }
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = entry.material;
    fillRect(cells, simulation.width, entry.wispGap, Material.Empty);
    fillRect(cells, simulation.width, entry.guardedBlank, Material.Empty);
    fillRect(cells, simulation.width, entry.liquidContact.owner, entry.material);
    fillRect(cells, simulation.width, entry.liquidContact.unlike, entry.liquidContact.unlikeMaterial);
    fillRect(cells, simulation.width, entry.solidContact.owner, entry.material);
    fillRect(cells, simulation.width, entry.solidContact.unlike, entry.solidContact.unlikeMaterial);
  }
}

function fillRect(
  cells: Uint8Array,
  worldWidth: number,
  rect: GasIdentityGraphicsRect,
  material: Material,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * worldWidth + rect.x, y * worldWidth + rect.x + rect.width);
  }
}

function rectPoints(rect: GasIdentityGraphicsRect): GasIdentityGraphicsPoint[] {
  const points: GasIdentityGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}
