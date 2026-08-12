import { describe, expect, it } from 'vitest';
import {
  GAS_MATERIAL_LIGHTING_ATLAS_CATALOG,
} from '../shared/gas-material-lighting-atlas-catalog.js';
import { validateGasMaterialLightingAtlas } from './gas-material-lighting-atlas-authoring';

const authoring = GAS_MATERIAL_LIGHTING_ATLAS_CATALOG.atlases[0];

describe('gas material-lighting atlas authoring', () => {
  it('accepts and deeply freezes the shared data-only catalog', () => {
    expect(() => validateGasMaterialLightingAtlas(authoring.descriptor, authoring.world)).not.toThrow();
    expect(Object.isFrozen(GAS_MATERIAL_LIGHTING_ATLAS_CATALOG)).toBe(true);
    expect(Object.isFrozen(authoring.descriptor.sooty.lobes[0])).toBe(true);
  });

  it('fails closed for escaped geometry, invalid lobes, and invalid material owners', () => {
    expect(() => validateGasMaterialLightingAtlas({
      ...authoring.descriptor,
      guardedBlank: { x: authoring.world.width - 1, y: 0, width: 2, height: 1 },
    }, authoring.world)).toThrow('guarded blank escapes its world');
    expect(() => validateGasMaterialLightingAtlas({
      ...authoring.descriptor,
      sooty: {
        ...authoring.descriptor.sooty,
        lobes: [{ ...authoring.descriptor.sooty.lobes[0], radiusX: 0 }],
      },
    }, authoring.world)).toThrow('sooty lobe 0 is malformed');
    expect(() => validateGasMaterialLightingAtlas({
      ...authoring.descriptor,
      materials: { ...authoring.descriptor.materials, clean: 256 },
    }, authoring.world)).toThrow('material clean is malformed');
  });
});
