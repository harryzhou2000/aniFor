import { RenderPhase } from './render-profile';

export const CANVAS_EMISSION_VOLUME_RESPONSE_LIMIT = 24;

/**
 * Gives the compact shared emission plane restrained volume without changing
 * its mass/silhouette. Alpha is copied exactly from the authoritative field and
 * unsupported samples stay transparent black. The enabled transform reads only
 * source alpha and writes into caller-owned storage, so it is deterministic for
 * separate or in-place buffers and allocates nothing in the texel loop.
 */
export function shadeCanvasEmissionVolume(
  target: Uint8ClampedArray,
  source: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  enabled: boolean,
): void {
  const byteLength = width * height * 4;
  if (width <= 0 || height <= 0 || source.length !== byteLength || target.length !== byteLength) {
    throw new Error('Canvas emission volume size mismatch');
  }
  if (!enabled) {
    target.set(source);
    return;
  }

  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = (y * width + x) * 4;
    const center = source[offset + 3];
    if (center === 0) {
      target[offset] = 0;
      target[offset + 1] = 0;
      target[offset + 2] = 0;
      target[offset + 3] = 0;
      continue;
    }

    const left = source[(y * width + Math.max(0, x - 1)) * 4 + 3];
    const right = source[(y * width + Math.min(width - 1, x + 1)) * 4 + 3];
    const top = source[(Math.max(0, y - 1) * width + x) * 4 + 3];
    const bottom = source[(Math.min(height - 1, y + 1) * width + x) * 4 + 3];
    const neighbourMean = (left + right + top + bottom) * 0.25;
    const directional = (left - right) * 0.16 + (bottom - top) * 0.22;
    const curvature = (center - neighbourMean) * 0.28;
    const density = center / 255;
    const rawResponse = (directional + curvature) / 255 * (0.42 + density * 0.58);
    const byteResponse = Math.max(
      -CANVAS_EMISSION_VOLUME_RESPONSE_LIMIT,
      Math.min(CANVAS_EMISSION_VOLUME_RESPONSE_LIMIT, rawResponse * 255),
    );
    for (let channel = 0; channel < 3; channel++) {
      const base = source[offset + channel];
      // Scale the response by available channel headroom. This retains the
      // source hue and prevents one saturated channel from flattening the aura.
      const headroom = byteResponse >= 0 ? (255 - base) / 255 : base / 255;
      target[offset + channel] = base + byteResponse * headroom;
    }
    target[offset + 3] = center;
  }
}

/**
 * Local semantic sparkle layered over the broad shared EmissionField aura.
 * Volumes need less local opacity because their atmosphere/liquid plane already
 * supplies continuous coverage; Energy owns a dedicated core path instead.
 */
export function canvasLocalEmissionAlpha(phase: RenderPhase): number {
  if (phase === RenderPhase.Energy) return 0;
  if (phase === RenderPhase.Gas) return 32;
  if (phase === RenderPhase.Liquid) return 96;
  return 176;
}
