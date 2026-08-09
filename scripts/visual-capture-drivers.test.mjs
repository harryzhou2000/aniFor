import { describe, expect, it } from 'vitest';
import {
  buildVisualCaptureSelectionExpression,
  resolveVisualCaptureDriver,
  resolveVisualCaptureVariant,
  VISUAL_CAPTURE_DRIVER_NAMES,
  visualCaptureDriverDatasetExpectation,
  visualCaptureDriverReportDescriptor,
  visualCaptureDriverUrlValues,
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

  it('rejects unknown drivers, variants, and dynamic audit identifiers', () => {
    expect(() => resolveVisualCaptureDriver('arbitrary')).toThrow('Unknown visual capture driver');
    expect(() => resolveVisualCaptureVariant('normal-hdr', 8)).toThrow('Unknown normal-hdr');
    expect(() => buildVisualCaptureSelectionExpression('normal-hdr', 0, 'audit.call()'))
      .toThrow('Unsafe visual capture audit identifier');
    expect(runSelection('powder-render-style', 0, {}))
      .toEqual({ ok: false, failure: 'missing-selector' });
  });
});
