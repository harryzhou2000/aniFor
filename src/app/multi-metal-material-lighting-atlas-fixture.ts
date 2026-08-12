import type { SimulationBackend } from '../simulation/types';
import { SOLID_MATERIAL_LIGHTING_ATLAS_CATALOG } from '../shared/solid-material-lighting-atlas-catalog.js';
import {
  createSolidMaterialLightingAtlas,
  prepareSolidMaterialLightingAtlas,
} from './solid-material-lighting-atlas-authoring';

const AUTHORING = SOLID_MATERIAL_LIGHTING_ATLAS_CATALOG.atlases.find(
  ({ candidate }) => candidate === 'multi-metal-material-lighting-atlas',
);
if (!AUTHORING) throw new TypeError('Multi-metal material-lighting atlas authoring is missing');
export const MULTI_METAL_MATERIAL_LIGHTING_ATLAS_WORLD = AUTHORING.world;

/**
 * Paused class-wide board for ordinary MetallicRigid materials. HEAC remains a
 * SmoothRigid control and TUNG retains Device/state ownership, so neither is
 * silently admitted into this optical-family fixture.
 */
export const MULTI_METAL_MATERIAL_LIGHTING_ATLAS = createSolidMaterialLightingAtlas({
  ...AUTHORING.descriptor,
});

export function prepareMultiMetalMaterialLightingAtlasFixture(
  simulation: SimulationBackend,
): void {
  prepareSolidMaterialLightingAtlas(
    simulation,
    MULTI_METAL_MATERIAL_LIGHTING_ATLAS,
    MULTI_METAL_MATERIAL_LIGHTING_ATLAS_WORLD,
    'Multi-metal material-lighting atlas',
  );
}
