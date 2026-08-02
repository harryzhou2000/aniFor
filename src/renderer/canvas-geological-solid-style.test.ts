import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import {
  applyCanvasGeologicalSolidCoreOptics,
  CANVAS_GEOLOGICAL_SOLID_MATERIALS,
  CanvasGeologicalSolidStyle,
  canvasGeologicalSolidStyle,
  isCanvasGeologicalSolidMaterial,
} from './canvas-geological-solid-style';

const SOURCE = [104, 116, 128, 173] as const;

function shade(
  material: number,
  x: number,
  y: number,
  denseInterior = true,
  opticalDepthByte = 42,
  relief = 4,
  opticalDepthEnabled = true,
): number[] {
  const output = new Float32Array(SOURCE);
  applyCanvasGeologicalSolidCoreOptics(
    output, material, x, y, denseInterior, opticalDepthByte, relief, opticalDepthEnabled,
  );
  return Array.from(output);
}

describe('Canvas geological solid core optics', () => {
  it('maps exactly Coal and ROCK', () => {
    expect(CANVAS_GEOLOGICAL_SOLID_MATERIALS).toEqual([Material.Coal, Material.ROCK]);
    expect(canvasGeologicalSolidStyle(Material.Coal)).toBe(CanvasGeologicalSolidStyle.Coal);
    expect(canvasGeologicalSolidStyle(Material.ROCK)).toBe(CanvasGeologicalSolidStyle.Rock);
    for (const material of [Material.Empty, Material.Stone, Material.Concrete, Material.Metal, -1, 256]) {
      expect(canvasGeologicalSolidStyle(material)).toBe(CanvasGeologicalSolidStyle.None);
      expect(isCanvasGeologicalSolidMaterial(material)).toBe(false);
    }
    for (const material of CANVAS_GEOLOGICAL_SOLID_MATERIALS) {
      expect(isCanvasGeologicalSolidMaterial(material)).toBe(true);
    }
  });

  it('is depth-proven, RGB-only, deterministic, and bounded', () => {
    for (const material of CANVAS_GEOLOGICAL_SOLID_MATERIALS) {
      for (let y = -16; y <= 24; y++) for (let x = -16; x <= 24; x++) {
        const first = shade(material, x, y);
        expect(shade(material, x, y)).toEqual(first);
        expect(first[3]).toBe(SOURCE[3]);
        for (let channel = 0; channel < 3; channel++) {
          expect(Math.abs(first[channel] - SOURCE[channel])).toBeLessThanOrEqual(12);
        }
      }
    }
  });

  it('is an exact no-op before the deep same-owner body proof', () => {
    for (const material of CANVAS_GEOLOGICAL_SOLID_MATERIALS) {
      expect(shade(material, 13, 17, false)).toEqual(Array.from(SOURCE));
      expect(shade(material, 13, 17, true, 6)).toEqual(Array.from(SOURCE));
      expect(shade(material, 13, 17, true, 42, 4, false)).toEqual(Array.from(SOURCE));
    }
  });

  it('gives Coal and ROCK distinct depth-sensitive body fingerprints', () => {
    const fingerprints = new Set<string>();
    for (const material of CANVAS_GEOLOGICAL_SOLID_MATERIALS) {
      const fingerprint: number[] = [];
      for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) {
        fingerprint.push(...shade(material, x, y, true, 42, x < 20 ? -4 : 4).slice(0, 3));
      }
      fingerprints.add(fingerprint.join(','));
      expect(shade(material, 13, 17, true, 42, 4)).not.toEqual(
        shade(material, 13, 17, true, 12, 4),
      );
    }
    expect(fingerprints.size).toBe(CANVAS_GEOLOGICAL_SOLID_MATERIALS.length);
  });

  it('is an exact no-op for other materials', () => {
    expect(shade(Material.Water, 13, 17)).toEqual(Array.from(SOURCE));
    expect(shade(Material.BCOL, 13, 17)).toEqual(Array.from(SOURCE));
  });
});
