import { describe, expect, it } from 'vitest';
import { VISUAL_LAB_STATIC_CONTRACT } from './visual-lab-static-contract.js';

const visit = (value: unknown, visitValue: (nested: object) => void): void => {
  if (value === null || typeof value !== 'object') return;
  visitValue(value);
  for (const nested of Object.values(value)) visit(nested, visitValue);
};

describe('Visual Lab static cross-runtime contract', () => {
  it('pins the stable schema, domain codes, and independent capture order', () => {
    expect(VISUAL_LAB_STATIC_CONTRACT.schema).toBe('anifor.visual-lab.static-contract/v1');
    expect(VISUAL_LAB_STATIC_CONTRACT.domainCodes).toEqual({
      off: 0,
      powder: 1,
      liquid: 2,
      gas: 3,
      emission: 4,
    });
    expect(VISUAL_LAB_STATIC_CONTRACT.domains.map(({ name }) => name)).toEqual([
      'off', 'powder', 'liquid', 'gas', 'emission',
    ]);
    expect(VISUAL_LAB_STATIC_CONTRACT.captureDomainOrder).toEqual([
      'gas', 'liquid', 'emission',
    ]);

    const implemented = VISUAL_LAB_STATIC_CONTRACT.domains
      .filter(({ implemented }) => implemented)
      .map(({ name }) => name)
      .sort();
    expect([...VISUAL_LAB_STATIC_CONTRACT.captureDomainOrder].sort()).toEqual(implemented);
  });

  it('keeps the normal-HDR execution and fallback profile exact for every capture domain', () => {
    const profile = {
      detailScales: [1, 2, 4],
      backend: 'webgl',
      pipeline: 'normal-hdr',
      variantZero: 'pixel-preserving-baseline',
      fallbacks: {
        classic: 'disabled-preserve-baseline',
        canvas2d: 'disabled-preserve-baseline',
        hdrUnavailable: 'disabled-preserve-baseline',
        detail8x: 'disabled-preserve-baseline',
      },
    };
    expect(VISUAL_LAB_STATIC_CONTRACT.normalHdrExecutionProfile).toEqual(profile);
    for (const domain of VISUAL_LAB_STATIC_CONTRACT.domains) {
      if (!domain.implemented) continue;
      expect(domain.executionProfile).toEqual(profile);
      expect(domain.executionProfile).toBe(
        VISUAL_LAB_STATIC_CONTRACT.normalHdrExecutionProfile,
      );
    }
  });

  it('keeps reserved and implemented domain evidence declarative and exact', () => {
    const domains = Object.fromEntries(
      VISUAL_LAB_STATIC_CONTRACT.domains.map((domain) => [domain.name, domain]),
    );
    expect(domains.off).toMatchObject({
      code: 0, implemented: false, targetKind: 'none', evidence: null, fixedUrlParameters: {},
    });
    expect(domains.powder).toMatchObject({
      code: 1, implemented: false, targetKind: 'semantic-material-id', evidence: null,
      fixedUrlParameters: {},
    });
    expect(domains.gas).toMatchObject({
      code: 3,
      implemented: true,
      targetKind: 'propagated-atmosphere-style-byte',
      evidence: { readerMethod: 'atmosphereFieldAlpha', plane: 'atmosphere-alpha' },
      fixedUrlParameters: {},
    });
    expect(domains.liquid).toMatchObject({
      code: 2,
      implemented: true,
      targetKind: 'semantic-material-id',
      evidence: { readerMethod: 'liquidFieldAlpha', plane: 'liquid-alpha' },
      fixedUrlParameters: { liquidBodyVfx: '1', liquidSurfaceVfx: '1' },
    });
    expect(domains.emission).toMatchObject({
      code: 4,
      implemented: true,
      targetKind: 'semantic-material-id',
      evidence: { readerMethod: 'emissionFieldAlpha', plane: 'emission-alpha' },
      fixedUrlParameters: {},
    });
  });

  it('declares fixtures, constraints, and historical report labels without executable preparation', () => {
    expect(VISUAL_LAB_STATIC_CONTRACT.fixtures).toEqual([
      {
        name: 'showcase',
        scene: 'showcase',
        constraints: [
          { domain: 'gas', targets: null },
          { domain: 'liquid', targets: null },
          { domain: 'emission', targets: null },
        ],
        preparationReportLabel: null,
        requirement: null,
      },
      {
        name: 'oil-motion',
        scene: 'showcase',
        constraints: [{ domain: 'liquid', targets: [8] }],
        preparationReportLabel: 'prepareOilMotionVfxFixture',
        requirement: '--domain=liquid --target=8',
      },
      {
        name: 'water-motion',
        scene: 'showcase',
        constraints: [{ domain: 'liquid', targets: [2] }],
        preparationReportLabel: 'prepareLiquidMotionVfxFixture',
        requirement: '--domain=liquid --target=2',
      },
    ]);
    expect(VISUAL_LAB_STATIC_CONTRACT.fixtures
      .filter(({ preparationReportLabel }) => preparationReportLabel !== null)
      .map(({ name, preparationReportLabel }) => ({ name, preparationReportLabel })))
      .toEqual([
        { name: 'oil-motion', preparationReportLabel: 'prepareOilMotionVfxFixture' },
        { name: 'water-motion', preparationReportLabel: 'prepareLiquidMotionVfxFixture' },
      ]);

    const serialized = JSON.stringify(VISUAL_LAB_STATIC_CONTRACT);
    for (const forbiddenField of ['method', 'args', 'prepare', 'preparer', 'builder']) {
      expect(serialized).not.toContain(`"${forbiddenField}"`);
    }
  });

  it('declares the stable capture recipes without executable metadata', () => {
    expect(VISUAL_LAB_STATIC_CONTRACT.captureRecipes).toEqual([
      {
        name: 'gas-showcase', domain: 'gas', target: 0,
        fixture: 'showcase', gain: 1, renderScale: 2,
      },
      {
        name: 'oxygen-showcase', domain: 'gas', target: 4,
        fixture: 'showcase', gain: 1, renderScale: 2,
      },
      {
        name: 'oil-motion', domain: 'liquid', target: 8,
        fixture: 'oil-motion', gain: 1, renderScale: 2,
      },
      {
        name: 'water-motion', domain: 'liquid', target: 2,
        fixture: 'water-motion', gain: 1, renderScale: 2,
      },
    ]);
    for (const recipe of VISUAL_LAB_STATIC_CONTRACT.captureRecipes) {
      expect(Reflect.ownKeys(recipe)).toEqual([
        'name', 'domain', 'target', 'fixture', 'gain', 'renderScale',
      ]);
    }
  });

  it('is recursively frozen and JSON-safe static data', () => {
    expect(JSON.parse(JSON.stringify(VISUAL_LAB_STATIC_CONTRACT)))
      .toStrictEqual(VISUAL_LAB_STATIC_CONTRACT);
    visit(VISUAL_LAB_STATIC_CONTRACT, (nested) => {
      expect(Object.isFrozen(nested)).toBe(true);
    });
  });
});
