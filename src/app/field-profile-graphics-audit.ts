import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

export const FIELD_PROFILE_GRAPHICS_ATLAS_COLUMNS = 4;
export const FIELD_PROFILE_GRAPHICS_ATLAS_ROWS = 2;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 8;
const CARD_ORIGIN_Y = 4;
const CARD_STRIDE_X = 150;
const CARD_STRIDE_Y = 188;
const CARD_WIDTH = 142;
const CARD_HEIGHT = 180;

const FIELD_PROFILE_GRAPHICS_DEFINITIONS = [
  { material: Material.BHOL, code: 'BHOL' },
  { material: Material.NBHL, code: 'NBHL' },
  { material: Material.VOID, code: 'VOID' },
  { material: Material.PRTI, code: 'PRTI' },
  { material: Material.PRTO, code: 'PRTO' },
  { material: Material.TRON, code: 'TRON' },
  { material: Material.NWHL, code: 'NWHL' },
  { material: Material.WHOL, code: 'WHOL' },
] as const;

export interface FieldProfileGraphicsPoint { readonly x: number; readonly y: number }
export interface FieldProfileGraphicsRect extends FieldProfileGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

export interface FieldProfileGraphicsControls {
  readonly force: FieldProfileGraphicsRect;
  readonly device: FieldProfileGraphicsRect;
  readonly role: FieldProfileGraphicsRect;
}

export interface FieldProfileGraphicsAtlasEntry {
  readonly material: Material;
  readonly code: string;
  readonly index: number;
  readonly card: FieldProfileGraphicsRect;
  readonly body: FieldProfileGraphicsRect;
  readonly pairedBody: FieldProfileGraphicsRect;
  readonly authoredHole: FieldProfileGraphicsRect;
  readonly openChannel: FieldProfileGraphicsRect;
  readonly thinRail: FieldProfileGraphicsRect;
  readonly isolated: FieldProfileGraphicsPoint;
  readonly guardedBlank: FieldProfileGraphicsRect;
  readonly controls: FieldProfileGraphicsControls;
}

export interface FieldProfileGraphicsAuditSnapshot {
  readonly cards: readonly FieldProfileGraphicsAtlasEntry[];
  readonly bodies: readonly FieldProfileGraphicsRect[];
  readonly pairedBodies: readonly FieldProfileGraphicsRect[];
  readonly authoredHoles: readonly FieldProfileGraphicsPoint[];
  readonly openChannels: readonly FieldProfileGraphicsPoint[];
  readonly thinRails: readonly FieldProfileGraphicsPoint[];
  readonly isolated: readonly FieldProfileGraphicsPoint[];
  readonly guardedBlanks: readonly FieldProfileGraphicsRect[];
  readonly controls: readonly FieldProfileGraphicsControls[];
}

/** Exact-owner 4x2 Field-body atlas for normal Canvas/WebGL visual gates. */
export const FIELD_PROFILE_GRAPHICS_ATLAS: readonly FieldProfileGraphicsAtlasEntry[] =
  FIELD_PROFILE_GRAPHICS_DEFINITIONS.map(({ material, code }, index) => {
    const column = index % FIELD_PROFILE_GRAPHICS_ATLAS_COLUMNS;
    const row = Math.floor(index / FIELD_PROFILE_GRAPHICS_ATLAS_COLUMNS);
    const card = {
      x: CARD_ORIGIN_X + column * CARD_STRIDE_X,
      y: CARD_ORIGIN_Y + row * CARD_STRIDE_Y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    };
    const body = { x: card.x + 6, y: card.y + 6, width: 52, height: 42 };
    const pairedBody = { x: card.x + 72, y: card.y + 6, width: 28, height: 28 };
    return {
      material,
      code,
      index,
      card,
      body,
      pairedBody,
      authoredHole: { x: body.x + 22, y: body.y + 16, width: 5, height: 5 },
      openChannel: { x: body.x + body.width - 4, y: body.y + 30, width: 4, height: 5 },
      thinRail: { x: card.x + 110, y: card.y + 6, width: 1, height: 38 },
      isolated: { x: card.x + 128, y: card.y + 20 },
      guardedBlank: { x: card.x + 72, y: card.y + 48, width: 60, height: 16 },
      controls: {
        force: { x: card.x + 6, y: card.y + 72, width: 8, height: 8 },
        device: { x: card.x + 18, y: card.y + 72, width: 8, height: 8 },
        role: { x: card.x + 30, y: card.y + 72, width: 8, height: 8 },
      },
    } satisfies FieldProfileGraphicsAtlasEntry;
  });

export const FIELD_PROFILE_GRAPHICS_AUDIT: FieldProfileGraphicsAuditSnapshot = {
  cards: FIELD_PROFILE_GRAPHICS_ATLAS,
  bodies: FIELD_PROFILE_GRAPHICS_ATLAS.map(({ body }) => body),
  pairedBodies: FIELD_PROFILE_GRAPHICS_ATLAS.map(({ pairedBody }) => pairedBody),
  authoredHoles: FIELD_PROFILE_GRAPHICS_ATLAS.flatMap(({ authoredHole }) => rectPoints(authoredHole)),
  openChannels: FIELD_PROFILE_GRAPHICS_ATLAS.flatMap(({ openChannel }) => rectPoints(openChannel)),
  thinRails: FIELD_PROFILE_GRAPHICS_ATLAS.flatMap(({ thinRail }) => rectPoints(thinRail)),
  isolated: FIELD_PROFILE_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
  guardedBlanks: FIELD_PROFILE_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
  controls: FIELD_PROFILE_GRAPHICS_ATLAS.map(({ controls }) => controls),
};

/** Direct fills paused deterministic matter without invoking tools or native-state APIs. */
export function prepareFieldProfileGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (simulation.name !== 'TypeScript deterministic fallback') {
    throw new Error('Field-profile graphics audit fixture requires the deterministic backend');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Field-profile graphics audit fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of FIELD_PROFILE_GRAPHICS_ATLAS) {
    fillRect(cells, simulation.width, entry.body, entry.material);
    fillRect(cells, simulation.width, entry.pairedBody, entry.material);
    fillRect(cells, simulation.width, entry.authoredHole, Material.Empty);
    fillRect(cells, simulation.width, entry.openChannel, Material.Empty);
    fillRect(cells, simulation.width, entry.thinRail, entry.material);
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = entry.material;
    fillRect(cells, simulation.width, entry.guardedBlank, Material.Empty);
    fillRect(cells, simulation.width, entry.controls.force, Material.ACEL);
    fillRect(cells, simulation.width, entry.controls.device, Material.DTEC);
    fillRect(cells, simulation.width, entry.controls.role, Material.CONV);
  }
}

function fillRect(cells: Uint8Array, worldWidth: number, rect: FieldProfileGraphicsRect, material: Material): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * worldWidth + rect.x, y * worldWidth + rect.x + rect.width);
  }
}

function rectPoints(rect: FieldProfileGraphicsRect): FieldProfileGraphicsPoint[] {
  const points: FieldProfileGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}
