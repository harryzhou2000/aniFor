import { Material } from '../shared/materials';

/** Stable native sensor byte range. */
export const CANVAS_SENSOR_FIRST_MATERIAL = Material.DTEC;
export const CANVAS_SENSOR_LAST_MATERIAL = Material.VSNS;

/** One repeated instrument face occupies 24×24 world cells. */
export const CANVAS_SENSOR_BEZEL_SIZE = 24;

/** Returns whether the material is one of TPT's seven native sensors. */
export function isCanvasSensorMaterial(material: number): boolean {
  return material >= CANVAS_SENSOR_FIRST_MATERIAL
    && material <= CANVAS_SENSOR_LAST_MATERIAL;
}

/**
 * Applies a deterministic, allocation-free instrument morphology to RGB.
 *
 * Every connected sensor sheet gets a stable 24-cell bezel and a semantic
 * glyph. The caller retains ownership of alpha, topology, material identity,
 * body lighting, and simulation state; entries beyond RGB are never touched.
 */
export function applyCanvasSensorMorphology(
  output: Float32Array,
  material: number,
  x: number,
  y: number,
): void {
  if (!isCanvasSensorMaterial(material)) return;

  const localX = positiveModulo(x, CANVAS_SENSOR_BEZEL_SIZE);
  const localY = positiveModulo(y, CANVAS_SENSOR_BEZEL_SIZE);
  let red = 0;
  let green = 0;
  let blue = 0;

  // Two-tone recessed bezel. Its asymmetry supplies a fixed upper-left light
  // direction and makes adjacent 24-cell faces legible without changing their
  // silhouette or requiring neighbourhood samples.
  if (localX === 0 || localY === 0) {
    red += 4;
    green += 4;
    blue += 5;
  } else if (localX === 23 || localY === 23) {
    red -= 5;
    green -= 5;
    blue -= 6;
  } else if (localX === 2 || localY === 2) {
    red += 2;
    green += 2;
    blue += 3;
  } else if (localX === 21 || localY === 21) {
    red -= 3;
    green -= 3;
    blue -= 4;
  }

  // Four restrained screw heads keep large sheets from reading as a flat
  // colour slab. Their coordinates are part of the same fixed face, not noise.
  const screw = (localX === 4 || localX === 19) && (localY === 4 || localY === 19);
  if (screw) {
    red -= 4;
    green -= 4;
    blue -= 3;
  }

  let glyph = false;
  let glyphCore = false;
  const dx = localX - 12;
  const dy = localY - 12;

  if (material === Material.DTEC) {
    // Detector: crosshair with an open centre target.
    glyph = (localX === 12 && localY >= 6 && localY <= 18)
      || (localY === 12 && localX >= 6 && localX <= 18);
    glyphCore = dx * dx + dy * dy >= 7 && dx * dx + dy * dy <= 13;
  } else if (material === Material.INVIS) {
    // Invisible/pressure gate: iris, including its dark pupil.
    const radiusSquared = dx * dx + dy * dy;
    glyph = radiusSquared >= 29 && radiusSquared <= 49;
    glyphCore = radiusSquared <= 5;
  } else if (material === Material.LDTC) {
    // Linear detector: diagonal scanning beam and terminal returns.
    glyph = localX >= 5 && localX <= 18 && Math.abs(localX + localY - 23) <= 1;
    glyphCore = (localX === 5 && localY >= 16 && localY <= 19)
      || (localX === 18 && localY >= 4 && localY <= 7);
  } else if (material === Material.LSNS) {
    // Life sensor: a stepped, pulse-like waveform.
    const waveY = localX < 8 ? 14 : localX < 11 ? 10 : localX < 14 ? 7
      : localX < 17 ? 15 : 12;
    glyph = localX >= 5 && localX <= 19
      && (localY === waveY
        || (localX === 8 || localX === 11 || localX === 14 || localX === 17)
          && localY >= Math.min(waveY, 12) && localY <= Math.max(waveY, 15));
    glyphCore = (localX === 11 || localX === 12 || localX === 13) && localY === 7;
  } else if (material === Material.PSNS) {
    // Pressure sensor: two concentric pressure rings.
    const radiusSquared = dx * dx + dy * dy;
    glyph = (radiusSquared >= 13 && radiusSquared <= 21)
      || (radiusSquared >= 48 && radiusSquared <= 64);
    glyphCore = radiusSquared <= 2;
  } else if (material === Material.TSNS) {
    // Temperature sensor: narrow stem over a rounded reservoir.
    const bulbX = localX - 12;
    const bulbY = localY - 17;
    glyph = (localX >= 11 && localX <= 13 && localY >= 5 && localY <= 16)
      || bulbX * bulbX + bulbY * bulbY <= 13;
    glyphCore = localX === 12 && localY >= 7 && localY <= 18;
  } else {
    // Velocity sensor: right-facing vector arrow.
    glyph = localY === 12 && localX >= 5 && localX <= 19;
    glyphCore = localX >= 14 && localX <= 19
      && Math.abs(localY - 12) === 19 - localX;
  }

  const glyphGain = glyph ? 1 : 0;
  const coreGain = glyphCore ? 1 : 0;
  if (glyphGain !== 0 || coreGain !== 0) {
    if (material === Material.DTEC) {
      red -= glyphGain * 3;
      green += glyphGain * 7 + coreGain * 10;
      blue += glyphGain * 8 + coreGain * 11;
    } else if (material === Material.INVIS) {
      red += glyphGain * 6 + coreGain * 9;
      green -= glyphGain * 3;
      blue += glyphGain * 8 + coreGain * 11;
    } else if (material === Material.LDTC) {
      red -= glyphGain * 4;
      green += glyphGain * 8 + coreGain * 11;
      blue += glyphGain * 3 + coreGain * 6;
    } else if (material === Material.LSNS) {
      red += glyphGain * 8 + coreGain * 11;
      green += glyphGain * 5 + coreGain * 8;
      blue -= glyphGain * 4;
    } else if (material === Material.PSNS) {
      red -= glyphGain * 3;
      green += glyphGain * 4 + coreGain * 7;
      blue += glyphGain * 9 + coreGain * 12;
    } else if (material === Material.TSNS) {
      red += glyphGain * 9 + coreGain * 12;
      green -= glyphGain * 4;
      blue += glyphGain * 2 + coreGain * 5;
    } else {
      red += glyphGain + coreGain * 4;
      green += glyphGain * 9 + coreGain * 12;
      blue += glyphGain * 6 + coreGain * 9;
    }
  }

  output[0] = clampByte(output[0] + clamp(red, -14, 14));
  output[1] = clampByte(output[1] + clamp(green, -14, 14));
  output[2] = clampByte(output[2] + clamp(blue, -14, 14));

}

function positiveModulo(value: number, divisor: number): number {
  const remainder = value % divisor;
  return remainder < 0 ? remainder + divisor : remainder;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return value < minimum ? minimum : value > maximum ? maximum : value;
}

function clampByte(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}
