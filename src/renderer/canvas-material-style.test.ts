import { describe, expect, it } from 'vitest';
import { shadeCanvasMaterial } from './canvas-material-style';
import { RenderOptics } from './render-optics';
import { RenderProfile } from './render-profile';

describe('Canvas material-family styling', () => {
  it('gives every canonical profile a stable distinguishable response', () => {
    const colors = new Set<string>();
    for (let profile = RenderProfile.Neutral; profile <= RenderProfile.Field; profile++) {
      const output = new Float32Array(3);
      const fingerprint: number[] = [];
      for (const [x, y, index] of [[19, 23, 1_250], [24, 31, 1_809], [7, 42, 2_619]]) {
        shadeCanvasMaterial(
          output, 110, 120, 130, profile, RenderOptics.Default, 37, x, y, index, 4_000,
        );
        const first = Array.from(output);
        shadeCanvasMaterial(
          output, 110, 120, 130, profile, RenderOptics.Default, 37, x, y, index, 4_000,
        );
        expect(Array.from(output)).toEqual(first);
        fingerprint.push(...first);
      }
      colors.add(fingerprint.join(','));
    }
    expect(colors.size).toBe(7);
  });

  it('keeps canonical color as the base and clamps extreme channels', () => {
    const neutral = new Float32Array(3);
    shadeCanvasMaterial(
      neutral, 110, 120, 130, RenderProfile.Neutral, RenderOptics.Default, 1, 2, 3, 4, 0,
    );
    expect(Math.abs(neutral[0] - 110)).toBeLessThan(3);
    expect(Math.abs(neutral[1] - 120)).toBeLessThan(3);
    expect(Math.abs(neutral[2] - 130)).toBeLessThan(3);

    const clamped = new Float32Array(3);
    shadeCanvasMaterial(
      clamped, 255, 255, 255, RenderProfile.Field, RenderOptics.Radioactive, 99, 1, 1, 1, 0,
    );
    expect(Array.from(clamped).every((channel) => channel >= 0 && channel <= 255)).toBe(true);
  });

  it('gives every solid optics class a distinct RGB response without touching alpha', () => {
    const colors = new Set<string>();
    for (const optics of [
      RenderOptics.RoughGranular,
      RenderOptics.SmoothRigid,
      RenderOptics.Organic,
      RenderOptics.Device,
      RenderOptics.Radioactive,
      RenderOptics.TranslucentRigid,
    ]) {
      const output = new Float32Array([0, 0, 0, 173]);
      const fingerprint: number[] = [];
      for (const [x, y, index] of [[19, 23, 1_250], [24, 31, 1_809], [7, 42, 2_619]]) {
        shadeCanvasMaterial(
          output, 110, 120, 130, RenderProfile.Neutral, optics, 37, x, y, index, 4_000,
        );
        fingerprint.push(output[0], output[1], output[2]);
        expect(output[3]).toBe(173);
      }
      colors.add(fingerprint.join(','));
    }
    expect(colors.size).toBe(6);
  });

  it('keeps rough-granular albedo variation visible independently of alpha', () => {
    const output = new Float32Array([0, 0, 0, 191]);
    let minimum = Infinity;
    let maximum = -Infinity;
    for (let index = 0; index < 64; index++) {
      shadeCanvasMaterial(
        output, 180, 140, 80, RenderProfile.Granular, RenderOptics.RoughGranular,
        1, index, 3, index, 0,
      );
      minimum = Math.min(minimum, output[1]);
      maximum = Math.max(maximum, output[1]);
      expect(output[3]).toBe(191);
    }
    expect(maximum - minimum).toBeGreaterThan(24);
  });

  it('keeps the device circuit lattice visible beneath broad body depth', () => {
    const trace = new Float32Array(3);
    const substrate = new Float32Array(3);
    shadeCanvasMaterial(
      trace, 120, 150, 180, RenderProfile.Device, RenderOptics.Device,
      37, 3, 4, 2_451, 0,
    );
    shadeCanvasMaterial(
      substrate, 120, 150, 180, RenderProfile.Device, RenderOptics.Device,
      37, 4, 4, 2_451, 0,
    );
    expect(trace[0] - substrate[0]).toBeGreaterThanOrEqual(14);
    expect(trace[1] - substrate[1]).toBeGreaterThanOrEqual(21);
    expect(trace[2] - substrate[2]).toBeGreaterThanOrEqual(30);
  });
});
