import { Material } from '../shared/materials';
import { STOR_PRESENTATION_STATE } from '../simulation/types';
import { PipePayloadCategory, pipePayloadCategory } from './canvas-pipe-state-style';

export interface StorPresentationState {
  /** A valid public material identity, when native STOR currently holds one. */
  readonly payload: number | undefined;
  /** Native STOR is holding an unrepresentable/unknown native payload. */
  readonly unknownPayload: boolean;
  /** Native STOR released a particle recently and is in its short cooldown. */
  readonly cooldown: boolean;
}

/**
 * Decodes the owner-multiplexed native STOR word without granting it ownership
 * of any other semantic material. A zero word is an ordinary empty ready STOR.
 */
export function canvasStorPresentationState(
  material: number,
  state: number,
): StorPresentationState | undefined {
  if (material !== Material.STOR) return undefined;
  const loaded = (state & STOR_PRESENTATION_STATE.payloadPresentMask) !== 0;
  const candidate = state & STOR_PRESENTATION_STATE.payloadMask;
  const payload = loaded && candidate > 0 && candidate <= 217 ? candidate : undefined;
  return {
    payload,
    unknownPayload: loaded && payload === undefined,
    cooldown: (state & STOR_PRESENTATION_STATE.cooldownMask) !== 0,
  };
}

/**
 * Adds a static contained-reservoir cue after the ordinary STOR device body.
 * Existing native state decides only RGB: semantic alpha, walls, topology,
 * physics, and the actual stored native particle remain entirely caller-owned.
 */
export function applyCanvasStorStateStyle(
  output: Float32Array,
  material: number,
  state: number,
): void {
  const presentation = canvasStorPresentationState(material, state);
  if (!presentation || (!presentation.payload && !presentation.unknownPayload && !presentation.cooldown)) {
    return;
  }

  if (presentation.payload !== undefined) {
    const target = storPayloadTarget(pipePayloadCategory(presentation.payload));
    output[0] = clampByte(output[0] + (target[0] - output[0]) * 0.36);
    output[1] = clampByte(output[1] + (target[1] - output[1]) * 0.36);
    output[2] = clampByte(output[2] + (target[2] - output[2]) * 0.36);
  } else if (presentation.unknownPayload) {
    // The contained cyan reservoir remains visible even when native payload
    // identity has no public render projection.
    output[0] = clampByte(output[0] + (78 - output[0]) * 0.30);
    output[1] = clampByte(output[1] + (177 - output[1]) * 0.30);
    output[2] = clampByte(output[2] + (194 - output[2]) * 0.30);
  }

  if (presentation.cooldown) {
    // A post-release STOR should read as a cooling bay, not as a second active
    // particle. Keep this quiet enough to layer with the loaded reservoir.
    output[0] = clampByte(output[0] * 0.95 + 3);
    output[1] = clampByte(output[1] * 0.98 + 5);
    output[2] = clampByte(output[2] * 1.02 + 9);
  }
}

function storPayloadTarget(category: PipePayloadCategory): readonly number[] {
  if (category === PipePayloadCategory.Liquid) return [55, 187, 206];
  if (category === PipePayloadCategory.GasOrEnergy) return [93, 169, 211];
  if (category === PipePayloadCategory.Granular) return [122, 177, 171];
  return [69, 185, 198];
}

function clampByte(value: number): number { return Math.max(0, Math.min(255, value)); }
