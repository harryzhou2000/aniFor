import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';
import { FILT_PRESENTATION_STATE } from '../simulation/types';

export const FILT_STATE_GRAPHICS_ATLAS_COLUMNS = 4;
export const FILT_STATE_GRAPHICS_ATLAS_ROWS = 2;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 4;
const CARD_ORIGIN_Y = 4;
const CARD_STRIDE_X = 150;
const CARD_STRIDE_Y = 188;
const CARD_WIDTH = 146;
const CARD_HEIGHT = 180;

export type FiltStateGraphicsKey =
  | 'red' | 'green' | 'blue' | 'mixedRest' | 'mixedActive' | 'fallbackCold' | 'fallbackHot';

export interface FiltStateGraphicsPoint { readonly x: number; readonly y: number }
export interface FiltStateGraphicsRect extends FiltStateGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

export interface FiltNativePresentationState {
  readonly key: FiltStateGraphicsKey;
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly life: number;
  /** A zero-channel native FILT derives its visible spectrum from temperature. */
  readonly temperature?: number;
}

/** Exact public FILT ctype/life projection cases for state-aware renderer gates. */
export const FILT_STATE_GRAPHICS_STATES = [
  { key: 'red', red: 12, green: 0, blue: 0, life: 0 },
  { key: 'green', red: 0, green: 12, blue: 0, life: 0 },
  { key: 'blue', red: 0, green: 0, blue: 12, life: 0 },
  { key: 'mixedRest', red: 8, green: 4, blue: 10, life: 0 },
  { key: 'mixedActive', red: 8, green: 4, blue: 10, life: 4 },
  { key: 'fallbackCold', red: 0, green: 0, blue: 0, life: 0, temperature: 2730 },
  { key: 'fallbackHot', red: 0, green: 0, blue: 0, life: 4, temperature: 13000 },
] as const satisfies readonly FiltNativePresentationState[];

/**
 * Encodes only FILT's owner-multiplexed public ctype/life word. The present bit
 * distinguishes an actual zero-channel native filter from an unrelated zero word.
 */
export function encodeFiltPresentationState(
  red: number, green: number, blue: number, life: number, present = true,
): number {
  const channel = (value: number, maximum: number, shift: number, mask: number) => (
    (Math.max(0, Math.min(maximum, Math.round(value))) << shift) & mask
  );
  return channel(red, FILT_PRESENTATION_STATE.redMaximum,
    FILT_PRESENTATION_STATE.redShift, FILT_PRESENTATION_STATE.redMask)
    | channel(green, FILT_PRESENTATION_STATE.greenMaximum,
      FILT_PRESENTATION_STATE.greenShift, FILT_PRESENTATION_STATE.greenMask)
    | channel(blue, FILT_PRESENTATION_STATE.blueMaximum,
      FILT_PRESENTATION_STATE.blueShift, FILT_PRESENTATION_STATE.blueMask)
    | channel(life, FILT_PRESENTATION_STATE.lifeMaximum,
      FILT_PRESENTATION_STATE.lifeShift, FILT_PRESENTATION_STATE.lifeMask)
    | (present ? FILT_PRESENTATION_STATE.presentMask : 0);
}

export interface FiltStateGraphicsAtlasEntry extends FiltNativePresentationState {
  readonly material: Material.FILT;
  readonly code: 'FILT';
  readonly encodedState: number;
  readonly index: number;
  readonly card: FiltStateGraphicsRect;
  readonly body: FiltStateGraphicsRect;
  readonly responseProbe: FiltStateGraphicsRect;
  readonly authoredHole: FiltStateGraphicsRect;
  readonly openNotch: FiltStateGraphicsRect;
  readonly thinStructure: FiltStateGraphicsRect;
  readonly isolated: FiltStateGraphicsPoint;
  /** Exact FILT ownership with an absent present bit must stay unstyled. */
  readonly zeroPresentState: FiltStateGraphicsRect;
  /** A public FILT word must not style an unrelated material owner. */
  readonly wrongOwner: FiltStateGraphicsRect;
  readonly guardedBlank: FiltStateGraphicsRect;
}

export interface FiltStateGraphicsAuditSnapshot {
  readonly cards: readonly FiltStateGraphicsAtlasEntry[];
  readonly authoredHoles: readonly FiltStateGraphicsPoint[];
  readonly openNotches: readonly FiltStateGraphicsPoint[];
  readonly thinStructures: readonly FiltStateGraphicsPoint[];
  readonly isolated: readonly FiltStateGraphicsPoint[];
  readonly zeroPresentStates: readonly FiltStateGraphicsRect[];
  readonly wrongOwners: readonly FiltStateGraphicsRect[];
  readonly guardedBlanks: readonly FiltStateGraphicsRect[];
  readonly temperatureFallbacks: readonly FiltStateGraphicsAtlasEntry[];
}

/** Stable seven-card FILT spectrum atlas for Canvas/WebGL and true-8x state gates. */
export const FILT_STATE_GRAPHICS_ATLAS: readonly FiltStateGraphicsAtlasEntry[] =
  FILT_STATE_GRAPHICS_STATES.map((state, index) => {
    const column = index % FILT_STATE_GRAPHICS_ATLAS_COLUMNS;
    const row = Math.floor(index / FILT_STATE_GRAPHICS_ATLAS_COLUMNS);
    const card = {
      x: CARD_ORIGIN_X + column * CARD_STRIDE_X,
      y: CARD_ORIGIN_Y + row * CARD_STRIDE_Y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    };
    const body = { x: card.x + 6, y: card.y + 8, width: 76, height: 64 };
    return {
      ...state,
      material: Material.FILT,
      code: 'FILT',
      encodedState: encodeFiltPresentationState(state.red, state.green, state.blue, state.life),
      index,
      card,
      body,
      responseProbe: { x: body.x + 18, y: body.y + 42, width: 10, height: 10 },
      authoredHole: { x: body.x + 34, y: body.y + 28, width: 6, height: 6 },
      openNotch: { x: body.x + 68, y: body.y + 44, width: 8, height: 8 },
      thinStructure: { x: card.x + 8, y: card.y + 84, width: 1, height: 30 },
      isolated: { x: card.x + 34, y: card.y + 104 },
      zeroPresentState: { x: card.x + 6, y: card.y + 126, width: 18, height: 16 },
      wrongOwner: { x: card.x + 32, y: card.y + 126, width: 18, height: 16 },
      guardedBlank: { x: card.x + 32, y: card.y + 150, width: 72, height: 24 },
    } satisfies FiltStateGraphicsAtlasEntry;
  });

export const FILT_STATE_GRAPHICS_AUDIT: FiltStateGraphicsAuditSnapshot = {
  cards: FILT_STATE_GRAPHICS_ATLAS,
  authoredHoles: FILT_STATE_GRAPHICS_ATLAS.flatMap(({ authoredHole }) => rectPoints(authoredHole)),
  openNotches: FILT_STATE_GRAPHICS_ATLAS.flatMap(({ openNotch }) => rectPoints(openNotch)),
  thinStructures: FILT_STATE_GRAPHICS_ATLAS.flatMap(({ thinStructure }) => rectPoints(thinStructure)),
  isolated: FILT_STATE_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
  zeroPresentStates: FILT_STATE_GRAPHICS_ATLAS.map(({ zeroPresentState }) => zeroPresentState),
  wrongOwners: FILT_STATE_GRAPHICS_ATLAS.map(({ wrongOwner }) => wrongOwner),
  guardedBlanks: FILT_STATE_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
  temperatureFallbacks: FILT_STATE_GRAPHICS_ATLAS.filter(({ temperature }) => temperature !== undefined),
};

interface FiltStateFixtureBackend extends SimulationBackend {
  presentationState(): Uint16Array;
  temperature(): Uint16Array;
  setFixturePresentationStateRect(x: number, y: number, width: number, height: number, state: number): void;
  setFixturePresentationState(x: number, y: number, state: number): void;
  setFixtureTemperatureRect(x: number, y: number, width: number, height: number, temperature: number): void;
}

/** Builds a paused native-state scene entirely through the render-lab field setters. */
export function prepareFiltStateGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (!supportsFiltStateFixture(simulation)) {
    throw new Error('FILT state graphics audit fixture requires render-lab state and temperature planes');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`FILT state graphics audit fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of FILT_STATE_GRAPHICS_ATLAS) {
    fillStateControl(simulation, cells, entry.body, Material.FILT, entry.encodedState);
    if (entry.temperature !== undefined) {
      simulation.setFixtureTemperatureRect(
        entry.body.x, entry.body.y, entry.body.width, entry.body.height, entry.temperature,
      );
    }
    fillStateControl(simulation, cells, entry.authoredHole, Material.Empty, 0);
    fillStateControl(simulation, cells, entry.openNotch, Material.Empty, 0);
    fillStateControl(simulation, cells, entry.thinStructure, Material.FILT, entry.encodedState);
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = Material.FILT;
    simulation.setFixturePresentationState(entry.isolated.x, entry.isolated.y, entry.encodedState);
    fillStateControl(simulation, cells, entry.zeroPresentState, Material.FILT, 0);
    fillStateControl(simulation, cells, entry.wrongOwner, Material.Water, entry.encodedState);
    fillStateControl(simulation, cells, entry.guardedBlank, Material.Empty, 0);
  }
}

function supportsFiltStateFixture(simulation: SimulationBackend): simulation is FiltStateFixtureBackend {
  const candidate = simulation as Partial<FiltStateFixtureBackend>;
  return typeof candidate.presentationState === 'function'
    && typeof candidate.temperature === 'function'
    && typeof candidate.setFixturePresentationStateRect === 'function'
    && typeof candidate.setFixturePresentationState === 'function'
    && typeof candidate.setFixtureTemperatureRect === 'function';
}

function fillStateControl(
  simulation: FiltStateFixtureBackend,
  cells: Uint8Array,
  rect: FiltStateGraphicsRect,
  material: Material,
  state: number,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * simulation.width + rect.x, y * simulation.width + rect.x + rect.width);
  }
  simulation.setFixturePresentationStateRect(rect.x, rect.y, rect.width, rect.height, state);
}

function rectPoints(rect: FiltStateGraphicsRect): FiltStateGraphicsPoint[] {
  const points: FiltStateGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}
