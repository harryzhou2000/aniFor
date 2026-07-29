import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

export const LIQUID_IDENTITY_GRAPHICS_ATLAS_COLUMNS = 8;
export const LIQUID_IDENTITY_GRAPHICS_ATLAS_ROWS = 2;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 4;
const CARD_ORIGIN_Y = 8;
const CARD_STRIDE_X = 76;
const CARD_STRIDE_Y = 184;
const CARD_WIDTH = 72;
const CARD_HEIGHT = 176;

export const LIQUID_IDENTITY_GRAPHICS_DEFINITIONS = [
  { material: Material.Soap, code: 'SOAP', color: '#a8d8bc' },
  { material: Material.BIZR, code: 'BIZR', color: '#00ff77' },
  { material: Material.CBNW, code: 'CBNW', color: '#2030d0' },
  { material: Material.GEL, code: 'GEL', color: '#ff9900' },
  { material: Material.GLOW, code: 'GLOW', color: '#445464' },
  { material: Material.VIRS, code: 'VIRS', color: '#fe11f6' },
  { material: Material.FRZW, code: 'FRZW', color: '#1020c0' },
  { material: Material.RFGL, code: 'RFGL', color: '#84c2cf' },
  // The normal and compact WebGL paths share this complete public identity
  // grammar. Keep radioactive liquids here as ordinary semantic liquid owners:
  // their native state remains in the separate presentation-state plane.
  { material: Material.MWAX, code: 'MWAX', color: '#e0e0aa' },
  { material: Material.PSTE, code: 'PSTE', color: '#aa99aa' },
  { material: Material.RSST, code: 'RSST', color: '#f95b49' },
  { material: Material.DEUT, code: 'DEUT', color: '#00153f' },
  { material: Material.EXOT, code: 'EXOT', color: '#247bfe' },
  { material: Material.ISOZ, code: 'ISOZ', color: '#aa30d0' },
  // Representative public owners for the two previously generic liquid
  // optics families. LO2/LRBD share their exact-family WebGL grammar.
  { material: Material.Mercury, code: 'MERC', color: '#a8afba' },
  { material: Material.LiquidNitrogen, code: 'LN2', color: '#9bdaf2' },
] as const;

export interface LiquidIdentityGraphicsPoint {
  readonly x: number;
  readonly y: number;
}

export interface LiquidIdentityGraphicsRect extends LiquidIdentityGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

export interface LiquidIdentityGraphicsContactControl {
  /** Exact card liquid on the left side of the contact seam. */
  readonly owner: LiquidIdentityGraphicsRect;
  /** A disjoint control material abutting the owner's right edge. */
  readonly unlike: LiquidIdentityGraphicsRect;
  readonly unlikeMaterial: Material.Water | Material.Metal;
}

export interface LiquidIdentityGraphicsAtlasEntry {
  readonly material: (typeof LIQUID_IDENTITY_GRAPHICS_DEFINITIONS)[number]['material'];
  readonly code: string;
  readonly color: string;
  readonly index: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly card: LiquidIdentityGraphicsRect;
  readonly body: LiquidIdentityGraphicsRect;
  /** Stable regions for paired macro-surface and dense-core sampling. */
  readonly surfaceProbe: LiquidIdentityGraphicsRect;
  readonly coreProbe: LiquidIdentityGraphicsRect;
  /** A deliberately large authored cavity whose centre must remain air. */
  readonly cavity: LiquidIdentityGraphicsRect;
  /** A three-cell-wide air channel connected through the body's top edge. */
  readonly openChimney: LiquidIdentityGraphicsRect;
  /** A one-cell-wide body-attached liquid structure. */
  readonly strand: LiquidIdentityGraphicsRect;
  readonly isolated: LiquidIdentityGraphicsPoint;
  readonly guardedBlank: LiquidIdentityGraphicsRect;
  readonly liquidContact: LiquidIdentityGraphicsContactControl;
  readonly solidContact: LiquidIdentityGraphicsContactControl;
}

export interface LiquidIdentityGraphicsAuditSnapshot {
  readonly cards: readonly LiquidIdentityGraphicsAtlasEntry[];
  readonly cavities: readonly LiquidIdentityGraphicsPoint[];
  readonly openChimneys: readonly LiquidIdentityGraphicsPoint[];
  readonly strands: readonly LiquidIdentityGraphicsPoint[];
  readonly isolated: readonly LiquidIdentityGraphicsPoint[];
  readonly guardedBlanks: readonly LiquidIdentityGraphicsRect[];
  readonly liquidContacts: readonly LiquidIdentityGraphicsContactControl[];
  readonly solidContacts: readonly LiquidIdentityGraphicsContactControl[];
}

/** Stable sixteen-card liquid atlas shared by paired Canvas/WebGL identity gates. */
export const LIQUID_IDENTITY_GRAPHICS_ATLAS: readonly LiquidIdentityGraphicsAtlasEntry[] =
  LIQUID_IDENTITY_GRAPHICS_DEFINITIONS.map(({ material, code, color }, index) => {
    const card = {
      x: CARD_ORIGIN_X + index % LIQUID_IDENTITY_GRAPHICS_ATLAS_COLUMNS * CARD_STRIDE_X,
      y: CARD_ORIGIN_Y + Math.floor(index / LIQUID_IDENTITY_GRAPHICS_ATLAS_COLUMNS) * CARD_STRIDE_Y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    };
    const body = { x: card.x + 4, y: card.y + 8, width: 42, height: 68 };
    const contactY = card.y + 116;
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
      body,
      surfaceProbe: { x: body.x + 5, y: body.y + 5, width: 8, height: 8 },
      coreProbe: { x: body.x + 5, y: body.y + body.height - 12, width: 8, height: 8 },
      cavity: { x: body.x + 16, y: body.y + 34, width: 6, height: 6 },
      openChimney: { x: body.x + 31, y: body.y, width: 3, height: 30 },
      strand: { x: body.x + 20, y: body.y + body.height, width: 1, height: 12 },
      isolated: { x: card.x + 61, y: card.y + 18 },
      guardedBlank: { x: card.x + 48, y: card.y + 78, width: 18, height: 20 },
      liquidContact: {
        owner: { x: card.x + 6, y: contactY, width: 8, height: 12 },
        unlike: { x: card.x + 14, y: contactY, width: 8, height: 12 },
        unlikeMaterial: Material.Water,
      },
      solidContact: {
        owner: { x: card.x + 38, y: contactY, width: 8, height: 12 },
        unlike: { x: card.x + 46, y: contactY, width: 8, height: 12 },
        unlikeMaterial: Material.Metal,
      },
    };
  });

export const LIQUID_IDENTITY_GRAPHICS_AUDIT: LiquidIdentityGraphicsAuditSnapshot = {
  cards: LIQUID_IDENTITY_GRAPHICS_ATLAS,
  cavities: LIQUID_IDENTITY_GRAPHICS_ATLAS.flatMap(({ cavity }) => rectPoints(cavity)),
  openChimneys: LIQUID_IDENTITY_GRAPHICS_ATLAS.flatMap(({ openChimney }) => (
    rectPoints(openChimney)
  )),
  strands: LIQUID_IDENTITY_GRAPHICS_ATLAS.flatMap(({ strand }) => rectPoints(strand)),
  isolated: LIQUID_IDENTITY_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
  guardedBlanks: LIQUID_IDENTITY_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
  liquidContacts: LIQUID_IDENTITY_GRAPHICS_ATLAS.map(({ liquidContact }) => liquidContact),
  solidContacts: LIQUID_IDENTITY_GRAPHICS_ATLAS.map(({ solidContact }) => solidContact),
};

/** Direct-fills a paused deterministic world without crossing the particle-brush ABI. */
export function prepareLiquidIdentityGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (simulation.name !== 'TypeScript deterministic fallback') {
    throw new Error('Liquid identity graphics audit fixture requires the deterministic backend');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Liquid identity graphics audit fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of LIQUID_IDENTITY_GRAPHICS_ATLAS) {
    fillRect(cells, simulation.width, entry.body, entry.material);
    fillRect(cells, simulation.width, entry.cavity, Material.Empty);
    fillRect(cells, simulation.width, entry.openChimney, Material.Empty);
    fillRect(cells, simulation.width, entry.strand, entry.material);
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = entry.material;
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
  rect: LiquidIdentityGraphicsRect,
  material: Material,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * worldWidth + rect.x, y * worldWidth + rect.x + rect.width);
  }
}

function rectPoints(rect: LiquidIdentityGraphicsRect): LiquidIdentityGraphicsPoint[] {
  const points: LiquidIdentityGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}
