import { RenderProfile } from './render-profile';

/** Allocation-free family styling for the Canvas compatibility renderer. */
export function shadeCanvasMaterial(
  output: Float32Array,
  red: number,
  green: number,
  blue: number,
  profile: number,
  material: number,
  x: number,
  y: number,
  index: number,
  time: number,
): void {
  const noise = (hash(index + material * 131) & 31) - 15;
  let light = noise * 0.12;
  let tintRed = 0;
  let tintGreen = 0;
  let tintBlue = 0;
  if (profile === RenderProfile.Granular) {
    light += noise * 0.72;
    tintRed += Math.max(0, noise) * 0.18;
  } else if (profile === RenderProfile.Rigid) {
    light += ((x + Math.floor(y / 3) + material) % 11 < 2 ? 7 : -2);
    tintBlue += 3;
  } else if (profile === RenderProfile.Organic) {
    const fibre = (x + (hash(y + material * 17) & 7)) % 13 < 3;
    light += fibre ? 6 : -1;
    tintGreen += fibre ? 8 : 2;
  } else if (profile === RenderProfile.Radioactive) {
    const pulse = hash(index + Math.floor(time / 180) * 97 + material) & 15;
    light += pulse < 3 ? 9 : -1;
    tintGreen += 5 + Math.max(0, 3 - pulse) * 3;
  } else if (profile === RenderProfile.Device) {
    const trace = (x + material) % 8 === 0 || (y + material * 3) % 8 === 0;
    light += trace ? 5 : -2;
    tintGreen += trace ? 4 : 0;
    tintBlue += trace ? 10 : 2;
  } else if (profile === RenderProfile.Field) {
    const wave = (x + y + Math.floor(time / 110) + material) % 12;
    light += wave < 3 ? 7 : -2;
    tintBlue += wave < 3 ? 11 : 3;
  }
  output[0] = clamp(red + light + tintRed);
  output[1] = clamp(green + light + tintGreen);
  output[2] = clamp(blue + light + tintBlue);
}

function hash(value: number): number {
  value = Math.imul(value ^ 0x9e3779b9, 0x85ebca6b);
  value ^= value >>> 13;
  return (Math.imul(value, 0xc2b2ae35) ^ (value >>> 16)) >>> 0;
}

function clamp(value: number): number { return Math.max(0, Math.min(255, value)); }
