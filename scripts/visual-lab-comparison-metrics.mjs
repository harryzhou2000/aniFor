import { createHash } from 'node:crypto';

import {
  VISUAL_LAB_CAPTURE_VARIANT_NAMES as VARIANTS,
} from './visual-lab-capture-abi.mjs';
import { decodeVisualLabPng } from './visual-lab-png.mjs';

export const VISUAL_LAB_COMPARISON_METRICS_SCHEMA = (
  'anifor.visual-lab.comparison-metrics/v1'
);

const COMPARISON_SCHEMA = 'anifor.visual-lab.comparison/v1';
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

/** Integer-only RGBA evidence; it deliberately makes no aesthetic decision. */
export function measureVisualLabPngPair(baselineBytes, currentBytes, label = 'capture pair') {
  const baseline = decodeVisualLabPng(baselineBytes, `${label} accepted`);
  const current = decodeVisualLabPng(currentBytes, `${label} current`);
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
