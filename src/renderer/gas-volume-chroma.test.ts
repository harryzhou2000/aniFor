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

  it('adds a cool hue-aware key and warm absorbing fill without changing alpha', () => {
    const key = new Uint8ClampedArray([96, 112, 136, 83]);
    const fill = key.slice();
    applyCanvasGasVolumeChroma(key, 0, 0.05, 100, 120, 150);
    applyCanvasGasVolumeChroma(fill, 0, -0.05, 100, 120, 150);
    expect(key[2] - 136).toBeGreaterThan(key[0] - 96);
    expect(fill[0] - 96).toBeLessThan(fill[2] - 136);
    expect(key[3]).toBe(83);
    expect(fill[3]).toBe(83);
  });

  it('is an exact no-op at zero response', () => {
    const target = new Uint8ClampedArray([96, 112, 136, 83]);
    const original = target.slice();
    applyCanvasGasVolumeChroma(target, 0, 0, 100, 120, 150);
    expect(target).toEqual(original);
  });
});
