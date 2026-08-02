import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';
import { SWCH_PRESENTATION_STATE } from '../simulation/types';

export const SWCH_STATE_GRAPHICS_ATLAS_COLUMNS = 3;
export const SWCH_STATE_GRAPHICS_ATLAS_ROWS = 1;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 28;
const CARD_ORIGIN_Y = 8;
const CARD_STRIDE_X = 188;
const CARD_WIDTH = 184;
const CONDUCTIVE_WALL = 1;

export type SwchStateGraphicsKey = 'off' | 'decay' | 'on';
export interface SwchStateGraphicsPoint { readonly x: number; readonly y: number }
export interface SwchStateGraphicsRect extends SwchStateGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

/**
 * `life` is deliberately descriptive only. The renderer gets exactly the
 * native conduction threshold projection: both off and decaying switches are
 * owner-present/no-on-bit, while life >= 10 carries the conducting bit.
 */
export const SWCH_STATE_GRAPHICS_STATES = [
  { key: 'off', life: 0, on: false },
  { key: 'decay', life: 9, on: false },
  { key: 'on', life: 10, on: true },
] as const satisfies readonly {
  readonly key: SwchStateGraphicsKey;
  readonly life: number;
  readonly on: boolean;
}[];

/** Packs only the public native SWCH presence/conduction projection. */
export function encodeSwchPresentationState(on: boolean): number {
  return SWCH_PRESENTATION_STATE.presentMask | (on ? SWCH_PRESENTATION_STATE.onMask : 0);
}

export interface SwchStateGraphicsAtlasEntry {
  readonly material: Material.SWCH;
  readonly code: 'SWCH';
  readonly stateKey: SwchStateGraphicsKey;
  readonly life: number;
  readonly on: boolean;
  readonly encodedState: number;
  readonly index: number;
  readonly card: SwchStateGraphicsRect;
  readonly body: SwchStateGraphicsRect;
  readonly responseProbe: SwchStateGraphicsRect;
  readonly authoredHole: SwchStateGraphicsRect;
  readonly openNotch: SwchStateGraphicsRect;
  readonly thinStructure: SwchStateGraphicsRect;
  readonly isolated: SwchStateGraphicsPoint;
  /** Exact owner without a native state word: its style must be a no-op. */
  readonly absentState: SwchStateGraphicsRect;
  /** A shared conducting word must not style another material owner. */
  readonly wrongOwner: SwchStateGraphicsRect;
  /** Matter and wall coexist; state styling must not leak through the wall. */
  readonly wallCoexistence: SwchStateGraphicsRect;
  readonly guardedBlank: SwchStateGraphicsRect;
}

export interface SwchStateGraphicsAuditSnapshot {
  readonly cards: readonly SwchStateGraphicsAtlasEntry[];
  readonly authoredHoles: readonly SwchStateGraphicsPoint[];
  readonly openNotches: readonly SwchStateGraphicsPoint[];
  readonly thinStructures: readonly SwchStateGraphicsPoint[];
  readonly isolated: readonly SwchStateGraphicsPoint[];
  readonly absentStates: readonly SwchStateGraphicsRect[];
  readonly wrongOwners: readonly SwchStateGraphicsRect[];
  readonly wallCoexistence: readonly SwchStateGraphicsRect[];
  readonly guardedBlanks: readonly SwchStateGraphicsRect[];
  readonly conductiveWall: number;
}

/** Stable native SWCH conduction atlas for the normal-detail compositor gate. */
export const SWCH_STATE_GRAPHICS_ATLAS: readonly SwchStateGraphicsAtlasEntry[] =
  SWCH_STATE_GRAPHICS_STATES.map((state, index) => {
    const card = {
      x: CARD_ORIGIN_X + index * CARD_STRIDE_X,
      y: CARD_ORIGIN_Y,
      width: CARD_WIDTH,
      height: 368,
    };
    const body = { x: card.x + 8, y: card.y + 10, width: 96, height: 72 };
    const wallX = card.x + ((4 - (card.x % 4)) % 4);
    return {
      material: Material.SWCH,
      code: 'SWCH',
      stateKey: state.key,
      life: state.life,
      on: state.on,
      encodedState: encodeSwchPresentationState(state.on),
      index,
      card,
      body,
      responseProbe: { x: body.x + 24, y: body.y + 44, width: 12, height: 12 },
      authoredHole: { x: body.x + 42, y: body.y + 30, width: 8, height: 8 },
      openNotch: { x: body.x + 84, y: body.y + 50, width: 12, height: 12 },
      thinStructure: { x: card.x + 10, y: card.y + 96, width: 1, height: 34 },
      isolated: { x: card.x + 42, y: card.y + 118 },
      absentState: { x: card.x + 8, y: card.y + 150, width: 24, height: 20 },
      wrongOwner: { x: card.x + 42, y: card.y + 150, width: 24, height: 20 },
      wallCoexistence: { x: wallX, y: card.y + 184, width: 20, height: 20 },
      guardedBlank: { x: card.x + 42, y: card.y + 228, width: 108, height: 68 },
    } satisfies SwchStateGraphicsAtlasEntry;
  });

export const SWCH_STATE_GRAPHICS_AUDIT: SwchStateGraphicsAuditSnapshot = {
  cards: SWCH_STATE_GRAPHICS_ATLAS,
  authoredHoles: SWCH_STATE_GRAPHICS_ATLAS.flatMap(({ authoredHole }) => rectPoints(authoredHole)),
  openNotches: SWCH_STATE_GRAPHICS_ATLAS.flatMap(({ openNotch }) => rectPoints(openNotch)),
  thinStructures: SWCH_STATE_GRAPHICS_ATLAS.flatMap(({ thinStructure }) => rectPoints(thinStructure)),
  isolated: SWCH_STATE_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
  absentStates: SWCH_STATE_GRAPHICS_ATLAS.map(({ absentState }) => absentState),
  wrongOwners: SWCH_STATE_GRAPHICS_ATLAS.map(({ wrongOwner }) => wrongOwner),
  wallCoexistence: SWCH_STATE_GRAPHICS_ATLAS.map(({ wallCoexistence }) => wallCoexistence),
  guardedBlanks: SWCH_STATE_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
  conductiveWall: CONDUCTIVE_WALL,
};

interface SwchStateFixtureBackend extends SimulationBackend {
  presentationState(): Uint16Array;
  walls(): Uint8Array;
  paintWall(x: number, y: number, wall: number, radius: number): void;
  setFixturePresentationStateRect(x: number, y: number, width: number, height: number, state: number): void;
  setFixturePresentationState(x: number, y: number, state: number): void;
}

/** Builds a paused renderer fixture without treating the packed word as a native write. */
export function prepareSwchStateGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (!supportsSwchStateFixture(simulation)) {
    throw new Error('SWCH state graphics audit fixture requires render-lab state and wall planes');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`SWCH state graphics audit fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of SWCH_STATE_GRAPHICS_ATLAS) {
    fillStateControl(simulation, cells, entry.body, Material.SWCH, entry.encodedState);
    fillStateControl(simulation, cells, entry.authoredHole, Material.Empty, 0);
    fillStateControl(simulation, cells, entry.openNotch, Material.Empty, 0);
    fillStateControl(simulation, cells, entry.thinStructure, Material.SWCH, entry.encodedState);
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = Material.SWCH;
    simulation.setFixturePresentationState(entry.isolated.x, entry.isolated.y, entry.encodedState);
    fillStateControl(simulation, cells, entry.absentState, Material.SWCH, 0);
    fillStateControl(simulation, cells, entry.wrongOwner, Material.Water, encodeSwchPresentationState(true));
    fillStateControl(simulation, cells, entry.wallCoexistence, Material.SWCH, encodeSwchPresentationState(true));
    for (let y = entry.wallCoexistence.y; y < entry.wallCoexistence.y + entry.wallCoexistence.height; y += 4) {
      for (let x = entry.wallCoexistence.x; x < entry.wallCoexistence.x + entry.wallCoexistence.width; x += 4) {
        simulation.paintWall(x, y, CONDUCTIVE_WALL, 0);
      }
    }
    fillStateControl(simulation, cells, entry.guardedBlank, Material.Empty, 0);
  }
}

function supportsSwchStateFixture(simulation: SimulationBackend): simulation is SwchStateFixtureBackend {
  const candidate = simulation as Partial<SwchStateFixtureBackend>;
  return typeof candidate.presentationState === 'function'
    && typeof candidate.walls === 'function'
    && typeof candidate.paintWall === 'function'
    && typeof candidate.setFixturePresentationStateRect === 'function'
    && typeof candidate.setFixturePresentationState === 'function';
}

function fillStateControl(
  simulation: SwchStateFixtureBackend,
  cells: Uint8Array,
  rect: SwchStateGraphicsRect,
  material: Material,
  state: number,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * simulation.width + rect.x, y * simulation.width + rect.x + rect.width);
  }
  simulation.setFixturePresentationStateRect(rect.x, rect.y, rect.width, rect.height, state);
}

function rectPoints(rect: SwchStateGraphicsRect): SwchStateGraphicsPoint[] {
  const points: SwchStateGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}
