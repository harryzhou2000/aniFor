import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';
import { SPNG_PRESENTATION_STATE } from '../simulation/types';

export const SPNG_STATE_GRAPHICS_ATLAS_COLUMNS = 5;
export const SPNG_STATE_GRAPHICS_ATLAS_ROWS = 1;
export const SPNG_HYDRATION_MAXIMUM = SPNG_PRESENTATION_STATE.hydrationMaximum;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 4;
const CARD_ORIGIN_Y = 8;
const CARD_STRIDE_X = 121;
const CARD_WIDTH = 117;
const CARD_HEIGHT = 368;

export type SpngStateGraphicsKey = 'dry' | 'low' | 'mid' | 'high' | 'saturated';

export interface SpngStateGraphicsPoint { readonly x: number; readonly y: number }
export interface SpngStateGraphicsRect extends SpngStateGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

export interface SpngNativePresentationState {
  readonly key: SpngStateGraphicsKey;
  /** Exact native SPNG `life` hydration, from dry 0 through saturated 50. */
  readonly hydration: number;
}

export const SPNG_STATE_GRAPHICS_STATES = [
  { key: 'dry', hydration: 0 },
  { key: 'low', hydration: 10 },
  { key: 'mid', hydration: 25 },
  { key: 'high', hydration: 40 },
  { key: 'saturated', hydration: SPNG_HYDRATION_MAXIMUM },
] as const satisfies readonly SpngNativePresentationState[];

/** Preserves exact native life while distinguishing authoritative dry SPNG from absent state. */
export function encodeSpngHydrationPresentationState(hydration: number): number {
  return SPNG_PRESENTATION_STATE.presentMask
    | (Math.max(0, Math.min(SPNG_HYDRATION_MAXIMUM, Math.round(hydration)))
      & SPNG_PRESENTATION_STATE.hydrationMask);
}

export interface SpngStateGraphicsAtlasEntry extends SpngNativePresentationState {
  readonly material: Material.SPNG;
  readonly code: 'SPNG';
  readonly encodedState: number;
  readonly index: number;
  readonly card: SpngStateGraphicsRect;
  readonly body: SpngStateGraphicsRect;
  readonly surfaceProbe: SpngStateGraphicsRect;
  readonly coreProbe: SpngStateGraphicsRect;
  readonly hydrationProbe: SpngStateGraphicsRect;
  readonly backgroundProbe: SpngStateGraphicsRect;
  readonly authoredHole: SpngStateGraphicsRect;
  readonly openNotch: SpngStateGraphicsRect;
  readonly thinStructure: SpngStateGraphicsRect;
  readonly isolated: SpngStateGraphicsPoint;
  /** Exact SPNG owner with a deliberately absent state word; styling must be a no-op. */
  readonly zeroState: SpngStateGraphicsRect;
  /** Unrelated matter deliberately carrying the card's hydration word. */
  readonly wrongOwner: SpngStateGraphicsRect;
  readonly waterControl: SpngStateGraphicsRect;
  readonly steamControl: SpngStateGraphicsRect;
  readonly saltControl: SpngStateGraphicsRect;
  readonly guardedBlank: SpngStateGraphicsRect;
}

export interface SpngStateGraphicsAuditSnapshot {
  readonly cards: readonly SpngStateGraphicsAtlasEntry[];
  readonly authoredHoles: readonly SpngStateGraphicsPoint[];
  readonly openNotches: readonly SpngStateGraphicsPoint[];
  readonly thinStructures: readonly SpngStateGraphicsPoint[];
  readonly isolated: readonly SpngStateGraphicsPoint[];
  readonly zeroStates: readonly SpngStateGraphicsRect[];
  readonly wrongOwners: readonly SpngStateGraphicsRect[];
  readonly waterControls: readonly SpngStateGraphicsRect[];
  readonly steamControls: readonly SpngStateGraphicsRect[];
  readonly saltControls: readonly SpngStateGraphicsRect[];
  readonly guardedBlanks: readonly SpngStateGraphicsRect[];
}

export const SPNG_STATE_GRAPHICS_ATLAS: readonly SpngStateGraphicsAtlasEntry[] =
  SPNG_STATE_GRAPHICS_STATES.map((state, index) => {
    const card = {
      x: CARD_ORIGIN_X + index * CARD_STRIDE_X,
      y: CARD_ORIGIN_Y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    };
    const body = { x: card.x + 6, y: card.y + 8, width: 66, height: 64 };
    return {
      ...state,
      material: Material.SPNG,
      code: 'SPNG',
      encodedState: encodeSpngHydrationPresentationState(state.hydration),
      index,
      card,
      body,
      surfaceProbe: { x: body.x + 4, y: body.y + 4, width: 8, height: 8 },
      coreProbe: { x: body.x + 20, y: body.y + 44, width: 8, height: 8 },
      hydrationProbe: { x: body.x + 40, y: body.y + 36, width: 8, height: 8 },
      backgroundProbe: { x: body.x + 8, y: body.y + 36, width: 8, height: 8 },
      authoredHole: { x: body.x + 28, y: body.y + 28, width: 6, height: 6 },
      openNotch: { x: body.x + 58, y: body.y + 44, width: 8, height: 8 },
      thinStructure: { x: card.x + 8, y: card.y + 84, width: 1, height: 30 },
      isolated: { x: card.x + 34, y: card.y + 104 },
      zeroState: { x: card.x + 6, y: card.y + 126, width: 18, height: 16 },
      wrongOwner: { x: card.x + 32, y: card.y + 126, width: 18, height: 16 },
      waterControl: { x: card.x + 58, y: card.y + 126, width: 18, height: 16 },
      steamControl: { x: card.x + 84, y: card.y + 126, width: 18, height: 16 },
      saltControl: { x: card.x + 6, y: card.y + 152, width: 18, height: 16 },
      guardedBlank: { x: card.x + 32, y: card.y + 190, width: 72, height: 60 },
    } satisfies SpngStateGraphicsAtlasEntry;
  });

export const SPNG_STATE_GRAPHICS_AUDIT: SpngStateGraphicsAuditSnapshot = {
  cards: SPNG_STATE_GRAPHICS_ATLAS,
  authoredHoles: SPNG_STATE_GRAPHICS_ATLAS.flatMap(({ authoredHole }) => rectPoints(authoredHole)),
  openNotches: SPNG_STATE_GRAPHICS_ATLAS.flatMap(({ openNotch }) => rectPoints(openNotch)),
  thinStructures: SPNG_STATE_GRAPHICS_ATLAS.flatMap(({ thinStructure }) => rectPoints(thinStructure)),
  isolated: SPNG_STATE_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
  zeroStates: SPNG_STATE_GRAPHICS_ATLAS.map(({ zeroState }) => zeroState),
  wrongOwners: SPNG_STATE_GRAPHICS_ATLAS.map(({ wrongOwner }) => wrongOwner),
  waterControls: SPNG_STATE_GRAPHICS_ATLAS.map(({ waterControl }) => waterControl),
  steamControls: SPNG_STATE_GRAPHICS_ATLAS.map(({ steamControl }) => steamControl),
  saltControls: SPNG_STATE_GRAPHICS_ATLAS.map(({ saltControl }) => saltControl),
  guardedBlanks: SPNG_STATE_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
};

interface SpngStateFixtureBackend extends SimulationBackend {
  presentationState(): Uint16Array;
  setFixturePresentationStateRect(
    x: number, y: number, width: number, height: number, state: number,
  ): void;
  setFixturePresentationState(x: number, y: number, state: number): void;
}

/** Builds one paused exact-owner hydration atlas without crossing native particle ABIs. */
export function prepareSpngStateGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (!supportsSpngStateFixture(simulation)) {
    throw new Error('SPNG state graphics audit fixture requires a render-lab state plane');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`SPNG state graphics audit fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of SPNG_STATE_GRAPHICS_ATLAS) {
    fillStateControl(simulation, cells, entry.body, Material.SPNG, entry.encodedState);
    fillStateControl(simulation, cells, entry.authoredHole, Material.Empty, 0);
    fillStateControl(simulation, cells, entry.openNotch, Material.Empty, 0);
    fillStateControl(simulation, cells, entry.thinStructure, Material.SPNG, entry.encodedState);
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = Material.SPNG;
    simulation.setFixturePresentationState(
      entry.isolated.x, entry.isolated.y, entry.encodedState,
    );
    fillStateControl(simulation, cells, entry.zeroState, Material.SPNG, 0);
    fillStateControl(simulation, cells, entry.wrongOwner, Material.Sand, entry.encodedState);
    fillStateControl(simulation, cells, entry.waterControl, Material.Water, entry.encodedState);
    fillStateControl(simulation, cells, entry.steamControl, Material.Steam, entry.encodedState);
    fillStateControl(simulation, cells, entry.saltControl, Material.Salt, entry.encodedState);
    fillStateControl(simulation, cells, entry.guardedBlank, Material.Empty, 0);
  }
}

function supportsSpngStateFixture(
  simulation: SimulationBackend,
): simulation is SpngStateFixtureBackend {
  const candidate = simulation as Partial<SpngStateFixtureBackend>;
  return typeof candidate.presentationState === 'function'
    && typeof candidate.setFixturePresentationStateRect === 'function'
    && typeof candidate.setFixturePresentationState === 'function';
}

function fillStateControl(
  simulation: SpngStateFixtureBackend,
  cells: Uint8Array,
  rect: SpngStateGraphicsRect,
  material: Material,
  state: number,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * simulation.width + rect.x, y * simulation.width + rect.x + rect.width);
  }
  simulation.setFixturePresentationStateRect(rect.x, rect.y, rect.width, rect.height, state);
}

function rectPoints(rect: SpngStateGraphicsRect): SpngStateGraphicsPoint[] {
  const points: SpngStateGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}
