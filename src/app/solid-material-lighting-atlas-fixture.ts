import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation/types';
import {
  createSolidMaterialLightingAtlas,
  prepareSolidMaterialLightingAtlas,
  type SolidMaterialLightingAtlas,
  type SolidMaterialLightingCard,
} from './solid-material-lighting-atlas-authoring';

export const SOLID_MATERIAL_LIGHTING_ATLAS_WORLD = Object.freeze({ width: 612, height: 384 });

const CARD_COLUMNS = 4;
const CARD_ORIGIN_X = 6;
const CARD_ORIGIN_Y = 6;
const CARD_STRIDE_X = 152;
const CARD_STRIDE_Y = 190;
const CARD_WIDTH = 146;
const CARD_HEIGHT = 184;
const CONDUCTIVE_WALL = 1;

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

export type SolidMaterialLightingAtlasCard = SolidMaterialLightingCard;
export type SolidMaterialLightingAtlasSnapshot = SolidMaterialLightingAtlas;

/**
 * Paused cross-family solid board for the existing material-lighting control.
 * It deliberately contains only semantic ownership and native walls: later
 * rendering experiments own all RGB response and cannot infer a new material
 * class from this fixture.
 */
export const SOLID_MATERIAL_LIGHTING_ATLAS: SolidMaterialLightingAtlasSnapshot = createSolidMaterialLightingAtlas({
  definitions: SOLID_MATERIAL_LIGHTING_DEFINITIONS,
  columns: CARD_COLUMNS,
  origin: { x: CARD_ORIGIN_X, y: CARD_ORIGIN_Y },
  stride: { x: CARD_STRIDE_X, y: CARD_STRIDE_Y },
  cardSize: { width: CARD_WIDTH, height: CARD_HEIGHT },
  conductiveWall: CONDUCTIVE_WALL,
  template: {
    body: { x: 10, y: 12, width: 72, height: 62 },
    hole: { x: 42, y: 38, width: 8, height: 8 },
    openNotch: { x: 81, y: 48, width: 1, height: 12 },
    thinStructure: { x: 96, y: 20, width: 1, height: 70 },
    isolated: { x: 108, y: 108 },
    contactOwner: { x: 12, y: 146, width: 16, height: 14 },
    contactNeighbour: { x: 28, y: 146, width: 16, height: 14 },
    nativeWall: { x: 116, y: 20, width: 20, height: 20 },
    emitter: { x: 86, y: 22, width: 3, height: 44 },
    guardedBlank: { x: 50, y: 116, width: 66, height: 18 },
  },
});

/** Direct-fill a static RenderLab world; capture control remains separate. */
export function prepareSolidMaterialLightingAtlasFixture(simulation: SimulationBackend): void {
  prepareSolidMaterialLightingAtlas(
    simulation,
    SOLID_MATERIAL_LIGHTING_ATLAS,
    SOLID_MATERIAL_LIGHTING_ATLAS_WORLD,
    'Solid material-lighting atlas',
  );
}
