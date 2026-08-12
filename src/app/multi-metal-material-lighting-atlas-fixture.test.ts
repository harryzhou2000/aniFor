import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  MULTI_METAL_MATERIAL_LIGHTING_ATLAS,
  prepareMultiMetalMaterialLightingAtlasFixture,
} from './multi-metal-material-lighting-atlas-fixture';

describe('multi-metal material-lighting atlas fixture', () => {
  it('covers the exact MetallicRigid family with broad and topology controls', () => {
    const simulation = new RenderLabBackend();
    prepareMultiMetalMaterialLightingAtlasFixture(simulation);
    const at = (x: number, y: number) => simulation.cells()[y * simulation.width + x];
    const wallAt = (x: number, y: number) => simulation.walls()[y * simulation.width + x];

    expect(MULTI_METAL_MATERIAL_LIGHTING_ATLAS.cards.map(({ material }) => material)).toEqual([
      Material.Metal, Material.BMTL, Material.GOLD,
      Material.IRON, Material.PTNM, Material.TTAN,
    ]);
    expect(MULTI_METAL_MATERIAL_LIGHTING_ATLAS.cards.map(({ material }) => material))
      .not.toContain(Material.HEAC);
    expect(MULTI_METAL_MATERIAL_LIGHTING_ATLAS.cards.map(({ material }) => material))
      .not.toContain(Material.TUNG);
    for (const card of MULTI_METAL_MATERIAL_LIGHTING_ATLAS.cards) {
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
      expect(card.emitter.x - (card.body.x + card.body.width)).toBe(4);
      expect(at(card.guardedBlank.x, card.guardedBlank.y)).toBe(Material.Empty);
    }
  });
});
