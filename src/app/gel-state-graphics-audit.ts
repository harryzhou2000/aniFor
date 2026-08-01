import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';
import { GEL_PRESENTATION_STATE } from '../simulation/types';

export const GEL_STATE_GRAPHICS_ATLAS_COLUMNS = 5;
export const GEL_STATE_GRAPHICS_ATLAS_ROWS = 1;
export const GEL_HYDRATION_MAXIMUM = GEL_PRESENTATION_STATE.hydrationMaximum;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 4;
const CARD_ORIGIN_Y = 8;
const CARD_STRIDE_X = 121;
const CARD_WIDTH = 117;
const CARD_HEIGHT = 368;

export type GelStateGraphicsKey = 'dry' | 'low' | 'mid' | 'high' | 'saturated';

export interface GelStateGraphicsPoint { readonly x: number; readonly y: number }
export interface GelStateGraphicsRect extends GelStateGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

export interface GelNativePresentationState {
  readonly key: GelStateGraphicsKey;
  /** Exact native GEL `tmp` hydration, from dry 0 through saturated 100. */
  readonly hydration: number;
}

export const GEL_STATE_GRAPHICS_STATES = [
  { key: 'dry', hydration: 0 },
  { key: 'low', hydration: 10 },
  { key: 'mid', hydration: 35 },
  { key: 'high', hydration: 70 },
  { key: 'saturated', hydration: GEL_HYDRATION_MAXIMUM },
] as const satisfies readonly GelNativePresentationState[];

/** Encodes only GEL's public native hydration range; high state bits remain reserved. */
export function encodeGelHydrationPresentationState(hydration: number): number {
  return Math.max(0, Math.min(GEL_HYDRATION_MAXIMUM, Math.round(hydration)))
    & GEL_PRESENTATION_STATE.hydrationMask;
}

export interface GelStateGraphicsAtlasEntry extends GelNativePresentationState {
  readonly material: Material.GEL;
  readonly code: 'GEL';
  readonly encodedState: number;
  readonly index: number;
  readonly card: GelStateGraphicsRect;
  readonly body: GelStateGraphicsRect;
  readonly surfaceProbe: GelStateGraphicsRect;
  readonly coreProbe: GelStateGraphicsRect;
  /** Interior body region for the visible native hydration response. */
  readonly hydrationProbe: GelStateGraphicsRect;
  readonly authoredHole: GelStateGraphicsRect;
  readonly openNotch: GelStateGraphicsRect;
  readonly thinStrand: GelStateGraphicsRect;
  readonly isolated: GelStateGraphicsPoint;
  /** Exact GEL owner with state zero, including on hydrated cards. */
  readonly zeroState: GelStateGraphicsRect;
  /** Exact wrong-owner controls carrying the card's identical native state word. */
  readonly waterControl: GelStateGraphicsRect;
  readonly spongeControl: GelStateGraphicsRect;
  readonly baseControl: GelStateGraphicsRect;
  readonly guardedBlank: GelStateGraphicsRect;
}

export interface GelStateGraphicsAuditSnapshot {
  readonly cards: readonly GelStateGraphicsAtlasEntry[];
  readonly authoredHoles: readonly GelStateGraphicsPoint[];
  readonly openNotches: readonly GelStateGraphicsPoint[];
  readonly thinStrands: readonly GelStateGraphicsPoint[];
  readonly isolated: readonly GelStateGraphicsPoint[];
  readonly zeroStates: readonly GelStateGraphicsRect[];
  readonly waterControls: readonly GelStateGraphicsRect[];
  readonly spongeControls: readonly GelStateGraphicsRect[];
  readonly baseControls: readonly GelStateGraphicsRect[];
  readonly guardedBlanks: readonly GelStateGraphicsRect[];
}

/** Stable five-card GEL hydration scene for later paired Canvas/WebGL gates. */
export const GEL_STATE_GRAPHICS_ATLAS: readonly GelStateGraphicsAtlasEntry[] =
  GEL_STATE_GRAPHICS_STATES.map((state, index) => {
    const card = {
      x: CARD_ORIGIN_X + index * CARD_STRIDE_X,
      y: CARD_ORIGIN_Y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    };
    const body = { x: card.x + 6, y: card.y + 8, width: 66, height: 64 };
    return {
      ...state,
      material: Material.GEL,
      code: 'GEL',
      encodedState: encodeGelHydrationPresentationState(state.hydration),
      index,
      card,
      body,
      surfaceProbe: { x: body.x + 4, y: body.y + 4, width: 8, height: 8 },
      coreProbe: { x: body.x + 20, y: body.y + 44, width: 8, height: 8 },
      hydrationProbe: { x: body.x + 40, y: body.y + 36, width: 8, height: 8 },
      authoredHole: { x: body.x + 28, y: body.y + 28, width: 6, height: 6 },
      openNotch: { x: body.x + 58, y: body.y + 44, width: 8, height: 8 },
      thinStrand: { x: card.x + 8, y: card.y + 84, width: 1, height: 30 },
      isolated: { x: card.x + 34, y: card.y + 104 },
      zeroState: { x: card.x + 6, y: card.y + 126, width: 18, height: 16 },
      waterControl: { x: card.x + 32, y: card.y + 126, width: 18, height: 16 },
      spongeControl: { x: card.x + 58, y: card.y + 126, width: 18, height: 16 },
      baseControl: { x: card.x + 84, y: card.y + 126, width: 18, height: 16 },
      guardedBlank: { x: card.x + 32, y: card.y + 190, width: 72, height: 60 },
    } satisfies GelStateGraphicsAtlasEntry;
  });

export const GEL_STATE_GRAPHICS_AUDIT: GelStateGraphicsAuditSnapshot = {
  cards: GEL_STATE_GRAPHICS_ATLAS,
  authoredHoles: GEL_STATE_GRAPHICS_ATLAS.flatMap(({ authoredHole }) => rectPoints(authoredHole)),
  openNotches: GEL_STATE_GRAPHICS_ATLAS.flatMap(({ openNotch }) => rectPoints(openNotch)),
  thinStrands: GEL_STATE_GRAPHICS_ATLAS.flatMap(({ thinStrand }) => rectPoints(thinStrand)),
  isolated: GEL_STATE_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
  zeroStates: GEL_STATE_GRAPHICS_ATLAS.map(({ zeroState }) => zeroState),
  waterControls: GEL_STATE_GRAPHICS_ATLAS.map(({ waterControl }) => waterControl),
  spongeControls: GEL_STATE_GRAPHICS_ATLAS.map(({ spongeControl }) => spongeControl),
  baseControls: GEL_STATE_GRAPHICS_ATLAS.map(({ baseControl }) => baseControl),
  guardedBlanks: GEL_STATE_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
};

interface GelStateFixtureBackend extends SimulationBackend {
  presentationState(): Uint16Array;
  setFixturePresentationStateRect(
    x: number, y: number, width: number, height: number, state: number,
  ): void;
  setFixturePresentationState(x: number, y: number, state: number): void;
}

/** Builds one paused exact-owner GEL hydration atlas without crossing native paint ABIs. */
export function prepareGelStateGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (!supportsGelStateFixture(simulation)) {
    throw new Error('GEL state graphics audit fixture requires a render-lab state plane');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`GEL state graphics audit fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of GEL_STATE_GRAPHICS_ATLAS) {
    fillStateControl(simulation, cells, entry.body, Material.GEL, entry.encodedState);
    fillStateControl(simulation, cells, entry.authoredHole, Material.Empty, 0);
    fillStateControl(simulation, cells, entry.openNotch, Material.Empty, 0);
    fillStateControl(simulation, cells, entry.thinStrand, Material.GEL, entry.encodedState);
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = Material.GEL;
    simulation.setFixturePresentationState(
      entry.isolated.x, entry.isolated.y, entry.encodedState,
    );
    fillStateControl(simulation, cells, entry.zeroState, Material.GEL, 0);
    fillStateControl(simulation, cells, entry.waterControl, Material.Water, entry.encodedState);
    fillStateControl(simulation, cells, entry.spongeControl, Material.SPNG, entry.encodedState);
    fillStateControl(simulation, cells, entry.baseControl, Material.BASE, entry.encodedState);
    fillStateControl(simulation, cells, entry.guardedBlank, Material.Empty, 0);
  }
}

function supportsGelStateFixture(
  simulation: SimulationBackend,
): simulation is GelStateFixtureBackend {
  const candidate = simulation as Partial<GelStateFixtureBackend>;
  return typeof candidate.presentationState === 'function'
    && typeof candidate.setFixturePresentationStateRect === 'function'
    && typeof candidate.setFixturePresentationState === 'function';
}

function fillStateControl(
  simulation: GelStateFixtureBackend,
  cells: Uint8Array,
  rect: GelStateGraphicsRect,
  material: Material,
  state: number,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * simulation.width + rect.x, y * simulation.width + rect.x + rect.width);
  }
  simulation.setFixturePresentationStateRect(rect.x, rect.y, rect.width, rect.height, state);
}

function rectPoints(rect: GelStateGraphicsRect): GelStateGraphicsPoint[] {
  const points: GelStateGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}
