import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';
import { STOR_PRESENTATION_STATE } from '../simulation/types';

export const STOR_STATE_GRAPHICS_ATLAS_COLUMNS = 5;
export const STOR_STATE_GRAPHICS_ATLAS_ROWS = 1;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 4;
const CARD_ORIGIN_Y = 8;
const CARD_STRIDE_X = 121;
const CARD_WIDTH = 117;
const CONDUCTIVE_WALL = 1;

export type StorStateGraphicsKey = 'unloaded' | 'water' | 'fire' | 'unknown' | 'cooldown';
export interface StorStateGraphicsPoint { readonly x: number; readonly y: number }
export interface StorStateGraphicsRect extends StorStateGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

export interface StorPresentationFixtureState {
  readonly payload: number;
  readonly payloadPresent: boolean;
  readonly cooldown: boolean;
}

/** Packs the public native STOR projection without using a particle-write ABI. */
export function encodeStorPresentationState({
  payload, payloadPresent, cooldown,
}: StorPresentationFixtureState): number {
  return (Math.max(0, Math.min(0xff, Math.round(payload))) & STOR_PRESENTATION_STATE.payloadMask)
    | (payloadPresent ? STOR_PRESENTATION_STATE.payloadPresentMask : 0)
    | (cooldown ? STOR_PRESENTATION_STATE.cooldownMask : 0);
}

export const STOR_STATE_GRAPHICS_STATES = [
  { key: 'unloaded', payload: 0, payloadPresent: false, cooldown: false },
  { key: 'water', payload: Material.Water, payloadPresent: true, cooldown: false },
  { key: 'fire', payload: Material.Fire, payloadPresent: true, cooldown: false },
  // A native retained type without a public material projection remains loaded.
  { key: 'unknown', payload: 0xff, payloadPresent: true, cooldown: false },
  // Official PSCN release clears tmp before the native post-release cooldown.
  { key: 'cooldown', payload: 0, payloadPresent: false, cooldown: true },
] as const satisfies readonly ({ readonly key: StorStateGraphicsKey } & StorPresentationFixtureState)[];

export interface StorStateGraphicsAtlasEntry {
  readonly material: Material.STOR;
  readonly code: 'STOR';
  readonly stateKey: StorStateGraphicsKey;
  readonly payload: number;
  readonly payloadPresent: boolean;
  readonly cooldown: boolean;
  readonly encodedState: number;
  readonly index: number;
  readonly card: StorStateGraphicsRect;
  readonly body: StorStateGraphicsRect;
  readonly responseProbe: StorStateGraphicsRect;
  readonly authoredHole: StorStateGraphicsRect;
  readonly openNotch: StorStateGraphicsRect;
  readonly thinStructure: StorStateGraphicsRect;
  readonly isolated: StorStateGraphicsPoint;
  /** Exact STOR owner with an intentionally zero state word. */
  readonly zeroState: StorStateGraphicsRect;
  /** Another owner carrying this STOR word must remain untouched. */
  readonly wrongOwner: StorStateGraphicsRect;
  /** Co-located native wall must remain independent from STOR state styling. */
  readonly wallCoexistence: StorStateGraphicsRect;
  readonly guardedBlank: StorStateGraphicsRect;
}

export interface StorStateGraphicsAuditSnapshot {
  readonly cards: readonly StorStateGraphicsAtlasEntry[];
  readonly authoredHoles: readonly StorStateGraphicsPoint[];
  readonly openNotches: readonly StorStateGraphicsPoint[];
  readonly thinStructures: readonly StorStateGraphicsPoint[];
  readonly isolated: readonly StorStateGraphicsPoint[];
  readonly zeroStates: readonly StorStateGraphicsRect[];
  readonly wrongOwners: readonly StorStateGraphicsRect[];
  readonly wallCoexistence: readonly StorStateGraphicsRect[];
  readonly guardedBlanks: readonly StorStateGraphicsRect[];
  readonly conductiveWall: number;
}

/** Stable owner/state atlas for STOR's retained native storage projection. */
export const STOR_STATE_GRAPHICS_ATLAS: readonly StorStateGraphicsAtlasEntry[] =
  STOR_STATE_GRAPHICS_STATES.map((state, index) => {
    const card = { x: CARD_ORIGIN_X + index * CARD_STRIDE_X, y: CARD_ORIGIN_Y, width: CARD_WIDTH, height: 368 };
    const body = { x: card.x + 6, y: card.y + 8, width: 66, height: 64 };
    const wallX = card.x + ((4 - (card.x % 4)) % 4);
    const encodedState = encodeStorPresentationState(state);
    return {
      material: Material.STOR,
      code: 'STOR',
      ...state,
      stateKey: state.key,
      encodedState,
      index,
      card,
      body,
      responseProbe: { x: body.x + 18, y: body.y + 42, width: 10, height: 10 },
      authoredHole: { x: body.x + 28, y: body.y + 28, width: 6, height: 6 },
      openNotch: { x: body.x + 58, y: body.y + 44, width: 8, height: 8 },
      thinStructure: { x: card.x + 8, y: card.y + 84, width: 1, height: 30 },
      isolated: { x: card.x + 34, y: card.y + 104 },
      zeroState: { x: card.x + 6, y: card.y + 126, width: 18, height: 16 },
      wrongOwner: { x: card.x + 32, y: card.y + 126, width: 18, height: 16 },
      // Native walls are four by four cells, so the full control is block-aligned.
      wallCoexistence: { x: wallX, y: card.y + 156, width: 16, height: 16 },
      guardedBlank: { x: card.x + 32, y: card.y + 190, width: 72, height: 60 },
    } satisfies StorStateGraphicsAtlasEntry;
  });

export const STOR_STATE_GRAPHICS_AUDIT: StorStateGraphicsAuditSnapshot = {
  cards: STOR_STATE_GRAPHICS_ATLAS,
  authoredHoles: STOR_STATE_GRAPHICS_ATLAS.flatMap(({ authoredHole }) => rectPoints(authoredHole)),
  openNotches: STOR_STATE_GRAPHICS_ATLAS.flatMap(({ openNotch }) => rectPoints(openNotch)),
  thinStructures: STOR_STATE_GRAPHICS_ATLAS.flatMap(({ thinStructure }) => rectPoints(thinStructure)),
  isolated: STOR_STATE_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
  zeroStates: STOR_STATE_GRAPHICS_ATLAS.map(({ zeroState }) => zeroState),
  wrongOwners: STOR_STATE_GRAPHICS_ATLAS.map(({ wrongOwner }) => wrongOwner),
  wallCoexistence: STOR_STATE_GRAPHICS_ATLAS.map(({ wallCoexistence }) => wallCoexistence),
  guardedBlanks: STOR_STATE_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
  conductiveWall: CONDUCTIVE_WALL,
};

interface StorStateFixtureBackend extends SimulationBackend {
  presentationState(): Uint16Array;
  walls(): Uint8Array;
  paintWall(x: number, y: number, wall: number, radius: number): void;
  setFixturePresentationStateRect(x: number, y: number, width: number, height: number, state: number): void;
  setFixturePresentationState(x: number, y: number, state: number): void;
}

/** Builds a paused render-lab fixture; fixture state never mutates native STOR fields. */
export function prepareStorStateGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (!supportsStorStateFixture(simulation)) {
    throw new Error('STOR state graphics audit fixture requires render-lab state and wall planes');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`STOR state graphics audit fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of STOR_STATE_GRAPHICS_ATLAS) {
    fillStateControl(simulation, cells, entry.body, Material.STOR, entry.encodedState);
    fillStateControl(simulation, cells, entry.authoredHole, Material.Empty, 0);
    fillStateControl(simulation, cells, entry.openNotch, Material.Empty, 0);
    fillStateControl(simulation, cells, entry.thinStructure, Material.STOR, entry.encodedState);
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = Material.STOR;
    simulation.setFixturePresentationState(entry.isolated.x, entry.isolated.y, entry.encodedState);
    fillStateControl(simulation, cells, entry.zeroState, Material.STOR, 0);
    fillStateControl(simulation, cells, entry.wrongOwner, Material.Water, entry.encodedState);
    fillStateControl(simulation, cells, entry.wallCoexistence, Material.STOR, entry.encodedState);
    for (let y = entry.wallCoexistence.y; y < entry.wallCoexistence.y + entry.wallCoexistence.height; y += 4) {
      for (let x = entry.wallCoexistence.x; x < entry.wallCoexistence.x + entry.wallCoexistence.width; x += 4) {
        simulation.paintWall(x, y, CONDUCTIVE_WALL, 0);
      }
    }
    fillStateControl(simulation, cells, entry.guardedBlank, Material.Empty, 0);
  }
}

function supportsStorStateFixture(simulation: SimulationBackend): simulation is StorStateFixtureBackend {
  const candidate = simulation as Partial<StorStateFixtureBackend>;
  return typeof candidate.presentationState === 'function'
    && typeof candidate.walls === 'function'
    && typeof candidate.paintWall === 'function'
    && typeof candidate.setFixturePresentationStateRect === 'function'
    && typeof candidate.setFixturePresentationState === 'function';
}

function fillStateControl(
  simulation: StorStateFixtureBackend,
  cells: Uint8Array,
  rect: StorStateGraphicsRect,
  material: Material,
  state: number,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * simulation.width + rect.x, y * simulation.width + rect.x + rect.width);
  }
  simulation.setFixturePresentationStateRect(rect.x, rect.y, rect.width, rect.height, state);
}

function rectPoints(rect: StorStateGraphicsRect): StorStateGraphicsPoint[] {
  const points: StorStateGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}
