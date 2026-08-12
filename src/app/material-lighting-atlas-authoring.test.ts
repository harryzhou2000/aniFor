import { describe, expect, it } from 'vitest';
import { MATERIAL_LIGHTING_ATLAS_CATALOG } from '../shared/material-lighting-atlas-catalog.js';
import { validateMaterialLightingAtlas } from './material-lighting-atlas-authoring';

const authoring = MATERIAL_LIGHTING_ATLAS_CATALOG.atlases[0];

describe('cross-phase material-lighting atlas authoring', () => {
  it('accepts and deeply freezes the shared descriptor and review anchors', () => {
    expect(() => validateMaterialLightingAtlas(authoring.descriptor, authoring.world)).not.toThrow();
    expect(Object.isFrozen(MATERIAL_LIGHTING_ATLAS_CATALOG)).toBe(true);
    expect(Object.isFrozen(authoring.descriptor.inspectionRegions[0])).toBe(true);
  });

  it('fails closed for escaped geometry, malformed inspection data, and invalid materials', () => {
    expect(() => validateMaterialLightingAtlas({
      ...authoring.descriptor,
      guardedBlank: { x: authoring.world.width - 1, y: 0, width: 2, height: 1 },
    }, authoring.world)).toThrow('guarded blank escapes its world');
    expect(() => validateMaterialLightingAtlas({
      ...authoring.descriptor,
      inspectionRegions: [
        ...authoring.descriptor.inspectionRegions,
        { ...authoring.descriptor.inspectionRegions[0] },
      ],
    }, authoring.world)).toThrow('inspection regions are malformed');
    expect(() => validateMaterialLightingAtlas({
      ...authoring.descriptor,
      materials: { ...authoring.descriptor.materials, oil: 256 },
    }, authoring.world)).toThrow('material oil is malformed');
  });
});
