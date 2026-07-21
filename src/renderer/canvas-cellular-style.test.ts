import { describe, expect, it } from 'vitest';
import { LIFE_PRESETS, Material } from '../shared/materials';
import {
  CANVAS_CELLULAR_FIRST_MATERIAL,
  CANVAS_CELLULAR_LAST_MATERIAL,
  isCanvasCellularMaterial,
  shadeCanvasCellularMaterial,
} from './canvas-cellular-style';

const SAMPLE_POINTS = [
  [0, 0], [1, 2], [4, 3], [7, 9], [12, 5], [19, 23], [31, 17], [47, 38],
] as const;

describe('Canvas cellular material styling', () => {
  it('covers exactly the 24 stable native LIFE projections', () => {
    expect(CANVAS_CELLULAR_FIRST_MATERIAL).toBe(Material.LIFE_GOL);
    expect(CANVAS_CELLULAR_LAST_MATERIAL).toBe(Material.LIFE_BRAN);
    expect(CANVAS_CELLULAR_LAST_MATERIAL - CANVAS_CELLULAR_FIRST_MATERIAL + 1).toBe(24);
    for (const { material } of LIFE_PRESETS) expect(isCanvasCellularMaterial(material)).toBe(true);
    expect(isCanvasCellularMaterial(Material.VSNS)).toBe(false);
    expect(isCanvasCellularMaterial(Material.BIZRG)).toBe(false);
  });

  it('is deterministic, bounded, and never mutates caller-owned alpha', () => {
    for (const { material } of LIFE_PRESETS) {
      for (const [x, y] of SAMPLE_POINTS) {
        const output = new Float32Array([100, 110, 120, 173]);
        shadeCanvasCellularMaterial(output, material, x, y);
        const repeated = new Float32Array([100, 110, 120, 173]);
        shadeCanvasCellularMaterial(repeated, material, x, y);
        expect(repeated).toEqual(output);
        expect(output[3]).toBe(173);
        expect(Math.max(
          Math.abs(output[0] - 100),
          Math.abs(output[1] - 110),
          Math.abs(output[2] - 120),
        )).toBeLessThanOrEqual(10);
      }
    }
  });

  it('gives every preset a distinct static multi-cell fingerprint', () => {
    const fingerprints = new Set<string>();
    for (const preset of LIFE_PRESETS) {
      const canonical = Number.parseInt(preset.color.slice(1), 16);
      const red = canonical >>> 16;
      const green = canonical >>> 8 & 0xff;
      const blue = canonical & 0xff;
      const fingerprint: number[] = [];
      for (const [x, y] of SAMPLE_POINTS) {
        const output = new Float32Array([red, green, blue]);
        shadeCanvasCellularMaterial(output, preset.material, x, y);
        fingerprint.push(output[0], output[1], output[2]);
      }
      fingerprints.add(fingerprint.join(','));
    }
    expect(fingerprints.size).toBe(LIFE_PRESETS.length);
  });

  it('separates presets that intentionally share a canonical palette color', () => {
    const fingerprint = (material: Material, red: number, green: number, blue: number): string => {
      const values: number[] = [];
      for (const [x, y] of SAMPLE_POINTS) {
        const output = new Float32Array([red, green, blue]);
        shadeCanvasCellularMaterial(output, material, x, y);
        values.push(output[0], output[1], output[2]);
      }
      return values.join(',');
    };
    expect(fingerprint(Material.LIFE_HLIF, 255, 0, 0))
      .not.toBe(fingerprint(Material.LIFE_LOTE, 255, 0, 0));
    expect(fingerprint(Material.LIFE_2X2, 255, 255, 0))
      .not.toBe(fingerprint(Material.LIFE_BRAN, 255, 255, 0));
  });

  it('is an exact no-op outside the LIFE projection range', () => {
    for (const material of [Material.VSNS, Material.BIZRG, Material.STKM, Material.VINE]) {
      const output = new Float32Array([17, 29, 43, 211]);
      shadeCanvasCellularMaterial(output, material, 19, 23);
      expect(Array.from(output)).toEqual([17, 29, 43, 211]);
    }
  });
});
