import { isGranularOptics, RenderOptics } from './render-optics';
import { semanticTemperatureByte } from './semantic-field';
import { ROOM_TEMPERATURE_DECIKELVIN } from '../shared/temperature';
import { Material } from '../shared/materials';
import { RenderPhase } from './render-profile';

const AMBIENT_BYTE = semanticTemperatureByte(ROOM_TEMPERATURE_DECIKELVIN);

/**
 * RGB-only thermal response shared with the semantic field shader.
 *
 * The asymmetric knees reserve a one-byte ambient dead band, reach a full cool
 * response near 120 K, and build a restrained warm/incandescent response over
 * a much wider range. This keeps ordinary simulation noise from flickering
 * while making genuinely cold and hot chunks readable as coherent matter.
 */
export function thermalMaterialDelta(
  output: Float32Array,
  temperatureDecikelvin: number | undefined,
  optics: RenderOptics,
): void {
  output[0] = 0;
  output[1] = 0;
  output[2] = 0;
  if (temperatureDecikelvin === undefined) return;

  const temperatureByte = semanticTemperatureByte(temperatureDecikelvin);
  const cold = smoothstep(1, 7, AMBIENT_BYTE - temperatureByte);
  const warm = smoothstep(2, 55, temperatureByte - AMBIENT_BYTE);
  if (cold === 0 && warm === 0) return;

  const gain = thermalOpticsGain(optics);
  const incandescent = smoothstep(0.55, 1, warm);
  output[0] = (-3 * cold + 17 * warm + 9 * incandescent) * gain;
  output[1] = (2 * cold + 4 * warm + 6 * incandescent) * gain;
  output[2] = (14 * cold - 7 * warm + incandescent) * gain;
}

export function thermalOpticsGain(optics: RenderOptics): number {
  if (isGranularOptics(optics)) {
    if (optics === RenderOptics.CrystallineGranular) return 0.82;
    if (optics === RenderOptics.SootyGranular) return 0.62;
    if (optics === RenderOptics.MetallicGranular) return 0.90;
    return 0.72;
  }
  if (optics === RenderOptics.SmoothRigid || optics === RenderOptics.Cellular
    || optics === RenderOptics.MetallicRigid) return 1;
  if (optics === RenderOptics.Organic) return 0.88;
  if (optics === RenderOptics.Device) return 1.08;
  if (optics === RenderOptics.Radioactive) return 0.92;
  if (optics === RenderOptics.TranslucentRigid) return 0.86;
  return 0.9;
}

/** Ordinary matter only: role accents and luminous/field phases retain ownership. */
export function receivesThermalMaterialStyle(
  phase: RenderPhase,
  material: Material,
  emissive: boolean,
  traits: number,
): boolean {
  return material !== Material.Wall && !emissive && traits === 0
    && (phase === RenderPhase.Solid || phase === RenderPhase.Powder);
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const amount = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return amount * amount * (3 - 2 * amount);
}
