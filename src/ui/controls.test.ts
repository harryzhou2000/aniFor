import { describe, expect, it } from 'vitest';
import { MATERIALS, Material } from '../shared/materials';
import { groupMaterials, POWDER_RENDER_STYLE_OPTIONS, sourceRejectionLabel, sourceSelectionLabel, toolCountLabel } from './controls';

describe('material controls', () => {
  it('groups every brush once in a stable, named category', () => {
    const groups = groupMaterials();
    expect(new Set(groups.map(({ id }) => id))).toEqual(new Set(MATERIALS.map(({ category }) => category)));
    expect(groups.every(({ label, description, materials }) => label && description && materials.length > 0)).toBe(true);

    const groupedIds = groups.flatMap(({ materials }) => materials.map(({ id }) => id));
    expect(groupedIds).toHaveLength(MATERIALS.length);
    expect(new Set(groupedIds)).toEqual(new Set(MATERIALS.map(({ id }) => id)));
  });

  it('formats accessible search result counts', () => {
    expect([0, 1, 170].map(toolCountLabel)).toEqual(['0 tools', '1 tool', '170 tools']);
  });

  it('offers the three powder looks in increasing cohesion order', () => {
    expect(POWDER_RENDER_STYLE_OPTIONS).toEqual([
      { style: 'grains', label: 'Grains' },
      { style: 'local', label: 'Local' },
      { style: 'smooth', label: 'Smooth' },
    ]);
  });

  it('describes configured source direction without hiding the target', () => {
    expect(sourceSelectionLabel(Material.PCLN, Material.Water)).toBe('PCLN → Water');
    expect(sourceRejectionLabel(Material.PCLN, Material.PSCN)).toBe('PCLN → PSCN unsupported');
  });

  it('omits empty categories for filtered catalogs', () => {
    const groups = groupMaterials(MATERIALS.filter(({ category }) => category === 'liquids'));
    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe('liquids');
  });
});
