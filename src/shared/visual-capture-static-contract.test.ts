import { describe, expect, it } from 'vitest';
import { VISUAL_LAB_STATIC_CONTRACT } from './visual-lab-static-contract.js';
import { VISUAL_CAPTURE_STATIC_CONTRACT } from './visual-capture-static-contract.js';
import {
  VISUAL_CAPTURE_STATIC_CATALOG,
  VISUAL_CAPTURE_STATIC_FIXTURES,
  VISUAL_CAPTURE_STATIC_RECIPES,
} from './visual-capture-static-catalog.js';

const visit = (value: unknown, visitor: (nested: object) => void): void => {
  if (value === null || typeof value !== 'object') return;
  visitor(value);
  for (const nested of Object.values(value)) visit(nested, visitor);
};

describe('visual capture driver static contract', () => {
  it('keeps the normal HDR registry closed while adding source-stage drivers', () => {
    expect(VISUAL_CAPTURE_STATIC_CONTRACT.evidencePlanes).toEqual([
      'atmosphere-alpha', 'liquid-alpha', 'emission-alpha', 'powder-surface-alpha',
    ]);
    expect(VISUAL_LAB_STATIC_CONTRACT.captureDomainOrder).toEqual([
      'gas', 'liquid', 'emission',
    ]);
    expect(VISUAL_LAB_STATIC_CONTRACT.domains.find(({ name }) => name === 'powder'))
      .toMatchObject({ implemented: false, executionProfile: null, evidence: null });
    expect(VISUAL_CAPTURE_STATIC_CONTRACT.drivers).toEqual([
      {
        name: 'normal-hdr',
        domains: ['gas', 'liquid', 'emission'],
        framebufferAlphaPolicy: 'exact',
        variants: [
          { name: 'off', selection: 0, label: 'OFF' },
          { name: 'a', selection: 1, label: 'A' },
          { name: 'b', selection: 2, label: 'B' },
        ],
      },
      {
        name: 'powder-render-style',
        domains: ['powder'],
        framebufferAlphaPolicy: 'style-owned-nonempty',
        variants: [
          { name: 'off', selection: 'smooth', label: 'Smooth' },
          { name: 'a', selection: 'local', label: 'Local' },
          { name: 'b', selection: 'grains', label: 'Grains' },
        ],
      },
      {
        name: 'material-lighting-profile',
        domains: ['material-lighting'],
        framebufferAlphaPolicy: 'exact',
        variants: [
          { name: 'off', selection: 0, label: 'Off' },
          { name: 'a', selection: 1, label: 'Balanced' },
          { name: 'b', selection: 2, label: 'Volumetric' },
        ],
      },
    ]);
  });

  it('declares typed Powder and material-lighting fixtures with stable six-field recipes', () => {
    expect(VISUAL_CAPTURE_STATIC_CONTRACT.extensionDomains.map((domain) => ({
      name: domain.name, targetKind: domain.targetKind, driver: domain.driver,
      evidence: domain.evidence,
    }))).toEqual([
      {
        name: 'powder', targetKind: 'none', driver: 'powder-render-style',
        evidence: { plane: 'powder-surface-alpha' },
      },
      {
        name: 'material-lighting', targetKind: 'none', driver: 'material-lighting-profile',
        evidence: { plane: 'emission-alpha' },
      },
    ]);
    expect(VISUAL_CAPTURE_STATIC_CONTRACT.fixtures).toEqual([
      {
        name: 'powder-style-atlas', scene: 'showcase', driver: 'powder-render-style',
        constraints: [{ domain: 'powder', targets: [0] }],
        preparationReportLabel: 'preparePowderStyleAtlasFixture',
        requirement: '--domain=powder --target=0',
      },
      {
        name: 'material-lighting-atlas', scene: 'showcase', driver: 'material-lighting-profile',
        constraints: [{ domain: 'material-lighting', targets: [0] }],
        preparationReportLabel: 'prepareMaterialLightingAtlasFixture',
        requirement: '--domain=material-lighting --target=0',
      },
    ]);
    for (const recipe of VISUAL_CAPTURE_STATIC_CONTRACT.captureRecipes) {
      expect(Reflect.ownKeys(recipe)).toEqual([
        'name', 'domain', 'target', 'fixture', 'gain', 'renderScale',
      ]);
    }
  });

  it('is recursively frozen, JSON-safe, and contains no executable bridge metadata', () => {
    expect(VISUAL_CAPTURE_STATIC_CONTRACT.schema)
      .toBe('anifor.visual-capture.static-contract/v1');
    expect(JSON.parse(JSON.stringify(VISUAL_CAPTURE_STATIC_CONTRACT)))
      .toStrictEqual(VISUAL_CAPTURE_STATIC_CONTRACT);
    visit(VISUAL_CAPTURE_STATIC_CONTRACT, (nested) => expect(Object.isFrozen(nested)).toBe(true));
    const serialized = JSON.stringify(VISUAL_CAPTURE_STATIC_CONTRACT);
    expect(serialized).not.toContain('readerMethod');
    for (const forbidden of ['method', 'args', 'expression', 'script', 'function']) {
      expect(serialized).not.toContain(`"${forbidden}"`);
    }
  });

  it('provides frozen capture-facing fixture and recipe projections', () => {
    expect(VISUAL_CAPTURE_STATIC_CATALOG.schema)
      .toBe('anifor.visual-capture.static-catalog/v1');
    expect(VISUAL_CAPTURE_STATIC_FIXTURES.map(({ name, driver }) => [name, driver])).toEqual([
      ['showcase', 'normal-hdr'],
      ['oil-motion', 'normal-hdr'],
      ['water-motion', 'normal-hdr'],
      ['powder-style-atlas', 'powder-render-style'],
      ['material-lighting-atlas', 'material-lighting-profile'],
    ]);
    expect(VISUAL_CAPTURE_STATIC_RECIPES.map(({ name }) => name)).toEqual([
      'gas-showcase', 'oxygen-showcase', 'oil-motion', 'water-motion', 'powder-style-atlas',
      'material-lighting-atlas',
    ]);
    visit(VISUAL_CAPTURE_STATIC_CATALOG, (nested) => expect(Object.isFrozen(nested)).toBe(true));
  });
});
