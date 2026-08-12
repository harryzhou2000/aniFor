import {
  FORCE_ACTIVITY_MATERIAL_LIGHTING_ATLAS_CATALOG,
} from '../shared/force-activity-material-lighting-atlas-catalog.js';
import {
  createForceActivityGraphicsAuditSnapshot,
  prepareForceActivityMaterialLightingAtlas,
} from './force-activity-material-lighting-atlas-authoring';

export type {
  ForceActivityGraphicsAtlasEntry,
  ForceActivityGraphicsAuditSnapshot,
  ForceActivityGraphicsKey,
  ForceActivityGraphicsOwner,
  ForceActivityGraphicsPoint,
  ForceActivityGraphicsRect,
} from './force-activity-material-lighting-atlas-authoring';

const authoring = FORCE_ACTIVITY_MATERIAL_LIGHTING_ATLAS_CATALOG.atlases[0];
const descriptor = authoring.descriptor;

export const FORCE_ACTIVITY_GRAPHICS_ATLAS_COLUMNS = descriptor.layout.columns;
export const FORCE_ACTIVITY_GRAPHICS_ATLAS_ROWS = descriptor.layout.rows;
export const FORCE_ACTIVITY_INACTIVE_STATE = descriptor.states[0].encodedState;
export const FORCE_ACTIVITY_ACTIVE_STATE = descriptor.states[1].encodedState;
export const FORCE_ACTIVITY_GRAPHICS_STATES = descriptor.states;
export const FORCE_ACTIVITY_GRAPHICS_AUDIT = createForceActivityGraphicsAuditSnapshot(
  descriptor, authoring.world,
);
export const FORCE_ACTIVITY_GRAPHICS_ATLAS = FORCE_ACTIVITY_GRAPHICS_AUDIT.cards;

/** Compatibility facade for the established prepared-fixture registry. */
export function prepareForceActivityGraphicsAuditFixture(
  simulation: Parameters<typeof prepareForceActivityMaterialLightingAtlas>[0],
): void {
  prepareForceActivityMaterialLightingAtlas(simulation, descriptor, authoring.world);
}
