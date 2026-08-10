import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation/types';

export const MATERIAL_LIGHTING_ATLAS_WORLD = Object.freeze({ width: 612, height: 384 });

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const rect = (x: number, y: number, width: number, height: number): Rect => (
  Object.freeze({ x, y, width, height })
);

/**
 * One paused scene puts all three reconstructed material phases under the same
 * warm/cool emission fields. Holes, sparse carriers, fine powder structures,
 * and unlike contacts remain visible controls while the lighting variants
 * change RGB only through their established phase-local guards.
 */
export const MATERIAL_LIGHTING_ATLAS = Object.freeze({
  powder: Object.freeze({
    sand: rect(28, 82, 144, 116),
    clay: rect(28, 218, 144, 98),
    hole: rect(92, 122, 12, 14),
    fineColumn: rect(184, 198, 1, 76),
    warmEmitter: rect(18, 106, 5, 68),
  }),
  liquid: Object.freeze({
    water: rect(224, 72, 152, 108),
    oil: rect(224, 204, 152, 104),
    waterHole: rect(286, 112, 14, 12),
    oilChimney: rect(336, 204, 10, 42),
    coolEmitter: rect(386, 92, 5, 72),
  }),
  gas: Object.freeze({
    smoke: rect(430, 64, 154, 112),
    fog: rect(430, 208, 154, 104),
    smokeHole: rect(496, 106, 16, 14),
    fogChannel: rect(430, 208, 12, 42),
    warmEmitter: rect(420, 86, 5, 70),
    coolEmitter: rect(590, 228, 5, 66),
    sparseSmoke: Object.freeze([
      Object.freeze({ x: 456, y: 340 }),
      Object.freeze({ x: 458, y: 340 }),
      Object.freeze({ x: 486, y: 340 }),
    ]),
  }),
  guardedBlank: rect(198, 334, 210, 28),
});

export function prepareMaterialLightingAtlasFixture(simulation: SimulationBackend): void {
  if (simulation.width !== MATERIAL_LIGHTING_ATLAS_WORLD.width
    || simulation.height !== MATERIAL_LIGHTING_ATLAS_WORLD.height) {
    throw new Error(
      `Material-lighting atlas requires ${MATERIAL_LIGHTING_ATLAS_WORLD.width}`
      + `x${MATERIAL_LIGHTING_ATLAS_WORLD.height}`,
    );
  }
  simulation.clear();
  const cells = simulation.cells();
  const atlas = MATERIAL_LIGHTING_ATLAS;

  fillRect(cells, simulation.width, atlas.powder.sand, Material.Sand);
  fillRect(cells, simulation.width, atlas.powder.clay, Material.Clay);
  fillRect(cells, simulation.width, atlas.powder.hole, Material.Empty);
  fillRect(cells, simulation.width, atlas.powder.fineColumn, Material.Clay);
  fillRect(cells, simulation.width, atlas.powder.warmEmitter, Material.Fire);

  fillRect(cells, simulation.width, atlas.liquid.water, Material.Water);
  fillRect(cells, simulation.width, atlas.liquid.oil, Material.Oil);
  fillRect(cells, simulation.width, atlas.liquid.waterHole, Material.Empty);
  fillRect(cells, simulation.width, atlas.liquid.oilChimney, Material.Empty);
  fillRect(cells, simulation.width, atlas.liquid.coolEmitter, Material.ELEC);

  fillRect(cells, simulation.width, atlas.gas.smoke, Material.Smoke);
  fillRect(cells, simulation.width, atlas.gas.fog, Material.FOG);
  fillRect(cells, simulation.width, atlas.gas.smokeHole, Material.Empty);
  fillRect(cells, simulation.width, atlas.gas.fogChannel, Material.Empty);
  fillRect(cells, simulation.width, atlas.gas.warmEmitter, Material.Fire);
  fillRect(cells, simulation.width, atlas.gas.coolEmitter, Material.GRVT);
  for (const point of atlas.gas.sparseSmoke) {
    cells[point.y * simulation.width + point.x] = Material.Smoke;
  }
  fillRect(cells, simulation.width, atlas.guardedBlank, Material.Empty);
}

function fillRect(cells: Uint8Array, width: number, area: Rect, material: Material): void {
  for (let y = area.y; y < area.y + area.height; y++) {
    cells.fill(material, y * width + area.x, y * width + area.x + area.width);
  }
}
