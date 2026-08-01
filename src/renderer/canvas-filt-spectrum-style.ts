import { Material } from '../shared/materials';
import { FILT_PRESENTATION_STATE } from '../simulation/types';

/**
 * Decodes the compact native FILT wavelength projection.  The semantic owner
 * and owner bit are both required: this shared presentation plane also carries
 * state for unrelated materials.
 */
export function canvasFiltSpectrumState(material: number, state: number): FiltSpectrumState | undefined {
  if (material !== Material.FILT || (state & FILT_PRESENTATION_STATE.presentMask) === 0) return undefined;
  return {
    red: (state & FILT_PRESENTATION_STATE.redMask) >>> FILT_PRESENTATION_STATE.redShift,
    green: (state & FILT_PRESENTATION_STATE.greenMask) >>> FILT_PRESENTATION_STATE.greenShift,
    blue: (state & FILT_PRESENTATION_STATE.blueMask) >>> FILT_PRESENTATION_STATE.blueShift,
    life: (state & FILT_PRESENTATION_STATE.lifeMask) >>> FILT_PRESENTATION_STATE.lifeShift,
  };
}

/**
 * Reconstructs FILT's native wavelength colour after common rigid-body
 * lighting.  Empty counts are the exact native `ctype == 0` sentinel and use
 * its temperature-generated five-bit spectrum.  The visual keeps semantic
 * alpha authoritative; native life is represented only as bounded RGB reveal.
 */
export function applyCanvasFiltSpectrumStyle(
  output: Float32Array,
  material: number,
  state: number,
  temperatureDecikelvin: number | undefined,
): void {
  const spectrum = canvasFiltSpectrumState(material, state);
  if (!spectrum) return;
  let { red, green, blue } = spectrum;
  if (red + green + blue === 0) {
    const band = Math.max(0, Math.min(25, Math.trunc((((temperatureDecikelvin ?? 2730) / 10) - 273) * 0.025)));
    ({ red, green, blue } = filtCountsForFiveBitBand(band));
  }
  const scale = 624 / (red + green + blue + 1);
  const reveal = 0.50 + Math.min(FILT_PRESENTATION_STATE.lifeMaximum, spectrum.life) * 0.11;
  output[0] = clampByte(output[0] + (red * scale - output[0]) * reveal);
  output[1] = clampByte(output[1] + (green * scale - output[1]) * reveal);
  output[2] = clampByte(output[2] + (blue * scale - output[2]) * reveal);
}

export interface FiltSpectrumState {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly life: number;
}

/** Counts the exact 0x1f << native temperature-bin wavelength mask. */
function filtCountsForFiveBitBand(band: number): Pick<FiltSpectrumState, 'red' | 'green' | 'blue'> {
  let red = 0;
  let green = 0;
  let blue = 0;
  for (let bit = band; bit < band + 5; bit++) {
    if (bit >= 18 && bit < 30) red++;
    if (bit >= 9 && bit < 21) green++;
    if (bit >= 0 && bit < 12) blue++;
  }
  return { red, green, blue };
}

function clampByte(value: number): number { return Math.max(0, Math.min(255, value)); }
