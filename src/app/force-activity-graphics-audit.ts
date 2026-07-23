import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

export const FORCE_ACTIVITY_GRAPHICS_ATLAS_COLUMNS = 2;
export const FORCE_ACTIVITY_GRAPHICS_ATLAS_ROWS = 2;
export const FORCE_ACTIVITY_INACTIVE_STATE = 0;
export const FORCE_ACTIVITY_ACTIVE_STATE = 1;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 8;
const CARD_ORIGIN_Y = 8;
// Both strides preserve the shared eight-cell motif phase across owner/state cards.
const CARD_STRIDE_X = 296;
const CARD_STRIDE_Y = 184;
const CARD_WIDTH = 288;
const CARD_HEIGHT = 176;

export type ForceActivityGraphicsKey = 'inactive' | 'active';
export type ForceActivityGraphicsOwner = Material.ACEL | Material.DCEL;

export interface ForceActivityGraphicsPoint { readonly x: number; readonly y: number }
export interface ForceActivityGraphicsRect extends ForceActivityGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

export interface ForceActivityGraphicsAtlasEntry {
  readonly material: ForceActivityGraphicsOwner;
  readonly code: 'ACEL' | 'DCEL';
  readonly stateKey: ForceActivityGraphicsKey;
  readonly active: boolean;
  readonly encodedState: 0 | 1;
  readonly index: number;
  readonly card: ForceActivityGraphicsRect;
  readonly body: ForceActivityGraphicsRect;
  readonly surfaceProbe: ForceActivityGraphicsRect;
  readonly coreProbe: ForceActivityGraphicsRect;
  /** Samples the long axis of the activity-direction motif. */
  readonly motifAxisProbe: ForceActivityGraphicsRect;
  /** Samples its directional arrow/accent rather than only base-body colour. */
  readonly motifArrowProbe: ForceActivityGraphicsRect;
  /** Same-sized body control outside the expected motif accent. */
  readonly motifBackgroundProbe: ForceActivityGraphicsRect;
  readonly authoredHole: ForceActivityGraphicsRect;
  readonly openNotch: ForceActivityGraphicsRect;
  readonly thinStructure: ForceActivityGraphicsRect;
  readonly isolated: ForceActivityGraphicsPoint;
  /** Unrelated Sand deliberately carrying active state one. */
  readonly wrongOwner: ForceActivityGraphicsRect;
  /** Wrong-phase controls deliberately carry active state one. */
  readonly waterControl: ForceActivityGraphicsRect;
  readonly metalControl: ForceActivityGraphicsRect;
  readonly guardedBlank: ForceActivityGraphicsRect;
}

export interface ForceActivityGraphicsAuditSnapshot {
  readonly cards: readonly ForceActivityGraphicsAtlasEntry[];
  readonly acelCards: readonly ForceActivityGraphicsAtlasEntry[];
  readonly dcelCards: readonly ForceActivityGraphicsAtlasEntry[];
  readonly inactiveCards: readonly ForceActivityGraphicsAtlasEntry[];
  readonly activeCards: readonly ForceActivityGraphicsAtlasEntry[];
  readonly authoredHoles: readonly ForceActivityGraphicsPoint[];
  readonly openNotches: readonly ForceActivityGraphicsPoint[];
  readonly thinStructures: readonly ForceActivityGraphicsPoint[];
  readonly isolated: readonly ForceActivityGraphicsPoint[];
  readonly wrongOwners: readonly ForceActivityGraphicsRect[];
  readonly waterControls: readonly ForceActivityGraphicsRect[];
  readonly metalControls: readonly ForceActivityGraphicsRect[];
  readonly guardedBlanks: readonly ForceActivityGraphicsRect[];
}

export const FORCE_ACTIVITY_GRAPHICS_STATES = [
  { key: 'inactive', active: false, encodedState: FORCE_ACTIVITY_INACTIVE_STATE },
  { key: 'active', active: true, encodedState: FORCE_ACTIVITY_ACTIVE_STATE },
] as const satisfies readonly {
  readonly key: ForceActivityGraphicsKey;
  readonly active: boolean;
  readonly encodedState: 0 | 1;
}[];

const FORCE_ACTIVITY_GRAPHICS_MATERIALS = [
  Material.ACEL, Material.DCEL,
] as const satisfies readonly ForceActivityGraphicsOwner[];

export const FORCE_ACTIVITY_GRAPHICS_ATLAS: readonly ForceActivityGraphicsAtlasEntry[] =
  FORCE_ACTIVITY_GRAPHICS_MATERIALS.flatMap((material, row) => (
    FORCE_ACTIVITY_GRAPHICS_STATES.map((state, column) => {
      const card = {
        x: CARD_ORIGIN_X + column * CARD_STRIDE_X,
        y: CARD_ORIGIN_Y + row * CARD_STRIDE_Y,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
      };
      const body = { x: card.x + 8, y: card.y + 8, width: 112, height: 64 };
      return {
        material,
        code: material === Material.ACEL ? 'ACEL' : 'DCEL',
        stateKey: state.key,
        active: state.active,
        encodedState: state.encodedState,
        index: row * FORCE_ACTIVITY_GRAPHICS_ATLAS_COLUMNS + column,
        card,
        body,
        surfaceProbe: { x: body.x + 4, y: body.y + 4, width: 8, height: 8 },
        coreProbe: { x: body.x + 12, y: body.y + 48, width: 8, height: 8 },
        motifAxisProbe: { x: body.x + 8, y: body.y + 32, width: 8, height: 8 },
        motifArrowProbe: { x: body.x + 24, y: body.y + 32, width: 8, height: 8 },
        motifBackgroundProbe: { x: body.x + 64, y: body.y + 32, width: 8, height: 8 },
        authoredHole: { x: body.x + 44, y: body.y + 26, width: 6, height: 6 },
        openNotch: { x: body.x + 100, y: body.y + 40, width: 12, height: 8 },
        thinStructure: { x: card.x + 10, y: card.y + 82, width: 1, height: 24 },
        isolated: { x: card.x + 38, y: card.y + 96 },
        wrongOwner: { x: card.x + 142, y: card.y + 8, width: 20, height: 16 },
        waterControl: { x: card.x + 142, y: card.y + 34, width: 20, height: 14 },
        metalControl: { x: card.x + 142, y: card.y + 56, width: 20, height: 14 },
        guardedBlank: { x: card.x + 136, y: card.y + 86, width: 80, height: 30 },
      } satisfies ForceActivityGraphicsAtlasEntry;
    })
  ));

export const FORCE_ACTIVITY_GRAPHICS_AUDIT: ForceActivityGraphicsAuditSnapshot = {
  cards: FORCE_ACTIVITY_GRAPHICS_ATLAS,
  acelCards: FORCE_ACTIVITY_GRAPHICS_ATLAS.filter(({ material }) => material === Material.ACEL),
  dcelCards: FORCE_ACTIVITY_GRAPHICS_ATLAS.filter(({ material }) => material === Material.DCEL),
  inactiveCards: FORCE_ACTIVITY_GRAPHICS_ATLAS.filter(({ active }) => !active),
  activeCards: FORCE_ACTIVITY_GRAPHICS_ATLAS.filter(({ active }) => active),
  authoredHoles: FORCE_ACTIVITY_GRAPHICS_ATLAS.flatMap(({ authoredHole }) => rectPoints(authoredHole)),
  openNotches: FORCE_ACTIVITY_GRAPHICS_ATLAS.flatMap(({ openNotch }) => rectPoints(openNotch)),
  thinStructures: FORCE_ACTIVITY_GRAPHICS_ATLAS.flatMap(({ thinStructure }) => rectPoints(thinStructure)),
  isolated: FORCE_ACTIVITY_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
  wrongOwners: FORCE_ACTIVITY_GRAPHICS_ATLAS.map(({ wrongOwner }) => wrongOwner),
  waterControls: FORCE_ACTIVITY_GRAPHICS_ATLAS.map(({ waterControl }) => waterControl),
  metalControls: FORCE_ACTIVITY_GRAPHICS_ATLAS.map(({ metalControl }) => metalControl),
  guardedBlanks: FORCE_ACTIVITY_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
};

interface ForceActivityFixtureBackend extends SimulationBackend {
  presentationState(): Uint16Array;
  setFixturePresentationStateRect(
    x: number, y: number, width: number, height: number, state: number,
  ): void;
  setFixturePresentationState(x: number, y: number, state: number): void;
}

/** Builds one paused exact-owner activity atlas without crossing native paint ABIs. */
export function prepareForceActivityGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (!supportsForceActivityFixture(simulation)) {
    throw new Error('ACEL/DCEL activity graphics audit fixture requires a render-lab state plane');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`ACEL/DCEL activity graphics audit fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of FORCE_ACTIVITY_GRAPHICS_ATLAS) {
    fillStateControl(simulation, cells, entry.body, entry.material, entry.encodedState);
    fillStateControl(simulation, cells, entry.authoredHole, Material.Empty, 0);
    fillStateControl(simulation, cells, entry.openNotch, Material.Empty, 0);
    fillStateControl(simulation, cells, entry.thinStructure, entry.material, entry.encodedState);
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = entry.material;
    simulation.setFixturePresentationState(
      entry.isolated.x, entry.isolated.y, entry.encodedState,
    );
    fillStateControl(simulation, cells, entry.wrongOwner, Material.Sand, 1);
    fillStateControl(simulation, cells, entry.waterControl, Material.Water, 1);
    fillStateControl(simulation, cells, entry.metalControl, Material.Metal, 1);
    fillStateControl(simulation, cells, entry.guardedBlank, Material.Empty, 0);
  }
}

function supportsForceActivityFixture(
  simulation: SimulationBackend,
): simulation is ForceActivityFixtureBackend {
  const candidate = simulation as Partial<ForceActivityFixtureBackend>;
  return typeof candidate.presentationState === 'function'
    && typeof candidate.setFixturePresentationStateRect === 'function'
    && typeof candidate.setFixturePresentationState === 'function';
}

function fillStateControl(
  simulation: ForceActivityFixtureBackend,
  cells: Uint8Array,
  rect: ForceActivityGraphicsRect,
  material: Material,
  state: number,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * simulation.width + rect.x, y * simulation.width + rect.x + rect.width);
  }
  simulation.setFixturePresentationStateRect(
    rect.x, rect.y, rect.width, rect.height, state,
  );
}

function rectPoints(rect: ForceActivityGraphicsRect): ForceActivityGraphicsPoint[] {
  const points: ForceActivityGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}
