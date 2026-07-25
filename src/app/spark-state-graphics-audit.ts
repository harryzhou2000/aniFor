import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';
import { SPRK_PRESENTATION_STATE } from '../simulation/types';

export const SPARK_STATE_GRAPHICS_ATLAS_COLUMNS = 3;
export const SPARK_STATE_GRAPHICS_ATLAS_ROWS = 2;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 4;
const CARD_ORIGIN_Y = 4;
const CARD_STRIDE_X = 202;
const CARD_STRIDE_Y = 190;
const CARD_WIDTH = 196;
const CARD_HEIGHT = 184;

export type SparkStateGraphicsFamily =
  | 'metallic'
  | 'semiconductor'
  | 'thermal'
  | 'electrode'
  | 'device'
  | 'aqueous';

export type SparkStateGraphicsKey =
  | 'metalFresh'
  | 'semiconductorPropagating'
  | 'thermalMidlife'
  | 'electrodeExpiring'
  | 'switchFresh'
  | 'aqueousPropagating';

export interface SparkStateGraphicsPoint {
  readonly x: number;
  readonly y: number;
}

export interface SparkStateGraphicsRect extends SparkStateGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

export interface SparkNativePresentationState {
  readonly key: SparkStateGraphicsKey;
  readonly family: SparkStateGraphicsFamily;
  /** Exact public identity projected from native SPRK `ctype`. */
  readonly host: Material;
  readonly hostCode: 'METL' | 'NSCN' | 'NTCT' | 'ETRD' | 'SWCH' | 'SLTW';
  /** Exact bounded native SPRK life counter. */
  readonly life: number;
  readonly encodedState: number;
}

/**
 * Packs exact native SPRK ownership into the shared renderer state word.
 *
 * Host zero is deliberately retained as a present-but-unrepresentable control;
 * an all-zero word remains reserved for absent SPRK state.
 */
export function encodeSparkPresentationState(host: Material, life: number): number {
  const encodedHost = clampInteger(host, 0, 0xff);
  const encodedLife = clampInteger(life, 0, SPRK_PRESENTATION_STATE.lifeMaximum);
  return SPRK_PRESENTATION_STATE.presentMask
    | (encodedHost & SPRK_PRESENTATION_STATE.hostMask)
    | ((encodedLife << SPRK_PRESENTATION_STATE.lifeShift)
      & SPRK_PRESENTATION_STATE.lifeMask);
}

export const SPARK_STATE_GRAPHICS_STATES = [
  {
    key: 'metalFresh',
    family: 'metallic',
    host: Material.Metal,
    hostCode: 'METL',
    life: 4,
    encodedState: encodeSparkPresentationState(Material.Metal, 4),
  },
  {
    key: 'semiconductorPropagating',
    family: 'semiconductor',
    host: Material.NSCN,
    hostCode: 'NSCN',
    life: 3,
    encodedState: encodeSparkPresentationState(Material.NSCN, 3),
  },
  {
    key: 'thermalMidlife',
    family: 'thermal',
    host: Material.NTCT,
    hostCode: 'NTCT',
    life: 2,
    encodedState: encodeSparkPresentationState(Material.NTCT, 2),
  },
  {
    key: 'electrodeExpiring',
    family: 'electrode',
    host: Material.ETRD,
    hostCode: 'ETRD',
    life: 1,
    encodedState: encodeSparkPresentationState(Material.ETRD, 1),
  },
  {
    key: 'switchFresh',
    family: 'device',
    host: Material.SWCH,
    hostCode: 'SWCH',
    life: 4,
    encodedState: encodeSparkPresentationState(Material.SWCH, 4),
  },
  {
    key: 'aqueousPropagating',
    family: 'aqueous',
    host: Material.SaltWater,
    hostCode: 'SLTW',
    life: 3,
    encodedState: encodeSparkPresentationState(Material.SaltWater, 3),
  },
] as const satisfies readonly SparkNativePresentationState[];

export interface SparkStateGraphicsAtlasEntry extends SparkNativePresentationState {
  readonly material: Material.SPRK;
  readonly code: 'SPRK';
  readonly index: number;
  readonly card: SparkStateGraphicsRect;
  readonly body: SparkStateGraphicsRect;
  readonly shellProbe: SparkStateGraphicsRect;
  readonly coreProbe: SparkStateGraphicsRect;
  readonly hostProbe: SparkStateGraphicsRect;
  readonly authoredHole: SparkStateGraphicsRect;
  readonly openNotch: SparkStateGraphicsRect;
  readonly thinStructure: SparkStateGraphicsRect;
  readonly isolated: SparkStateGraphicsPoint;
  /** Exact SPRK owner with a deliberately absent state word. */
  readonly zeroState: SparkStateGraphicsRect;
  /** Exact SPRK owner with presence/life but no representable host. */
  readonly unrepresentableHost: SparkStateGraphicsRect;
  /** Sand deliberately carrying the card's complete SPRK state word. */
  readonly wrongOwner: SparkStateGraphicsRect;
  readonly waterControl: SparkStateGraphicsRect;
  readonly metalControl: SparkStateGraphicsRect;
  readonly guardedBlank: SparkStateGraphicsRect;
}

export interface SparkStateGraphicsAuditSnapshot {
  readonly cards: readonly SparkStateGraphicsAtlasEntry[];
  readonly authoredHoles: readonly SparkStateGraphicsPoint[];
  readonly openNotches: readonly SparkStateGraphicsPoint[];
  readonly thinStructures: readonly SparkStateGraphicsPoint[];
  readonly isolated: readonly SparkStateGraphicsPoint[];
  readonly zeroStates: readonly SparkStateGraphicsRect[];
  readonly unrepresentableHosts: readonly SparkStateGraphicsRect[];
  readonly wrongOwners: readonly SparkStateGraphicsRect[];
  readonly waterControls: readonly SparkStateGraphicsRect[];
  readonly metalControls: readonly SparkStateGraphicsRect[];
  readonly guardedBlanks: readonly SparkStateGraphicsRect[];
}

export const SPARK_STATE_GRAPHICS_ATLAS: readonly SparkStateGraphicsAtlasEntry[] =
  SPARK_STATE_GRAPHICS_STATES.map((state, index) => {
    const column = index % SPARK_STATE_GRAPHICS_ATLAS_COLUMNS;
    const row = Math.floor(index / SPARK_STATE_GRAPHICS_ATLAS_COLUMNS);
    const card = {
      x: CARD_ORIGIN_X + column * CARD_STRIDE_X,
      y: CARD_ORIGIN_Y + row * CARD_STRIDE_Y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    };
    const body = { x: card.x + 6, y: card.y + 8, width: 72, height: 64 };
    return {
      ...state,
      material: Material.SPRK,
      code: 'SPRK',
      index,
      card,
      body,
      shellProbe: { x: body.x + 5, y: body.y + 4, width: 8, height: 8 },
      coreProbe: { x: body.x + 18, y: body.y + 45, width: 8, height: 8 },
      hostProbe: { x: body.x + 44, y: body.y + 38, width: 8, height: 8 },
      authoredHole: { x: body.x + 30, y: body.y + 28, width: 6, height: 6 },
      openNotch: { x: body.x + 64, y: body.y + 46, width: 8, height: 8 },
      thinStructure: { x: card.x + 8, y: card.y + 82, width: 1, height: 24 },
      isolated: { x: card.x + 34, y: card.y + 99 },
      zeroState: { x: card.x + 88, y: card.y + 8, width: 14, height: 16 },
      unrepresentableHost: { x: card.x + 108, y: card.y + 8, width: 14, height: 16 },
      wrongOwner: { x: card.x + 128, y: card.y + 8, width: 14, height: 16 },
      waterControl: { x: card.x + 148, y: card.y + 8, width: 14, height: 16 },
      metalControl: { x: card.x + 168, y: card.y + 8, width: 14, height: 16 },
      guardedBlank: { x: card.x + 88, y: card.y + 50, width: 94, height: 64 },
    } satisfies SparkStateGraphicsAtlasEntry;
  });

export const SPARK_STATE_GRAPHICS_AUDIT: SparkStateGraphicsAuditSnapshot = {
  cards: SPARK_STATE_GRAPHICS_ATLAS,
  authoredHoles: SPARK_STATE_GRAPHICS_ATLAS.flatMap(({ authoredHole }) =>
    rectPoints(authoredHole)),
  openNotches: SPARK_STATE_GRAPHICS_ATLAS.flatMap(({ openNotch }) =>
    rectPoints(openNotch)),
  thinStructures: SPARK_STATE_GRAPHICS_ATLAS.flatMap(({ thinStructure }) =>
    rectPoints(thinStructure)),
  isolated: SPARK_STATE_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
  zeroStates: SPARK_STATE_GRAPHICS_ATLAS.map(({ zeroState }) => zeroState),
  unrepresentableHosts: SPARK_STATE_GRAPHICS_ATLAS
    .map(({ unrepresentableHost }) => unrepresentableHost),
  wrongOwners: SPARK_STATE_GRAPHICS_ATLAS.map(({ wrongOwner }) => wrongOwner),
  waterControls: SPARK_STATE_GRAPHICS_ATLAS.map(({ waterControl }) => waterControl),
  metalControls: SPARK_STATE_GRAPHICS_ATLAS.map(({ metalControl }) => metalControl),
  guardedBlanks: SPARK_STATE_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
};

interface SparkStateFixtureBackend extends SimulationBackend {
  presentationState(): Uint16Array;
  setFixturePresentationStateRect(
    x: number, y: number, width: number, height: number, state: number,
  ): void;
  setFixturePresentationState(x: number, y: number, state: number): void;
}

/** Builds a paused exact-owner SPRK host/life atlas without crossing particle paint ABIs. */
export function prepareSparkStateGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (!supportsSparkStateFixture(simulation)) {
    throw new Error('SPRK state graphics audit fixture requires a render-lab state plane');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`SPRK state graphics audit fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  const unrepresentableState = encodeSparkPresentationState(Material.Empty, 4);
  for (const entry of SPARK_STATE_GRAPHICS_ATLAS) {
    fillStateControl(simulation, cells, entry.body, Material.SPRK, entry.encodedState);
    fillStateControl(simulation, cells, entry.authoredHole, Material.Empty, 0);
    fillStateControl(simulation, cells, entry.openNotch, Material.Empty, 0);
    fillStateControl(
      simulation, cells, entry.thinStructure, Material.SPRK, entry.encodedState,
    );
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = Material.SPRK;
    simulation.setFixturePresentationState(
      entry.isolated.x, entry.isolated.y, entry.encodedState,
    );
    fillStateControl(simulation, cells, entry.zeroState, Material.SPRK, 0);
    fillStateControl(
      simulation, cells, entry.unrepresentableHost, Material.SPRK, unrepresentableState,
    );
    fillStateControl(simulation, cells, entry.wrongOwner, Material.Sand, entry.encodedState);
    fillStateControl(simulation, cells, entry.waterControl, Material.Water, entry.encodedState);
    fillStateControl(simulation, cells, entry.metalControl, Material.Metal, entry.encodedState);
    fillStateControl(simulation, cells, entry.guardedBlank, Material.Empty, 0);
  }
}

function supportsSparkStateFixture(
  simulation: SimulationBackend,
): simulation is SparkStateFixtureBackend {
  const candidate = simulation as Partial<SparkStateFixtureBackend>;
  return typeof candidate.presentationState === 'function'
    && typeof candidate.setFixturePresentationStateRect === 'function'
    && typeof candidate.setFixturePresentationState === 'function';
}

function fillStateControl(
  simulation: SparkStateFixtureBackend,
  cells: Uint8Array,
  rect: SparkStateGraphicsRect,
  material: Material,
  state: number,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * simulation.width + rect.x, y * simulation.width + rect.x + rect.width);
  }
  simulation.setFixturePresentationStateRect(rect.x, rect.y, rect.width, rect.height, state);
}

function rectPoints(rect: SparkStateGraphicsRect): SparkStateGraphicsPoint[] {
  const points: SparkStateGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Math.round(value)));
}
