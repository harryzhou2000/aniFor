import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation/types';
import {
  createSolidMaterialLightingAtlas,
  prepareSolidMaterialLightingAtlas,
} from './solid-material-lighting-atlas-authoring';

export const MULTI_METAL_MATERIAL_LIGHTING_ATLAS_WORLD = Object.freeze({ width: 612, height: 384 });

const METALLIC_RIGID_DEFINITIONS = [
  { material: Material.Metal, code: 'METL' },
  { material: Material.BMTL, code: 'BMTL' },
  { material: Material.GOLD, code: 'GOLD' },
  { material: Material.IRON, code: 'IRON' },
  { material: Material.PTNM, code: 'PTNM' },
  { material: Material.TTAN, code: 'TTAN' },
] as const;

/**
 * Paused class-wide board for ordinary MetallicRigid materials. HEAC remains a
 * SmoothRigid control and TUNG retains Device/state ownership, so neither is
 * silently admitted into this optical-family fixture.
 */
export const MULTI_METAL_MATERIAL_LIGHTING_ATLAS = createSolidMaterialLightingAtlas({
  definitions: METALLIC_RIGID_DEFINITIONS,
  columns: 3,
  origin: { x: 6, y: 6 },
  stride: { x: 202, y: 190 },
  cardSize: { width: 196, height: 184 },
  conductiveWall: 1,
  template: {
    body: { x: 10, y: 12, width: 112, height: 82 },
    hole: { x: 56, y: 38, width: 12, height: 10 },
    openNotch: { x: 121, y: 56, width: 1, height: 14 },
    thinStructure: { x: 150, y: 18, width: 1, height: 78 },
    isolated: { x: 170, y: 108 },
    contactOwner: { x: 12, y: 146, width: 22, height: 14 },
    contactNeighbour: { x: 34, y: 146, width: 22, height: 14 },
    nativeWall: { x: 166, y: 20, width: 20, height: 20 },
    emitter: { x: 126, y: 22, width: 4, height: 54 },
    guardedBlank: { x: 70, y: 118, width: 90, height: 18 },
  },
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
