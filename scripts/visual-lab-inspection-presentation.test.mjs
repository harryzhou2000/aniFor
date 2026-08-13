import { describe, expect, it } from 'vitest';

import { RENDER_OPTICS_MATERIAL_LIGHTING_ATLAS_CATALOG } from '../src/shared/render-optics-material-lighting-atlas-catalog.js';
import {
  compileRenderOpticsProfileResponseMatrix,
  compileVisualLabInspectionPresentations,
  compileVisualLabInspectionResponseMatrix,
  resolveVisualLabInspectionPresentation,
} from './visual-lab-inspection-presentation.mjs';

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
      composition: {
        bodyLighting: 1.18, profileSheen: 1.28, irradiance: 1.16,
        penetrationPath: 0.56, pigmentCoupling: 0.34, volumeScatter: 1.30,
        farSideShadow: 0.74, ambientGrounding: 0.78, interiorContrast: 1.14,
        environmentTransport: 1.22,
      },
      mesoscale: {
        radius: 8, supportLow: 0.46, supportHigh: 0.82,
        slopeBlend: 0.72, curvatureBlend: 0.68, neighbourBlend: 0.64,
      },
    });
    expect(sections[4].regions[0]).not.toHaveProperty('presentation');
  });

  it('leaves candidates without a presentation descriptor unchanged', () => {
    expect(resolveVisualLabInspectionPresentation('gas-showcase', [{ name: 'body' }]))
      .toBeNull();
    expect(compileVisualLabInspectionResponseMatrix('gas-showcase', [])).toBeNull();
  });

  it('compiles closed declarative presentation authoring and rejects unsafe variants', () => {
    const source = structuredClone(RENDER_OPTICS_MATERIAL_LIGHTING_ATLAS_CATALOG);
    const compiled = compileVisualLabInspectionPresentations([source]);
    expect(compiled[atlas.candidate]).toMatchObject({
      kind: 'material-profile-body-core',
      title: 'RenderOptics profile-to-response matrix',
    });
    expect(Object.isFrozen(compiled[atlas.candidate].sections)).toBe(true);

    const unknown = structuredClone(source);
    unknown.atlases[0].descriptor.inspectionPresentation.kind = 'module-callback';
    expect(() => compileVisualLabInspectionPresentations([unknown]))
      .toThrow('unsupported inspection presentation kind');

    const extra = structuredClone(source);
    extra.atlases[0].descriptor.inspectionPresentation.callback = 'run';
    expect(() => compileVisualLabInspectionPresentations([extra]))
      .toThrow('descriptor is malformed');

    expect(() => compileVisualLabInspectionPresentations([source, structuredClone(source)]))
      .toThrow('candidates are malformed or duplicated');

    const duplicateCard = structuredClone(source);
    duplicateCard.atlases[0].descriptor.cards[1].key = duplicateCard.atlases[0].descriptor.cards[0].key;
    expect(() => compileVisualLabInspectionPresentations([duplicateCard]))
      .toThrow('cards are malformed or duplicated');

    const missingBody = structuredClone(source);
    missingBody.atlases[0].descriptor.inspectionRegions.splice(0, 1);
    expect(() => compileVisualLabInspectionPresentations([missingBody]))
      .toThrow('missing body/core regions');

    const noControls = structuredClone(source);
    noControls.atlases[0].descriptor.inspectionRegions = noControls.atlases[0]
      .descriptor.inspectionRegions.filter(({ name }) => /-(?:body|core)$/.test(name));
    expect(() => compileVisualLabInspectionPresentations([noControls]))
      .toThrow('controls are empty');
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

  it('compiles every body/core pair into catalog-ordered profile response rows', () => {
    const measured = regions.map((region, index) => ({
      ...region,
      pairs: { offToB: {
        signedLumaMeanDelta: index + 0.1,
        signedLumaStandardDeviationDelta: index + 0.2,
        signedLumaNeighbourAbsoluteMeanDelta: index + 0.3,
      } },
    }));
    const presentation = resolveVisualLabInspectionPresentation(atlas.candidate, measured);
    const matrix = compileRenderOpticsProfileResponseMatrix(atlas.candidate, presentation);
    const generic = compileVisualLabInspectionResponseMatrix(atlas.candidate, presentation);
    expect(generic.title).toBe('RenderOptics profile-to-response matrix');
    expect(generic.groups).toEqual(matrix);
    expect(matrix.map(({ key, rows }) => [key, rows.map(({ card }) => card)])).toEqual([
      ['powder', ['sand', 'salt', 'gunpowder', 'thermite']],
      ['liquid', ['water', 'oil', 'acid', 'lava', 'liquid-nitrogen', 'mercury', 'mwax']],
      ['gas', ['smoke', 'oxygen']],
      ['solid', ['ceramic', 'wood', 'btry', 'iszs', 'glass', 'metal', 'wax']],
    ]);
    expect(matrix.flatMap(({ rows }) => rows)).toHaveLength(20);
    expect(matrix[1].rows[0]).toMatchObject({
      card: 'water', phase: 'liquid', optics: 'Aqueous', opticsCode: 1,
      body: { meanLuma: 10.1, spread: 10.2, neighbourContrast: 10.3 },
      core: { meanLuma: 11.1, spread: 11.2, neighbourContrast: 11.3 },
    });
    expect(Object.isFrozen(matrix[1].rows[0].body)).toBe(true);
  });

  it('rejects malformed, duplicated, and unmatched body/core response pairs', () => {
    const measured = regions.map((region) => ({
      ...region,
      pairs: { offToB: {
        signedLumaMeanDelta: 1,
        signedLumaStandardDeviationDelta: 2,
        signedLumaNeighbourAbsoluteMeanDelta: 3,
      } },
    }));
    const presentation = resolveVisualLabInspectionPresentation(atlas.candidate, measured);

    const missing = structuredClone(presentation);
    missing[0].regions.splice(1, 1);
    expect(() => compileRenderOpticsProfileResponseMatrix(atlas.candidate, missing))
      .toThrow('unmatched body/core');

    const duplicate = structuredClone(presentation);
    duplicate[0].regions.push(structuredClone(duplicate[0].regions[0]));
    expect(() => compileRenderOpticsProfileResponseMatrix(atlas.candidate, duplicate))
      .toThrow('duplicate body/core');

    const malformed = structuredClone(presentation);
    malformed[0].regions[0].pairs.offToB.signedLumaMeanDelta = Number.NaN;
    expect(() => compileRenderOpticsProfileResponseMatrix(atlas.candidate, malformed))
      .toThrow('malformed measurements');

    expect(() => compileVisualLabInspectionResponseMatrix(atlas.candidate, presentation.slice(0, -1)))
      .toThrow('input is malformed');
    const malformedControls = structuredClone(presentation);
    malformedControls.at(-1).key = 'other';
    expect(() => compileVisualLabInspectionResponseMatrix(atlas.candidate, malformedControls))
      .toThrow('controls are malformed');
  });
});
