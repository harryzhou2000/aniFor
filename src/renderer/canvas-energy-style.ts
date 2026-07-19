import { RenderProfile } from './render-profile';
import { RenderTrait } from './render-traits';

const WARM_ACCENT = [255, 184, 107] as const;
const COOL_ACCENT = [184, 230, 255] as const;
const ENERGY_RADIANCE_KNEE = 176;
const ENERGY_RADIANCE_CEILING = 232;
const ENERGY_RADIANCE_SLOPE = 0.30;
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
  const detail = carrier
    ? 0.98 + wave * 0.04 + scintillation * 0.16
    : 1.0 + wave * 0.07;
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
  core[0] = toneMapEnergyChannel((red * energy * detail + accent[0] * accentMix) * relief);
  core[1] = toneMapEnergyChannel((green * energy * detail + accent[1] * accentMix) * relief);
  core[2] = toneMapEnergyChannel((blue * energy * detail + accent[2] * accentMix) * relief);
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

function toneMapEnergyChannel(value: number): number {
  if (value <= ENERGY_RADIANCE_KNEE) return value;
  return Math.min(
    ENERGY_RADIANCE_CEILING,
    ENERGY_RADIANCE_KNEE + (value - ENERGY_RADIANCE_KNEE) * ENERGY_RADIANCE_SLOPE,
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
