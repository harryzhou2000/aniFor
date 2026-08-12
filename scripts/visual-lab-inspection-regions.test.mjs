import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  compileVisualLabInspectionFixtures,
  normalizeVisualLabInspectionRegionCatalog,
  projectDeclaredInspectionFixture,
  VISUAL_LAB_INSPECTION_REGIONS,
  VISUAL_LAB_INSPECTION_REGION_CATALOG_SCHEMA,
} from './visual-lab-inspection-regions.mjs';
import {
  VISUAL_CAPTURE_INSPECTION_SOURCE_CATALOG,
} from '../src/shared/visual-capture-inspection-source-catalog.js';

const valid = () => structuredClone(VISUAL_LAB_INSPECTION_REGIONS);

describe('Visual Lab inspection-region catalog', () => {
  const fixture = (candidate) => VISUAL_LAB_INSPECTION_REGIONS.fixtures.find(
    (entry) => entry.candidate === candidate,
  );

  it('orders the covered subset by canonical capture-recipe order', () => {
    expect(VISUAL_LAB_INSPECTION_REGIONS.fixtures.map(({ candidate }) => candidate)).toEqual([
      'powder-style-atlas',
      'material-lighting-atlas',
      'gas-material-lighting-atlas',
      'solid-material-lighting-atlas',
      'multi-metal-material-lighting-atlas',
      'opposed-source-material-lighting-atlas',
    ]);
    expect(Object.isFrozen(VISUAL_CAPTURE_INSPECTION_SOURCE_CATALOG)).toBe(true);
    expect(Object.isFrozen(VISUAL_CAPTURE_INSPECTION_SOURCE_CATALOG.sources[0])).toBe(true);
    expect(VISUAL_CAPTURE_INSPECTION_SOURCE_CATALOG.sources.every(
      ({ projection }) => projection === 'declared',
    )).toBe(true);
  });

  it('projects Powder style response and topology controls through the declared seam', () => {
    const powder = fixture('powder-style-atlas');
    expect(powder.world).toEqual({ width: 612, height: 384 });
    expect(powder.regions).toHaveLength(16);
    expect(powder.regions.map(({ name }) => name)).toEqual([
      'sand-pile-bulk', 'sand-pile-surface', 'clay-pile-bulk', 'clay-pile-surface',
      'concrete-ridge', 'wet-powder', 'wet-water', 'clay-stem', 'clay-ledge',
      'concrete-hole', 'sand-grain', 'clay-grain', 'concrete-diagonal',
      'unstable-grains', 'wall-coexistence', 'guarded-blank',
    ]);
    expect(powder.regions.at(-1)).toEqual({
      name: 'guarded-blank', role: 'control', x: 290, y: 334, width: 120, height: 28,
    });
  });

  it('derives opposed-source review annotations from shared declared authoring', () => {
    const opposed = fixture('opposed-source-material-lighting-atlas');
    expect(opposed.world).toEqual({ width: 612, height: 384 });
    expect(opposed.regions.map(({ name }) => name)).toEqual([
      'clay-warm-flank', 'clay-cool-flank', 'clay-centre',
      'sand-lit-front-shoulder', 'sand-wall-umbra', 'sand-open-shoulder', 'authored-hole',
      'fine-structure-context', 'wet-suspension', 'native-wall', 'guarded-blank',
    ]);
    expect(Object.isFrozen(VISUAL_LAB_INSPECTION_REGIONS)).toBe(true);
    expect(Object.isFrozen(opposed.regions[0])).toBe(true);
  });

  it('derives solid and multi-metal review regions from shared data-only atlas authoring', () => {
    const solid = fixture('solid-material-lighting-atlas');
    const metals = fixture('multi-metal-material-lighting-atlas');
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

  it('preserves the exact pre-migration gas and solid projection records', () => {
    const digest = (regions) => createHash('sha256')
      .update(JSON.stringify(regions))
      .digest('hex');
    expect(digest(fixture('gas-material-lighting-atlas').regions)).toBe(
      'c192353906fb0ac3310fe5078e63c4b7bfb5e3bb88b093fb4fcd533a89c16815',
    );
    expect(digest(fixture('solid-material-lighting-atlas').regions)).toBe(
      '67e8beb5d74372b06dd71a5f7d49b4d48cf21615a169b38ba3818b73425e95d8',
    );
    expect(digest(fixture('multi-metal-material-lighting-atlas').regions)).toBe(
      '9eb4a5f92fa8e2d03ca573095c810efb8ad717f5940249c11b04da1dcbbc3722',
    );
  });

  it('derives gas response and control regions from shared data-only atlas authoring', () => {
    const gas = fixture('gas-material-lighting-atlas');
    expect(gas.candidate).toBe('gas-material-lighting-atlas');
    expect(gas.regions).toHaveLength(18);
    expect(gas.regions.map(({ name, role }) => ({ name, role }))).toEqual([
      { name: 'sooty-warm-flank', role: 'response' },
      { name: 'sooty-core', role: 'response' },
      { name: 'clean-core', role: 'response' },
      { name: 'clean-cool-flank', role: 'response' },
      { name: 'sooty-hole', role: 'control' },
      { name: 'clean-channel', role: 'control' },
      { name: 'warm-emitter', role: 'control' },
      { name: 'cool-emitter', role: 'control' },
      { name: 'sparse-sooty-pair', role: 'control' },
      { name: 'sparse-clean-pair', role: 'control' },
      { name: 'solid-contact-gas', role: 'response' },
      { name: 'solid-contact-owner', role: 'control' },
      { name: 'liquid-contact-gas', role: 'response' },
      { name: 'liquid-contact-owner', role: 'control' },
      { name: 'foreign-gas-contact', role: 'response' },
      { name: 'native-wall-gas', role: 'control' },
      { name: 'emissive-gas', role: 'response' },
      { name: 'guarded-blank', role: 'control' },
    ]);
    expect(gas.regions[8]).toEqual({
      name: 'sparse-sooty-pair', role: 'control', x: 34, y: 352, width: 3, height: 1,
    });
    expect(Object.isFrozen(gas.regions.at(-1))).toBe(true);
  });

  it('projects an ordered cross-phase review board from declared data-only anchors', () => {
    const mixed = fixture('material-lighting-atlas');
    expect(mixed.candidate).toBe('material-lighting-atlas');
    expect(mixed.regions).toHaveLength(20);
    expect(mixed.regions.slice(0, 8).map(({ name, role }) => ({ name, role }))).toEqual([
      { name: 'sand-body', role: 'response' },
      { name: 'clay-body', role: 'response' },
      { name: 'water-body', role: 'response' },
      { name: 'oil-body', role: 'response' },
      { name: 'smoke-warm-flank', role: 'response' },
      { name: 'smoke-core', role: 'response' },
      { name: 'fog-core', role: 'response' },
      { name: 'fog-cool-flank', role: 'response' },
    ]);
    expect(mixed.regions.at(-1)).toEqual({
      name: 'guarded-blank', role: 'control', x: 198, y: 334, width: 210, height: 28,
    });
    expect(Object.isFrozen(mixed.regions.at(-1))).toBe(true);
  });

  it('compiles only declared sources and rejects unknown, duplicate, or unregistered input', () => {
    const region = { name: 'whole', role: 'response', x: 0, y: 0, width: 2, height: 2 };
    const atlas = (candidate) => ({
      candidate, world: { width: 2, height: 2 }, descriptor: { inspectionRegions: [region] },
    });
    const recipes = [
      { name: 'first', fixture: 'shared' },
      { name: 'second', fixture: 'second' },
      { name: 'without-regions', fixture: 'without-regions' },
    ];
    const sources = (entries) => ({ sources: entries });
    const declared = (name, atlases) => ({ name, projection: 'declared', atlases });

    const compiled = compileVisualLabInspectionFixtures(sources([
      declared('later-source', [atlas('second')]),
      declared('earlier-source', [atlas('first')]),
    ]), recipes);
    expect(compiled.map(({ candidate }) => candidate)).toEqual(['first', 'second']);

    expect(() => compileVisualLabInspectionFixtures(sources([
      { ...declared('unknown', [atlas('first')]), projection: 'callback' },
    ]), recipes)).toThrow(/Unknown/);
    expect(() => compileVisualLabInspectionFixtures(sources([
      declared('same', [atlas('first')]), declared('same', [atlas('second')]),
    ]), recipes)).toThrow(/source is malformed/);
    expect(() => compileVisualLabInspectionFixtures(sources([
      declared('one', [atlas('first')]), declared('two', [atlas('first')]),
    ]), recipes)).toThrow(/duplicate/);
    expect(() => compileVisualLabInspectionFixtures(sources([
      declared('unregistered', [atlas('missing')]),
    ]), recipes)).toThrow(/Invalid/);
    expect(() => compileVisualLabInspectionFixtures(sources([]), [
      ...recipes, { name: 'first', fixture: 'another' },
    ])).toThrow(/recipe order is malformed/);
  });

  it('keeps declared review projection data-only and lets normalization reject unsafe records', () => {
    const projected = projectDeclaredInspectionFixture({
      candidate: 'declared', world: { width: 2, height: 2 }, descriptor: {
        inspectionRegions: [{ name: 'whole', role: 'response', x: 0, y: 0, width: 2, height: 2 }],
      },
    });
    expect(projected.regions[0]).toEqual({
      name: 'whole', role: 'response', x: 0, y: 0, width: 2, height: 2,
    });
    projected.regions[0].width = 3;
    expect(() => normalizeVisualLabInspectionRegionCatalog({
      schema: VISUAL_LAB_INSPECTION_REGION_CATALOG_SCHEMA, fixtures: [projected],
    })).toThrow(/malformed/);
    expect(() => projectDeclaredInspectionFixture({
      candidate: '../escape', world: { width: 1, height: 1 }, descriptor: { inspectionRegions: [] },
    })).toThrow(/malformed/);
  });

  it('fails projection through catalog normalization when authored geometry escapes the world', () => {
    const projected = projectDeclaredInspectionFixture({
      candidate: 'escaped-atlas', world: { width: 10, height: 10 }, descriptor: {
        inspectionRegions: [{
          name: 'escaped', role: 'response', x: 9, y: 9, width: 2, height: 1,
        }],
      },
    });
    expect(() => normalizeVisualLabInspectionRegionCatalog({
      schema: VISUAL_LAB_INSPECTION_REGION_CATALOG_SCHEMA, fixtures: [projected],
    })).toThrow(/malformed/);
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
