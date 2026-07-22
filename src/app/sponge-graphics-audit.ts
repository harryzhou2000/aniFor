import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;

export interface SpongeGraphicsPoint { readonly x: number; readonly y: number }
export interface SpongeGraphicsRect extends SpongeGraphicsPoint {
  readonly width: number;
  readonly height: number;
}
export interface SpongeGraphicsPorePair {
  readonly core: SpongeGraphicsPoint;
  readonly litRim: SpongeGraphicsPoint;
}
export interface SpongeGraphicsContact {
  readonly owner: SpongeGraphicsRect;
  readonly neighbour: SpongeGraphicsRect;
  readonly neighbourMaterial: Material.Water | Material.Metal | Material.Sand;
}
export interface SpongeGraphicsAtlasEntry {
  readonly material: Material.SPNG;
  readonly code: 'SPNG';
  readonly color: '#ffbe30';
  readonly card: SpongeGraphicsRect;
  readonly body: SpongeGraphicsRect;
  readonly surfaceProbe: SpongeGraphicsRect;
  readonly coreProbe: SpongeGraphicsRect;
  readonly holes: readonly SpongeGraphicsRect[];
  readonly openNotches: readonly SpongeGraphicsRect[];
  readonly ribs: readonly SpongeGraphicsRect[];
  readonly isolated: SpongeGraphicsPoint;
  readonly contacts: readonly SpongeGraphicsContact[];
  readonly guardedBlank: SpongeGraphicsRect;
  readonly porePairs: readonly SpongeGraphicsPorePair[];
}
export interface SpongeGraphicsAuditSnapshot {
  readonly cards: readonly [SpongeGraphicsAtlasEntry];
  readonly holes: readonly SpongeGraphicsPoint[];
  readonly openNotches: readonly SpongeGraphicsPoint[];
  readonly fineStructures: readonly SpongeGraphicsPoint[];
  readonly contacts: readonly SpongeGraphicsContact[];
  readonly porePairs: readonly SpongeGraphicsPorePair[];
}

const BODY: SpongeGraphicsRect = { x: 24, y: 24, width: 280, height: 176 };
const HOLES = [
  { x: 72, y: 60, width: 8, height: 8 },
  { x: 152, y: 104, width: 12, height: 7 },
  { x: 236, y: 48, width: 6, height: 14 },
] as const;
const OPEN_NOTCHES = [
  { x: 292, y: 78, width: 12, height: 8 },
  { x: 192, y: 184, width: 7, height: 16 },
] as const;
const RIBS = [
  { x: 344, y: 30, width: 1, height: 158 },
  { x: 344, y: 90, width: 112, height: 1 },
  { x: 455, y: 90, width: 1, height: 76 },
] as const;
const CONTACTS = [
  { owner: { x: 24, y: 260, width: 20, height: 28 }, neighbour: { x: 44, y: 260, width: 26, height: 28 }, neighbourMaterial: Material.Water },
  { owner: { x: 184, y: 260, width: 20, height: 28 }, neighbour: { x: 204, y: 260, width: 26, height: 28 }, neighbourMaterial: Material.Metal },
  { owner: { x: 344, y: 260, width: 20, height: 28 }, neighbour: { x: 364, y: 260, width: 26, height: 28 }, neighbourMaterial: Material.Sand },
] as const satisfies readonly SpongeGraphicsContact[];

const PORE_PAIRS = buildPorePairs();
export const SPONGE_GRAPHICS_ATLAS: readonly [SpongeGraphicsAtlasEntry] = [{
  material: Material.SPNG,
  code: 'SPNG',
  color: '#ffbe30',
  card: { x: 8, y: 8, width: 596, height: 368 },
  body: BODY,
  surfaceProbe: { x: 36, y: 36, width: 24, height: 16 },
  coreProbe: { x: 170, y: 128, width: 36, height: 28 },
  holes: HOLES,
  openNotches: OPEN_NOTCHES,
  ribs: RIBS,
  isolated: { x: 566, y: 40 },
  contacts: CONTACTS,
  guardedBlank: { x: 474, y: 228, width: 112, height: 112 },
  porePairs: PORE_PAIRS,
}];

export const SPONGE_GRAPHICS_AUDIT: SpongeGraphicsAuditSnapshot = {
  cards: SPONGE_GRAPHICS_ATLAS,
  holes: HOLES.flatMap(rectPoints),
  openNotches: OPEN_NOTCHES.flatMap(rectPoints),
  fineStructures: uniquePoints(RIBS.flatMap(rectPoints)),
  contacts: CONTACTS,
  porePairs: PORE_PAIRS,
};

/** Direct-fills one paused semantic scene without pretending to expose native hydration. */
export function prepareSpongeGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (simulation.name !== 'TypeScript deterministic fallback') {
    throw new Error('Sponge graphics audit fixture requires the deterministic backend');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Sponge graphics audit fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  fillRect(cells, simulation.width, BODY, Material.SPNG);
  for (const hole of HOLES) fillRect(cells, simulation.width, hole, Material.Empty);
  for (const notch of OPEN_NOTCHES) fillRect(cells, simulation.width, notch, Material.Empty);
  for (const rib of RIBS) fillRect(cells, simulation.width, rib, Material.SPNG);
  const isolated = SPONGE_GRAPHICS_ATLAS[0].isolated;
  cells[isolated.y * simulation.width + isolated.x] = Material.SPNG;
  for (const contact of CONTACTS) {
    fillRect(cells, simulation.width, contact.owner, Material.SPNG);
    fillRect(cells, simulation.width, contact.neighbour, contact.neighbourMaterial);
  }
}

function buildPorePairs(): readonly SpongeGraphicsPorePair[] {
  const pairs: SpongeGraphicsPorePair[] = [];
  for (let tileY = 19; tileY < WORLD_HEIGHT; tileY += 19) {
    for (let tileX = 19; tileX < WORLD_WIDTH; tileX += 19) {
      for (const [offsetX, offsetY] of [[5, 5], [14, 12]] as const) {
        const core = { x: tileX + offsetX, y: tileY + offsetY };
        const litRim = { x: core.x - 3, y: core.y };
        if (pointInRect(core, BODY) && pointInRect(litRim, BODY)
          && !HOLES.some((rect) => pointInRect(core, rect) || pointInRect(litRim, rect))
          && !OPEN_NOTCHES.some((rect) => pointInRect(core, rect) || pointInRect(litRim, rect))) {
          pairs.push({ core, litRim });
        }
      }
    }
  }
  return pairs;
}

function fillRect(cells: Uint8Array, width: number, rect: SpongeGraphicsRect, material: Material): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * width + rect.x, y * width + rect.x + rect.width);
  }
}

function rectPoints(rect: SpongeGraphicsRect): SpongeGraphicsPoint[] {
  const points: SpongeGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}

function uniquePoints(points: readonly SpongeGraphicsPoint[]): SpongeGraphicsPoint[] {
  const unique = new Map<string, SpongeGraphicsPoint>();
  for (const point of points) unique.set(`${point.x},${point.y}`, point);
  return [...unique.values()];
}

function pointInRect(point: SpongeGraphicsPoint, rect: SpongeGraphicsRect): boolean {
  return point.x >= rect.x && point.y >= rect.y
    && point.x < rect.x + rect.width && point.y < rect.y + rect.height;
}
