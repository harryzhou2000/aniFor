import {
  SOURCE_TARGET_MATERIAL_LIGHTING_ATLAS_CATALOG,
} from '../shared/source-target-material-lighting-atlas-catalog.js';
import {
  createSourceTargetGraphicsAuditSnapshot,
  prepareSourceTargetMaterialLightingAtlas,
} from './source-target-material-lighting-atlas-authoring';

export type {
  SourceTargetGraphicsAtlasEntry,
  SourceTargetGraphicsAuditSnapshot,
  SourceTargetGraphicsOwner,
  SourceTargetGraphicsPoint,
  SourceTargetGraphicsRect,
  SourceTargetGraphicsTarget,
} from './source-target-material-lighting-atlas-authoring';
export {
  encodeSourceTargetPresentationState,
  placeSourceTargetRecoveryProbe,
} from './source-target-material-lighting-atlas-authoring';

const authoring = SOURCE_TARGET_MATERIAL_LIGHTING_ATLAS_CATALOG.atlases[0];
const descriptor = authoring.descriptor;

export const SOURCE_TARGET_GRAPHICS_ATLAS_COLUMNS = descriptor.columns;
export const SOURCE_TARGET_GRAPHICS_ATLAS_ROWS = descriptor.rows;
export const SOURCE_TARGET_GRAPHICS_OWNERS = descriptor.owners;
export const SOURCE_TARGET_GRAPHICS_TARGETS = descriptor.targets;
export const SOURCE_TARGET_GRAPHICS_ATLAS = descriptor.cards;
export const SOURCE_TARGET_RECOVERY_PROBE = descriptor.recoveryProbe;
export const SOURCE_TARGET_GRAPHICS_AUDIT = createSourceTargetGraphicsAuditSnapshot(
  descriptor, authoring.world,
);

/** Compatibility facade for the established prepared-fixture registry. */
export function prepareSourceTargetGraphicsAuditFixture(simulation: Parameters<
  typeof prepareSourceTargetMaterialLightingAtlas
>[0]): void {
  prepareSourceTargetMaterialLightingAtlas(simulation, descriptor, authoring.world);
}
