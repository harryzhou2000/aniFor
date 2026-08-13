import type { SimulationBackend } from '../simulation/types';
import {
  RENDER_OPTICS_MATERIAL_LIGHTING_ATLAS_CATALOG,
} from '../shared/render-optics-material-lighting-atlas-catalog.js';
import {
  prepareRenderOpticsMaterialLightingAtlas,
} from './render-optics-material-lighting-atlas-authoring';

const AUTHORING = RENDER_OPTICS_MATERIAL_LIGHTING_ATLAS_CATALOG.atlases[0];

/** Shared frozen world geometry for the compact cross-phase optics board. */
export const RENDER_OPTICS_MATERIAL_LIGHTING_ATLAS_WORLD = AUTHORING.world;

/** Data-only body, topology, source, and inspection descriptors. */
export const RENDER_OPTICS_MATERIAL_LIGHTING_ATLAS = AUTHORING.descriptor;

/** Direct-fills the paused RenderOptics representative atlas without stepping it. */
export function prepareRenderOpticsMaterialLightingAtlasFixture(
  simulation: SimulationBackend,
): void {
  prepareRenderOpticsMaterialLightingAtlas(
    simulation,
    AUTHORING.descriptor,
    AUTHORING.world,
    'RenderOptics material-lighting atlas',
  );
}
