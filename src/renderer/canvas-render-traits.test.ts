import { describe, expect, it } from 'vitest';
import {
  applicableCanvasRenderTraits, applyCanvasRenderTraits, canvasRenderTraitTarget,
} from './canvas-render-traits';
import { RenderPhase } from './render-profile';
import { RenderTrait } from './render-traits';

function shade(traits: number, phase = RenderPhase.Solid, time = 420): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray([90, 100, 110, 173]);
  applyCanvasRenderTraits(pixels, 0, traits, phase, 101, 12, 7, 440, time);
  return pixels;
}

describe('Canvas render traits', () => {
  it('is a no-op for ordinary materials and transparent pixels', () => {
    expect(Array.from(shade(0))).toEqual([90, 100, 110, 173]);
    const transparent = new Uint8ClampedArray([90, 100, 110, 0]);
    applyCanvasRenderTraits(transparent, 0, RenderTrait.Emitter, RenderPhase.Solid, 1, 1, 1, 1, 1);
    expect(Array.from(transparent)).toEqual([90, 100, 110, 0]);
  });

  it('preserves alpha while producing distinct composable role accents', () => {
    const emitter = shade(RenderTrait.Emitter);
    const sinkChannel = shade(RenderTrait.Sink | RenderTrait.Channel);
    const organic = shade(RenderTrait.Organic | RenderTrait.Fibrous);
    expect(emitter[3]).toBe(173);
    expect(sinkChannel[3]).toBe(173);
    expect(organic[3]).toBe(173);
    expect(Array.from(emitter.slice(0, 3))).not.toEqual(Array.from(sinkChannel.slice(0, 3)));
    expect(Array.from(organic.slice(0, 3))).not.toEqual(Array.from(emitter.slice(0, 3)));
  });

  it('leaves the existing Energy core authoritative for carrier styling', () => {
    const ordinaryEnergy = shade(0, RenderPhase.Energy);
    const carrierEnergy = shade(RenderTrait.Carrier, RenderPhase.Energy);
    expect(Array.from(carrierEnergy)).toEqual(Array.from(ordinaryEnergy));
    expect(applicableCanvasRenderTraits(
      RenderTrait.Radioactive | RenderTrait.Carrier, RenderPhase.Energy,
    )).toBe(0);
    expect(applicableCanvasRenderTraits(
      RenderTrait.Radioactive | RenderTrait.Force | RenderTrait.Carrier, RenderPhase.Energy,
    )).toBe(RenderTrait.Force);
  });

  it('routes solid, liquid, and gas traits to their existing semantic planes', () => {
    const base = new Uint8ClampedArray(4);
    const liquid = new Uint8ClampedArray(4);
    const smoke = new Uint8ClampedArray(4);
    expect(canvasRenderTraitTarget(RenderPhase.Solid, base, liquid, smoke)).toBe(base);
    expect(canvasRenderTraitTarget(RenderPhase.Field, base, liquid, smoke)).toBe(base);
    expect(canvasRenderTraitTarget(RenderPhase.Energy, base, liquid, smoke)).toBe(base);
    expect(canvasRenderTraitTarget(RenderPhase.Liquid, base, liquid, smoke)).toBe(liquid);
    expect(canvasRenderTraitTarget(RenderPhase.Gas, base, liquid, smoke)).toBe(smoke);
  });

  it('clamps extreme RGB inputs without allocating an output buffer', () => {
    const pixels = new Uint8ClampedArray([254, 253, 252, 255]);
    applyCanvasRenderTraits(
      pixels, 0, 255, RenderPhase.Solid, 103, 3, 4, 27, 900,
    );
    expect(Array.from(pixels)).toEqual(expect.arrayContaining([255]));
    expect(pixels[3]).toBe(255);
  });
});
