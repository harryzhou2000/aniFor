import { describe, expect, it } from 'vitest';
import { blackbodyRadiance, blackbodyRgb, semanticTemperatureKelvin } from './blackbody-emission';

describe('blackbody emission', () => {
  it('reconstructs the semantic byte temperature scale', () => {
    expect(semanticTemperatureKelvin(0)).toBe(0);
    expect(semanticTemperatureKelvin(100)).toBeCloseTo(2560);
    expect(semanticTemperatureKelvin(255)).toBeCloseTo(6528);
  });

  it('moves monotonically from warm orange toward white as temperature rises', () => {
    const warm = blackbodyRgb(new Float32Array(3), 40);
    const hot = blackbodyRgb(new Float32Array(3), 120);
    const white = blackbodyRgb(new Float32Array(3), 255);
    expect(warm[0]).toBeGreaterThan(warm[1]);
    expect(warm[1]).toBeGreaterThan(warm[2]);
    expect(hot[2]).toBeGreaterThan(warm[2]);
    expect(white[2]).toBeGreaterThan(hot[2]);
    expect(Array.from(white).every((channel) => channel >= 0 && channel <= 1)).toBe(true);
  });

  it('keeps ordinary temperatures dark and grows bounded HDR radiance', () => {
    expect(blackbodyRadiance(11)).toBe(0);
    expect(blackbodyRadiance(28)).toBe(0);
    expect(blackbodyRadiance(52)).toBeGreaterThan(0);
    expect(blackbodyRadiance(255)).toBeCloseTo(2.75);
  });
});
