/**
 * Closed executable side of the data-only visual-capture driver contract.
 * Catalog data selects one known driver; it never supplies browser method
 * names, argument arrays, or executable source.
 */

import { VISUAL_CAPTURE_STATIC_CONTRACT } from '../src/shared/visual-capture-static-contract.js';
import { VISUAL_LAB_CAPTURE_VARIANTS } from './visual-lab-capture-abi.mjs';

const DRIVER_BY_NAME = new Map(
  VISUAL_CAPTURE_STATIC_CONTRACT.drivers.map((driver) => [driver.name, driver]),
);

const JS_IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export const VISUAL_CAPTURE_DRIVER_NAMES = Object.freeze(
  VISUAL_CAPTURE_STATIC_CONTRACT.drivers.map(({ name }) => name),
);

export function resolveVisualCaptureDriver(name) {
  const driver = DRIVER_BY_NAME.get(name);
  if (!driver) throw new Error(`Unknown visual capture driver ${JSON.stringify(name)}`);
  return driver;
}

export function resolveVisualCaptureVariant(driverOrName, valueOrName) {
  const driver = typeof driverOrName === 'string'
    ? resolveVisualCaptureDriver(driverOrName) : driverOrName;
  const variant = driver.variants.find((candidate) => (
    candidate.name === valueOrName
      || VISUAL_LAB_CAPTURE_VARIANTS.find(({ name }) => name === candidate.name)?.value
        === valueOrName
  ));
  if (!variant) {
    throw new Error(`Unknown ${driver.name} capture variant ${JSON.stringify(valueOrName)}`);
  }
  return variant;
}

export function visualCaptureDriverUrlValues(driverOrName, request) {
  const driver = typeof driverOrName === 'string'
    ? resolveVisualCaptureDriver(driverOrName) : driverOrName;
  if (driver.name === 'normal-hdr') {
    return Object.freeze({
      visualLab: request.domain,
      visualVariant: '0',
      visualTarget: String(request.target),
      visualGain: String(request.gain),
    });
  }
  if (driver.name === 'powder-render-style') {
    return Object.freeze({
      visualLab: null,
      visualVariant: null,
      visualTarget: null,
      visualGain: null,
    });
  }
  throw new Error(`Visual capture driver ${driver.name} has no URL adapter`);
}

export function visualCaptureDriverDatasetExpectation(
  driverOrName, request, valueOrName,
) {
  const driver = typeof driverOrName === 'string'
    ? resolveVisualCaptureDriver(driverOrName) : driverOrName;
  const variant = resolveVisualCaptureVariant(driver, valueOrName);
  if (driver.name === 'normal-hdr') {
    const value = VISUAL_LAB_CAPTURE_VARIANTS.find(({ name }) => name === variant.name).value;
    return Object.freeze({
      visualLab: value === 0 ? 'inactive' : 'active',
      visualLabDomain: request.domain,
      visualLabVariant: String(value),
      visualLabTarget: String(request.target),
      visualLabGain: String(request.gain),
    });
  }
  if (driver.name === 'powder-render-style') {
    return Object.freeze({
      visualLab: 'inactive',
      visualLabDomain: 'off',
      visualLabVariant: '0',
      visualLabTarget: '0',
      visualLabGain: '1',
      powderRenderStyle: variant.selection,
    });
  }
  throw new Error(`Visual capture driver ${driver.name} has no dataset adapter`);
}

/** Browser expression that references only one caller-supplied, validated audit identifier. */
export function buildVisualCaptureSelectionExpression(
  driverOrName, valueOrName, auditIdentifier = 'audit',
) {
  if (!JS_IDENTIFIER.test(auditIdentifier)) {
    throw new Error(`Unsafe visual capture audit identifier ${JSON.stringify(auditIdentifier)}`);
  }
  const driver = typeof driverOrName === 'string'
    ? resolveVisualCaptureDriver(driverOrName) : driverOrName;
  const variant = resolveVisualCaptureVariant(driver, valueOrName);
  if (driver.name === 'normal-hdr') {
    const value = VISUAL_LAB_CAPTURE_VARIANTS.find(({ name }) => name === variant.name).value;
    return `(() => {
      if (typeof ${auditIdentifier}.setVisualLabVariant !== 'function') {
        return { ok: false, failure: 'missing-selector' };
      }
      ${auditIdentifier}.setVisualLabVariant(${value});
      return { ok: true, selection: ${value} };
    })()`;
  }
  if (driver.name === 'powder-render-style') {
    const style = JSON.stringify(variant.selection);
    return `(() => {
      if (typeof ${auditIdentifier}.setPowderRenderStyle !== 'function'
        || typeof ${auditIdentifier}.powderRenderStyle !== 'function') {
        return { ok: false, failure: 'missing-selector' };
      }
      ${auditIdentifier}.setPowderRenderStyle(${style});
      const observed = ${auditIdentifier}.powderRenderStyle();
      return observed === ${style}
        ? { ok: true, selection: observed }
        : { ok: false, failure: 'selection-mismatch', selection: observed };
    })()`;
  }
  throw new Error(`Visual capture driver ${driver.name} has no browser selector`);
}

export function visualCaptureDriverReportDescriptor(driverOrName) {
  const driver = typeof driverOrName === 'string'
    ? resolveVisualCaptureDriver(driverOrName) : driverOrName;
  return Object.freeze({
    name: driver.name,
    framebufferAlphaPolicy: driver.framebufferAlphaPolicy,
    variants: Object.freeze(Object.fromEntries(
      driver.variants.map(({ name, selection, label }) => [
        name, Object.freeze({ selection, label }),
      ]),
    )),
  });
}
