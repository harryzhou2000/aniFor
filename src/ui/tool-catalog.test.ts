import { describe, expect, it } from 'vitest';
import { BROWSE_MATERIALS, LIFE_PRESETS, MATERIALS, Material, NATIVE_PROJECTIONS } from '../shared/materials';
import { buildToolCatalog, filterTools, isToolAvailable, materialTools, recordRecent, semanticTools, type WallToolInfo } from './tool-catalog';

describe('tool catalog view model', () => {
  const tools = materialTools(MATERIALS);

  it('adapts every selectable material to a stable element key', () => {
    expect(tools).toHaveLength(MATERIALS.length);
    expect(new Set(tools.map(({ key }) => key)).size).toBe(tools.length);
    expect(tools.every(({ kind, key }) => kind === 'element' && key.startsWith('material:'))).toBe(true);
    expect(tools.find(({ id }) => id === Material.Wall)?.kind).toBe('element');
  });

  it('keeps native reaction and lifecycle products discoverable but brush-inert', () => {
    const browseTools = materialTools(BROWSE_MATERIALS);
    const products = browseTools.filter(({ id }) => NATIVE_PROJECTIONS.some((product) => product.id === id));

    expect(products).toHaveLength(NATIVE_PROJECTIONS.length);
    expect(products.map(({ id }) => id)).toEqual(NATIVE_PROJECTIONS.map(({ id }) => id));
    expect(products.every((tool) => !isToolAvailable(tool))).toBe(true);
    expect(products.every((tool) => tool.limitations?.includes('native-product-only'))).toBe(true);
    expect(filterTools(browseTools, {
      mode: 'all', query: 'native-product-only', favorites: new Set(), recent: [],
    })).toHaveLength(NATIVE_PROJECTIONS.length);
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
    const availableNativeWalls = nativeWalls.filter(isToolAvailable);
    expect(availableNativeWalls.map(({ nativeWall }) => nativeWall)).toEqual([
      8, 1, 2, 3, 4, 6, 7, 9, 10, 11, 12, 13, 15, 16, 18,
    ]);
    expect(availableNativeWalls).toHaveLength(15);
    expect(nativeWalls.filter((tool) => !isToolAvailable(tool))).toMatchObject([
      {
        key: 'wall:5', nativeWall: 5, name: 'Fan wall', available: false,
        limitations: ['native-fan-wall-configuration-unavailable'],
      },
      {
        key: 'wall:14', nativeWall: 14, name: 'Gravity wall', available: false,
        limitations: ['native-newtonian-gravity-unavailable'],
      },
    ]);
    const withFan = buildToolCatalog(MATERIALS, { walls: true, fanWalls: true });
    expect(withFan.find((tool) => tool.key === 'wall:5')).toMatchObject({
      kind: 'wall', nativeWall: 5, available: true,
    });
    expect(withFan.find((tool) => tool.key === 'wall:14')).toMatchObject({
      kind: 'wall', nativeWall: 14, available: false,
      limitations: ['native-newtonian-gravity-unavailable'],
    });
    const withGravity = buildToolCatalog(MATERIALS, { walls: true, newtonianGravity: true });
    expect(withGravity.find((tool) => tool.key === 'wall:14')).toMatchObject({
      kind: 'wall', nativeWall: 14, available: true,
    });
    for (const id of [Material.GRVT, Material.GBMB, Material.NBHL, Material.NWHL, Material.GPMP]) {
      expect(withGravity.find((tool) => tool.kind === 'element' && tool.id === id)).toMatchObject({
        available: true, limitations: undefined,
      });
    }
    expect(catalog.find((tool) => tool.kind === 'element' && tool.id === Material.Wall)?.name).toBe('Diamond');
  });

  it('keeps priority element families visible beside their semantic tools', () => {
    const catalog = buildToolCatalog(MATERIALS, { simulationTools: true, lifePresets: true });
    const state = { query: '', favorites: new Set<string>(), recent: [] as string[] };
    const forces = filterTools(catalog, { ...state, mode: 'force' });
    expect(forces.some((tool) => tool.kind === 'force' && tool.key === 'tool:wind')).toBe(true);
    expect(forces.some((tool) => tool.kind === 'element' && tool.id === Material.FRAY)).toBe(true);
    for (const id of [
      Material.ACEL, Material.DCEL, Material.DMG, Material.FRAY, Material.GBMB,
      Material.PSTN, Material.RPEL, Material.BHOL, Material.NBHL, Material.NWHL,
      Material.WHOL, Material.GPMP, Material.PUMP, Material.GRVT, Material.SING,
    ]) expect(forces.some((tool) => tool.kind === 'element' && tool.id === id)).toBe(true);
    expect(forces.some((tool) => tool.kind === 'element' && tool.id === Material.FRME)).toBe(true);
    expect(forces.some((tool) => tool.kind === 'element' && tool.id === Material.PIPE)).toBe(true);
    expect(MATERIALS.filter(({ category }) => category === 'force').every(({ id }) => (
      forces.some((tool) => tool.kind === 'element' && tool.id === id)
    ))).toBe(true);

    const life = filterTools(catalog, { ...state, mode: 'life' });
    expect(life).toHaveLength(LIFE_PRESETS.length + 5);
    expect(life.some((tool) => tool.kind === 'life' && tool.preset === 0)).toBe(true);
    expect(life.some((tool) => tool.kind === 'element' && tool.id === Material.Plant)).toBe(true);

    const radioactive = filterTools(catalog, { ...state, mode: 'radioactive' });
    expect(radioactive).toHaveLength(MATERIALS.filter(({ category }) => category === 'radioactive').length);
    expect(radioactive.every((tool) => tool.kind === 'element' && tool.category === 'radioactive')).toBe(true);
  });

  it('keeps the complete capable catalog uniquely visible across every semantic family', () => {
    const catalog = buildToolCatalog(MATERIALS, {
      walls: true,
      fanWalls: true,
      simulationTools: true,
      configuredSources: true,
      lifePresets: true,
      signs: true,
    });
    const state = { query: '', favorites: new Set<string>(), recent: [] as string[] };
    const visible = filterTools(catalog, { ...state, mode: 'all' });

    expect(catalog).toHaveLength(224);
    expect(visible).toHaveLength(catalog.length);
    expect(new Set(catalog.map(({ key }) => key)).size).toBe(catalog.length);
    expect(new Set(catalog.filter((tool) => tool.kind === 'element').map(({ id }) => id)))
      .toEqual(new Set(MATERIALS.map(({ id }) => id)));
    expect(new Set(catalog.map(({ category }) => category))).toEqual(new Set([
      'powders', 'liquids', 'solids', 'energy', 'gases', 'life', 'explosives',
      'radioactive', 'force', 'special', 'electronics', 'powered', 'sensors',
      'walls', 'sources', 'automata', 'signs', 'simulation-forces', 'thermal-tools',
    ]));

    const semantic = catalog.filter((tool) => tool.kind !== 'element');
    expect(semantic).toHaveLength(53);
    expect(semantic.filter(isToolAvailable)).toHaveLength(52);
    expect(semantic.filter((tool) => tool.kind === 'wall')).toHaveLength(17);
    expect(semantic.filter((tool) => tool.kind === 'wall' && isToolAvailable(tool))).toHaveLength(16);
    expect(semantic.filter((tool) => tool.kind === 'source')).toHaveLength(6);
    expect(semantic.filter((tool) => tool.kind === 'life')).toHaveLength(LIFE_PRESETS.length);
    expect(semantic.filter((tool) => tool.kind === 'sign')).toHaveLength(1);
    expect(semantic.filter((tool) => tool.kind === 'force')).toHaveLength(3);
    expect(semantic.filter((tool) => tool.kind === 'thermal')).toHaveLength(2);
  });

  it('exposes unsupported semantics as distinct disabled tools instead of particles', () => {
    const semantic = semanticTools();
    expect(new Set(semantic.map(({ kind }) => kind))).toEqual(new Set(['wall', 'source', 'life', 'sign', 'force', 'thermal']));
    expect(semantic.every((tool) => !isToolAvailable(tool))).toBe(true);
    expect(semantic.every((tool) => tool.limitations?.length)).toBe(true);
  });

  it('enables native simulation tools independently from sources and signs', () => {
    const semantic = semanticTools({ simulationTools: true });
    const simulationTools = semantic.filter((tool) => tool.kind === 'force' || tool.kind === 'thermal');
    expect(simulationTools.map(({ key }) => key)).toEqual([
      'tool:air', 'tool:vacuum', 'tool:wind', 'tool:heat', 'tool:cool',
    ]);
    expect(simulationTools.every(isToolAvailable)).toBe(true);
    expect(semantic.find((tool) => tool.kind === 'source')?.available).toBe(false);
    expect(semantic.find((tool) => tool.kind === 'sign')?.available).toBe(false);
  });

  it('enables the native sign editor only behind its dedicated capability', () => {
    const sign = semanticTools({ signs: true }).find((tool) => tool.kind === 'sign');
    expect(sign).toMatchObject({ key: 'sign:place', maximumLength: 45, available: true });
    expect(isToolAvailable(sign!)).toBe(true);
    expect(semanticTools({ signs: true }).find((tool) => tool.kind === 'wall')?.available).toBe(false);
  });

  it('exposes every configured source behind the configured-source capability', () => {
    const disabled = semanticTools().filter((tool) => tool.kind === 'source');
    expect(disabled.map(({ key }) => key)).toEqual([
      'source:clne', 'source:bcln', 'source:pcln', 'source:pbcn', 'source:conv',
      'source:cray',
    ]);
    expect(disabled.map(({ emitter }) => emitter)).toEqual([
      Material.CLNE, Material.BCLN, Material.PCLN, Material.PBCN, Material.CONV,
      Material.CRAY,
    ]);
    expect(disabled.every((tool) => tool.requiresTarget && !isToolAvailable(tool))).toBe(true);
    expect(disabled.every((tool) => tool.limitations?.includes('configured-sources-unavailable'))).toBe(true);

    const enabled = semanticTools({ configuredSources: true }).filter((tool) => tool.kind === 'source');
    expect(enabled).toHaveLength(6);
    expect(enabled.every(isToolAvailable)).toBe(true);
  });

  it('exposes all native LIFE presets behind an independent capability', () => {
    const disabled = semanticTools().filter((tool) => tool.kind === 'life');
    expect(disabled).toHaveLength(24);
    expect(disabled.map(({ key }) => key)).toEqual(
      LIFE_PRESETS.map(({ code }) => `life:${code.toLowerCase()}`),
    );
    expect(disabled.map(({ preset }) => preset)).toEqual(LIFE_PRESETS.map(({ preset }) => preset));
    expect(disabled.map(({ projection }) => projection)).toEqual(LIFE_PRESETS.map(({ material }) => material));
    expect(disabled.every((tool) => tool.category === 'automata' && !isToolAvailable(tool))).toBe(true);
    expect(disabled.every((tool) => tool.limitations?.includes('life-presets-unavailable'))).toBe(true);

    const enabled = semanticTools({ lifePresets: true }).filter((tool) => tool.kind === 'life');
    expect(enabled).toHaveLength(24);
    expect(enabled.every(isToolAvailable)).toBe(true);
    expect(enabled.map(({ color }) => color)).toEqual(LIFE_PRESETS.map(({ color }) => color));
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
