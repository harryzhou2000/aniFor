import { describe, expect, it } from 'vitest';
import {
  normalizeVisualLabInspectionRegionCatalog,
  projectSolidMaterialLightingAtlasInspectionFixture,
  VISUAL_LAB_INSPECTION_REGIONS,
  VISUAL_LAB_INSPECTION_REGION_CATALOG_SCHEMA,
} from './visual-lab-inspection-regions.mjs';

const valid = () => structuredClone(VISUAL_LAB_INSPECTION_REGIONS);

describe('Visual Lab inspection-region catalog', () => {
  it('keeps opposed-source review annotations ordered, bounded, and deeply frozen', () => {
    const fixture = VISUAL_LAB_INSPECTION_REGIONS.fixtures[0];
    expect(fixture.candidate).toBe('opposed-source-material-lighting-atlas');
    expect(fixture.world).toEqual({ width: 612, height: 384 });
    expect(fixture.regions.map(({ name }) => name)).toEqual([
      'clay-warm-flank', 'clay-cool-flank', 'clay-centre',
      'sand-lit-front-shoulder', 'sand-wall-umbra', 'sand-open-shoulder', 'authored-hole',
      'fine-structure-context', 'wet-suspension', 'native-wall', 'guarded-blank',
    ]);
    expect(Object.isFrozen(VISUAL_LAB_INSPECTION_REGIONS)).toBe(true);
    expect(Object.isFrozen(fixture.regions[0])).toBe(true);
  });

  it('derives solid and multi-metal review regions from shared data-only atlas authoring', () => {
    const solid = VISUAL_LAB_INSPECTION_REGIONS.fixtures[1];
    const metals = VISUAL_LAB_INSPECTION_REGIONS.fixtures[2];
    expect(solid.candidate).toBe('solid-material-lighting-atlas');
    expect(solid.regions).toHaveLength(64);
    expect(solid.regions.slice(0, 8).map(({ name, role }) => ({ name, role }))).toEqual([
      { name: 'brck-body', role: 'response' },
      { name: 'brck-contact', role: 'response' },
      { name: 'brck-hole', role: 'control' },
      { name: 'brck-open-notch', role: 'control' },
      { name: 'brck-thin-structure', role: 'control' },
      { name: 'brck-isolated', role: 'control' },
      { name: 'brck-native-wall', role: 'control' },
      { name: 'brck-guarded-blank', role: 'control' },
    ]);
    expect(metals.candidate).toBe('multi-metal-material-lighting-atlas');
    expect(metals.regions).toHaveLength(48);
    expect(metals.regions.filter(({ role }) => role === 'response')).toHaveLength(12);
    expect(metals.regions.at(-1)).toEqual({
      name: 'ttan-guarded-blank', role: 'control', x: 480, y: 314, width: 90, height: 18,
    });
    expect(Object.isFrozen(metals.regions.at(-1))).toBe(true);
  });

  it('fails projection through catalog normalization when authored geometry escapes the world', () => {
    const projected = projectSolidMaterialLightingAtlasInspectionFixture({
      candidate: 'escaped-atlas', world: { width: 10, height: 10 }, descriptor: {
        definitions: [{ material: 23, code: 'METL' }], columns: 1,
        origin: { x: 9, y: 9 }, stride: { x: 1, y: 1 }, cardSize: { width: 1, height: 1 },
        conductiveWall: 1,
        template: {
          body: { x: 0, y: 0, width: 2, height: 1 }, hole: { x: 0, y: 0, width: 1, height: 1 },
          openNotch: { x: 0, y: 0, width: 1, height: 1 },
          thinStructure: { x: 0, y: 0, width: 1, height: 1 }, isolated: { x: 0, y: 0 },
          contactOwner: { x: 0, y: 0, width: 1, height: 1 },
          contactNeighbour: { x: 0, y: 0, width: 1, height: 1 },
          nativeWall: { x: 0, y: 0, width: 1, height: 1 },
          emitter: { x: 0, y: 0, width: 1, height: 1 },
          guardedBlank: { x: 0, y: 0, width: 1, height: 1 },
        },
      },
    });
    expect(() => normalizeVisualLabInspectionRegionCatalog({
      schema: VISUAL_LAB_INSPECTION_REGION_CATALOG_SCHEMA, fixtures: [projected],
    })).toThrow(/malformed/);
  });

  it('rejects malformed atlas candidate and material codes before projection', () => {
    const base = {
      candidate: 'sample-atlas', world: { width: 10, height: 10 }, descriptor: {
        definitions: [{ material: 23, code: 'METL' }], columns: 1,
        origin: { x: 0, y: 0 }, stride: { x: 10, y: 10 }, cardSize: { width: 10, height: 10 },
        conductiveWall: 1,
        template: {
          body: { x: 0, y: 0, width: 1, height: 1 }, hole: { x: 0, y: 0, width: 1, height: 1 },
          openNotch: { x: 0, y: 0, width: 1, height: 1 },
          thinStructure: { x: 0, y: 0, width: 1, height: 1 }, isolated: { x: 0, y: 0 },
          contactOwner: { x: 0, y: 0, width: 1, height: 1 },
          contactNeighbour: { x: 0, y: 0, width: 1, height: 1 },
          nativeWall: { x: 0, y: 0, width: 1, height: 1 },
          emitter: { x: 0, y: 0, width: 1, height: 1 },
          guardedBlank: { x: 0, y: 0, width: 1, height: 1 },
        },
      },
    };
    expect(() => projectSolidMaterialLightingAtlasInspectionFixture({
      ...base, candidate: '../escape',
    })).toThrow(/malformed/);
    expect(() => projectSolidMaterialLightingAtlasInspectionFixture({
      ...base,
      descriptor: { ...base.descriptor, definitions: [{ material: 23, code: '<bad>' }] },
    })).toThrow(/code is malformed/);
  });

  it('fails closed for unknown fields, duplicates, unsafe geometry, and invalid roles', () => {
    const cases = [];
    const extra = valid(); extra.extra = true; cases.push(extra);
    const duplicateFixture = valid(); duplicateFixture.fixtures.push(duplicateFixture.fixtures[0]); cases.push(duplicateFixture);
    const duplicateRegion = valid(); duplicateRegion.fixtures[0].regions.push(duplicateRegion.fixtures[0].regions[0]); cases.push(duplicateRegion);
    const escaped = valid(); escaped.fixtures[0].regions[0].x = 607; cases.push(escaped);
    const zero = valid(); zero.fixtures[0].regions[0].width = 0; cases.push(zero);
    const role = valid(); role.fixtures[0].regions[0].role = 'verdict'; cases.push(role);
    for (const candidate of cases) {
      expect(() => normalizeVisualLabInspectionRegionCatalog(candidate)).toThrow(/malformed/);
    }
  });

  it('accepts a bounded independent scripts-owned descriptor', () => {
    const catalog = normalizeVisualLabInspectionRegionCatalog({
      schema: VISUAL_LAB_INSPECTION_REGION_CATALOG_SCHEMA,
      fixtures: [{
        candidate: 'sample', world: { width: 2, height: 2 },
        regions: [{ name: 'whole', role: 'response', x: 0, y: 0, width: 2, height: 2 }],
      }],
    });
    expect(catalog.fixtures[0].regions[0]).toEqual({
      name: 'whole', role: 'response', x: 0, y: 0, width: 2, height: 2,
    });
  });
});
