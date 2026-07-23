import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';
import { PLNT_PRESENTATION_STATE, SEED_PRESENTATION_STATE } from '../simulation/types';

export const BOTANICAL_LIFECYCLE_GRAPHICS_ATLAS_COLUMNS = 4;
export const BOTANICAL_LIFECYCLE_GRAPHICS_ATLAS_ROWS = 2;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 4;
const CARD_ORIGIN_Y = 4;
const CARD_STRIDE_X = 151;
const CARD_STRIDE_Y = 190;
const CARD_WIDTH = 146;
const CARD_HEIGHT = 184;

export type BotanicalLifecycleGraphicsKey =
  | 'seedDry'
  | 'seedSip'
  | 'seedReady'
  | 'seedGerminating'
  | 'plantOrdinary'
  | 'plantTreeGreen'
  | 'plantTreeCyan'
  | 'plantTreeMagenta';

export interface BotanicalLifecycleGraphicsPoint {
  readonly x: number;
  readonly y: number;
}

export interface BotanicalLifecycleGraphicsRect extends BotanicalLifecycleGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

export interface SeedLifecyclePresentationState {
  readonly kind: 'seed';
  readonly key: Extract<BotanicalLifecycleGraphicsKey, `seed${string}`>;
  readonly material: Material.SEED;
  readonly code: 'SEED';
  /** Exact native SEED water counter projected from ctype. */
  readonly water: number;
  /** Exact bounded native SEED life timer. */
  readonly germinationTimer: number;
  readonly encodedState: number;
}

export interface PlantLifecyclePresentationState {
  readonly kind: 'plant';
  readonly key: Extract<BotanicalLifecycleGraphicsKey, `plant${string}`>;
  readonly material: Material.Plant;
  readonly code: 'PLNT';
  readonly tree: boolean;
  readonly phase: number;
  readonly direction: number;
  /** Exact six inherited-colour bits from native PLNT ctype, not a palette index. */
  readonly inheritedColour: number;
  readonly hydrationClass: number;
  readonly activeGrowth: boolean;
  readonly encodedState: number;
}

export type BotanicalLifecyclePresentationState =
  | SeedLifecyclePresentationState
  | PlantLifecyclePresentationState;

export function encodeSeedLifecyclePresentationState(
  water: number,
  germinationTimer: number,
): number {
  const encodedWater = clampInteger(water, 0, SEED_PRESENTATION_STATE.waterMaximum);
  const encodedTimer = clampInteger(
    germinationTimer, 0, SEED_PRESENTATION_STATE.germinationMaximum,
  );
  return (encodedWater & SEED_PRESENTATION_STATE.waterMask)
    | ((encodedTimer << SEED_PRESENTATION_STATE.germinationShift)
      & SEED_PRESENTATION_STATE.germinationMask);
}

export function encodePlantLifecyclePresentationState(
  tree: boolean,
  phase: number,
  direction: number,
  inheritedColour: number,
  hydrationClass: number,
  activeGrowth: boolean,
): number {
  return PLNT_PRESENTATION_STATE.presentMask
    | (tree ? PLNT_PRESENTATION_STATE.treeMask : 0)
    | ((clampInteger(phase, 0, 3) << PLNT_PRESENTATION_STATE.phaseShift)
      & PLNT_PRESENTATION_STATE.phaseMask)
    | ((clampInteger(direction, 0, 7) << PLNT_PRESENTATION_STATE.directionShift)
      & PLNT_PRESENTATION_STATE.directionMask)
    | ((clampInteger(inheritedColour, 0, 0x3f)
      << PLNT_PRESENTATION_STATE.inheritedColourShift)
      & PLNT_PRESENTATION_STATE.inheritedColourMask)
    | ((clampInteger(hydrationClass, 0, 3)
      << PLNT_PRESENTATION_STATE.hydrationClassShift)
      & PLNT_PRESENTATION_STATE.hydrationClassMask)
    | (activeGrowth ? PLNT_PRESENTATION_STATE.activeGrowthMask : 0);
}

export const BOTANICAL_LIFECYCLE_GRAPHICS_STATES = [
  {
    kind: 'seed',
    key: 'seedDry',
    material: Material.SEED,
    code: 'SEED',
    water: 0,
    germinationTimer: 0,
    encodedState: encodeSeedLifecyclePresentationState(0, 0),
  },
  {
    kind: 'seed',
    key: 'seedSip',
    material: Material.SEED,
    code: 'SEED',
    water: 2,
    germinationTimer: 0,
    encodedState: encodeSeedLifecyclePresentationState(2, 0),
  },
  {
    kind: 'seed',
    key: 'seedReady',
    material: Material.SEED,
    code: 'SEED',
    water: 8,
    germinationTimer: 64,
    encodedState: encodeSeedLifecyclePresentationState(8, 64),
  },
  {
    kind: 'seed',
    key: 'seedGerminating',
    material: Material.SEED,
    code: 'SEED',
    water: 31,
    germinationTimer: 200,
    encodedState: encodeSeedLifecyclePresentationState(31, 200),
  },
  {
    kind: 'plant',
    key: 'plantOrdinary',
    material: Material.Plant,
    code: 'PLNT',
    tree: false,
    phase: 0,
    direction: 0,
    inheritedColour: 0,
    hydrationClass: 0,
    activeGrowth: false,
    encodedState: encodePlantLifecyclePresentationState(false, 0, 0, 0, 0, false),
  },
  {
    kind: 'plant',
    key: 'plantTreeGreen',
    material: Material.Plant,
    code: 'PLNT',
    tree: true,
    phase: 0,
    direction: 4,
    inheritedColour: 21,
    hydrationClass: 1,
    activeGrowth: true,
    encodedState: encodePlantLifecyclePresentationState(true, 0, 4, 21, 1, true),
  },
  {
    kind: 'plant',
    key: 'plantTreeCyan',
    material: Material.Plant,
    code: 'PLNT',
    tree: true,
    phase: 1,
    direction: 6,
    inheritedColour: 16,
    hydrationClass: 2,
    activeGrowth: true,
    encodedState: encodePlantLifecyclePresentationState(true, 1, 6, 16, 2, true),
  },
  {
    kind: 'plant',
    key: 'plantTreeMagenta',
    material: Material.Plant,
    code: 'PLNT',
    tree: true,
    phase: 3,
    direction: 1,
    inheritedColour: 4,
    hydrationClass: 3,
    activeGrowth: false,
    encodedState: encodePlantLifecyclePresentationState(true, 3, 1, 4, 3, false),
  },
] as const satisfies readonly BotanicalLifecyclePresentationState[];

interface BotanicalLifecycleGraphicsGeometry {
  readonly index: number;
  readonly card: BotanicalLifecycleGraphicsRect;
  readonly body: BotanicalLifecycleGraphicsRect;
  readonly surfaceProbe: BotanicalLifecycleGraphicsRect;
  readonly coreProbe: BotanicalLifecycleGraphicsRect;
  readonly lifecycleProbe: BotanicalLifecycleGraphicsRect;
  readonly authoredHole: BotanicalLifecycleGraphicsRect;
  readonly openNotch: BotanicalLifecycleGraphicsRect;
  readonly thinStructure: BotanicalLifecycleGraphicsRect;
  readonly isolated: BotanicalLifecycleGraphicsPoint;
  /** Exact owner with a deliberately all-zero state word. */
  readonly zeroState: BotanicalLifecycleGraphicsRect;
  /** Unrelated solid deliberately carrying the card's complete lifecycle word. */
  readonly wrongOwner: BotanicalLifecycleGraphicsRect;
  readonly waterControl: BotanicalLifecycleGraphicsRect;
  readonly sandControl: BotanicalLifecycleGraphicsRect;
  readonly guardedBlank: BotanicalLifecycleGraphicsRect;
}

export type BotanicalLifecycleGraphicsAtlasEntry =
  BotanicalLifecyclePresentationState & BotanicalLifecycleGraphicsGeometry;

export interface BotanicalLifecycleGraphicsAuditSnapshot {
  readonly cards: readonly BotanicalLifecycleGraphicsAtlasEntry[];
  readonly seedCards: readonly BotanicalLifecycleGraphicsAtlasEntry[];
  readonly plantCards: readonly BotanicalLifecycleGraphicsAtlasEntry[];
  readonly authoredHoles: readonly BotanicalLifecycleGraphicsPoint[];
  readonly openNotches: readonly BotanicalLifecycleGraphicsPoint[];
  readonly thinStructures: readonly BotanicalLifecycleGraphicsPoint[];
  readonly isolated: readonly BotanicalLifecycleGraphicsPoint[];
  readonly zeroStates: readonly BotanicalLifecycleGraphicsRect[];
  readonly wrongOwners: readonly BotanicalLifecycleGraphicsRect[];
  readonly waterControls: readonly BotanicalLifecycleGraphicsRect[];
  readonly sandControls: readonly BotanicalLifecycleGraphicsRect[];
  readonly guardedBlanks: readonly BotanicalLifecycleGraphicsRect[];
}

export const BOTANICAL_LIFECYCLE_GRAPHICS_ATLAS: readonly BotanicalLifecycleGraphicsAtlasEntry[] =
  BOTANICAL_LIFECYCLE_GRAPHICS_STATES.map((state, index) => {
    const column = index % BOTANICAL_LIFECYCLE_GRAPHICS_ATLAS_COLUMNS;
    const row = Math.floor(index / BOTANICAL_LIFECYCLE_GRAPHICS_ATLAS_COLUMNS);
    const card = {
      x: CARD_ORIGIN_X + column * CARD_STRIDE_X,
      y: CARD_ORIGIN_Y + row * CARD_STRIDE_Y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    };
    const body = { x: card.x + 6, y: card.y + 8, width: 64, height: 62 };
    return {
      ...state,
      index,
      card,
      body,
      surfaceProbe: { x: body.x + 5, y: body.y + 4, width: 8, height: 8 },
      coreProbe: { x: body.x + 18, y: body.y + 43, width: 8, height: 8 },
      lifecycleProbe: { x: body.x + 42, y: body.y + 34, width: 8, height: 8 },
      authoredHole: { x: body.x + 27, y: body.y + 27, width: 6, height: 6 },
      openNotch: { x: body.x + 56, y: body.y + 44, width: 8, height: 8 },
      thinStructure: { x: card.x + 8, y: card.y + 82, width: 1, height: 24 },
      isolated: { x: card.x + 30, y: card.y + 99 },
      zeroState: { x: card.x + 78, y: card.y + 8, width: 16, height: 16 },
      wrongOwner: { x: card.x + 100, y: card.y + 8, width: 16, height: 16 },
      waterControl: { x: card.x + 122, y: card.y + 8, width: 16, height: 16 },
      sandControl: { x: card.x + 78, y: card.y + 34, width: 16, height: 16 },
      guardedBlank: { x: card.x + 78, y: card.y + 64, width: 60, height: 52 },
    } satisfies BotanicalLifecycleGraphicsAtlasEntry;
  });

export const BOTANICAL_LIFECYCLE_GRAPHICS_AUDIT: BotanicalLifecycleGraphicsAuditSnapshot = {
  cards: BOTANICAL_LIFECYCLE_GRAPHICS_ATLAS,
  seedCards: BOTANICAL_LIFECYCLE_GRAPHICS_ATLAS.filter(({ kind }) => kind === 'seed'),
  plantCards: BOTANICAL_LIFECYCLE_GRAPHICS_ATLAS.filter(({ kind }) => kind === 'plant'),
  authoredHoles: BOTANICAL_LIFECYCLE_GRAPHICS_ATLAS
    .flatMap(({ authoredHole }) => rectPoints(authoredHole)),
  openNotches: BOTANICAL_LIFECYCLE_GRAPHICS_ATLAS
    .flatMap(({ openNotch }) => rectPoints(openNotch)),
  thinStructures: BOTANICAL_LIFECYCLE_GRAPHICS_ATLAS
    .flatMap(({ thinStructure }) => rectPoints(thinStructure)),
  isolated: BOTANICAL_LIFECYCLE_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
  zeroStates: BOTANICAL_LIFECYCLE_GRAPHICS_ATLAS.map(({ zeroState }) => zeroState),
  wrongOwners: BOTANICAL_LIFECYCLE_GRAPHICS_ATLAS.map(({ wrongOwner }) => wrongOwner),
  waterControls: BOTANICAL_LIFECYCLE_GRAPHICS_ATLAS.map(({ waterControl }) => waterControl),
  sandControls: BOTANICAL_LIFECYCLE_GRAPHICS_ATLAS.map(({ sandControl }) => sandControl),
  guardedBlanks: BOTANICAL_LIFECYCLE_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
};

interface BotanicalLifecycleFixtureBackend extends SimulationBackend {
  presentationState(): Uint16Array;
  setFixturePresentationStateRect(
    x: number, y: number, width: number, height: number, state: number,
  ): void;
  setFixturePresentationState(x: number, y: number, state: number): void;
}

/** Builds one paused native-state botanical atlas without crossing particle paint ABIs. */
export function prepareBotanicalLifecycleGraphicsAuditFixture(
  simulation: SimulationBackend,
): void {
  if (!supportsBotanicalLifecycleFixture(simulation)) {
    throw new Error('Botanical lifecycle graphics audit fixture requires a render-lab state plane');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(
      `Botanical lifecycle graphics audit fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`,
    );
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of BOTANICAL_LIFECYCLE_GRAPHICS_ATLAS) {
    fillStateControl(simulation, cells, entry.body, entry.material, entry.encodedState);
    fillStateControl(simulation, cells, entry.authoredHole, Material.Empty, 0);
    fillStateControl(simulation, cells, entry.openNotch, Material.Empty, 0);
    fillStateControl(
      simulation, cells, entry.thinStructure, entry.material, entry.encodedState,
    );
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = entry.material;
    simulation.setFixturePresentationState(
      entry.isolated.x, entry.isolated.y, entry.encodedState,
    );
    fillStateControl(simulation, cells, entry.zeroState, entry.material, 0);
    fillStateControl(simulation, cells, entry.wrongOwner, Material.Metal, entry.encodedState);
    fillStateControl(simulation, cells, entry.waterControl, Material.Water, entry.encodedState);
    fillStateControl(simulation, cells, entry.sandControl, Material.Sand, entry.encodedState);
    fillStateControl(simulation, cells, entry.guardedBlank, Material.Empty, 0);
  }
}

function supportsBotanicalLifecycleFixture(
  simulation: SimulationBackend,
): simulation is BotanicalLifecycleFixtureBackend {
  const candidate = simulation as Partial<BotanicalLifecycleFixtureBackend>;
  return typeof candidate.presentationState === 'function'
    && typeof candidate.setFixturePresentationStateRect === 'function'
    && typeof candidate.setFixturePresentationState === 'function';
}

function fillStateControl(
  simulation: BotanicalLifecycleFixtureBackend,
  cells: Uint8Array,
  rect: BotanicalLifecycleGraphicsRect,
  material: Material,
  state: number,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * simulation.width + rect.x, y * simulation.width + rect.x + rect.width);
  }
  simulation.setFixturePresentationStateRect(rect.x, rect.y, rect.width, rect.height, state);
}

function rectPoints(rect: BotanicalLifecycleGraphicsRect): BotanicalLifecycleGraphicsPoint[] {
  const points: BotanicalLifecycleGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Math.round(value)));
}
