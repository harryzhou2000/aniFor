import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';
import { WIFI_PRESENTATION_STATE } from '../simulation/types';

export const WIFI_STATE_GRAPHICS_ATLAS_COLUMNS = 4;
export const WIFI_STATE_GRAPHICS_ATLAS_ROWS = 2;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 4;
const CARD_ORIGIN_Y = 4;
const CARD_STRIDE_X = 150;
const CARD_STRIDE_Y = 190;
const CARD_WIDTH = 146;
const CARD_HEIGHT = 180;
const CONDUCTIVE_WALL = 1;

export type WifiStateGraphicsKey =
  | 'channel0Off' | 'channel3Off' | 'channel25Off' | 'channel100Off'
  | 'channel0Active' | 'channel3Active' | 'channel25Active' | 'channel100Active';
export interface WifiStateGraphicsPoint { readonly x: number; readonly y: number }
export interface WifiStateGraphicsRect extends WifiStateGraphicsPoint {
  readonly width: number;
  readonly height: number;
}
export interface WifiNativePresentationState {
  readonly key: WifiStateGraphicsKey;
  readonly channel: number;
  readonly active: boolean;
}

/** Four valid upstream temperature channels, each in exact idle/active state. */
export const WIFI_STATE_GRAPHICS_STATES = [
  { key: 'channel0Off', channel: 0, active: false },
  { key: 'channel3Off', channel: 3, active: false },
  { key: 'channel25Off', channel: 25, active: false },
  { key: 'channel100Off', channel: 100, active: false },
  { key: 'channel0Active', channel: 0, active: true },
  { key: 'channel3Active', channel: 3, active: true },
  { key: 'channel25Active', channel: 25, active: true },
  { key: 'channel100Active', channel: 100, active: true },
] as const satisfies readonly WifiNativePresentationState[];

/** Packs only the native WIFI public channel/activity projection for a paused fixture. */
export function encodeWifiPresentationState(channel: number, active: boolean): number {
  return WIFI_PRESENTATION_STATE.presentMask
    | (Math.max(0, Math.min(WIFI_PRESENTATION_STATE.channelMaximum, Math.round(channel)))
      & WIFI_PRESENTATION_STATE.channelMask)
    | (active ? WIFI_PRESENTATION_STATE.activeMask : 0);
}

export interface WifiStateGraphicsAtlasEntry extends WifiNativePresentationState {
  readonly material: Material.WIFI;
  readonly code: 'WIFI';
  readonly encodedState: number;
  readonly index: number;
  readonly card: WifiStateGraphicsRect;
  readonly body: WifiStateGraphicsRect;
  readonly responseProbe: WifiStateGraphicsRect;
  readonly authoredHole: WifiStateGraphicsRect;
  readonly openNotch: WifiStateGraphicsRect;
  readonly thinStructure: WifiStateGraphicsRect;
  readonly isolated: WifiStateGraphicsPoint;
  /** Exact WIFI with no owner marker must not acquire a channel appearance. */
  readonly absentState: WifiStateGraphicsRect;
  /** A shared channel/activity word must not style a different owner. */
  readonly wrongOwner: WifiStateGraphicsRect;
  /** Native wall composition remains independent from WIFI state styling. */
  readonly wallCoexistence: WifiStateGraphicsRect;
  readonly guardedBlank: WifiStateGraphicsRect;
}

export interface WifiStateGraphicsAuditSnapshot {
  readonly cards: readonly WifiStateGraphicsAtlasEntry[];
  readonly authoredHoles: readonly WifiStateGraphicsPoint[];
  readonly openNotches: readonly WifiStateGraphicsPoint[];
  readonly thinStructures: readonly WifiStateGraphicsPoint[];
  readonly isolated: readonly WifiStateGraphicsPoint[];
  readonly absentStates: readonly WifiStateGraphicsRect[];
  readonly wrongOwners: readonly WifiStateGraphicsRect[];
  readonly wallCoexistence: readonly WifiStateGraphicsRect[];
  readonly guardedBlanks: readonly WifiStateGraphicsRect[];
  readonly conductiveWall: number;
}

/** Stable 0/3/25/100 channel atlas for native WIFI body-state gates. */
export const WIFI_STATE_GRAPHICS_ATLAS: readonly WifiStateGraphicsAtlasEntry[] =
  WIFI_STATE_GRAPHICS_STATES.map((state, index) => {
    const column = index % WIFI_STATE_GRAPHICS_ATLAS_COLUMNS;
    const row = Math.floor(index / WIFI_STATE_GRAPHICS_ATLAS_COLUMNS);
    const card = {
      x: CARD_ORIGIN_X + column * CARD_STRIDE_X,
      y: CARD_ORIGIN_Y + row * CARD_STRIDE_Y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    };
    const body = { x: card.x + 6, y: card.y + 8, width: 76, height: 64 };
    const wallX = card.x + ((4 - (card.x % 4)) % 4);
    const wallY = card.y + 150 + ((4 - ((card.y + 150) % 4)) % 4);
    return {
      ...state,
      material: Material.WIFI,
      code: 'WIFI',
      encodedState: encodeWifiPresentationState(state.channel, state.active),
      index,
      card,
      body,
      responseProbe: { x: body.x + 22, y: body.y + 42, width: 10, height: 10 },
      authoredHole: { x: body.x + 34, y: body.y + 28, width: 6, height: 6 },
      openNotch: { x: body.x + 68, y: body.y + 44, width: 8, height: 8 },
      thinStructure: { x: card.x + 8, y: card.y + 84, width: 1, height: 30 },
      isolated: { x: card.x + 34, y: card.y + 104 },
      absentState: { x: card.x + 6, y: card.y + 126, width: 18, height: 16 },
      wrongOwner: { x: card.x + 32, y: card.y + 126, width: 18, height: 16 },
      // Native walls are 4x4 blocks; this control must be exactly aligned.
      wallCoexistence: { x: wallX, y: wallY, width: 16, height: 16 },
      guardedBlank: { x: card.x + 62, y: card.y + 126, width: 72, height: 40 },
    } satisfies WifiStateGraphicsAtlasEntry;
  });

export const WIFI_STATE_GRAPHICS_AUDIT: WifiStateGraphicsAuditSnapshot = {
  cards: WIFI_STATE_GRAPHICS_ATLAS,
  authoredHoles: WIFI_STATE_GRAPHICS_ATLAS.flatMap(({ authoredHole }) => rectPoints(authoredHole)),
  openNotches: WIFI_STATE_GRAPHICS_ATLAS.flatMap(({ openNotch }) => rectPoints(openNotch)),
  thinStructures: WIFI_STATE_GRAPHICS_ATLAS.flatMap(({ thinStructure }) => rectPoints(thinStructure)),
  isolated: WIFI_STATE_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
  absentStates: WIFI_STATE_GRAPHICS_ATLAS.map(({ absentState }) => absentState),
  wrongOwners: WIFI_STATE_GRAPHICS_ATLAS.map(({ wrongOwner }) => wrongOwner),
  wallCoexistence: WIFI_STATE_GRAPHICS_ATLAS.map(({ wallCoexistence }) => wallCoexistence),
  guardedBlanks: WIFI_STATE_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
  conductiveWall: CONDUCTIVE_WALL,
};

interface WifiStateFixtureBackend extends SimulationBackend {
  presentationState(): Uint16Array;
  walls(): Uint8Array;
  paintWall(x: number, y: number, wall: number, radius: number): void;
  setFixturePresentationStateRect(x: number, y: number, width: number, height: number, state: number): void;
  setFixturePresentationState(x: number, y: number, state: number): void;
}

/** Builds a paused render-lab state plane without invoking native WIFI brush behavior. */
export function prepareWifiStateGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (!supportsWifiStateFixture(simulation)) {
    throw new Error('WIFI state graphics audit fixture requires render-lab state and wall planes');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`WIFI state graphics audit fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of WIFI_STATE_GRAPHICS_ATLAS) {
    fillStateControl(simulation, cells, entry.body, Material.WIFI, entry.encodedState);
    fillStateControl(simulation, cells, entry.authoredHole, Material.Empty, 0);
    fillStateControl(simulation, cells, entry.openNotch, Material.Empty, 0);
    fillStateControl(simulation, cells, entry.thinStructure, Material.WIFI, entry.encodedState);
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = Material.WIFI;
    simulation.setFixturePresentationState(entry.isolated.x, entry.isolated.y, entry.encodedState);
    fillStateControl(simulation, cells, entry.absentState, Material.WIFI, 0);
    fillStateControl(simulation, cells, entry.wrongOwner, Material.Water, entry.encodedState);
    fillStateControl(simulation, cells, entry.wallCoexistence, Material.WIFI, entry.encodedState);
    for (let y = entry.wallCoexistence.y; y < entry.wallCoexistence.y + entry.wallCoexistence.height; y += 4) {
      for (let x = entry.wallCoexistence.x; x < entry.wallCoexistence.x + entry.wallCoexistence.width; x += 4) {
        simulation.paintWall(x, y, CONDUCTIVE_WALL, 0);
      }
    }
    fillStateControl(simulation, cells, entry.guardedBlank, Material.Empty, 0);
  }
}

function supportsWifiStateFixture(simulation: SimulationBackend): simulation is WifiStateFixtureBackend {
  const candidate = simulation as Partial<WifiStateFixtureBackend>;
  return typeof candidate.presentationState === 'function'
    && typeof candidate.walls === 'function'
    && typeof candidate.paintWall === 'function'
    && typeof candidate.setFixturePresentationStateRect === 'function'
    && typeof candidate.setFixturePresentationState === 'function';
}

function fillStateControl(
  simulation: WifiStateFixtureBackend,
  cells: Uint8Array,
  rect: WifiStateGraphicsRect,
  material: Material,
  state: number,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * simulation.width + rect.x, y * simulation.width + rect.x + rect.width);
  }
  simulation.setFixturePresentationStateRect(rect.x, rect.y, rect.width, rect.height, state);
}

function rectPoints(rect: WifiStateGraphicsRect): WifiStateGraphicsPoint[] {
  const points: WifiStateGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}
