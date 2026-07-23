import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

export const SOURCE_TARGET_GRAPHICS_ATLAS_COLUMNS = 7;
export const SOURCE_TARGET_GRAPHICS_ATLAS_ROWS = 5;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 8;
const CARD_ORIGIN_Y = 8;
// Preserve the shared eight-cell material-motif phase between every card.
const CARD_STRIDE_X = 84;
const CARD_STRIDE_Y = 72;
const CARD_WIDTH = 80;
const CARD_HEIGHT = 68;
const CONDUCTIVE_WALL = 1;

export const SOURCE_TARGET_GRAPHICS_OWNERS = [
  { material: Material.CLNE, code: 'CLNE' },
  { material: Material.BCLN, code: 'BCLN' },
  { material: Material.PCLN, code: 'PCLN' },
  { material: Material.PBCN, code: 'PBCN' },
  { material: Material.CONV, code: 'CONV' },
] as const;

export const SOURCE_TARGET_GRAPHICS_TARGETS = [
  { material: Material.Sand, code: 'SAND', family: 'powder' },
  { material: Material.Water, code: 'WATR', family: 'liquid' },
  { material: Material.Oxygen, code: 'OXYG', family: 'gas' },
  { material: Material.PHOT, code: 'PHOT', family: 'energy' },
  { material: Material.Metal, code: 'METL', family: 'rigid' },
  { material: Material.Plant, code: 'PLNT', family: 'organic' },
  { material: Material.BCOL, code: 'BCOL', family: 'high-id-powder' },
] as const;

export type SourceTargetGraphicsOwner =
  (typeof SOURCE_TARGET_GRAPHICS_OWNERS)[number]['material'];
export type SourceTargetGraphicsTarget =
  (typeof SOURCE_TARGET_GRAPHICS_TARGETS)[number]['material'];

export interface SourceTargetGraphicsPoint { readonly x: number; readonly y: number }
export interface SourceTargetGraphicsRect extends SourceTargetGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

export interface SourceTargetGraphicsAtlasEntry {
  readonly owner: SourceTargetGraphicsOwner;
  readonly ownerCode: string;
  readonly target: SourceTargetGraphicsTarget;
  readonly targetCode: string;
  readonly targetFamily: string;
  readonly encodedState: number;
  readonly row: number;
  readonly column: number;
  readonly index: number;
  readonly card: SourceTargetGraphicsRect;
  readonly body: SourceTargetGraphicsRect;
  readonly ownerShellProbe: SourceTargetGraphicsRect;
  readonly targetAccentProbe: SourceTargetGraphicsRect;
  readonly authoredHole: SourceTargetGraphicsRect;
  readonly openNotch: SourceTargetGraphicsRect;
  readonly thinStructure: SourceTargetGraphicsRect;
  readonly isolated: SourceTargetGraphicsPoint;
  /** Exact source owner with no configured ctype target. */
  readonly zeroState: SourceTargetGraphicsRect;
  /** Unrelated matter deliberately carrying a valid target word. */
  readonly wrongOwner: SourceTargetGraphicsRect;
  /** The target material itself deliberately carrying its own target word. */
  readonly targetControl: SourceTargetGraphicsRect;
  /** Source matter and a native wall independently coexist in these cells. */
  readonly wallCoexistence: SourceTargetGraphicsRect;
  readonly guardedBlank: SourceTargetGraphicsRect;
}

export interface SourceTargetGraphicsAuditSnapshot {
  readonly cards: readonly SourceTargetGraphicsAtlasEntry[];
  readonly authoredHoles: readonly SourceTargetGraphicsPoint[];
  readonly openNotches: readonly SourceTargetGraphicsPoint[];
  readonly thinStructures: readonly SourceTargetGraphicsPoint[];
  readonly isolated: readonly SourceTargetGraphicsPoint[];
  readonly zeroStates: readonly SourceTargetGraphicsRect[];
  readonly wrongOwners: readonly SourceTargetGraphicsRect[];
  readonly targetControls: readonly SourceTargetGraphicsRect[];
  readonly wallCoexistence: readonly SourceTargetGraphicsRect[];
  readonly guardedBlanks: readonly SourceTargetGraphicsRect[];
  readonly conductiveWall: number;
  /** Exact owner/state probe reserved for the combined true-8× recovery fixture. */
  readonly recoveryProbe: SourceTargetGraphicsPoint & {
    readonly owner: SourceTargetGraphicsOwner;
    readonly target: SourceTargetGraphicsTarget;
  };
}

export const SOURCE_TARGET_RECOVERY_PROBE = {
  x: 548, y: 220, owner: Material.CLNE, target: Material.BCOL,
} as const satisfies SourceTargetGraphicsAuditSnapshot['recoveryProbe'];

/** Configured sources transport exact public target IDs, never quantized RGB. */
export function encodeSourceTargetPresentationState(target: number): number {
  if (!Number.isInteger(target) || !((target >= 1 && target <= 170) || target === 217)) {
    throw new RangeError(`Invalid configured-source target ID: ${target}`);
  }
  return target;
}

export const SOURCE_TARGET_GRAPHICS_ATLAS: readonly SourceTargetGraphicsAtlasEntry[] =
  SOURCE_TARGET_GRAPHICS_OWNERS.flatMap((owner, row) => (
    SOURCE_TARGET_GRAPHICS_TARGETS.map((target, column) => {
      const card = {
        x: CARD_ORIGIN_X + column * CARD_STRIDE_X,
        y: CARD_ORIGIN_Y + row * CARD_STRIDE_Y,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
      };
      const body = { x: card.x + 4, y: card.y + 4, width: 32, height: 28 };
      return {
        owner: owner.material,
        ownerCode: owner.code,
        target: target.material,
        targetCode: target.code,
        targetFamily: target.family,
        encodedState: encodeSourceTargetPresentationState(target.material),
        row,
        column,
        index: row * SOURCE_TARGET_GRAPHICS_ATLAS_COLUMNS + column,
        card,
        body,
        ownerShellProbe: { x: card.x + 6, y: card.y + 6, width: 6, height: 6 },
        targetAccentProbe: { x: card.x + 22, y: card.y + 6, width: 6, height: 6 },
        authoredHole: { x: card.x + 16, y: card.y + 14, width: 4, height: 4 },
        openNotch: { x: card.x + 28, y: card.y + 20, width: 8, height: 6 },
        thinStructure: { x: card.x + 5, y: card.y + 40, width: 1, height: 14 },
        isolated: { x: card.x + 20, y: card.y + 54 },
        zeroState: { x: card.x + 44, y: card.y + 4, width: 10, height: 10 },
        wrongOwner: { x: card.x + 64, y: card.y + 4, width: 12, height: 10 },
        targetControl: { x: card.x + 44, y: card.y + 20, width: 12, height: 10 },
        wallCoexistence: { x: card.x + 60, y: card.y + 20, width: 12, height: 12 },
        guardedBlank: { x: card.x + 40, y: card.y + 38, width: 36, height: 26 },
      } satisfies SourceTargetGraphicsAtlasEntry;
    })
  ));

export const SOURCE_TARGET_GRAPHICS_AUDIT: SourceTargetGraphicsAuditSnapshot = {
  cards: SOURCE_TARGET_GRAPHICS_ATLAS,
  authoredHoles: SOURCE_TARGET_GRAPHICS_ATLAS.flatMap(({ authoredHole }) => rectPoints(authoredHole)),
  openNotches: SOURCE_TARGET_GRAPHICS_ATLAS.flatMap(({ openNotch }) => rectPoints(openNotch)),
  thinStructures: SOURCE_TARGET_GRAPHICS_ATLAS.flatMap(({ thinStructure }) => rectPoints(thinStructure)),
  isolated: SOURCE_TARGET_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
  zeroStates: SOURCE_TARGET_GRAPHICS_ATLAS.map(({ zeroState }) => zeroState),
  wrongOwners: SOURCE_TARGET_GRAPHICS_ATLAS.map(({ wrongOwner }) => wrongOwner),
  targetControls: SOURCE_TARGET_GRAPHICS_ATLAS.map(({ targetControl }) => targetControl),
  wallCoexistence: SOURCE_TARGET_GRAPHICS_ATLAS.map(({ wallCoexistence }) => wallCoexistence),
  guardedBlanks: SOURCE_TARGET_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
  conductiveWall: CONDUCTIVE_WALL,
  recoveryProbe: SOURCE_TARGET_RECOVERY_PROBE,
};

interface SourceTargetStateFixtureBackend extends SimulationBackend {
  presentationState(): Uint16Array;
  setFixturePresentationState(x: number, y: number, state: number): void;
}

interface SourceTargetFixtureBackend extends SourceTargetStateFixtureBackend {
  walls(): Uint8Array;
  paintWall(x: number, y: number, wall: number, radius: number): void;
  setFixturePresentationStateRect(
    x: number, y: number, width: number, height: number, state: number,
  ): void;
}

/** Adds one exact configured-source state probe without clearing any existing fixture. */
export function placeSourceTargetRecoveryProbe(
  simulation: SimulationBackend,
  x: number,
  y: number,
  owner: SourceTargetGraphicsOwner = Material.CLNE,
  target: Material = Material.BCOL,
): void {
  if (!supportsSourceTargetStateFixture(simulation)) {
    throw new Error('Configured-source recovery probe requires a render-lab state plane');
  }
  if (!Number.isInteger(x) || !Number.isInteger(y)
    || x < 0 || y < 0 || x >= simulation.width || y >= simulation.height) {
    throw new RangeError(`Configured-source recovery probe is outside the world: ${x},${y}`);
  }
  if (!SOURCE_TARGET_GRAPHICS_OWNERS.some(({ material }) => material === owner)) {
    throw new RangeError(`Invalid configured-source owner ID: ${owner}`);
  }
  const encodedState = encodeSourceTargetPresentationState(target);
  simulation.cells()[y * simulation.width + x] = owner;
  simulation.setFixturePresentationState(x, y, encodedState);
}

/** Builds a paused exact-owner/target atlas without crossing the native ctype ABI. */
export function prepareSourceTargetGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (!supportsSourceTargetFixture(simulation)) {
    throw new Error('Configured-source graphics audit fixture requires render-lab state and wall planes');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Configured-source graphics audit fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of SOURCE_TARGET_GRAPHICS_ATLAS) {
    fillStateRect(simulation, cells, entry.body, entry.owner, entry.encodedState);
    fillStateRect(simulation, cells, entry.authoredHole, Material.Empty, 0);
    fillStateRect(simulation, cells, entry.openNotch, Material.Empty, 0);
    fillStateRect(simulation, cells, entry.thinStructure, entry.owner, entry.encodedState);
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = entry.owner;
    simulation.setFixturePresentationState(entry.isolated.x, entry.isolated.y, entry.encodedState);
    fillStateRect(simulation, cells, entry.zeroState, entry.owner, 0);
    fillStateRect(
      simulation, cells, entry.wrongOwner,
      entry.target === Material.Sand ? Material.Metal : Material.Sand,
      entry.encodedState,
    );
    fillStateRect(simulation, cells, entry.targetControl, entry.target, entry.encodedState);
    fillStateRect(
      simulation, cells, entry.wallCoexistence, entry.owner, entry.encodedState,
    );
    for (let y = entry.wallCoexistence.y;
      y < entry.wallCoexistence.y + entry.wallCoexistence.height; y += 4) {
      for (let x = entry.wallCoexistence.x;
        x < entry.wallCoexistence.x + entry.wallCoexistence.width; x += 4) {
        simulation.paintWall(x, y, CONDUCTIVE_WALL, 0);
      }
    }
    fillStateRect(simulation, cells, entry.guardedBlank, Material.Empty, 0);
  }
}

function supportsSourceTargetFixture(
  simulation: SimulationBackend,
): simulation is SourceTargetFixtureBackend {
  const candidate = simulation as Partial<SourceTargetFixtureBackend>;
  return typeof candidate.presentationState === 'function'
    && typeof candidate.walls === 'function'
    && typeof candidate.paintWall === 'function'
    && typeof candidate.setFixturePresentationStateRect === 'function'
    && typeof candidate.setFixturePresentationState === 'function';
}

function supportsSourceTargetStateFixture(
  simulation: SimulationBackend,
): simulation is SourceTargetStateFixtureBackend {
  const candidate = simulation as Partial<SourceTargetStateFixtureBackend>;
  return typeof candidate.presentationState === 'function'
    && typeof candidate.setFixturePresentationState === 'function';
}

function fillStateRect(
  simulation: SourceTargetFixtureBackend,
  cells: Uint8Array,
  rect: SourceTargetGraphicsRect,
  material: Material,
  state: number,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * simulation.width + rect.x, y * simulation.width + rect.x + rect.width);
  }
  simulation.setFixturePresentationStateRect(rect.x, rect.y, rect.width, rect.height, state);
}

function rectPoints(rect: SourceTargetGraphicsRect): SourceTargetGraphicsPoint[] {
  const points: SourceTargetGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}
