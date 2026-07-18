import { describe, expect, it } from 'vitest';
import {
  applicableCanvasRenderTraits, applyCanvasRenderTraits, CANVAS_RENDER_TRAIT_CLOCK_SIZE,
  updateCanvasRenderTraitClock,
} from './canvas-render-traits';
import { RenderPhase } from './render-profile';
import { RenderTrait } from './render-traits';

function shade(traits: number, phase = RenderPhase.Solid, time = 420): Float32Array {
  const rgb = new Float32Array([90, 100, 110]);
  const clock = new Int32Array(CANVAS_RENDER_TRAIT_CLOCK_SIZE);
  updateCanvasRenderTraitClock(clock, time);
  applyCanvasRenderTraits(
    rgb, traits, phase, 101, 12, 7, 440, clock,
  );
  return rgb;
}

describe('Canvas render traits', () => {
  it('updates deterministic full-range animation clocks once per frame', () => {
    const clock = new Int32Array(CANVAS_RENDER_TRAIT_CLOCK_SIZE);
    updateCanvasRenderTraitClock(clock, 0);
    expect(Array.from(clock)).toEqual([0, 0, 0, 0, 0]);
    updateCanvasRenderTraitClock(clock, 1_000);
    expect(Array.from(clock)).toEqual([7, 5, 14, 6, 18]);
    updateCanvasRenderTraitClock(clock, 1_055);
    expect(Array.from(clock)).toEqual([7, 5, 15, 6, 19]);
  });

  it('is a no-op for ordinary materials', () => {
    expect(Array.from(shade(0))).toEqual([90, 100, 110]);
  });

  it('produces distinct composable role accents in the reusable RGB scratch', () => {
    const emitter = shade(RenderTrait.Emitter);
    const sinkChannel = shade(RenderTrait.Sink | RenderTrait.Channel);
    const organic = shade(RenderTrait.Organic | RenderTrait.Fibrous);
    expect(emitter).not.toEqual(sinkChannel);
    expect(organic).not.toEqual(emitter);
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

  it('keeps finite RGB in the reusable scratch for the existing pixel writer to clamp', () => {
    const rgb = new Float32Array([254, 253, 252]);
    const clock = new Int32Array(CANVAS_RENDER_TRAIT_CLOCK_SIZE);
    updateCanvasRenderTraitClock(clock, 900);
    applyCanvasRenderTraits(
      rgb, 255, RenderPhase.Solid, 103, 3, 4, 27, clock,
    );
    expect(Array.from(rgb).every(Number.isFinite)).toBe(true);
    expect(rgb.some((channel) => channel > 255)).toBe(true);
  });
});
