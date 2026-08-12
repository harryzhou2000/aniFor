import { describe, expect, it } from 'vitest';
import {
  normalizeVisualLabInspectionRegionCatalog,
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
      'clay-warm-flank', 'clay-cool-flank', 'clay-centre', 'authored-hole',
      'fine-structure-context', 'wet-suspension', 'native-wall', 'guarded-blank',
    ]);
    expect(Object.isFrozen(VISUAL_LAB_INSPECTION_REGIONS)).toBe(true);
    expect(Object.isFrozen(fixture.regions[0])).toBe(true);
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

