import { RenderOptics } from './render-optics';

/**
 * Apply the shared optical class to a semantic Canvas volume sample. The caller
 * owns alpha/silhouette; this helper writes RGB only and allocates nothing.
 */
export function shadeCanvasOpticalVolume(
  output: Float32Array,
  red: number,
  green: number,
  blue: number,
  optics: RenderOptics,
  phase: 'gas' | 'liquid',
  density: number,
  sheen: number,
): void {
  let absorption = 3.2;
  let scatter = 1;
  let redLift = 0;
  let greenLift = 0;
  let blueLift = 0;

  if (phase === 'gas') {
    if (optics === RenderOptics.SootyGas) {
      absorption = 5.2;
      scatter = 0.65;
    } else if (optics === RenderOptics.CleanGas) {
      absorption = 1.7;
      scatter = 1.28;
      blueLift = 2;
    }
  } else if (optics === RenderOptics.Aqueous) {
    absorption = 2.1;
    scatter = 1.35;
    greenLift = 2;
    blueLift = 5;
  } else if (optics === RenderOptics.Oily) {
    absorption = 4.6;
    scatter = 1.58;
    redLift = 4;
    greenLift = 1;
  } else if (optics === RenderOptics.Corrosive) {
    absorption = 3;
    scatter = 1.42;
    greenLift = 5;
    blueLift = 3;
  } else if (optics === RenderOptics.Molten) {
    absorption = 4.9;
    scatter = 0.62;
    redLift = 9;
    greenLift = 3;
  } else if (optics === RenderOptics.CryogenicLiquid) {
    absorption = 1.6;
    scatter = 1.65;
    greenLift = 3;
    blueLift = 7;
  } else if (optics === RenderOptics.MetallicLiquid) {
    absorption = 3.8;
    scatter = 1.82;
    redLift = 3;
    greenLift = 3;
    blueLift = 3;
  } else if (optics === RenderOptics.ViscousLiquid) {
    absorption = 4.2;
    scatter = 1.25;
    greenLift = 1;
    blueLift = 3;
  }

  const depth = density * absorption;
  const light = sheen * scatter;
  output[0] = red - depth + light + redLift;
  output[1] = green - depth + light + greenLift;
  output[2] = blue - depth + light + blueLift;
}
