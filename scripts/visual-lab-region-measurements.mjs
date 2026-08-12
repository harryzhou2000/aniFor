import { createHash } from 'node:crypto';

import {
  VISUAL_LAB_CAPTURE_VARIANT_NAMES as VARIANTS,
} from './visual-lab-capture-abi.mjs';
import { VISUAL_LAB_INSPECTION_REGIONS } from './visual-lab-inspection-regions.mjs';
import { decodeVisualLabPng } from './visual-lab-png.mjs';

export const VISUAL_LAB_CURRENT_REGION_RESPONSE_SCHEMA = (
  'anifor.visual-lab.current-region-response/v1'
);
export const VISUAL_LAB_CURRENT_REGION_APPEARANCE_SCHEMA = (
  'anifor.visual-lab.current-region-appearance/v1'
);

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

const pinAndDecode = (bytes, expectedSha256, label) => {
  if (!Buffer.isBuffer(bytes) || !SHA256_HEX.test(expectedSha256 ?? '')) {
    throw new TypeError(`${label} requires pinned PNG bytes`);
  }
  if (createHash('sha256').update(bytes).digest('hex') !== expectedSha256) {
    throw new Error(`${label} does not match its pinned capture SHA-256`);
  }
  return decodeVisualLabPng(bytes, label);
};

const channelAt = (image, x, y, channel) => {
  if (channel === 3 && image.channels === 3) return 255;
  return image.pixels[(y * image.width + x) * image.channels + channel];
};

/** Fixed integer Rec. 709 approximation, independent of PNG alpha encoding. */
const lumaAt = (image, x, y) => (
  (54 * channelAt(image, x, y, 0)
    + 183 * channelAt(image, x, y, 1)
    + 19 * channelAt(image, x, y, 2)) >>> 8
);

const mapRegion = (region, world, image, label) => {
  // Conservative coverage keeps a nonempty world rectangle nonempty even in a
  // structurally valid low-resolution legacy/synthetic capture.
  const left = Math.floor(region.x * image.width / world.width);
  const top = Math.floor(region.y * image.height / world.height);
  const right = Math.ceil((region.x + region.width) * image.width / world.width);
  const bottom = Math.ceil((region.y + region.height) * image.height / world.height);
  if (left < 0 || top < 0 || right > image.width || bottom > image.height
    || right <= left || bottom <= top) {
    throw new TypeError(`${label} maps outside its decoded capture`);
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
};

const sampleRegion = (image, rect) => {
  const rgbaSums = [0, 0, 0, 0];
  let lumaSum = 0;
  let lumaSquaredSum = 0;
  let minimum = 255;
  let maximum = 0;
  let horizontalAbsoluteDeltaSum = 0;
  let verticalAbsoluteDeltaSum = 0;
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      for (let channel = 0; channel < 4; channel++) {
        rgbaSums[channel] += channelAt(image, x, y, channel);
      }
      const luma = lumaAt(image, x, y);
      lumaSum += luma;
      lumaSquaredSum += luma * luma;
      minimum = Math.min(minimum, luma);
      maximum = Math.max(maximum, luma);
      if (x > rect.x) horizontalAbsoluteDeltaSum += Math.abs(luma - lumaAt(image, x - 1, y));
      if (y > rect.y) verticalAbsoluteDeltaSum += Math.abs(luma - lumaAt(image, x, y - 1));
    }
  }
  const pixels = rect.width * rect.height;
  const horizontalPairs = (rect.width - 1) * rect.height;
  const verticalPairs = rect.width * (rect.height - 1);
  const neighbourPairs = horizontalPairs + verticalPairs;
  const mean = lumaSum / pixels;
  return {
    response: {
      pixels,
      rgbaSums,
      rgbaMeans: rgbaSums.map((sum) => sum / pixels),
    },
    appearance: {
      pixels,
      luma: {
        sum: lumaSum,
        squaredSum: lumaSquaredSum,
        minimum,
        maximum,
        horizontalAbsoluteDeltaSum,
        verticalAbsoluteDeltaSum,
        horizontalPairs,
        verticalPairs,
        mean,
        standardDeviation: Math.sqrt(Math.max(0, lumaSquaredSum / pixels - mean * mean)),
        neighbourAbsoluteMean: neighbourPairs === 0
          ? 0
          : (horizontalAbsoluteDeltaSum + verticalAbsoluteDeltaSum) / neighbourPairs,
      },
    },
  };
};

const projectRegion = (descriptor, images, candidate) => {
  const rects = Object.fromEntries(VARIANTS.map((variant) => [
    variant,
    mapRegion(descriptor, candidate.world, images[variant], `${candidate.candidate}:${descriptor.name}`),
  ]));
  if (VARIANTS.some((variant) => (
    rects[variant].x !== rects.off.x || rects[variant].y !== rects.off.y
    || rects[variant].width !== rects.off.width || rects[variant].height !== rects.off.height
  ))) {
    throw new TypeError(`${candidate.candidate}:${descriptor.name} capture dimensions disagree`);
  }
  const samples = Object.fromEntries(VARIANTS.map((variant) => [
    variant, sampleRegion(images[variant], rects[variant]),
  ]));
  const responseVariants = Object.fromEntries(VARIANTS.map((variant) => [
    variant, samples[variant].response,
  ]));
  const appearanceVariants = Object.fromEntries(VARIANTS.map((variant) => [
    variant, samples[variant].appearance,
  ]));
  const responsePair = (left, right) => ({
    left,
    right,
    signedRgbaSumDelta: responseVariants[right].rgbaSums.map((sum, channel) => (
      sum - responseVariants[left].rgbaSums[channel]
    )),
    signedRgbaMeanDelta: responseVariants[right].rgbaMeans.map((mean, channel) => (
      mean - responseVariants[left].rgbaMeans[channel]
    )),
  });
  const appearancePair = (left, right) => ({
    left,
    right,
    signedLumaSumDelta: appearanceVariants[right].luma.sum - appearanceVariants[left].luma.sum,
    signedLumaMeanDelta: appearanceVariants[right].luma.mean - appearanceVariants[left].luma.mean,
    signedLumaStandardDeviationDelta: (
      appearanceVariants[right].luma.standardDeviation
        - appearanceVariants[left].luma.standardDeviation
    ),
    signedLumaNeighbourAbsoluteMeanDelta: (
      appearanceVariants[right].luma.neighbourAbsoluteMean
        - appearanceVariants[left].luma.neighbourAbsoluteMean
    ),
  });
  const common = { ...descriptor, pixelRect: rects.off };
  return {
    response: {
      ...common,
      variants: responseVariants,
      pairs: {
        offToA: responsePair('off', 'a'),
        offToB: responsePair('off', 'b'),
        aToB: responsePair('a', 'b'),
      },
    },
    appearance: {
      ...common,
      variants: appearanceVariants,
      pairs: {
        offToA: appearancePair('off', 'a'),
        offToB: appearancePair('off', 'b'),
        aToB: appearancePair('a', 'b'),
      },
    },
  };
};

/**
 * Compiles both optional current-only spatial records from one authenticated
 * decode and one pixel traversal per candidate, variant, and region.
 */
export async function createVisualLabCurrentRegionMeasurements(
  batch,
  readCapture,
  evidenceLabel = 'region measurements',
) {
  if (batch?.schema !== BATCH_SCHEMA || batch.complete !== true
    || !Array.isArray(batch.candidates) || batch.candidates.length === 0
    || batch.candidates.some((entry) => entry?.status !== 'passed')) {
    throw new TypeError(`${evidenceLabel} require${evidenceLabel.endsWith('s') ? '' : 's'} a complete ${BATCH_SCHEMA}`);
  }
  if (typeof readCapture !== 'function') {
    throw new TypeError(`${evidenceLabel} require${evidenceLabel.endsWith('s') ? '' : 's'} a capture reader`);
  }
  const descriptors = new Map(VISUAL_LAB_INSPECTION_REGIONS.fixtures.map((entry) => [
    entry.candidate, entry,
  ]));
  if (!batch.candidates.some(({ candidate }) => descriptors.has(candidate))) return null;

  const resultIds = [];
  const seen = new Set();
  const responseCandidates = [];
  const appearanceCandidates = [];
  for (const entry of batch.candidates) {
    const result = entry.result;
    if (result?.schema !== RESULT_SCHEMA || !SHA256_ID.test(result.id ?? '') || seen.has(result.id)) {
      throw new TypeError(`${evidenceLabel} require${evidenceLabel.endsWith('s') ? '' : 's'} a unique result for ${entry.candidate}`);
    }
    seen.add(result.id);
    resultIds.push(result.id);
    const descriptor = descriptors.get(entry.candidate);
    if (!descriptor) continue;
    const images = {};
    for (const variant of VARIANTS) {
      images[variant] = pinAndDecode(
        await readCapture(entry.candidate, variant),
        result.captureSha256?.[variant],
        `${entry.candidate} ${variant} ${evidenceLabel}`,
      );
    }
    const projected = descriptor.regions.map((region) => projectRegion(region, images, descriptor));
    const common = {
      candidate: entry.candidate,
      result: { schema: result.schema, id: result.id },
      world: descriptor.world,
    };
    responseCandidates.push({ ...common, regions: projected.map(({ response }) => response) });
    appearanceCandidates.push({ ...common, regions: projected.map(({ appearance }) => appearance) });
  }
  const batchRecord = { schema: batch.schema, resultIds };
  return deepFreeze({
    response: {
      schema: VISUAL_LAB_CURRENT_REGION_RESPONSE_SCHEMA,
      batch: batchRecord,
      candidates: responseCandidates,
    },
    appearance: {
      schema: VISUAL_LAB_CURRENT_REGION_APPEARANCE_SCHEMA,
      batch: batchRecord,
      candidates: appearanceCandidates,
    },
  });
}
