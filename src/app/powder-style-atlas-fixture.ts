import type { SimulationBackend } from '../simulation/types';
import { POWDER_STYLE_ATLAS_CATALOG } from '../shared/powder-style-atlas-catalog.js';
import type {
  PowderStyleAtlasPoint,
  PowderStyleAtlasRect,
} from '../shared/powder-style-atlas-catalog.js';
import { preparePowderStyleAtlas } from './powder-style-atlas-authoring';

export type { PowderStyleAtlasPoint, PowderStyleAtlasRect };

const AUTHORING = (() => {
  const entry = POWDER_STYLE_ATLAS_CATALOG.atlases.find(
    ({ candidate }) => candidate === 'powder-style-atlas',
  );
  if (!entry) throw new TypeError('Powder-style atlas authoring is missing');
  return entry;
})();

/** Compatibility view over the shared frozen Powder-style authoring. */
export const POWDER_STYLE_ATLAS_WORLD = AUTHORING.world;
export const POWDER_STYLE_ATLAS_CONDUCTIVE_WALL = AUTHORING.descriptor.conductiveWall;
export const POWDER_STYLE_ATLAS = AUTHORING.descriptor;

/** Preserve the historical paused direct-fill fixture API. */
export function preparePowderStyleAtlasFixture(simulation: SimulationBackend): void {
  preparePowderStyleAtlas(
    simulation,
    AUTHORING.descriptor,
    AUTHORING.world,
    'Powder style atlas fixture',
  );
}
