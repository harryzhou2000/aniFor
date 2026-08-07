import { Material } from '../shared/materials';
import { BASE_PRESENTATION_STATE } from '../simulation/types';

export interface CanvasBasePresentationState {
  /** Exact native BASE `life`, clamped to the upstream graphics range. */
  readonly concentration: number;
  /** Upstream BASE sets `tmp == 1` for the frame in which it attacks a conductor. */
  readonly sparked: boolean;
}

/**
 * Decodes only an exact BASE owner's native graphics state. Concentration zero
 * is authoritative (and visibly dark upstream), so it must not be treated as
 * an absent presentation word.
 */
export function canvasBasePresentationState(
  material: number,
  state: number,
): CanvasBasePresentationState | undefined {
  if (material !== Material.BASE) return undefined;
  return {
    concentration: Math.min(
      BASE_PRESENTATION_STATE.concentrationMaximum,
      state & BASE_PRESENTATION_STATE.concentrationMask,
    ),
    sparked: (state & BASE_PRESENTATION_STATE.sparkMask) !== 0,
  };
}

/**
 * Applies TPT's four native concentration colours as offsets from BASE's
 * canonical 76+ colour. Existing body relief therefore survives unchanged.
 * The reaction spark is a static, world-anchored RGB cue; alpha, support,
 * topology, material ownership, and native state remain caller-owned.
 */
export function applyCanvasBaseStateStyle(
  output: Float32Array,
  material: number,
  state: number,
  x: number,
  y: number,
): void {
  const presentation = canvasBasePresentationState(material, state);
  if (!presentation) return;

  let targetRed = 144;
  let targetGreen = 213;
  let targetBlue = 255;
  if (presentation.concentration <= 25) {
    targetRed = 51;
    targetGreen = 76;
    targetBlue = 216;
  } else if (presentation.concentration <= 50) {
    targetRed = 88;
    targetGreen = 131;
    targetBlue = 232;
  } else if (presentation.concentration <= 75) {
    targetRed = 125;
    targetGreen = 186;
    targetBlue = 247;
  }

  output[0] = clampByte(output[0] + targetRed - 144);
  output[1] = clampByte(output[1] + targetGreen - 213);
  output[2] = clampByte(output[2] + targetBlue - 255);

  if (!presentation.sparked) return;
  const worldX = Math.floor(x);
  const worldY = Math.floor(y);
  const carrier = positiveModulo(worldX * 3 + worldY * 5, 11) <= 1;
  const junction = positiveModulo(worldX - worldY * 2, 17) === 0;
  const gain = carrier ? 1 : junction ? 0.64 : 0.24;
  output[0] = clampByte(output[0] + 14 * gain);
  output[1] = clampByte(output[1] + 27 * gain);
  output[2] = clampByte(output[2] + 30 * gain);
}

function positiveModulo(value: number, divisor: number): number {
  const remainder = value % divisor;
  return remainder < 0 ? remainder + divisor : remainder;
}

function clampByte(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}
