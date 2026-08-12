import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';
import type {
  SourceTargetAtlasCard,
  SourceTargetAtlasDescriptor,
  SourceTargetAtlasPoint,
  SourceTargetAtlasRect,
} from '../shared/source-target-material-lighting-atlas-catalog.js';

export type SourceTargetGraphicsOwner =
  Material.CLNE | Material.BCLN | Material.PCLN | Material.PBCN | Material.CONV | Material.CRAY;
export type SourceTargetGraphicsTarget =
  Material.Sand | Material.Water | Material.Oxygen | Material.PHOT
  | Material.Metal | Material.Plant | Material.BCOL;
export type SourceTargetGraphicsPoint = SourceTargetAtlasPoint;
export type SourceTargetGraphicsRect = SourceTargetAtlasRect;
export interface SourceTargetGraphicsAtlasEntry extends SourceTargetAtlasCard {
  readonly owner: SourceTargetGraphicsOwner;
  readonly target: SourceTargetGraphicsTarget;
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
  readonly recoveryProbe: SourceTargetGraphicsPoint & {
    readonly owner: SourceTargetGraphicsOwner;
    readonly target: SourceTargetGraphicsTarget;
  };
}

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

const SOURCE_OWNER_IDS = new Set<number>([
  Material.CLNE, Material.BCLN, Material.PCLN, Material.PBCN, Material.CONV, Material.CRAY,
]);

export function encodeSourceTargetPresentationState(target: number): number {
  if (!Number.isInteger(target) || !((target >= 1 && target <= 170) || target === 217)) {
    throw new RangeError(`Invalid configured-source target ID: ${target}`);
  }
  return target;
}

export function validateSourceTargetMaterialLightingAtlas(
  descriptor: SourceTargetAtlasDescriptor,
  world: { readonly width: number; readonly height: number },
): asserts descriptor is SourceTargetAtlasDescriptor & {
  readonly cards: readonly SourceTargetGraphicsAtlasEntry[];
} {
  if (world.width !== 612 || world.height !== 384
    || descriptor.columns !== 7 || descriptor.rows !== 6
    || descriptor.owners.length !== descriptor.rows
    || descriptor.targets.length !== descriptor.columns
    || descriptor.cards.length !== descriptor.rows * descriptor.columns
    || descriptor.conductiveWall !== 1) {
    throw new TypeError('Configured-source material-lighting atlas topology is malformed');
  }
  const ownerIds = new Set<number>();
  for (const owner of descriptor.owners) {
    if (!SOURCE_OWNER_IDS.has(owner.material) || ownerIds.has(owner.material)
      || !/^[A-Z0-9]{2,8}$/.test(owner.code)) {
      throw new TypeError('Configured-source material-lighting atlas owners are malformed');
    }
    ownerIds.add(owner.material);
  }
  const targetIds = new Set<number>();
  for (const target of descriptor.targets) {
    encodeSourceTargetPresentationState(target.material);
    if (targetIds.has(target.material) || !/^[A-Z0-9]{2,8}$/.test(target.code)
      || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(target.family)) {
      throw new TypeError('Configured-source material-lighting atlas targets are malformed');
    }
    targetIds.add(target.material);
  }
  for (const [index, card] of descriptor.cards.entries()) {
    if (card.index !== index || card.row !== Math.floor(index / descriptor.columns)
      || card.column !== index % descriptor.columns || !ownerIds.has(card.owner)
      || !targetIds.has(card.target) || card.encodedState !== card.target) {
      throw new TypeError('Configured-source material-lighting atlas cards are malformed');
    }
    for (const rect of [
      card.card, card.body, card.ownerShellProbe, card.targetAccentProbe, card.authoredHole,
      card.openNotch, card.thinStructure, card.zeroState, card.wrongOwner,
      card.targetControl, card.wallCoexistence, card.guardedBlank,
    ]) validateRect(rect, world);
    validatePoint(card.isolated, world);
  }
  validatePoint(descriptor.recoveryProbe, world);
  if (!ownerIds.has(descriptor.recoveryProbe.owner)) {
    throw new TypeError('Configured-source material-lighting recovery owner is malformed');
  }
  encodeSourceTargetPresentationState(descriptor.recoveryProbe.target);
}

export function createSourceTargetGraphicsAuditSnapshot(
  descriptor: SourceTargetAtlasDescriptor,
  world: { readonly width: number; readonly height: number },
): SourceTargetGraphicsAuditSnapshot {
  validateSourceTargetMaterialLightingAtlas(descriptor, world);
  const cards = descriptor.cards;
  return Object.freeze({
    cards,
    authoredHoles: Object.freeze(cards.flatMap(({ authoredHole }) => rectPoints(authoredHole))),
    openNotches: Object.freeze(cards.flatMap(({ openNotch }) => rectPoints(openNotch))),
    thinStructures: Object.freeze(cards.flatMap(({ thinStructure }) => rectPoints(thinStructure))),
    isolated: Object.freeze(cards.map(({ isolated }) => isolated)),
    zeroStates: Object.freeze(cards.map(({ zeroState }) => zeroState)),
    wrongOwners: Object.freeze(cards.map(({ wrongOwner }) => wrongOwner)),
    targetControls: Object.freeze(cards.map(({ targetControl }) => targetControl)),
    wallCoexistence: Object.freeze(cards.map(({ wallCoexistence }) => wallCoexistence)),
    guardedBlanks: Object.freeze(cards.map(({ guardedBlank }) => guardedBlank)),
    conductiveWall: descriptor.conductiveWall,
    recoveryProbe: descriptor.recoveryProbe,
  });
}

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
  if (!SOURCE_OWNER_IDS.has(owner)) throw new RangeError(`Invalid configured-source owner ID: ${owner}`);
  const encodedState = encodeSourceTargetPresentationState(target);
  simulation.cells()[y * simulation.width + x] = owner;
  simulation.setFixturePresentationState(x, y, encodedState);
}

export function prepareSourceTargetMaterialLightingAtlas(
  simulation: SimulationBackend,
  descriptor: SourceTargetAtlasDescriptor,
  world: { readonly width: number; readonly height: number },
): void {
  validateSourceTargetMaterialLightingAtlas(descriptor, world);
  if (!supportsSourceTargetFixture(simulation)) {
    throw new Error('Configured-source graphics audit fixture requires render-lab state and wall planes');
  }
  if (simulation.width !== world.width || simulation.height !== world.height) {
    throw new Error(`Configured-source graphics audit fixture requires ${world.width}x${world.height}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of descriptor.cards) {
    fillStateRect(simulation, cells, entry.body, entry.owner, entry.encodedState);
    fillStateRect(simulation, cells, entry.authoredHole, descriptor.materials.empty, 0);
    fillStateRect(simulation, cells, entry.openNotch, descriptor.materials.empty, 0);
    fillStateRect(simulation, cells, entry.thinStructure, entry.owner, entry.encodedState);
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = entry.owner;
    simulation.setFixturePresentationState(entry.isolated.x, entry.isolated.y, entry.encodedState);
    fillStateRect(simulation, cells, entry.zeroState, entry.owner, 0);
    fillStateRect(simulation, cells, entry.wrongOwner,
      entry.target === descriptor.materials.sand ? descriptor.materials.metal : descriptor.materials.sand,
      entry.encodedState);
    fillStateRect(simulation, cells, entry.targetControl, entry.target, entry.encodedState);
    fillStateRect(simulation, cells, entry.wallCoexistence, entry.owner, entry.encodedState);
    for (let y = entry.wallCoexistence.y; y < entry.wallCoexistence.y + entry.wallCoexistence.height; y += 4) {
      for (let x = entry.wallCoexistence.x; x < entry.wallCoexistence.x + entry.wallCoexistence.width; x += 4) {
        simulation.paintWall(x, y, descriptor.conductiveWall, 0);
      }
    }
    fillStateRect(simulation, cells, entry.guardedBlank, descriptor.materials.empty, 0);
  }
}

function supportsSourceTargetFixture(simulation: SimulationBackend): simulation is SourceTargetFixtureBackend {
  const candidate = simulation as Partial<SourceTargetFixtureBackend>;
  return typeof candidate.presentationState === 'function' && typeof candidate.walls === 'function'
    && typeof candidate.paintWall === 'function'
    && typeof candidate.setFixturePresentationStateRect === 'function'
    && typeof candidate.setFixturePresentationState === 'function';
}
function supportsSourceTargetStateFixture(simulation: SimulationBackend): simulation is SourceTargetStateFixtureBackend {
  const candidate = simulation as Partial<SourceTargetStateFixtureBackend>;
  return typeof candidate.presentationState === 'function'
    && typeof candidate.setFixturePresentationState === 'function';
}
function fillStateRect(simulation: SourceTargetFixtureBackend, cells: Uint8Array,
  rect: SourceTargetGraphicsRect, material: number, state: number): void {
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
function validatePoint(point: SourceTargetAtlasPoint, world: { readonly width: number; readonly height: number }): void {
  if (!Number.isSafeInteger(point.x) || !Number.isSafeInteger(point.y)
    || point.x < 0 || point.y < 0 || point.x >= world.width || point.y >= world.height) {
    throw new TypeError('Configured-source material-lighting atlas geometry escapes its world');
  }
}
function validateRect(rect: SourceTargetAtlasRect, world: { readonly width: number; readonly height: number }): void {
  validatePoint(rect, world);
  if (!Number.isSafeInteger(rect.width) || !Number.isSafeInteger(rect.height)
    || rect.width < 1 || rect.height < 1
    || rect.x + rect.width > world.width || rect.y + rect.height > world.height) {
    throw new TypeError('Configured-source material-lighting atlas geometry escapes its world');
  }
}
