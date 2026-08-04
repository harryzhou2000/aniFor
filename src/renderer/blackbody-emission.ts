const MINIMUM_BLACKBODY_KELVIN = 1000;
const MAXIMUM_BLACKBODY_KELVIN = 6500;

/** Converts the renderer's quantized temperature byte back to approximate K. */
export function semanticTemperatureKelvin(temperatureByte: number): number {
  return clamp(temperatureByte, 0, 255) * 25.6;
}

/**
 * Tanner-Helland-style blackbody approximation in normalized display coordinates.
 * The output buffer makes the helper allocation-free in Canvas and field tests.
 */
export function blackbodyRgb(
  output: Float32Array,
  temperatureByte: number,
): Float32Array {
  const kelvin = clamp(
    semanticTemperatureKelvin(temperatureByte),
    MINIMUM_BLACKBODY_KELVIN,
    MAXIMUM_BLACKBODY_KELVIN,
  );
  const temperature = kelvin / 100;
  const red = temperature <= 66
    ? 255
    : 329.698727446 * Math.pow(temperature - 60, -0.1332047592);
  const green = temperature <= 66
    ? 99.4708025861 * Math.log(temperature) - 161.1195681661
    : 288.1221695283 * Math.pow(temperature - 60, -0.0755148492);
  const blue = temperature >= 66
    ? 255
    : temperature <= 19
      ? 0
      : 138.5177312231 * Math.log(temperature - 10) - 305.0447927307;
  output[0] = clamp(red, 0, 255) / 255;
  output[1] = clamp(green, 0, 255) / 255;
  output[2] = clamp(blue, 0, 255) / 255;
  return output;
}

/** HDR intensity begins around visible incandescence and grows smoothly. */
export function blackbodyRadiance(temperatureByte: number): number {
  const onset = smoothstep(28, 52, temperatureByte);
  const whiteHot = smoothstep(52, 255, temperatureByte);
  return onset * (0.35 + whiteHot * 2.4);
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const amount = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return amount * amount * (3 - 2 * amount);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
