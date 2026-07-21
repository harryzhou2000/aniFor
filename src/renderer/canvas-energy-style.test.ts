import { describe, expect, it } from 'vitest';
import { canvasEnergyCoreReliefScale, shadeCanvasEnergy } from './canvas-energy-style';
import { RenderProfile } from './render-profile';
import { RenderTrait } from './render-traits';

describe('Canvas energy core styling', () => {
  it('keeps warm and radioactive carriers distinct with a luminous core', () => {
    const warm = new Float32Array(3);
    const warmGlow = new Float32Array(3);
    const radioactive = new Float32Array(3);
    const radioactiveGlow = new Float32Array(3);
    const warmAlpha = shadeCanvasEnergy(
      warm, warmGlow, 255, 96, 42, RenderProfile.Neutral, 0, 4, 12, 9, 500, 0.8, 0, -18,
    );
    const radioactiveAlpha = shadeCanvasEnergy(
      radioactive, radioactiveGlow, 32, 224, 255, RenderProfile.Radioactive,
      RenderTrait.Radioactive | RenderTrait.Carrier, 106, 12, 9, 500, 0.2, 28, 0,
    );
    expect(warm[0]).toBeGreaterThan(warm[2]);
    expect(radioactive[2]).toBeGreaterThan(radioactive[0]);
    expect(warmGlow[0]).toBeGreaterThan(warmGlow[2]);
    expect(radioactiveGlow[2]).toBeGreaterThan(radioactiveGlow[0]);
    expect(warmAlpha).toBeGreaterThan(10);
    expect(radioactiveAlpha).toBeGreaterThan(10);
    expect(warmAlpha).toBeLessThan(24);
    expect(radioactiveAlpha).toBeLessThan(24);
    expect(Math.max(...warm)).toBeLessThanOrEqual(232);
    expect(Math.max(...radioactive)).toBeLessThanOrEqual(232);
  });

  it('is deterministic with reusable scratch storage', () => {
    const first = new Float32Array(3);
    const firstGlow = new Float32Array(3);
    const second = new Float32Array(3);
    const secondGlow = new Float32Array(3);
    const firstAlpha = shadeCanvasEnergy(
      first, firstGlow, 223, 239, 255, RenderProfile.Radioactive,
      RenderTrait.Radioactive | RenderTrait.Carrier, 101, 4, 7, 1234, 0.4, 12, -5,
    );
    const secondAlpha = shadeCanvasEnergy(
      second, secondGlow, 223, 239, 255, RenderProfile.Radioactive,
      RenderTrait.Radioactive | RenderTrait.Carrier, 101, 4, 7, 1234, 0.4, 12, -5,
    );
    expect(second).toEqual(first);
    expect(secondGlow).toEqual(firstGlow);
    expect(secondAlpha).toBe(firstAlpha);
  });

  it('uses Carrier for motion detail and Radioactive only for isotope tint', () => {
    const isotope = new Float32Array(3), isotopeGlow = new Float32Array(3);
    const carrier = new Float32Array(3), carrierGlow = new Float32Array(3);
    shadeCanvasEnergy(
      isotope, isotopeGlow, 120, 120, 120, RenderProfile.Radioactive,
      RenderTrait.Radioactive, 111, 5, 8, 740, 0.3, 18, -2,
    );
    shadeCanvasEnergy(
      carrier, carrierGlow, 120, 120, 120, RenderProfile.Neutral,
      RenderTrait.Carrier, 97, 5, 8, 740, 0.3, 18, -2,
    );
    expect(isotope[2] - isotope[0]).toBeGreaterThan(carrier[2] - carrier[0]);
    expect(carrier).not.toEqual(isotope);
  });

  it('adds opposed bounded macro relief only to a dense energy field', () => {
    expect(canvasEnergyCoreReliefScale(1, 0)).toBe(1);
    expect(canvasEnergyCoreReliefScale(1, 255)).toBeGreaterThan(1.07);
    expect(canvasEnergyCoreReliefScale(-1, 255)).toBeLessThan(0.93);
    expect(canvasEnergyCoreReliefScale(1, 255, 18))
      .toBeGreaterThan(canvasEnergyCoreReliefScale(1, 255, -18));
    for (let wave = -1.5; wave <= 1.5; wave += 0.05) {
      const scale = canvasEnergyCoreReliefScale(wave, 255);
      expect(scale).toBeGreaterThanOrEqual(0.925);
      expect(scale).toBeLessThanOrEqual(1.075);
    }
    expect(canvasEnergyCoreReliefScale(1, 255, 18)).toBeLessThanOrEqual(1.10);
    expect(canvasEnergyCoreReliefScale(-1, 255, -18)).toBeGreaterThanOrEqual(0.90);
  });

  it('changes dense core RGB without changing glow or alpha', () => {
    const flat = new Float32Array(3), flatGlow = new Float32Array(3);
    const relieved = new Float32Array(3), relievedGlow = new Float32Array(3);
    const flatAlpha = shadeCanvasEnergy(
      flat, flatGlow, 110, 70, 40, RenderProfile.Neutral, 0,
      4, 10, 50, 0, 0.2, 0, 0, 255, false,
    );
    const relievedAlpha = shadeCanvasEnergy(
      relieved, relievedGlow, 110, 70, 40, RenderProfile.Neutral, 0,
      4, 10, 50, 0, 0.2, 0, 0, 255, true,
    );
    expect(relieved).not.toEqual(flat);
    expect(relievedGlow).toEqual(flatGlow);
    expect(relievedAlpha).toBe(flatAlpha);
  });

  it('toggles exact identity RGB off-on-off without changing glow or alpha', () => {
    const render = (enabled: boolean) => {
      const core = new Float32Array(3), glow = new Float32Array(3);
      const alpha = shadeCanvasEnergy(
        core, glow, 255, 255, 255, RenderProfile.Radioactive,
        RenderTrait.Radioactive | RenderTrait.Carrier,
        107, 13, 21, 960, 0.35, 18, -9, 128, true, 0, enabled,
      );
      return { core, glow, alpha };
    };
    const flat = render(false);
    const styled = render(true);
    const flatAgain = render(false);
    expect(styled.core).not.toEqual(flat.core);
    expect(styled.glow).toEqual(flat.glow);
    expect(styled.alpha).toBe(flat.alpha);
    expect(flatAgain).toEqual(flat);
  });
});
