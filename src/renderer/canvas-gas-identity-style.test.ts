import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import {
  applyCanvasGasIdentityStyle,
  CANVAS_GAS_IDENTITY_LOOKUP_BYTES,
  GAS_IDENTITY_STYLE_BY_MATERIAL,
  canvasGasIdentityStyle,
} from './canvas-gas-identity-style';

const IDENTITY_GASES = [
  Material.Smoke,
  Material.Steam,
  Material.Gas,
  Material.Oxygen,
  Material.Hydrogen,
  Material.CarbonDioxide,
  Material.NobleGas,
  Material.BOYL,
  Material.CAUS,
  Material.FOG,
  Material.RFRG,
  Material.CFLM,
  Material.AMTR,
  Material.WARP,
  Material.BIZRG,
  Material.MORT,
  Material.VRSG,
] as const;

function style(
  styleClass: number,
  x: number,
  y: number,
  density = 0.72,
  relief = 0.12,
  curvature = 0.08,
): Uint8ClampedArray {
  const target = new Uint8ClampedArray([19, 23, 29, 31, 96, 112, 128, 173, 181, 191, 203, 211]);
  applyCanvasGasIdentityStyle(target, 4, styleClass, x, y, density, relief, curvature);
  return target;
}

describe('Canvas gas identity styling', () => {
  it('maps exactly the ordered seventeen requested native identities', () => {
    expect(GAS_IDENTITY_STYLE_BY_MATERIAL.byteLength).toBe(256);
    for (let index = 0; index < IDENTITY_GASES.length; index++) {
      expect(canvasGasIdentityStyle(IDENTITY_GASES[index])).toBe(index + 1);
    }
    const expected = new Set<number>(IDENTITY_GASES);
    for (let material = 0; material < 256; material++) {
      expect(canvasGasIdentityStyle(material)).toBe(expected.has(material)
        ? IDENTITY_GASES.indexOf(material as (typeof IDENTITY_GASES)[number]) + 1 : 0);
    }
    expect(canvasGasIdentityStyle(-1)).toBe(0);
    expect(canvasGasIdentityStyle(256)).toBe(0);
  });

  it('keeps one cross-backend world-independent motif atlas below eighteen KiB', () => {
    expect(CANVAS_GAS_IDENTITY_LOOKUP_BYTES).toBe(17_851);
    expect(CANVAS_GAS_IDENTITY_LOOKUP_BYTES).toBeLessThan(18 * 1024);
  });

  it('is deterministic, RGB-only, sentinel-safe, and bounded to twelve bytes', () => {
    for (let styleClass = 1; styleClass <= IDENTITY_GASES.length; styleClass++) {
      for (let y = -8; y < 24; y++) for (let x = -8; x < 24; x++) {
        const output = style(styleClass, x, y);
        expect(style(styleClass, x, y)).toEqual(output);
        expect(Array.from(output.slice(0, 4))).toEqual([19, 23, 29, 31]);
        expect(Array.from(output.slice(8))).toEqual([181, 191, 203, 211]);
        expect(output[7]).toBe(173);
        expect(Math.max(
          Math.abs(output[4] - 96),
          Math.abs(output[5] - 112),
          Math.abs(output[6] - 128),
        )).toBeLessThanOrEqual(12);
      }
    }
  });

  it('gives all seventeen identities unique coherent spatial fingerprints', () => {
    const fingerprints = new Set<string>();
    for (let styleClass = 1; styleClass <= IDENTITY_GASES.length; styleClass++) {
      let fingerprint = 2166136261;
      const responses = new Set<string>();
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        const output = style(styleClass, x, y, 0.78, 0, 0);
        const response = [output[4] - 96, output[5] - 112, output[6] - 128];
        responses.add(response.join(','));
        for (const delta of response) {
          fingerprint = Math.imul(fingerprint ^ (delta + 31), 16777619) >>> 0;
        }
      }
      expect(responses.size, `style ${styleClass} response count`).toBeGreaterThanOrEqual(3);
      fingerprints.add(fingerprint.toString(16));
    }
    expect(fingerprints.size).toBe(IDENTITY_GASES.length);
  });

  it('retains characteristic motifs at their authored spatial anchors', () => {
    const anchors = [
      [0, 0, 5, 5], // soot islands
      [0, 0, 7, 0], // vapour fold
      [3, 2, 7, 2], // fuel eddy
      [0, 0, 4, 0], // oxygen lift
      [0, 0, 2, 0], // hydrogen wisp
      [0, 0, 0, 5], // CO2 bank
      [4, 1, 4, 4], // noble diamond
      [1, 1, 1, 5], // BOYL vortex
      [0, 0, 3, 0], // caustic vein
      [0, 0, 0, 8], // fog bank
      [4, 1, 2, 1], // refrigerant frost
      [4, 0, 0, 0], // cold flame tongue
      [4, 4, 1, 1], // antimatter void
      [0, 0, 4, 0], // warp shear
      [0, 0, 3, 0], // bizarre prism
      [0, 0, 0, 5], // exhaust band
      [0, 4, 4, 4], // viral vesicle
    ] as const;
    for (let index = 0; index < anchors.length; index++) {
      const [x1, y1, x2, y2] = anchors[index];
      expect(style(index + 1, x1, y1, 0.8, 0, 0), `style ${index + 1} motif anchors`)
        .not.toEqual(style(index + 1, x2, y2, 0.8, 0, 0));
    }
  });

  it('responds independently to density, relief, and curvature without touching support', () => {
    for (let styleClass = 1; styleClass <= IDENTITY_GASES.length; styleClass++) {
      const sparse = style(styleClass, 7, 11, 0.08, 0, 0);
      const dense = style(styleClass, 7, 11, 0.92, 0, 0);
      const relief = style(styleClass, 7, 11, 0.5, 0.4, 0);
      const curvature = style(styleClass, 7, 11, 0.5, 0, 0.4);
      let densityResponse = !dense.slice(4, 7).every((value, channel) => (
        value === sparse[4 + channel]
      ));
      for (let y = 0; y < 16 && !densityResponse; y++) for (let x = 0; x < 16; x++) {
        const localSparse = style(styleClass, x, y, 0.08, 0, 0);
        const localDense = style(styleClass, x, y, 0.92, 0, 0);
        if (!localDense.slice(4, 7).every((value, channel) => (
          value === localSparse[4 + channel]
        ))) densityResponse = true;
      }
      expect(densityResponse, `style ${styleClass} density`).toBe(true);
      expect(relief.slice(4, 7), `style ${styleClass} relief`)
        .not.toEqual(style(styleClass, 7, 11, 0.5, 0, 0).slice(4, 7));
      expect(curvature.slice(4, 7), `style ${styleClass} curvature`)
        .not.toEqual(style(styleClass, 7, 11, 0.5, 0, 0).slice(4, 7));
      for (const output of [sparse, dense, relief, curvature]) expect(output[7]).toBe(173);
    }
  });

  it('is an exact no-op for zero and out-of-range decoded styles', () => {
    for (const styleClass of [-1, 0, 18, 255]) {
      const output = style(styleClass, 5, 7, 1, 1, 1);
      expect(Array.from(output)).toEqual([19, 23, 29, 31, 96, 112, 128, 173, 181, 191, 203, 211]);
    }
  });
});
