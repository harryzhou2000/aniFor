import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  MATERIAL_LIGHTING_ATLAS,
  prepareMaterialLightingAtlasFixture,
} from './material-lighting-atlas-fixture';

describe('material-lighting atlas fixture', () => {
  it('keeps representative phase bodies, authored voids, sparse gas, and the guarded blank topologically distinct', () => {
    const simulation = new RenderLabBackend();
    prepareMaterialLightingAtlasFixture(simulation);
    const at = (x: number, y: number) => simulation.cells()[y * simulation.width + x];
    const { powder, liquid, gas, guardedBlank } = MATERIAL_LIGHTING_ATLAS;

    expect(at(powder.sand.x, powder.sand.y)).toBe(Material.Sand);
    expect(at(powder.hole.x, powder.hole.y)).toBe(Material.Empty);
    expect(at(liquid.water.x, liquid.water.y)).toBe(Material.Water);
    expect(at(liquid.oil.x, liquid.oil.y)).toBe(Material.Oil);
    expect(at(liquid.waterHole.x, liquid.waterHole.y)).toBe(Material.Empty);
    expect(at(gas.smoke.x, gas.smoke.y)).toBe(Material.Smoke);
    expect(at(gas.fog.x + gas.fog.width - 1, gas.fog.y + gas.fog.height - 1)).toBe(Material.FOG);
    expect(at(gas.sparseSmoke[0].x, gas.sparseSmoke[0].y)).toBe(Material.Smoke);
    expect(at(guardedBlank.x, guardedBlank.y)).toBe(Material.Empty);
  });
});
