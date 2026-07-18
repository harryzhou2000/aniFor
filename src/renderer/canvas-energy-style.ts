import { RenderProfile } from './render-profile';
import { RenderTrait } from './render-traits';

const WARM_ACCENT = [255, 184, 107] as const;
const COOL_ACCENT = [184, 230, 255] as const;

/**
 * Allocation-free Canvas counterpart of the WebGL luminous energy core.
 * The semantic particle remains crisp in `core`; `glow` is composited through
 * the existing blurred/lightened energy plane.
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
  core[0] = red * energy * detail + accent[0] * accentMix;
  core[1] = green * energy * detail + accent[1] * accentMix;
  core[2] = blue * energy * detail + accent[2] * accentMix;
  glow[0] = red * glowMix + accent[0] * 0.10;
  glow[1] = green * glowMix + accent[1] * 0.10;
  glow[2] = blue * glowMix + accent[2] * 0.10;
  return Math.round(154 + pulse * 38 + heat * 38 + Number(carrier) * scintillation * 22);
}

function noise(x: number, y: number, salt: number): number {
  let value = Math.imul(x + salt * 17, 0x9E3779B1) ^ Math.imul(y - salt * 13, 0x85EBCA77);
  value = Math.imul(value ^ (value >>> 15), 0xC2B2AE3D);
  return ((value ^ (value >>> 16)) >>> 0) / 0xFFFFFFFF;
}
