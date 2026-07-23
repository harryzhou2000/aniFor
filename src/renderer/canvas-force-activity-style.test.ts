import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import {
  applyCanvasForceActivityStyle,
  FORCE_ACTIVITY_STATE_MASK,
  isForceActivityMaterial,
} from './canvas-force-activity-style';

const SOURCE = [90, 100, 110, 0.37] as const;
const SOURCE_FLOAT = Array.from(new Float32Array(SOURCE));

function styled(material: number, state: number, x: number, y: number): number[] {
  const rgba = new Float32Array(SOURCE);
  applyCanvasForceActivityStyle(rgba, material, state, x, y);
  return Array.from(rgba);
}

describe('Canvas ACEL/DCEL native-activity styling', () => {
  it('recognizes only the two exact native owners', () => {
    expect(Material.ACEL).toBe(115);
    expect(Material.DCEL).toBe(116);
    expect(isForceActivityMaterial(Material.ACEL)).toBe(true);
    expect(isForceActivityMaterial(Material.DCEL)).toBe(true);
    for (const material of [
      Material.Empty, Material.Metal, Material.DMG, Material.FRAY, 114, 117, -1, 256,
    ]) {
      expect(isForceActivityMaterial(material)).toBe(false);
    }
  });

  it('is an exact no-op for inactive state bits and wrong owners', () => {
    expect(FORCE_ACTIVITY_STATE_MASK).toBe(1);
    expect(styled(Material.ACEL, 0, 11, 2)).toEqual(SOURCE_FLOAT);
    expect(styled(Material.DCEL, 2, 14, 8)).toEqual(SOURCE_FLOAT);
    expect(styled(Material.Metal, 1, 11, 2)).toEqual(SOURCE_FLOAT);
  });

  it('draws the accelerator chevron and directional wake from bit zero only', () => {
    expect(styled(Material.ACEL, 1, 11, 2)).toEqual([106, 111, 106, SOURCE_FLOAT[3]]);
    expect(styled(Material.ACEL, 1, 3, 8)).toEqual([98, 105, 108, SOURCE_FLOAT[3]]);
    expect(styled(Material.ACEL, 1, 0, 0)).toEqual(SOURCE_FLOAT);
    expect(styled(Material.ACEL, 0xffff, 11, 2)).toEqual(styled(Material.ACEL, 1, 11, 2));
  });

  it('draws a distinct decelerator braking ring and restrained core', () => {
    expect(styled(Material.DCEL, 1, 14, 8)).toEqual([93, 110, 126, SOURCE_FLOAT[3]]);
    expect(styled(Material.DCEL, 1, 8, 8)).toEqual([82, 95, 113, SOURCE_FLOAT[3]]);
    expect(styled(Material.DCEL, 1, 0, 0)).toEqual(SOURCE_FLOAT);
    expect(styled(Material.DCEL, 3, 14, 8)).toEqual(styled(Material.DCEL, 1, 14, 8));
  });

  it('is deterministic, world-periodic, RGB-bounded, and alpha-invariant', () => {
    for (const material of [Material.ACEL, Material.DCEL]) {
      for (let y = -17; y <= 32; y++) {
        for (let x = -17; x <= 32; x++) {
          const first = styled(material, 1, x, y);
          const repeated = styled(material, 1, x, y);
          const translated = styled(material, 1, x + 16, y + 16);
          expect(repeated).toEqual(first);
          expect(translated).toEqual(first);
          for (let channel = 0; channel < 3; channel++) {
            expect(Math.abs(first[channel] - SOURCE[channel])).toBeLessThanOrEqual(16);
          }
          expect(first[3]).toBe(SOURCE_FLOAT[3]);
        }
      }
    }
  });
});
