import { describe, expect, it } from 'vitest';

import { RENDER_OPTICS_MATERIAL_LIGHTING_ATLAS_CATALOG } from '../src/shared/render-optics-material-lighting-atlas-catalog.js';
import { resolveVisualLabInspectionPresentation } from './visual-lab-inspection-presentation.mjs';

const atlas = RENDER_OPTICS_MATERIAL_LIGHTING_ATLAS_CATALOG.atlases[0];
const regions = atlas.descriptor.inspectionRegions.map((region) => ({ ...region }));

describe('Visual Lab inspection presentation', () => {
  it('derives complete RenderOptics phase groups and trailing controls', () => {
    const sections = resolveVisualLabInspectionPresentation(atlas.candidate, regions);
    expect(sections.map(({ key, label, regions: entries }) => ({
      key, label, names: entries.map(({ name }) => name),
    }))).toEqual([
      { key: 'powder', label: 'Powder', names: [
        'sand-body', 'sand-core', 'salt-body', 'salt-core',
        'gunpowder-body', 'gunpowder-core', 'thermite-body', 'thermite-core',
      ] },
      { key: 'liquid', label: 'Liquid', names: [
        'water-body', 'water-core', 'oil-body', 'oil-core', 'acid-body', 'acid-core',
        'lava-body', 'lava-core', 'liquid-nitrogen-body', 'liquid-nitrogen-core',
        'mercury-body', 'mercury-core', 'mwax-body', 'mwax-core',
      ] },
      { key: 'gas', label: 'Gas', names: [
        'smoke-body', 'smoke-core', 'oxygen-body', 'oxygen-core',
      ] },
      { key: 'solid', label: 'Solid', names: [
        'ceramic-body', 'ceramic-core', 'wood-body', 'wood-core',
        'btry-body', 'btry-core', 'iszs-body', 'iszs-core',
        'glass-body', 'glass-core', 'metal-body', 'metal-core', 'wax-body', 'wax-core',
      ] },
      { key: 'controls', label: 'Topology and contact controls', names: [
        'powder-fine-control', 'liquid-fine-control', 'gas-fine-control',
        'solid-fine-control', 'wax-mwax-contact', 'glass-metal-contact',
        'native-wall', 'guarded-blank', 'solid-cavity-control',
      ] },
    ]);
    expect(Object.isFrozen(sections)).toBe(true);
    expect(sections[1].regions[0].presentation).toEqual({
      card: 'water', phase: 'liquid', optics: 'Aqueous', opticsCode: 1,
      profile: {
        key: 1.10, fill: 0.86, pigment: 0.82, transmission: 1.18,
        roughness: 0.92, interiorScatter: 1.25,
      },
    });
    expect(sections[4].regions[0]).not.toHaveProperty('presentation');
  });

  it('leaves candidates without a presentation descriptor unchanged', () => {
    expect(resolveVisualLabInspectionPresentation('gas-showcase', [{ name: 'body' }]))
      .toBeNull();
  });

  it('rejects missing, duplicate, and uncovered region bindings', () => {
    expect(() => resolveVisualLabInspectionPresentation(atlas.candidate, regions.slice(1)))
      .toThrow('references an invalid region');
    expect(() => resolveVisualLabInspectionPresentation(
      atlas.candidate, [...regions, { ...regions[0] }],
    )).toThrow('malformed or duplicated');
    expect(() => resolveVisualLabInspectionPresentation(
      atlas.candidate, [...regions, { name: 'unexpected-region' }],
    )).toThrow('does not cover every region');
  });
});
