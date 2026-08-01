import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';
import { LCRY_PRESENTATION_STATE } from '../simulation/types';

export const LCRY_STATE_GRAPHICS_ATLAS_COLUMNS = 5;
export const LCRY_STATE_GRAPHICS_ATLAS_ROWS = 1;
export const LCRY_BRIGHTNESS_MAXIMUM = LCRY_PRESENTATION_STATE.brightnessMaximum;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 4;
const CARD_ORIGIN_Y = 8;
const CARD_STRIDE_X = 121;
const CARD_WIDTH = 117;
const CARD_HEIGHT = 368;

export type LcryStateGraphicsKey = 'dark' | 'low' | 'neutral' | 'high' | 'bright';
export interface LcryStateGraphicsPoint { readonly x: number; readonly y: number }
export interface LcryStateGraphicsRect extends LcryStateGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

export const LCRY_STATE_GRAPHICS_STATES = [
  { key: 'dark', brightness: 0 },
  { key: 'low', brightness: 2 },
  { key: 'neutral', brightness: 5 },
  { key: 'high', brightness: 8 },
  { key: 'bright', brightness: LCRY_BRIGHTNESS_MAXIMUM },
] as const satisfies readonly { readonly key: LcryStateGraphicsKey; readonly brightness: number }[];

/** Encodes LCRY's owner-present marker plus its public native `tmp2` brightness. */
export function encodeLcryPresentationState(brightness: number): number {
  return LCRY_PRESENTATION_STATE.presentMask
    | (Math.max(0, Math.min(LCRY_BRIGHTNESS_MAXIMUM, Math.round(brightness)))
      & LCRY_PRESENTATION_STATE.brightnessMask);
}

export interface LcryStateGraphicsAtlasEntry {
  readonly material: Material.LCRY;
  readonly code: 'LCRY';
  readonly stateKey: LcryStateGraphicsKey;
  readonly brightness: number;
  readonly encodedState: number;
  readonly index: number;
  readonly card: LcryStateGraphicsRect;
  readonly body: LcryStateGraphicsRect;
  readonly responseProbe: LcryStateGraphicsRect;
  readonly authoredHole: LcryStateGraphicsRect;
  readonly openNotch: LcryStateGraphicsRect;
  readonly thinStructure: LcryStateGraphicsRect;
  readonly isolated: LcryStateGraphicsPoint;
  /** Same exact owner carrying the owner-present neutral native charge. */
  readonly neutralState: LcryStateGraphicsRect;
  /** Exact LCRY owner carrying an absent state word: this must stay unstyled. */
  readonly absentState: LcryStateGraphicsRect;
  /** A shared present+brightness word must not style a different material owner. */
  readonly wrongOwner: LcryStateGraphicsRect;
  readonly guardedBlank: LcryStateGraphicsRect;
}

export interface LcryStateGraphicsAuditSnapshot {
  readonly cards: readonly LcryStateGraphicsAtlasEntry[];
  readonly authoredHoles: readonly LcryStateGraphicsPoint[];
  readonly openNotches: readonly LcryStateGraphicsPoint[];
  readonly thinStructures: readonly LcryStateGraphicsPoint[];
  readonly isolated: readonly LcryStateGraphicsPoint[];
  readonly neutralStates: readonly LcryStateGraphicsRect[];
  readonly absentStates: readonly LcryStateGraphicsRect[];
  readonly wrongOwners: readonly LcryStateGraphicsRect[];
  readonly guardedBlanks: readonly LcryStateGraphicsRect[];
}

/** Stable five-charge native LCRY state atlas for later WebGL composition gates. */
export const LCRY_STATE_GRAPHICS_ATLAS: readonly LcryStateGraphicsAtlasEntry[] =
  LCRY_STATE_GRAPHICS_STATES.map((state, index) => {
    const card = { x: CARD_ORIGIN_X + index * CARD_STRIDE_X, y: CARD_ORIGIN_Y, width: CARD_WIDTH, height: CARD_HEIGHT };
    const body = { x: card.x + 6, y: card.y + 8, width: 66, height: 64 };
    return {
      material: Material.LCRY,
      code: 'LCRY',
      stateKey: state.key,
      brightness: state.brightness,
      encodedState: encodeLcryPresentationState(state.brightness),
      index, card, body,
      responseProbe: { x: body.x + 18, y: body.y + 42, width: 10, height: 10 },
      authoredHole: { x: body.x + 28, y: body.y + 28, width: 6, height: 6 },
      openNotch: { x: body.x + 58, y: body.y + 44, width: 8, height: 8 },
      thinStructure: { x: card.x + 8, y: card.y + 84, width: 1, height: 30 },
      isolated: { x: card.x + 34, y: card.y + 104 },
      neutralState: { x: card.x + 6, y: card.y + 126, width: 18, height: 16 },
      absentState: { x: card.x + 32, y: card.y + 126, width: 18, height: 16 },
      wrongOwner: { x: card.x + 58, y: card.y + 126, width: 18, height: 16 },
      guardedBlank: { x: card.x + 32, y: card.y + 190, width: 72, height: 60 },
    } satisfies LcryStateGraphicsAtlasEntry;
  });

export const LCRY_STATE_GRAPHICS_AUDIT: LcryStateGraphicsAuditSnapshot = {
  cards: LCRY_STATE_GRAPHICS_ATLAS,
  authoredHoles: LCRY_STATE_GRAPHICS_ATLAS.flatMap(({ authoredHole }) => rectPoints(authoredHole)),
  openNotches: LCRY_STATE_GRAPHICS_ATLAS.flatMap(({ openNotch }) => rectPoints(openNotch)),
  thinStructures: LCRY_STATE_GRAPHICS_ATLAS.flatMap(({ thinStructure }) => rectPoints(thinStructure)),
  isolated: LCRY_STATE_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
  neutralStates: LCRY_STATE_GRAPHICS_ATLAS.map(({ neutralState }) => neutralState),
  absentStates: LCRY_STATE_GRAPHICS_ATLAS.map(({ absentState }) => absentState),
  wrongOwners: LCRY_STATE_GRAPHICS_ATLAS.map(({ wrongOwner }) => wrongOwner),
  guardedBlanks: LCRY_STATE_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
};

interface LcryStateFixtureBackend extends SimulationBackend {
  presentationState(): Uint16Array;
  setFixturePresentationStateRect(x: number, y: number, width: number, height: number, state: number): void;
  setFixturePresentationState(x: number, y: number, state: number): void;
}

export function prepareLcryStateGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (!supportsLcryStateFixture(simulation)) throw new Error('LCRY state graphics audit fixture requires a render-lab state plane');
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`LCRY state graphics audit fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of LCRY_STATE_GRAPHICS_ATLAS) {
    fillStateControl(simulation, cells, entry.body, Material.LCRY, entry.encodedState);
    fillStateControl(simulation, cells, entry.authoredHole, Material.Empty, 0);
    fillStateControl(simulation, cells, entry.openNotch, Material.Empty, 0);
    fillStateControl(simulation, cells, entry.thinStructure, Material.LCRY, entry.encodedState);
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = Material.LCRY;
    simulation.setFixturePresentationState(entry.isolated.x, entry.isolated.y, entry.encodedState);
    fillStateControl(simulation, cells, entry.neutralState, Material.LCRY, encodeLcryPresentationState(5));
    fillStateControl(simulation, cells, entry.absentState, Material.LCRY, 0);
    fillStateControl(simulation, cells, entry.wrongOwner, Material.Water, entry.encodedState);
    fillStateControl(simulation, cells, entry.guardedBlank, Material.Empty, 0);
  }
}

function supportsLcryStateFixture(simulation: SimulationBackend): simulation is LcryStateFixtureBackend {
  const candidate = simulation as Partial<LcryStateFixtureBackend>;
  return typeof candidate.presentationState === 'function'
    && typeof candidate.setFixturePresentationStateRect === 'function'
    && typeof candidate.setFixturePresentationState === 'function';
}

function fillStateControl(simulation: LcryStateFixtureBackend, cells: Uint8Array, rect: LcryStateGraphicsRect, material: Material, state: number): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * simulation.width + rect.x, y * simulation.width + rect.x + rect.width);
  }
  simulation.setFixturePresentationStateRect(rect.x, rect.y, rect.width, rect.height, state);
}

function rectPoints(rect: LcryStateGraphicsRect): LcryStateGraphicsPoint[] {
  const points: LcryStateGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}
