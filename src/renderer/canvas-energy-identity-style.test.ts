import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import {
  ENERGY_IDENTITY_STYLE_BY_MATERIAL,
  applyCanvasEnergyIdentityStyle,
  canvasEnergyIdentityStyle,
} from './canvas-energy-identity-style';

const ENERGY_IDENTITIES = [
  Material.Fire, Material.Plasma, Material.ELEC, Material.GRVT, Material.NEUT,
  Material.PHOT, Material.PROT, Material.BRAY, Material.EMBR,
] as const;

function shade(material: number, x: number, y: number, time = 840): Float32Array {
  const rgb = new Float32Array([96, 112, 128]);
  applyCanvasEnergyIdentityStyle(rgb, material, x, y, time, 24, -12);
  return rgb;
}

describe('Canvas exact energy identity style', () => {
  it('maps exactly the nine native energy-core identities', () => {
    expect(ENERGY_IDENTITY_STYLE_BY_MATERIAL.byteLength).toBe(256);
    const expected = new Set<number>(ENERGY_IDENTITIES);
    for (let index = 0; index < ENERGY_IDENTITIES.length; index++) {
      expect(canvasEnergyIdentityStyle(ENERGY_IDENTITIES[index])).toBe(index + 1);
    }
    for (let material = 0; material < 256; material++) {
      expect(canvasEnergyIdentityStyle(material)).toBe(expected.has(material)
        ? ENERGY_IDENTITIES.indexOf(material as (typeof ENERGY_IDENTITIES)[number]) + 1 : 0);
    }
    expect(canvasEnergyIdentityStyle(-1)).toBe(0);
    expect(canvasEnergyIdentityStyle(256)).toBe(0);
  });

  it('is deterministic, unsupported-material safe, and bounded to fourteen RGB levels', () => {
    expect(Array.from(shade(Material.Water, 7, 11))).toEqual([96, 112, 128]);
    for (const material of ENERGY_IDENTITIES) {
      for (let y = -8; y < 24; y++) for (let x = -8; x < 24; x++) {
        const first = shade(material, x, y);
        expect(shade(material, x, y)).toEqual(first);
        for (let channel = 0; channel < 3; channel++) {
          expect(Math.abs(first[channel] - [96, 112, 128][channel])).toBeLessThanOrEqual(14);
        }
      }
    }
  });

  it('gives every exact identity a coherent unique spatial fingerprint', () => {
    const fingerprints = new Set<string>();
    for (const material of ENERGY_IDENTITIES) {
      let fingerprint = 2166136261;
      const responses = new Set<string>();
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        const output = shade(material, x, y);
        const delta = [output[0] - 96, output[1] - 112, output[2] - 128];
        responses.add(delta.join(','));
        for (const value of delta) fingerprint = Math.imul(fingerprint ^ (value + 31), 16777619) >>> 0;
      }
      expect(responses.size).toBeGreaterThanOrEqual(2);
      fingerprints.add(fingerprint.toString(16));
    }
    expect(fingerprints.size).toBe(ENERGY_IDENTITIES.length);
  });

  it('can calm a dense-body identity without touching alpha or its sparse source bound', () => {
    const source = new Float32Array([120, 128, 136, 191]);
    const full = new Float32Array(source);
    const reduced = new Float32Array(source);
    const absent = new Float32Array(source);
    applyCanvasEnergyIdentityStyle(full, Material.PHOT, 12, 8, 300, 0, 0, 1);
    applyCanvasEnergyIdentityStyle(reduced, Material.PHOT, 12, 8, 300, 0, 0, 0.35);
    applyCanvasEnergyIdentityStyle(absent, Material.PHOT, 12, 8, 300, 0, 0, 0);
    for (let channel = 0; channel < 3; channel++) {
      const fullDelta = full[channel] - source[channel];
      const reducedDelta = reduced[channel] - source[channel];
      expect(Math.abs(fullDelta)).toBeLessThanOrEqual(14);
      expect(Math.abs(reducedDelta)).toBeLessThanOrEqual(Math.abs(fullDelta));
    }
    expect(full[3]).toBe(source[3]);
    expect(reduced[3]).toBe(source[3]);
    expect(absent).toEqual(source);
  });
});
