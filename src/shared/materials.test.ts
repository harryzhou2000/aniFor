import { describe, expect, it } from 'vitest';
import { cellStyle } from '../renderer/material-palette';
import { ALL_MATERIALS, LIFE_PRESETS, MATERIALS, Material } from './materials';

describe('material catalog', () => {
  it('uses unique stable byte IDs', () => {
    const ids = ALL_MATERIALS.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(Array.from({ length: 194 }, (_, index) => index + 1));
    expect(ids.every((id) => id > Material.Empty && id <= 0xFF)).toBe(true);
    expect(MATERIALS.map(({ id }) => id)).toEqual(
      Array.from({ length: 170 }, (_, index) => index + 1).filter((id) => ![15, 16, 17, 18, 20].includes(id)),
    );
  });

  it('pins all native LIFE preset indexes, projections, rules, and colors', () => {
    expect(LIFE_PRESETS.map(({ preset }) => preset)).toEqual(
      Array.from({ length: 24 }, (_, index) => index),
    );
    expect(LIFE_PRESETS.map(({ material }) => material)).toEqual(
      Array.from({ length: 24 }, (_, index) => 171 + index),
    );
    expect(LIFE_PRESETS.map(({ code, rule, color }) => [code, rule, color])).toEqual([
      ['GOL', 'B3/S23', '#0cac00'],
      ['HLIF', 'B36/S23', '#ff0000'],
      ['ASIM', 'B345/S4567', '#0000ff'],
      ['2X2', 'B36/S125', '#ffff00'],
      ['DANI', 'B3678/S34678', '#00ffff'],
      ['AMOE', 'B357/S1358', '#ff00ff'],
      ['MOVE', 'B368/S245', '#ffffff'],
      ['PGOL', 'B357/S238', '#e05010'],
      ['DMOE', 'B35678/S5678', '#500000'],
      ['3-4', 'B34/S34', '#500050'],
      ['LLIF', 'B345/S5', '#505050'],
      ['STAN', 'B3678/S235678', '#5000ff'],
      ['SEED', 'B2/S', '#fbec7d'],
      ['MAZE', 'B3/S12345', '#a8e4a0'],
      ['COAG', 'B378/S235678', '#9acd32'],
      ['WALL', 'B45678/S2345', '#0047ab'],
      ['GNAR', 'B1/S1', '#e5b73b'],
      ['REPL', 'B1357/S1357', '#259588'],
      ['MYST', 'B3458/S05678', '#0c3c00'],
      ['LOTE', 'B37/S3458/4', '#ff0000'],
      ['FRG2', 'B3/S124/3', '#006432'],
      ['STAR', 'B278/S3456/6', '#000040'],
      ['FROG', 'B34/S12/3', '#006400'],
      ['BRAN', 'B246/S6/3', '#ffff00'],
    ]);
  });

  it('keeps LIFE projections out of the ordinary brush catalog', () => {
    const allById = new Map(ALL_MATERIALS.map((material) => [material.id, material]));
    const selectable = new Set(MATERIALS.map(({ id }) => id));
    for (const { material } of LIFE_PRESETS) {
      expect(allById.get(material)).toMatchObject({ category: 'automata', selectable: false });
      expect(selectable.has(material)).toBe(false);
    }
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
