import { describe, expect, it } from 'vitest';
import { POWDER_STYLE_ATLAS_CATALOG } from '../shared/powder-style-atlas-catalog.js';
import { validatePowderStyleAtlas } from './powder-style-atlas-authoring';

const authoring = POWDER_STYLE_ATLAS_CATALOG.atlases[0];

describe('powder-style atlas authoring', () => {
  it('accepts the frozen descriptor and preserves the exact pile geometry', () => {
    expect(() => validatePowderStyleAtlas(authoring.descriptor, authoring.world)).not.toThrow();
    expect(authoring.descriptor.bulk.sandPile).toEqual({
      left: 24, right: 246, peakX: 122, peakY: 116, baseY: 304,
    });
    expect(authoring.descriptor.bulk.clayPile).toEqual({
      left: 224, right: 394, peakX: 311, peakY: 166, baseY: 304,
    });
    expect(Object.isFrozen(POWDER_STYLE_ATLAS_CATALOG)).toBe(true);
    expect(Object.isFrozen(authoring.descriptor.inspectionRegions[0])).toBe(true);
  });

  it('fails closed for malformed piles, materials, wall IDs, and review anchors', () => {
    expect(() => validatePowderStyleAtlas({
      ...authoring.descriptor,
      bulk: { ...authoring.descriptor.bulk, sandPile: { ...authoring.descriptor.bulk.sandPile, peakX: 5 } },
    }, authoring.world)).toThrow('Sand pile is malformed');
    expect(() => validatePowderStyleAtlas({
      ...authoring.descriptor,
      materials: { ...authoring.descriptor.materials, clay: 256 },
    }, authoring.world)).toThrow('material clay is malformed');
    expect(() => validatePowderStyleAtlas({
      ...authoring.descriptor, conductiveWall: 0,
    }, authoring.world)).toThrow('conductive wall is malformed');
    expect(() => validatePowderStyleAtlas({
      ...authoring.descriptor,
      inspectionRegions: [
        ...authoring.descriptor.inspectionRegions,
        { ...authoring.descriptor.inspectionRegions[0] },
      ],
    }, authoring.world)).toThrow('inspection regions are malformed');
    expect(() => validatePowderStyleAtlas(authoring.descriptor, { width: 160, height: 100 }))
      .toThrow('world must be 612x384');
  });
});
