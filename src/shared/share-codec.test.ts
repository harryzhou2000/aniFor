import { describe, expect, it } from 'vitest';
import { decodeSharedWorld, encodeSharedWorld } from './share-codec';

describe('share codec', () => {
  it('compresses a world into a URL-safe round trip', async () => {
    const world = btoa(JSON.stringify({ v: 1, w: 160, h: 100, d: 'A'.repeat(16_000) }));
    const encoded = await encodeSharedWorld(world);
    expect(encoded).toMatch(/^[gp]\.[A-Za-z0-9_-]+$/);
    expect(encoded.length).toBeLessThan(world.length / 5);
    expect(await decodeSharedWorld(encoded)).toBe(world);
  });

  it('rejects unknown formats', async () => {
    await expect(decodeSharedWorld('x.invalid')).rejects.toThrow('Unsupported');
  });
});
