import { describe, expect, it } from 'vitest';
import { OPPOSED_SOURCE_MATERIAL_LIGHTING_ATLAS_CATALOG } from '../shared/opposed-source-material-lighting-atlas-catalog.js';
import {
  createPowderLightVfxAuditSnapshot,
  validateOpposedSourceMaterialLightingAtlas,
} from './opposed-source-material-lighting-atlas-authoring';

const authoring = OPPOSED_SOURCE_MATERIAL_LIGHTING_ATLAS_CATALOG.atlases[0];

describe('opposed-source material-lighting atlas authoring', () => {
  it('validates frozen data and derives the exact ordered Sand weave', () => {
    expect(() => validateOpposedSourceMaterialLightingAtlas(
      authoring.descriptor, authoring.world,
    )).not.toThrow();
    const snapshot = createPowderLightVfxAuditSnapshot(authoring.descriptor, authoring.world);
    expect(snapshot.wetSuspension.sandPoints).toHaveLength(2_024);
    expect(snapshot.wetSuspension.sandPoints.slice(0, 4)).toEqual([
      { x: 84, y: 244 }, { x: 85, y: 244 }, { x: 87, y: 244 }, { x: 88, y: 244 },
    ]);
    expect(Object.isFrozen(OPPOSED_SOURCE_MATERIAL_LIGHTING_ATLAS_CATALOG)).toBe(true);
    expect(Object.isFrozen(snapshot.wetSuspension.sandPoints[0])).toBe(true);
  });

  it('fails closed for noncanonical worlds, escaped geometry, materials, weave, and regions', () => {
    expect(() => validateOpposedSourceMaterialLightingAtlas(
      authoring.descriptor, { width: 611, height: 384 },
    )).toThrow('world must be 612x384');
    expect(() => validateOpposedSourceMaterialLightingAtlas({
      ...authoring.descriptor,
      wallFreeControl: { x: 611, y: 0, width: 2, height: 1 },
    }, authoring.world)).toThrow('wall-free control escapes its world');
    expect(() => validateOpposedSourceMaterialLightingAtlas({
      ...authoring.descriptor,
      materials: { ...authoring.descriptor.materials, clay: 256 },
    }, authoring.world)).toThrow('material clay is malformed');
    expect(() => validateOpposedSourceMaterialLightingAtlas({
      ...authoring.descriptor,
      cards: [authoring.descriptor.cards[0], authoring.descriptor.cards[0], authoring.descriptor.cards[2]],
    }, authoring.world)).toThrow('cards are malformed');
    expect(() => validateOpposedSourceMaterialLightingAtlas({
      ...authoring.descriptor,
      wetSuspension: {
        ...authoring.descriptor.wetSuspension,
        sandWeave: { period: 3, sandResidues: [0, 0] },
      },
    }, authoring.world)).toThrow('Sand weave is malformed');
    expect(() => validateOpposedSourceMaterialLightingAtlas({
      ...authoring.descriptor,
      inspectionRegions: [
        ...authoring.descriptor.inspectionRegions,
        { ...authoring.descriptor.inspectionRegions[0] },
      ],
    }, authoring.world)).toThrow('inspection regions are malformed');
  });
});
