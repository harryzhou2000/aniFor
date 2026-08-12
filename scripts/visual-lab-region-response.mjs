import { createHash } from 'node:crypto';

import {
  VISUAL_LAB_CAPTURE_VARIANT_NAMES as VARIANTS,
} from './visual-lab-capture-abi.mjs';
import { VISUAL_LAB_INSPECTION_REGIONS } from './visual-lab-inspection-regions.mjs';
import { decodeVisualLabPng } from './visual-lab-png.mjs';

export const VISUAL_LAB_CURRENT_REGION_RESPONSE_SCHEMA = (
  'anifor.visual-lab.current-region-response/v1'
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
  const sums = [0, 0, 0, 0];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      for (let channel = 0; channel < 4; channel++) {
        sums[channel] += channelAt(image, x, y, channel);
      }
    }
  }
  const pixels = rect.width * rect.height;
  return {
    pixels,
    rgbaSums: sums,
    rgbaMeans: sums.map((sum) => sum / pixels),
  };
};

const regionEvidence = (descriptor, images, candidate) => {
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
  const variants = Object.fromEntries(VARIANTS.map((variant) => [
    variant, sampleRegion(images[variant], rects[variant]),
  ]));
  const pair = (left, right) => ({
    left,
    right,
    signedRgbaSumDelta: variants[right].rgbaSums.map((sum, channel) => (
      sum - variants[left].rgbaSums[channel]
    )),
    signedRgbaMeanDelta: variants[right].rgbaMeans.map((mean, channel) => (
      mean - variants[left].rgbaMeans[channel]
    )),
  });
  return {
    ...descriptor,
    pixelRect: rects.off,
    variants,
    pairs: {
      offToA: pair('off', 'a'),
      offToB: pair('off', 'b'),
      aToB: pair('a', 'b'),
    },
  };
};

/**
 * Builds optional current-only spatial evidence from a complete batch. PNG
 * hashes authenticate this package only; this record assigns no visual score.
 */
export async function createVisualLabCurrentRegionResponse(batch, readCapture) {
  if (batch?.schema !== BATCH_SCHEMA || batch.complete !== true
    || !Array.isArray(batch.candidates) || batch.candidates.length === 0
    || batch.candidates.some((entry) => entry?.status !== 'passed')) {
    throw new TypeError(`region response requires a complete ${BATCH_SCHEMA}`);
  }
  if (typeof readCapture !== 'function') {
    throw new TypeError('region response requires a capture reader');
  }
  const descriptors = new Map(VISUAL_LAB_INSPECTION_REGIONS.fixtures.map((entry) => [
    entry.candidate, entry,
  ]));
  const configured = batch.candidates.filter(({ candidate }) => descriptors.has(candidate));
  if (configured.length === 0) return null;

  const resultIds = [];
  const seen = new Set();
  const candidates = [];
  for (const entry of batch.candidates) {
    const result = entry.result;
    if (result?.schema !== RESULT_SCHEMA || !SHA256_ID.test(result.id ?? '') || seen.has(result.id)) {
      throw new TypeError(`region response requires a unique result for ${entry.candidate}`);
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
        `${entry.candidate} ${variant} region response`,
      );
    }
    candidates.push({
      candidate: entry.candidate,
      result: { schema: result.schema, id: result.id },
      world: descriptor.world,
      regions: descriptor.regions.map((region) => regionEvidence(region, images, descriptor)),
    });
  }
  return deepFreeze({
    schema: VISUAL_LAB_CURRENT_REGION_RESPONSE_SCHEMA,
    batch: { schema: batch.schema, resultIds },
    candidates,
  });
}
