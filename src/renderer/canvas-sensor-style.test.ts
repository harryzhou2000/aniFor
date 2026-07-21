import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import {
  applyCanvasSensorMorphology,
  CANVAS_SENSOR_BEZEL_SIZE,
  CANVAS_SENSOR_FIRST_MATERIAL,
  CANVAS_SENSOR_LAST_MATERIAL,
  isCanvasSensorMaterial,
} from './canvas-sensor-style';

const SENSORS = [
  Material.DTEC,
  Material.INVIS,
  Material.LDTC,
  Material.LSNS,
  Material.PSNS,
  Material.TSNS,
  Material.VSNS,
] as const;

describe('Canvas sensor morphology', () => {
  it('covers exactly the seven stable native sensor identities', () => {
    expect(CANVAS_SENSOR_FIRST_MATERIAL).toBe(Material.DTEC);
    expect(CANVAS_SENSOR_LAST_MATERIAL).toBe(Material.VSNS);
    expect(CANVAS_SENSOR_LAST_MATERIAL - CANVAS_SENSOR_FIRST_MATERIAL + 1).toBe(7);
    for (const material of SENSORS) expect(isCanvasSensorMaterial(material)).toBe(true);
    expect(isCanvasSensorMaterial(Material.STOR)).toBe(false);
    expect(isCanvasSensorMaterial(Material.LIFE_GOL)).toBe(false);
  });

  it('is deterministic, 24-cell periodic, bounded, and never mutates alpha', () => {
    for (const material of SENSORS) {
      for (let y = 0; y < CANVAS_SENSOR_BEZEL_SIZE; y++) {
        for (let x = 0; x < CANVAS_SENSOR_BEZEL_SIZE; x++) {
          const styled = new Float32Array([96, 112, 128, 173]);
          applyCanvasSensorMorphology(styled, material, x, y);
          const repeated = new Float32Array([96, 112, 128, 173]);
          applyCanvasSensorMorphology(repeated, material, x, y);
          const translated = new Float32Array([96, 112, 128, 173]);
          applyCanvasSensorMorphology(
            translated,
            material,
            x + CANVAS_SENSOR_BEZEL_SIZE * 3,
            y - CANVAS_SENSOR_BEZEL_SIZE * 2,
          );
          expect(repeated).toEqual(styled);
          expect(translated).toEqual(styled);
          expect(styled[3]).toBe(173);
          expect(Math.max(
            Math.abs(styled[0] - 96),
            Math.abs(styled[1] - 112),
            Math.abs(styled[2] - 128),
          )).toBeLessThanOrEqual(14);
        }
      }
    }
  });

  it('gives all seven bezel glyphs unique deterministic full-face fingerprints', () => {
    const fingerprints = new Set<string>();
    for (const material of SENSORS) {
      let fingerprint = 2166136261;
      let changed = 0;
      for (let y = 0; y < CANVAS_SENSOR_BEZEL_SIZE; y++) {
        for (let x = 0; x < CANVAS_SENSOR_BEZEL_SIZE; x++) {
          const output = new Float32Array([100, 110, 120, 199]);
          applyCanvasSensorMorphology(output, material, x, y);
          for (let channel = 0; channel < 3; channel++) {
            const delta = Math.round(output[channel] - (100 + channel * 10));
            if (delta !== 0) changed++;
            fingerprint = Math.imul(fingerprint ^ (delta + 31), 16777619) >>> 0;
          }
        }
      }
      expect(changed).toBeGreaterThan(100);
      fingerprints.add(fingerprint.toString(16));
    }
    expect(fingerprints.size).toBe(SENSORS.length);
  });

  it('keeps the requested semantic glyph anchors independently visible', () => {
    const response = (material: Material, x: number, y: number): readonly number[] => {
      const output = new Float32Array([100, 110, 120, 201]);
      applyCanvasSensorMorphology(output, material, x, y);
      return Array.from(output);
    };

    expect(response(Material.DTEC, 12, 7)).not.toEqual(response(Material.DTEC, 7, 7));
    expect(response(Material.INVIS, 12, 6)).not.toEqual(response(Material.INVIS, 7, 7));
    expect(response(Material.LDTC, 7, 16)).not.toEqual(response(Material.LDTC, 7, 7));
    expect(response(Material.LSNS, 12, 7)).not.toEqual(response(Material.LSNS, 12, 12));
    expect(response(Material.PSNS, 12, 5)).not.toEqual(response(Material.PSNS, 7, 8));
    expect(response(Material.TSNS, 12, 8)).not.toEqual(response(Material.TSNS, 7, 7));
    expect(response(Material.VSNS, 17, 12)).not.toEqual(response(Material.VSNS, 7, 7));
  });

  it('is an exact no-op outside sensors, including adjacent material IDs', () => {
    for (const material of [
      Material.Empty, Material.STOR, Material.LIFE_GOL, Material.WIRE, Material.VINE,
    ]) {
      const output = new Float32Array([17, 29, 43, 211]);
      applyCanvasSensorMorphology(output, material, 12, 12);
      expect(Array.from(output)).toEqual([17, 29, 43, 211]);
    }
  });
});
