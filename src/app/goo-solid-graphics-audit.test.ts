import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { GOO_SOLID_GRAPHICS_AUDIT } from './goo-solid-graphics-audit';

describe('GOO solid graphics audit fixture', () => {
  it('pins one exact native pressure-reactive solid owner and deep-body probes', () => {
    expect(GOO_SOLID_GRAPHICS_AUDIT.material).toBe(Material.GOO);
    expect(GOO_SOLID_GRAPHICS_AUDIT.code).toBe('GOO');
    expect(GOO_SOLID_GRAPHICS_AUDIT.coreProbe.width).toBe(16);
    expect(GOO_SOLID_GRAPHICS_AUDIT.coreProbe.height).toBe(16);
    expect(GOO_SOLID_GRAPHICS_AUDIT.authoredHole.width).toBe(8);
    expect(GOO_SOLID_GRAPHICS_AUDIT.authoredHole.height).toBe(8);
  });

  it('keeps topology, native wall, and foreign-phase controls disjoint', () => {
    const fixture = GOO_SOLID_GRAPHICS_AUDIT;
    expect(fixture.wallCoexistence.x % 4).toBe(0);
    expect(fixture.wallCoexistence.y % 4).toBe(0);
    expect(fixture.contacts.goo.x + fixture.contacts.goo.width).toBe(fixture.contacts.water.x);
    expect(fixture.contacts.water.x + fixture.contacts.water.width).toBe(fixture.contacts.metal.x);
    expect(fixture.guardedBlank.width).toBeGreaterThan(0);
    expect(fixture.card.x + fixture.card.width).toBeLessThanOrEqual(612);
  });
});
