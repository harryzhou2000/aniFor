import {
  THERMAL_SOURCE_MATERIAL_LIGHTING_ATLAS_CATALOG,
} from '../shared/thermal-source-material-lighting-atlas-catalog.js';
import {
  createCeramicTemperatureVfxAuditSnapshot,
  prepareThermalSourceMaterialLightingAtlas,
} from './thermal-source-material-lighting-atlas-authoring';

export type {
  CeramicTemperatureVfxAuditSnapshot,
  CeramicTemperatureVfxCard,
  CeramicTemperatureVfxKey,
  CeramicTemperatureVfxPoint,
  CeramicTemperatureVfxRect,
} from './thermal-source-material-lighting-atlas-authoring';

const authoring = THERMAL_SOURCE_MATERIAL_LIGHTING_ATLAS_CATALOG.atlases[0];
const descriptor = authoring.descriptor;

export const CERAMIC_TEMPERATURE_VFX_AUDIT = createCeramicTemperatureVfxAuditSnapshot(
  descriptor, authoring.world,
);

/** Compatibility facade for the established prepared-fixture registry. */
export function prepareCeramicTemperatureVfxFixture(
  simulation: Parameters<typeof prepareThermalSourceMaterialLightingAtlas>[0],
): void {
  prepareThermalSourceMaterialLightingAtlas(simulation, descriptor, authoring.world);
}
