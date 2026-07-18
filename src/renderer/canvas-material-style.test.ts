import { describe, expect, it } from 'vitest';
import { shadeCanvasMaterial } from './canvas-material-style';
import { RenderProfile } from './render-profile';

describe('Canvas material-family styling', () => {
  it('gives every canonical profile a stable distinguishable response', () => {
    const colors = new Set<string>();
    for (let profile = RenderProfile.Neutral; profile <= RenderProfile.Field; profile++) {
      const output = new Float32Array(3);
      const fingerprint: number[] = [];
      for (const [x, y, index] of [[19, 23, 1_250], [24, 31, 1_809], [7, 42, 2_619]]) {
        shadeCanvasMaterial(output, 110, 120, 130, profile, 37, x, y, index, 4_000);
        const first = Array.from(output);
        shadeCanvasMaterial(output, 110, 120, 130, profile, 37, x, y, index, 4_000);
        expect(Array.from(output)).toEqual(first);
        fingerprint.push(...first);
      }
      colors.add(fingerprint.join(','));
    }
    expect(colors.size).toBe(7);
  });

  it('keeps canonical color as the base and clamps extreme channels', () => {
    const neutral = new Float32Array(3);
    shadeCanvasMaterial(neutral, 110, 120, 130, RenderProfile.Neutral, 1, 2, 3, 4, 0);
    expect(Math.abs(neutral[0] - 110)).toBeLessThan(3);
    expect(Math.abs(neutral[1] - 120)).toBeLessThan(3);
    expect(Math.abs(neutral[2] - 130)).toBeLessThan(3);

    const clamped = new Float32Array(3);
    shadeCanvasMaterial(clamped, 255, 255, 255, RenderProfile.Field, 99, 1, 1, 1, 0);
    expect(Array.from(clamped).every((channel) => channel >= 0 && channel <= 255)).toBe(true);
  });
});
