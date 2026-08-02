import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import {
  GEOLOGICAL_SOLID_GRAPHICS_ATLAS, GEOLOGICAL_SOLID_GRAPHICS_AUDIT,
} from './geological-solid-graphics-audit';

describe('geological solid graphics audit', () => {
  it('covers exactly Coal and ROCK with deep-core probes', () => {
    expect(GEOLOGICAL_SOLID_GRAPHICS_ATLAS.map(({ material }) => material))
      .toEqual([Material.Coal, Material.ROCK]);
    expect(GEOLOGICAL_SOLID_GRAPHICS_AUDIT.authoredHoles).toHaveLength(2 * 8 * 8);
    expect(GEOLOGICAL_SOLID_GRAPHICS_AUDIT.thinColumns).toHaveLength(2 * 76);
  });

  it('keeps exact topology, wall, and liquid-contact controls separate', () => {
    for (const entry of GEOLOGICAL_SOLID_GRAPHICS_ATLAS) {
      expect(entry.wallCoexistence.x % 4).toBe(0);
      expect(entry.wallCoexistence.y % 4).toBe(0);
      expect(entry.contact.solid.x + entry.contact.solid.width).toBe(entry.contact.water.x);
      expect(entry.guardedBlank.width).toBeGreaterThan(0);
    }
  });
});
