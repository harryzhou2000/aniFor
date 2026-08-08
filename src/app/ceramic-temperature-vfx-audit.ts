import { Material } from '../shared/materials';
import { ROOM_TEMPERATURE_DECIKELVIN } from '../shared/temperature';
import type { SimulationBackend } from '../simulation';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CONDUCTIVE_WALL = 1;
const WALL_BLOCK_SIZE = 4;
const CARD_ORIGIN_X = 4;
const CARD_ORIGIN_Y = 8;
const CARD_STRIDE_X = 120;
const CARD_WIDTH = 116;
const CARD_HEIGHT = 360;

export interface CeramicTemperatureVfxPoint { readonly x: number; readonly y: number }
export interface CeramicTemperatureVfxRect extends CeramicTemperatureVfxPoint {
  readonly width: number;
  readonly height: number;
}

export type CeramicTemperatureVfxKey = 'ambient' | 'onset' | 'warm' | 'orange' | 'bright';

export interface CeramicTemperatureVfxCard {
  readonly key: CeramicTemperatureVfxKey;
  readonly material: Material.Ceramic;
  /** Native TPT decikelvin value, stored exactly in RenderLab's Uint16 plane. */
  readonly temperature: number;
  /** The one-byte semantic carrier observed by the WebGL temperature path. */
  readonly temperatureByte: number;
  readonly card: CeramicTemperatureVfxRect;
  /** Broad exact Ceramic body with a deep, cardinally enclosed core. */
  readonly body: CeramicTemperatureVfxRect;
  readonly core: CeramicTemperatureVfxRect;
  readonly authoredHole: CeramicTemperatureVfxRect;
  readonly openNotch: CeramicTemperatureVfxRect;
  /** Fine target controls intentionally receive the card's temperature. */
  readonly thinLine: CeramicTemperatureVfxRect;
  readonly isolated: CeramicTemperatureVfxPoint;
  /** Exact Ceramic overlaps a native 4x4 conductive-wall checker. */
  readonly wallCoexistence: CeramicTemperatureVfxRect;
  /** Ceramic side is temperature-authored; aqueous side stays ambient. */
  readonly waterContact: {
    readonly ceramic: CeramicTemperatureVfxRect;
    readonly water: CeramicTemperatureVfxRect;
  };
  /** Hot foreign owners prove E82 cannot follow temperature alone. */
  readonly hotControls: {
    readonly brick: CeramicTemperatureVfxRect & { readonly material: Material.Brick };
    readonly metal: CeramicTemperatureVfxRect & { readonly material: Material.Metal };
  };
  readonly guardedBlank: CeramicTemperatureVfxRect;
}

export interface CeramicTemperatureVfxAuditSnapshot {
  readonly version: 1;
  readonly world: { readonly width: 612; readonly height: 384 };
  readonly material: Material.Ceramic;
  readonly ambientTemperature: number;
  readonly cards: readonly CeramicTemperatureVfxCard[];
  readonly conductiveWall: 1;
  readonly expected: {
    readonly ceramicCells: number;
    readonly waterCells: number;
    readonly brickCells: number;
    readonly metalCells: number;
    readonly wallCells: number;
    readonly temperatureCounts: readonly { readonly temperature: number; readonly cells: number }[];
    /** FNV-1a over material bytes and Uint16 temperature low/high bytes. */
    readonly materialHash: number;
    readonly temperatureHash: number;
    readonly wallHash: number;
  };
}

const DEFINITIONS = [
  { key: 'ambient', temperature: ROOM_TEMPERATURE_DECIKELVIN },
  { key: 'onset', temperature: 8_192 },
  { key: 'warm', temperature: 12_288 },
  { key: 'orange', temperature: 15_360 },
  { key: 'bright', temperature: 23_040 },
] as const satisfies readonly { readonly key: CeramicTemperatureVfxKey; readonly temperature: number }[];

const semanticTemperatureByte = (temperature: number): number => Math.floor(temperature / 256);

function card(
  definition: (typeof DEFINITIONS)[number], index: number,
): CeramicTemperatureVfxCard {
  const x = CARD_ORIGIN_X + index * CARD_STRIDE_X;
  const cardRect = { x, y: CARD_ORIGIN_Y, width: CARD_WIDTH, height: CARD_HEIGHT };
  const body = { x: x + 8, y: CARD_ORIGIN_Y + 8, width: 80, height: 72 };
  return {
    ...definition,
    material: Material.Ceramic,
    temperatureByte: semanticTemperatureByte(definition.temperature),
    card: cardRect,
    body,
    // This probe is more than six cells from the right/bottom silhouette and
    // remains disjoint from the void geometry, so it is safe for solid-depth
    // readiness checks as well as direct temperature readback.
    core: { x: body.x + 48, y: body.y + 46, width: 16, height: 16 },
    authoredHole: { x: body.x + 26, y: body.y + 24, width: 8, height: 8 },
    openNotch: { x: body.x + body.width - 1, y: body.y + 42, width: 1, height: 12 },
    thinLine: { x: x + 92, y: CARD_ORIGIN_Y + 8, width: 1, height: 64 },
    isolated: { x: x + 100, y: CARD_ORIGIN_Y + 76 },
    // Both axes align to RenderLab's independent native 4x4 wall proxy.
    wallCoexistence: { x: x + 92, y: CARD_ORIGIN_Y + 96, width: 24, height: 24 },
    waterContact: {
      ceramic: { x: x + 8, y: CARD_ORIGIN_Y + 136, width: 28, height: 20 },
      water: { x: x + 36, y: CARD_ORIGIN_Y + 136, width: 20, height: 20 },
    },
    hotControls: {
      brick: { x: x + 60, y: CARD_ORIGIN_Y + 136, width: 20, height: 20, material: Material.Brick },
      metal: { x: x + 84, y: CARD_ORIGIN_Y + 136, width: 20, height: 20, material: Material.Metal },
    },
    guardedBlank: { x: x + 8, y: CARD_ORIGIN_Y + 176, width: 100, height: 48 },
  } satisfies CeramicTemperatureVfxCard;
}

/**
 * Paused E82 Ceramic temperature atlas. It writes only native RenderLab matter,
 * wall, and Uint16 temperature planes; future rendering experiments own their
 * selector and never mutate this semantic fixture during A/B/A presentation.
 */
export const CERAMIC_TEMPERATURE_VFX_AUDIT: CeramicTemperatureVfxAuditSnapshot = {
  version: 1,
  world: { width: WORLD_WIDTH, height: WORLD_HEIGHT },
  material: Material.Ceramic,
  ambientTemperature: ROOM_TEMPERATURE_DECIKELVIN,
  cards: DEFINITIONS.map(card),
  conductiveWall: CONDUCTIVE_WALL,
  expected: {
    ceramicCells: 34_425,
    waterCells: 2_000,
    brickCells: 2_000,
    metalCells: 2_000,
    wallCells: 1_440,
    temperatureCounts: [
      { temperature: 2_952, cells: 203_468 },
      { temperature: 8_192, cells: 6_885 },
      { temperature: 12_288, cells: 6_885 },
      { temperature: 15_360, cells: 6_885 },
      { temperature: 23_040, cells: 10_885 },
    ],
    materialHash: 2_538_147_332,
    temperatureHash: 1_678_827_139,
    wallHash: 1_396_481_125,
  },
};

interface CeramicTemperatureFixtureBackend extends SimulationBackend {
  walls(): Uint8Array;
  temperature(): Uint16Array;
  paintWall(x: number, y: number, wall: number, radius: number): void;
  setFixtureTemperatureRect(
    x: number, y: number, width: number, height: number, temperature: number,
  ): void;
}

/** Direct-fills one deterministic paused fixture without a brush or physics step. */
export function prepareCeramicTemperatureVfxFixture(simulation: SimulationBackend): void {
  if (!supportsFixture(simulation)) {
    throw new Error('Ceramic temperature VFX fixture requires RenderLab temperature and native wall planes');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Ceramic temperature VFX fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of CERAMIC_TEMPERATURE_VFX_AUDIT.cards) {
    fillRect(cells, simulation.width, entry.body, Material.Ceramic);
    fillRect(cells, simulation.width, entry.authoredHole, Material.Empty);
    fillRect(cells, simulation.width, entry.openNotch, Material.Empty);
    fillRect(cells, simulation.width, entry.thinLine, Material.Ceramic);
    setPoint(cells, simulation.width, entry.isolated, Material.Ceramic);
    fillRect(cells, simulation.width, entry.wallCoexistence, Material.Ceramic);
    paintWallChecker(simulation, entry.wallCoexistence);
    fillRect(cells, simulation.width, entry.waterContact.ceramic, Material.Ceramic);
    fillRect(cells, simulation.width, entry.waterContact.water, Material.Water);
    fillRect(cells, simulation.width, entry.hotControls.brick, Material.Brick);
    fillRect(cells, simulation.width, entry.hotControls.metal, Material.Metal);
    fillRect(cells, simulation.width, entry.guardedBlank, Material.Empty);

    setExactOwnerTemperatureRuns(simulation, cells, entry.body, Material.Ceramic, entry.temperature);
    setExactOwnerTemperatureRuns(simulation, cells, entry.thinLine, Material.Ceramic, entry.temperature);
    simulation.setFixtureTemperatureRect(entry.isolated.x, entry.isolated.y, 1, 1, entry.temperature);
    setExactOwnerTemperatureRuns(simulation, cells, entry.wallCoexistence, Material.Ceramic, entry.temperature);
    setExactOwnerTemperatureRuns(
      simulation, cells, entry.waterContact.ceramic, Material.Ceramic, entry.temperature,
    );
    simulation.setFixtureTemperatureRect(
      entry.hotControls.brick.x, entry.hotControls.brick.y,
      entry.hotControls.brick.width, entry.hotControls.brick.height, 23_040,
    );
    simulation.setFixtureTemperatureRect(
      entry.hotControls.metal.x, entry.hotControls.metal.y,
      entry.hotControls.metal.width, entry.hotControls.metal.height, 23_040,
    );
  }
}

function supportsFixture(simulation: SimulationBackend): simulation is CeramicTemperatureFixtureBackend {
  const candidate = simulation as Partial<CeramicTemperatureFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.temperature === 'function'
    && typeof candidate.paintWall === 'function' && typeof candidate.setFixtureTemperatureRect === 'function';
}

function paintWallChecker(
  simulation: CeramicTemperatureFixtureBackend, region: CeramicTemperatureVfxRect,
): void {
  for (let y = region.y; y < region.y + region.height; y += WALL_BLOCK_SIZE) {
    for (let x = region.x; x < region.x + region.width; x += WALL_BLOCK_SIZE) {
      const column = (x - region.x) / WALL_BLOCK_SIZE;
      const row = (y - region.y) / WALL_BLOCK_SIZE;
      if ((column + row) % 2 === 0) simulation.paintWall(x, y, CONDUCTIVE_WALL, 0);
    }
  }
}

function setExactOwnerTemperatureRuns(
  simulation: CeramicTemperatureFixtureBackend,
  cells: Uint8Array,
  rect: CeramicTemperatureVfxRect,
  owner: Material,
  temperature: number,
): void {
  const right = rect.x + rect.width;
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    let x = rect.x;
    while (x < right) {
      while (x < right && cells[y * simulation.width + x] !== owner) x++;
      const start = x;
      while (x < right && cells[y * simulation.width + x] === owner) x++;
      if (x > start) simulation.setFixtureTemperatureRect(start, y, x - start, 1, temperature);
    }
  }
}

function fillRect(
  cells: Uint8Array, width: number, rect: CeramicTemperatureVfxRect, material: Material,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * width + rect.x, y * width + rect.x + rect.width);
  }
}

function setPoint(
  cells: Uint8Array, width: number, point: CeramicTemperatureVfxPoint, material: Material,
): void {
  cells[point.y * width + point.x] = material;
}
