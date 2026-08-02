import { Material } from '../shared/materials';
import { WIFI_PRESENTATION_STATE } from '../simulation/types';

export interface CanvasWifiPresentationState {
  readonly channel: number;
  readonly active: boolean;
}

/**
 * Decodes only an exact native WIFI projection. The high owner bit is required
 * even for channel zero, so a stale word from another multiplexed owner cannot
 * create a wireless display cue.
 */
export function canvasWifiPresentationState(
  material: number,
  state: number,
): CanvasWifiPresentationState | undefined {
  if (material !== Material.WIFI || (state & WIFI_PRESENTATION_STATE.presentMask) === 0) {
    return undefined;
  }
  return {
    channel: Math.min(WIFI_PRESENTATION_STATE.channelMaximum,
      state & WIFI_PRESENTATION_STATE.channelMask),
    active: (state & WIFI_PRESENTATION_STATE.activeMask) !== 0,
  };
}

/**
 * Renders WIFI's native temperature-selected channel as a static spectral rail,
 * with a stronger cyan-to-amber response while the simulation-owned broadcast
 * latch is active. This changes RGB only; alpha, support, walls, ownership,
 * topology, and the native signal lifecycle remain elsewhere.
 */
export function applyCanvasWifiStateStyle(
  output: Float32Array,
  material: number,
  state: number,
): void {
  const presentation = canvasWifiPresentationState(material, state);
  if (!presentation) return;

  const channel = presentation.channel / WIFI_PRESENTATION_STATE.channelMaximum;
  const targetRed = 76 + channel * 156;
  const targetGreen = 184 - channel * 82;
  const targetBlue = 224 - channel * 134;
  const blend = presentation.active ? 0.50 : 0.28;
  output[0] = clampByte(output[0] + (targetRed - output[0]) * blend
    + (presentation.active ? 8 : 0));
  output[1] = clampByte(output[1] + (targetGreen - output[1]) * blend
    + (presentation.active ? 14 : 0));
  output[2] = clampByte(output[2] + (targetBlue - output[2]) * blend
    + (presentation.active ? 18 : 0));
}

function clampByte(value: number): number { return Math.max(0, Math.min(255, value)); }
