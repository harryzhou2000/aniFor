import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VISUAL_LAB_IMPLEMENTED_DOMAIN_DESCRIPTORS } from '../src/renderer/visual-lab.ts';
import {
  buildVisualLabCaptureUrl,
  buildVisualLabStartupExpression,
  createVisualLabDomainCatalog,
  resolveVisualLabDomain,
  resolveVisualLabFixture,
  VISUAL_LAB_CAPTURE_PROTOCOL,
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
  it('centralizes the common capture protocol and domain capability profiles', () => {
    expect(VISUAL_LAB_CAPTURE_PROTOCOL).toEqual({
      fixedUrlParameters: {
        inputAudit: '1',
        auditStage: 'visual-lab',
        renderLook: 'realistic',
        visualLabAudit: '1',
      },
      dynamicUrlParameterNames: [
        'scene', 'renderScale', 'visualLab', 'visualVariant',
        'visualTarget', 'visualGain', 'renderer',
      ],
      datasetRequirements: {
        renderer: 'semantic-field-webgl',
        hdrPipeline: 'active',
      },
    });
    expect(visualLabDomainNames()).toEqual(['gas', 'liquid', 'emission']);
    expect(resolveVisualLabDomain('gas')).toMatchObject({
      targetKind: 'propagated-atmosphere-style-byte',
      executionProfile: {
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
      },
      evidence: { readerMethod: 'atmosphereFieldAlpha', plane: 'atmosphere-alpha' },
      fixedUrlParameters: {},
    });
    expect(resolveVisualLabDomain('liquid')).toMatchObject({
      targetKind: 'semantic-material-id',
      executionProfile: { detailScales: [1, 2, 4] },
      evidence: { readerMethod: 'liquidFieldAlpha', plane: 'liquid-alpha' },
      fixedUrlParameters: { liquidBodyVfx: '1', liquidSurfaceVfx: '1' },
    });
    expect(resolveVisualLabDomain('emission').evidence).toEqual({
      readerMethod: 'emissionFieldAlpha', plane: 'emission-alpha',
    });
    expect(() => resolveVisualLabDomain('powder'))
      .toThrow('--domain must be gas, liquid, or emission');
  });

  it('matches renderer capability domains, targets, and execution profiles exactly', () => {
    const renderer = Object.entries(VISUAL_LAB_IMPLEMENTED_DOMAIN_DESCRIPTORS)
      .map(([domain, { targetKind, executionProfile }]) => ({
        domain, targetKind, executionProfile,
      }))
      .sort((left, right) => left.domain.localeCompare(right.domain));
    const capture = VISUAL_LAB_DOMAIN_ADAPTERS
      .map(({ name: domain, targetKind, executionProfile }) => ({
        domain, targetKind, executionProfile,
      }))
      .sort((left, right) => left.domain.localeCompare(right.domain));

    expect(capture).toEqual(renderer);
  });

  it('rejects domain fixed parameters that collide with common or dynamic protocol keys', () => {
    const base = {
      name: 'test',
      targetKind: 'semantic-material-id',
      evidence: { readerMethod: 'testFieldAlpha', plane: 'test-alpha' },
    };
    const protectedNames = [
      ...Object.keys(VISUAL_LAB_CAPTURE_PROTOCOL.fixedUrlParameters),
      ...VISUAL_LAB_CAPTURE_PROTOCOL.dynamicUrlParameterNames,
    ];
    for (const parameterName of protectedNames) {
      expect(() => createVisualLabDomainCatalog([{
        ...base, fixedUrlParameters: { [parameterName]: 'collision' },
      }])).toThrow(`fixed URL parameter ${JSON.stringify(parameterName)}`);
    }

    expect(createVisualLabDomainCatalog([{
      ...base, fixedUrlParameters: { liquidBodyVfx: '1' },
    }])[0].fixedUrlParameters).toEqual({ liquidBodyVfx: '1' });
  });

  it('builds capture URLs from the protocol while preserving unrelated parameters', () => {
    const baseUrl = new URL(
      'https://example.test/app?keep=retained&inputAudit=hostile&auditStage=hostile'
      + '&renderLook=classic&visualLabAudit=0&scene=hostile&renderScale=8'
      + '&visualLab=powder&visualVariant=2&visualTarget=255&visualGain=2'
      + '&renderer=canvas&liquidBodyVfx=0&liquidSurfaceVfx=0',
    );
    const domainAdapter = resolveVisualLabDomain('liquid');
    const fixtureAdapter = resolveVisualLabFixture('water-motion', 'liquid', 2);
    const url = buildVisualLabCaptureUrl(baseUrl, {
      fixtureAdapter,
      domainAdapter,
      domain: 'liquid',
      target: 2,
      gain: 1.25,
      renderScale: 4,
    });

    expect(url).not.toBe(baseUrl);
    expect(baseUrl.searchParams.get('renderer')).toBe('canvas');
    expect(Object.fromEntries([...url.searchParams].filter(([name]) => (
      Object.hasOwn(VISUAL_LAB_CAPTURE_PROTOCOL.fixedUrlParameters, name)
    )))).toEqual(VISUAL_LAB_CAPTURE_PROTOCOL.fixedUrlParameters);
    expect(Object.fromEntries(VISUAL_LAB_CAPTURE_PROTOCOL.dynamicUrlParameterNames.map((name) => [
      name, url.searchParams.get(name),
    ]))).toEqual({
      scene: 'showcase',
      renderScale: '4',
      visualLab: 'liquid',
      visualVariant: '0',
      visualTarget: '2',
      visualGain: '1.25',
      renderer: null,
    });
    expect(url.searchParams.get('liquidBodyVfx')).toBe('1');
    expect(url.searchParams.get('liquidSurfaceVfx')).toBe('1');
    expect(url.searchParams.get('keep')).toBe('retained');
  });

  it('keeps the general showcase compatible with every implemented capture domain', () => {
    expect(visualLabFixtureNames()).toEqual(['showcase', 'oil-motion', 'water-motion']);
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

  it('declares Water preparation and its exact liquid target without harness branching', () => {
    const adapter = resolveVisualLabFixture('water-motion', 'liquid', 2);
    expect(adapter).toMatchObject({
      name: 'water-motion',
      scene: 'showcase',
      preparation: { method: 'prepareLiquidMotionVfxFixture', args: ['moving'] },
    });
    expect(Object.isFrozen(adapter)).toBe(true);
    expect(Object.isFrozen(adapter.preparation.args)).toBe(true);
  });

  it('rejects unknown fixtures and incompatible domain/target pairs early', () => {
    expect(() => resolveVisualLabFixture('missing', 'gas', 1))
      .toThrow('--fixture must be showcase, oil-motion, or water-motion');
    expect(() => resolveVisualLabFixture('oil-motion', 'gas', 8))
      .toThrow('--fixture=oil-motion requires --domain=liquid --target=8');
    expect(() => resolveVisualLabFixture('oil-motion', 'liquid', 2))
      .toThrow('--fixture=oil-motion requires --domain=liquid --target=8');
    expect(() => resolveVisualLabFixture('water-motion', 'gas', 2))
      .toThrow('--fixture=water-motion requires --domain=liquid --target=2');
    expect(() => resolveVisualLabFixture('water-motion', 'liquid', 8))
      .toThrow('--fixture=water-motion requires --domain=liquid --target=2');
  });

  it('keeps the protocol and every nested adapter value JSON-safe and deeply frozen', () => {
    expect(() => JSON.stringify({
      protocol: VISUAL_LAB_CAPTURE_PROTOCOL,
      domains: VISUAL_LAB_DOMAIN_ADAPTERS,
      fixtures: VISUAL_LAB_FIXTURE_ADAPTERS,
    })).not.toThrow();
    expect(Object.isFrozen(VISUAL_LAB_CAPTURE_PROTOCOL)).toBe(true);
    expect(Object.isFrozen(VISUAL_LAB_CAPTURE_PROTOCOL.fixedUrlParameters)).toBe(true);
    expect(Object.isFrozen(VISUAL_LAB_CAPTURE_PROTOCOL.dynamicUrlParameterNames)).toBe(true);
    expect(Object.isFrozen(VISUAL_LAB_CAPTURE_PROTOCOL.datasetRequirements)).toBe(true);
    for (const adapter of [...VISUAL_LAB_DOMAIN_ADAPTERS, ...VISUAL_LAB_FIXTURE_ADAPTERS]) {
      expect(Object.isFrozen(adapter)).toBe(true);
    }
    const [firstDomain] = VISUAL_LAB_DOMAIN_ADAPTERS;
    for (const adapter of VISUAL_LAB_DOMAIN_ADAPTERS) {
      expect(adapter.executionProfile).toBe(firstDomain.executionProfile);
      expect(Object.isFrozen(adapter.executionProfile)).toBe(true);
      expect(Object.isFrozen(adapter.executionProfile.detailScales)).toBe(true);
      expect(Object.isFrozen(adapter.executionProfile.fallbacks)).toBe(true);
      expect(Object.isFrozen(adapter.evidence)).toBe(true);
      expect(Object.isFrozen(adapter.fixedUrlParameters)).toBe(true);
      expect(JSON.parse(JSON.stringify(adapter))).toEqual(adapter);
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

    calls.length = 0;
    const waterResult = runStartupExpression(
      resolveVisualLabFixture('water-motion', 'liquid', 2), {
        backend: audit.backend,
        prepareLiquidMotionVfxFixture: (mode) => calls.push(`prepare-water:${mode}`),
        setVisualLabVariant: audit.setVisualLabVariant,
      },
    );
    expect(calls).toEqual(['backend', 'prepare-water:moving', 'variant:2']);
    expect(waterResult).toMatchObject({
      fixture: 'water-motion', scene: 'showcase', fixturePrepared: true,
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
      ['--domain=gas --render-scale=8',
        '--render-scale for gas must be 1, 2, 4; unsupported paths preserve the baseline'],
      ['--fixture=oil-motion', '--fixture=oil-motion requires --domain=liquid --target=8'],
      ['--fixture=water-motion', '--fixture=water-motion requires --domain=liquid --target=2'],
    ]) {
      const child = spawnSync(process.execPath, [
        auditScript.pathname, ...argument.split(' '),
      ], {
        encoding: 'utf8', timeout: 5_000,
      });
      expect(child.status).toBe(1);
      expect(child.stderr).toContain(message);
    }
    const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    expect(packageJson.scripts['audit:visual-lab:capture'])
      .toBe('node scripts/visual-lab-audit.mjs --bundle=dist/index.html');
    expect(packageJson.scripts['audit:visual-lab'])
      .toBe('npm run build && npm run audit:visual-lab:capture --');
    for (const [scriptName, candidate] of [
      ['audit:visual-lab:oxygen', 'oxygen-showcase'],
      ['audit:visual-lab:oil-motion', 'oil-motion'],
      ['audit:visual-lab:water-motion', 'water-motion'],
    ]) {
      const command = packageJson.scripts[scriptName];
      expect(command).toContain(`npm run audit:visual-lab:capture -- --candidate=${candidate}`);
      expect(command).not.toMatch(/--(?:domain|target|fixture|gain|render-scale)=/);
    }
    expect(packageJson.scripts['audit:visual-lab:oxygen'])
      .toContain("pixi-field-presenter.test.ts -t 'keeps accepted E62'");
    expect(packageJson.scripts['audit:visual-lab:oil-motion'])
      .toContain("hdr-vfx-pipeline.test.ts -t 'keeps accepted E69 exact-Oil slick'");
    expect(packageJson.scripts['audit:visual-lab:water-motion'])
      .toContain("hdr-vfx-pipeline.test.ts -t 'exact-Water velocity'");
    expect(packageJson.scripts['audit:vfx:oil-motion']).toBe('npm run audit:visual-lab:oil-motion');
    expect(packageJson.scripts['audit:vfx:liquid-motion'])
      .toBe('npm run audit:visual-lab:water-motion');
    expect(packageJson.scripts['audit:vfx:oxygen-volume-fold'])
      .toBe('npm run audit:visual-lab:oxygen');
  });
});
