import { describe, expect, it } from 'vitest';
import { cellStyle } from '../renderer/material-palette';
import { ALL_MATERIALS, MATERIALS, Material } from './materials';

describe('material catalog', () => {
  it('uses unique stable byte IDs', () => {
    const ids = ALL_MATERIALS.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(Array.from({ length: 42 }, (_, index) => index + 1));
    expect(ids.every((id) => id > Material.Empty && id <= 0xFF)).toBe(true);
    expect(MATERIALS.map(({ id }) => id)).toEqual([
      ...Array.from({ length: 14 }, (_, index) => index + 1),
      ...Array.from({ length: 22 }, (_, index) => index + 21),
    ]);
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
      Material.Coal,
      Material.Plasma,
    ]).toEqual([15, 16, 17, 18, 19, 20]);
    const selectable = new Set(MATERIALS.map(({ id }) => id));
    for (let id = Material.Steam; id <= Material.Plasma; id++) expect(selectable.has(id)).toBe(false);
  });
});
