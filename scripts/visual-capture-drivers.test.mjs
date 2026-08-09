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
