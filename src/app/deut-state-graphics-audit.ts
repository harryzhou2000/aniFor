import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';
import { DEUT_PRESENTATION_STATE } from '../simulation/types';

export const DEUT_STATE_GRAPHICS_ATLAS_COLUMNS = 4;
export const DEUT_STATE_GRAPHICS_ATLAS_ROWS = 2;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 4;
const CARD_ORIGIN_Y = 4;
// Both strides preserve the 16-cell pressure motif phase across state cards.
const CARD_STRIDE_X = 144;
const CARD_STRIDE_Y = 192;
const CARD_WIDTH = 140;
const CARD_HEIGHT = 184;

export type DeutStateGraphicsKey =
  | 'zero' | 'default' | 'low' | 'medium' | 'preGlow' | 'glow' | 'compressed';

export const DEUT_STATE_GRAPHICS_STATES = [
  { key: 'zero', concentration: 0 },
  { key: 'default', concentration: DEUT_PRESENTATION_STATE.defaultConcentration },
  { key: 'low', concentration: 80 },
  { key: 'medium', concentration: 160 },
  { key: 'preGlow', concentration: DEUT_PRESENTATION_STATE.glowThreshold - 1 },
  { key: 'glow', concentration: DEUT_PRESENTATION_STATE.glowThreshold },
  { key: 'compressed', concentration: DEUT_PRESENTATION_STATE.canonicalElectronMaximum },
] as const satisfies readonly {
  readonly key: DeutStateGraphicsKey;
  readonly concentration: number;
}[];

export interface DeutStateGraphicsPoint { readonly x: number; readonly y: number }
export interface DeutStateGraphicsRect extends DeutStateGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

export interface DeutStateGraphicsContact {
  readonly owner: DeutStateGraphicsRect;
  readonly neighbour: DeutStateGraphicsRect;
  readonly neighbourMaterial: Material.Water | Material.Metal;
}

export interface DeutStateGraphicsAtlasEntry {
  readonly material: Material.DEUT;
  readonly code: 'DEUT';
  readonly stateKey: DeutStateGraphicsKey;
  readonly concentration: number;
  readonly encodedState: number;
  readonly index: number;
  readonly card: DeutStateGraphicsRect;
  readonly body: DeutStateGraphicsRect;
  readonly surfaceProbe: DeutStateGraphicsRect;
  readonly coreProbe: DeutStateGraphicsRect;
  readonly authoredHole: DeutStateGraphicsRect;
  readonly openNotch: DeutStateGraphicsRect;
  readonly thinStructure: DeutStateGraphicsRect;
  readonly isolated: DeutStateGraphicsPoint;
  readonly zeroState: DeutStateGraphicsRect;
  readonly wrongOwner: DeutStateGraphicsRect;
  readonly waterControl: DeutStateGraphicsRect;
  readonly metalControl: DeutStateGraphicsRect;
  readonly exotControl: DeutStateGraphicsRect;
  readonly isozControl: DeutStateGraphicsRect;
  readonly wallCoexistence: DeutStateGraphicsRect;
  readonly liquidContact: DeutStateGraphicsContact;
  readonly solidContact: DeutStateGraphicsContact;
  readonly guardedBlank: DeutStateGraphicsRect;
}

export interface DeutStateGraphicsAuditSnapshot {
  readonly cards: readonly DeutStateGraphicsAtlasEntry[];
  readonly authoredHoles: readonly DeutStateGraphicsPoint[];
  readonly openNotches: readonly DeutStateGraphicsPoint[];
  readonly thinStructures: readonly DeutStateGraphicsPoint[];
  readonly isolated: readonly DeutStateGraphicsPoint[];
  readonly zeroStates: readonly DeutStateGraphicsRect[];
  readonly guardedBlanks: readonly DeutStateGraphicsRect[];
  /** Co-located native-state control retained through the shared 8x recovery path. */
  readonly vibrRecovery: {
    readonly rect: DeutStateGraphicsRect;
    readonly encodedState: number;
  };
  /** Full-word transport probes; rendering intentionally saturates at 6000. */
  readonly highRange: readonly {
    readonly stateKey: 'reactionYield' | 'maximum';
    readonly rect: DeutStateGraphicsRect;
    readonly encodedState: number;
  }[];
}

export const DEUT_STATE_VIBR_RECOVERY_STATE = 100 | (192 << 7);
const DEUT_STATE_VIBR_RECOVERY_RECT = { x: 452, y: 220, width: 20, height: 20 };
const DEUT_STATE_HIGH_RANGE = [
  {
    // The two blocks have identical 48-cell carrier phase and enough vertical
    // depth for the concentration-aware connected-body experiment. Their
    // lower calibration probes therefore compare high-word saturation on
    // matched geometry instead of sampling shallow ineligible liquid.
    stateKey: 'reactionYield', rect: { x: 491, y: 260, width: 24, height: 40 },
    encodedState: DEUT_PRESENTATION_STATE.reactionYieldSaturation,
  },
  {
    stateKey: 'maximum', rect: { x: 539, y: 260, width: 24, height: 40 },
    encodedState: DEUT_PRESENTATION_STATE.maximumConcentration,
  },
] as const;

export const DEUT_STATE_GRAPHICS_ATLAS: readonly DeutStateGraphicsAtlasEntry[] =
  DEUT_STATE_GRAPHICS_STATES.map((state, index) => {
    const column = index % DEUT_STATE_GRAPHICS_ATLAS_COLUMNS;
    const row = Math.floor(index / DEUT_STATE_GRAPHICS_ATLAS_COLUMNS);
    const card = {
      x: CARD_ORIGIN_X + column * CARD_STRIDE_X,
      y: CARD_ORIGIN_Y + row * CARD_STRIDE_Y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    };
    const body = { x: card.x + 5, y: card.y + 6, width: 54, height: 58 };
    const contactY = card.y + 116;
    return {
      material: Material.DEUT,
      code: 'DEUT',
      stateKey: state.key,
      concentration: state.concentration,
      encodedState: state.concentration,
      index,
      card,
      body,
      surfaceProbe: { x: body.x + 5, y: body.y + 5, width: 8, height: 8 },
      coreProbe: { x: body.x + 5, y: body.y + 42, width: 8, height: 8 },
      authoredHole: { x: body.x + 20, y: body.y + 24, width: 6, height: 6 },
      openNotch: { x: body.x + 42, y: body.y + 35, width: 12, height: 8 },
      thinStructure: { x: card.x + 10, y: card.y + 72, width: 1, height: 24 },
      isolated: { x: card.x + 26, y: card.y + 86 },
      zeroState: { x: card.x + 120, y: card.y + 6, width: 12, height: 12 },
      wrongOwner: { x: card.x + 68, y: card.y + 6, width: 20, height: 18 },
      waterControl: { x: card.x + 68, y: card.y + 34, width: 20, height: 14 },
      metalControl: { x: card.x + 68, y: card.y + 56, width: 20, height: 14 },
      exotControl: { x: card.x + 98, y: card.y + 34, width: 20, height: 14 },
      isozControl: { x: card.x + 98, y: card.y + 56, width: 20, height: 14 },
      wallCoexistence: { x: card.x + 120, y: card.y + 32, width: 12, height: 12 },
      liquidContact: {
        owner: { x: card.x + 8, y: contactY, width: 20, height: 16 },
        neighbour: { x: card.x + 28, y: contactY, width: 20, height: 16 },
        neighbourMaterial: Material.Water,
      },
      solidContact: {
        owner: { x: card.x + 68, y: contactY, width: 20, height: 16 },
        neighbour: { x: card.x + 88, y: contactY, width: 20, height: 16 },
        neighbourMaterial: Material.Metal,
      },
      guardedBlank: { x: card.x + 62, y: card.y + 82, width: 72, height: 26 },
    } satisfies DeutStateGraphicsAtlasEntry;
  });

export const DEUT_STATE_GRAPHICS_AUDIT: DeutStateGraphicsAuditSnapshot = {
  cards: DEUT_STATE_GRAPHICS_ATLAS,
  authoredHoles: DEUT_STATE_GRAPHICS_ATLAS.flatMap(({ authoredHole }) => rectPoints(authoredHole)),
  openNotches: DEUT_STATE_GRAPHICS_ATLAS.flatMap(({ openNotch }) => rectPoints(openNotch)),
  thinStructures: DEUT_STATE_GRAPHICS_ATLAS.flatMap(({ thinStructure }) => rectPoints(thinStructure)),
  isolated: DEUT_STATE_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
  zeroStates: DEUT_STATE_GRAPHICS_ATLAS.map(({ zeroState }) => zeroState),
  guardedBlanks: DEUT_STATE_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
  vibrRecovery: {
    rect: DEUT_STATE_VIBR_RECOVERY_RECT,
    encodedState: DEUT_STATE_VIBR_RECOVERY_STATE,
  },
  highRange: DEUT_STATE_HIGH_RANGE,
};

interface DeutStateFixtureBackend extends SimulationBackend {
  presentationState(): Uint16Array;
  setFixturePresentationStateRect(
    x: number, y: number, width: number, height: number, state: number,
  ): void;
  setFixturePresentationState(x: number, y: number, state: number): void;
}

/** Builds one paused exact-owner concentration atlas without crossing native paint ABIs. */
export function prepareDeutStateGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (!supportsDeutStateFixture(simulation)) {
    throw new Error('DEUT state graphics audit fixture requires a render-lab state plane');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`DEUT state graphics audit fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of DEUT_STATE_GRAPHICS_ATLAS) {
    fillStateControl(simulation, cells, entry.body, Material.DEUT, entry.encodedState);
    fillStateControl(simulation, cells, entry.authoredHole, Material.Empty, 0);
    fillStateControl(simulation, cells, entry.openNotch, Material.Empty, 0);
    fillStateControl(simulation, cells, entry.thinStructure, Material.DEUT, entry.encodedState);
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = Material.DEUT;
    simulation.setFixturePresentationState(
      entry.isolated.x, entry.isolated.y, entry.encodedState,
    );
    fillStateControl(simulation, cells, entry.zeroState, Material.DEUT, 0);
    fillStateControl(simulation, cells, entry.wrongOwner, Material.Sand, entry.encodedState);
    fillStateControl(simulation, cells, entry.waterControl, Material.Water, entry.encodedState);
    fillStateControl(simulation, cells, entry.metalControl, Material.Metal, entry.encodedState);
    fillStateControl(simulation, cells, entry.exotControl, Material.EXOT, entry.encodedState);
    fillStateControl(simulation, cells, entry.isozControl, Material.ISOZ, entry.encodedState);
    fillStateControl(
      simulation, cells, entry.wallCoexistence, Material.DEUT, entry.encodedState,
    );
    for (let y = entry.wallCoexistence.y; y < entry.wallCoexistence.y + entry.wallCoexistence.height; y += 4) {
      for (let x = entry.wallCoexistence.x; x < entry.wallCoexistence.x + entry.wallCoexistence.width; x += 4) {
        simulation.paintWall?.(x, y, 1, 0);
      }
    }
    fillStateControl(
      simulation, cells, entry.liquidContact.owner, Material.DEUT, entry.encodedState,
    );
    fillStateControl(
      simulation, cells, entry.liquidContact.neighbour,
      entry.liquidContact.neighbourMaterial, entry.encodedState,
    );
    fillStateControl(
      simulation, cells, entry.solidContact.owner, Material.DEUT, entry.encodedState,
    );
    fillStateControl(
      simulation, cells, entry.solidContact.neighbour,
      entry.solidContact.neighbourMaterial, entry.encodedState,
    );
    fillStateControl(simulation, cells, entry.guardedBlank, Material.Empty, 0);
  }
  fillStateControl(
    simulation, cells, DEUT_STATE_VIBR_RECOVERY_RECT,
    Material.VIBR, DEUT_STATE_VIBR_RECOVERY_STATE,
  );
  for (const probe of DEUT_STATE_HIGH_RANGE) {
    fillStateControl(simulation, cells, probe.rect, Material.DEUT, probe.encodedState);
  }
}

function supportsDeutStateFixture(
  simulation: SimulationBackend,
): simulation is DeutStateFixtureBackend {
  const candidate = simulation as Partial<DeutStateFixtureBackend>;
  return typeof candidate.presentationState === 'function'
    && typeof candidate.setFixturePresentationStateRect === 'function'
    && typeof candidate.setFixturePresentationState === 'function';
}

function fillStateControl(
  simulation: DeutStateFixtureBackend,
  cells: Uint8Array,
  rect: DeutStateGraphicsRect,
  material: Material,
  state: number,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * simulation.width + rect.x, y * simulation.width + rect.x + rect.width);
  }
  simulation.setFixturePresentationStateRect(rect.x, rect.y, rect.width, rect.height, state);
}

function rectPoints(rect: DeutStateGraphicsRect): DeutStateGraphicsPoint[] {
  const points: DeutStateGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}
