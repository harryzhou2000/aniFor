import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

export const MECHANISM_GRAPHICS_ATLAS_COLUMNS = 5;
export const MECHANISM_GRAPHICS_ATLAS_ROWS = 2;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 8;
const CARD_ORIGIN_Y = 8;
const CARD_STRIDE_X = 120;
const CARD_STRIDE_Y = 184;
const CARD_WIDTH = 112;
const CARD_HEIGHT = 168;

const MECHANISM_GRAPHICS_DEFINITIONS = [
  { material: Material.PIPE, code: 'PIPE' },
  { material: Material.PPIP, code: 'PPIP' },
  { material: Material.GPMP, code: 'GPMP' },
  { material: Material.PUMP, code: 'PUMP' },
  { material: Material.PSTN, code: 'PSTN' },
  { material: Material.FRME, code: 'FRME' },
  { material: Material.RPEL, code: 'RPEL' },
  { material: Material.PVOD, code: 'PVOD' },
  { material: Material.STOR, code: 'STOR' },
  { material: Material.DMG, code: 'DMG' },
] as const;

export interface MechanismGraphicsPoint {
  readonly x: number;
  readonly y: number;
}

export interface MechanismGraphicsRect extends MechanismGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

/** Exact mechanism/Metal seam. It remains a same-material seam for METL itself. */
export interface MechanismGraphicsMetalContact {
  readonly owner: MechanismGraphicsRect;
  readonly metal: MechanismGraphicsRect;
  readonly material: Material.Metal;
}

export interface MechanismGraphicsAtlasEntry {
  readonly material: Material;
  readonly code: string;
  readonly index: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly card: MechanismGraphicsRect;
  /** Main dense body with an authored closed cavity and an open exterior channel. */
  readonly body: MechanismGraphicsRect;
  /** A separate, unbroken dense body for depth/body-optics sampling. */
  readonly pairedBody: MechanismGraphicsRect;
  readonly authoredHole: MechanismGraphicsRect;
  /** Empty channel joined to the exterior through the body's right side. */
  readonly openChannel: MechanismGraphicsRect;
  readonly thinRail: MechanismGraphicsRect;
  readonly isolated: MechanismGraphicsPoint;
  readonly guardedBlank: MechanismGraphicsRect;
  readonly metalContact: MechanismGraphicsMetalContact;
}

export interface MechanismGraphicsAuditSnapshot {
  readonly cards: readonly MechanismGraphicsAtlasEntry[];
  readonly bodies: readonly MechanismGraphicsRect[];
  readonly pairedBodies: readonly MechanismGraphicsRect[];
  readonly authoredHoles: readonly MechanismGraphicsPoint[];
  readonly openChannels: readonly MechanismGraphicsPoint[];
  readonly thinRails: readonly MechanismGraphicsPoint[];
  readonly isolated: readonly MechanismGraphicsPoint[];
  readonly guardedBlanks: readonly MechanismGraphicsRect[];
  readonly metalContacts: readonly MechanismGraphicsMetalContact[];
}

/**
 * Stable 5x2 exact-owner atlas for the force/powered transport hardware layer.
 * It provides both a preserved cavity/channel topology and an unbroken paired
 * body, so body-depth graphics never need to infer material ownership.
 */
export const MECHANISM_GRAPHICS_ATLAS: readonly MechanismGraphicsAtlasEntry[] =
  MECHANISM_GRAPHICS_DEFINITIONS.map(({ material, code }, index) => {
    const column = index % MECHANISM_GRAPHICS_ATLAS_COLUMNS;
    const row = Math.floor(index / MECHANISM_GRAPHICS_ATLAS_COLUMNS);
    const card = {
      x: CARD_ORIGIN_X + column * CARD_STRIDE_X,
      y: CARD_ORIGIN_Y + row * CARD_STRIDE_Y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    };
    const body = { x: card.x + 8, y: card.y + 10, width: 56, height: 56 };
    const pairedBody = { x: card.x + 72, y: card.y + 10, width: 30, height: 30 };
    const contactY = card.y + 148;
    return {
      material,
      code,
      index,
      left: card.x,
      top: card.y,
      width: card.width,
      height: card.height,
      card,
      body,
      pairedBody,
      authoredHole: { x: body.x + 25, y: body.y + 25, width: 6, height: 6 },
      openChannel: { x: body.x + body.width - 5, y: body.y + 40, width: 5, height: 8 },
      thinRail: { x: card.x + 76, y: card.y + 48, width: 1, height: 44 },
      isolated: { x: card.x + 96, y: card.y + 70 },
      guardedBlank: { x: card.x + 72, y: card.y + 104, width: 32, height: 24 },
      metalContact: {
        owner: { x: card.x + 12, y: contactY, width: 10, height: 12 },
        metal: { x: card.x + 22, y: contactY, width: 10, height: 12 },
        material: Material.Metal,
      },
    } satisfies MechanismGraphicsAtlasEntry;
  });

export const MECHANISM_GRAPHICS_AUDIT: MechanismGraphicsAuditSnapshot = {
  cards: MECHANISM_GRAPHICS_ATLAS,
  bodies: MECHANISM_GRAPHICS_ATLAS.map(({ body }) => body),
  pairedBodies: MECHANISM_GRAPHICS_ATLAS.map(({ pairedBody }) => pairedBody),
  authoredHoles: MECHANISM_GRAPHICS_ATLAS.flatMap(({ authoredHole }) => rectPoints(authoredHole)),
  openChannels: MECHANISM_GRAPHICS_ATLAS.flatMap(({ openChannel }) => rectPoints(openChannel)),
  thinRails: MECHANISM_GRAPHICS_ATLAS.flatMap(({ thinRail }) => rectPoints(thinRail)),
  isolated: MECHANISM_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
  guardedBlanks: MECHANISM_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
  metalContacts: MECHANISM_GRAPHICS_ATLAS.map(({ metalContact }) => metalContact),
};

/** Direct-fills the paused deterministic backend without crossing particle/tool ABIs. */
export function prepareMechanismGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (simulation.name !== 'TypeScript deterministic fallback') {
    throw new Error('Mechanism graphics audit fixture requires the deterministic backend');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Mechanism graphics audit fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of MECHANISM_GRAPHICS_ATLAS) {
    fillRect(cells, simulation.width, entry.body, entry.material);
    fillRect(cells, simulation.width, entry.pairedBody, entry.material);
    fillRect(cells, simulation.width, entry.authoredHole, Material.Empty);
    fillRect(cells, simulation.width, entry.openChannel, Material.Empty);
    fillRect(cells, simulation.width, entry.thinRail, entry.material);
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = entry.material;
    fillRect(cells, simulation.width, entry.guardedBlank, Material.Empty);
    fillRect(cells, simulation.width, entry.metalContact.owner, entry.material);
    fillRect(cells, simulation.width, entry.metalContact.metal, entry.metalContact.material);
  }
}

function fillRect(
  cells: Uint8Array,
  worldWidth: number,
  rect: MechanismGraphicsRect,
  material: Material,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * worldWidth + rect.x, y * worldWidth + rect.x + rect.width);
  }
}

function rectPoints(rect: MechanismGraphicsRect): MechanismGraphicsPoint[] {
  const points: MechanismGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}
