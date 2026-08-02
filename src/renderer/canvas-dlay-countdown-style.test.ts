import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { DLAY_PRESENTATION_STATE } from '../simulation/types';
import {
  applyCanvasDlayCountdownStyle, canvasDlayCountdown,
} from './canvas-dlay-countdown-style';

const present = DLAY_PRESENTATION_STATE.presentMask;

function styled(material: number, state: number, temperature = 2952): number[] {
  const output = new Float32Array([52, 36, 74]);
  applyCanvasDlayCountdownStyle(output, material, state, temperature);
  return Array.from(output);
}

describe('Canvas native DLAY countdown styling', () => {
  it('requires the exact DLAY owner and projected presence marker', () => {
    expect(canvasDlayCountdown(Material.DLAY, present | 17)).toBe(17);
    expect(canvasDlayCountdown(Material.DLAY, present)).toBe(0);
    expect(canvasDlayCountdown(Material.DLAY, 17)).toBeUndefined();
    expect(canvasDlayCountdown(Material.Water, present | 17)).toBeUndefined();
  });

  it('changes only a pending native countdown, increasing its warm cue near expiry', () => {
    const idle = styled(Material.DLAY, present);
    const foreign = styled(Material.Water, present | 1);
    const early = styled(Material.DLAY, present | 22);
    const nearExpiry = styled(Material.DLAY, present | 1);
    expect(idle).toEqual([52, 36, 74]);
    expect(foreign).toEqual(idle);
    expect(early).not.toEqual(idle);
    expect(nearExpiry[0]).toBeGreaterThan(early[0]);
    expect(nearExpiry[1]).toBeGreaterThan(early[1]);
    expect([...early, ...nearExpiry].every((channel) => channel >= 0 && channel <= 255)).toBe(true);
  });
});
