import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';
import { VIBR_PRESENTATION_STATE } from '../simulation/types';

export const VIBR_STATE_GRAPHICS_ATLAS_COLUMNS = 5;
export const VIBR_STATE_GRAPHICS_ATLAS_ROWS = 2;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 4;
const CARD_ORIGIN_Y = 4;
// Keep the five state cards aligned to the shared eight-cell charge lattice so
// the paired gate measures state amplitude rather than a shifted base motif.
const CARD_STRIDE_X = 120;
const CARD_STRIDE_Y = 190;
const CARD_WIDTH = 116;
const CARD_HEIGHT = 184;

export const VIBR_STATE_CHARGE_MASK = VIBR_PRESENTATION_STATE.chargeMask;
export const VIBR_STATE_LIFE_MASK = VIBR_PRESENTATION_STATE.countdownMask;
export const VIBR_STATE_LIFE_SHIFT = VIBR_PRESENTATION_STATE.countdownShift;
export const VIBR_STATE_ALTERNATE_MASK = VIBR_PRESENTATION_STATE.alternateModeMask;

export type VibrStateGraphicsKey = 'low' | 'mid' | 'high' | 'exploding' | 'alternate';

export interface VibrPresentationState {
  readonly key: VibrStateGraphicsKey;
  readonly charge: number;
  readonly life: number;
  readonly alternate: boolean;
}

export const VIBR_STATE_GRAPHICS_STATES = [
  { key: 'low', charge: 8, life: 0, alternate: false },
  { key: 'mid', charge: 54, life: 0, alternate: false },
  { key: 'high', charge: 99, life: 0, alternate: false },
  { key: 'exploding', charge: 100, life: 192, alternate: false },
  { key: 'alternate', charge: 100, life: 112, alternate: true },
] as const satisfies readonly VibrPresentationState[];

export interface VibrStateGraphicsPoint { readonly x: number; readonly y: number }
export interface VibrStateGraphicsRect extends VibrStateGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

export interface VibrStateGraphicsAtlasEntry {
  readonly material: Material.VIBR | Material.BVBR;
  readonly code: 'VIBR' | 'BVBR';
  readonly stateKey: VibrStateGraphicsKey;
  readonly charge: number;
  readonly life: number;
  readonly alternate: boolean;
  readonly encodedState: number;
  readonly index: number;
  readonly card: VibrStateGraphicsRect;
  readonly body: VibrStateGraphicsRect;
  readonly surfaceProbe: VibrStateGraphicsRect;
  readonly coreProbe: VibrStateGraphicsRect;
  readonly authoredHole: VibrStateGraphicsRect;
  readonly openNotch: VibrStateGraphicsRect;
  readonly thinStructure: VibrStateGraphicsRect;
  readonly isolated: VibrStateGraphicsPoint;
  /** Exact owner with zero native state; the dedicated state layer must be a no-op. */
  readonly zeroState: VibrStateGraphicsRect;
  /** Deliberately carries the card state while owning an unrelated material. */
  readonly wrongOwner: VibrStateGraphicsRect;
  readonly waterControl: VibrStateGraphicsRect;
  readonly metalControl: VibrStateGraphicsRect;
  readonly guardedBlank: VibrStateGraphicsRect;
}

export interface VibrStateGraphicsAuditSnapshot {
  readonly cards: readonly VibrStateGraphicsAtlasEntry[];
  readonly vibrCards: readonly VibrStateGraphicsAtlasEntry[];
  readonly bvbrCards: readonly VibrStateGraphicsAtlasEntry[];
  readonly authoredHoles: readonly VibrStateGraphicsPoint[];
  readonly openNotches: readonly VibrStateGraphicsPoint[];
  readonly thinStructures: readonly VibrStateGraphicsPoint[];
  readonly isolated: readonly VibrStateGraphicsPoint[];
  readonly zeroStates: readonly VibrStateGraphicsRect[];
  readonly wrongOwners: readonly VibrStateGraphicsRect[];
  readonly waterControls: readonly VibrStateGraphicsRect[];
  readonly metalControls: readonly VibrStateGraphicsRect[];
  readonly guardedBlanks: readonly VibrStateGraphicsRect[];
}

export function encodeVibrPresentationState(
  charge: number, normalizedLife: number, alternate: boolean,
): number {
  const chargeByte = clampInteger(charge, 0, 100);
  const lifeByte = clampInteger(normalizedLife, 0, 255);
  return chargeByte | (lifeByte << VIBR_STATE_LIFE_SHIFT)
    | (alternate ? VIBR_STATE_ALTERNATE_MASK : 0);
}

export function decodeVibrPresentationState(state: number): {
  readonly charge: number;
  readonly life: number;
  readonly alternate: boolean;
} {
  const word = state & 0xFFFF;
  return {
    charge: word & VIBR_STATE_CHARGE_MASK,
    life: (word & VIBR_STATE_LIFE_MASK) >>> VIBR_STATE_LIFE_SHIFT,
    alternate: (word & VIBR_STATE_ALTERNATE_MASK) !== 0,
  };
}

const VIBR_STATE_GRAPHICS_MATERIALS = [
  Material.VIBR, Material.BVBR,
] as const satisfies readonly (Material.VIBR | Material.BVBR)[];

export const VIBR_STATE_GRAPHICS_ATLAS: readonly VibrStateGraphicsAtlasEntry[] =
  VIBR_STATE_GRAPHICS_MATERIALS.flatMap((material, row) => VIBR_STATE_GRAPHICS_STATES.map((state, column) => {
  const card = {
    x: CARD_ORIGIN_X + column * CARD_STRIDE_X,
    y: CARD_ORIGIN_Y + row * CARD_STRIDE_Y,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  };
  const body = { x: card.x + 5, y: card.y + 6, width: 54, height: 58 };
  return {
    material,
    code: material === Material.VIBR ? 'VIBR' : 'BVBR',
    ...state,
    stateKey: state.key,
    encodedState: encodeVibrPresentationState(state.charge, state.life, state.alternate),
    index: row * VIBR_STATE_GRAPHICS_ATLAS_COLUMNS + column,
    card,
    body,
    surfaceProbe: { x: body.x + 5, y: body.y + 5, width: 8, height: 8 },
    coreProbe: { x: body.x + 5, y: body.y + 42, width: 8, height: 8 },
    authoredHole: { x: body.x + 20, y: body.y + 24, width: 6, height: 6 },
    openNotch: { x: body.x + 42, y: body.y + 35, width: 12, height: 8 },
    thinStructure: { x: card.x + 10, y: card.y + 72, width: 1, height: 24 },
    isolated: { x: card.x + 26, y: card.y + 86 },
    zeroState: { x: card.x + 96, y: card.y + 6, width: 12, height: 12 },
    wrongOwner: { x: card.x + 68, y: card.y + 6, width: 20, height: 18 },
    waterControl: { x: card.x + 68, y: card.y + 34, width: 20, height: 14 },
    metalControl: { x: card.x + 68, y: card.y + 56, width: 20, height: 14 },
    guardedBlank: { x: card.x + 62, y: card.y + 82, width: 48, height: 26 },
  } satisfies VibrStateGraphicsAtlasEntry;
}));

export const VIBR_STATE_GRAPHICS_AUDIT: VibrStateGraphicsAuditSnapshot = {
  cards: VIBR_STATE_GRAPHICS_ATLAS,
  vibrCards: VIBR_STATE_GRAPHICS_ATLAS.filter(({ material }) => material === Material.VIBR),
  bvbrCards: VIBR_STATE_GRAPHICS_ATLAS.filter(({ material }) => material === Material.BVBR),
  authoredHoles: VIBR_STATE_GRAPHICS_ATLAS.flatMap(({ authoredHole }) => rectPoints(authoredHole)),
  openNotches: VIBR_STATE_GRAPHICS_ATLAS.flatMap(({ openNotch }) => rectPoints(openNotch)),
  thinStructures: VIBR_STATE_GRAPHICS_ATLAS.flatMap(({ thinStructure }) => rectPoints(thinStructure)),
  isolated: VIBR_STATE_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
  zeroStates: VIBR_STATE_GRAPHICS_ATLAS.map(({ zeroState }) => zeroState),
  wrongOwners: VIBR_STATE_GRAPHICS_ATLAS.map(({ wrongOwner }) => wrongOwner),
  waterControls: VIBR_STATE_GRAPHICS_ATLAS.map(({ waterControl }) => waterControl),
  metalControls: VIBR_STATE_GRAPHICS_ATLAS.map(({ metalControl }) => metalControl),
  guardedBlanks: VIBR_STATE_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
};

interface VibrStateFixtureBackend extends SimulationBackend {
  presentationState(): Uint16Array;
  setFixturePresentationStateRect(
    x: number, y: number, width: number, height: number, state: number,
  ): void;
  setFixturePresentationState(x: number, y: number, state: number): void;
}

/** Builds one paused, matched semantic/state atlas without crossing native paint ABIs. */
export function prepareVibrStateGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (!supportsVibrStateFixture(simulation)) {
    throw new Error('VIBR/BVBR state graphics audit fixture requires a render-lab state plane');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`VIBR/BVBR state graphics audit fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of VIBR_STATE_GRAPHICS_ATLAS) {
    fillRect(cells, simulation.width, entry.body, entry.material);
    setStateRect(simulation, entry.body, entry.encodedState);
    fillRect(cells, simulation.width, entry.authoredHole, Material.Empty);
    setStateRect(simulation, entry.authoredHole, 0);
    fillRect(cells, simulation.width, entry.openNotch, Material.Empty);
    setStateRect(simulation, entry.openNotch, 0);
    fillRect(cells, simulation.width, entry.thinStructure, entry.material);
    setStateRect(simulation, entry.thinStructure, entry.encodedState);
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = entry.material;
    simulation.setFixturePresentationState(entry.isolated.x, entry.isolated.y, entry.encodedState);
    fillStateControl(simulation, cells, entry.zeroState, entry.material, 0);
    fillStateControl(simulation, cells, entry.wrongOwner, Material.Sand, entry.encodedState);
    fillStateControl(simulation, cells, entry.waterControl, Material.Water, entry.encodedState);
    fillStateControl(simulation, cells, entry.metalControl, Material.Metal, entry.encodedState);
    fillRect(cells, simulation.width, entry.guardedBlank, Material.Empty);
    setStateRect(simulation, entry.guardedBlank, 0);
  }
}

function supportsVibrStateFixture(
  simulation: SimulationBackend,
): simulation is VibrStateFixtureBackend {
  const candidate = simulation as Partial<VibrStateFixtureBackend>;
  return typeof candidate.presentationState === 'function'
    && typeof candidate.setFixturePresentationStateRect === 'function'
    && typeof candidate.setFixturePresentationState === 'function';
}

function fillStateControl(
  simulation: VibrStateFixtureBackend,
  cells: Uint8Array,
  rect: VibrStateGraphicsRect,
  material: Material,
  state: number,
): void {
  fillRect(cells, simulation.width, rect, material);
  setStateRect(simulation, rect, state);
}

function setStateRect(
  simulation: VibrStateFixtureBackend, rect: VibrStateGraphicsRect, state: number,
): void {
  simulation.setFixturePresentationStateRect(
    rect.x, rect.y, rect.width, rect.height, state,
  );
}

function fillRect(
  cells: Uint8Array, width: number, rect: VibrStateGraphicsRect, material: Material,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * width + rect.x, y * width + rect.x + rect.width);
  }
}

function rectPoints(rect: VibrStateGraphicsRect): VibrStateGraphicsPoint[] {
  const points: VibrStateGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Math.round(value)));
}
