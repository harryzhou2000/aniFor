import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';
import { BASE_PRESENTATION_STATE } from '../simulation/types';

export const BASE_STATE_GRAPHICS_ATLAS_COLUMNS = 3;
export const BASE_STATE_GRAPHICS_ATLAS_ROWS = 2;
export const BASE_CONCENTRATION_MAXIMUM = BASE_PRESENTATION_STATE.concentrationMaximum;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 4;
const CARD_ORIGIN_Y = 4;
const CARD_STRIDE_X = 202;
const CARD_STRIDE_Y = 190;
const CARD_WIDTH = 196;
const CARD_HEIGHT = 184;

export type BaseStateGraphicsKey = 'empty' | 'dilute' | 'balanced' | 'concentrated' | 'saturated' | 'spark';

export interface BaseStateGraphicsPoint { readonly x: number; readonly y: number }
export interface BaseStateGraphicsRect extends BaseStateGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

export interface BaseNativePresentationState {
  readonly key: BaseStateGraphicsKey;
  /** Exact native BASE concentration, from zero through the bounded saturated state. */
  readonly concentration: number;
  /** Native BASE electrical activity; it does not change semantic BASE ownership. */
  readonly spark: boolean;
}

export const BASE_STATE_GRAPHICS_STATES = [
  { key: 'empty', concentration: 0, spark: false },
  { key: 'dilute', concentration: 25, spark: false },
  { key: 'balanced', concentration: 50, spark: false },
  { key: 'concentrated', concentration: 76, spark: false },
  { key: 'saturated', concentration: BASE_CONCENTRATION_MAXIMUM, spark: false },
  { key: 'spark', concentration: 76, spark: true },
] as const satisfies readonly BaseNativePresentationState[];

/** Packs exact BASE concentration and electrical state into its owner-guarded native word. */
export function encodeBasePresentationState(concentration: number, spark = false): number {
  const boundedConcentration = Math.max(
    0, Math.min(BASE_CONCENTRATION_MAXIMUM, Math.round(concentration)),
  );
  return (boundedConcentration & BASE_PRESENTATION_STATE.concentrationMask)
    | (spark ? BASE_PRESENTATION_STATE.sparkMask : 0);
}

export interface BaseStateGraphicsAtlasEntry extends BaseNativePresentationState {
  readonly material: Material.BASE;
  readonly code: 'BASE';
  readonly encodedState: number;
  readonly index: number;
  readonly card: BaseStateGraphicsRect;
  readonly body: BaseStateGraphicsRect;
  readonly surfaceProbe: BaseStateGraphicsRect;
  readonly coreProbe: BaseStateGraphicsRect;
  readonly concentrationProbe: BaseStateGraphicsRect;
  readonly sparkProbe: BaseStateGraphicsRect;
  readonly authoredHole: BaseStateGraphicsRect;
  readonly openNotch: BaseStateGraphicsRect;
  readonly thinStrand: BaseStateGraphicsRect;
  readonly isolated: BaseStateGraphicsPoint;
  /** A valid BASE owner with exact zero concentration, never an absent state. */
  readonly zeroConcentration: BaseStateGraphicsRect;
  /** Unrelated matter deliberately carrying this card's complete BASE state. */
  readonly wrongOwner: BaseStateGraphicsRect;
  readonly waterControl: BaseStateGraphicsRect;
  readonly acidControl: BaseStateGraphicsRect;
  readonly causControl: BaseStateGraphicsRect;
  readonly saltWaterControl: BaseStateGraphicsRect;
  readonly oilControl: BaseStateGraphicsRect;
  readonly soapControl: BaseStateGraphicsRect;
  readonly gelControl: BaseStateGraphicsRect;
  readonly metalControl: BaseStateGraphicsRect;
  readonly bmtlControl: BaseStateGraphicsRect;
  readonly boylControl: BaseStateGraphicsRect;
  /** Exact BASE/state co-located with a native wall; state optics must remain suppressed. */
  readonly nativeWallControl: BaseStateGraphicsRect;
  readonly guardedBlank: BaseStateGraphicsRect;
}

export interface BaseStateGraphicsAuditSnapshot {
  readonly version: 1;
  readonly world: { readonly width: 612; readonly height: 384 };
  readonly cards: readonly BaseStateGraphicsAtlasEntry[];
  readonly authoredHoles: readonly BaseStateGraphicsPoint[];
  readonly openNotches: readonly BaseStateGraphicsPoint[];
  readonly thinStrands: readonly BaseStateGraphicsPoint[];
  readonly isolated: readonly BaseStateGraphicsPoint[];
  readonly zeroConcentrations: readonly BaseStateGraphicsRect[];
  readonly wrongOwners: readonly BaseStateGraphicsRect[];
  readonly waterControls: readonly BaseStateGraphicsRect[];
  readonly acidControls: readonly BaseStateGraphicsRect[];
  readonly causControls: readonly BaseStateGraphicsRect[];
  readonly saltWaterControls: readonly BaseStateGraphicsRect[];
  readonly oilControls: readonly BaseStateGraphicsRect[];
  readonly soapControls: readonly BaseStateGraphicsRect[];
  readonly gelControls: readonly BaseStateGraphicsRect[];
  readonly metalControls: readonly BaseStateGraphicsRect[];
  readonly bmtlControls: readonly BaseStateGraphicsRect[];
  readonly boylControls: readonly BaseStateGraphicsRect[];
  readonly nativeWallControls: readonly BaseStateGraphicsRect[];
  readonly guardedBlanks: readonly BaseStateGraphicsRect[];
}

export const BASE_STATE_GRAPHICS_ATLAS: readonly BaseStateGraphicsAtlasEntry[] =
  BASE_STATE_GRAPHICS_STATES.map((state, index) => {
    const column = index % BASE_STATE_GRAPHICS_ATLAS_COLUMNS;
    const row = Math.floor(index / BASE_STATE_GRAPHICS_ATLAS_COLUMNS);
    const card = {
      x: CARD_ORIGIN_X + column * CARD_STRIDE_X,
      y: CARD_ORIGIN_Y + row * CARD_STRIDE_Y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    };
    const body = { x: card.x + 6, y: card.y + 8, width: 72, height: 64 };
    return {
      ...state,
      material: Material.BASE,
      code: 'BASE',
      encodedState: encodeBasePresentationState(state.concentration, state.spark),
      index,
      card,
      body,
      surfaceProbe: { x: body.x + 4, y: body.y + 4, width: 8, height: 8 },
      coreProbe: { x: body.x + 20, y: body.y + 44, width: 8, height: 8 },
      concentrationProbe: { x: body.x + 42, y: body.y + 34, width: 8, height: 8 },
      sparkProbe: { x: body.x + 56, y: body.y + 12, width: 8, height: 8 },
      authoredHole: { x: body.x + 30, y: body.y + 28, width: 6, height: 6 },
      openNotch: { x: body.x + 64, y: body.y + 46, width: 8, height: 8 },
      thinStrand: { x: card.x + 8, y: card.y + 84, width: 1, height: 30 },
      isolated: { x: card.x + 34, y: card.y + 104 },
      zeroConcentration: { x: card.x + 86, y: card.y + 8, width: 18, height: 12 },
      wrongOwner: { x: card.x + 110, y: card.y + 8, width: 18, height: 12 },
      waterControl: { x: card.x + 134, y: card.y + 8, width: 18, height: 12 },
      acidControl: { x: card.x + 158, y: card.y + 8, width: 18, height: 12 },
      causControl: { x: card.x + 182, y: card.y + 8, width: 14, height: 12 },
      saltWaterControl: { x: card.x + 86, y: card.y + 28, width: 18, height: 12 },
      oilControl: { x: card.x + 110, y: card.y + 28, width: 18, height: 12 },
      soapControl: { x: card.x + 134, y: card.y + 28, width: 18, height: 12 },
      gelControl: { x: card.x + 158, y: card.y + 28, width: 18, height: 12 },
      metalControl: { x: card.x + 182, y: card.y + 28, width: 14, height: 12 },
      bmtlControl: { x: card.x + 86, y: card.y + 48, width: 18, height: 12 },
      boylControl: { x: card.x + 110, y: card.y + 48, width: 18, height: 12 },
      nativeWallControl: {
        x: Math.ceil((card.x + 134) / 4) * 4,
        y: Math.ceil((card.y + 48) / 4) * 4,
        width: 12,
        height: 12,
      },
      guardedBlank: { x: card.x + 6, y: card.y + 128, width: 180, height: 42 },
    } satisfies BaseStateGraphicsAtlasEntry;
  });

export const BASE_STATE_GRAPHICS_AUDIT: BaseStateGraphicsAuditSnapshot = {
  version: 1,
  world: { width: WORLD_WIDTH, height: WORLD_HEIGHT },
  cards: BASE_STATE_GRAPHICS_ATLAS,
  authoredHoles: BASE_STATE_GRAPHICS_ATLAS.flatMap(({ authoredHole }) => rectPoints(authoredHole)),
  openNotches: BASE_STATE_GRAPHICS_ATLAS.flatMap(({ openNotch }) => rectPoints(openNotch)),
  thinStrands: BASE_STATE_GRAPHICS_ATLAS.flatMap(({ thinStrand }) => rectPoints(thinStrand)),
  isolated: BASE_STATE_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
  zeroConcentrations: BASE_STATE_GRAPHICS_ATLAS.map(({ zeroConcentration }) => zeroConcentration),
  wrongOwners: BASE_STATE_GRAPHICS_ATLAS.map(({ wrongOwner }) => wrongOwner),
  waterControls: BASE_STATE_GRAPHICS_ATLAS.map(({ waterControl }) => waterControl),
  acidControls: BASE_STATE_GRAPHICS_ATLAS.map(({ acidControl }) => acidControl),
  causControls: BASE_STATE_GRAPHICS_ATLAS.map(({ causControl }) => causControl),
  saltWaterControls: BASE_STATE_GRAPHICS_ATLAS.map(({ saltWaterControl }) => saltWaterControl),
  oilControls: BASE_STATE_GRAPHICS_ATLAS.map(({ oilControl }) => oilControl),
  soapControls: BASE_STATE_GRAPHICS_ATLAS.map(({ soapControl }) => soapControl),
  gelControls: BASE_STATE_GRAPHICS_ATLAS.map(({ gelControl }) => gelControl),
  metalControls: BASE_STATE_GRAPHICS_ATLAS.map(({ metalControl }) => metalControl),
  bmtlControls: BASE_STATE_GRAPHICS_ATLAS.map(({ bmtlControl }) => bmtlControl),
  boylControls: BASE_STATE_GRAPHICS_ATLAS.map(({ boylControl }) => boylControl),
  nativeWallControls: BASE_STATE_GRAPHICS_ATLAS.map(({ nativeWallControl }) => nativeWallControl),
  guardedBlanks: BASE_STATE_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
};

interface BaseStateFixtureBackend extends SimulationBackend {
  walls(): Uint8Array;
  paintWall(x: number, y: number, wall: number, radius: number): void;
  presentationState(): Uint16Array;
  setFixturePresentationStateRect(
    x: number, y: number, width: number, height: number, state: number,
  ): void;
  setFixturePresentationState(x: number, y: number, state: number): void;
}

/** Builds a paused exact-owner BASE concentration and electrical-state atlas. */
export function prepareBaseStateGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (!supportsBaseStateFixture(simulation)) {
    throw new Error('BASE state graphics audit fixture requires a render-lab state plane');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`BASE state graphics audit fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  const zeroConcentrationState = encodeBasePresentationState(0);
  for (const entry of BASE_STATE_GRAPHICS_ATLAS) {
    fillStateControl(simulation, cells, entry.body, Material.BASE, entry.encodedState);
    fillStateControl(simulation, cells, entry.authoredHole, Material.Empty, 0);
    fillStateControl(simulation, cells, entry.openNotch, Material.Empty, 0);
    fillStateControl(simulation, cells, entry.thinStrand, Material.BASE, entry.encodedState);
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = Material.BASE;
    simulation.setFixturePresentationState(entry.isolated.x, entry.isolated.y, entry.encodedState);
    fillStateControl(simulation, cells, entry.zeroConcentration, Material.BASE, zeroConcentrationState);
    fillStateControl(simulation, cells, entry.wrongOwner, Material.Sand, entry.encodedState);
    fillStateControl(simulation, cells, entry.waterControl, Material.Water, entry.encodedState);
    fillStateControl(simulation, cells, entry.acidControl, Material.Acid, entry.encodedState);
    fillStateControl(simulation, cells, entry.causControl, Material.CAUS, entry.encodedState);
    fillStateControl(simulation, cells, entry.saltWaterControl, Material.SaltWater, entry.encodedState);
    fillStateControl(simulation, cells, entry.oilControl, Material.Oil, entry.encodedState);
    fillStateControl(simulation, cells, entry.soapControl, Material.Soap, entry.encodedState);
    fillStateControl(simulation, cells, entry.gelControl, Material.GEL, entry.encodedState);
    fillStateControl(simulation, cells, entry.metalControl, Material.Metal, entry.encodedState);
    fillStateControl(simulation, cells, entry.bmtlControl, Material.BMTL, entry.encodedState);
    fillStateControl(simulation, cells, entry.boylControl, Material.BOYL, entry.encodedState);
    fillStateControl(simulation, cells, entry.nativeWallControl, Material.BASE, entry.encodedState);
    for (let y = entry.nativeWallControl.y;
      y < entry.nativeWallControl.y + entry.nativeWallControl.height; y += 4) {
      for (let x = entry.nativeWallControl.x;
        x < entry.nativeWallControl.x + entry.nativeWallControl.width; x += 4) {
        simulation.paintWall(x, y, 8, 0);
      }
    }
    fillStateControl(simulation, cells, entry.guardedBlank, Material.Empty, 0);
  }
}

function supportsBaseStateFixture(
  simulation: SimulationBackend,
): simulation is BaseStateFixtureBackend {
  const candidate = simulation as Partial<BaseStateFixtureBackend>;
  return typeof candidate.presentationState === 'function'
    && typeof candidate.walls === 'function'
    && typeof candidate.paintWall === 'function'
    && typeof candidate.setFixturePresentationStateRect === 'function'
    && typeof candidate.setFixturePresentationState === 'function';
}

function fillStateControl(
  simulation: BaseStateFixtureBackend,
  cells: Uint8Array,
  rect: BaseStateGraphicsRect,
  material: Material,
  state: number,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * simulation.width + rect.x, y * simulation.width + rect.x + rect.width);
  }
  simulation.setFixturePresentationStateRect(rect.x, rect.y, rect.width, rect.height, state);
}

function rectPoints(rect: BaseStateGraphicsRect): BaseStateGraphicsPoint[] {
  const points: BaseStateGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}
