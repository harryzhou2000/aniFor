import { describe, expect, it } from 'vitest';
import { MATERIALS, Material } from '../shared/materials';
import { buildToolCatalog, filterTools, isToolAvailable, materialTools, recordRecent, semanticTools, type WallToolInfo } from './tool-catalog';

describe('tool catalog view model', () => {
  const tools = materialTools(MATERIALS);

  it('adapts every selectable material to a stable element key', () => {
    expect(tools).toHaveLength(MATERIALS.length);
    expect(new Set(tools.map(({ key }) => key)).size).toBe(tools.length);
    expect(tools.every(({ kind, key }) => kind === 'element' && key.startsWith('material:'))).toBe(true);
    expect(tools.find(({ id }) => id === Material.Wall)?.kind).toBe('element');
  });

  it('searches names, descriptions, categories, hazards, and limitations', () => {
    const filtered = filterTools(tools, { mode: 'all', query: 'explosive', favorites: new Set(), recent: [] });
    expect(filtered.some((tool) => tool.kind === 'element' && tool.id === Material.Gunpowder)).toBe(true);
    expect(filterTools(tools, { mode: 'all', query: 'does-not-exist', favorites: new Set(), recent: [] })).toEqual([]);
    const annotated = [{ ...tools[0], hazard: 'danger' as const, limitations: ['air-velocity-limited'] }];
    expect(filterTools(annotated, { mode: 'all', query: 'danger', favorites: new Set(), recent: [] })).toHaveLength(1);
    expect(filterTools(annotated, { mode: 'all', query: 'air-velocity', favorites: new Set(), recent: [] })).toHaveLength(1);
    expect(isToolAvailable({ ...tools[0], available: false })).toBe(false);
    expect(isToolAvailable(tools[0])).toBe(true);
  });

  it('keeps true walls distinct from particle elements', () => {
    const wall: WallToolInfo = { key: 'wall:solid', kind: 'wall', nativeWall: 1, name: 'Solid wall', description: 'Blocks particles', color: '#888', icon: '■', category: 'walls' };
    expect(filterTools([...tools, wall], { mode: 'wall', query: '', favorites: new Set(), recent: [] })).toEqual([wall]);
    const catalog = buildToolCatalog(MATERIALS, { walls: true });
    const nativeWalls = catalog.filter((tool) => tool.kind === 'wall');
    expect(nativeWalls.length).toBeGreaterThanOrEqual(10);
    expect(nativeWalls.every(isToolAvailable)).toBe(true);
    expect(catalog.find((tool) => tool.kind === 'element' && tool.id === Material.Wall)?.name).toBe('Diamond');
  });

  it('exposes unsupported semantics as distinct disabled tools instead of particles', () => {
    const semantic = semanticTools();
    expect(new Set(semantic.map(({ kind }) => kind))).toEqual(new Set(['wall', 'source', 'sign', 'force', 'thermal']));
    expect(semantic.every((tool) => !isToolAvailable(tool))).toBe(true);
    expect(semantic.every((tool) => tool.limitations?.length)).toBe(true);
  });

  it('filters favorites and preserves recent-use order', () => {
    const keys = tools.slice(0, 3).map(({ key }) => key);
    expect(filterTools(tools, { mode: 'favorites', query: '', favorites: new Set([keys[1]]), recent: [] }).map(({ key }) => key)).toEqual([keys[1]]);
    expect(filterTools(tools, { mode: 'recent', query: '', favorites: new Set(), recent: [keys[2], keys[0]] }).map(({ key }) => key)).toEqual([keys[2], keys[0]]);
  });

  it('deduplicates and bounds recent selections', () => {
    expect(recordRecent(['b', 'a', 'c'], 'a', 3)).toEqual(['a', 'b', 'c']);
    expect(recordRecent(['a', 'b', 'c'], 'd', 3)).toEqual(['d', 'a', 'b']);
  });
});
