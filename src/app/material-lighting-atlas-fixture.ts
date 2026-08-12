import type { SimulationBackend } from '../simulation/types';
import { MATERIAL_LIGHTING_ATLAS_CATALOG } from '../shared/material-lighting-atlas-catalog.js';
import { prepareMaterialLightingAtlas } from './material-lighting-atlas-authoring';

const AUTHORING = MATERIAL_LIGHTING_ATLAS_CATALOG.atlases[0];

export const MATERIAL_LIGHTING_ATLAS_WORLD = AUTHORING.world;
export const MATERIAL_LIGHTING_ATLAS = AUTHORING.descriptor;

/** Direct-fill the paused cross-phase board; capture control remains separate. */
export function prepareMaterialLightingAtlasFixture(simulation: SimulationBackend): void {
  prepareMaterialLightingAtlas(
    simulation, AUTHORING.descriptor, AUTHORING.world, 'Material-lighting atlas',
  );
}
