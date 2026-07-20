import { RenderProfile } from './render-profile';
import { isGranularOptics, RenderOptics } from './render-optics';

/** Allocation-free family styling for the Canvas compatibility renderer. */
export function shadeCanvasMaterial(
  output: Float32Array,
  red: number,
  green: number,
  blue: number,
  profile: number,
  optics: number,
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
  const surfaceProfile = solidOpticsProfile(optics, profile);
  if (surfaceProfile === RenderProfile.Granular) {
    // Keep grain-scale albedo legible after supersampled contour coverage is
    // composited, while each rough family retains its own optical character.
    const variation = optics === RenderOptics.CrystallineGranular ? 0.56
      : optics === RenderOptics.SootyGranular ? 0.28
      : optics === RenderOptics.MetallicGranular ? 0.50 : 0.82;
    light += noise * variation;
    if (optics === RenderOptics.CrystallineGranular) {
      tintGreen += Math.max(0, noise) * 0.14;
      tintBlue += Math.max(0, noise) * 0.30 + 1;
    } else if (optics === RenderOptics.SootyGranular) {
      light -= 2.5;
      tintRed += Math.max(0, noise) * 0.04;
    } else if (optics === RenderOptics.MetallicGranular) {
      tintRed += Math.max(0, noise) * 0.24;
      tintBlue += Math.max(0, -noise) * 0.16;
    } else {
      tintRed += Math.max(0, noise) * 0.18;
    }
  } else if (surfaceProfile === RenderProfile.Rigid) {
    light += ((x + Math.floor(y / 3) + material) % 11 < 2 ? 7 : -2);
    tintBlue += 3;
  } else if (surfaceProfile === RenderProfile.Organic) {
    const fibre = (x + (hash(y + material * 17) & 7)) % 13 < 3;
    light += fibre ? 6 : -1;
  } else if (surfaceProfile === RenderProfile.Radioactive) {
    const pulse = hash(index + Math.floor(time / 180) * 97 + material) & 15;
    light += pulse < 3 ? 9 : -1;
  } else if (surfaceProfile === RenderProfile.Device) {
    const trace = (x + material) % 8 === 0 || (y + material * 3) % 8 === 0;
    // Retain a fine circuit lattice after dense-body absorption and 2x
    // supersampled composition. This remains below the broader body relief.
    light += trace ? 10 : -4;
    tintGreen += trace ? 7 : 0;
    tintBlue += trace ? 18 : 2;
  } else if (profile === RenderProfile.Field) {
    const wave = (x + y + Math.floor(time / 110) + material) % 12;
    light += wave < 3 ? 7 : -2;
  }

  // The optics byte refines how a canonical profile catches light. It changes
  // RGB only; alpha and reconstructed silhouettes remain owned by the caller.
  if (optics === RenderOptics.RoughGranular) {
    light += noise * 0.20;
    tintRed += Math.max(0, noise) * 0.10;
  } else if (optics === RenderOptics.CrystallineGranular) {
    const glint = (hash(index + material * 367) & 31) < 3;
    light += glint ? 6 : -0.5;
    tintGreen += glint ? 3 : 0;
    tintBlue += glint ? 7 : 1;
  } else if (optics === RenderOptics.SootyGranular) {
    light -= Math.max(0, noise) * 0.08;
  } else if (optics === RenderOptics.MetallicGranular) {
    const facet = (hash(index + material * 397) & 15) < 3;
    light += facet ? 5 : -1;
    tintRed += facet ? 4 : 0;
    tintBlue += facet ? 2 : 1;
  } else if (optics === RenderOptics.SmoothRigid) {
    const polish = (hash(index + material * 313) & 15) < 2;
    light += polish ? 5 : 0;
    tintBlue += polish ? 3 : 1;
  } else if (optics === RenderOptics.TranslucentRigid) {
    const internalFacet = (hash(index + material * 349) & 15) < 3;
    const reflectionBand = (x * 2 + y + material) % 17 < 3;
    light += internalFacet ? 4 : reflectionBand ? 2 : -1;
    tintGreen += internalFacet ? 3 : 1;
    tintBlue += internalFacet ? 7 : reflectionBand ? 5 : 2;
  } else if (optics === RenderOptics.Organic) {
    const livingFibre = (x + (hash(y + material * 29) & 7)) % 11 < 3;
    tintRed += livingFibre ? 1.5 : 0;
    tintGreen += livingFibre ? 4 : 0.5;
  } else if (optics === RenderOptics.Device) {
    const contact = (x + material * 3) % 16 === 0 || (y + material) % 16 === 0;
    light += contact ? 2 : 0;
    tintGreen += contact ? 2 : 0;
    tintBlue += contact ? 5 : 2;
  } else if (optics === RenderOptics.Radioactive) {
    const scintillation = hash(index + Math.floor(time / 180) * 97 + material * 11) & 15;
    tintGreen += scintillation < 3 ? 5 : 1;
    tintBlue += scintillation < 3 ? 2 : 0;
  }
  output[0] = clamp(red + light + tintRed);
  output[1] = clamp(green + light + tintGreen);
  output[2] = clamp(blue + light + tintBlue);
}

function solidOpticsProfile(optics: number, fallback: number): number {
  if (isGranularOptics(optics)) return RenderProfile.Granular;
  if (optics === RenderOptics.SmoothRigid || optics === RenderOptics.TranslucentRigid) {
    return RenderProfile.Rigid;
  }
  if (optics === RenderOptics.Organic) return RenderProfile.Organic;
  if (optics === RenderOptics.Device) return RenderProfile.Device;
  if (optics === RenderOptics.Radioactive) return RenderProfile.Radioactive;
  return fallback;
}

function hash(value: number): number {
  value = Math.imul(value ^ 0x9e3779b9, 0x85ebca6b);
  value ^= value >>> 13;
  return (Math.imul(value, 0xc2b2ae35) ^ (value >>> 16)) >>> 0;
}

function clamp(value: number): number { return Math.max(0, Math.min(255, value)); }
