import { describe, expect, it } from 'vitest';
import { cellStyle } from '../renderer/material-palette';
import { MATERIALS, Material } from './materials';

describe('material catalog', () => {
  it('uses unique stable byte IDs', () => {
    const ids = MATERIALS.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(Array.from({ length: 14 }, (_, index) => index + 1));
    expect(ids.every((id) => id > Material.Empty && id <= 0xFF)).toBe(true);
  });

  it('has a fallback renderer style for every material', () => {
    for (const material of MATERIALS) expect(cellStyle(material.id)).toBeDefined();
  });
});
