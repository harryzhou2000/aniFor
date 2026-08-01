import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';
import { QUARTZ_PRESENTATION_STATE } from '../simulation/types';

export const PQRT_STATE_GRAPHICS_ATLAS_COLUMNS = 5;
export const PQRT_STATE_GRAPHICS_ATLAS_ROWS = 1;
export const PQRT_SPECKLE_MAXIMUM = QUARTZ_PRESENTATION_STATE.speckleMaximum;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 4;
const CARD_ORIGIN_Y = 8;
const CARD_STRIDE_X = 121;
const CARD_WIDTH = 117;
const CARD_HEIGHT = 368;

export type PqrtStateGraphicsKey = 'dark' | 'low' | 'neutral' | 'high' | 'bright';
export interface PqrtStateGraphicsPoint { readonly x: number; readonly y: number }
export interface PqrtStateGraphicsRect extends PqrtStateGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

export const PQRT_STATE_GRAPHICS_STATES = [
  { key: 'dark', speckle: 0 },
  { key: 'low', speckle: 2 },
  { key: 'neutral', speckle: QUARTZ_PRESENTATION_STATE.neutralSpeckle },
  { key: 'high', speckle: 8 },
  { key: 'bright', speckle: PQRT_SPECKLE_MAXIMUM },
] as const satisfies readonly { readonly key: PqrtStateGraphicsKey; readonly speckle: number }[];

/** Encodes the public native tmp2 range, reserving all high bits. */
export function encodePqrtPresentationState(speckle: number): number {
  return Math.max(0, Math.min(PQRT_SPECKLE_MAXIMUM, Math.round(speckle)))
    & QUARTZ_PRESENTATION_STATE.speckleMask;
}

export interface PqrtStateGraphicsAtlasEntry {
  readonly material: Material.Quartz | Material.QRTZ;
  readonly code: 'PQRT' | 'QRTZ';
  readonly stateKey: PqrtStateGraphicsKey;
  readonly speckle: number;
  readonly encodedState: number;
  readonly index: number;
  readonly card: PqrtStateGraphicsRect;
  readonly body: PqrtStateGraphicsRect;
  readonly responseProbe: PqrtStateGraphicsRect;
  readonly authoredHole: PqrtStateGraphicsRect;
  readonly openNotch: PqrtStateGraphicsRect;
  readonly thinStructure: PqrtStateGraphicsRect;
  readonly isolated: PqrtStateGraphicsPoint;
  /** Same exact owner with the neutral native seed. */
  readonly neutralState: PqrtStateGraphicsRect;
  /** A shared state word must not style a different material owner. */
  readonly wrongOwner: PqrtStateGraphicsRect;
  readonly guardedBlank: PqrtStateGraphicsRect;
}

export interface PqrtStateGraphicsAuditSnapshot {
  readonly cards: readonly PqrtStateGraphicsAtlasEntry[];
  readonly authoredHoles: readonly PqrtStateGraphicsPoint[];
  readonly openNotches: readonly PqrtStateGraphicsPoint[];
  readonly thinStructures: readonly PqrtStateGraphicsPoint[];
  readonly isolated: readonly PqrtStateGraphicsPoint[];
  readonly neutralStates: readonly PqrtStateGraphicsRect[];
  readonly wrongOwners: readonly PqrtStateGraphicsRect[];
  readonly guardedBlanks: readonly PqrtStateGraphicsRect[];
}

/** Stable two-owner native crystal state atlas for Canvas/WebGL composition gates. */
export const PQRT_STATE_GRAPHICS_ATLAS: readonly PqrtStateGraphicsAtlasEntry[] =
  PQRT_STATE_GRAPHICS_STATES.map((state, index) => {
    const card = { x: CARD_ORIGIN_X + index * CARD_STRIDE_X, y: CARD_ORIGIN_Y, width: CARD_WIDTH, height: CARD_HEIGHT };
    const material = index % 2 === 0 ? Material.Quartz : Material.QRTZ;
    const body = { x: card.x + 6, y: card.y + 8, width: 66, height: 64 };
    return {
      material,
      code: material === Material.Quartz ? 'PQRT' : 'QRTZ',
      stateKey: state.key,
      speckle: state.speckle,
      encodedState: encodePqrtPresentationState(state.speckle),
      index, card, body,
      responseProbe: { x: body.x + 18, y: body.y + 42, width: 10, height: 10 },
      authoredHole: { x: body.x + 28, y: body.y + 28, width: 6, height: 6 },
      openNotch: { x: body.x + 58, y: body.y + 44, width: 8, height: 8 },
      thinStructure: { x: card.x + 8, y: card.y + 84, width: 1, height: 30 },
      isolated: { x: card.x + 34, y: card.y + 104 },
      neutralState: { x: card.x + 6, y: card.y + 126, width: 18, height: 16 },
      wrongOwner: { x: card.x + 32, y: card.y + 126, width: 18, height: 16 },
      guardedBlank: { x: card.x + 32, y: card.y + 190, width: 72, height: 60 },
    } satisfies PqrtStateGraphicsAtlasEntry;
  });

export const PQRT_STATE_GRAPHICS_AUDIT: PqrtStateGraphicsAuditSnapshot = {
  cards: PQRT_STATE_GRAPHICS_ATLAS,
  authoredHoles: PQRT_STATE_GRAPHICS_ATLAS.flatMap(({ authoredHole }) => rectPoints(authoredHole)),
  openNotches: PQRT_STATE_GRAPHICS_ATLAS.flatMap(({ openNotch }) => rectPoints(openNotch)),
  thinStructures: PQRT_STATE_GRAPHICS_ATLAS.flatMap(({ thinStructure }) => rectPoints(thinStructure)),
  isolated: PQRT_STATE_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
  neutralStates: PQRT_STATE_GRAPHICS_ATLAS.map(({ neutralState }) => neutralState),
  wrongOwners: PQRT_STATE_GRAPHICS_ATLAS.map(({ wrongOwner }) => wrongOwner),
  guardedBlanks: PQRT_STATE_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
};

interface PqrtStateFixtureBackend extends SimulationBackend {
  presentationState(): Uint16Array;
  setFixturePresentationStateRect(x: number, y: number, width: number, height: number, state: number): void;
  setFixturePresentationState(x: number, y: number, state: number): void;
}

export function preparePqrtStateGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (!supportsPqrtStateFixture(simulation)) throw new Error('PQRT state graphics audit fixture requires a render-lab state plane');
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`PQRT state graphics audit fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of PQRT_STATE_GRAPHICS_ATLAS) {
    fillStateControl(simulation, cells, entry.body, entry.material, entry.encodedState);
    fillStateControl(simulation, cells, entry.authoredHole, Material.Empty, 0);
    fillStateControl(simulation, cells, entry.openNotch, Material.Empty, 0);
    fillStateControl(simulation, cells, entry.thinStructure, entry.material, entry.encodedState);
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = entry.material;
    simulation.setFixturePresentationState(entry.isolated.x, entry.isolated.y, entry.encodedState);
    fillStateControl(simulation, cells, entry.neutralState, entry.material, QUARTZ_PRESENTATION_STATE.neutralSpeckle);
    fillStateControl(simulation, cells, entry.wrongOwner, Material.Water, entry.encodedState);
    fillStateControl(simulation, cells, entry.guardedBlank, Material.Empty, 0);
  }
}

function supportsPqrtStateFixture(simulation: SimulationBackend): simulation is PqrtStateFixtureBackend {
  const candidate = simulation as Partial<PqrtStateFixtureBackend>;
  return typeof candidate.presentationState === 'function'
    && typeof candidate.setFixturePresentationStateRect === 'function'
    && typeof candidate.setFixturePresentationState === 'function';
}

function fillStateControl(simulation: PqrtStateFixtureBackend, cells: Uint8Array, rect: PqrtStateGraphicsRect, material: Material, state: number): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * simulation.width + rect.x, y * simulation.width + rect.x + rect.width);
  }
  simulation.setFixturePresentationStateRect(rect.x, rect.y, rect.width, rect.height, state);
}

function rectPoints(rect: PqrtStateGraphicsRect): PqrtStateGraphicsPoint[] {
  const points: PqrtStateGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}
