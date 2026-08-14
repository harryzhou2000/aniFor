/**
 * Small deterministic tile for the normal-detail material-volume sampler.
 *
 * Each colour lane is evaluated on a 64-cell torus, so a repeat + linear
 * sampler crosses every edge without introducing a new feature.  It is raw
 * RGBA8 data rather than an ImageData or canvas object to keep ownership and
 * upload policy with the caller.
 */
export const VOLUME_NOISE_TEXTURE_SIZE = 64;
export const VOLUME_NOISE_TEXTURE_CHANNELS = 4;

export interface VolumeNoiseTextureAsset {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

function hashLattice(x: number, y: number, seed: number): number {
  let value = Math.imul(x + seed * 1013, 0x9E3779B1)
    ^ Math.imul(y - seed * 1619, 0x85EBCA77);
  value = Math.imul(value ^ (value >>> 15), 0xC2B2AE3D);
  return ((value ^ (value >>> 16)) >>> 0) / 0xFFFFFFFF;
}

function fade(value: number): number {
  return value * value * value * (value * (value * 6 - 15) + 10);
}

function mix(left: number, right: number, amount: number): number {
  return left + (right - left) * amount;
}

function periodicValueNoise(x: number, y: number, cells: number, seed: number): number {
  const latticeX = (x + 0.5) * cells / VOLUME_NOISE_TEXTURE_SIZE;
  const latticeY = (y + 0.5) * cells / VOLUME_NOISE_TEXTURE_SIZE;
  const x0 = Math.floor(latticeX);
  const y0 = Math.floor(latticeY);
  const x1 = (x0 + 1) % cells;
  const y1 = (y0 + 1) % cells;
  const wrappedX0 = x0 % cells;
  const wrappedY0 = y0 % cells;
  const blendX = fade(latticeX - x0);
  const blendY = fade(latticeY - y0);
  const top = mix(
    hashLattice(wrappedX0, wrappedY0, seed),
    hashLattice(x1, wrappedY0, seed),
    blendX,
  );
  const bottom = mix(
    hashLattice(wrappedX0, y1, seed),
    hashLattice(x1, y1, seed),
    blendX,
  );
  return mix(top, bottom, blendY);
}

/**
 * Seamless value-noise octaves, authored once on the CPU instead of evaluated
 * for every supersampled fragment. Each channel has a different lobe scale and
 * seed so one filtered fetch can provide macro, meso, and secondary detail.
 */
function periodicLane(
  x: number,
  y: number,
  seed: number,
  cells: readonly [number, number, number],
): number {
  const value = periodicValueNoise(x, y, cells[0], seed) * 0.58
    + periodicValueNoise(x, y, cells[1], seed + 17) * 0.29
    + periodicValueNoise(x, y, cells[2], seed + 41) * 0.13;
  return 0.5 + (value - 0.5) * 1.12;
}

function byte(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 255);
}

function createVolumeNoiseTextureData(): Uint8Array {
  const data = new Uint8Array(VOLUME_NOISE_TEXTURE_SIZE * VOLUME_NOISE_TEXTURE_SIZE * VOLUME_NOISE_TEXTURE_CHANNELS);
  for (let y = 0; y < VOLUME_NOISE_TEXTURE_SIZE; y++) {
    for (let x = 0; x < VOLUME_NOISE_TEXTURE_SIZE; x++) {
      const offset = (y * VOLUME_NOISE_TEXTURE_SIZE + x) * VOLUME_NOISE_TEXTURE_CHANNELS;
      data[offset] = byte(periodicLane(x, y, 11, [3, 6, 12]));
      data[offset + 1] = byte(periodicLane(x, y, 29, [5, 10, 20]));
      data[offset + 2] = byte(periodicLane(x, y, 47, [4, 8, 16]));
      data[offset + 3] = 255;
    }
  }
  return data;
}

/**
 * Raw RGBA8 source for a caller-owned linear-filtered repeat texture upload.
 * R and G are intentionally distinct smooth low-frequency volume coordinates;
 * B is a third independent coordinate and A is permanently opaque.
 */
export const VOLUME_NOISE_TEXTURE: VolumeNoiseTextureAsset = Object.freeze({
  width: VOLUME_NOISE_TEXTURE_SIZE,
  height: VOLUME_NOISE_TEXTURE_SIZE,
  data: createVolumeNoiseTextureData(),
});
