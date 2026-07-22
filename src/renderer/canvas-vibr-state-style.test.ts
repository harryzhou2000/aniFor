import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { applyCanvasVibrStateStyle } from './canvas-vibr-state-style';

function styled(material: Material, state: number, x = 8, y = 8): number[] {
  const rgb = new Float32Array([90, 100, 110]);
  applyCanvasVibrStateStyle(rgb, material, state, x, y);
  return Array.from(rgb);
}

describe('Canvas VIBR/BVBR native-state styling', () => {
  it('is an exact no-op for zero state and wrong owners', () => {
    expect(styled(Material.VIBR, 0)).toEqual([90, 100, 110]);
    expect(styled(Material.Metal, 100 | 255 << 7 | 0x8000)).toEqual([90, 100, 110]);
  });

  it('increases charge response monotonically across both family phases', () => {
    for (const material of [Material.VIBR, Material.BVBR]) {
      const low = styled(material, 20);
      const medium = styled(material, 60);
      const high = styled(material, 100);
      expect(medium[1] - 100).toBeGreaterThan(low[1] - 100);
      expect(high[1] - 100).toBeGreaterThan(medium[1] - 100);
      expect(medium[2] - 110).toBeGreaterThan(low[2] - 110);
      expect(high[2] - 110).toBeGreaterThan(medium[2] - 110);
    }
  });

  it('shows countdown rings and distinguishes the alternate mode', () => {
    const charged = styled(Material.VIBR, 100, 11, 8);
    const exploding = styled(Material.VIBR, 100 | 255 << 7, 11, 8);
    const alternate = styled(Material.VIBR, 100 | 255 << 7 | 0x8000, 11, 8);
    expect(exploding[0]).toBeGreaterThan(charged[0]);
    expect(exploding[1]).toBeGreaterThan(charged[1]);
    expect(alternate).not.toEqual(exploding);
    expect(alternate[2]).toBeGreaterThan(exploding[2]);
  });

  it('keeps the bounded RGB response independent of alpha/support state', () => {
    const output = styled(Material.BVBR, 100 | 255 << 7 | 0x8000, 8, 8);
    for (let channel = 0; channel < 3; channel++) {
      expect(Math.abs(output[channel] - (90 + channel * 10))).toBeLessThanOrEqual(34);
    }
  });
});
