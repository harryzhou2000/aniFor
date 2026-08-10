import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import {
  access, mkdir, mkdtemp, readFile, rm, writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { describe, expect, it } from 'vitest';
import { VISUAL_LAB_PREPARED_FIXTURE_IDS } from '../src/app/visual-lab-fixture-preparation.ts';
import { VISUAL_LAB_IMPLEMENTED_DOMAIN_DESCRIPTORS } from '../src/renderer/visual-lab.ts';
import { isDetachedProcessGroupAlive } from './detached-process.mjs';
import {
  buildVisualLabCaptureUrl,
  buildVisualLabCaptureUrlFromResolvedRequest,
  buildVisualLabCanvasPreparationExpression,
  buildVisualLabStartupExpression,
  createVisualCaptureRequestResolver,
  createVisualLabDomainCatalog,
  resolveVisualCaptureDomain,
  resolveVisualCaptureFixture,
  resolveVisualCaptureRequest,
  resolveVisualLabDomain,
  resolveVisualLabFixture,
  VISUAL_CAPTURE_DOMAIN_ADAPTERS,
  VISUAL_CAPTURE_FIXTURE_ADAPTERS,
  VISUAL_LAB_CAPTURE_PROTOCOL,
  VISUAL_LAB_DOMAIN_ADAPTERS,
  VISUAL_LAB_FIXTURE_ADAPTERS,
  visualLabDomainNames,
  visualCaptureDomainNames,
  visualCaptureFixtureNames,
  visualLabFixtureNames,
  visualLabFixturePreparationLabel,
} from './visual-lab-fixtures.mjs';

const runStartupExpression = (
  adapter, audit, scene = 'showcase', driver = adapter.captureDriver ?? 'normal-hdr',
) => Function(
  'window', 'document', `return ${buildVisualLabStartupExpression(adapter, 2, driver)};`,
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
    expect(JSON.stringify(resolveVisualLabDomain('gas').evidence))
      .toBe('{"readerMethod":"atmosphereFieldAlpha","plane":"atmosphere-alpha"}');
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

  it('adds source-stage Powder and material-lighting domains only to generic capture-facing catalogs', () => {
    expect(visualLabDomainNames()).toEqual(['gas', 'liquid', 'emission']);
    expect(visualCaptureDomainNames()).toEqual([
      'gas', 'liquid', 'emission', 'powder', 'material-lighting',
    ]);
    expect(visualCaptureFixtureNames()).toEqual([
      'showcase', 'oil-motion', 'water-motion', 'powder-style-atlas', 'material-lighting-atlas',
    ]);
    expect(VISUAL_CAPTURE_DOMAIN_ADAPTERS).toHaveLength(5);
    expect(resolveVisualCaptureDomain('powder')).toMatchObject({
      targetKind: 'none',
      driver: 'powder-render-style',
      evidence: { readerMethod: 'powderSurfaceAlpha', plane: 'powder-surface-alpha' },
    });
    expect(JSON.stringify(resolveVisualCaptureDomain('powder').evidence))
      .toBe('{"readerMethod":"powderSurfaceAlpha","plane":"powder-surface-alpha"}');
    expect(resolveVisualCaptureFixture('powder-style-atlas', 'powder', 0))
      .toMatchObject({
        scene: 'showcase',
        captureDriver: 'powder-render-style',
        preparation: { reportLabel: 'preparePowderStyleAtlasFixture' },
      });
    expect(resolveVisualCaptureDomain('material-lighting')).toMatchObject({
      targetKind: 'none',
      driver: 'material-lighting-profile',
      evidence: { readerMethod: 'emissionFieldAlpha', plane: 'emission-alpha' },
    });
    expect(resolveVisualCaptureFixture('material-lighting-atlas', 'material-lighting', 0))
      .toMatchObject({
        scene: 'showcase',
        captureDriver: 'material-lighting-profile',
        preparation: { reportLabel: 'prepareMaterialLightingAtlasFixture' },
      });
    expect(() => resolveVisualLabDomain('powder'))
      .toThrow('--domain must be gas, liquid, or emission');
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
    const url = buildVisualLabCaptureUrl(baseUrl, {
      domain: 'liquid',
      fixture: 'water-motion',
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

  it('accepts only the resolver-issued tuple for pre-resolved URL construction', () => {
    const request = {
      domain: 'gas', fixture: 'showcase', target: 1, gain: 1, renderScale: 2,
    };
    const resolved = resolveVisualCaptureRequest(request);
    expect(buildVisualLabCaptureUrlFromResolvedRequest(
      'https://example.test/app', request, resolved,
    ).searchParams.get('visualTarget')).toBe('1');
    expect(() => buildVisualLabCaptureUrlFromResolvedRequest(
      'https://example.test/app', { ...request, target: 4 }, resolved,
    )).toThrow('canonical resolved request tuple');
    expect(() => buildVisualLabCaptureUrlFromResolvedRequest(
      'https://example.test/app', request, { ...resolved },
    )).toThrow('canonical resolved request tuple');
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
      preparation: { reportLabel: 'prepareOilMotionVfxFixture' },
    });
    expect(visualLabFixturePreparationLabel(adapter)).toBe('prepareOilMotionVfxFixture');
    expect(Object.isFrozen(adapter)).toBe(true);
    expect(Object.isFrozen(adapter.preparation)).toBe(true);
  });

  it('declares Water preparation and its exact liquid target without harness branching', () => {
    const adapter = resolveVisualLabFixture('water-motion', 'liquid', 2);
    expect(adapter).toMatchObject({
      name: 'water-motion',
      scene: 'showcase',
      preparation: { reportLabel: 'prepareLiquidMotionVfxFixture' },
    });
    expect(visualLabFixturePreparationLabel(adapter)).toBe('prepareLiquidMotionVfxFixture');
    expect(Object.isFrozen(adapter)).toBe(true);
    expect(Object.isFrozen(adapter.preparation)).toBe(true);
  });

  it('keeps every prepared adapter in the closed app-owned fixture registry', () => {
    expect(Object.isFrozen(VISUAL_LAB_PREPARED_FIXTURE_IDS)).toBe(true);
    expect(VISUAL_CAPTURE_FIXTURE_ADAPTERS
      .filter(({ preparation }) => preparation !== null)
      .map(({ name }) => name))
      .toEqual(VISUAL_LAB_PREPARED_FIXTURE_IDS);
  });

  it('drives Powder Smooth/Local/Grains without activating the HDR lab domain', () => {
    const resolved = resolveVisualCaptureRequest({
      domain: 'powder', target: 0, fixture: 'powder-style-atlas',
    });
    const adapter = resolved.fixtureAdapter;
    const baseUrl = new URL(
      'https://example.test/app?visualLab=gas&visualVariant=2&visualTarget=4&visualGain=2',
    );
    const url = buildVisualLabCaptureUrl(baseUrl, {
      domain: 'powder', fixture: 'powder-style-atlas',
      target: 0, gain: 1, renderScale: 2,
    });
    expect(Object.fromEntries(['visualLab', 'visualVariant', 'visualTarget', 'visualGain']
      .map((name) => [name, url.searchParams.get(name)]))).toEqual({
      visualLab: null, visualVariant: null, visualTarget: null, visualGain: null,
    });

    const calls = [];
    let variant = 0;
    const result = runStartupExpression(adapter, {
      backend: () => ({ backend: 'canvas2d', reason: 'webgl-starting' }),
      prepareVisualLabFixture: (fixture) => calls.push(`prepare:${fixture}`),
      setPreparedVisualCaptureVariant: (fixture, next) => {
        variant = next;
        calls.push(`select:${fixture}:${next}`);
      },
      preparedVisualCaptureVariant: (fixture) => {
        calls.push(`observe:${fixture}`);
        return variant;
      },
    }, 'showcase');
    expect(calls).toEqual([
      'prepare:powder-style-atlas',
      'select:powder-style-atlas:2',
      'observe:powder-style-atlas',
    ]);
    expect(result).toMatchObject({
      captureDriver: 'powder-render-style', selection: 'grains',
      fixturePrepared: true, stagedBeforeWebGL: true,
    });
  });

  it('prepares a forced Canvas fixture without staging a visual variant', () => {
    const adapter = resolveVisualCaptureRequest({
      domain: 'liquid', target: 2, fixture: 'water-motion',
    }).fixtureAdapter;
    const calls = [];
    const expression = buildVisualLabCanvasPreparationExpression(adapter);
    const result = Function('window', 'document', `return ${expression};`)({
      __ANIFOR_INPUT_AUDIT__: {
        backend: () => ({ backend: 'canvas2d', reason: 'forced' }),
        prepareVisualLabFixture: (fixture) => calls.push(`prepare:${fixture}`),
        refreshPresentationFields: () => calls.push('refresh'),
        setPreparedVisualCaptureVariant: () => calls.push('unexpected-selection'),
      },
    }, {
      querySelector: () => ({ dataset: { scene: 'showcase' } }),
    });
    expect(result).toMatchObject({
      fixture: 'water-motion', backend: 'canvas2d', backendReason: 'forced',
      fixturePrepared: true,
    });
    expect(calls).toEqual(['prepare:water-motion', 'refresh']);
  });

  it('selects drivers by fixture when one domain hosts multiple controls', () => {
    const drivers = new Map([
      ['first-control', Object.freeze({ name: 'first-control', domains: ['shared'] })],
      ['second-control', Object.freeze({ name: 'second-control', domains: ['shared'] })],
    ]);
    const resolveRequest = createVisualCaptureRequestResolver({
      domainAdapters: [Object.freeze({ name: 'shared' })],
      fixtureAdapters: [
        Object.freeze({
          name: 'first-fixture', captureDriver: 'first-control',
          constraints: [Object.freeze({ domain: 'shared', targets: null })],
          requirement: null,
        }),
        Object.freeze({
          name: 'second-fixture', captureDriver: 'second-control',
          constraints: [Object.freeze({ domain: 'shared', targets: null })],
          requirement: null,
        }),
      ],
      driverResolver: (name) => {
        const driver = drivers.get(name);
        if (!driver) throw new Error(`unknown ${name}`);
        return driver;
      },
    });

    expect(resolveRequest({ domain: 'shared', target: 0, fixture: 'first-fixture' })
      .captureDriver.name).toBe('first-control');
    expect(resolveRequest({ domain: 'shared', target: 0, fixture: 'second-fixture' })
      .captureDriver.name).toBe('second-control');
  });

  it('resolves each production request to one frozen fixture-owned driver tuple', () => {
    for (const [request, driver] of [
      [{ domain: 'gas', target: 0, fixture: 'showcase' }, 'normal-hdr'],
      [{ domain: 'liquid', target: 2, fixture: 'water-motion' }, 'normal-hdr'],
      [{ domain: 'powder', target: 0, fixture: 'powder-style-atlas' },
        'powder-render-style'],
      [{ domain: 'material-lighting', target: 0, fixture: 'material-lighting-atlas' },
        'material-lighting-profile'],
    ]) {
      const resolved = resolveVisualCaptureRequest(request);
      expect(resolved.domainAdapter.name).toBe(request.domain);
      expect(resolved.fixtureAdapter.name).toBe(request.fixture);
      expect(resolved.fixtureAdapter.captureDriver).toBe(driver);
      expect(resolved.captureDriver.name).toBe(driver);
      expect(Object.isFrozen(resolved)).toBe(true);
    }
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
    let selectedVariant = 0;
    const audit = {
      backend: () => {
        calls.push('backend');
        return { backend: 'canvas2d', reason: 'webgl-starting' };
      },
      prepareVisualLabFixture: (fixture) => calls.push(`prepare:${fixture}`),
      setPreparedVisualCaptureVariant: (fixture, variant) => {
        selectedVariant = variant;
        calls.push(`select:${fixture}:${variant}`);
      },
      preparedVisualCaptureVariant: (fixture) => {
        calls.push(`observe:${fixture}`);
        return selectedVariant;
      },
    };
    const result = runStartupExpression(
      resolveVisualLabFixture('oil-motion', 'liquid', 8), audit,
    );
    expect(calls).toEqual([
      'backend', 'prepare:oil-motion', 'select:oil-motion:2', 'observe:oil-motion',
    ]);
    expect(result).toMatchObject({
      fixture: 'oil-motion', scene: 'showcase', fixturePrepared: true,
      preparation: 'prepareOilMotionVfxFixture',
      stagedBeforeWebGL: true, backendReasonBeforeSelection: 'webgl-starting',
    });
    const expression = buildVisualLabStartupExpression(
      resolveVisualLabFixture('oil-motion', 'liquid', 8),
    );
    expect(expression).toContain('audit.prepareVisualLabFixture(adapter.name)');
    expect(expression).not.toContain('audit[');
    expect(expression).not.toContain('.apply(');

    calls.length = 0;
    const waterResult = runStartupExpression(
      resolveVisualLabFixture('water-motion', 'liquid', 2), {
        backend: audit.backend,
        prepareVisualLabFixture: (fixture) => calls.push(`prepare:${fixture}`),
        setPreparedVisualCaptureVariant: audit.setPreparedVisualCaptureVariant,
        preparedVisualCaptureVariant: audit.preparedVisualCaptureVariant,
      },
    );
    expect(calls).toEqual([
      'backend', 'prepare:water-motion', 'select:water-motion:2', 'observe:water-motion',
    ]);
    expect(waterResult).toMatchObject({
      fixture: 'water-motion', scene: 'showcase', fixturePrepared: true,
      preparation: 'prepareLiquidMotionVfxFixture',
      stagedBeforeWebGL: true, backendReasonBeforeSelection: 'webgl-starting',
    });
  });

  it('uses the mounted scene for no-op fixtures and fails before mutation on bad adapters', () => {
    const showcaseCalls = [];
    let showcaseVariant = 0;
    const showcase = runStartupExpression(resolveVisualLabFixture('showcase', 'gas', 1), {
      backend: () => {
        showcaseCalls.push('backend');
        return { backend: 'canvas2d', reason: 'webgl-starting' };
      },
      prepareVisualLabFixture: (fixture) => showcaseCalls.push(`prepare:${fixture}`),
      setPreparedVisualCaptureVariant: (fixture, variant) => {
        showcaseVariant = variant;
        showcaseCalls.push(`select:${fixture}:${variant}`);
      },
      preparedVisualCaptureVariant: (fixture) => {
        showcaseCalls.push(`observe:${fixture}`);
        return showcaseVariant;
      },
    });
    expect(showcaseCalls).toEqual([
      'backend', 'prepare:showcase', 'select:showcase:2', 'observe:showcase',
    ]);
    expect(showcase).toMatchObject({ scene: 'showcase', preparation: 'scene' });
    expect(showcase).not.toHaveProperty('captureDriver');
    expect(showcase).not.toHaveProperty('selection');

    const missingCalls = [];
    const missing = runStartupExpression(resolveVisualLabFixture('oil-motion', 'liquid', 8), {
      backend: () => {
        missingCalls.push('backend');
        return { backend: 'canvas2d', reason: 'webgl-starting' };
      },
      setPreparedVisualCaptureVariant: () => missingCalls.push('variant'),
    });
    expect(missingCalls).toEqual(['backend']);
    expect(missing).toMatchObject({ failure: 'missing-preparer', fixturePrepared: false });

    const throwingCalls = [];
    const throwing = runStartupExpression(resolveVisualLabFixture('oil-motion', 'liquid', 8), {
      backend: () => {
        throwingCalls.push('backend');
        return { backend: 'canvas2d', reason: 'webgl-starting' };
      },
      prepareVisualLabFixture: () => {
        throwingCalls.push('prepare');
        throw new Error('fixture rejected');
      },
      setPreparedVisualCaptureVariant: () => throwingCalls.push('variant'),
    });
    expect(throwingCalls).toEqual(['backend', 'prepare']);
    expect(throwing).toMatchObject({
      failure: 'preparer-threw', preparationError: 'fixture rejected', fixturePrepared: false,
    });
  });

  it('keeps CLI validation fail-fast and compatibility audit aliases intact', () => {
    const auditScript = new URL('./visual-lab-audit.mjs', import.meta.url);
    for (const [argument, message] of [
      ['--domain=unknown',
        '--domain must be gas, liquid, emission, powder, or material-lighting'],
      ['--target=256', '--target must be an integer from 0 through 255'],
      ['--domain=gas --render-scale=8',
        '--render-scale for gas must be 1, 2, 4; unsupported paths preserve the baseline'],
      ['--fixture=oil-motion', '--fixture=oil-motion requires --domain=liquid --target=8'],
      ['--fixture=water-motion', '--fixture=water-motion requires --domain=liquid --target=2'],
      ['--lifecycle-file=', '--lifecycle-file must not be empty'],
      ['--browser-host=reuse', '--browser-host must be fresh or shared'],
      ['--browser-host=shared', '--browser-host=shared requires'],
      ['--defer-report=1', '--defer-report=1 requires --browser-host=shared'],
    ]) {
      const child = spawnSync(process.execPath, [
        auditScript.pathname, ...argument.split(' '),
      ], {
        encoding: 'utf8', timeout: 5_000,
      });
      expect(child.status).toBe(1);
      expect(child.stderr).toContain(message);
    }
    const help = spawnSync(process.execPath, [auditScript.pathname, '--help'], {
      encoding: 'utf8', timeout: 5_000,
    });
    expect(help.status).toBe(0);
    expect(help.stdout).toContain('--lifecycle-file=/path/to/state.json');
    const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    expect(packageJson.scripts['audit:visual-lab:capture'])
      .toBe('node scripts/visual-lab-audit.mjs --bundle=dist/index.html');
    expect(packageJson.scripts['audit:visual-lab'])
      .toBe('npm run build && npm run audit:visual-lab:capture --');
    expect(packageJson.scripts['audit:visual-lab:batch:capture'])
      .toBe('node scripts/visual-lab-batch.mjs --bundle=dist/index.html');
    expect(packageJson.scripts['audit:visual-lab:batch'])
      .toBe('npm run build && npm run audit:visual-lab:batch:capture --');
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

  it.skipIf(process.platform === 'win32')(
    'publishes and clears an optional detached-Chrome lifecycle handoff',
    async () => {
      const directory = await mkdtemp(path.join(tmpdir(), 'visual-lab-lifecycle-test-'));
      const fakeChrome = path.join(directory, 'fake-chrome');
      const fakeChromePid = path.join(directory, 'fake-chrome.pid');
      const bundle = path.join(directory, 'index.html');
      const output = path.join(directory, 'capture');
      const lifecycle = path.join(directory, 'handoff', 'lifecycle.json');
      const lifecycleOwner = 'a'.repeat(64);
      await writeFile(fakeChrome, `#!/usr/bin/env node
require('node:fs').writeFileSync(${JSON.stringify(fakeChromePid)}, String(process.pid));
setInterval(() => {}, 1000);
`, { mode: 0o755 });
      await writeFile(bundle, '<!doctype html>');
      await mkdir(output, { recursive: true });
      const auditScript = new URL('./visual-lab-audit.mjs', import.meta.url);
      const child = spawn(process.execPath, [
        auditScript.pathname,
        `--bundle=${bundle}`,
        `--output-dir=${output}`,
        `--chrome=${fakeChrome}`,
        `--lifecycle-file=${lifecycle}`,
        `--lifecycle-owner=${lifecycleOwner}`,
      ], { stdio: ['ignore', 'ignore', 'pipe'] });
      const exited = once(child, 'exit');
      let record;
      let stderr = '';
      child.stderr.on('data', (chunk) => { stderr += chunk; });

      try {
        const deadline = Date.now() + 5_000;
        while (!record && Date.now() < deadline) {
          try { record = JSON.parse(await readFile(lifecycle, 'utf8')); }
          catch { await sleep(20); }
        }
        expect(record, stderr).toMatchObject({
          schema: 'anifor.visual-lab.lifecycle/v1',
          pid: expect.any(Number),
          profile: expect.any(String),
          createdAtMs: expect.any(Number),
          startToken: process.platform === 'linux' ? expect.any(String) : null,
          owner: lifecycleOwner,
        });
        expect(path.isAbsolute(record.profile)).toBe(true);
        expect(isDetachedProcessGroupAlive(record.pid)).toBe(true);
        await expect(access(record.profile)).resolves.toBeUndefined();

        child.kill('SIGTERM');
        const [code] = await exited;
        expect(code).toBe(143);
        await expect(access(lifecycle)).rejects.toMatchObject({ code: 'ENOENT' });
        await expect(access(record.profile)).rejects.toMatchObject({ code: 'ENOENT' });
        expect(isDetachedProcessGroupAlive(record.pid)).toBe(false);
      } finally {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
        let cleanupPid = record?.pid;
        if (!cleanupPid) {
          try { cleanupPid = Number(await readFile(fakeChromePid, 'utf8')); }
          catch { /* Chrome never spawned */ }
        }
        if (Number.isSafeInteger(cleanupPid) && isDetachedProcessGroupAlive(cleanupPid)) {
          try { process.kill(-cleanupPid, 'SIGKILL'); } catch { /* already gone */ }
        }
        await rm(directory, { recursive: true, force: true });
      }
    },
    10_000,
  );

  it.skipIf(process.platform === 'win32')(
    'observes an immediately exiting Chrome before lifecycle publication can yield',
    async () => {
      const directory = await mkdtemp(path.join(tmpdir(), 'visual-lab-startup-race-test-'));
      const fakeChrome = path.join(directory, 'fake-chrome');
      const bundle = path.join(directory, 'index.html');
      const output = path.join(directory, 'capture');
      const lifecycle = path.join(directory, 'handoff', 'lifecycle.json');
      const lifecycleOwner = 'b'.repeat(64);
      await writeFile(fakeChrome, '#!/usr/bin/env node\nprocess.exit(23);\n', { mode: 0o755 });
      await writeFile(bundle, '<!doctype html>');
      const auditScript = new URL('./visual-lab-audit.mjs', import.meta.url);
      const startedAt = Date.now();
      const child = spawnSync(process.execPath, [
        auditScript.pathname,
        `--bundle=${bundle}`,
        `--output-dir=${output}`,
        `--chrome=${fakeChrome}`,
        `--lifecycle-file=${lifecycle}`,
        `--lifecycle-owner=${lifecycleOwner}`,
      ], { encoding: 'utf8', timeout: 5_000 });

      try {
        expect(child.status).toBe(1);
        expect(child.error).toBeUndefined();
        expect(Date.now() - startedAt).toBeLessThan(5_000);
        expect(child.stderr).not.toContain('Chrome DevTools timeout');
        expect(child.stderr).toMatch(/Chrome exited before DevTools|ENOENT|no such file/i);
        await expect(access(lifecycle)).rejects.toMatchObject({ code: 'ENOENT' });
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    },
    10_000,
  );
});
