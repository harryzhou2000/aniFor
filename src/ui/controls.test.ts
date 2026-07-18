import { describe, expect, it } from 'vitest';
import { MATERIALS } from '../shared/materials';
import { groupMaterials } from './controls';

describe('material controls', () => {
  it('groups every brush once in a stable, named category', () => {
    const groups = groupMaterials();
    expect(groups.map(({ id }) => id)).toEqual(['powders', 'liquids', 'solids', 'gases', 'energy', 'explosives']);
    expect(groups.every(({ label, description, materials }) => label && description && materials.length > 0)).toBe(true);

    const groupedIds = groups.flatMap(({ materials }) => materials.map(({ id }) => id));
    expect(groupedIds).toHaveLength(MATERIALS.length);
    expect(new Set(groupedIds)).toEqual(new Set(MATERIALS.map(({ id }) => id)));
  });

  it('omits empty categories for filtered catalogs', () => {
    const groups = groupMaterials(MATERIALS.filter(({ category }) => category === 'liquids'));
    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe('liquids');
  });
});
