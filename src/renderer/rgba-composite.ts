function byte(value: number): number { return Math.max(0, Math.min(255, value)); }

/** Composites a straight-alpha source colour over one RGBA pixel in place. */
export function compositePixel(
  target: Uint8ClampedArray,
  offset: number,
  red: number,
  green: number,
  blue: number,
  alpha: number,
): void {
  const sourceAlpha = byte(alpha) / 255;
  const destinationAlpha = target[offset + 3] / 255;
  const outputAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);
  if (outputAlpha <= 0) {
    target.fill(0, offset, offset + 4);
    return;
  }
  const destinationWeight = destinationAlpha * (1 - sourceAlpha);
  target[offset] = (byte(red) * sourceAlpha + target[offset] * destinationWeight) / outputAlpha;
  target[offset + 1] = (byte(green) * sourceAlpha + target[offset + 1] * destinationWeight) / outputAlpha;
  target[offset + 2] = (byte(blue) * sourceAlpha + target[offset + 2] * destinationWeight) / outputAlpha;
  target[offset + 3] = outputAlpha * 255;
}
