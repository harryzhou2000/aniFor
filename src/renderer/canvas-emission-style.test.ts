import { describe, expect, it } from 'vitest';
import { canvasLocalEmissionAlpha } from './canvas-emission-style';
import { RenderPhase } from './render-profile';

describe('Canvas local emission styling', () => {
  it('keeps volumetric accents below opaque-surface accents', () => {
    const gas = canvasLocalEmissionAlpha(RenderPhase.Gas);
    const liquid = canvasLocalEmissionAlpha(RenderPhase.Liquid);
    const solid = canvasLocalEmissionAlpha(RenderPhase.Solid);
    expect(gas).toBeLessThan(liquid);
    expect(liquid).toBeLessThan(solid);
  });

  it('leaves Energy to its dedicated core and glow path', () => {
    expect(canvasLocalEmissionAlpha(RenderPhase.Energy)).toBe(0);
  });
});
