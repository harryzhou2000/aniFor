import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { QUARTZ_PRESENTATION_STATE } from '../simulation/types';
import {
  applyCanvasQuartzCrystalStateStyle,
  CANVAS_QUARTZ_CRYSTAL_STATE_MAX_CHANNEL_DELTA,
  canvasQuartzCrystalSpeckle,
} from './canvas-quartz-crystal-state-style';

const SOURCE = [128, 128, 128] as const;

function styled(material: Material, speckle: number): number[] {
  const output = new Float32Array(SOURCE);
  applyCanvasQuartzCrystalStateStyle(output, material, speckle);
  return Array.from(output);
}

describe('Canvas native PQRT/QRTZ crystal state styling', () => {
  it('decodes only exact owners and preserves native 0..10 bounds', () => {
    expect(canvasQuartzCrystalSpeckle(Material.Quartz, 0)).toBe(0);
    expect(canvasQuartzCrystalSpeckle(Material.QRTZ, 10)).toBe(10);
    expect(canvasQuartzCrystalSpeckle(Material.Quartz, QUARTZ_PRESENTATION_STATE.speckleMask)).toBe(10);
    expect(canvasQuartzCrystalSpeckle(Material.Quartz, QUARTZ_PRESENTATION_STATE.reservedMask)).toBe(0);
    expect(canvasQuartzCrystalSpeckle(Material.Salt, 10)).toBeUndefined();
  });

  it('keeps the upstream neutral seed exact and responds monotonically around it', () => {
    expect(styled(Material.Quartz, QUARTZ_PRESENTATION_STATE.neutralSpeckle)).toEqual(SOURCE);
    const dark = styled(Material.Quartz, 0);
    const bright = styled(Material.Quartz, 10);
    for (let channel = 0; channel < 3; channel++) {
      expect(dark[channel]).toBeLessThan(SOURCE[channel]);
      expect(bright[channel]).toBeGreaterThan(SOURCE[channel]);
    }
  });

  it('keeps solid QRTZ cooler and never changes more than its RGB bound', () => {
    const powder = styled(Material.Quartz, 10);
    const solid = styled(Material.QRTZ, 10);
    expect(solid[2] - SOURCE[2]).toBeGreaterThan(solid[0] - SOURCE[0]);
    expect(powder[0] - SOURCE[0]).toBeGreaterThan(powder[1] - SOURCE[1]);
    for (const value of [...powder, ...solid]) {
      expect(Math.abs(value - SOURCE[0])).toBeLessThanOrEqual(CANVAS_QUARTZ_CRYSTAL_STATE_MAX_CHANNEL_DELTA);
    }
  });

  it('is a strict RGB no-op for unrelated material owners', () => {
    const output = new Float32Array(SOURCE);
    applyCanvasQuartzCrystalStateStyle(output, Material.Water, 10);
    expect(Array.from(output)).toEqual(SOURCE);
  });
});
