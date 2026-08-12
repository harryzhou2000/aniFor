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
    expect(at(powder.clay.x, powder.clay.y)).toBe(Material.Clay);
    expect(at(powder.hole.x, powder.hole.y)).toBe(Material.Empty);
    expect(at(powder.fineColumn.x, powder.fineColumn.y)).toBe(Material.Clay);
    expect(at(powder.warmEmitter.x, powder.warmEmitter.y)).toBe(Material.Fire);
    expect(at(liquid.water.x, liquid.water.y)).toBe(Material.Water);
    expect(at(liquid.oil.x, liquid.oil.y)).toBe(Material.Oil);
    expect(at(liquid.waterHole.x, liquid.waterHole.y)).toBe(Material.Empty);
    expect(at(liquid.oilChimney.x, liquid.oilChimney.y)).toBe(Material.Empty);
    expect(at(liquid.coolEmitter.x, liquid.coolEmitter.y)).toBe(Material.ELEC);
    expect(at(gas.smoke.probe.x, gas.smoke.probe.y)).toBe(Material.Smoke);
    expect(at(gas.smoke.bounds.x, gas.smoke.bounds.y)).toBe(Material.Empty);
    expect(at(gas.fog.probe.x, gas.fog.probe.y)).toBe(Material.FOG);
    expect(at(gas.fog.bounds.x + gas.fog.bounds.width - 1, gas.fog.bounds.y + gas.fog.bounds.height - 1))
      .toBe(Material.Empty);
    expect(at(gas.sparseSmoke[0].x, gas.sparseSmoke[0].y)).toBe(Material.Smoke);
    expect(at(gas.warmEmitter.x, gas.warmEmitter.y)).toBe(Material.Fire);
    expect(at(gas.coolEmitter.x, gas.coolEmitter.y)).toBe(Material.GRVT);
    expect(at(guardedBlank.x, guardedBlank.y)).toBe(Material.Empty);
  });
});
