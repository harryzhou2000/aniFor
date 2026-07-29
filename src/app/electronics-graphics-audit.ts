import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

export const ELECTRONICS_GRAPHICS_ATLAS_COLUMNS = 5;
export const ELECTRONICS_GRAPHICS_ATLAS_ROWS = 4;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 8;
const CARD_ORIGIN_Y = 4;
const CARD_STRIDE_X = 120;
const CARD_STRIDE_Y = 94;
const CARD_WIDTH = 112;
const CARD_HEIGHT = 88;

const ELECTRONICS_GRAPHICS_DEFINITIONS = [
  { material: Material.ARAY, code: 'ARAY' },
  { material: Material.BTRY, code: 'BTRY' },
  { material: Material.DRAY, code: 'DRAY' },
  { material: Material.EMP, code: 'EMP' },
  { material: Material.ETRD, code: 'ETRD' },
  { material: Material.INSL, code: 'INSL' },
  { material: Material.INST, code: 'INST' },
  { material: Material.INWR, code: 'INWR' },
  { material: Material.NSCN, code: 'NSCN' },
  { material: Material.NTCT, code: 'NTCT' },
  { material: Material.PSCN, code: 'PSCN' },
  { material: Material.PTCT, code: 'PTCT' },
  { material: Material.SWCH, code: 'SWCH' },
  { material: Material.TESC, code: 'TESC' },
  { material: Material.TUNG, code: 'TUNG' },
  { material: Material.WIFI, code: 'WIFI' },
  { material: Material.WIRE, code: 'WIRE' },
  { material: Material.DLAY, code: 'DLAY' },
  { material: Material.HSWC, code: 'HSWC' },
  { material: Material.LCRY, code: 'LCRY' },
] as const;

export interface ElectronicsGraphicsPoint {
  readonly x: number;
  readonly y: number;
}

export interface ElectronicsGraphicsRect extends ElectronicsGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

export interface ElectronicsGraphicsMetalContact {
  readonly owner: ElectronicsGraphicsRect;
  readonly metal: ElectronicsGraphicsRect;
  readonly material: Material.Metal;
}

/**
 * These exact semantic owners are intentionally outside the new electronics
 * layer: CRAY/PCLN retain source-target state, PIPE retains its transport-body
 * layer, and SPRK retains its own emissive native-state layer.
 */
export interface ElectronicsGraphicsControls {
  readonly cray: ElectronicsGraphicsRect;
  readonly pcln: ElectronicsGraphicsRect;
  readonly pipe: ElectronicsGraphicsRect;
  readonly spark: ElectronicsGraphicsRect;
}

export interface ElectronicsGraphicsAtlasEntry {
  readonly material: Material;
  readonly code: string;
  readonly index: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly card: ElectronicsGraphicsRect;
  readonly body: ElectronicsGraphicsRect;
  readonly pairedBody: ElectronicsGraphicsRect;
  readonly authoredHole: ElectronicsGraphicsRect;
  readonly openChannel: ElectronicsGraphicsRect;
  readonly thinRail: ElectronicsGraphicsRect;
  readonly isolated: ElectronicsGraphicsPoint;
  readonly guardedBlank: ElectronicsGraphicsRect;
  readonly metalContact: ElectronicsGraphicsMetalContact;
  readonly controls: ElectronicsGraphicsControls;
}

export interface ElectronicsGraphicsAuditSnapshot {
  readonly cards: readonly ElectronicsGraphicsAtlasEntry[];
  readonly bodies: readonly ElectronicsGraphicsRect[];
  readonly pairedBodies: readonly ElectronicsGraphicsRect[];
  readonly authoredHoles: readonly ElectronicsGraphicsPoint[];
  readonly openChannels: readonly ElectronicsGraphicsPoint[];
  readonly thinRails: readonly ElectronicsGraphicsPoint[];
  readonly isolated: readonly ElectronicsGraphicsPoint[];
  readonly guardedBlanks: readonly ElectronicsGraphicsRect[];
  readonly metalContacts: readonly ElectronicsGraphicsMetalContact[];
  readonly controls: readonly ElectronicsGraphicsControls[];
}

/**
 * Compact 5x4 exact-owner atlas for canonical WebGL electronics identity work.
 * Native walls are intentionally not represented: the deterministic fixture
 * backend has no wall plane, and a particle Wall would not prove wall coexistence.
 */
export const ELECTRONICS_GRAPHICS_ATLAS: readonly ElectronicsGraphicsAtlasEntry[] =
  ELECTRONICS_GRAPHICS_DEFINITIONS.map(({ material, code }, index) => {
    const column = index % ELECTRONICS_GRAPHICS_ATLAS_COLUMNS;
    const row = Math.floor(index / ELECTRONICS_GRAPHICS_ATLAS_COLUMNS);
    const card = {
      x: CARD_ORIGIN_X + column * CARD_STRIDE_X,
      y: CARD_ORIGIN_Y + row * CARD_STRIDE_Y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    };
    const body = { x: card.x + 6, y: card.y + 6, width: 40, height: 32 };
    const pairedBody = { x: card.x + 56, y: card.y + 6, width: 22, height: 22 };
    const controlTop = card.y + 70;
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
      authoredHole: { x: body.x + 17, y: body.y + 13, width: 4, height: 4 },
      openChannel: { x: body.x + body.width - 4, y: body.y + 23, width: 4, height: 5 },
      thinRail: { x: card.x + 84, y: card.y + 6, width: 1, height: 28 },
      isolated: { x: card.x + 97, y: card.y + 20 },
      guardedBlank: { x: card.x + 56, y: card.y + 42, width: 48, height: 16 },
      metalContact: {
        owner: { x: card.x + 56, y: card.y + 72, width: 10, height: 10 },
        metal: { x: card.x + 66, y: card.y + 72, width: 10, height: 10 },
        material: Material.Metal,
      },
      controls: {
        cray: { x: card.x + 6, y: controlTop, width: 8, height: 8 },
        pcln: { x: card.x + 18, y: controlTop, width: 8, height: 8 },
        pipe: { x: card.x + 30, y: controlTop, width: 8, height: 8 },
        spark: { x: card.x + 42, y: controlTop, width: 8, height: 8 },
      },
    } satisfies ElectronicsGraphicsAtlasEntry;
  });

export const ELECTRONICS_GRAPHICS_AUDIT: ElectronicsGraphicsAuditSnapshot = {
  cards: ELECTRONICS_GRAPHICS_ATLAS,
  bodies: ELECTRONICS_GRAPHICS_ATLAS.map(({ body }) => body),
  pairedBodies: ELECTRONICS_GRAPHICS_ATLAS.map(({ pairedBody }) => pairedBody),
  authoredHoles: ELECTRONICS_GRAPHICS_ATLAS.flatMap(({ authoredHole }) => rectPoints(authoredHole)),
  openChannels: ELECTRONICS_GRAPHICS_ATLAS.flatMap(({ openChannel }) => rectPoints(openChannel)),
  thinRails: ELECTRONICS_GRAPHICS_ATLAS.flatMap(({ thinRail }) => rectPoints(thinRail)),
  isolated: ELECTRONICS_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
  guardedBlanks: ELECTRONICS_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
  metalContacts: ELECTRONICS_GRAPHICS_ATLAS.map(({ metalContact }) => metalContact),
  controls: ELECTRONICS_GRAPHICS_ATLAS.map(({ controls }) => controls),
};

/** Direct-fills paused deterministic matter without invoking tool, source, or state ABIs. */
export function prepareElectronicsGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (simulation.name !== 'TypeScript deterministic fallback') {
    throw new Error('Electronics graphics audit fixture requires the deterministic backend');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Electronics graphics audit fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of ELECTRONICS_GRAPHICS_ATLAS) {
    fillRect(cells, simulation.width, entry.body, entry.material);
    fillRect(cells, simulation.width, entry.pairedBody, entry.material);
    fillRect(cells, simulation.width, entry.authoredHole, Material.Empty);
    fillRect(cells, simulation.width, entry.openChannel, Material.Empty);
    fillRect(cells, simulation.width, entry.thinRail, entry.material);
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = entry.material;
    fillRect(cells, simulation.width, entry.guardedBlank, Material.Empty);
    fillRect(cells, simulation.width, entry.metalContact.owner, entry.material);
    fillRect(cells, simulation.width, entry.metalContact.metal, entry.metalContact.material);
    fillRect(cells, simulation.width, entry.controls.cray, Material.CRAY);
    fillRect(cells, simulation.width, entry.controls.pcln, Material.PCLN);
    fillRect(cells, simulation.width, entry.controls.pipe, Material.PIPE);
    fillRect(cells, simulation.width, entry.controls.spark, Material.SPRK);
  }
}

function fillRect(
  cells: Uint8Array,
  worldWidth: number,
  rect: ElectronicsGraphicsRect,
  material: Material,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * worldWidth + rect.x, y * worldWidth + rect.x + rect.width);
  }
}

function rectPoints(rect: ElectronicsGraphicsRect): ElectronicsGraphicsPoint[] {
  const points: ElectronicsGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}
