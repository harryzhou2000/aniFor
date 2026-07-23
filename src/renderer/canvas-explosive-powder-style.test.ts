import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import {
  applyCanvasExplosivePowderStyle,
  CANVAS_EXPLOSIVE_POWDER_MATERIALS,
  canvasExplosivePowderFamily,
  canvasExplosivePowderStyle,
  CanvasExplosivePowderFamily,
  isCanvasExplosivePowderMaterial,
} from './canvas-explosive-powder-style';

describe('Canvas explosive-powder styling', () => {
  it('recognizes exactly the fourteen requested material identities', () => {
    expect(CANVAS_EXPLOSIVE_POWDER_MATERIALS).toEqual([
      Material.Gunpowder,
      Material.Thermite,
      Material.C4,
      Material.Firework,
      Material.BANG,
      Material.BOMB,
      Material.C5,
      Material.DEST,
      Material.FIRW,
      Material.FSEP,
      Material.FUSE,
      Material.IGNT,
      Material.LITH,
      Material.RBDM,
    ]);

    const expected = new Set<number>(CANVAS_EXPLOSIVE_POWDER_MATERIALS);
    for (let material = 0; material < 256; material++) {
      expect(isCanvasExplosivePowderMaterial(material)).toBe(expected.has(material));
      expect(canvasExplosivePowderStyle(material) !== 0).toBe(expected.has(material));
    }
    expect(canvasExplosivePowderStyle(-1)).toBe(0);
    expect(canvasExplosivePowderStyle(14.5)).toBe(0);
    expect(canvasExplosivePowderStyle(256)).toBe(0);
  });

  it('assigns the intended shared family signatures', () => {
    expect(canvasExplosivePowderFamily(Material.Gunpowder))
      .toBe(CanvasExplosivePowderFamily.EnergeticCompound);
    expect(canvasExplosivePowderFamily(Material.Firework))
      .toBe(CanvasExplosivePowderFamily.Pyrotechnic);
    expect(canvasExplosivePowderFamily(Material.BOMB))
      .toBe(CanvasExplosivePowderFamily.HighExplosive);
    expect(canvasExplosivePowderFamily(Material.FUSE))
      .toBe(CanvasExplosivePowderFamily.Fuse);
    expect(canvasExplosivePowderFamily(Material.RBDM))
      .toBe(CanvasExplosivePowderFamily.ReactiveMetal);
    expect(canvasExplosivePowderFamily(Material.Sand))
      .toBe(CanvasExplosivePowderFamily.None);
  });

  it('is deterministic, world-integer, RGB-only, and bounded to fourteen bytes', () => {
    for (const material of CANVAS_EXPLOSIVE_POWDER_MATERIALS) {
      for (let y = -19; y <= 23; y++) {
        for (let x = -17; x <= 29; x++) {
          const output = new Float32Array([96, 112, 128, 173]);
          applyCanvasExplosivePowderStyle(output, material, x + 0.2, y + 0.7);
          const sameCell = new Float32Array([96, 112, 128, 173]);
          applyCanvasExplosivePowderStyle(sameCell, material, x + 0.9, y + 0.1);
          expect(sameCell).toEqual(output);
          expect(output[3]).toBe(173);
          expect(Math.max(
            Math.abs(output[0] - 96),
            Math.abs(output[1] - 112),
            Math.abs(output[2] - 128),
          )).toBeLessThanOrEqual(14);
        }
      }
    }
  });

  it('gives every material a distinct visible modular fingerprint', () => {
    const fingerprints = new Set<number>();
    for (const material of CANVAS_EXPLOSIVE_POWDER_MATERIALS) {
      let fingerprint = 2166136261;
      const responses = new Set<string>();
      for (let y = 0; y < 31; y++) {
        for (let x = 0; x < 37; x++) {
          const output = new Float32Array([100, 110, 120, 191]);
          applyCanvasExplosivePowderStyle(output, material, x, y);
          const red = Math.round((output[0] - 100) * 100);
          const green = Math.round((output[1] - 110) * 100);
          const blue = Math.round((output[2] - 120) * 100);
          responses.add(`${red},${green},${blue}`);
          fingerprint = Math.imul(fingerprint ^ (red + 1401), 16777619) >>> 0;
          fingerprint = Math.imul(fingerprint ^ (green + 1401), 16777619) >>> 0;
          fingerprint = Math.imul(fingerprint ^ (blue + 1401), 16777619) >>> 0;
        }
      }
      expect(responses.size).toBeGreaterThan(3);
      fingerprints.add(fingerprint);
    }
    expect(fingerprints.size).toBe(CANVAS_EXPLOSIVE_POWDER_MATERIALS.length);
  });

  it('is an exact no-op for representative non-explosive controls', () => {
    for (const material of [
      Material.Empty,
      Material.Sand,
      Material.Water,
      Material.Metal,
      Material.DEUT,
      Material.Fire,
      -1,
      256,
    ]) {
      const output = new Float32Array([17, 29, 43, 211]);
      applyCanvasExplosivePowderStyle(output, material, 12, 19);
      expect(Array.from(output)).toEqual([17, 29, 43, 211]);
    }
  });
});
