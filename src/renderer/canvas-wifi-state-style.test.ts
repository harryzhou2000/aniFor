import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { WIFI_PRESENTATION_STATE } from '../simulation/types';
import { applyCanvasWifiStateStyle, canvasWifiPresentationState } from './canvas-wifi-state-style';

const present = WIFI_PRESENTATION_STATE.presentMask;
const active = WIFI_PRESENTATION_STATE.activeMask;

describe('Canvas WIFI native state styling', () => {
  it('decodes only an exact present WIFI owner and clamps native channel words', () => {
    expect(canvasWifiPresentationState(Material.WIFI, present | 43)).toEqual({
      channel: 43, active: false,
    });
    expect(canvasWifiPresentationState(Material.WIFI, present | active | 0x7f)).toEqual({
      channel: 100, active: true,
    });
    expect(canvasWifiPresentationState(Material.Metal, present | active | 43)).toBeUndefined();
    expect(canvasWifiPresentationState(Material.WIFI, active | 43)).toBeUndefined();
  });

  it('keeps absent state exact while channel and native activity alter RGB only', () => {
    const absent = new Float32Array([48, 64, 80, 173]);
    const coolIdle = new Float32Array(absent);
    const warmIdle = new Float32Array(absent);
    const warmActive = new Float32Array(absent);

    applyCanvasWifiStateStyle(absent, Material.WIFI, 45);
    applyCanvasWifiStateStyle(coolIdle, Material.WIFI, present);
    applyCanvasWifiStateStyle(warmIdle, Material.WIFI, present | 100);
    applyCanvasWifiStateStyle(warmActive, Material.WIFI, present | active | 100);

    expect([...absent]).toEqual([48, 64, 80, 173]);
    expect(coolIdle[3]).toBe(173);
    expect(warmActive[3]).toBe(173);
    expect(warmActive[0]).toBeGreaterThan(coolIdle[0]);
    expect(warmActive[2]).toBeLessThan(coolIdle[2]);
    expect(warmActive[0]).toBeGreaterThan(warmIdle[0]);
    expect(warmActive[1]).toBeGreaterThan(warmIdle[1]);
    expect(warmActive[2]).toBeGreaterThan(warmIdle[2]);
  });
});
