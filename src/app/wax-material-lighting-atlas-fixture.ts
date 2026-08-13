import { Material } from '../shared/materials';
import { WAX_MATERIAL_LIGHTING_ATLAS_CATALOG } from '../shared/wax-material-lighting-atlas-catalog.js';
import type { SimulationBackend } from '../simulation';
import { prepareWaxGraphicsAuditFixture } from './wax-graphics-audit';

const AUTHORING = WAX_MATERIAL_LIGHTING_ATLAS_CATALOG.atlases[0];

/**
 * Capture-only wrapper for WAX/MWAX material-lighting review.
 *
 * The historical audit remains a pure paired-phase topology fixture. This
 * wrapper adds only the declared warm Fire controls required by the existing
 * material-lighting emission-alpha receipt contract.
 */
export function prepareWaxMaterialLightingAtlasFixture(simulation: SimulationBackend): void {
  prepareWaxGraphicsAuditFixture(simulation);
  const cells = simulation.cells();
  for (const { warmEmitter } of AUTHORING.descriptor.cards) {
    for (let y = warmEmitter.y; y < warmEmitter.y + warmEmitter.height; y++) {
      cells.fill(
        Material.Fire,
        y * simulation.width + warmEmitter.x,
        y * simulation.width + warmEmitter.x + warmEmitter.width,
      );
    }
  }
}
