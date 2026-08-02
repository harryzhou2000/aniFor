import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import {
  THERMAL_CATALYTIC_RIGID_GRAPHICS_ATLAS,
  THERMAL_CATALYTIC_RIGID_GRAPHICS_AUDIT,
} from './thermal-catalytic-rigid-graphics-audit';

describe('thermal/catalytic rigid graphics audit', () => {
  it('covers the exact three native owners with deep-core probes', () => {
    expect(THERMAL_CATALYTIC_RIGID_GRAPHICS_ATLAS.map(({ material }) => material))
      .toEqual([Material.HEAC, Material.PTNM, Material.RSSS]);
    expect(THERMAL_CATALYTIC_RIGID_GRAPHICS_AUDIT.authoredHoles).toHaveLength(3 * 8 * 8);
    expect(THERMAL_CATALYTIC_RIGID_GRAPHICS_AUDIT.thinColumns).toHaveLength(3 * 76);
  });

  it('keeps exact topology, native-wall, and liquid-contact controls separate', () => {
    for (const entry of THERMAL_CATALYTIC_RIGID_GRAPHICS_ATLAS) {
      expect(entry.wallCoexistence.x % 4).toBe(0);
      expect(entry.wallCoexistence.y % 4).toBe(0);
      expect(entry.contact.solid.x + entry.contact.solid.width).toBe(entry.contact.water.x);
      expect(entry.guardedBlank.width).toBeGreaterThan(0);
      expect(entry.card.x + entry.card.width).toBeLessThanOrEqual(612);
    }
  });
});
