import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildVisualCaptureDatasetProjectionExpression,
  buildVisualCaptureSelectionExpression,
  createVisualCaptureDriverRegistry,
  resolveVisualCaptureDriver,
  resolveVisualCaptureVariant,
  VISUAL_CAPTURE_DRIVER_NAMES,
  visualCaptureDriverDatasetExpectation,
  visualCaptureDriverReportFields,
  visualCaptureDriverReportDescriptor,
  visualCaptureDriverStartupFields,
  visualCaptureDriverUrlValues,
  visualCaptureVariantLabel,
} from './visual-capture-drivers.mjs';

const runSelection = (driver, variant, audit) => Function(
  'audit', `return ${buildVisualCaptureSelectionExpression(driver, variant)};`,
)(audit);

describe('typed visual capture drivers', () => {
  it('maps the real Powder styles through the stable off/A/B capture ABI', () => {
    expect(VISUAL_CAPTURE_DRIVER_NAMES).toEqual(['normal-hdr', 'powder-render-style']);
    const driver = resolveVisualCaptureDriver('powder-render-style');
    expect(driver.variants.map(({ name, selection }) => [name, selection])).toEqual([
      ['off', 'smooth'], ['a', 'local'], ['b', 'grains'],
    ]);
    expect(resolveVisualCaptureVariant(driver, 1).name).toBe('a');
    expect(resolveVisualCaptureVariant(driver, 2).selection).toBe('grains');

    let style = 'smooth';
    const audit = {
      setPowderRenderStyle: (next) => { style = next; },
      powderRenderStyle: () => style,
    };
    expect(runSelection(driver, 0, audit)).toEqual({ ok: true, selection: 'smooth' });
    expect(runSelection(driver, 1, audit)).toEqual({ ok: true, selection: 'local' });
    expect(runSelection(driver, 2, audit)).toEqual({ ok: true, selection: 'grains' });
  });

  it('keeps normal HDR selection and URL state byte-compatible', () => {
    const calls = [];
    expect(runSelection('normal-hdr', 2, {
      setVisualLabVariant: (variant) => calls.push(variant),
    })).toEqual({ ok: true, selection: 2 });
    expect(calls).toEqual([2]);
    const request = { domain: 'gas', target: 4, gain: 1.25 };
    expect(visualCaptureDriverUrlValues('normal-hdr', request)).toEqual({
      visualLab: 'gas', visualVariant: '0', visualTarget: '4', visualGain: '1.25',
    });
    expect(visualCaptureDriverDatasetExpectation('normal-hdr', request, 1)).toEqual({
      visualLab: 'active', visualLabDomain: 'gas', visualLabVariant: '1',
      visualLabTarget: '4', visualLabGain: '1.25',
    });
  });

  it('keeps Powder outside HDR state and publishes self-describing review labels', () => {
    const request = { domain: 'powder', target: 0, gain: 1 };
    expect(visualCaptureDriverUrlValues('powder-render-style', request)).toEqual({
      visualLab: null, visualVariant: null, visualTarget: null, visualGain: null,
    });
    expect(visualCaptureDriverDatasetExpectation('powder-render-style', request, 'a'))
      .toEqual({
        visualLab: 'inactive', visualLabDomain: 'off', visualLabVariant: '0',
        visualLabTarget: '0', visualLabGain: '1', powderRenderStyle: 'local',
      });
    expect(visualCaptureDriverReportDescriptor('powder-render-style')).toEqual({
      name: 'powder-render-style',
      framebufferAlphaPolicy: 'style-owned-nonempty',
      variants: {
        off: { selection: 'smooth', label: 'Smooth' },
        a: { selection: 'local', label: 'Local' },
        b: { selection: 'grains', label: 'Grains' },
      },
    });
  });

  it('owns observed state, startup/report metadata, and labels in one registry', () => {
    const normalObserved = Function(
      'audit', `return ${buildVisualCaptureDatasetProjectionExpression('normal-hdr')};`,
    )({});
    const powderObserved = Function(
      'audit', `return ${buildVisualCaptureDatasetProjectionExpression('powder-render-style')};`,
    )({ powderRenderStyle: () => 'grains' });

    expect(normalObserved).toEqual({});
    expect(powderObserved).toEqual({ powderRenderStyle: 'grains' });
    expect(JSON.stringify(visualCaptureDriverStartupFields('normal-hdr', 2))).toBe('{}');
    expect(JSON.stringify(visualCaptureDriverStartupFields('powder-render-style', 2)))
      .toBe('{"captureDriver":"powder-render-style","selection":"grains"}');
    expect(visualCaptureDriverReportFields('normal-hdr')).toEqual({});
    expect(Object.keys(visualCaptureDriverReportFields('powder-render-style')))
      .toEqual(['captureDriver']);
    expect(['off', 'a', 'b'].map((variant) => (
      visualCaptureVariantLabel('normal-hdr', variant)
    ))).toEqual(['OFF', 'A', 'B']);
    expect(['off', 'a', 'b'].map((variant) => (
      visualCaptureVariantLabel('powder-render-style', variant)
    ))).toEqual(['Smooth', 'Local', 'Grains']);
  });

  it('fails module-style registry construction on missing, orphan, reordered, or invalid adapters', () => {
    const declarations = [Object.freeze({ name: 'first' }), Object.freeze({ name: 'second' })];
    const adapter = () => ({
      urlValues: () => ({}),
      datasetExpectation: () => ({}),
      selectionExpression: () => 'true',
      datasetProjectionExpression: () => '({})',
      publishesReportDescriptor: true,
      reportMismatch: 'mismatch',
    });

    expect(() => createVisualCaptureDriverRegistry(declarations, { first: adapter() }))
      .toThrow('missing second');
    expect(() => createVisualCaptureDriverRegistry(declarations, {
      first: adapter(), second: adapter(), orphan: adapter(),
    })).toThrow('undeclared orphan');
    expect(() => createVisualCaptureDriverRegistry(declarations, {
      second: adapter(), first: adapter(),
    })).toThrow('adapter order differs');
    expect(() => createVisualCaptureDriverRegistry(declarations, {
      first: { ...adapter(), extra: true }, second: adapter(),
    })).toThrow('invalid executable adapter');
    expect(() => createVisualCaptureDriverRegistry(declarations, {
      first: Object.fromEntries(Object.entries(adapter()).reverse()), second: adapter(),
    })).toThrow('invalid executable adapter');
    const nonEnumerable = {};
    for (const [name, value] of Object.entries(adapter())) {
      Object.defineProperty(nonEnumerable, name, { value });
    }
    expect(() => createVisualCaptureDriverRegistry(declarations, {
      first: nonEnumerable, second: adapter(),
    })).toThrow('invalid executable adapter');
    expect(() => createVisualCaptureDriverRegistry(declarations, {
      first: { ...adapter(), selectionExpression: null }, second: adapter(),
    })).toThrow('invalid executable adapter');

    const registry = createVisualCaptureDriverRegistry(declarations, {
      first: adapter(), second: adapter(),
    });
    expect(registry.names).toEqual(['first', 'second']);
    expect(Object.isFrozen(registry)).toBe(true);
    expect(Object.isFrozen(registry.names)).toBe(true);
  });

  it('keeps request consumers free of domain-owned or driver-name dispatch', () => {
    for (const file of [
      'visual-lab-audit.mjs',
      'visual-lab-batch.mjs',
      'visual-lab-baseline.mjs',
      'visual-lab-execution-plan.mjs',
      'visual-lab-recipes.mjs',
    ]) {
      const source = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
      expect(source).not.toMatch(/(?:captureDriver|driver)\.name\s*===/);
      expect(source).not.toMatch(/(?:domainAdapter|domain)\.driver/);
      expect(source).not.toMatch(/===\s*['"]powder-render-style['"]/);
    }
  });

  it('exposes an import-safe page-scoped capture transaction', async () => {
    const audit = await import('./visual-lab-audit.mjs');
    expect(typeof audit.captureVisualLabCandidatePage).toBe('function');
    expect(typeof audit.disposeVisualLabCandidatePage).toBe('function');
    expect(typeof audit.digestVisualLabFramebufferAlpha).toBe('function');
    const source = readFileSync(new URL('./visual-lab-audit.mjs', import.meta.url), 'utf8');
    expect(source).toContain('entry: options.executionPlan');
    expect(source).toContain('createVisualLabCaptureSubphaseTimingRecorder');
    expect(source).toContain('captureSubphases: captureSubphases.finish()');
    expect(source).toContain("measureSnapshot(\n        'readiness'");
    expect(source).toContain("pageCdp.send('Page.enable')");
    expect(source).toContain('browserErrors = collectBrowserErrors(pageCdp)');
    expect(source).toContain('realpathSync(process.argv[1]) === realpathSync(MODULE_PATH)');
    expect(source).not.toMatch(/export async function captureVisualLabCandidatePage\(cdp, options/);
  });

  it('keeps the direct framebuffer-alpha digest byte-identical to the legacy grid walk', async () => {
    const { digestVisualLabFramebufferAlpha } = await import('./visual-lab-audit.mjs');
    const rgba = new Uint8Array([
      1, 2, 3, 0,
      4, 5, 6, 255,
      7, 8, 9, 17,
      10, 11, 12, 0,
      13, 14, 15, 128,
      16, 17, 18, 1,
    ]);
    let hash = 2166136261 >>> 0;
    let supportHash = 2166136261 >>> 0;
    let alphaSum = 0;
    let nonzero = 0;
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 3; x++) {
        const index = y * 3 + x;
        const byte = rgba[index * 4 + 3];
        const supported = Number(byte > 0);
        hash = Math.imul((hash ^ byte ^ index) >>> 0, 16777619) >>> 0;
        supportHash = Math.imul((supportHash ^ supported ^ index) >>> 0, 16777619) >>> 0;
        alphaSum += byte;
        nonzero += supported;
      }
    }
    expect(digestVisualLabFramebufferAlpha(rgba)).toEqual({
      hash, supportHash, alphaSum, nonzero,
    });
  });

  it('requires explicit renderer disposal before a successful capture can publish', async () => {
    const { disposeVisualLabCandidatePage } = await import('./visual-lab-audit.mjs');
    const calls = [];
    const pageCdp = {
      send: async (method, params, timeoutMs) => {
        calls.push({ method, params, timeoutMs });
        return { result: { value: true } };
      },
    };

    await expect(disposeVisualLabCandidatePage({ pageCdp, browserErrors: [] }))
      .resolves.toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('Runtime.evaluate');
    expect(calls[0].params.awaitPromise).toBe(true);
    expect(calls[0].params.expression).toContain('disposeRendererForNavigation');
    expect(calls[0].timeoutMs).toBe(5_000);

    const unavailableCdp = {
      send: async () => ({ result: { value: false } }),
    };
    await expect(disposeVisualLabCandidatePage({ pageCdp: unavailableCdp }))
      .rejects.toThrow(/did not acknowledge renderer disposal/);
    await expect(disposeVisualLabCandidatePage({
      pageCdp: unavailableCdp,
      required: false,
    })).resolves.toBe(false);
    await expect(disposeVisualLabCandidatePage({
      pageCdp,
      browserErrors: ['late WebGL failure'],
    })).rejects.toThrow(/through renderer teardown.*late WebGL failure/);
  });

  it('keeps nested capture and teardown diagnostics in bounded CLI errors', async () => {
    const { formatVisualLabCliError } = await import('./visual-lab-audit.mjs');
    const error = new AggregateError([
      new Error('capture sentinel'),
      new AggregateError([
        new Error('renderer sentinel'),
        new Error('host sentinel'),
      ], 'cleanup sentinel'),
    ], 'candidate sentinel');
    const message = formatVisualLabCliError(error);
    expect(message).toContain('candidate sentinel');
    expect(message).toContain('capture sentinel');
    expect(message).toContain('cleanup sentinel');
    expect(message).toContain('renderer sentinel');
    expect(message).toContain('host sentinel');
    expect(message.length).toBeLessThanOrEqual(8_000);
  });

  it('retains the lifecycle handoff when Chrome profile cleanup needs supervisor retry', async () => {
    const { removeVisualLabHostArtifacts } = await import('./visual-lab-audit.mjs');
    const profile = '/tmp/anifor-visual-lab-chrome-test';
    const lifecycleFile = '/tmp/anifor-visual-lab-lifecycle-test.json';
    const failedCalls = [];
    await expect(removeVisualLabHostArtifacts({
      profile,
      lifecycleFile,
      lifecyclePublished: true,
      remove: async (target) => {
        failedCalls.push(target);
        if (target === profile) throw new Error('profile retry sentinel');
      },
    })).rejects.toThrow(/profile retry sentinel/);
    expect(failedCalls).toEqual([profile]);

    const successfulCalls = [];
    await expect(removeVisualLabHostArtifacts({
      profile,
      lifecycleFile,
      lifecyclePublished: true,
      remove: async (target) => { successfulCalls.push(target); },
    })).resolves.toEqual({ profileRemoved: true, lifecycleRemoved: true });
    expect(successfulCalls).toEqual([profile, lifecycleFile]);
  });

  it('rejects unknown drivers, variants, and dynamic audit identifiers', () => {
    expect(() => resolveVisualCaptureDriver('arbitrary')).toThrow('Unknown visual capture driver');
    expect(() => resolveVisualCaptureVariant('normal-hdr', 8)).toThrow('Unknown normal-hdr');
    expect(() => buildVisualCaptureSelectionExpression('normal-hdr', 0, 'audit.call()'))
      .toThrow('Unsafe visual capture audit identifier');
    expect(() => buildVisualCaptureDatasetProjectionExpression(
      'normal-hdr', 'audit.call()',
    )).toThrow('Unsafe visual capture audit identifier');
    expect(runSelection('powder-render-style', 0, {}))
      .toEqual({ ok: false, failure: 'missing-selector' });
  });
});
