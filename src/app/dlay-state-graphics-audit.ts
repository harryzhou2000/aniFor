import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';
import { DLAY_PRESENTATION_STATE } from '../simulation/types';

export const DLAY_STATE_GRAPHICS_ATLAS_COLUMNS = 4;
export const DLAY_STATE_GRAPHICS_ATLAS_ROWS = 1;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 4;
const CARD_ORIGIN_Y = 8;
const CARD_STRIDE_X = 150;
const CARD_WIDTH = 146;
const CONDUCTIVE_WALL = 1;

export type DlayStateGraphicsKey = 'idle' | 'armed' | 'mid' | 'nearExpiry';
export interface DlayStateGraphicsPoint { readonly x: number; readonly y: number }
export interface DlayStateGraphicsRect extends DlayStateGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

export interface DlayNativePresentationState {
  readonly key: DlayStateGraphicsKey;
  /** Exact native DLAY `life` countdown; no temperature normalization occurs. */
  readonly countdown: number;
}

/** Default room-temperature PSCN activation is near 22 frames; use a native-sized cardinal. */
export const DLAY_STATE_GRAPHICS_STATES = [
  { key: 'idle', countdown: 0 },
  { key: 'armed', countdown: 22 },
  { key: 'mid', countdown: 11 },
  { key: 'nearExpiry', countdown: 1 },
] as const satisfies readonly DlayNativePresentationState[];

/** Packs the exact owner-marked native life projection used only by render-lab cards. */
export function encodeDlayPresentationState(countdown: number): number {
  return DLAY_PRESENTATION_STATE.presentMask
    | (Math.max(0, Math.min(DLAY_PRESENTATION_STATE.countdownMask, Math.round(countdown)))
      & DLAY_PRESENTATION_STATE.countdownMask);
}

export interface DlayStateGraphicsAtlasEntry extends DlayNativePresentationState {
  readonly material: Material.DLAY;
  readonly code: 'DLAY';
  readonly encodedState: number;
  readonly index: number;
  readonly card: DlayStateGraphicsRect;
  readonly body: DlayStateGraphicsRect;
  readonly responseProbe: DlayStateGraphicsRect;
  readonly authoredHole: DlayStateGraphicsRect;
  readonly openNotch: DlayStateGraphicsRect;
  readonly thinStructure: DlayStateGraphicsRect;
  readonly isolated: DlayStateGraphicsPoint;
  /** Exact DLAY with no owner marker: style must stay absent. */
  readonly absentState: DlayStateGraphicsRect;
  /** The current DLAY word must not style an unrelated particle owner. */
  readonly wrongOwner: DlayStateGraphicsRect;
  /** Matter and a native wall coexist; DLAY state must remain behind the wall. */
  readonly wallCoexistence: DlayStateGraphicsRect;
  readonly guardedBlank: DlayStateGraphicsRect;
}

export interface DlayStateGraphicsAuditSnapshot {
  readonly cards: readonly DlayStateGraphicsAtlasEntry[];
  readonly authoredHoles: readonly DlayStateGraphicsPoint[];
  readonly openNotches: readonly DlayStateGraphicsPoint[];
  readonly thinStructures: readonly DlayStateGraphicsPoint[];
  readonly isolated: readonly DlayStateGraphicsPoint[];
  readonly absentStates: readonly DlayStateGraphicsRect[];
  readonly wrongOwners: readonly DlayStateGraphicsRect[];
  readonly wallCoexistence: readonly DlayStateGraphicsRect[];
  readonly guardedBlanks: readonly DlayStateGraphicsRect[];
  readonly conductiveWall: number;
}

/** Stable paused native-delay cards for Canvas/WebGL composition gates. */
export const DLAY_STATE_GRAPHICS_ATLAS: readonly DlayStateGraphicsAtlasEntry[] =
  DLAY_STATE_GRAPHICS_STATES.map((state, index) => {
    const card = { x: CARD_ORIGIN_X + index * CARD_STRIDE_X, y: CARD_ORIGIN_Y, width: CARD_WIDTH, height: 368 };
    const body = { x: card.x + 6, y: card.y + 8, width: 76, height: 64 };
    const wallX = card.x + ((4 - (card.x % 4)) % 4);
    return {
      ...state,
      material: Material.DLAY,
      code: 'DLAY',
      encodedState: encodeDlayPresentationState(state.countdown),
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
      // Native wall occupancy is four by four cells, so retain block alignment.
      wallCoexistence: { x: wallX, y: card.y + 156, width: 16, height: 16 },
      guardedBlank: { x: card.x + 32, y: card.y + 190, width: 72, height: 60 },
    } satisfies DlayStateGraphicsAtlasEntry;
  });

export const DLAY_STATE_GRAPHICS_AUDIT: DlayStateGraphicsAuditSnapshot = {
  cards: DLAY_STATE_GRAPHICS_ATLAS,
  authoredHoles: DLAY_STATE_GRAPHICS_ATLAS.flatMap(({ authoredHole }) => rectPoints(authoredHole)),
  openNotches: DLAY_STATE_GRAPHICS_ATLAS.flatMap(({ openNotch }) => rectPoints(openNotch)),
  thinStructures: DLAY_STATE_GRAPHICS_ATLAS.flatMap(({ thinStructure }) => rectPoints(thinStructure)),
  isolated: DLAY_STATE_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
  absentStates: DLAY_STATE_GRAPHICS_ATLAS.map(({ absentState }) => absentState),
  wrongOwners: DLAY_STATE_GRAPHICS_ATLAS.map(({ wrongOwner }) => wrongOwner),
  wallCoexistence: DLAY_STATE_GRAPHICS_ATLAS.map(({ wallCoexistence }) => wallCoexistence),
  guardedBlanks: DLAY_STATE_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
  conductiveWall: CONDUCTIVE_WALL,
};

interface DlayStateFixtureBackend extends SimulationBackend {
  presentationState(): Uint16Array;
  walls(): Uint8Array;
  paintWall(x: number, y: number, wall: number, radius: number): void;
  setFixturePresentationStateRect(x: number, y: number, width: number, height: number, state: number): void;
  setFixturePresentationState(x: number, y: number, state: number): void;
}

/** Builds a paused state plane without routing fixture words through native ABIs. */
export function prepareDlayStateGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (!supportsDlayStateFixture(simulation)) {
    throw new Error('DLAY state graphics audit fixture requires render-lab state and wall planes');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`DLAY state graphics audit fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of DLAY_STATE_GRAPHICS_ATLAS) {
    fillStateControl(simulation, cells, entry.body, Material.DLAY, entry.encodedState);
    fillStateControl(simulation, cells, entry.authoredHole, Material.Empty, 0);
    fillStateControl(simulation, cells, entry.openNotch, Material.Empty, 0);
    fillStateControl(simulation, cells, entry.thinStructure, Material.DLAY, entry.encodedState);
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = Material.DLAY;
    simulation.setFixturePresentationState(entry.isolated.x, entry.isolated.y, entry.encodedState);
    fillStateControl(simulation, cells, entry.absentState, Material.DLAY, 0);
    fillStateControl(simulation, cells, entry.wrongOwner, Material.Water, entry.encodedState);
    fillStateControl(simulation, cells, entry.wallCoexistence, Material.DLAY, entry.encodedState);
    for (let y = entry.wallCoexistence.y; y < entry.wallCoexistence.y + entry.wallCoexistence.height; y += 4) {
      for (let x = entry.wallCoexistence.x; x < entry.wallCoexistence.x + entry.wallCoexistence.width; x += 4) {
        simulation.paintWall(x, y, CONDUCTIVE_WALL, 0);
      }
    }
    fillStateControl(simulation, cells, entry.guardedBlank, Material.Empty, 0);
  }
}

function supportsDlayStateFixture(simulation: SimulationBackend): simulation is DlayStateFixtureBackend {
  const candidate = simulation as Partial<DlayStateFixtureBackend>;
  return typeof candidate.presentationState === 'function'
    && typeof candidate.walls === 'function'
    && typeof candidate.paintWall === 'function'
    && typeof candidate.setFixturePresentationStateRect === 'function'
    && typeof candidate.setFixturePresentationState === 'function';
}

function fillStateControl(
  simulation: DlayStateFixtureBackend,
  cells: Uint8Array,
  rect: DlayStateGraphicsRect,
  material: Material,
  state: number,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * simulation.width + rect.x, y * simulation.width + rect.x + rect.width);
  }
  simulation.setFixturePresentationStateRect(rect.x, rect.y, rect.width, rect.height, state);
}

function rectPoints(rect: DlayStateGraphicsRect): DlayStateGraphicsPoint[] {
  const points: DlayStateGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}
