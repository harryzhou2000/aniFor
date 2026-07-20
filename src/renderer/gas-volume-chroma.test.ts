import { describe, expect, it } from 'vitest';
import {
  applyCanvasGasVolumeChroma,
  canvasGasVolumeChromaResponse,
} from './gas-volume-chroma';

describe('gas volume chroma', () => {
  it('creates bounded bipolar relief and keeps empty support exact', () => {
    expect(canvasGasVolumeChromaResponse(0, 1, 1)).toBe(0);
    const key = canvasGasVolumeChromaResponse(0.24, 0.22, 0.04);
    const fill = canvasGasVolumeChromaResponse(0.24, -0.22, -0.04);
    expect(key).toBeGreaterThan(0);
    expect(fill).toBeLessThan(0);
    expect(Math.abs(key)).toBeLessThanOrEqual(0.06);
    expect(Math.abs(fill)).toBeLessThanOrEqual(0.06);
  });

  it('keeps dense cores quieter than exposed billows', () => {
    const exposed = canvasGasVolumeChromaResponse(0.12, 0.30, 0.04);
    const dense = canvasGasVolumeChromaResponse(0.90, 0.30, 0.04);
    expect(exposed).toBeGreaterThan(dense);
  });

  it('adds a species-aware key and complementary absorbing fill without changing alpha', () => {
    const key = new Uint8ClampedArray([96, 112, 136, 83]);
    const fill = key.slice();
    applyCanvasGasVolumeChroma(key, 0, 0.05, 100, 120, 150);
    applyCanvasGasVolumeChroma(fill, 0, -0.05, 100, 120, 150);
    expect(key[2] - 136).toBeGreaterThan(key[0] - 96);
    expect(fill[0] - 96).toBeLessThan(fill[2] - 136);
    expect(key[3]).toBe(83);
    expect(fill[3]).toBe(83);
  });

  it('separates neutral, oxygen-blue, and noble-violet scattering vectors', () => {
    const scatter = (source: readonly [number, number, number]): number[] => {
      const target = new Uint8ClampedArray([96, 112, 136, 83]);
      applyCanvasGasVolumeChroma(target, 0, 0.06, ...source);
      return [target[0] - 96, target[1] - 112, target[2] - 136];
    };
    const smoke = scatter([150, 146, 142]);
    const oxygen = scatter([112, 204, 255]);
    const noble = scatter([191, 92, 255]);

    expect(smoke[2]).toBeGreaterThan(smoke[0]);
    expect(oxygen[2] - oxygen[0]).toBeGreaterThan(smoke[2] - smoke[0]);
    expect(noble[0]).toBeGreaterThan(noble[1]);
    expect(noble[2]).toBeGreaterThan(noble[1]);
    expect(new Set([smoke.join(','), oxygen.join(','), noble.join(',')]).size).toBe(3);
    expect([...smoke, ...oxygen, ...noble].every((delta) => Math.abs(delta) <= 13)).toBe(true);
  });

  it('uses complementary absorption for coloured gas while retaining the neutral fill', () => {
    const absorb = (source: readonly [number, number, number]): number[] => {
      const target = new Uint8ClampedArray([180, 180, 180, 91]);
      applyCanvasGasVolumeChroma(target, 0, -0.06, ...source);
      return [target[0] - 180, target[1] - 180, target[2] - 180];
    };
    const smoke = absorb([150, 146, 142]);
    const oxygen = absorb([112, 204, 255]);
    const noble = absorb([191, 92, 255]);

    expect(smoke[0]).toBeLessThan(smoke[2]);
    expect(oxygen[0]).toBeLessThan(oxygen[2]);
    expect(noble[1]).toBeLessThan(noble[0]);
    expect(noble[1]).toBeLessThan(noble[2]);
    expect([...smoke, ...oxygen, ...noble].every((delta) => Math.abs(delta) <= 11)).toBe(true);
  });

  it('is an exact no-op at zero response', () => {
    const target = new Uint8ClampedArray([96, 112, 136, 83]);
    const original = target.slice();
    applyCanvasGasVolumeChroma(target, 0, 0, 100, 120, 150);
    expect(target).toEqual(original);
  });
});
