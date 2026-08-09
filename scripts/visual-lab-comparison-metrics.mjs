import { createHash } from 'node:crypto';

import {
  VISUAL_LAB_CAPTURE_VARIANT_NAMES as VARIANTS,
} from './visual-lab-capture-abi.mjs';
import { decodeVisualLabPng } from './visual-lab-png.mjs';

export const VISUAL_LAB_COMPARISON_METRICS_SCHEMA = (
  'anifor.visual-lab.comparison-metrics/v1'
);
export const VISUAL_LAB_EXPERIMENT_RESPONSE_SCHEMA = (
  'anifor.visual-lab.experiment-response/v1'
);
export const VISUAL_LAB_CURRENT_EXPERIMENT_RESPONSE_SCHEMA = (
  'anifor.visual-lab.current-experiment-response/v1'
);

const COMPARISON_SCHEMA = 'anifor.visual-lab.comparison/v1';
const BATCH_SCHEMA = 'anifor.visual-lab.batch/v1';
const RESULT_SCHEMA = 'anifor.visual-lab.result/v1';
const SHA256_ID = /^sha256:[0-9a-f]{64}$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;

const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
};

const channelAt = (image, pixel, channel) => {
  if (channel === 3 && image.channels === 3) return 255;
  return image.pixels[pixel * image.channels + channel];
};

const assertPinnedCapture = (bytes, expectedSha256, label) => {
  if (!Buffer.isBuffer(bytes)) throw new TypeError(`${label} bytes must be a Buffer`);
  if (!SHA256_HEX.test(expectedSha256 ?? '')) {
    throw new TypeError(`${label} requires a pinned capture SHA-256`);
  }
  const actualSha256 = createHash('sha256').update(bytes).digest('hex');
  if (actualSha256 !== expectedSha256) {
    throw new Error(`${label} does not match its pinned capture SHA-256`);
  }
  return bytes;
};

const measureDecodedVisualLabPngPair = (baseline, current) => {
  if (baseline.width !== current.width || baseline.height !== current.height) {
    return deepFreeze({
      kind: 'dimension-mismatch',
      baseline: { width: baseline.width, height: baseline.height },
      current: { width: current.width, height: current.height },
    });
  }

  const comparedPixels = baseline.width * baseline.height;
  let rgbaDifferentPixels = 0;
  let rgbDifferentPixels = 0;
  let rgbAbsoluteDeltaSum = 0;
  let rgbSquaredDeltaSum = 0;
  let rgbChannelPeak = 0;
  let alphaDifferentPixels = 0;
  let alphaAbsoluteDeltaSum = 0;
  let alphaSquaredDeltaSum = 0;
  let alphaChannelPeak = 0;

  for (let pixel = 0; pixel < comparedPixels; pixel++) {
    let rgbDifferent = false;
    for (let channel = 0; channel < 3; channel++) {
      const delta = Math.abs(
        channelAt(baseline, pixel, channel) - channelAt(current, pixel, channel),
      );
      if (delta > 0) rgbDifferent = true;
      rgbAbsoluteDeltaSum += delta;
      rgbSquaredDeltaSum += delta * delta;
      rgbChannelPeak = Math.max(rgbChannelPeak, delta);
    }
    const alphaDelta = Math.abs(
      channelAt(baseline, pixel, 3) - channelAt(current, pixel, 3),
    );
    if (rgbDifferent) rgbDifferentPixels++;
    if (alphaDelta > 0) alphaDifferentPixels++;
    if (rgbDifferent || alphaDelta > 0) rgbaDifferentPixels++;
    alphaAbsoluteDeltaSum += alphaDelta;
    alphaSquaredDeltaSum += alphaDelta * alphaDelta;
    alphaChannelPeak = Math.max(alphaChannelPeak, alphaDelta);
  }

  return deepFreeze({
    kind: 'rgba-delta',
    width: baseline.width,
    height: baseline.height,
    comparedPixels,
    rgbaDifferentPixels,
    rgb: {
      differentPixels: rgbDifferentPixels,
      absoluteDeltaSum: rgbAbsoluteDeltaSum,
      squaredDeltaSum: rgbSquaredDeltaSum,
      channelPeak: rgbChannelPeak,
    },
    alpha: {
      differentPixels: alphaDifferentPixels,
      absoluteDeltaSum: alphaAbsoluteDeltaSum,
      squaredDeltaSum: alphaSquaredDeltaSum,
      channelPeak: alphaChannelPeak,
    },
  });
};

/** Integer-only RGBA evidence; it deliberately makes no aesthetic decision. */
export function measureVisualLabPngPair(baselineBytes, currentBytes, label = 'capture pair') {
  const baseline = decodeVisualLabPng(baselineBytes, `${label} accepted`);
  const current = decodeVisualLabPng(currentBytes, `${label} current`);
  return measureDecodedVisualLabPngPair(baseline, current);
}

/**
 * Builds an additive metrics sidecar from a normalized comparison. Identical
 * variants require no decoding; unpaired candidates carry no invented metric.
 */
export async function createVisualLabComparisonMetrics(comparison, readCapture) {
  if (comparison?.schema !== COMPARISON_SCHEMA || comparison.complete !== true
    || !SHA256_ID.test(comparison.id) || !Array.isArray(comparison.candidates)) {
    throw new TypeError(`comparison metrics require ${COMPARISON_SCHEMA}`);
  }
  if (typeof readCapture !== 'function') {
    throw new TypeError('comparison metrics require a capture reader');
  }

  const candidates = [];
  for (const entry of comparison.candidates) {
    const paired = entry.baselineResult !== null && entry.currentResult !== null;
    if (!paired) {
      candidates.push({ candidate: entry.candidate, status: entry.status, variants: null });
      continue;
    }
    const variants = {};
    for (const variant of VARIANTS) {
      const state = entry.variants?.[variant];
      if (state?.status === 'encoded-identical') {
        variants[variant] = { status: 'encoded-identical', metric: null };
        continue;
      }
      if (state?.status !== 'review') {
        throw new TypeError(
          `comparison metrics received invalid ${entry.candidate} ${variant} status`,
        );
      }
      const [baselineBytes, currentBytes] = await Promise.all([
        readCapture('baseline', entry.candidate, variant),
        readCapture('current', entry.candidate, variant),
      ]);
      assertPinnedCapture(
        baselineBytes,
        entry.baselineResult?.captureSha256?.[variant],
        `${entry.candidate} ${variant} accepted`,
      );
      assertPinnedCapture(
        currentBytes,
        entry.currentResult?.captureSha256?.[variant],
        `${entry.candidate} ${variant} current`,
      );
      variants[variant] = {
        status: 'review',
        metric: measureVisualLabPngPair(
          baselineBytes, currentBytes, `${entry.candidate} ${variant}`,
        ),
      };
    }
    candidates.push({ candidate: entry.candidate, status: entry.status, variants });
  }

  return deepFreeze({
    schema: VISUAL_LAB_COMPARISON_METRICS_SCHEMA,
    comparison: { schema: comparison.schema, id: comparison.id },
    candidates,
  });
}

/**
 * Measures the current experiment itself, independently of accepted-baseline
 * availability. Current results follow their pinned batch order; accepted-only
 * comparison entries are deliberately absent. Each current PNG is pinned and
 * decoded exactly once, then reused for the three ordered OFF/A/B response
 * pairs. This additive record assigns no score, threshold, or verdict.
 */
export async function createVisualLabExperimentResponse(comparison, readCapture) {
  if (comparison?.schema !== COMPARISON_SCHEMA || comparison.complete !== true
    || !SHA256_ID.test(comparison.id) || !Array.isArray(comparison.candidates)) {
    throw new TypeError(`experiment response requires ${COMPARISON_SCHEMA}`);
  }
  if (comparison.current?.schema !== BATCH_SCHEMA
    || !Array.isArray(comparison.current.resultIds)) {
    throw new TypeError(`experiment response requires ${BATCH_SCHEMA} current result IDs`);
  }
  if (typeof readCapture !== 'function') {
    throw new TypeError('experiment response requires a capture reader');
  }

  const sampledById = new Map();
  for (const entry of comparison.candidates) {
    if (entry.currentResult === null) {
      if (entry.status !== 'not-sampled') {
        throw new TypeError(
          `experiment response received unsampled ${entry.candidate} without not-sampled status`,
        );
      }
      continue;
    }
    if (entry.status === 'not-sampled') {
      throw new TypeError(
        `experiment response received sampled ${entry.candidate} with not-sampled status`,
      );
    }
    if (entry.currentResult?.schema !== RESULT_SCHEMA
      || !SHA256_ID.test(entry.currentResult.id)) {
      throw new TypeError(`experiment response requires a current result for ${entry.candidate}`);
    }
    if (sampledById.has(entry.currentResult.id)) {
      throw new TypeError(
        `experiment response received duplicate current result ID ${entry.currentResult.id}`,
      );
    }
    sampledById.set(entry.currentResult.id, entry);
  }

  const seenResultIds = new Set();
  const sampled = comparison.current.resultIds.map((resultId, index) => {
    if (!SHA256_ID.test(resultId ?? '')) {
      throw new TypeError(`experiment response current result ID ${index} is missing or invalid`);
    }
    if (seenResultIds.has(resultId)) {
      throw new TypeError(`experiment response received duplicate current result ID ${resultId}`);
    }
    seenResultIds.add(resultId);
    const entry = sampledById.get(resultId);
    if (!entry) {
      throw new TypeError(`experiment response received unknown current result ID ${resultId}`);
    }
    return entry;
  });
  for (const [resultId, entry] of sampledById) {
    if (!seenResultIds.has(resultId)) {
      throw new TypeError(
        `experiment response sampled ${entry.candidate} was omitted from current result IDs`,
      );
    }
  }

  const candidates = [];
  for (const entry of sampled) {
    const images = {};
    for (const variant of VARIANTS) {
      const bytes = await readCapture('current', entry.candidate, variant);
      assertPinnedCapture(
        bytes,
        entry.currentResult.captureSha256?.[variant],
        `${entry.candidate} ${variant} current`,
      );
      images[variant] = decodeVisualLabPng(bytes, `${entry.candidate} ${variant} current`);
    }
    candidates.push({
      candidate: entry.candidate,
      currentResult: {
        schema: entry.currentResult.schema,
        id: entry.currentResult.id,
      },
      pairs: {
        offToA: {
          left: 'off',
          right: 'a',
          metric: measureDecodedVisualLabPngPair(images.off, images.a),
        },
        offToB: {
          left: 'off',
          right: 'b',
          metric: measureDecodedVisualLabPngPair(images.off, images.b),
        },
        aToB: {
          left: 'a',
          right: 'b',
          metric: measureDecodedVisualLabPngPair(images.a, images.b),
        },
      },
    });
  }

  return deepFreeze({
    schema: VISUAL_LAB_EXPERIMENT_RESPONSE_SCHEMA,
    comparison: { schema: comparison.schema, id: comparison.id },
    candidates,
  });
}

/**
 * Builds current-only response evidence directly from a complete batch. The
 * ordered result IDs are the sole experiment binding; capture hashes only
 * authenticate PNG bytes inside this package.
 */
export async function createVisualLabBatchExperimentResponse(batch, readCapture) {
  if (batch?.schema !== BATCH_SCHEMA || batch.complete !== true
    || !Array.isArray(batch.candidates) || batch.candidates.length === 0
    || batch.candidates.some((entry) => entry?.status !== 'passed')) {
    throw new TypeError(`batch experiment response requires a complete ${BATCH_SCHEMA}`);
  }
  if (typeof readCapture !== 'function') {
    throw new TypeError('batch experiment response requires a capture reader');
  }

  const resultIds = [];
  const seen = new Set();
  const candidates = [];
  for (const entry of batch.candidates) {
    const result = entry.result;
    if (result?.schema !== RESULT_SCHEMA || !SHA256_ID.test(result.id ?? '')) {
      throw new TypeError(`batch experiment response requires a result for ${entry.candidate}`);
    }
    if (seen.has(result.id)) {
      throw new TypeError(`batch experiment response received duplicate result ID ${result.id}`);
    }
    seen.add(result.id);
    resultIds.push(result.id);
    const images = {};
    for (const variant of VARIANTS) {
      const bytes = await readCapture(entry.candidate, variant);
      assertPinnedCapture(
        bytes, result.captureSha256?.[variant], `${entry.candidate} ${variant} current`,
      );
      images[variant] = decodeVisualLabPng(bytes, `${entry.candidate} ${variant} current`);
    }
    candidates.push({
      candidate: entry.candidate,
      result: { schema: result.schema, id: result.id },
      pairs: {
        offToA: { left: 'off', right: 'a', metric: measureDecodedVisualLabPngPair(images.off, images.a) },
        offToB: { left: 'off', right: 'b', metric: measureDecodedVisualLabPngPair(images.off, images.b) },
        aToB: { left: 'a', right: 'b', metric: measureDecodedVisualLabPngPair(images.a, images.b) },
      },
    });
  }
  return deepFreeze({
    schema: VISUAL_LAB_CURRENT_EXPERIMENT_RESPONSE_SCHEMA,
    batch: { schema: batch.schema, resultIds },
    candidates,
  });
}
