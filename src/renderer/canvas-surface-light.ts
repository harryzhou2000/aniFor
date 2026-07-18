import { surfaceLightGain, type RenderProfile } from './render-profile';

/**
 * Applies the shared low-resolution emission field to an exposed Canvas matter
 * contour. RGB uses a screen blend so coloured light reveals the existing
 * material texture without whitening it; alpha and the semantic silhouette are
 * left byte-for-byte untouched.
 */
export function lightCanvasSurface(
  target: Uint8ClampedArray,
  offset: number,
  emission: Uint8Array,
  emissionWidth: number,
  emissionHeight: number,
  worldWidth: number,
  worldHeight: number,
  x: number,
  y: number,
  profile: RenderProfile,
  exposure: number,
): void {
  if (exposure <= 0 || target[offset + 3] === 0) return;
  if (emissionWidth <= 0 || emissionHeight <= 0
    || emission.length !== emissionWidth * emissionHeight * 4 || worldWidth <= 0 || worldHeight <= 0) {
    throw new Error('Canvas surface light field size mismatch');
  }
  const fieldX = Math.max(0, Math.min(emissionWidth - 1, (x + 0.5) * emissionWidth / worldWidth - 0.5));
  const fieldY = Math.max(0, Math.min(emissionHeight - 1, (y + 0.5) * emissionHeight / worldHeight - 0.5));
  const x0 = Math.floor(fieldX);
  const y0 = Math.floor(fieldY);
  const x1 = Math.min(emissionWidth - 1, x0 + 1);
  const y1 = Math.min(emissionHeight - 1, y0 + 1);
  const mixX = fieldX - x0;
  const mixY = fieldY - y0;
  const topLeft = (y0 * emissionWidth + x0) * 4;
  const topRight = (y0 * emissionWidth + x1) * 4;
  const bottomLeft = (y1 * emissionWidth + x0) * 4;
  const bottomRight = (y1 * emissionWidth + x1) * 4;
  const alpha = bilinear(emission, topLeft + 3, topRight + 3, bottomLeft + 3, bottomRight + 3, mixX, mixY) / 255;
  if (alpha <= 1 / 255) return;

  const response = alpha * surfaceLightGain(profile) * Math.max(0, Math.min(1, exposure));
  for (let channel = 0; channel < 3; channel++) {
    const light = bilinear(
      emission, topLeft + channel, topRight + channel, bottomLeft + channel, bottomRight + channel, mixX, mixY,
    ) / 255;
    const base = target[offset + channel];
    target[offset + channel] = base + (255 - base) * light * response;
  }
}

function bilinear(
  bytes: Uint8Array,
  topLeft: number,
  topRight: number,
  bottomLeft: number,
  bottomRight: number,
  mixX: number,
  mixY: number,
): number {
  const top = bytes[topLeft] + (bytes[topRight] - bytes[topLeft]) * mixX;
  const bottom = bytes[bottomLeft] + (bytes[bottomRight] - bytes[bottomLeft]) * mixX;
  return top + (bottom - top) * mixY;
}
