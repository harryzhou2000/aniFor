import { describe, expect, it } from 'vitest';
import { shadeCanvasEnergy } from './canvas-energy-style';
import { RenderProfile } from './render-profile';

describe('Canvas energy core styling', () => {
  it('keeps warm and radioactive carriers distinct with a luminous core', () => {
    const warm = new Float32Array(3);
    const warmGlow = new Float32Array(3);
    const radioactive = new Float32Array(3);
    const radioactiveGlow = new Float32Array(3);
    const warmAlpha = shadeCanvasEnergy(
      warm, warmGlow, 255, 96, 42, RenderProfile.Neutral, 4, 12, 9, 500, 0.8, 0, -18,
    );
    const radioactiveAlpha = shadeCanvasEnergy(
      radioactive, radioactiveGlow, 32, 224, 255, RenderProfile.Radioactive, 106, 12, 9, 500, 0.2, 28, 0,
    );
    expect(warm[0]).toBeGreaterThan(warm[2]);
    expect(radioactive[2]).toBeGreaterThan(radioactive[0]);
    expect(warmGlow[0]).toBeGreaterThan(warmGlow[2]);
    expect(radioactiveGlow[2]).toBeGreaterThan(radioactiveGlow[0]);
    expect(warmAlpha).toBeGreaterThan(150);
    expect(radioactiveAlpha).toBeGreaterThan(150);
  });

  it('is deterministic with reusable scratch storage', () => {
    const first = new Float32Array(3);
    const firstGlow = new Float32Array(3);
    const second = new Float32Array(3);
    const secondGlow = new Float32Array(3);
    const firstAlpha = shadeCanvasEnergy(
      first, firstGlow, 223, 239, 255, RenderProfile.Radioactive, 101, 4, 7, 1234, 0.4, 12, -5,
    );
    const secondAlpha = shadeCanvasEnergy(
      second, secondGlow, 223, 239, 255, RenderProfile.Radioactive, 101, 4, 7, 1234, 0.4, 12, -5,
    );
    expect(second).toEqual(first);
    expect(secondGlow).toEqual(firstGlow);
    expect(secondAlpha).toBe(firstAlpha);
  });
});
