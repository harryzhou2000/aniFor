/**
 * Adds bounded upper-left relief and density depth to the shared gas volume.
 * Alpha is copied exactly, so this presentation pass cannot widen or blur gas.
 */
export interface CanvasAtmosphereLightField {
  readonly bytes: Uint8Array;
  readonly width: number;
  readonly height: number;
}

export function shadeCanvasAtmosphere(
  target: Uint8ClampedArray,
  source: Uint8Array,
  width: number,
  height: number,
  light?: CanvasAtmosphereLightField,
): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error('Invalid atmosphere dimensions');
  }
  const length = width * height * 4;
  if (source.length !== length || target.length !== length) throw new Error('Atmosphere buffer size mismatch');
  if (light && (!Number.isInteger(light.width) || !Number.isInteger(light.height)
    || light.width <= 0 || light.height <= 0
    || light.bytes.length !== light.width * light.height * 4)) {
    throw new Error('Invalid atmosphere light field');
  }

  for (let y = 0; y < height; y++) {
    const topY = Math.max(0, y - 1);
    const bottomY = Math.min(height - 1, y + 1);
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const alpha = source[offset + 3];
      if (alpha === 0) {
        target[offset] = 0;
        target[offset + 1] = 0;
        target[offset + 2] = 0;
        target[offset + 3] = 0;
        continue;
      }

      const leftX = Math.max(0, x - 1);
      const rightX = Math.min(width - 1, x + 1);
      const left = source[(y * width + leftX) * 4 + 3] / 255;
      const right = source[(y * width + rightX) * 4 + 3] / 255;
      const top = source[(topY * width + x) * 4 + 3] / 255;
      const bottom = source[(bottomY * width + x) * 4 + 3] / 255;
      const density = alpha / 255;
      const upperLeftRelief = ((right - left) + (bottom - top)) * 0.5;
      const neighbourMean = (left + right + top + bottom) * 0.25;
      // Signed local curvature separates rounded density crowns from concave
      // overlap pockets using samples that the gradient already needs. A crown
      // catches restrained broad light while a pocket self-shadows, making the
      // reconstructed field read as joined billows rather than a flat wash.
      const curvature = density - neighbourMean;
      const curvatureLight = curvature >= 0 ? curvature * 0.28 : curvature * 0.18;
      // Optical depth darkens dense gas while the gradient retains a restrained
      // upper-left silver lining. Alpha remains the authoritative field support.
      const shade = clamp(
        1.10 - density * 0.34 + upperLeftRelief * 0.68 + curvatureLight,
        0.64, 1.18,
      );

      let red = source[offset] * shade;
      let green = source[offset + 1] * shade;
      let blue = source[offset + 2] * shade;
      if (light) {
        const lightX = Math.min(light.width - 1, Math.floor((x + 0.5) / width * light.width));
        const lightY = Math.min(light.height - 1, Math.floor((y + 0.5) / height * light.height));
        const lightLeftX = Math.max(0, lightX - 1);
        const lightRightX = Math.min(light.width - 1, lightX + 1);
        const lightTopY = Math.max(0, lightY - 1);
        const lightBottomY = Math.min(light.height - 1, lightY + 1);
        let lightOffset = (lightY * light.width + lightX) * 4;
        let lightDensity = light.bytes[lightOffset + 3] / 255;
        const lightLeftOffset = (lightY * light.width + lightLeftX) * 4;
        const lightRightOffset = (lightY * light.width + lightRightX) * 4;
        const lightTopOffset = (lightTopY * light.width + lightX) * 4;
        const lightBottomOffset = (lightBottomY * light.width + lightX) * 4;
        const lightLeft = light.bytes[lightLeftOffset + 3] / 255;
        const lightRight = light.bytes[lightRightOffset + 3] / 255;
        const lightTop = light.bytes[lightTopOffset + 3] / 255;
        const lightBottom = light.bytes[lightBottomOffset + 3] / 255;
        const normalX = left - right;
        const normalY = top - bottom;
        const lightSlopeX = lightRight - lightLeft;
        const lightSlopeY = lightBottom - lightTop;
        const normalLength = Math.hypot(normalX, normalY);
        const lightSlopeLength = Math.hypot(lightSlopeX, lightSlopeY);
        const incidence = normalLength > 1e-6 && lightSlopeLength > 1e-6
          ? Math.max(0, (normalX * lightSlopeX + normalY * lightSlopeY)
            / (normalLength * lightSlopeLength))
          : 0;
        if (normalLength > 1e-6) {
          const outwardOffset = Math.abs(normalX) >= Math.abs(normalY)
            ? (normalX < 0 ? lightLeftOffset : lightRightOffset)
            : (normalY < 0 ? lightTopOffset : lightBottomOffset);
          const outwardDensity = light.bytes[outwardOffset + 3] / 255;
          if (outwardDensity > lightDensity) {
            lightOffset = outwardOffset;
            lightDensity = outwardDensity * 0.86;
          }
        }
        if (lightDensity > 0) {
          const lightReach = smoothstep(0.01, 0.55, lightDensity);
          const rim = 1 - smoothstep(0.18, 0.74, density);
          const scatter = lightReach * (0.025 + incidence * 0.24 + rim * 0.035)
            * (1 - density * 0.48) * 2.2;
          red += light.bytes[lightOffset] * scatter;
          green += light.bytes[lightOffset + 1] * scatter;
          blue += light.bytes[lightOffset + 2] * scatter;
        }
      }

      target[offset] = Math.round(clamp(red, 0, 255));
      target[offset + 1] = Math.round(clamp(green, 0, 255));
      target[offset + 2] = Math.round(clamp(blue, 0, 255));
      target[offset + 3] = alpha;
    }
  }
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const progress = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return progress * progress * (3 - 2 * progress);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
