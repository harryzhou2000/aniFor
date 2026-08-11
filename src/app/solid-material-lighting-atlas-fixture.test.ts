import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  SOLID_MATERIAL_LIGHTING_ATLAS,
  prepareSolidMaterialLightingAtlasFixture,
} from './solid-material-lighting-atlas-fixture';

describe('solid material-lighting atlas fixture', () => {
  it('keeps broad owners, topology controls, contacts, walls, and blanks exact', () => {
    const simulation = new RenderLabBackend();
    prepareSolidMaterialLightingAtlasFixture(simulation);
    const at = (x: number, y: number) => simulation.cells()[y * simulation.width + x];
    const wallAt = (x: number, y: number) => simulation.walls()[y * simulation.width + x];

    expect(SOLID_MATERIAL_LIGHTING_ATLAS.cards.map(({ material }) => material)).toEqual([
      Material.Brick, Material.Metal, Material.Ceramic, Material.Glass,
      Material.Ice, Material.Wood, Material.BTRY, Material.ISZS,
    ]);
    for (const card of SOLID_MATERIAL_LIGHTING_ATLAS.cards) {
      expect(at(card.body.x, card.body.y)).toBe(card.material);
      expect(at(card.hole.x, card.hole.y)).toBe(Material.Empty);
      expect(at(card.openNotch.x, card.openNotch.y)).toBe(Material.Empty);
      expect(at(card.thinStructure.x, card.thinStructure.y)).toBe(card.material);
      expect(at(card.isolated.x, card.isolated.y)).toBe(card.material);
      expect(at(card.unlikeSolidContact.owner.x, card.unlikeSolidContact.owner.y)).toBe(card.material);
      expect(at(card.unlikeSolidContact.neighbour.x, card.unlikeSolidContact.neighbour.y))
        .toBe(card.unlikeSolidContact.neighbourMaterial);
      expect(card.unlikeSolidContact.neighbourMaterial).not.toBe(card.material);
      expect(at(card.nativeWall.anchor.x, card.nativeWall.anchor.y)).toBe(card.material);
      expect(wallAt(card.nativeWall.anchor.x, card.nativeWall.anchor.y)).toBe(1);
      expect(at(card.emitter.x, card.emitter.y)).toBe(Material.Fire);
      expect(at(card.guardedBlank.x, card.guardedBlank.y)).toBe(Material.Empty);
    }
  });
});
