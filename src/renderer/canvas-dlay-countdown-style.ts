import { Material } from '../shared/materials';
import { DLAY_PRESENTATION_STATE } from '../simulation/types';

/**
 * Returns the exact native DLAY countdown only for its semantic owner and a
 * present projected word. An idle DLAY is a valid present zero, while every
 * foreign/stale word remains an exact presentation no-op.
 */
export function canvasDlayCountdown(material: number, state: number): number | undefined {
  if (material !== Material.DLAY || (state & DLAY_PRESENTATION_STATE.presentMask) === 0) {
    return undefined;
  }
  return state & DLAY_PRESENTATION_STATE.countdownMask;
}

/**
 * Gives a pending native DLAY a restrained warm countdown core after its
 * ordinary electronic grammar. Temperature only normalizes the native delay
 * range (DLAY derives that range from temperature); it cannot advance time.
 * RGB is the sole output: alpha, walls, topology, ownership, and physics stay
 * with the caller and the native simulation.
 */
export function applyCanvasDlayCountdownStyle(
  output: Float32Array,
  material: number,
  state: number,
  temperatureDecikelvin: number | undefined,
): void {
  const countdown = canvasDlayCountdown(material, state);
  if (countdown === undefined || countdown <= 0) return;
  const temperatureKelvin = (temperatureDecikelvin ?? 2952) / 10;
  const configuredDelay = clamp(temperatureKelvin - 273.15, 1, 600);
  const elapsed = 1 - clamp(countdown / configuredDelay, 0, 1);
  const reveal = 0.12 + elapsed * 0.32;
  const target = [236, 132, 66] as const;
  output[0] = clampByte(output[0] + (target[0] - output[0]) * reveal);
  output[1] = clampByte(output[1] + (target[1] - output[1]) * reveal);
  output[2] = clampByte(output[2] + (target[2] - output[2]) * reveal);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
function clampByte(value: number): number { return clamp(value, 0, 255); }
