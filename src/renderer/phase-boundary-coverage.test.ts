import { describe, expect, it } from 'vitest';
import {
  hermiteDerivative, hermiteWeight, phaseContactCompatible, powderBulkWeight,
  quadraticCoverageWeights, roundGrainCoverage, samplePhaseCoverage,
} from './phase-boundary-coverage';

describe('phase boundary coverage', () => {
  it('is monotone, bounded, symmetric, and area preserving', () => {
    let integral = 0;
    const steps = 10_000;
    for (let step = 0; step <= steps; step++) {
      const position = step / steps;
      const weight = hermiteWeight(position);
      expect(weight).toBeGreaterThanOrEqual(0);
      expect(weight).toBeLessThanOrEqual(1);
      expect(weight + hermiteWeight(1 - position)).toBeCloseTo(1, 12);
      if (step < steps) integral += hermiteWeight((step + 0.5) / steps) / steps;
    }
    expect(integral).toBeCloseTo(0.5, 4);
    expect(hermiteDerivative(0)).toBe(0);
    expect(hermiteDerivative(1)).toBe(0);
  });

  it('preserves constant fields and mirrors their analytic gradients', () => {
    for (const value of [0, 1]) {
      expect(samplePhaseCoverage(value, value, value, value, 0.25, 0.75)).toEqual({
        density: value, gradientX: 0, gradientY: 0,
      });
    }
    const horizontal = samplePhaseCoverage(0, 1, 0, 1, 0.25, 0.75);
    const mirrored = samplePhaseCoverage(1, 0, 1, 0, 0.75, 0.25);
    expect(horizontal.density).toBeCloseTo(mirrored.density, 12);
    expect(horizontal.gradientX).toBeCloseTo(-mirrored.gradientX, 12);
    expect(horizontal.gradientY).toBeCloseTo(0, 12);
  });

  it('evaluates every binary corner topology without overshoot', () => {
    for (let mask = 0; mask < 16; mask++) {
      for (const y of [0.25, 0.75]) for (const x of [0.25, 0.75]) {
        const sample = samplePhaseCoverage(
          mask & 1, (mask >> 1) & 1, (mask >> 2) & 1, (mask >> 3) & 1, x, y,
        );
        expect(sample.density).toBeGreaterThanOrEqual(0);
        expect(sample.density).toBeLessThanOrEqual(1);
        expect(Number.isFinite(sample.gradientX)).toBe(true);
        expect(Number.isFinite(sample.gradientY)).toBe(true);
      }
    }
  });

  it('keeps contact coverage phase-aware and solid edges independent of fluids', () => {
    expect(phaseContactCompatible('solid', 'solid')).toBe(true);
    expect(phaseContactCompatible('solid', 'powder')).toBe(false);
    expect(phaseContactCompatible('solid', 'liquid')).toBe(false);
    expect(phaseContactCompatible('solid', 'gas')).toBe(false);
    expect(phaseContactCompatible('powder', 'powder')).toBe(true);
    expect(phaseContactCompatible('powder', 'solid')).toBe(true);
    expect(phaseContactCompatible('liquid', 'liquid')).toBe(true);
    expect(phaseContactCompatible('gas', 'gas')).toBe(true);
    expect(phaseContactCompatible('energy', 'energy')).toBe(false);
  });

  it('changes continuously from a round moving grain to a settled bulk contour', () => {
    expect(powderBulkWeight(1, 0)).toBe(0);
    expect(powderBulkWeight(4, 0)).toBe(1);
    expect(powderBulkWeight(4, 0.2)).toBe(0);
    expect(powderBulkWeight(2.2, 0.05)).toBeGreaterThan(0);
    expect(powderBulkWeight(2.2, 0.05)).toBeLessThan(1);
    expect(roundGrainCoverage(0.5, 0.5)).toBe(1);
    expect(roundGrainCoverage(0, 0)).toBe(0);
    expect(roundGrainCoverage(0.25, 0.25)).toBeCloseTo(
      roundGrainCoverage(0.75, 0.75), 12,
    );
  });

  it('uses a normalized symmetric three-cell kernel for settled powder slopes', () => {
    for (const offset of [-0.5, -0.25, 0, 0.25, 0.5]) {
      const weights = quadraticCoverageWeights(offset);
      expect(weights[0] + weights[1] + weights[2]).toBeCloseTo(1, 12);
      expect(weights.every((weight) => weight >= 0 && weight <= 1)).toBe(true);
      const mirrored = quadraticCoverageWeights(-offset);
      expect(weights[0]).toBeCloseTo(mirrored[2], 12);
      expect(weights[1]).toBeCloseTo(mirrored[1], 12);
    }
  });
});
