/**
 * Closed executable registry for capture evidence readers. Static capture
 * contracts name only a data-plane ID; this trusted scripts-side boundary owns
 * historical report labels and emits a call through one fixed browser bridge.
 */

import { VISUAL_CAPTURE_STATIC_CONTRACT } from '../src/shared/visual-capture-static-contract.js';

const SAFE_PLANE = /^[a-z][a-z0-9-]*$/;
const JS_IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const LEGACY_REPORT_READER_BY_PLANE = Object.freeze({
  'atmosphere-alpha': 'atmosphereFieldAlpha',
  'liquid-alpha': 'liquidFieldAlpha',
  'emission-alpha': 'emissionFieldAlpha',
  'powder-surface-alpha': 'powderSurfaceAlpha',
});

if (JSON.stringify(Object.keys(LEGACY_REPORT_READER_BY_PLANE))
  !== JSON.stringify(VISUAL_CAPTURE_STATIC_CONTRACT.evidencePlanes)) {
  throw new TypeError('Visual capture evidence readers must exactly cover declared plane order');
}

const descriptors = VISUAL_CAPTURE_STATIC_CONTRACT.evidencePlanes.map((plane) => Object.freeze({
  // Preserve the deployed report byte order: readerMethod precedes plane.
  readerMethod: LEGACY_REPORT_READER_BY_PLANE[plane],
  plane,
}));

const descriptorByPlane = new Map();
for (const descriptor of descriptors) {
  if (!SAFE_PLANE.test(descriptor.plane) || descriptorByPlane.has(descriptor.plane)
    || typeof descriptor.readerMethod !== 'string'
    || !JS_IDENTIFIER.test(descriptor.readerMethod)) {
    throw new TypeError(`Invalid visual capture evidence descriptor ${JSON.stringify(descriptor)}`);
  }
  descriptorByPlane.set(descriptor.plane, descriptor);
}

export const VISUAL_CAPTURE_EVIDENCE_DESCRIPTORS = Object.freeze(descriptors);

export function resolveVisualCaptureEvidence(plane) {
  const descriptor = descriptorByPlane.get(plane);
  if (!descriptor) throw new Error(`Unknown visual capture evidence plane ${JSON.stringify(plane)}`);
  return descriptor;
}

/**
 * Converts a data-only plane, or a legacy normal-HDR evidence record, into the
 * historical report descriptor. A legacy method label is accepted only when
 * it exactly matches this closed registry.
 */
export function normalizeVisualCaptureEvidence(evidence) {
  if (evidence === null || typeof evidence !== 'object') {
    throw new TypeError('Visual capture evidence must be an object');
  }
  const keys = Reflect.ownKeys(evidence);
  if (keys.some((key) => key !== 'plane' && key !== 'readerMethod')) {
    throw new TypeError('Visual capture evidence contains unsupported metadata');
  }
  const descriptor = resolveVisualCaptureEvidence(evidence.plane);
  if (evidence.readerMethod !== undefined
    && evidence.readerMethod !== descriptor.readerMethod) {
    throw new TypeError(
      `Visual capture evidence plane ${descriptor.plane} has a mismatched legacy reader`,
    );
  }
  return descriptor;
}

/**
 * Produces a browser closure that calls one fixed typed audit bridge. Neither a
 * static catalog nor a capture request can supply executable names, source, or
 * arguments.
 */
export function buildVisualCaptureEvidenceReaderExpression(
  plane, auditIdentifier = 'audit',
) {
  if (!JS_IDENTIFIER.test(auditIdentifier)) {
    throw new Error(`Unsafe visual capture audit identifier ${JSON.stringify(auditIdentifier)}`);
  }
  const descriptor = resolveVisualCaptureEvidence(plane);
  const failure = JSON.stringify(
    `visual-capture evidence bridge is unavailable: ${descriptor.plane}`,
  );
  return `((x, y) => {
    if (typeof ${auditIdentifier}.visualCaptureEvidenceAlpha !== 'function') {
      throw new Error(${failure});
    }
    return ${auditIdentifier}.visualCaptureEvidenceAlpha(${JSON.stringify(descriptor.plane)}, x, y);
  })`;
}
