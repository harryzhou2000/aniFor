import { describe, expect, it } from 'vitest';

import {
  assertVisualCaptureGeometryUnchanged,
  normalizeVisualCaptureGeometryObservation,
} from './visual-lab-audit.mjs';
import { createVisualCaptureGeometryProof } from '../src/shared/visual-capture-geometry.js';

const observation = (renderScale = 2) => {
  const proof = createVisualCaptureGeometryProof(renderScale);
  return {
    rootMarker: proof.canvas.layoutMarker,
    viewport: { ...proof.viewport },
    canvas: {
      left: proof.canvas.left,
      top: proof.canvas.top,
      width: proof.canvas.width,
      height: proof.canvas.height,
      backingWidth: proof.canvas.backingWidth,
      backingHeight: proof.canvas.backingHeight,
    },
  };
};

describe('Visual Lab capture geometry', () => {
  it('normalizes tiny browser float noise to the frozen shared proof', () => {
    const actual = observation(2);
    actual.viewport.width += 0.0005;
    actual.canvas.left -= 0.0005;

    const normalized = normalizeVisualCaptureGeometryObservation(actual, 2);
    expect(normalized).toEqual(createVisualCaptureGeometryProof(2));
    expect(Object.isFrozen(normalized)).toBe(true);
  });

  it.each([
    ['root marker', (actual) => { actual.rootMarker = 'ordinary-responsive-layout'; }],
    ['device pixel ratio', (actual) => { actual.viewport.devicePixelRatio = 2; }],
    ['visual viewport scale', (actual) => { actual.viewport.visualScale = 1.1; }],
    ['page scroll', (actual) => { actual.viewport.scrollY = 1; }],
    ['capture rect', (actual) => { actual.canvas.width = 917; }],
    ['backing size', (actual) => { actual.canvas.backingHeight--; }],
    ['post-capture geometry drift', (actual) => { actual.canvas.left += 0.01; }],
  ])('rejects %s', (_label, mutate) => {
    const actual = observation(2);
    mutate(actual);
    expect(() => normalizeVisualCaptureGeometryObservation(actual, 2)).toThrow(
      'Visual capture geometry',
    );
  });

  it('requires the two canonical proof reads to remain equal', () => {
    const before = normalizeVisualCaptureGeometryObservation(observation(4), 4);
    const after = normalizeVisualCaptureGeometryObservation(observation(4), 4);
    expect(assertVisualCaptureGeometryUnchanged(before, after)).toBe(before);
    expect(() => assertVisualCaptureGeometryUnchanged(before, createVisualCaptureGeometryProof(2)))
      .toThrow('geometry drifted');
  });
});
