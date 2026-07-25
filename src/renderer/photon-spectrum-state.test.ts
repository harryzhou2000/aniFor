import { describe, expect, it } from 'vitest';
import {
  applyCanvasPhotonSpectrumStyle,
  encodePhotonSpectrumState,
  photonSpectrumChannelByte,
  photonStateIsActive,
  photonStateIsPresent,
} from './photon-spectrum-state';

describe('independent PHOT spectrum state', () => {
  it('packs visible wavelength populations without making zero-spectrum PHOT absent', () => {
    const black = encodePhotonSpectrumState(0, 0, 0);
    const spectrum = encodePhotonSpectrumState(12, 7, 2);
    expect(photonStateIsPresent(black)).toBe(true);
    expect(photonStateIsPresent(spectrum)).toBe(true);
    expect(photonSpectrumChannelByte(spectrum, 0)).toBe(192);
    expect(photonSpectrumChannelByte(spectrum, 4)).toBe(112);
    expect(photonSpectrumChannelByte(spectrum, 8)).toBe(32);
  });

  it('changes only RGB, leaving the underlying semantic alpha to its matter owner', () => {
    const color = new Float32Array([40, 80, 160]);
    applyCanvasPhotonSpectrumStyle(color, encodePhotonSpectrumState(12, 0, 0));
    expect(color[0]).toBeGreaterThan(color[1]);
    expect(color[0]).toBeGreaterThan(color[2]);
    expect(color).not.toEqual(new Float32Array([40, 80, 160]));
  });

  it('allows a scan-wide WebGL sampler guard to stay dormant on photon-free scenes', () => {
    expect(photonStateIsActive(new Uint16Array(4))).toBe(false);
    expect(photonStateIsActive(new Uint16Array([0, 0, encodePhotonSpectrumState(1, 1, 1)]))).toBe(true);
  });
});
