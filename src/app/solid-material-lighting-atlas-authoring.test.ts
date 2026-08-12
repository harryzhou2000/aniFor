import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import {
  SOLID_MATERIAL_LIGHTING_ATLAS_CATALOG,
} from '../shared/solid-material-lighting-atlas-catalog.js';
import {
  createSolidMaterialLightingAtlas,
  type SolidMaterialLightingAtlasDescriptor,
} from './solid-material-lighting-atlas-authoring';

const descriptor = (): SolidMaterialLightingAtlasDescriptor => ({
  definitions: [{ material: Material.Metal, code: 'METL' }],
  columns: 1,
  origin: { x: 0, y: 0 },
  stride: { x: 20, y: 20 },
  cardSize: { width: 20, height: 20 },
  conductiveWall: 1,
  template: {
    body: { x: 1, y: 1, width: 8, height: 8 },
    hole: { x: 3, y: 3, width: 2, height: 2 },
    openNotch: { x: 8, y: 5, width: 1, height: 2 },
    thinStructure: { x: 10, y: 1, width: 1, height: 8 },
    isolated: { x: 12, y: 12 },
    contactOwner: { x: 1, y: 16, width: 2, height: 2 },
    contactNeighbour: { x: 3, y: 16, width: 2, height: 2 },
    nativeWall: { x: 14, y: 1, width: 2, height: 2 },
    emitter: { x: 12, y: 1, width: 1, height: 5 },
    guardedBlank: { x: 7, y: 15, width: 5, height: 2 },
  },
});

describe('solid material-lighting atlas authoring', () => {
  it('deeply freezes catalog-owned inspection regions', () => {
    for (const atlas of SOLID_MATERIAL_LIGHTING_ATLAS_CATALOG.atlases) {
      expect(Object.isFrozen(atlas.descriptor.inspectionRegions[0])).toBe(true);
    }
  });

  it('fails closed for duplicate owners and template geometry outside a card', () => {
    const duplicate = descriptor();
    expect(() => createSolidMaterialLightingAtlas({
      ...duplicate,
      definitions: [...duplicate.definitions, ...duplicate.definitions],
    })).toThrow('definitions must be unique');

    const escaped = descriptor();
    expect(() => createSolidMaterialLightingAtlas({
      ...escaped,
      template: { ...escaped.template, guardedBlank: { x: 19, y: 19, width: 2, height: 2 } },
    })).toThrow('template guardedBlank escapes its card');
  });

  it('fails closed for material owners outside the byte-sized particle domain', () => {
    for (const material of [Material.Empty, 256, 1.5]) {
      const invalid = descriptor();
      expect(() => createSolidMaterialLightingAtlas({
        ...invalid,
        definitions: [{ material, code: 'BAD' }],
      })).toThrow('materials must be byte-sized owners');
    }
  });
});
