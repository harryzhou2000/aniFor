import { describe, expect, it } from 'vitest';
import {
  band,
  composedMediaProfiles,
  fall,
  rise,
  scoreComposedMediaSample,
  selectWeakestComposedMediaEvidence,
  weightedHarmonicMean,
} from './composed-media-evidence.mjs';

const sample = (overrides = {}) => ({
  lumaStdDev: 10,
  macroLumaRange: 10,
  microContrast: 5,
  chromaticContrast: 12,
  coverage: 0.55,
  lumaRange: 80,
  dominantComponent: 0.99,
  darkFraction: 0.01,
  pinnedFraction: 0,
  clippedFraction: 0,
  ...overrides,
});

describe('composed media evidence', () => {
  it('normalizes monotone and bounded-band evidence', () => {
    expect([rise(0, 0, 10), rise(5, 0, 10), rise(12, 0, 10)]).toEqual([0, 0.5, 1]);
    expect([fall(0, 0, 10), fall(5, 0, 10), fall(12, 0, 10)]).toEqual([1, 0.5, 0]);
    expect([band(0, 1, 3, 7, 9), band(3, 1, 3, 7, 9), band(7, 1, 3, 7, 9),
      band(10, 1, 3, 7, 9)]).toEqual([0, 1, 1, 0]);
  });

  it('covers every production media vocabulary with bounded deficit indices', () => {
    expect(composedMediaProfiles()).toEqual([
      'granular-body', 'cohesive-liquid', 'diffuse-gas', 'rigid-body',
      'organic-body', 'emissive-volume', 'phase-contact',
    ]);
    for (const profile of composedMediaProfiles()) {
      const evidence = scoreComposedMediaSample(sample(), profile);
      expect(evidence.qualityIndex).toBeGreaterThanOrEqual(0);
      expect(evidence.qualityIndex).toBeLessThanOrEqual(100);
      expect(evidence.priorityDeficit).toBeCloseTo(100 - evidence.qualityIndex, 5);
      expect(Object.values(evidence.components).every((value) => value >= 0 && value <= 1))
        .toBe(true);
    }
  });

  it('makes one missing required cue dominate the harmonic score', () => {
    const complete = weightedHarmonicMean([
      { value: 0.8, weight: 1 }, { value: 0.8, weight: 1 }, { value: 0.8, weight: 1 },
    ]);
    const missing = weightedHarmonicMean([
      { value: 1, weight: 1 }, { value: 1, weight: 1 }, { value: 0, weight: 1 },
    ]);
    expect(complete).toBeCloseTo(0.8, 8);
    expect(missing).toBeLessThan(0.04);
  });

  it('penalizes grain noise for liquid/gas while rewarding bounded powder detail', () => {
    const smoothLiquid = scoreComposedMediaSample(sample({ microContrast: 2 }), 'cohesive-liquid');
    const noisyLiquid = scoreComposedMediaSample(sample({ microContrast: 14 }), 'cohesive-liquid');
    const smoothGas = scoreComposedMediaSample(sample({ microContrast: 0.35 }), 'diffuse-gas');
    const noisyGas = scoreComposedMediaSample(sample({ microContrast: 1.5 }), 'diffuse-gas');
    const detailedPowder = scoreComposedMediaSample(sample({ microContrast: 8 }), 'granular-body');
    const flatPowder = scoreComposedMediaSample(sample({ microContrast: 2 }), 'granular-body');
    expect(smoothLiquid.qualityIndex).toBeGreaterThan(noisyLiquid.qualityIndex);
    expect(smoothGas.qualityIndex).toBeGreaterThan(noisyGas.qualityIndex);
    expect(detailedPowder.qualityIndex).toBeGreaterThan(flatPowder.qualityIndex);
  });

  it('penalizes fragmented gas and clipped emission in their owning profiles', () => {
    const joined = scoreComposedMediaSample(
      sample({ microContrast: 0.35 }), 'diffuse-gas',
    );
    const fragmented = scoreComposedMediaSample(
      sample({ microContrast: 0.35, dominantComponent: 0.2 }), 'diffuse-gas',
    );
    const clean = scoreComposedMediaSample(sample(), 'emissive-volume');
    const clipped = scoreComposedMediaSample(sample({ clippedFraction: 0.2 }), 'emissive-volume');
    expect(joined.qualityIndex).toBeGreaterThan(fragmented.qualityIndex + 20);
    expect(clean.qualityIndex).toBeGreaterThan(clipped.qualityIndex + 20);
  });

  it('keeps the frozen pre-E27 Smoke frame soft while diagnosing broad billow depth', () => {
    const smoke = scoreComposedMediaSample(sample({
      lumaStdDev: 1.88,
      macroLumaRange: 8,
      microContrast: 0.37,
      chromaticContrast: 0.54,
      dominantComponent: 1,
      clippedFraction: 0,
    }), 'diffuse-gas');
    expect(smoke.components.softness).toBe(1);
    expect(smoke.weakestComponent).toBe('billowDepth');
    expect(smoke.qualityIndex).toBe(45.542);
  });

  it('selects the weakest like-profile probe and rejects incompatible media', () => {
    const strong = scoreComposedMediaSample(sample(), 'organic-body');
    const weak = scoreComposedMediaSample(sample({ macroLumaRange: 2 }), 'organic-body');
    expect(selectWeakestComposedMediaEvidence([strong, weak])).toBe(weak);
    expect(() => selectWeakestComposedMediaEvidence([
      strong, scoreComposedMediaSample(sample(), 'rigid-body'),
    ])).toThrow('unlike composed-media profiles');
  });
});
