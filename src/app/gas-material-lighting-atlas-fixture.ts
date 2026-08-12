import {
  GAS_MATERIAL_LIGHTING_ATLAS_CATALOG,
} from '../shared/gas-material-lighting-atlas-catalog.js';
import type { SimulationBackend } from '../simulation/types';
import { prepareGasMaterialLightingAtlas } from './gas-material-lighting-atlas-authoring';

const AUTHORING = GAS_MATERIAL_LIGHTING_ATLAS_CATALOG.atlases[0];

export const GAS_MATERIAL_LIGHTING_ATLAS_WORLD = AUTHORING.world;

/** Shared data-only geometry retained under the fixture's established public name. */
export const GAS_MATERIAL_LIGHTING_ATLAS = AUTHORING.descriptor;

/**
 * Direct-fills a deterministic paused RenderLab state. The renderer remains
 * the sole owner of atmosphere expansion and volume reconstruction.
 */
export function prepareGasMaterialLightingAtlasFixture(simulation: SimulationBackend): void {
  prepareGasMaterialLightingAtlas(
    simulation,
    AUTHORING.descriptor,
    AUTHORING.world,
    'Gas material-lighting atlas',
  );
}
