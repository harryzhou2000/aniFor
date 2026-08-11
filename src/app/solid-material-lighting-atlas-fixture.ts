import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation/types';

export const SOLID_MATERIAL_LIGHTING_ATLAS_WORLD = Object.freeze({ width: 612, height: 384 });

const CARD_COLUMNS = 4;
const CARD_ORIGIN_X = 6;
const CARD_ORIGIN_Y = 6;
const CARD_STRIDE_X = 152;
const CARD_STRIDE_Y = 190;
const CARD_WIDTH = 146;
const CARD_HEIGHT = 184;
const CONDUCTIVE_WALL = 1;

interface Point {
  readonly x: number;
  readonly y: number;
}

interface Rect extends Point {
  readonly width: number;
  readonly height: number;
}

const SOLID_MATERIAL_LIGHTING_DEFINITIONS = [
  { material: Material.Brick, code: 'BRCK' },
  { material: Material.Metal, code: 'METL' },
  { material: Material.Ceramic, code: 'CRMC' },
  { material: Material.Glass, code: 'GLAS' },
  { material: Material.Ice, code: 'ICE' },
  { material: Material.Wood, code: 'WOOD' },
  { material: Material.BTRY, code: 'BTRY' },
  { material: Material.ISZS, code: 'ISZS' },
] as const;

type SolidMaterialLightingMaterial = (typeof SOLID_MATERIAL_LIGHTING_DEFINITIONS)[number]['material'];

export interface SolidMaterialLightingAtlasCard {
  readonly material: SolidMaterialLightingMaterial;
  readonly code: string;
  readonly card: Rect;
  /** Broad exact owner for a later shared solid-lighting experiment. */
  readonly body: Rect;
  readonly hole: Rect;
  /** Empty channel reaching the body's exterior, not an enclosed cavity. */
  readonly openNotch: Rect;
  readonly thinStructure: Rect;
  readonly isolated: Point;
  readonly unlikeSolidContact: {
    readonly owner: Rect;
    readonly neighbour: Rect;
    readonly neighbourMaterial: SolidMaterialLightingMaterial;
  };
  /** Matter and the native bmap wall plane are independently present here. */
  readonly nativeWall: { readonly body: Rect; readonly anchor: Point };
  /** Four-cell air gap keeps directional emission live without source overlap. */
  readonly emitter: Rect;
  readonly guardedBlank: Rect;
}

export interface SolidMaterialLightingAtlasSnapshot {
  readonly cards: readonly SolidMaterialLightingAtlasCard[];
  readonly guardedBlanks: readonly Rect[];
  readonly conductiveWall: number;
}

const rect = (x: number, y: number, width: number, height: number): Rect => (
  Object.freeze({ x, y, width, height })
);

const point = (x: number, y: number): Point => Object.freeze({ x, y });

/**
 * Paused cross-family solid board for the existing material-lighting control.
 * It deliberately contains only semantic ownership and native walls: later
 * rendering experiments own all RGB response and cannot infer a new material
 * class from this fixture.
 */
const SOLID_MATERIAL_LIGHTING_CARDS = Object.freeze(
  SOLID_MATERIAL_LIGHTING_DEFINITIONS.map((definition, index) => {
    const column = index % CARD_COLUMNS;
    const row = Math.floor(index / CARD_COLUMNS);
    const card = rect(
      CARD_ORIGIN_X + column * CARD_STRIDE_X,
      CARD_ORIGIN_Y + row * CARD_STRIDE_Y,
      CARD_WIDTH,
      CARD_HEIGHT,
    );
    const body = rect(card.x + 10, card.y + 12, 72, 62);
    const neighbour = SOLID_MATERIAL_LIGHTING_DEFINITIONS[
      (index + 1) % SOLID_MATERIAL_LIGHTING_DEFINITIONS.length
    ].material;
    const wallBody = rect(card.x + 116, card.y + 20, 20, 20);
    return Object.freeze({
      material: definition.material,
      code: definition.code,
      card,
      body,
      hole: rect(body.x + 32, body.y + 26, 8, 8),
      openNotch: rect(body.x + body.width - 1, body.y + 36, 1, 12),
      thinStructure: rect(card.x + 96, card.y + 20, 1, 70),
      isolated: point(card.x + 108, card.y + 108),
      unlikeSolidContact: Object.freeze({
        owner: rect(card.x + 12, card.y + 146, 16, 14),
        neighbour: rect(card.x + 28, card.y + 146, 16, 14),
        neighbourMaterial: neighbour,
      }),
      nativeWall: Object.freeze({ body: wallBody, anchor: point(wallBody.x, wallBody.y) }),
      emitter: rect(card.x + 86, card.y + 22, 3, 44),
      guardedBlank: rect(card.x + 50, card.y + 116, 66, 18),
    } satisfies SolidMaterialLightingAtlasCard);
  }),
);

export const SOLID_MATERIAL_LIGHTING_ATLAS: SolidMaterialLightingAtlasSnapshot = Object.freeze({
  cards: SOLID_MATERIAL_LIGHTING_CARDS,
  guardedBlanks: Object.freeze(SOLID_MATERIAL_LIGHTING_CARDS.map(({ guardedBlank }) => guardedBlank)),
  conductiveWall: CONDUCTIVE_WALL,
});

interface SolidMaterialLightingFixtureBackend extends SimulationBackend {
  readonly walls: () => Uint8Array;
  paintWall(x: number, y: number, wall: number, radius: number): void;
}

/** Direct-fill a static RenderLab world; capture control remains separate. */
export function prepareSolidMaterialLightingAtlasFixture(simulation: SimulationBackend): void {
  if (!supportsFixtureBackend(simulation)) {
    throw new Error('Solid material-lighting atlas requires RenderLab wall plane');
  }
  if (simulation.width !== SOLID_MATERIAL_LIGHTING_ATLAS_WORLD.width
    || simulation.height !== SOLID_MATERIAL_LIGHTING_ATLAS_WORLD.height) {
    throw new Error(
      `Solid material-lighting atlas requires ${SOLID_MATERIAL_LIGHTING_ATLAS_WORLD.width}`
      + `x${SOLID_MATERIAL_LIGHTING_ATLAS_WORLD.height}`,
    );
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const card of SOLID_MATERIAL_LIGHTING_ATLAS.cards) {
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
        simulation.paintWall(x, y, CONDUCTIVE_WALL, 0);
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

function fillRect(cells: Uint8Array, width: number, area: Rect, material: Material): void {
  for (let y = area.y; y < area.y + area.height; y++) {
    cells.fill(material, y * width + area.x, y * width + area.x + area.width);
  }
}
