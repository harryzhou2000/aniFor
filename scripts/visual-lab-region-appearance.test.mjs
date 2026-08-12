import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  createVisualLabCurrentRegionAppearance,
  VISUAL_LAB_CURRENT_REGION_APPEARANCE_SCHEMA,
} from './visual-lab-region-appearance.mjs';

const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const crc32 = (bytes) => { let crc = 0xFFFFFFFF; for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0); } return (crc ^ 0xFFFFFFFF) >>> 0; };
const chunk = (type, data) => { const name = Buffer.from(type); const out = Buffer.alloc(data.length + 12); out.writeUInt32BE(data.length); name.copy(out, 4); data.copy(out, 8); out.writeUInt32BE(crc32(Buffer.concat([name, data])), data.length + 8); return out; };
const png = (pixel) => { const width = 612; const height = 384; const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6; const rows = Buffer.alloc((width * 4 + 1) * height); for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const [red, green, blue] = pixel(x, y); const offset = y * (width * 4 + 1) + 1 + x * 4; rows[offset] = red; rows[offset + 1] = green; rows[offset + 2] = blue; rows[offset + 3] = 255; } return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]); };
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const id = (salt) => `sha256:${createHash('sha256').update(salt).digest('hex')}`;
const captures = {
  off: png(() => [0, 0, 0]),
  a: png(() => [100, 100, 100]),
  b: png((x, y) => ((x + y) % 2 === 0 ? [0, 0, 0] : [200, 200, 200])),
};
const result = (salt = 'opposed') => ({
  schema: 'anifor.visual-lab.result/v1',
  id: id(salt),
  captureSha256: Object.fromEntries(Object.entries(captures).map(([name, bytes]) => [name, sha(bytes)])),
});
const batch = (candidate = 'opposed-source-material-lighting-atlas') => ({
  schema: 'anifor.visual-lab.batch/v1',
  complete: true,
  candidates: [{ candidate, status: 'passed', result: result(candidate) }],
});

describe('Visual Lab current region appearance', () => {
  it('returns null when the complete batch has no configured regions', async () => {
    await expect(createVisualLabCurrentRegionAppearance(
      batch('gas-showcase'), async (_candidate, variant) => captures[variant],
    )).resolves.toBeNull();
  });

  it('retains local luminance distribution and neighbouring contrast without a verdict', async () => {
    const appearance = await createVisualLabCurrentRegionAppearance(
      batch(), async (_candidate, variant) => captures[variant],
    );
    const region = appearance.candidates[0].regions[0];
    expect(appearance.schema).toBe(VISUAL_LAB_CURRENT_REGION_APPEARANCE_SCHEMA);
    expect(region).toMatchObject({
      name: 'clay-warm-flank', pixelRect: { x: 212, y: 88, width: 12, height: 24 },
      variants: {
        off: { pixels: 288, luma: { sum: 0, squaredSum: 0, minimum: 0, maximum: 0, standardDeviation: 0, neighbourAbsoluteMean: 0 } },
        a: { luma: { sum: 28_800, squaredSum: 2_880_000, minimum: 100, maximum: 100, standardDeviation: 0, neighbourAbsoluteMean: 0 } },
        b: { luma: { sum: 28_800, squaredSum: 5_760_000, minimum: 0, maximum: 200, horizontalAbsoluteDeltaSum: 52_800, verticalAbsoluteDeltaSum: 55_200, horizontalPairs: 264, verticalPairs: 276, standardDeviation: 100, neighbourAbsoluteMean: 200 } },
      },
      pairs: {
        offToB: { signedLumaSumDelta: 28_800, signedLumaMeanDelta: 100, signedLumaStandardDeviationDelta: 100, signedLumaNeighbourAbsoluteMeanDelta: 200 },
      },
    });
    expect(Object.isFrozen(region.pairs.offToB)).toBe(true);
    expect(JSON.stringify(appearance)).not.toMatch(/score|threshold|verdict|rank|promot/);
  });

  it('keeps one-pixel topology controls finite and rejects capture tampering', async () => {
    const appearance = await createVisualLabCurrentRegionAppearance(
      batch('solid-material-lighting-atlas'), async (_candidate, variant) => captures[variant],
    );
    const isolated = appearance.candidates[0].regions.find(({ name }) => name === 'brck-isolated');
    expect(isolated.variants.b.luma.neighbourAbsoluteMean).toBe(0);

    const tampered = { ...captures, b: png(() => [1, 1, 1]) };
    await expect(createVisualLabCurrentRegionAppearance(
      batch(), async (_candidate, variant) => tampered[variant],
    )).rejects.toThrow('pinned capture SHA-256');
  });
});
