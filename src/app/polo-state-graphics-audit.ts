import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';
import { POLO_PRESENTATION_STATE } from '../simulation/types';

export const POLO_STATE_GRAPHICS_ATLAS_COLUMNS = 5;
export const POLO_STATE_GRAPHICS_ATLAS_ROWS = 1;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 4;
const CARD_ORIGIN_Y = 8;
const CARD_STRIDE_X = 121;
const CARD_WIDTH = 117;
const CARD_HEIGHT = 368;

export type PoloStateGraphicsKey =
  | 'ready' | 'cooling' | 'midDose' | 'nearTransmutation' | 'spent';
export interface PoloStateGraphicsPoint { readonly x: number; readonly y: number }
export interface PoloStateGraphicsRect extends PoloStateGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

export interface PoloNativePresentationState {
  readonly key: PoloStateGraphicsKey;
  readonly emissions: number;
  readonly cooldown: number;
  readonly protonDose: number;
}

export const POLO_STATE_GRAPHICS_STATES = [
  { key: 'ready', emissions: 0, cooldown: 0, protonDose: 0 },
  { key: 'cooling', emissions: 1, cooldown: 15, protonDose: 0 },
  { key: 'midDose', emissions: 2, cooldown: 7, protonDose: 5 },
  { key: 'nearTransmutation', emissions: 4, cooldown: 0, protonDose: 9 },
  { key: 'spent', emissions: 5, cooldown: 0, protonDose: 0 },
] as const satisfies readonly PoloNativePresentationState[];

export function encodePoloPresentationState(
  emissions: number, cooldown: number, protonDose: number,
): number {
  return POLO_PRESENTATION_STATE.presentMask
    | (Math.max(0, Math.min(5, Math.round(emissions)))
      & POLO_PRESENTATION_STATE.emissionMask)
    | ((Math.max(0, Math.min(15, Math.round(cooldown)))
      << POLO_PRESENTATION_STATE.cooldownShift) & POLO_PRESENTATION_STATE.cooldownMask)
    | ((Math.max(0, Math.min(10, Math.round(protonDose)))
      << POLO_PRESENTATION_STATE.protonDoseShift) & POLO_PRESENTATION_STATE.protonDoseMask);
}

export interface PoloStateGraphicsAtlasEntry extends PoloNativePresentationState {
  readonly material: Material.POLO;
  readonly code: 'POLO';
  readonly encodedState: number;
  readonly index: number;
  readonly card: PoloStateGraphicsRect;
  readonly body: PoloStateGraphicsRect;
  readonly surfaceProbe: PoloStateGraphicsRect;
  readonly coreProbe: PoloStateGraphicsRect;
  readonly decayProbe: PoloStateGraphicsRect;
  readonly doseProbe: PoloStateGraphicsRect;
  readonly backgroundProbe: PoloStateGraphicsRect;
  readonly authoredHole: PoloStateGraphicsRect;
  readonly openNotch: PoloStateGraphicsRect;
  readonly thinStructure: PoloStateGraphicsRect;
  readonly isolated: PoloStateGraphicsPoint;
  readonly zeroState: PoloStateGraphicsRect;
  readonly wrongOwner: PoloStateGraphicsRect;
  readonly plutoniumControl: PoloStateGraphicsRect;
  readonly protonControl: PoloStateGraphicsRect;
  readonly neutronControl: PoloStateGraphicsRect;
  readonly guardedBlank: PoloStateGraphicsRect;
}

export interface PoloStateGraphicsAuditSnapshot {
  readonly cards: readonly PoloStateGraphicsAtlasEntry[];
  readonly authoredHoles: readonly PoloStateGraphicsPoint[];
  readonly openNotches: readonly PoloStateGraphicsPoint[];
  readonly thinStructures: readonly PoloStateGraphicsPoint[];
  readonly isolated: readonly PoloStateGraphicsPoint[];
  readonly zeroStates: readonly PoloStateGraphicsRect[];
  readonly wrongOwners: readonly PoloStateGraphicsRect[];
  readonly plutoniumControls: readonly PoloStateGraphicsRect[];
  readonly protonControls: readonly PoloStateGraphicsRect[];
  readonly neutronControls: readonly PoloStateGraphicsRect[];
  readonly guardedBlanks: readonly PoloStateGraphicsRect[];
}

export const POLO_STATE_GRAPHICS_ATLAS: readonly PoloStateGraphicsAtlasEntry[] =
  POLO_STATE_GRAPHICS_STATES.map((state, index) => {
    const card = {
      x: CARD_ORIGIN_X + index * CARD_STRIDE_X,
      y: CARD_ORIGIN_Y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    };
    const body = { x: card.x + 6, y: card.y + 8, width: 66, height: 64 };
    return {
      ...state,
      material: Material.POLO,
      code: 'POLO',
      encodedState: encodePoloPresentationState(
        state.emissions, state.cooldown, state.protonDose,
      ),
      index,
      card,
      body,
      surfaceProbe: { x: body.x + 4, y: body.y + 4, width: 8, height: 8 },
      coreProbe: { x: body.x + 20, y: body.y + 44, width: 8, height: 8 },
      decayProbe: { x: body.x + 24, y: body.y + 20, width: 8, height: 8 },
      doseProbe: { x: body.x + 40, y: body.y + 36, width: 8, height: 8 },
      backgroundProbe: { x: body.x + 8, y: body.y + 36, width: 8, height: 8 },
      authoredHole: { x: body.x + 28, y: body.y + 28, width: 6, height: 6 },
      openNotch: { x: body.x + 58, y: body.y + 44, width: 8, height: 8 },
      thinStructure: { x: card.x + 8, y: card.y + 84, width: 1, height: 30 },
      isolated: { x: card.x + 34, y: card.y + 104 },
      zeroState: { x: card.x + 6, y: card.y + 126, width: 18, height: 16 },
      wrongOwner: { x: card.x + 32, y: card.y + 126, width: 18, height: 16 },
      plutoniumControl: { x: card.x + 58, y: card.y + 126, width: 18, height: 16 },
      protonControl: { x: card.x + 6, y: card.y + 152, width: 18, height: 16 },
      neutronControl: { x: card.x + 32, y: card.y + 152, width: 18, height: 16 },
      guardedBlank: { x: card.x + 6, y: card.y + 190, width: 92, height: 60 },
    } satisfies PoloStateGraphicsAtlasEntry;
  });

export const POLO_STATE_GRAPHICS_AUDIT: PoloStateGraphicsAuditSnapshot = {
  cards: POLO_STATE_GRAPHICS_ATLAS,
  authoredHoles: POLO_STATE_GRAPHICS_ATLAS.flatMap(({ authoredHole }) => rectPoints(authoredHole)),
  openNotches: POLO_STATE_GRAPHICS_ATLAS.flatMap(({ openNotch }) => rectPoints(openNotch)),
  thinStructures: POLO_STATE_GRAPHICS_ATLAS.flatMap(({ thinStructure }) => rectPoints(thinStructure)),
  isolated: POLO_STATE_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
  zeroStates: POLO_STATE_GRAPHICS_ATLAS.map(({ zeroState }) => zeroState),
  wrongOwners: POLO_STATE_GRAPHICS_ATLAS.map(({ wrongOwner }) => wrongOwner),
  plutoniumControls: POLO_STATE_GRAPHICS_ATLAS.map(({ plutoniumControl }) => plutoniumControl),
  protonControls: POLO_STATE_GRAPHICS_ATLAS.map(({ protonControl }) => protonControl),
  neutronControls: POLO_STATE_GRAPHICS_ATLAS.map(({ neutronControl }) => neutronControl),
  guardedBlanks: POLO_STATE_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
};

interface PoloStateFixtureBackend extends SimulationBackend {
  presentationState(): Uint16Array;
  setFixturePresentationStateRect(
    x: number, y: number, width: number, height: number, state: number,
  ): void;
  setFixturePresentationState(x: number, y: number, state: number): void;
}

/** Builds one paused POLO state atlas without crossing native particle or reaction ABIs. */
export function preparePoloStateGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (!supportsPoloStateFixture(simulation)) {
    throw new Error('POLO state graphics audit fixture requires a render-lab state plane');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`POLO state graphics audit fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of POLO_STATE_GRAPHICS_ATLAS) {
    fillStateControl(simulation, cells, entry.body, Material.POLO, entry.encodedState);
    fillStateControl(simulation, cells, entry.authoredHole, Material.Empty, 0);
    fillStateControl(simulation, cells, entry.openNotch, Material.Empty, 0);
    fillStateControl(simulation, cells, entry.thinStructure, Material.POLO, entry.encodedState);
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = Material.POLO;
    simulation.setFixturePresentationState(
      entry.isolated.x, entry.isolated.y, entry.encodedState,
    );
    fillStateControl(simulation, cells, entry.zeroState, Material.POLO, 0);
    fillStateControl(simulation, cells, entry.wrongOwner, Material.Sand, entry.encodedState);
    fillStateControl(simulation, cells, entry.plutoniumControl, Material.PLUT, entry.encodedState);
    fillStateControl(simulation, cells, entry.protonControl, Material.PROT, entry.encodedState);
    fillStateControl(simulation, cells, entry.neutronControl, Material.NEUT, entry.encodedState);
    fillStateControl(simulation, cells, entry.guardedBlank, Material.Empty, 0);
  }
}

function supportsPoloStateFixture(
  simulation: SimulationBackend,
): simulation is PoloStateFixtureBackend {
  const candidate = simulation as Partial<PoloStateFixtureBackend>;
  return typeof candidate.presentationState === 'function'
    && typeof candidate.setFixturePresentationStateRect === 'function'
    && typeof candidate.setFixturePresentationState === 'function';
}

function fillStateControl(
  simulation: PoloStateFixtureBackend,
  cells: Uint8Array,
  rect: PoloStateGraphicsRect,
  material: Material,
  state: number,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * simulation.width + rect.x, y * simulation.width + rect.x + rect.width);
  }
  simulation.setFixturePresentationStateRect(rect.x, rect.y, rect.width, rect.height, state);
}

function rectPoints(rect: PoloStateGraphicsRect): PoloStateGraphicsPoint[] {
  const points: PoloStateGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}
