import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  createVisualLabComparisonMetrics,
  measureVisualLabPngPair,
  VISUAL_LAB_COMPARISON_METRICS_SCHEMA,
} from './visual-lab-comparison-metrics.mjs';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const crc32 = (bytes) => {
  let crc = 0xFFFFFFFF;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
};

const chunk = (type, data) => {
  const typeBytes = Buffer.from(type, 'ascii');
  const result = Buffer.alloc(12 + data.length);
  result.writeUInt32BE(data.length, 0);
  typeBytes.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return result;
};

const png = (width, height, channels, pixels) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = channels === 3 ? 2 : 6;
  const stride = width * channels;
  const scanlines = Buffer.alloc((stride + 1) * height);
  for (let row = 0; row < height; row++) {
    Buffer.from(pixels).copy(scanlines, row * (stride + 1) + 1, row * stride, (row + 1) * stride);
  }
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(scanlines)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const result = (salt, capture) => ({
  schema: 'anifor.visual-lab.result/v1',
  id: `sha256:${createHash('sha256').update(salt).digest('hex')}`,
  captureSha256: {
    off: sha256(capture),
    a: sha256(capture),
    b: sha256(capture),
  },
});

const pairedComparison = (accepted, current) => ({
  schema: 'anifor.visual-lab.comparison/v1',
  id: `sha256:${'a'.repeat(64)}`,
  complete: true,
  candidates: [{
    candidate: 'sample',
    status: 'review',
    baselineResult: result('accepted', accepted),
    currentResult: result('current', current),
    variants: {
      off: { status: 'encoded-identical' },
      a: { status: 'review' },
      b: { status: 'encoded-identical' },
    },
  }],
});

describe('Visual Lab comparison metrics', () => {
  it('reports exact integer RGB and alpha deltas without assigning a score', () => {
    const baseline = png(2, 1, 4, [10, 20, 30, 40, 50, 60, 70, 80]);
    const current = png(2, 1, 4, [11, 18, 30, 44, 50, 60, 75, 70]);
    expect(measureVisualLabPngPair(baseline, current)).toEqual({
      kind: 'rgba-delta',
      width: 2,
      height: 1,
      comparedPixels: 2,
      rgbaDifferentPixels: 2,
      rgb: {
        differentPixels: 2,
        absoluteDeltaSum: 8,
        squaredDeltaSum: 30,
        channelPeak: 5,
      },
      alpha: {
        differentPixels: 2,
        absoluteDeltaSum: 14,
        squaredDeltaSum: 116,
        channelPeak: 10,
      },
    });
  });

  it('normalizes RGB alpha to opaque and records dimension mismatch without failing', () => {
    const rgb = png(1, 1, 3, [8, 9, 10]);
    const rgba = png(1, 1, 4, [8, 9, 10, 250]);
    expect(measureVisualLabPngPair(rgb, rgba)).toMatchObject({
      kind: 'rgba-delta',
      rgbaDifferentPixels: 1,
      rgb: { differentPixels: 0, absoluteDeltaSum: 0 },
      alpha: { differentPixels: 1, absoluteDeltaSum: 5, channelPeak: 5 },
    });
    expect(measureVisualLabPngPair(rgb, png(2, 1, 3, [8, 9, 10, 8, 9, 10])))
      .toEqual({
        kind: 'dimension-mismatch',
        baseline: { width: 1, height: 1 },
        current: { width: 2, height: 1 },
      });
  });

  it('decodes only changed paired variants and binds the sidecar to comparison identity', async () => {
    const accepted = png(1, 1, 3, [10, 20, 30]);
    const current = png(1, 1, 3, [12, 20, 27]);
    const comparison = pairedComparison(accepted, current);
    const reads = [];
    const metrics = await createVisualLabComparisonMetrics(
      comparison,
      async (side, candidate, variant) => {
        reads.push(`${side}:${candidate}:${variant}`);
        return side === 'baseline' ? accepted : current;
      },
    );

    expect(reads).toEqual(['baseline:sample:a', 'current:sample:a']);
    expect(metrics).toMatchObject({
      schema: VISUAL_LAB_COMPARISON_METRICS_SCHEMA,
      comparison: { schema: comparison.schema, id: comparison.id },
      candidates: [{
        candidate: 'sample',
        status: 'review',
        variants: {
          off: { status: 'encoded-identical', metric: null },
          a: { status: 'review', metric: { kind: 'rgba-delta', rgbaDifferentPixels: 1 } },
          b: { status: 'encoded-identical', metric: null },
        },
      }],
    });
    expect(Object.isFrozen(metrics)).toBe(true);
    expect(Object.isFrozen(metrics.candidates[0].variants.a.metric.rgb)).toBe(true);
  });

  it('rejects a metrics reread that no longer matches the comparison-pinned capture', async () => {
    const accepted = png(1, 1, 3, [10, 20, 30]);
    const current = png(1, 1, 3, [12, 20, 27]);
    const replacement = png(1, 1, 3, [200, 201, 202]);
    const comparison = pairedComparison(accepted, current);

    await expect(createVisualLabComparisonMetrics(
      comparison,
      async (side) => (side === 'baseline' ? replacement : current),
    )).rejects.toThrow('does not match its pinned capture SHA-256');
  });

  it('keeps unpaired candidates explicit without reading nonexistent captures', async () => {
    const capture = png(1, 1, 3, [10, 20, 30]);
    const comparison = pairedComparison(capture, capture);
    comparison.candidates = [{
      candidate: 'added', status: 'added', baselineResult: null,
      currentResult: result('added', capture), variants: {},
    }];
    const metrics = await createVisualLabComparisonMetrics(comparison, async () => {
      throw new Error('must not read');
    });
    expect(metrics.candidates).toEqual([
      { candidate: 'added', status: 'added', variants: null },
    ]);
  });
});
