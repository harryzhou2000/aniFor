/**
 * Independent PHOT render projection. TPT stores photons outside pmap, so this
 * state must never be placed in the matter-owner presentation plane.
 */
export const PHOTON_STATE_PRESENT = 0x8000;
const PHOTON_CHANNEL_MASK = 0x0f;
const PHOTON_CHANNEL_MAX = 12;
const PHOTON_CHANNEL_SCALE = 16;

/** Packs the three display-relevant twelve-bit wavelength-band populations. */
export function encodePhotonSpectrumState(red: number, green: number, blue: number): number {
  return PHOTON_STATE_PRESENT
    | clampPhotonChannel(red)
    | (clampPhotonChannel(green) << 4)
    | (clampPhotonChannel(blue) << 8);
}

export function photonStateIsPresent(state: number): boolean {
  return (state & PHOTON_STATE_PRESENT) !== 0;
}

/** Matches TPT's count-to-colour contribution: each active wavelength bit adds 16. */
export function photonSpectrumChannelByte(state: number, shift: 0 | 4 | 8): number {
  return ((state >>> shift) & PHOTON_CHANNEL_MASK) * PHOTON_CHANNEL_SCALE;
}

/** A scene-wide active check keeps the WebGL sampler dormant on ordinary scenes. */
export function photonStateIsActive(states: Uint16Array | undefined): boolean {
  if (!states) return false;
  for (let index = 0; index < states.length; index++) {
    if (photonStateIsPresent(states[index])) return true;
  }
  return false;
}

/** RGB-only overlay shared conceptually with the late WebGL photon composite. */
export function applyCanvasPhotonSpectrumStyle(
  color: Float32Array,
  state: number,
): void {
  if (!photonStateIsPresent(state)) return;
  const red = photonSpectrumChannelByte(state, 0);
  const green = photonSpectrumChannelByte(state, 4);
  const blue = photonSpectrumChannelByte(state, 8);
  const peak = Math.max(red, green, blue);
  // A PHOT core stays translucent in its colour contribution but never changes
  // the semantic material/wall alpha beneath it. The range mirrors the shader.
  const amount = 0.44 + Math.min(0.18, peak / 255 * 0.24);
  color[0] = color[0] * (1 - amount) + red * amount;
  color[1] = color[1] * (1 - amount) + green * amount;
  color[2] = color[2] * (1 - amount) + blue * amount;
}

function clampPhotonChannel(value: number): number {
  return Math.max(0, Math.min(PHOTON_CHANNEL_MAX, Math.round(value)));
}
