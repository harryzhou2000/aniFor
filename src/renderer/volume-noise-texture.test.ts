import { describe, expect, it } from 'vitest';
import {
  VOLUME_NOISE_TEXTURE,
  VOLUME_NOISE_TEXTURE_CHANNELS,
  VOLUME_NOISE_TEXTURE_SIZE,
} from './volume-noise-texture';

function byteAt(x: number, y: number, channel: number): number {
  const size = VOLUME_NOISE_TEXTURE_SIZE;
  return VOLUME_NOISE_TEXTURE.data[((y * size + x) * VOLUME_NOISE_TEXTURE_CHANNELS) + channel];
}

describe('volume noise texture', () => {
  it('is an opaque, varied RGBA8 tile with smooth repeat seams and distinct volume coordinates', () => {
    const size = VOLUME_NOISE_TEXTURE_SIZE;
    expect(VOLUME_NOISE_TEXTURE).toMatchObject({ width: size, height: size });
    expect(VOLUME_NOISE_TEXTURE.data).toHaveLength(size * size * VOLUME_NOISE_TEXTURE_CHANNELS);

    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      expect(byteAt(x, y, 3)).toBe(255);
    }

    for (const channel of [0, 1, 2]) {
      const values: number[] = [];
      let largestWrappedStep = 0;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const value = byteAt(x, y, channel);
        values.push(value);
        largestWrappedStep = Math.max(
          largestWrappedStep,
          Math.abs(value - byteAt((x + 1) % size, y, channel)),
          Math.abs(value - byteAt(x, (y + 1) % size, channel)),
        );
      }
      expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(80);
      expect(largestWrappedStep).toBeLessThan(48);
    }

    const red = Array.from(VOLUME_NOISE_TEXTURE.data).filter((_, index) => index % 4 === 0);
    const green = Array.from(VOLUME_NOISE_TEXTURE.data).filter((_, index) => index % 4 === 1);
    expect(red).not.toEqual(green);
  });
});
