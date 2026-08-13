import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  RENDER_OPTICS_MATERIAL_LIGHTING_ATLAS,
  RENDER_OPTICS_MATERIAL_LIGHTING_ATLAS_WORLD,
  prepareRenderOpticsMaterialLightingAtlasFixture,
} from './render-optics-material-lighting-atlas-fixture';

describe('RenderOptics material-lighting atlas fixture', () => {
  it('direct-fills a paused representative atlas with phase/class bodies and semantic controls', () => {
    const simulation = new RenderLabBackend(
      RENDER_OPTICS_MATERIAL_LIGHTING_ATLAS_WORLD.width,
      RENDER_OPTICS_MATERIAL_LIGHTING_ATLAS_WORLD.height,
    );
    prepareRenderOpticsMaterialLightingAtlasFixture(simulation);
    const at = (x: number, y: number) => simulation.cells()[y * simulation.width + x];
    const card = (key: string) => {
      const result = RENDER_OPTICS_MATERIAL_LIGHTING_ATLAS.cards.find((entry) => entry.key === key);
      if (!result) throw new Error(`missing ${key} RenderOptics card`);
      return result;
    };

    expect(at(card('sand').core.x, card('sand').core.y)).toBe(Material.Sand);
    expect(at(card('salt').core.x, card('salt').core.y)).toBe(Material.Salt);
    expect(at(card('water').core.x, card('water').core.y)).toBe(Material.Water);
    expect(at(card('oil').core.x, card('oil').core.y)).toBe(Material.Oil);
    expect(at(card('smoke').core.x, card('smoke').core.y)).toBe(Material.Smoke);
    expect(at(card('oxygen').core.x, card('oxygen').core.y)).toBe(Material.Oxygen);
    expect(at(card('metal').core.x, card('metal').core.y)).toBe(Material.Metal);
    expect(at(card('wax').core.x, card('wax').core.y)).toBe(Material.Wax);

    for (const entry of RENDER_OPTICS_MATERIAL_LIGHTING_ATLAS.cards) {
      expect(at(entry.cavity.x, entry.cavity.y)).toBe(Material.Empty);
      expect(at(entry.openNotch.x, entry.openNotch.y)).toBe(Material.Empty);
      expect(at(entry.isolated.x, entry.isolated.y)).toBe(entry.material);
      expect(at(entry.emitter.x, entry.emitter.y)).toBe(Material.Fire);
    }

    for (const contact of RENDER_OPTICS_MATERIAL_LIGHTING_ATLAS.contacts) {
      expect(at(contact.owner.x, contact.owner.y)).toBe(contact.ownerMaterial);
      expect(at(contact.neighbour.x, contact.neighbour.y)).toBe(contact.neighbourMaterial);
    }
    const { nativeWall, guardedBlank } = RENDER_OPTICS_MATERIAL_LIGHTING_ATLAS;
    expect(simulation.walls()[nativeWall.anchor.y * simulation.width + nativeWall.anchor.x]).toBe(1);
    expect(at(guardedBlank.x, guardedBlank.y)).toBe(Material.Empty);
  });

  it('declares every representative body/core and the bounded review controls', () => {
    const { cards, inspectionRegions } = RENDER_OPTICS_MATERIAL_LIGHTING_ATLAS;
    expect(inspectionRegions.map(({ name }) => name)).toEqual([
      ...cards.flatMap(({ key }) => [`${key}-body`, `${key}-core`]),
      'powder-fine-control',
      'liquid-fine-control',
      'gas-fine-control',
      'solid-fine-control',
      'wax-mwax-contact',
      'glass-metal-contact',
      'native-wall',
      'guarded-blank',
      'solid-cavity-control',
    ]);
  });
});
