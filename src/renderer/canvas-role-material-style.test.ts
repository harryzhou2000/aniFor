import { describe, expect, it } from 'vitest';
import { applyCanvasRoleMaterialStyle } from './canvas-role-material-style';
import { RenderTrait } from './render-traits';

describe('Canvas semantic role material style', () => {
  it('gives every role a distinct stable broad response', () => {
    const fingerprints = new Set<string>();
    for (const traits of [
      RenderTrait.Emitter, RenderTrait.Sink, RenderTrait.Channel, RenderTrait.Force,
      RenderTrait.Emitter | RenderTrait.Sink,
    ]) {
      const values: number[] = [];
      for (let y = 4; y < 28; y += 4) for (let x = 3; x < 27; x += 4) {
        const color = new Float32Array([100, 110, 120, 173]);
        applyCanvasRoleMaterialStyle(color, traits, 127, x, y);
        values.push(color[0], color[1], color[2]);
        expect(color[3]).toBe(173);
        expect(Math.max(
          color[0] - 100, color[1] - 110, color[2] - 120,
        )).toBeLessThanOrEqual(24);
      }
      fingerprints.add(values.join(','));
    }
    expect(fingerprints.size).toBe(5);
  });

  it('preserves role chroma and is an exact no-op for neutral devices', () => {
    const emitter = new Float32Array([100, 100, 100]);
    const sink = new Float32Array([100, 100, 100]);
    const force = new Float32Array([100, 100, 100]);
    applyCanvasRoleMaterialStyle(emitter, RenderTrait.Emitter, 126, 8, 9);
    applyCanvasRoleMaterialStyle(sink, RenderTrait.Sink, 130, 8, 9);
    applyCanvasRoleMaterialStyle(force, RenderTrait.Force, 115, 8, 9);
    expect(emitter[0] - emitter[2]).toBeGreaterThan(0);
    expect(sink[2] - sink[0]).toBeGreaterThan(0);
    expect(force[2] - force[0]).toBeGreaterThan(0);

    const device = new Float32Array([100, 110, 120, 173]);
    applyCanvasRoleMaterialStyle(device, 0, 136, 8, 9);
    expect(Array.from(device)).toEqual([100, 110, 120, 173]);
  });
});
