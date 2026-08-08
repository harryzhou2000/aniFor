import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildVisualLabStartupExpression,
  resolveVisualLabDomain,
  resolveVisualLabFixture,
  VISUAL_LAB_DOMAIN_ADAPTERS,
  VISUAL_LAB_FIXTURE_ADAPTERS,
  visualLabDomainNames,
  visualLabFixtureNames,
} from './visual-lab-fixtures.mjs';

const runStartupExpression = (adapter, audit, scene = 'showcase') => Function(
  'window', 'document', `return ${buildVisualLabStartupExpression(adapter)};`,
)({ __ANIFOR_INPUT_AUDIT__: audit }, {
  querySelector: () => ({ dataset: { scene } }),
});

describe('Visual Lab fixture adapters', () => {
  it('centralizes domain query parameters, target kinds, and alpha readers', () => {
    expect(visualLabDomainNames()).toEqual(['gas', 'liquid', 'emission']);
    expect(resolveVisualLabDomain('gas')).toMatchObject({
      targetKind: 'propagated-atmosphere-style-byte',
      fieldAlphaMethod: 'atmosphereFieldAlpha',
      urlParameters: {},
    });
    expect(resolveVisualLabDomain('liquid')).toMatchObject({
      targetKind: 'semantic-material-id',
      fieldAlphaMethod: 'liquidFieldAlpha',
      urlParameters: { liquidBodyVfx: '1', liquidSurfaceVfx: '1' },
    });
    expect(resolveVisualLabDomain('emission').fieldAlphaMethod).toBe('emissionFieldAlpha');
    expect(() => resolveVisualLabDomain('powder'))
      .toThrow('--domain must be gas, liquid, or emission');
  });

  it('keeps the general showcase compatible with every implemented capture domain', () => {
    expect(visualLabFixtureNames()).toEqual(['showcase', 'oil-motion']);
    for (const domain of ['gas', 'liquid', 'emission']) {
      expect(resolveVisualLabFixture('showcase', domain, 255).name).toBe('showcase');
    }
  });

  it('declares Oil preparation and its exact liquid target without harness branching', () => {
    const adapter = resolveVisualLabFixture('oil-motion', 'liquid', 8);
    expect(adapter).toMatchObject({
      name: 'oil-motion',
      scene: 'showcase',
      preparation: { method: 'prepareOilMotionVfxFixture', args: ['moving'] },
    });
    expect(Object.isFrozen(adapter)).toBe(true);
    expect(Object.isFrozen(adapter.preparation.args)).toBe(true);
  });

  it('rejects unknown fixtures and incompatible domain/target pairs early', () => {
    expect(() => resolveVisualLabFixture('missing', 'gas', 1))
      .toThrow('--fixture must be showcase or oil-motion');
    expect(() => resolveVisualLabFixture('oil-motion', 'gas', 8))
      .toThrow('--fixture=oil-motion requires --domain=liquid --target=8');
    expect(() => resolveVisualLabFixture('oil-motion', 'liquid', 2))
      .toThrow('--fixture=oil-motion requires --domain=liquid --target=8');
  });

  it('keeps every adapter and nested constraint JSON-serializable and immutable', () => {
    expect(() => JSON.stringify({
      domains: VISUAL_LAB_DOMAIN_ADAPTERS, fixtures: VISUAL_LAB_FIXTURE_ADAPTERS,
    })).not.toThrow();
    for (const adapter of [...VISUAL_LAB_DOMAIN_ADAPTERS, ...VISUAL_LAB_FIXTURE_ADAPTERS]) {
      expect(Object.isFrozen(adapter)).toBe(true);
    }
    for (const adapter of VISUAL_LAB_FIXTURE_ADAPTERS) {
      expect(Object.isFrozen(adapter.constraints)).toBe(true);
      expect(adapter.constraints.every(Object.isFrozen)).toBe(true);
    }
  });

  it('observes Canvas startup before preparing and staging a fixture', () => {
    const calls = [];
    const audit = {
      backend: () => {
        calls.push('backend');
        return { backend: 'canvas2d', reason: 'webgl-starting' };
      },
      prepareOilMotionVfxFixture: (mode) => calls.push(`prepare:${mode}`),
      setVisualLabVariant: (variant) => calls.push(`variant:${variant}`),
    };
    const result = runStartupExpression(
      resolveVisualLabFixture('oil-motion', 'liquid', 8), audit,
    );
    expect(calls).toEqual(['backend', 'prepare:moving', 'variant:2']);
    expect(result).toMatchObject({
      fixture: 'oil-motion', scene: 'showcase', fixturePrepared: true,
      stagedBeforeWebGL: true, backendReasonBeforeSelection: 'webgl-starting',
    });
  });

  it('uses the mounted scene for no-op fixtures and fails before mutation on bad adapters', () => {
    const showcaseCalls = [];
    const showcase = runStartupExpression(resolveVisualLabFixture('showcase', 'gas', 1), {
      backend: () => {
        showcaseCalls.push('backend');
        return { backend: 'canvas2d', reason: 'webgl-starting' };
      },
      setVisualLabVariant: (variant) => showcaseCalls.push(`variant:${variant}`),
    });
    expect(showcaseCalls).toEqual(['backend', 'variant:2']);
    expect(showcase).toMatchObject({ scene: 'showcase', preparation: 'scene' });

    const missingCalls = [];
    const missing = runStartupExpression(resolveVisualLabFixture('oil-motion', 'liquid', 8), {
      backend: () => {
        missingCalls.push('backend');
        return { backend: 'canvas2d', reason: 'webgl-starting' };
      },
      setVisualLabVariant: () => missingCalls.push('variant'),
    });
    expect(missingCalls).toEqual(['backend']);
    expect(missing).toMatchObject({ failure: 'missing-preparer', fixturePrepared: false });

    const throwingCalls = [];
    const throwing = runStartupExpression(resolveVisualLabFixture('oil-motion', 'liquid', 8), {
      backend: () => {
        throwingCalls.push('backend');
        return { backend: 'canvas2d', reason: 'webgl-starting' };
      },
      prepareOilMotionVfxFixture: () => {
        throwingCalls.push('prepare');
        throw new Error('fixture rejected');
      },
      setVisualLabVariant: () => throwingCalls.push('variant'),
    });
    expect(throwingCalls).toEqual(['backend', 'prepare']);
    expect(throwing).toMatchObject({
      failure: 'preparer-threw', preparationError: 'fixture rejected', fixturePrepared: false,
    });
  });

  it('keeps CLI validation fail-fast and compatibility audit aliases intact', () => {
    const auditScript = new URL('./visual-lab-audit.mjs', import.meta.url);
    for (const [argument, message] of [
      ['--domain=powder', '--domain must be gas, liquid, or emission'],
      ['--target=256', '--target must be an integer from 0 through 255'],
      ['--fixture=oil-motion', '--fixture=oil-motion requires --domain=liquid --target=8'],
    ]) {
      const child = spawnSync(process.execPath, [auditScript.pathname, argument], {
        encoding: 'utf8', timeout: 5_000,
      });
      expect(child.status).toBe(1);
      expect(child.stderr).toContain(message);
    }
    const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    expect(packageJson.scripts['audit:vfx:oil-motion']).toBe('npm run audit:visual-lab:oil-motion');
    expect(packageJson.scripts['audit:vfx:oxygen-volume-fold'])
      .toBe('npm run audit:visual-lab:oxygen');
  });
});
