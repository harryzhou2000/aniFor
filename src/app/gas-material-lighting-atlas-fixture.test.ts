import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  GAS_MATERIAL_LIGHTING_ATLAS,
  prepareGasMaterialLightingAtlasFixture,
} from './gas-material-lighting-atlas-fixture';

describe('gas material-lighting atlas fixture', () => {
  it('keeps cloud families, voids, contacts, native wall, sparse carriers, and blank controls distinct', () => {
    const simulation = new RenderLabBackend();
    prepareGasMaterialLightingAtlasFixture(simulation);
    const at = (x: number, y: number) => simulation.cells()[y * simulation.width + x];
    const { sooty, clean, sootyHole, cleanChannel, sparseSooty, sparseClean, solidContact,
      liquidContact, foreignGasContact, nativeWall, emissiveGas, guardedBlank } = GAS_MATERIAL_LIGHTING_ATLAS;

    expect(at(sooty.probe.x, sooty.probe.y)).toBe(Material.Smoke);
    expect(at(sooty.bounds.x, sooty.bounds.y)).toBe(Material.Empty);
    expect(at(clean.probe.x, clean.probe.y)).toBe(Material.Oxygen);
    expect(at(clean.bounds.x + clean.bounds.width - 1, clean.bounds.y + clean.bounds.height - 1))
      .toBe(Material.Empty);
    expect(at(sootyHole.x, sootyHole.y)).toBe(Material.Empty);
    expect(at(cleanChannel.x, cleanChannel.y)).toBe(Material.Empty);
    expect(at(sparseSooty[0].x, sparseSooty[0].y)).toBe(Material.Smoke);
    expect(at(sparseClean[0].x, sparseClean[0].y)).toBe(Material.Oxygen);
    expect(at(solidContact.probe.x, solidContact.probe.y)).toBe(Material.Smoke);
    expect(at(solidContact.solid.x, solidContact.solid.y)).toBe(Material.Metal);
    expect(at(liquidContact.probe.x, liquidContact.probe.y)).toBe(Material.Oxygen);
    expect(at(liquidContact.liquid.x, liquidContact.liquid.y)).toBe(Material.Water);
    expect(at(foreignGasContact.gasProbe.x, foreignGasContact.gasProbe.y)).toBe(Material.NobleGas);
    expect(at(foreignGasContact.foreignProbe.x, foreignGasContact.foreignProbe.y)).toBe(Material.FOG);
    expect(at(nativeWall.anchor.x, nativeWall.anchor.y)).toBe(Material.Smoke);
    expect(simulation.walls()[nativeWall.anchor.y * simulation.width + nativeWall.anchor.x]).toBe(1);
    expect(at(emissiveGas.probe.x, emissiveGas.probe.y)).toBe(Material.CFLM);
    expect(at(guardedBlank.x, guardedBlank.y)).toBe(Material.Empty);
  });
});
