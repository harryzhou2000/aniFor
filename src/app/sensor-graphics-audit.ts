import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

export const SENSOR_GRAPHICS_ATLAS_COLUMNS = 7;
export const SENSOR_GRAPHICS_ATLAS_ROWS = 1;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 8;
const CARD_ORIGIN_Y = 16;
const CARD_STRIDE_X = 86;
const CARD_WIDTH = 80;
const CARD_HEIGHT = 116;

const SENSOR_DEFINITIONS = [
  { material: Material.DTEC, code: 'DTEC', color: '#fd9d18' },
  { material: Material.INVIS, code: 'INVS', color: '#00cccc' },
  { material: Material.LDTC, code: 'LDTC', color: '#66ff66' },
  { material: Material.LSNS, code: 'LSNS', color: '#336699' },
  { material: Material.PSNS, code: 'PSNS', color: '#db2020' },
  { material: Material.TSNS, code: 'TSNS', color: '#fd00d5' },
  { material: Material.VSNS, code: 'VSNS', color: '#7c9c00' },
] as const;

export interface SensorGraphicsPoint {
  readonly x: number;
  readonly y: number;
}

export interface SensorGraphicsRect extends SensorGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

export interface SensorGraphicsAtlasEntry {
  readonly material: Material;
  readonly code: string;
  readonly color: string;
  readonly index: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly card: SensorGraphicsRect;
  readonly body: SensorGraphicsRect;
  /** Three vertically adjacent empty cells open along the body's right edge. */
  readonly openNotch: readonly SensorGraphicsPoint[];
  /** A one-cell-wide conductor-like extension attached to the body. */
  readonly wire: SensorGraphicsRect;
  readonly isolated: SensorGraphicsPoint;
  /** An explicit empty control region protected from authored geometry. */
  readonly guardedBlank: SensorGraphicsRect;
}

export interface SensorGraphicsAuditSnapshot {
  readonly cards: readonly SensorGraphicsAtlasEntry[];
  readonly openNotches: readonly SensorGraphicsPoint[];
  readonly wires: readonly SensorGraphicsPoint[];
  readonly isolated: readonly SensorGraphicsPoint[];
  readonly guardedBlanks: readonly SensorGraphicsRect[];
}

/** Stable seven-card atlas shared by future Canvas, WebGL, and true-8x gates. */
export const SENSOR_GRAPHICS_ATLAS: readonly SensorGraphicsAtlasEntry[] = SENSOR_DEFINITIONS.map(
  ({ material, code, color }, index) => {
    const card = {
      x: CARD_ORIGIN_X + index * CARD_STRIDE_X,
      y: CARD_ORIGIN_Y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    };
    const body = { x: card.x + 8, y: card.y + 8, width: 48, height: 48 };
    const notchY = body.y + 24;
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
      openNotch: Array.from({ length: 3 }, (_, offset) => ({
        x: body.x + body.width - 1,
        y: notchY - 1 + offset,
      })),
      wire: { x: body.x + 23, y: body.y + body.height, width: 1, height: 16 },
      isolated: { x: card.x + 69, y: card.y + 20 },
      guardedBlank: { x: card.x + 56, y: card.y + 74, width: 18, height: 30 },
    };
  },
);

export const SENSOR_GRAPHICS_AUDIT: SensorGraphicsAuditSnapshot = {
  cards: SENSOR_GRAPHICS_ATLAS,
  openNotches: SENSOR_GRAPHICS_ATLAS.flatMap(({ openNotch }) => openNotch),
  wires: SENSOR_GRAPHICS_ATLAS.flatMap(({ wire }) => rectPoints(wire)),
  isolated: SENSOR_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
  guardedBlanks: SENSOR_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
};

/**
 * Direct-fills the paused deterministic backend. Sensor audit setup must never
 * cross the ordinary brush ABI because that would make topology radius-dependent.
 */
export function prepareSensorGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (simulation.name !== 'TypeScript deterministic fallback') {
    throw new Error('Sensor graphics audit fixture requires the deterministic backend');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Sensor graphics audit fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of SENSOR_GRAPHICS_ATLAS) {
    fillRect(cells, simulation.width, entry.body, entry.material);
    for (const point of entry.openNotch) {
      cells[point.y * simulation.width + point.x] = Material.Empty;
    }
    fillRect(cells, simulation.width, entry.wire, entry.material);
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = entry.material;
    fillRect(cells, simulation.width, entry.guardedBlank, Material.Empty);
  }
}

function fillRect(
  cells: Uint8Array,
  worldWidth: number,
  rect: SensorGraphicsRect,
  material: Material,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * worldWidth + rect.x, y * worldWidth + rect.x + rect.width);
  }
}

function rectPoints(rect: SensorGraphicsRect): SensorGraphicsPoint[] {
  const points: SensorGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}
