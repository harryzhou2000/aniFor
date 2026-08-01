import { Material } from '../shared/materials';
import { PIPE_PRESENTATION_STATE } from '../simulation/types';

export const enum PipePayloadCategory {
  Liquid = 1,
  GasOrEnergy = 2,
  Granular = 3,
  RigidOrDevice = 4,
}

export interface PipePresentationState {
  readonly payload: number | undefined;
  readonly unknownPayload: boolean;
  readonly route: number;
  readonly paused: boolean;
}

/** Decodes only exact PIPE/PPIP owner words from the shared state plane. */
export function canvasPipePresentationState(
  material: number,
  state: number,
): PipePresentationState | undefined {
  if (material !== Material.PIPE && material !== Material.PPIP) return undefined;
  const loaded = (state & PIPE_PRESENTATION_STATE.payloadPresentMask) !== 0;
  const candidate = state & PIPE_PRESENTATION_STATE.payloadMask;
  const payload = loaded && candidate > 0 && candidate <= 217 ? candidate : undefined;
  return {
    payload,
    unknownPayload: loaded && payload === undefined,
    route: Math.min(PIPE_PRESENTATION_STATE.routeMaximum,
      (state & PIPE_PRESENTATION_STATE.routeMask) >>> PIPE_PRESENTATION_STATE.routeShift),
    paused: material === Material.PPIP && (state & PIPE_PRESENTATION_STATE.pausedMask) !== 0,
  };
}

/** A compact, palette-free transport class mirrored by both GLSL paths. */
export function pipePayloadCategory(payload: number): PipePayloadCategory {
  if (payload === Material.Water || payload === Material.Oil || payload === Material.Lava
    || payload === Material.Ice || payload === Material.Acid || payload === Material.SaltWater
    || payload === Material.DistilledWater || payload === Material.Diesel || payload === Material.Mercury
    || payload === Material.LiquidNitrogen || payload === Material.Soap || payload === Material.BOYL
    || payload === Material.CAUS || payload === Material.GOO) return PipePayloadCategory.Liquid;
  if (payload === Material.Fire || payload === Material.Smoke || payload === Material.Steam
    || payload === Material.Gas || payload === Material.Plasma || payload === Material.Oxygen
    || payload === Material.Hydrogen || payload === Material.CarbonDioxide || payload === Material.NobleGas
    || payload === Material.FOG || payload === Material.CFLM || payload === Material.ELEC
    || payload === Material.NEUT || payload === Material.PHOT || payload === Material.PROT) {
    return PipePayloadCategory.GasOrEnergy;
  }
  if (payload === Material.Sand || payload === Material.Dust || payload === Material.Salt
    || payload === Material.Gunpowder || payload === Material.Snow || payload === Material.Stone
    || payload === Material.Clay || payload === Material.Thermite || payload === Material.C4
    || payload === Material.Nitro || payload === Material.Firework || payload === Material.BANG
    || payload === Material.BOMB || payload === Material.C5 || payload === Material.DEST) {
    return PipePayloadCategory.Granular;
  }
  return PipePayloadCategory.RigidOrDevice;
}

/**
 * Adds a static exact-owner transport cue after the device-body grammar.
 * The caller retains semantic alpha, walls, and topology.
 */
export function applyCanvasPipePresentationStyle(
  output: Float32Array,
  material: number,
  state: number,
): void {
  const presentation = canvasPipePresentationState(material, state);
  if (!presentation) return;

  let target: readonly number[];
  let blend: number;
  if (presentation.payload !== undefined) {
    target = payloadTarget(pipePayloadCategory(presentation.payload));
    blend = 0.42;
  } else if (presentation.unknownPayload) {
    target = [144, 150, 160];
    blend = 0.34;
  } else {
    target = routeTarget(presentation.route);
    blend = 0.27;
  }
  output[0] = clampByte(output[0] + (target[0] - output[0]) * blend);
  output[1] = clampByte(output[1] + (target[1] - output[1]) * blend);
  output[2] = clampByte(output[2] + (target[2] - output[2]) * blend);
  if (presentation.paused) {
    // PPIP's native pause is deliberately quiet, without a synthetic pulse.
    output[0] = clampByte(output[0] * 0.91 + 9);
    output[1] = clampByte(output[1] * 0.93 + 11);
    output[2] = clampByte(output[2] * 0.98 + 16);
  }
}

function payloadTarget(category: PipePayloadCategory): readonly number[] {
  if (category === PipePayloadCategory.Liquid) return [58, 148, 192];
  if (category === PipePayloadCategory.GasOrEnergy) return [160, 102, 210];
  if (category === PipePayloadCategory.Granular) return [202, 148, 66];
  return [118, 166, 185];
}

function routeTarget(route: number): readonly number[] {
  if (route === 1) return [62, 167, 185];
  if (route === 2) return [193, 139, 66];
  if (route === 3) return [168, 91, 184];
  return [83, 122, 174];
}

function clampByte(value: number): number { return Math.max(0, Math.min(255, value)); }
