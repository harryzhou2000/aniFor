import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';
import type {
  ForceActivityAtlasCard,
  ForceActivityAtlasDescriptor,
  ForceActivityAtlasPoint,
  ForceActivityAtlasRect,
} from '../shared/force-activity-material-lighting-atlas-catalog.js';

export type ForceActivityGraphicsKey = 'inactive' | 'active';
export type ForceActivityGraphicsOwner = Material.ACEL | Material.DCEL;
export type ForceActivityGraphicsPoint = ForceActivityAtlasPoint;
export type ForceActivityGraphicsRect = ForceActivityAtlasRect;
export interface ForceActivityGraphicsAtlasEntry extends Omit<
  ForceActivityAtlasCard, 'material' | 'row' | 'column'
> {
  readonly material: ForceActivityGraphicsOwner;
  readonly stateKey: ForceActivityGraphicsKey;
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
  readonly emitters: readonly ForceActivityGraphicsRect[];
  readonly guardedBlanks: readonly ForceActivityGraphicsRect[];
}

interface ForceActivityFixtureBackend extends SimulationBackend {
  presentationState(): Uint16Array;
  setFixturePresentationStateRect(
    x: number, y: number, width: number, height: number, state: number,
  ): void;
  setFixturePresentationState(x: number, y: number, state: number): void;
}

const OWNER_IDS = new Set<number>([Material.ACEL, Material.DCEL]);
const SAFE_CODE = /^[A-Z0-9]{2,8}$/;
const SAFE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateForceActivityMaterialLightingAtlas(
  descriptor: ForceActivityAtlasDescriptor,
  world: { readonly width: number; readonly height: number },
): void {
  if (world.width !== 612 || world.height !== 384
    || descriptor.layout.columns !== 2 || descriptor.layout.rows !== 2
    || descriptor.owners.length !== 2 || descriptor.states.length !== 2
    || descriptor.cards.length !== 4) {
    throw new TypeError('ACEL/DCEL material-lighting atlas topology is malformed');
  }
  const expectedMaterials = {
    empty: Material.Empty, sand: Material.Sand, water: Material.Water,
    fire: Material.Fire, metal: Material.Metal, acel: Material.ACEL, dcel: Material.DCEL,
  };
  for (const [name, material] of Object.entries(expectedMaterials)) {
    if (descriptor.materials[name as keyof typeof expectedMaterials] !== material) {
      throw new TypeError('ACEL/DCEL material-lighting atlas materials are malformed');
    }
  }
  const owners = new Set<number>();
  for (const owner of descriptor.owners) {
    if (!OWNER_IDS.has(owner.material) || owners.has(owner.material) || !SAFE_CODE.test(owner.code)) {
      throw new TypeError('ACEL/DCEL material-lighting atlas owners are malformed');
    }
    owners.add(owner.material);
  }
  if (descriptor.states[0].key !== 'inactive' || descriptor.states[0].active
    || descriptor.states[0].encodedState !== 0 || descriptor.states[1].key !== 'active'
    || !descriptor.states[1].active || descriptor.states[1].encodedState !== 1) {
    throw new TypeError('ACEL/DCEL material-lighting atlas states are malformed');
  }
  for (const [index, card] of descriptor.cards.entries()) {
    if (card.index !== index || card.row !== Math.floor(index / 2) || card.column !== index % 2
      || !owners.has(card.material) || card.stateKey !== descriptor.states[card.column].key
      || card.active !== descriptor.states[card.column].active
      || card.encodedState !== descriptor.states[card.column].encodedState) {
      throw new TypeError('ACEL/DCEL material-lighting atlas cards are malformed');
    }
    for (const rect of [
      card.card, card.body, card.surfaceProbe, card.coreProbe, card.motifAxisProbe,
      card.motifArrowProbe, card.motifBackgroundProbe, card.authoredHole, card.openNotch,
      card.thinStructure, card.wrongOwner, card.waterControl, card.metalControl,
      card.emitter, card.guardedBlank,
    ]) validateRect(rect, world);
    validatePoint(card.isolated, world);
  }
  const names = new Set<string>();
  for (const region of descriptor.inspectionRegions) {
    validateRect(region, world);
    if (!SAFE_NAME.test(region.name) || names.has(region.name)
      || (region.role !== 'response' && region.role !== 'control')) {
      throw new TypeError('ACEL/DCEL material-lighting inspection regions are malformed');
    }
    names.add(region.name);
  }
}

export function createForceActivityGraphicsAuditSnapshot(
  descriptor: ForceActivityAtlasDescriptor,
  world: { readonly width: number; readonly height: number },
): ForceActivityGraphicsAuditSnapshot {
  validateForceActivityMaterialLightingAtlas(descriptor, world);
  const cards: readonly ForceActivityGraphicsAtlasEntry[] = descriptor.cards.map((card) => ({
    material: card.material as ForceActivityGraphicsOwner,
    code: card.code,
    stateKey: card.stateKey,
    active: card.active,
    encodedState: card.encodedState,
    index: card.index,
    card: card.card,
    body: card.body,
    surfaceProbe: card.surfaceProbe,
    coreProbe: card.coreProbe,
    motifAxisProbe: card.motifAxisProbe,
    motifArrowProbe: card.motifArrowProbe,
    motifBackgroundProbe: card.motifBackgroundProbe,
    authoredHole: card.authoredHole,
    openNotch: card.openNotch,
    thinStructure: card.thinStructure,
    isolated: card.isolated,
    wrongOwner: card.wrongOwner,
    waterControl: card.waterControl,
    metalControl: card.metalControl,
    emitter: card.emitter,
    guardedBlank: card.guardedBlank,
  }));
  return {
    cards,
    acelCards: cards.filter(({ material }) => material === Material.ACEL),
    dcelCards: cards.filter(({ material }) => material === Material.DCEL),
    inactiveCards: cards.filter(({ active }) => !active),
    activeCards: cards.filter(({ active }) => active),
    authoredHoles: cards.flatMap(({ authoredHole }) => rectPoints(authoredHole)),
    openNotches: cards.flatMap(({ openNotch }) => rectPoints(openNotch)),
    thinStructures: cards.flatMap(({ thinStructure }) => rectPoints(thinStructure)),
    isolated: cards.map(({ isolated }) => isolated),
    wrongOwners: cards.map(({ wrongOwner }) => wrongOwner),
    waterControls: cards.map(({ waterControl }) => waterControl),
    metalControls: cards.map(({ metalControl }) => metalControl),
    emitters: cards.map(({ emitter }) => emitter),
    guardedBlanks: cards.map(({ guardedBlank }) => guardedBlank),
  };
}

/** Direct-fills the paused force-state atlas without advancing simulation. */
export function prepareForceActivityMaterialLightingAtlas(
  simulation: SimulationBackend,
  descriptor: ForceActivityAtlasDescriptor,
  world: { readonly width: number; readonly height: number },
): void {
  validateForceActivityMaterialLightingAtlas(descriptor, world);
  if (!supportsForceActivityFixture(simulation)) {
    throw new Error('ACEL/DCEL activity graphics audit fixture requires a render-lab state plane');
  }
  if (simulation.width !== world.width || simulation.height !== world.height) {
    throw new Error(`ACEL/DCEL activity graphics audit fixture requires ${world.width}x${world.height}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of descriptor.cards) {
    fillStateRect(simulation, cells, entry.body, entry.material, entry.encodedState);
    fillStateRect(simulation, cells, entry.authoredHole, descriptor.materials.empty, 0);
    fillStateRect(simulation, cells, entry.openNotch, descriptor.materials.empty, 0);
    fillStateRect(simulation, cells, entry.thinStructure, entry.material, entry.encodedState);
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = entry.material;
    simulation.setFixturePresentationState(entry.isolated.x, entry.isolated.y, entry.encodedState);
    fillStateRect(simulation, cells, entry.wrongOwner, descriptor.materials.sand, 1);
    fillStateRect(simulation, cells, entry.waterControl, descriptor.materials.water, 1);
    fillStateRect(simulation, cells, entry.metalControl, descriptor.materials.metal, 1);
    fillStateRect(simulation, cells, entry.emitter, descriptor.materials.fire, 0);
    fillStateRect(simulation, cells, entry.guardedBlank, descriptor.materials.empty, 0);
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

function fillStateRect(
  simulation: ForceActivityFixtureBackend,
  cells: Uint8Array,
  rect: ForceActivityGraphicsRect,
  material: number,
  state: number,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * simulation.width + rect.x, y * simulation.width + rect.x + rect.width);
  }
  simulation.setFixturePresentationStateRect(rect.x, rect.y, rect.width, rect.height, state);
}

function rectPoints(rect: ForceActivityGraphicsRect): ForceActivityGraphicsPoint[] {
  const points: ForceActivityGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}

function validatePoint(
  point: ForceActivityAtlasPoint,
  world: { readonly width: number; readonly height: number },
): void {
  if (!Number.isSafeInteger(point.x) || !Number.isSafeInteger(point.y)
    || point.x < 0 || point.y < 0 || point.x >= world.width || point.y >= world.height) {
    throw new TypeError('ACEL/DCEL material-lighting atlas geometry escapes its world');
  }
}

function validateRect(
  rect: ForceActivityAtlasRect,
  world: { readonly width: number; readonly height: number },
): void {
  validatePoint(rect, world);
  if (!Number.isSafeInteger(rect.width) || !Number.isSafeInteger(rect.height)
    || rect.width < 1 || rect.height < 1
    || rect.x + rect.width > world.width || rect.y + rect.height > world.height) {
    throw new TypeError('ACEL/DCEL material-lighting atlas geometry escapes its world');
  }
}
