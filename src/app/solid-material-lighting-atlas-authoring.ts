import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation/types';

export interface SolidMaterialLightingPoint {
  readonly x: number;
  readonly y: number;
}

export interface SolidMaterialLightingRect extends SolidMaterialLightingPoint {
  readonly width: number;
  readonly height: number;
}

export interface SolidMaterialLightingDefinition {
  readonly material: number;
  readonly code: string;
}

export interface SolidMaterialLightingCard {
  readonly material: number;
  readonly code: string;
  readonly card: SolidMaterialLightingRect;
  readonly body: SolidMaterialLightingRect;
  readonly hole: SolidMaterialLightingRect;
  readonly openNotch: SolidMaterialLightingRect;
  readonly thinStructure: SolidMaterialLightingRect;
  readonly isolated: SolidMaterialLightingPoint;
  readonly unlikeSolidContact: {
    readonly owner: SolidMaterialLightingRect;
    readonly neighbour: SolidMaterialLightingRect;
    readonly neighbourMaterial: number;
  };
  readonly nativeWall: {
    readonly body: SolidMaterialLightingRect;
    readonly anchor: SolidMaterialLightingPoint;
  };
  readonly emitter: SolidMaterialLightingRect;
  readonly guardedBlank: SolidMaterialLightingRect;
}

export interface SolidMaterialLightingAtlas {
  readonly cards: readonly SolidMaterialLightingCard[];
  readonly guardedBlanks: readonly SolidMaterialLightingRect[];
  readonly conductiveWall: number;
}

interface RelativeTemplate {
  readonly body: SolidMaterialLightingRect;
  readonly hole: SolidMaterialLightingRect;
  readonly openNotch: SolidMaterialLightingRect;
  readonly thinStructure: SolidMaterialLightingRect;
  readonly isolated: SolidMaterialLightingPoint;
  readonly contactOwner: SolidMaterialLightingRect;
  readonly contactNeighbour: SolidMaterialLightingRect;
  readonly nativeWall: SolidMaterialLightingRect;
  readonly emitter: SolidMaterialLightingRect;
  readonly guardedBlank: SolidMaterialLightingRect;
}

export interface SolidMaterialLightingAtlasDescriptor {
  readonly definitions: readonly SolidMaterialLightingDefinition[];
  readonly columns: number;
  readonly origin: SolidMaterialLightingPoint;
  readonly stride: SolidMaterialLightingPoint;
  readonly cardSize: { readonly width: number; readonly height: number };
  readonly template: RelativeTemplate;
  readonly conductiveWall: number;
}

interface SolidMaterialLightingFixtureBackend extends SimulationBackend {
  walls(): Uint8Array;
  paintWall(x: number, y: number, wall: number, radius: number): void;
}

const point = (x: number, y: number): SolidMaterialLightingPoint => Object.freeze({ x, y });
const rect = (
  x: number, y: number, width: number, height: number,
): SolidMaterialLightingRect => Object.freeze({ x, y, width, height });

const translatePoint = (
  card: SolidMaterialLightingRect,
  relative: SolidMaterialLightingPoint,
): SolidMaterialLightingPoint => point(card.x + relative.x, card.y + relative.y);

const translateRect = (
  card: SolidMaterialLightingRect,
  relative: SolidMaterialLightingRect,
): SolidMaterialLightingRect => rect(
  card.x + relative.x, card.y + relative.y, relative.width, relative.height,
);

/**
 * Projects one frozen card template over an ordered material family. The next
 * family member supplies the unlike-contact control, so adding a class-wide
 * review board remains declarative and cannot create renderer authority.
 */
export function createSolidMaterialLightingAtlas(
  descriptor: SolidMaterialLightingAtlasDescriptor,
): SolidMaterialLightingAtlas {
  if (descriptor.definitions.length === 0 || !Number.isInteger(descriptor.columns)
    || descriptor.columns < 1) {
    throw new TypeError('Solid material-lighting atlas requires definitions and columns');
  }
  const materials = new Set<number>();
  const codes = new Set<string>();
  for (const definition of descriptor.definitions) {
    if (!Number.isSafeInteger(definition.material) || definition.material <= Material.Empty
      || definition.material > 255) {
      throw new TypeError('Solid material-lighting atlas materials must be byte-sized owners');
    }
    if (materials.has(definition.material) || codes.has(definition.code)) {
      throw new TypeError('Solid material-lighting atlas definitions must be unique');
    }
    materials.add(definition.material);
    codes.add(definition.code);
  }
  for (const [name, region] of Object.entries(descriptor.template)) {
    const width = 'width' in region ? region.width : 1;
    const height = 'height' in region ? region.height : 1;
    if (![region.x, region.y, width, height].every(Number.isInteger)
      || region.x < 0 || region.y < 0 || width < 1 || height < 1
      || region.x + width > descriptor.cardSize.width
      || region.y + height > descriptor.cardSize.height) {
      throw new TypeError(`Solid material-lighting atlas template ${name} escapes its card`);
    }
  }
  const cards = descriptor.definitions.map((definition, index) => {
    const column = index % descriptor.columns;
    const row = Math.floor(index / descriptor.columns);
    const card = rect(
      descriptor.origin.x + column * descriptor.stride.x,
      descriptor.origin.y + row * descriptor.stride.y,
      descriptor.cardSize.width,
      descriptor.cardSize.height,
    );
    const template = descriptor.template;
    const wallBody = translateRect(card, template.nativeWall);
    return Object.freeze({
      material: definition.material,
      code: definition.code,
      card,
      body: translateRect(card, template.body),
      hole: translateRect(card, template.hole),
      openNotch: translateRect(card, template.openNotch),
      thinStructure: translateRect(card, template.thinStructure),
      isolated: translatePoint(card, template.isolated),
      unlikeSolidContact: Object.freeze({
        owner: translateRect(card, template.contactOwner),
        neighbour: translateRect(card, template.contactNeighbour),
        neighbourMaterial: descriptor.definitions[(index + 1) % descriptor.definitions.length].material,
      }),
      nativeWall: Object.freeze({ body: wallBody, anchor: point(wallBody.x, wallBody.y) }),
      emitter: translateRect(card, template.emitter),
      guardedBlank: translateRect(card, template.guardedBlank),
    } satisfies SolidMaterialLightingCard);
  });
  return Object.freeze({
    cards: Object.freeze(cards),
    guardedBlanks: Object.freeze(cards.map(({ guardedBlank }) => guardedBlank)),
    conductiveWall: descriptor.conductiveWall,
  });
}

/** Direct-fills a paused RenderLab world from a declarative solid atlas. */
export function prepareSolidMaterialLightingAtlas(
  simulation: SimulationBackend,
  atlas: SolidMaterialLightingAtlas,
  world: { readonly width: number; readonly height: number },
  label: string,
): void {
  if (!supportsFixtureBackend(simulation)) {
    throw new Error(`${label} requires RenderLab wall plane`);
  }
  if (simulation.width !== world.width || simulation.height !== world.height) {
    throw new Error(`${label} requires ${world.width}x${world.height}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const card of atlas.cards) {
    fillRect(cells, simulation.width, card.body, card.material);
    fillRect(cells, simulation.width, card.hole, Material.Empty);
    fillRect(cells, simulation.width, card.openNotch, Material.Empty);
    fillRect(cells, simulation.width, card.thinStructure, card.material);
    cells[card.isolated.y * simulation.width + card.isolated.x] = card.material;
    fillRect(cells, simulation.width, card.unlikeSolidContact.owner, card.material);
    fillRect(cells, simulation.width, card.unlikeSolidContact.neighbour,
      card.unlikeSolidContact.neighbourMaterial);
    fillRect(cells, simulation.width, card.nativeWall.body, card.material);
    for (let y = card.nativeWall.body.y; y < card.nativeWall.body.y + card.nativeWall.body.height; y += 4) {
      for (let x = card.nativeWall.body.x; x < card.nativeWall.body.x + card.nativeWall.body.width; x += 4) {
        simulation.paintWall(x, y, atlas.conductiveWall, 0);
      }
    }
    fillRect(cells, simulation.width, card.emitter, Material.Fire);
    fillRect(cells, simulation.width, card.guardedBlank, Material.Empty);
  }
}

function supportsFixtureBackend(
  simulation: SimulationBackend,
): simulation is SolidMaterialLightingFixtureBackend {
  const candidate = simulation as Partial<SolidMaterialLightingFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.paintWall === 'function';
}

function fillRect(
  cells: Uint8Array,
  width: number,
  area: SolidMaterialLightingRect,
  material: number,
): void {
  for (let y = area.y; y < area.y + area.height; y++) {
    cells.fill(material, y * width + area.x, y * width + area.x + area.width);
  }
}
