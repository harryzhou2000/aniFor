import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import {
  POWDER_MESOSTRATA_GRAPHICS_ATLAS, POWDER_MESOSTRATA_GRAPHICS_AUDIT,
} from './powder-mesostrata-graphics-audit';

describe('powder mesostrata graphics audit', () => {
  it('covers exactly the proposed settled smooth powder family', () => {
    expect(POWDER_MESOSTRATA_GRAPHICS_ATLAS.map(({ material }) => material))
      .toEqual([Material.Sand, Material.Clay, Material.Concrete]);
    expect(POWDER_MESOSTRATA_GRAPHICS_AUDIT.authoredHoles).toHaveLength(3 * 7 * 7);
    expect(POWDER_MESOSTRATA_GRAPHICS_AUDIT.thinColumns).toHaveLength(3 * 52);
    expect(POWDER_MESOSTRATA_GRAPHICS_AUDIT.unstablePairs).toHaveLength(6);
  });

  it('keeps wall and wet controls separate from stable bodies', () => {
    for (const entry of POWDER_MESOSTRATA_GRAPHICS_ATLAS) {
      expect(entry.wallCoexistence.x % 4).toBe(0);
      expect(entry.wallCoexistence.y % 4).toBe(0);
      expect(entry.wetContact.powder.x + entry.wetContact.powder.width)
        .toBe(entry.wetContact.water.x);
      expect(entry.guardedBlank.width).toBeGreaterThan(0);
    }
  });
});
