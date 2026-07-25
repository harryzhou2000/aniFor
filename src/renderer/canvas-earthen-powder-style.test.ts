import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import {
  applyCanvasEarthenPowderStyle,
  CANVAS_EARTHEN_POWDER_MATERIALS,
  canvasEarthenPowderStyle,
  isCanvasEarthenPowderMaterial,
} from './canvas-earthen-powder-style';

const SOURCE = [104, 116, 128, 173] as const;

function shade(material: number, x: number, y: number): number[] {
  const output = new Float32Array(SOURCE);
  applyCanvasEarthenPowderStyle(output, material, x, y);
  return Array.from(output);
}

describe('Canvas earthen-powder material styling', () => {
  it('maps exactly the four earth-derived powder materials', () => {
    expect(CANVAS_EARTHEN_POWDER_MATERIALS).toEqual([
      Material.Dust, Material.Stone, Material.Concrete, Material.Clay,
    ]);
    CANVAS_EARTHEN_POWDER_MATERIALS.forEach((material, index) => {
      expect(canvasEarthenPowderStyle(material)).toBe(index + 1);
      expect(isCanvasEarthenPowderMaterial(material)).toBe(true);
    });
    for (const material of [Material.Empty, Material.Sand, Material.Water, Material.Glass, 256, -1, 1.5]) {
      expect(canvasEarthenPowderStyle(material)).toBe(0);
      expect(isCanvasEarthenPowderMaterial(material)).toBe(false);
    }
  });

  it('is deterministic, RGB-bounded, and alpha-invariant', () => {
    for (const material of CANVAS_EARTHEN_POWDER_MATERIALS) {
      for (let y = -24; y <= 31; y++) for (let x = -27; x <= 35; x++) {
        const first = shade(material, x + 0.82, y + 0.19);
        expect(shade(material, x + 0.82, y + 0.19)).toEqual(first);
        expect(first[3]).toBe(SOURCE[3]);
        for (let channel = 0; channel < 3; channel++) {
          expect(Math.abs(first[channel] - SOURCE[channel])).toBeLessThanOrEqual(8);
        }
      }
    }
  });

  it('gives every earth material a distinct low-frequency multi-cell fingerprint', () => {
    const fingerprints = new Set<string>();
    for (const material of CANVAS_EARTHEN_POWDER_MATERIALS) {
      const fingerprint: number[] = [];
      for (let y = 0; y < 52; y++) for (let x = 0; x < 61; x++) {
        fingerprint.push(...shade(material, x, y).slice(0, 3));
      }
      fingerprints.add(fingerprint.join(','));
    }
    expect(fingerprints.size).toBe(CANVAS_EARTHEN_POWDER_MATERIALS.length);
  });

  it('is an exact no-op for non-earthen controls', () => {
    for (const material of [Material.Empty, Material.Sand, Material.Water, Material.Glass, Material.Brick]) {
      expect(shade(material, 13.9, 17.2)).toEqual(Array.from(SOURCE));
    }
  });
});
