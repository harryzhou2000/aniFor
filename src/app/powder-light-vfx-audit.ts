import type { SimulationBackend } from '../simulation';
import { OPPOSED_SOURCE_MATERIAL_LIGHTING_ATLAS_CATALOG } from '../shared/opposed-source-material-lighting-atlas-catalog.js';
import {
  createPowderLightVfxAuditSnapshot,
  prepareOpposedSourceMaterialLightingAtlas,
  type PowderLightVfxAuditPoint,
  type PowderLightVfxAuditRect,
  type PowderLightVfxAuditSnapshot,
  type PowderLightVfxCard,
} from './opposed-source-material-lighting-atlas-authoring';

export type {
  PowderLightVfxAuditPoint,
  PowderLightVfxAuditRect,
  PowderLightVfxAuditSnapshot,
  PowderLightVfxCard,
};

const AUTHORING = (() => {
  const entry = OPPOSED_SOURCE_MATERIAL_LIGHTING_ATLAS_CATALOG.atlases.find(
    ({ candidate }) => candidate === 'opposed-source-material-lighting-atlas',
  );
  if (!entry) throw new TypeError('Opposed-source material-lighting atlas authoring is missing');
  return entry;
})();

/** Compatibility view over the shared, frozen opposed-source authoring. */
export const POWDER_LIGHT_VFX_AUDIT = createPowderLightVfxAuditSnapshot(
  AUTHORING.descriptor,
  AUTHORING.world,
);

/** Preserve ordinary paint/erase/wall mutation semantics for the paused fixture. */
export function preparePowderLightVfxFixture(simulation: SimulationBackend): void {
  prepareOpposedSourceMaterialLightingAtlas(
    simulation,
    AUTHORING.descriptor,
    AUTHORING.world,
    'Powder-light VFX fixture',
  );
}
