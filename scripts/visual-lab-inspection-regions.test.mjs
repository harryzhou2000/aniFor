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
import {
  normalizeVisualCaptureDeclaredAtlasManifest,
  VISUAL_CAPTURE_DECLARED_ATLAS_MANIFEST,
} from '../src/shared/visual-capture-declared-atlas-manifest.js';

const valid = () => structuredClone(VISUAL_LAB_INSPECTION_REGIONS);

describe('Visual Lab inspection-region catalog', () => {
  const fixture = (candidate) => VISUAL_LAB_INSPECTION_REGIONS.fixtures.find(
    (entry) => entry.candidate === candidate,
  );

  it('orders the covered subset by canonical capture-recipe order', () => {
    expect(VISUAL_LAB_INSPECTION_REGIONS.fixtures.map(({ candidate }) => candidate)).toEqual([
      'gas-showcase',
      'oxygen-showcase',
      'oil-motion',
      'water-motion',
      'powder-style-atlas',
      'material-lighting-atlas',
      'gas-material-lighting-atlas',
      'solid-material-lighting-atlas',
      'multi-metal-material-lighting-atlas',
      'source-target-material-lighting-atlas',
      'force-activity-material-lighting-atlas',
      'thermal-source-material-lighting-atlas',
      'opposed-source-material-lighting-atlas',
      'wax-material-lighting-atlas',
    ]);
    expect(Object.isFrozen(VISUAL_CAPTURE_INSPECTION_SOURCE_CATALOG)).toBe(true);
    expect(Object.isFrozen(VISUAL_CAPTURE_INSPECTION_SOURCE_CATALOG.sources[0])).toBe(true);
    expect(VISUAL_CAPTURE_INSPECTION_SOURCE_CATALOG.sources.every(
      ({ projection }) => projection === 'declared',
    )).toBe(true);
    expect(VISUAL_CAPTURE_INSPECTION_SOURCE_CATALOG.sources.map(({ name, atlases }) => (
      { name, atlases }
    ))).toEqual(VISUAL_CAPTURE_DECLARED_ATLAS_MANIFEST);
    expect(Object.isFrozen(VISUAL_CAPTURE_DECLARED_ATLAS_MANIFEST)).toBe(true);
    expect(Object.isFrozen(VISUAL_CAPTURE_DECLARED_ATLAS_MANIFEST[0])).toBe(true);
  });

  it('covers both base showcase recipes through declared data without capture authority', () => {
    const gas = fixture('gas-showcase');
    const oxygen = fixture('oxygen-showcase');
    expect(gas.regions.map(({ name, role }) => [name, role])).toEqual([
      ['smoke-body', 'response'], ['oxygen-control', 'control'],
      ['noble-control', 'control'], ['carbon-dioxide-control', 'control'],
      ['guarded-blank', 'control'],
    ]);
    expect(oxygen.regions.map(({ name, role }) => [name, role])).toEqual([
      ['oxygen-body', 'response'], ['smoke-control', 'control'],
      ['noble-control', 'control'], ['carbon-dioxide-control', 'control'],
      ['guarded-blank', 'control'],
    ]);
    expect(gas.world).toEqual({ width: 612, height: 384 });
    expect(oxygen.world).toEqual(gas.world);
  });

  it('projects Oil and Water motion response and ownership controls from declared fixtures', () => {
    const oil = fixture('oil-motion');
    const water = fixture('water-motion');
    expect(oil.regions).toHaveLength(19);
    expect(oil.regions.map(({ name }) => name)).toEqual([
      'moving-oil-top', 'moving-oil-left', 'moving-oil-right', 'moving-oil-core',
      'stationary-oil', 'moving-oil-thin', 'moving-oil-isolated',
      'oil-water-contact', 'oil-diesel-contact', 'oil-hole', 'oil-chimney',
      'moving-water-control', 'moving-acid-control', 'moving-diesel-control',
      'moving-nitro-control', 'water-contact-owner', 'diesel-contact-owner',
      'native-wall-oil', 'guarded-blank',
    ]);
    expect(water.regions).toHaveLength(18);
    expect(water.regions.map(({ name }) => name)).toEqual([
      'still-water-surface', 'still-water-core', 'moving-water-surface',
      'moving-water-core', 'moving-water-strand', 'moving-water-isolated',
      'water-metal-contact', 'water-oil-contact', 'still-water-hole',
      'moving-water-hole', 'still-water-chimney', 'moving-water-chimney',
      'moving-oil-control', 'moving-acid-control', 'metal-contact-owner',
      'oil-contact-owner', 'native-wall-water', 'guarded-blank',
    ]);
    expect(oil.regions.at(-1)).toEqual({
      name: 'guarded-blank', role: 'control', x: 24, y: 352, width: 548, height: 20,
    });
    expect(water.regions.at(-1)).toEqual({
      name: 'guarded-blank', role: 'control', x: 16, y: 344, width: 560, height: 24,
    });
  });

  it('rejects malformed, empty, duplicate-name, and duplicate-candidate manifest sources', () => {
    const atlas = VISUAL_CAPTURE_DECLARED_ATLAS_MANIFEST[0].atlases[0];
    expect(() => normalizeVisualCaptureDeclaredAtlasManifest({})).toThrow('manifest is malformed');
    expect(() => normalizeVisualCaptureDeclaredAtlasManifest([
      { name: 'empty', atlases: [] },
    ])).toThrow('source is malformed');
    expect(() => normalizeVisualCaptureDeclaredAtlasManifest([
      { name: 'same', atlases: [atlas] }, { name: 'same', atlases: [atlas] },
    ])).toThrow('source is malformed');
    expect(() => normalizeVisualCaptureDeclaredAtlasManifest([
      { name: 'first', atlases: [atlas] }, { name: 'second', atlases: [atlas] },
    ])).toThrow('candidate is malformed or duplicated');
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

  it('derives paired Wax/MWAX material-lighting controls from shared declared authoring', () => {
    const wax = fixture('wax-material-lighting-atlas');
    expect(wax.world).toEqual({ width: 612, height: 384 });
    expect(wax.regions).toHaveLength(22);
    expect(wax.regions.map(({ name }) => name)).toContain('wax-warm-emitter');
    expect(wax.regions.map(({ name }) => name)).toContain('mwax-warm-emitter');
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

  it('projects configured-source targets and controls through declared authoring', () => {
    const sourceTarget = fixture('source-target-material-lighting-atlas');
    expect(sourceTarget.regions).toHaveLength(64);
    expect(sourceTarget.regions.slice(0, 7).map(({ name }) => name)).toEqual([
      'clne-sand-body', 'clne-watr-body', 'clne-oxyg-body', 'clne-phot-body',
      'clne-metl-body', 'clne-plnt-body', 'clne-bcol-body',
    ]);
    expect(sourceTarget.regions.slice(42).map(({ name, role }) => ({ name, role }))).toEqual([
      { name: 'clne-sand-target-control', role: 'control' },
      { name: 'clne-watr-target-control', role: 'control' },
      { name: 'clne-oxyg-target-control', role: 'control' },
      { name: 'clne-phot-target-control', role: 'control' },
      { name: 'clne-metl-target-control', role: 'control' },
      { name: 'clne-plnt-target-control', role: 'control' },
      { name: 'clne-bcol-target-control', role: 'control' },
      { name: 'clne-sand-zero-state', role: 'control' },
      { name: 'bcln-sand-zero-state', role: 'control' },
      { name: 'pcln-sand-zero-state', role: 'control' },
      { name: 'pbcn-sand-zero-state', role: 'control' },
      { name: 'conv-sand-zero-state', role: 'control' },
      { name: 'cray-sand-zero-state', role: 'control' },
      { name: 'clne-sand-authored-hole', role: 'control' },
      { name: 'bcln-watr-open-notch', role: 'control' },
      { name: 'pcln-oxyg-thin-structure', role: 'control' },
      { name: 'pbcn-phot-isolated', role: 'control' },
      { name: 'conv-metl-wrong-owner', role: 'control' },
      { name: 'cray-plnt-wall-coexistence', role: 'control' },
      { name: 'clne-bcol-guarded-blank', role: 'control' },
      { name: 'clne-sand-wrong-owner', role: 'control' },
      { name: 'bcln-watr-wrong-owner', role: 'control' },
    ]);
    expect(Object.isFrozen(sourceTarget.regions[0])).toBe(true);
  });

  it('projects force activity state responses and topology controls through declared authoring', () => {
    const force = fixture('force-activity-material-lighting-atlas');
    expect(force.world).toEqual({ width: 612, height: 384 });
    expect(force.regions).toHaveLength(17);
    expect(force.regions.map(({ name, role }) => ({ name, role }))).toEqual([
      { name: 'acel-inactive-body', role: 'response' },
      { name: 'acel-active-body', role: 'response' },
      { name: 'dcel-inactive-body', role: 'response' },
      { name: 'dcel-active-body', role: 'response' },
      { name: 'acel-active-motif-arrow', role: 'response' },
      { name: 'dcel-active-motif-arrow', role: 'response' },
      { name: 'acel-inactive-motif-background', role: 'control' },
      { name: 'dcel-inactive-motif-background', role: 'control' },
      { name: 'acel-active-authored-hole', role: 'control' },
      { name: 'acel-active-open-notch', role: 'control' },
      { name: 'acel-active-thin-structure', role: 'control' },
      { name: 'acel-active-isolated', role: 'control' },
      { name: 'acel-active-wrong-owner', role: 'control' },
      { name: 'acel-active-water-control', role: 'control' },
      { name: 'acel-active-metal-control', role: 'control' },
      { name: 'acel-active-emitter', role: 'control' },
      { name: 'acel-active-guarded-blank', role: 'control' },
    ]);
    expect(Object.isFrozen(force.regions[0])).toBe(true);
  });

  it('projects thermal-source stages and exact-owner controls through declared authoring', () => {
    const thermal = fixture('thermal-source-material-lighting-atlas');
    expect(thermal.world).toEqual({ width: 612, height: 384 });
    expect(thermal.regions).toHaveLength(15);
    expect(thermal.regions.map(({ name, role }) => ({ name, role }))).toEqual([
      { name: 'ambient-core', role: 'response' },
      { name: 'onset-core', role: 'response' },
      { name: 'warm-core', role: 'response' },
      { name: 'orange-core', role: 'response' },
      { name: 'bright-core', role: 'response' },
      { name: 'bright-authored-hole', role: 'control' },
      { name: 'bright-open-notch', role: 'control' },
      { name: 'bright-thin-line', role: 'control' },
      { name: 'bright-isolated', role: 'control' },
      { name: 'bright-native-wall', role: 'control' },
      { name: 'bright-ceramic-water-contact', role: 'response' },
      { name: 'bright-water-control', role: 'control' },
      { name: 'bright-hot-brick-control', role: 'control' },
      { name: 'bright-hot-metal-control', role: 'control' },
      { name: 'bright-guarded-blank', role: 'control' },
    ]);
    expect(Object.isFrozen(thermal.regions[0])).toBe(true);
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
