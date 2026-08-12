import type { SimulationBackend } from '../simulation/types';
import { SOLID_MATERIAL_LIGHTING_ATLAS_CATALOG } from '../shared/solid-material-lighting-atlas-catalog.js';
import {
  createSolidMaterialLightingAtlas,
  prepareSolidMaterialLightingAtlas,
  type SolidMaterialLightingAtlas,
  type SolidMaterialLightingCard,
} from './solid-material-lighting-atlas-authoring';

const AUTHORING = SOLID_MATERIAL_LIGHTING_ATLAS_CATALOG.atlases.find(
  ({ candidate }) => candidate === 'solid-material-lighting-atlas',
);
if (!AUTHORING) throw new TypeError('Solid material-lighting atlas authoring is missing');
export const SOLID_MATERIAL_LIGHTING_ATLAS_WORLD = AUTHORING.world;

export type SolidMaterialLightingAtlasCard = SolidMaterialLightingCard;
export type SolidMaterialLightingAtlasSnapshot = SolidMaterialLightingAtlas;

/**
 * Paused cross-family solid board for the existing material-lighting control.
 * It deliberately contains only semantic ownership and native walls: later
 * rendering experiments own all RGB response and cannot infer a new material
 * class from this fixture.
 */
export const SOLID_MATERIAL_LIGHTING_ATLAS: SolidMaterialLightingAtlasSnapshot = createSolidMaterialLightingAtlas({
  ...AUTHORING.descriptor,
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
