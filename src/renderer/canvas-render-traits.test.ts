import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
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

  it('can isolate role graphics without suppressing unrelated traits', () => {
    const clock = new Int32Array(CANVAS_RENDER_TRAIT_CLOCK_SIZE);
    updateCanvasRenderTraitClock(clock, 420);
    const disabled = new Float32Array([90, 100, 110]);
    applyCanvasRenderTraits(
      disabled, RenderTrait.Emitter | RenderTrait.Channel,
      RenderPhase.Solid, Material.CLNE, 12, 7, 440, clock, false,
    );
    expect(Array.from(disabled)).toEqual([90, 100, 110]);

    const radioactive = new Float32Array([90, 100, 110]);
    applyCanvasRenderTraits(
      radioactive, RenderTrait.Emitter | RenderTrait.Radioactive,
      RenderPhase.Solid, Material.VIBR, 12, 7, 440, clock, false,
    );
    expect(Array.from(radioactive)).not.toEqual([90, 100, 110]);
  });

  it('leaves botanical identity to morphology while preserving every other trait', () => {
    const clock = new Int32Array(CANVAS_RENDER_TRAIT_CLOCK_SIZE);
    updateCanvasRenderTraitClock(clock, 420);
    const retained = RenderTrait.Emitter | RenderTrait.Sink | RenderTrait.Channel
      | RenderTrait.Force | RenderTrait.Radioactive | RenderTrait.Carrier;
    for (const material of [
      Material.Wood, Material.Plant, Material.VINE, Material.SEED, Material.YEST,
    ]) {
      const rolesOnly = new Float32Array([90, 100, 110]);
      applyCanvasRenderTraits(
        rolesOnly, retained, RenderPhase.Solid, material, 12, 7, 440, clock,
      );
      const botanicalTraits = new Float32Array([90, 100, 110]);
      applyCanvasRenderTraits(
        botanicalTraits, retained | RenderTrait.Organic | RenderTrait.Fibrous,
        RenderPhase.Solid, material, 12, 7, 440, clock,
      );
      expect(Array.from(botanicalTraits)).toEqual(Array.from(rolesOnly));
      expect(Array.from(rolesOnly)).not.toEqual([90, 100, 110]);
    }
  });

  it('does not suppress organic identity on viruses or actors', () => {
    const clock = new Int32Array(CANVAS_RENDER_TRAIT_CLOCK_SIZE);
    updateCanvasRenderTraitClock(clock, 420);
    for (const [material, phase] of [
      [Material.VIRS, RenderPhase.Liquid],
      [Material.VRSG, RenderPhase.Gas],
      [Material.VRSS, RenderPhase.Solid],
      [Material.FIGH, RenderPhase.Solid],
      [Material.STKM, RenderPhase.Solid],
      [Material.STKM2, RenderPhase.Solid],
    ] as const) {
      const styled = new Float32Array([90, 100, 110]);
      applyCanvasRenderTraits(
        styled, RenderTrait.Organic | RenderTrait.Fibrous,
        phase, material, 12, 7, 440, clock,
      );
      expect(Array.from(styled)).not.toEqual([90, 100, 110]);
    }
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
