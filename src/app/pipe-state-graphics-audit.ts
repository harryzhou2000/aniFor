import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';
import { PIPE_PRESENTATION_STATE } from '../simulation/types';

export const PIPE_STATE_GRAPHICS_ATLAS_COLUMNS = 5;
export const PIPE_STATE_GRAPHICS_ATLAS_ROWS = 1;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 4;
const CARD_ORIGIN_Y = 8;
const CARD_STRIDE_X = 121;
const CARD_WIDTH = 117;
const CONDUCTIVE_WALL = 1;

export type PipeStateGraphicsKey = 'liquid' | 'gas' | 'granular' | 'rigid' | 'unknown';
export interface PipeStateGraphicsPoint { readonly x: number; readonly y: number }
export interface PipeStateGraphicsRect extends PipeStateGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

export interface PipePresentationFixtureState {
  readonly payload: number;
  readonly payloadPresent: boolean;
  readonly route: number;
  readonly paused: boolean;
}

/** Packs only the renderer-facing PIPE state; it deliberately does not use a native paint ABI. */
export function encodePipePresentationState({
  payload, payloadPresent, route, paused,
}: PipePresentationFixtureState): number {
  const publicPayload = Math.max(0, Math.min(0xff, Math.round(payload)))
    & PIPE_PRESENTATION_STATE.payloadMask;
  return publicPayload
    | (payloadPresent ? PIPE_PRESENTATION_STATE.payloadPresentMask : 0)
    | ((Math.max(0, Math.min(PIPE_PRESENTATION_STATE.routeMaximum, Math.round(route)))
      << PIPE_PRESENTATION_STATE.routeShift) & PIPE_PRESENTATION_STATE.routeMask)
    | (paused ? PIPE_PRESENTATION_STATE.pausedMask : 0);
}

const KNOWN_STATES = [
  { key: 'liquid', payload: Material.Water, route: 0 },
  { key: 'gas', payload: Material.Smoke, route: 1 },
  { key: 'granular', payload: Material.Sand, route: 2 },
  { key: 'rigid', payload: Material.Metal, route: 3 },
  // 255 cannot name one of AniforTPT's public material IDs. Presence remains
  // explicit so native unknown payloads are not confused with an empty pipe.
  { key: 'unknown', payload: 0xff, route: 3 },
] as const satisfies readonly { readonly key: PipeStateGraphicsKey; readonly payload: number; readonly route: number }[];

export interface PipeStateGraphicsAtlasEntry {
  readonly material: Material.PIPE;
  readonly code: 'PIPE';
  readonly stateKey: PipeStateGraphicsKey;
  readonly payload: number;
  readonly route: number;
  readonly encodedState: number;
  readonly index: number;
  readonly card: PipeStateGraphicsRect;
  readonly body: PipeStateGraphicsRect;
  readonly responseProbe: PipeStateGraphicsRect;
  readonly authoredHole: PipeStateGraphicsRect;
  readonly openNotch: PipeStateGraphicsRect;
  readonly thinStructure: PipeStateGraphicsRect;
  readonly isolated: PipeStateGraphicsPoint;
  /** An exact PIPE owner with no loaded payload, covering all four route colours. */
  readonly emptyRoute: PipeStateGraphicsRect;
  readonly emptyRouteState: number;
  /** PPIP only: pause remains a retained native state bit, not animation. */
  readonly pausedPpip: PipeStateGraphicsRect;
  readonly pausedPpipState: number;
  readonly wrongOwner: PipeStateGraphicsRect;
  readonly wallCoexistence: PipeStateGraphicsRect;
  readonly guardedBlank: PipeStateGraphicsRect;
}

export interface PipeStateGraphicsAuditSnapshot {
  readonly cards: readonly PipeStateGraphicsAtlasEntry[];
  readonly authoredHoles: readonly PipeStateGraphicsPoint[];
  readonly openNotches: readonly PipeStateGraphicsPoint[];
  readonly thinStructures: readonly PipeStateGraphicsPoint[];
  readonly isolated: readonly PipeStateGraphicsPoint[];
  readonly emptyRoutes: readonly PipeStateGraphicsRect[];
  readonly pausedPpip: readonly PipeStateGraphicsRect[];
  readonly wrongOwners: readonly PipeStateGraphicsRect[];
  readonly wallCoexistence: readonly PipeStateGraphicsRect[];
  readonly guardedBlanks: readonly PipeStateGraphicsRect[];
  readonly conductiveWall: number;
}

/** Stable native transport-state cards for normal-detail Canvas/WebGL composition gates. */
export const PIPE_STATE_GRAPHICS_ATLAS: readonly PipeStateGraphicsAtlasEntry[] =
  KNOWN_STATES.map((state, index) => {
    const card = { x: CARD_ORIGIN_X + index * CARD_STRIDE_X, y: CARD_ORIGIN_Y, width: CARD_WIDTH, height: 368 };
    const body = { x: card.x + 6, y: card.y + 8, width: 66, height: 64 };
    const wallX = card.x + ((4 - (card.x % 4)) % 4);
    const encodedState = encodePipePresentationState({ ...state, payloadPresent: true, paused: false });
    const emptyRouteState = encodePipePresentationState({ payload: 0, payloadPresent: false, route: index % 4, paused: false });
    const pausedPpipState = encodePipePresentationState({ ...state, payloadPresent: true, paused: true });
    return {
      material: Material.PIPE,
      code: 'PIPE',
      stateKey: state.key,
      payload: state.payload,
      route: state.route,
      encodedState,
      index,
      card,
      body,
      responseProbe: { x: body.x + 18, y: body.y + 42, width: 10, height: 10 },
      authoredHole: { x: body.x + 28, y: body.y + 28, width: 6, height: 6 },
      openNotch: { x: body.x + 58, y: body.y + 44, width: 8, height: 8 },
      thinStructure: { x: card.x + 8, y: card.y + 84, width: 1, height: 30 },
      isolated: { x: card.x + 34, y: card.y + 104 },
      emptyRoute: { x: card.x + 6, y: card.y + 126, width: 18, height: 16 },
      emptyRouteState,
      pausedPpip: { x: card.x + 32, y: card.y + 126, width: 18, height: 16 },
      pausedPpipState,
      wrongOwner: { x: card.x + 58, y: card.y + 126, width: 18, height: 16 },
      // Native walls occupy 4×4 cells, so keep this audit rectangle block-aligned.
      wallCoexistence: { x: wallX, y: card.y + 156, width: 16, height: 16 },
      guardedBlank: { x: card.x + 32, y: card.y + 190, width: 72, height: 60 },
    } satisfies PipeStateGraphicsAtlasEntry;
  });

export const PIPE_STATE_GRAPHICS_AUDIT: PipeStateGraphicsAuditSnapshot = {
  cards: PIPE_STATE_GRAPHICS_ATLAS,
  authoredHoles: PIPE_STATE_GRAPHICS_ATLAS.flatMap(({ authoredHole }) => rectPoints(authoredHole)),
  openNotches: PIPE_STATE_GRAPHICS_ATLAS.flatMap(({ openNotch }) => rectPoints(openNotch)),
  thinStructures: PIPE_STATE_GRAPHICS_ATLAS.flatMap(({ thinStructure }) => rectPoints(thinStructure)),
  isolated: PIPE_STATE_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
  emptyRoutes: PIPE_STATE_GRAPHICS_ATLAS.map(({ emptyRoute }) => emptyRoute),
  pausedPpip: PIPE_STATE_GRAPHICS_ATLAS.map(({ pausedPpip }) => pausedPpip),
  wrongOwners: PIPE_STATE_GRAPHICS_ATLAS.map(({ wrongOwner }) => wrongOwner),
  wallCoexistence: PIPE_STATE_GRAPHICS_ATLAS.map(({ wallCoexistence }) => wallCoexistence),
  guardedBlanks: PIPE_STATE_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
  conductiveWall: CONDUCTIVE_WALL,
};

interface PipeStateFixtureBackend extends SimulationBackend {
  presentationState(): Uint16Array;
  walls(): Uint8Array;
  paintWall(x: number, y: number, wall: number, radius: number): void;
  setFixturePresentationStateRect(x: number, y: number, width: number, height: number, state: number): void;
  setFixturePresentationState(x: number, y: number, state: number): void;
}

/** Builds one paused owner/state atlas without pretending fixture words are native writes. */
export function preparePipeStateGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (!supportsPipeStateFixture(simulation)) {
    throw new Error('PIPE state graphics audit fixture requires render-lab state and wall planes');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`PIPE state graphics audit fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of PIPE_STATE_GRAPHICS_ATLAS) {
    fillStateControl(simulation, cells, entry.body, Material.PIPE, entry.encodedState);
    fillStateControl(simulation, cells, entry.authoredHole, Material.Empty, 0);
    fillStateControl(simulation, cells, entry.openNotch, Material.Empty, 0);
    fillStateControl(simulation, cells, entry.thinStructure, Material.PIPE, entry.encodedState);
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = Material.PIPE;
    simulation.setFixturePresentationState(entry.isolated.x, entry.isolated.y, entry.encodedState);
    fillStateControl(simulation, cells, entry.emptyRoute, Material.PIPE, entry.emptyRouteState);
    fillStateControl(simulation, cells, entry.pausedPpip, Material.PPIP, entry.pausedPpipState);
    fillStateControl(simulation, cells, entry.wrongOwner, Material.Water, entry.encodedState);
    fillStateControl(simulation, cells, entry.wallCoexistence, Material.PIPE, entry.encodedState);
    for (let y = entry.wallCoexistence.y; y < entry.wallCoexistence.y + entry.wallCoexistence.height; y += 4) {
      for (let x = entry.wallCoexistence.x; x < entry.wallCoexistence.x + entry.wallCoexistence.width; x += 4) {
        simulation.paintWall(x, y, CONDUCTIVE_WALL, 0);
      }
    }
    fillStateControl(simulation, cells, entry.guardedBlank, Material.Empty, 0);
  }
}

function supportsPipeStateFixture(simulation: SimulationBackend): simulation is PipeStateFixtureBackend {
  const candidate = simulation as Partial<PipeStateFixtureBackend>;
  return typeof candidate.presentationState === 'function'
    && typeof candidate.walls === 'function'
    && typeof candidate.paintWall === 'function'
    && typeof candidate.setFixturePresentationStateRect === 'function'
    && typeof candidate.setFixturePresentationState === 'function';
}

function fillStateControl(
  simulation: PipeStateFixtureBackend,
  cells: Uint8Array,
  rect: PipeStateGraphicsRect,
  material: Material,
  state: number,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * simulation.width + rect.x, y * simulation.width + rect.x + rect.width);
  }
  simulation.setFixturePresentationStateRect(rect.x, rect.y, rect.width, rect.height, state);
}

function rectPoints(rect: PipeStateGraphicsRect): PipeStateGraphicsPoint[] {
  const points: PipeStateGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}
