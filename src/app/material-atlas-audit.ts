import { ALL_MATERIALS, type Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

// The top 84 world cells are reserved for the field/backend indicator. Twenty-
// six columns fit every non-empty uint8 projection (1..255) below it.
export const MATERIAL_ATLAS_COLUMNS = 26;
export const MATERIAL_ATLAS_BLOCK_RADIUS = 4;
const MATERIAL_ATLAS_ORIGIN_X = 10;
const MATERIAL_ATLAS_ORIGIN_Y = 90;
const MATERIAL_ATLAS_STRIDE_X = 23;
const MATERIAL_ATLAS_STRIDE_Y = 30;

export interface MaterialAtlasEntry {
  readonly id: Material;
  readonly name: string;
  readonly color: string;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

/**
 * Stable world-space atlas for the composed browser rendering gate.
 *
 * Every projected material owns one isolated 9x9 semantic block. The generous
 * blank guard band keeps gas/emission reconstruction observable without
 * letting a neighbouring material satisfy a missing tile's visibility check.
 */
export const MATERIAL_ATLAS: readonly MaterialAtlasEntry[] = ALL_MATERIALS.map(
  ({ id, name, color }, index) => ({
    id,
    name,
    color,
    x: MATERIAL_ATLAS_ORIGIN_X + index % MATERIAL_ATLAS_COLUMNS * MATERIAL_ATLAS_STRIDE_X,
    y: MATERIAL_ATLAS_ORIGIN_Y + Math.floor(index / MATERIAL_ATLAS_COLUMNS) * MATERIAL_ATLAS_STRIDE_Y,
    radius: MATERIAL_ATLAS_BLOCK_RADIUS,
  }),
);

export function materialAtlasAuditRequested(search = globalThis.location?.search ?? ''): boolean {
  return new URLSearchParams(search).get('auditStage') === 'material-atlas';
}

/** Builds the audit-only all-projection fixture without changing material metadata. */
export function prepareMaterialAtlasAuditFixture(simulation: SimulationBackend): void {
  simulation.clear();
  for (const entry of MATERIAL_ATLAS) {
    for (let y = entry.y - entry.radius; y <= entry.y + entry.radius; y++) {
      for (let x = entry.x - entry.radius; x <= entry.x + entry.radius; x++) {
        simulation.paint(x, y, entry.id, 0);
      }
    }
  }
}
