import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';
import { LAVA_PRESENTATION_STATE } from '../simulation/types';

export const LAVA_STATE_GRAPHICS_ATLAS_COLUMNS = 3;
export const LAVA_STATE_GRAPHICS_ATLAS_ROWS = 2;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 4;
const CARD_ORIGIN_Y = 4;
const CARD_STRIDE_X = 202;
const CARD_STRIDE_Y = 190;
const CARD_WIDTH = 196;
const CARD_HEIGHT = 184;

export type LavaStateGraphicsKey =
  | 'untyped' | 'silicate' | 'metal' | 'mineral' | 'electronic' | 'radioactive';

export interface LavaStateGraphicsPoint { readonly x: number; readonly y: number }
export interface LavaStateGraphicsRect extends LavaStateGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

export interface LavaNativePresentationState {
  readonly key: LavaStateGraphicsKey;
  /** Public renderer identity projected from native Lava `ctype`; zero is untyped Lava. */
  readonly origin: Material;
  readonly originCode: 'NONE' | 'QRTZ' | 'GOLD' | 'SALT' | 'SLCN' | 'POLO';
  /** Stable solid identity shown beside the molten body without carrying Lava state. */
  readonly cooledMaterial: Material;
}

export const LAVA_STATE_GRAPHICS_STATES = [
  {
    key: 'untyped', origin: Material.Empty, originCode: 'NONE',
    cooledMaterial: Material.Stone,
  },
  {
    key: 'silicate', origin: Material.QRTZ, originCode: 'QRTZ',
    cooledMaterial: Material.QRTZ,
  },
  {
    key: 'metal', origin: Material.GOLD, originCode: 'GOLD',
    cooledMaterial: Material.GOLD,
  },
  {
    key: 'mineral', origin: Material.Salt, originCode: 'SALT',
    cooledMaterial: Material.Salt,
  },
  {
    key: 'electronic', origin: Material.SLCN, originCode: 'SLCN',
    cooledMaterial: Material.SLCN,
  },
  {
    key: 'radioactive', origin: Material.POLO, originCode: 'POLO',
    cooledMaterial: Material.POLO,
  },
] as const satisfies readonly LavaNativePresentationState[];

/** Keeps authoritative untyped Lava distinct from a non-Lava all-zero state word. */
export function encodeLavaOriginPresentationState(origin: Material): number {
  return LAVA_PRESENTATION_STATE.presentMask
    | (Math.max(0, Math.min(0xff, Math.round(origin))) & LAVA_PRESENTATION_STATE.originMask);
}

export interface LavaStateGraphicsAtlasEntry extends LavaNativePresentationState {
  readonly material: Material.Lava;
  readonly code: 'LAVA';
  readonly encodedState: number;
  readonly index: number;
  readonly card: LavaStateGraphicsRect;
  readonly body: LavaStateGraphicsRect;
  readonly surfaceProbe: LavaStateGraphicsRect;
  readonly coreProbe: LavaStateGraphicsRect;
  readonly originProbe: LavaStateGraphicsRect;
  readonly authoredHole: LavaStateGraphicsRect;
  readonly openNotch: LavaStateGraphicsRect;
  readonly thinStructure: LavaStateGraphicsRect;
  readonly isolated: LavaStateGraphicsPoint;
  /** Exact Lava owner with deliberately absent ancestry; dedicated styling must be a no-op. */
  readonly zeroState: LavaStateGraphicsRect;
  /** Sand deliberately carrying the card's encoded Lava ancestry. */
  readonly wrongOwner: LavaStateGraphicsRect;
  readonly waterControl: LavaStateGraphicsRect;
  /** The corresponding cooled identity, with no Lava presentation state. */
  readonly cooledSolidControl: LavaStateGraphicsRect;
  readonly guardedBlank: LavaStateGraphicsRect;
}

export interface LavaStateGraphicsAuditSnapshot {
  readonly cards: readonly LavaStateGraphicsAtlasEntry[];
  readonly authoredHoles: readonly LavaStateGraphicsPoint[];
  readonly openNotches: readonly LavaStateGraphicsPoint[];
  readonly thinStructures: readonly LavaStateGraphicsPoint[];
  readonly isolated: readonly LavaStateGraphicsPoint[];
  readonly zeroStates: readonly LavaStateGraphicsRect[];
  readonly wrongOwners: readonly LavaStateGraphicsRect[];
  readonly waterControls: readonly LavaStateGraphicsRect[];
  readonly cooledSolidControls: readonly LavaStateGraphicsRect[];
  readonly guardedBlanks: readonly LavaStateGraphicsRect[];
}

export const LAVA_STATE_GRAPHICS_ATLAS: readonly LavaStateGraphicsAtlasEntry[] =
  LAVA_STATE_GRAPHICS_STATES.map((state, index) => {
    const column = index % LAVA_STATE_GRAPHICS_ATLAS_COLUMNS;
    const row = Math.floor(index / LAVA_STATE_GRAPHICS_ATLAS_COLUMNS);
    const card = {
      x: CARD_ORIGIN_X + column * CARD_STRIDE_X,
      y: CARD_ORIGIN_Y + row * CARD_STRIDE_Y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    };
    const body = { x: card.x + 6, y: card.y + 8, width: 72, height: 64 };
    return {
      ...state,
      material: Material.Lava,
      code: 'LAVA',
      encodedState: encodeLavaOriginPresentationState(state.origin),
      index,
      card,
      body,
      surfaceProbe: { x: body.x + 5, y: body.y + 4, width: 8, height: 8 },
      coreProbe: { x: body.x + 18, y: body.y + 45, width: 8, height: 8 },
      originProbe: { x: body.x + 44, y: body.y + 38, width: 8, height: 8 },
      authoredHole: { x: body.x + 30, y: body.y + 28, width: 6, height: 6 },
      openNotch: { x: body.x + 64, y: body.y + 46, width: 8, height: 8 },
      thinStructure: { x: card.x + 8, y: card.y + 82, width: 1, height: 24 },
      isolated: { x: card.x + 34, y: card.y + 96 },
      zeroState: { x: card.x + 90, y: card.y + 8, width: 18, height: 16 },
      wrongOwner: { x: card.x + 116, y: card.y + 8, width: 18, height: 16 },
      waterControl: { x: card.x + 142, y: card.y + 8, width: 18, height: 16 },
      cooledSolidControl: { x: card.x + 168, y: card.y + 8, width: 18, height: 16 },
      guardedBlank: { x: card.x + 90, y: card.y + 50, width: 92, height: 64 },
    } satisfies LavaStateGraphicsAtlasEntry;
  });

export const LAVA_STATE_GRAPHICS_AUDIT: LavaStateGraphicsAuditSnapshot = {
  cards: LAVA_STATE_GRAPHICS_ATLAS,
  authoredHoles: LAVA_STATE_GRAPHICS_ATLAS.flatMap(({ authoredHole }) => rectPoints(authoredHole)),
  openNotches: LAVA_STATE_GRAPHICS_ATLAS.flatMap(({ openNotch }) => rectPoints(openNotch)),
  thinStructures: LAVA_STATE_GRAPHICS_ATLAS.flatMap(({ thinStructure }) => rectPoints(thinStructure)),
  isolated: LAVA_STATE_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
  zeroStates: LAVA_STATE_GRAPHICS_ATLAS.map(({ zeroState }) => zeroState),
  wrongOwners: LAVA_STATE_GRAPHICS_ATLAS.map(({ wrongOwner }) => wrongOwner),
  waterControls: LAVA_STATE_GRAPHICS_ATLAS.map(({ waterControl }) => waterControl),
  cooledSolidControls: LAVA_STATE_GRAPHICS_ATLAS.map(({ cooledSolidControl }) => cooledSolidControl),
  guardedBlanks: LAVA_STATE_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
};

interface LavaStateFixtureBackend extends SimulationBackend {
  presentationState(): Uint16Array;
  setFixturePresentationStateRect(
    x: number, y: number, width: number, height: number, state: number,
  ): void;
  setFixturePresentationState(x: number, y: number, state: number): void;
}

/** Builds a paused exact-owner molten-ancestry atlas without crossing native particle ABIs. */
export function prepareLavaStateGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (!supportsLavaStateFixture(simulation)) {
    throw new Error('Lava state graphics audit fixture requires a render-lab state plane');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Lava state graphics audit fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of LAVA_STATE_GRAPHICS_ATLAS) {
    fillStateControl(simulation, cells, entry.body, Material.Lava, entry.encodedState);
    fillStateControl(simulation, cells, entry.authoredHole, Material.Empty, 0);
    fillStateControl(simulation, cells, entry.openNotch, Material.Empty, 0);
    fillStateControl(simulation, cells, entry.thinStructure, Material.Lava, entry.encodedState);
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = Material.Lava;
    simulation.setFixturePresentationState(
      entry.isolated.x, entry.isolated.y, entry.encodedState,
    );
    fillStateControl(simulation, cells, entry.zeroState, Material.Lava, 0);
    fillStateControl(simulation, cells, entry.wrongOwner, Material.Sand, entry.encodedState);
    fillStateControl(simulation, cells, entry.waterControl, Material.Water, entry.encodedState);
    fillStateControl(
      simulation, cells, entry.cooledSolidControl, entry.cooledMaterial, 0,
    );
    fillStateControl(simulation, cells, entry.guardedBlank, Material.Empty, 0);
  }
}

function supportsLavaStateFixture(
  simulation: SimulationBackend,
): simulation is LavaStateFixtureBackend {
  const candidate = simulation as Partial<LavaStateFixtureBackend>;
  return typeof candidate.presentationState === 'function'
    && typeof candidate.setFixturePresentationStateRect === 'function'
    && typeof candidate.setFixturePresentationState === 'function';
}

function fillStateControl(
  simulation: LavaStateFixtureBackend,
  cells: Uint8Array,
  rect: LavaStateGraphicsRect,
  material: Material,
  state: number,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * simulation.width + rect.x, y * simulation.width + rect.x + rect.width);
  }
  simulation.setFixturePresentationStateRect(rect.x, rect.y, rect.width, rect.height, state);
}

function rectPoints(rect: LavaStateGraphicsRect): LavaStateGraphicsPoint[] {
  const points: LavaStateGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}
