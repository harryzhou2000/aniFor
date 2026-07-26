import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MATERIALS, Material } from '../shared/materials';
import { groupMaterials, POWDER_RENDER_STYLE_OPTIONS, reconcileOpenToolGroups, RENDER_SCALE_OPTIONS, sourceRejectionLabel, sourceSelectionLabel, toolCountLabel } from './controls';

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

  it('offers every supported per-cell render resolution, including true 8x', () => {
    expect(RENDER_SCALE_OPTIONS).toEqual([1, 2, 4, 8]);
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

  it('keeps the chosen category open when selecting a tool rebuilds the library', () => {
    const open = reconcileOpenToolGroups(new Set(['electronics']), [
      { id: 'powders', open: false },
      { id: 'electronics', open: true },
    ]);

    expect(open).toEqual(new Set(['electronics']));
    expect(open.has('powders')).toBe(false);
  });

  it('updates a non-powder selection in place without rebuilding the catalog', () => {
    // The full browser audit drives an Electronics tile, verifies the exact
    // disclosure and scroll position, and catches layout/browser behaviour.
    // Keep this focused unit guard dependency-free: selection must only update
    // existing button state, never replace the library that owns disclosure and
    // scroll state.
    const source = readFileSync(new URL('./controls.ts', import.meta.url), 'utf8');
    const clickStart = source.indexOf("button.addEventListener('click', () => {");
    const clickEnd = source.indexOf('\n\n    const favorite', clickStart);
    const selectionHandler = source.slice(clickStart, clickEnd);
    const syncStart = source.indexOf('const syncSelectedTool = (): void => {');
    const syncEnd = source.indexOf('\n\n  const filterChoices', syncStart);
    const syncSelectedTool = source.slice(syncStart, syncEnd);

    expect(selectionHandler).toContain('selectedKey = tool.key;');
    expect(selectionHandler).toContain('callbacks.onMaterial(tool.id);');
    expect(selectionHandler).toContain('syncSelectedTool();');
    expect(selectionHandler).not.toContain('renderLibrary();');
    expect(syncSelectedTool).toContain("library.querySelectorAll<HTMLElement>('.tool-tile')");
    expect(syncSelectedTool).not.toMatch(/replaceChildren|scrollTop|\.open\s*=/);
  });
});
