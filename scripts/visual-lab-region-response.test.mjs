import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  createVisualLabCurrentRegionResponse,
  VISUAL_LAB_CURRENT_REGION_RESPONSE_SCHEMA,
} from './visual-lab-region-response.mjs';

const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const crc32 = (bytes) => { let crc = 0xFFFFFFFF; for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0); } return (crc ^ 0xFFFFFFFF) >>> 0; };
const chunk = (type, data) => { const name = Buffer.from(type); const out = Buffer.alloc(data.length + 12); out.writeUInt32BE(data.length); name.copy(out, 4); data.copy(out, 8); out.writeUInt32BE(crc32(Buffer.concat([name, data])), data.length + 8); return out; };
const png = (red) => { const width = 612; const height = 384; const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6; const rows = Buffer.alloc((width * 4 + 1) * height); for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const offset = y * (width * 4 + 1) + 1 + x * 4; rows[offset] = red; rows[offset + 1] = x & 255; rows[offset + 2] = y & 255; rows[offset + 3] = 255; } return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]); };
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const id = (salt) => `sha256:${createHash('sha256').update(salt).digest('hex')}`;
const captures = { off: png(10), a: png(12), b: png(15) };
const result = (salt = 'opposed') => ({ schema: 'anifor.visual-lab.result/v1', id: id(salt), captureSha256: Object.fromEntries(Object.entries(captures).map(([name, bytes]) => [name, sha(bytes)])) });
const batch = (candidate = 'opposed-source-material-lighting-atlas') => ({ schema: 'anifor.visual-lab.batch/v1', complete: true, candidates: [{ candidate, status: 'passed', result: result(candidate) }] });

describe('Visual Lab current region response', () => {
  it('returns null when the complete batch has no configured regions', async () => {
    await expect(createVisualLabCurrentRegionResponse(batch('gas-showcase'), async (_candidate, variant) => captures[variant])).resolves.toBeNull();
  });

  it('maps world regions, authenticates captures, and retains signed response without a verdict', async () => {
    const response = await createVisualLabCurrentRegionResponse(batch(), async (_candidate, variant) => captures[variant]);
    expect(response.schema).toBe(VISUAL_LAB_CURRENT_REGION_RESPONSE_SCHEMA);
    expect(response.candidates[0].regions).toHaveLength(8);
    expect(response.candidates[0].regions[0]).toMatchObject({
      name: 'clay-warm-flank', pixelRect: { x: 212, y: 88, width: 12, height: 24 },
      variants: { off: { pixels: 288, rgbaMeans: [10, expect.any(Number), expect.any(Number), 255] } },
      pairs: { offToB: { signedRgbaMeanDelta: [5, 0, 0, 0] } },
    });
    expect(Object.isFrozen(response.candidates[0].regions[0].pairs.offToB)).toBe(true);
    expect(JSON.stringify(response)).not.toMatch(/score|verdict|threshold/);
  });

  it('rejects capture tampering and inconsistent variant dimensions', async () => {
    const tampered = { ...captures, b: png(16) };
    await expect(createVisualLabCurrentRegionResponse(batch(), async (_candidate, variant) => tampered[variant])).rejects.toThrow('pinned capture SHA-256');
  });
});

