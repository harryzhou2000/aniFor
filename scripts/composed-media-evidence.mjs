export const COMPOSED_MEDIA_EVIDENCE_VERSION = 3;

const PROFILE_COMPONENTS = Object.freeze({
  'granular-body': Object.freeze({
    macroRelief: [1, (sample) => rise(sample.macroLumaRange, 2, 10)],
    mesostructure: [1, (sample) => band(sample.microContrast, 3, 5, 14, 22)],
    pigmentVariation: [1, (sample) => rise(sample.chromaticContrast, 0.5, 1.5)],
    cohesion: [1, (sample) => rise(sample.dominantComponent ?? 0, 0.90, 0.98)],
    highlightHeadroom: [1, (sample) => fall(sample.clippedFraction, 0.02, 0.08)],
  }),
  'cohesive-liquid': Object.freeze({
    macroDepth: [1, (sample) => rise(sample.macroLumaRange, 1, 8)],
    smoothness: [1, (sample) => fall(sample.microContrast, 2, 6)],
    opticalVariation: [1, (sample) => band(sample.lumaStdDev, 2, 5, 20, 35)],
    continuity: [1, (sample) => rise(sample.dominantComponent ?? 0, 0.90, 0.98)],
    highlightHeadroom: [1, (sample) => fall(sample.clippedFraction, 0.01, 0.05)],
  }),
  'diffuse-gas': Object.freeze({
    macroDepth: [1, (sample) => rise(sample.macroLumaRange, 3, 10)],
    billowDepth: [1, (sample) => band(sample.lumaStdDev, 1.5, 4, 16, 30)],
    softness: [1, (sample) => band(sample.microContrast, 0.5, 2, 10, 18)],
    continuity: [1, (sample) => rise(sample.dominantComponent ?? 0, 0.82, 0.95)],
    highlightHeadroom: [1, (sample) => fall(sample.clippedFraction, 0.01, 0.05)],
  }),
  'rigid-body': Object.freeze({
    macroRelief: [1, (sample) => rise(sample.macroLumaRange, 5, 14)],
    surfaceDetail: [1, (sample) => band(sample.microContrast, 0.25, 1.5, 7, 9)],
    continuity: [1, (sample) => rise(sample.dominantComponent ?? 0, 0.95, 0.995)],
    cavityControl: [1, (sample) => fall(sample.darkFraction, 0.02, 0.08)],
    highlightHeadroom: [1, (sample) => fall(sample.clippedFraction, 0.02, 0.08)],
  }),
  'organic-body': Object.freeze({
    macroVolume: [1, (sample) => rise(sample.macroLumaRange, 4, 12)],
    mesostructure: [1, (sample) => band(sample.microContrast, 1, 3, 10, 18)],
    pigmentVariation: [1, (sample) => rise(sample.chromaticContrast, 0.5, 2)],
    continuity: [1, (sample) => rise(sample.dominantComponent ?? 0, 0.90, 0.98)],
    highlightHeadroom: [1, (sample) => fall(sample.clippedFraction, 0.02, 0.08)],
  }),
  'emissive-volume': Object.freeze({
    volumeRange: [1, (sample) => rise(sample.lumaRange, 10, 40)],
    macroCoreRelief: [1, (sample) => rise(sample.macroLumaRange, 5, 12)],
    auraCoverage: [1, (sample) => rise(sample.coverage, 0.20, 0.60)],
    smoothness: [1, (sample) => fall(sample.microContrast, 4, 8)],
    continuity: [1, (sample) => rise(sample.dominantComponent ?? 0, 0.85, 0.97)],
    highlightHeadroom: [1, (sample) => fall(sample.clippedFraction, 0, 0.02)],
  }),
  'phase-contact': Object.freeze({
    noGap: [1, (sample) => rise(sample.dominantComponent ?? 0, 0.80, 0.95)],
    // samplePageRegions reports mean adjacent normalized-chroma distance, not
    // the much larger two-owner mean distance used by dedicated seam gates.
    chromaticSeparation: [1, (sample) => band(sample.chromaticContrast, 0.4, 1.2, 10, 18)],
    boundedSeamRelief: [1, (sample) => band(sample.microContrast, 0.5, 1.5, 12, 24)],
    macroGrounding: [1, (sample) => rise(sample.macroLumaRange, 2, 12)],
    highlightHeadroom: [1, (sample) => fall(sample.clippedFraction, 0.02, 0.08)],
  }),
});

/**
 * Converts heterogeneous presentation measurements into a profile-specific
 * evidence index. Higher means the expected visual vocabulary is more present;
 * it is a survey signal, never a renderer acceptance threshold. A weighted
 * harmonic mean prevents one strong cue from hiding a missing required cue.
 */
export function scoreComposedMediaSample(sample, profile) {
  const contract = PROFILE_COMPONENTS[profile];
  if (!contract) throw new Error(`Unknown composed-media profile: ${profile}`);
  const components = {};
  const weighted = [];
  for (const [name, [weight, evaluate]] of Object.entries(contract)) {
    const value = saturate(evaluate(sample));
    components[name] = round(value, 4);
    weighted.push({ name, value, weight });
  }
  const qualityIndex = round(weightedHarmonicMean(weighted) * 100, 3);
  const weakest = weighted.reduce((left, right) => right.value < left.value ? right : left);
  return {
    profile,
    qualityIndex,
    priorityDeficit: round(100 - qualityIndex, 3),
    weakestComponent: weakest.name,
    components,
  };
}

/** Uses the weakest required probe so a polished sibling cannot hide a flat one. */
export function selectWeakestComposedMediaEvidence(samples) {
  if (!Array.isArray(samples) || samples.length === 0) {
    throw new Error('Composed-media evidence requires at least one sample');
  }
  const profile = samples[0].profile;
  if (samples.some((sample) => sample.profile !== profile)) {
    throw new Error('Cannot compare unlike composed-media profiles');
  }
  return samples.reduce((left, right) => (
    right.qualityIndex < left.qualityIndex ? right : left
  ));
}

export function composedMediaProfiles() {
  return Object.keys(PROFILE_COMPONENTS);
}

export function rise(value, fail, full) {
  if (!(full > fail)) throw new Error('rise requires full > fail');
  return saturate((value - fail) / (full - fail));
}

export function fall(value, full, fail) {
  if (!(fail > full)) throw new Error('fall requires fail > full');
  return 1 - saturate((value - full) / (fail - full));
}

export function band(value, lowFail, lowFull, highFull, highFail) {
  if (!(lowFail < lowFull && lowFull <= highFull && highFull < highFail)) {
    throw new Error('band requires lowFail < lowFull <= highFull < highFail');
  }
  return Math.min(rise(value, lowFail, lowFull), fall(value, highFull, highFail));
}

export function weightedHarmonicMean(entries) {
  let totalWeight = 0;
  let reciprocal = 0;
  for (const { value, weight } of entries) {
    if (!Number.isFinite(value) || !Number.isFinite(weight) || weight <= 0) {
      throw new Error('Harmonic evidence entries must be finite with positive weights');
    }
    totalWeight += weight;
    reciprocal += weight / Math.max(0.01, saturate(value));
  }
  if (totalWeight === 0) throw new Error('Harmonic evidence requires a positive total weight');
  return totalWeight / reciprocal;
}

function saturate(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
