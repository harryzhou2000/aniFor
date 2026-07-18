import { describe, expect, it } from 'vitest';
import { cellStyle } from '../renderer/material-palette';
import { ALL_MATERIALS, MATERIALS, Material } from './materials';

describe('material catalog', () => {
  it('uses unique stable byte IDs', () => {
    const ids = ALL_MATERIALS.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(Array.from({ length: 170 }, (_, index) => index + 1));
    expect(ids.every((id) => id > Material.Empty && id <= 0xFF)).toBe(true);
    expect(MATERIALS.map(({ id }) => id)).toEqual(
      Array.from({ length: 170 }, (_, index) => index + 1).filter((id) => ![15, 16, 17, 18, 20].includes(id)),
    );
  });

  it('has a fallback renderer style for every material', () => {
    for (const material of ALL_MATERIALS) expect(cellStyle(material.id)).toBeDefined();
  });

  it('keeps native reaction products out of the selectable brush catalog', () => {
    expect([
      Material.Steam,
      Material.SaltWater,
      Material.Gas,
      Material.Snow,
      Material.Plasma,
    ]).toEqual([15, 16, 17, 18, 20]);
    const selectable = new Set(MATERIALS.map(({ id }) => id));
    for (const id of [15, 16, 17, 18, 20]) expect(selectable.has(id)).toBe(false);
    expect(selectable.has(Material.Coal)).toBe(true);
  });

  it('flags native limitations instead of silently exposing unavailable physics', () => {
    for (const id of [Material.GRVT, Material.GBMB, Material.NBHL, Material.NWHL, Material.GPMP]) {
      const material = ALL_MATERIALS.find((entry) => entry.id === id)!;
      expect(material.available).toBe(false);
      expect(material.limitations).toContain('newtonian-gravity-unavailable');
    }
    expect(ALL_MATERIALS.find(({ id }) => id === Material.WHOL)?.limitations).toContain('air-velocity-limited');
  });
});
