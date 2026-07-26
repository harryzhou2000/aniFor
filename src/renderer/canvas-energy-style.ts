import { RenderProfile } from './render-profile';
import { RenderTrait } from './render-traits';
import { applyCanvasEnergyIdentityStyle } from './canvas-energy-identity-style';

const WARM_ACCENT = [255, 184, 107] as const;
const COOL_ACCENT = [184, 230, 255] as const;
const ENERGY_RADIANCE_KNEE = 176;
const ENERGY_RADIANCE_CEILING = 232;
// Keep the Canvas shoulder in the same byte-space as the normal WebGL
// compositor's `toneMapEnergy`: 0.65 normalized radiance is 0.65 * 255
// source bytes. Unlike a linear cap, this leaves visible headroom in a bright
// dense core rather than collapsing its broad relief into one ceiling value.
const ENERGY_RADIANCE_SHOULDER = 0.65 * 255;
const ENERGY_GLOW_GAIN = 0.08;

/**
 * Allocation-free Canvas counterpart of the WebGL luminous energy core.
 * The semantic particle remains crisp in `core`; `glow` is composited through
 * the existing blurred and crisp lightened passes. A soft radiance knee keeps
 * dense cores colourful instead of clipping them into flat white slabs.
 */
export function shadeCanvasEnergy(
  core: Float32Array,
  glow: Float32Array,
  red: number,
  green: number,
  blue: number,
  _profile: RenderProfile,
  traits: number,
  material: number,
  x: number,
  y: number,
  time: number,
  heat: number,
  velocityX: number,
  velocityY: number,
  emissionAlpha = 0,
  reliefEnabled = true,
  edgeLight = 0,
  identityEnabled = true,
): number {
  const radioactive = (traits & RenderTrait.Radioactive) !== 0;
  const carrier = (traits & RenderTrait.Carrier) !== 0;
  const speed = Math.min(1, (Math.abs(velocityX) + Math.abs(velocityY)) / 128);
  const phase = x * (0.071 + speed * 0.025) + y * (0.043 - velocityX * 0.00012)
    - time * 0.00042 * (1 + speed) + material * 0.137;
  const fraction = phase - Math.floor(phase);
  const wave = 1 - Math.abs(fraction - 0.5) * 4;
  const pulse = 0.5 + wave * 0.5;
  const scintillation = carrier && noise(x, y, material) > 0.84 ? 1 : 0;
  const sparseDetail = carrier
    ? 0.98 + wave * 0.04 + scintillation * 0.16
    : 1.0 + wave * 0.07;
  // Match WebGL's dense-body treatment: the shared emission support proves a
  // cohesive energy chunk, so calm its carrier-scale scintillation toward the
  // already available low-frequency pulse. Sparse energy retains its exact
  // animated detail, while core RGB—not alpha, glow, or semantic support—is
  // the only output affected.
  const cohesiveEnergy = smoothstep(31, 122, emissionAlpha);
  const cohesiveDetail = 1 + wave * 0.022 + (pulse - 0.5) * 0.036;
  const detail = sparseDetail + (cohesiveDetail - sparseDetail) * cohesiveEnergy * 0.72;
  const accent = radioactive ? COOL_ACCENT : WARM_ACCENT;
  const energy = 1.04 + heat * 0.28 + pulse * 0.10;
  const accentMix = 0.08 + heat * 0.06;
  const glowMix = 0.88 + pulse * 0.14;
  // The already-rebuilt emission field proves when many exact energy carriers
  // form one body. Reuse it to reveal a slow, chunk-scale radiance relief while
  // leaving sparse particles, glow, alpha, and semantic support untouched.
  const relief = reliefEnabled
    ? canvasEnergyCoreReliefScale(wave, emissionAlpha, edgeLight)
    : 1;
  core[0] = (red * energy * detail + accent[0] * accentMix) * relief;
  core[1] = (green * energy * detail + accent[1] * accentMix) * relief;
  core[2] = (blue * energy * detail + accent[2] * accentMix) * relief;
  if (identityEnabled) {
    // A dense emission-backed core is one volume: retain its exact sparse
    // identity at the edge while the existing chunk-scale pulse/relief owns
    // its interior. RGB only; semantic coverage and glow are untouched.
    applyCanvasEnergyIdentityStyle(
      core, material, x, y, time, velocityX, velocityY,
      1 + (0.35 - 1) * cohesiveEnergy,
    );
  }
  // Match the normal WebGL order: compose the exact material cue before the
  // bounded shoulder so a bright core preserves its own identity instead of
  // clipping the cue after tone mapping. This remains RGB-only.
  core[0] = canvasToneMapEnergyChannel(core[0]);
  core[1] = canvasToneMapEnergyChannel(core[1]);
  core[2] = canvasToneMapEnergyChannel(core[2]);
  glow[0] = red * glowMix + accent[0] * 0.10;
  glow[1] = green * glowMix + accent[1] * 0.10;
  glow[2] = blue * glowMix + accent[2] * 0.10;
  // The same glow plane is drawn once blurred and once crisp. Scale its local
  // alpha here so those passes remain a sparkle around the separate broad
  // EmissionField aura instead of repainting the semantic core twice.
  return Math.round(
    (154 + pulse * 38 + heat * 38 + Number(carrier) * scintillation * 22) * ENERGY_GLOW_GAIN,
  );
}

/**
 * Hue-preserving dense-energy relief shared conceptually with the WebGL path.
 * It performs no allocation and is bounded to +/-10% before tone mapping.
 */
export function canvasEnergyCoreReliefScale(
  macroWave: number,
  emissionAlpha: number,
  edgeLight = 0,
): number {
  const support = smoothstep(31, 122, emissionAlpha);
  if (support <= 0) return 1;
  const surface = Math.max(-1, Math.min(1, edgeLight / 18)) * 0.035;
  return 1 + Math.max(
    -0.10, Math.min(0.10, (Math.max(-1, Math.min(1, macroWave)) * 0.075 + surface) * support),
  );
}

/** Byte-space equivalent of the normal WebGL Energy radiance shoulder. */
export function canvasToneMapEnergyChannel(value: number): number {
  if (value <= ENERGY_RADIANCE_KNEE) return value;
  const excess = value - ENERGY_RADIANCE_KNEE;
  const mapped = ENERGY_RADIANCE_KNEE
    + (ENERGY_RADIANCE_CEILING - ENERGY_RADIANCE_KNEE) * excess
      / (excess + ENERGY_RADIANCE_SHOULDER);
  return Math.min(
    value,
    mapped,
  );
}

function smoothstep(minimum: number, maximum: number, value: number): number {
  const normalized = Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum)));
  return normalized * normalized * (3 - 2 * normalized);
}

function noise(x: number, y: number, salt: number): number {
  let value = Math.imul(x + salt * 17, 0x9E3779B1) ^ Math.imul(y - salt * 13, 0x85EBCA77);
  value = Math.imul(value ^ (value >>> 15), 0xC2B2AE3D);
  return ((value ^ (value >>> 16)) >>> 0) / 0xFFFFFFFF;
}
