import { Material } from '../shared/materials';

const MAX_CHANNEL_DELTA = 14;

/** Stable exact-material ABI for the native energy-core tranche. */
export const ENERGY_IDENTITY_STYLE_BY_MATERIAL = new Uint8Array(256);
ENERGY_IDENTITY_STYLE_BY_MATERIAL[Material.Fire] = 1;
ENERGY_IDENTITY_STYLE_BY_MATERIAL[Material.Plasma] = 2;
ENERGY_IDENTITY_STYLE_BY_MATERIAL[Material.ELEC] = 3;
ENERGY_IDENTITY_STYLE_BY_MATERIAL[Material.GRVT] = 4;
ENERGY_IDENTITY_STYLE_BY_MATERIAL[Material.NEUT] = 5;
ENERGY_IDENTITY_STYLE_BY_MATERIAL[Material.PHOT] = 6;
ENERGY_IDENTITY_STYLE_BY_MATERIAL[Material.PROT] = 7;
ENERGY_IDENTITY_STYLE_BY_MATERIAL[Material.BRAY] = 8;
ENERGY_IDENTITY_STYLE_BY_MATERIAL[Material.EMBR] = 9;

/** Decodes an exact native/render-projection material into its authored style. */
export function canvasEnergyIdentityStyle(material: number): number {
  return material >= 0 && material < ENERGY_IDENTITY_STYLE_BY_MATERIAL.length
    ? ENERGY_IDENTITY_STYLE_BY_MATERIAL[material] : 0;
}

/**
 * Adds an exact, RGB-only physical motif to an already shaded energy core.
 *
 * The motifs deliberately use integer fields instead of cell-random noise:
 * flame tongues, plasma cells, electrical branches, gravity lenses, neutral
 * tracks, photon bands, proton beads, ray rails, and detached embers. Work is
 * constant per supported semantic particle and independent of render scale.
 */
export function applyCanvasEnergyIdentityStyle(
  rgb: Float32Array,
  material: number,
  x: number,
  y: number,
  time: number,
  velocityX = 0,
  velocityY = 0,
  gain = 1,
): void {
  const style = canvasEnergyIdentityStyle(material);
  if (style === 0) return;
  const boundedGain = Math.max(0, Math.min(1, gain));
  if (boundedGain === 0) return;

  const frame = time / 120 | 0;
  const driftX = Math.sign(velocityX);
  const driftY = Math.sign(velocityY);
  let red = 0;
  let green = 0;
  let blue = 0;

  if (style === 1) {
    // FIRE: broad rising tongues, warm crests and darker pockets.
    const tongue = (x * 3 + y + frame + driftX) & 15;
    const crest = (y - frame + driftY) & 7;
    red = tongue < 5 ? 9 : -2;
    green = tongue < 5 ? 5 + Number(crest < 2) * 3 : -2;
    blue = tongue < 5 ? -4 : 1;
  } else if (style === 2) {
    // PLSM: hot cellular membranes enclosing violet-blue wells.
    const localX = (x + frame + driftX) & 7;
    const localY = (y - frame + driftY) & 7;
    const membrane = Math.abs(localX - 4) + Math.abs(localY - 4);
    red = membrane >= 4 && membrane <= 6 ? 8 : -2;
    green = membrane >= 4 && membrane <= 6 ? 3 : 0;
    blue = membrane <= 2 ? 8 : 2;
  } else if (style === 3) {
    // ELEC: branching conductive forks with travelling bright junctions.
    const branch = (x * 3 + y * 5 + frame * 2) & 15;
    const node = (x + y + frame) & 7;
    red = branch <= 2 ? 8 : -2;
    green = branch <= 2 ? 11 : 1;
    blue = branch <= 2 ? 13 : 4 + Number(node === 0) * 5;
  } else if (style === 4) {
    // GRVT: repeated lens rings whose polarity slowly turns inward.
    const localX = (x & 15) - 8;
    const localY = (y & 15) - 8;
    const ring = (localX * localX + localY * localY + frame) & 31;
    const rim = ring >= 10 && ring <= 16;
    red = rim ? -5 : 3;
    green = rim ? 3 : -2;
    blue = rim ? 11 : 5;
  } else if (style === 5) {
    // NEUT: muted dashed tracks with no continuous charged rail.
    const track = (x * 5 - y * 3 + frame) & 15;
    const gap = (x + y * 2) & 7;
    red = track <= 1 && gap > 1 ? 4 : -3;
    green = track <= 1 && gap > 1 ? 9 : 1;
    blue = track <= 1 && gap > 1 ? 8 : 2;
  } else if (style === 6) {
    // PHOT: coherent diagonal wavefronts and a cool interference trough.
    const band = (x + y + frame * 2) & 15;
    red = band <= 2 ? 11 : band >= 8 && band <= 10 ? -4 : 1;
    green = band <= 2 ? 10 : band >= 8 && band <= 10 ? 1 : 3;
    blue = band <= 2 ? 4 : band >= 8 && band <= 10 ? 10 : 2;
  } else if (style === 7) {
    // PROT: compact charged beads advancing along a narrow track.
    const rail = (x * 2 - y + frame) & 7;
    const bead = (x + y * 3 + frame * 2) & 15;
    red = rail <= 1 ? 12 : -2;
    green = rail <= 1 ? 5 + Number(bead <= 2) * 5 : 1;
    blue = rail <= 1 ? 2 : 5;
  } else if (style === 8) {
    // BRAY: straight coherent rails with regularly spaced hard nodes.
    const rail = Math.abs(((x - y) & 15) - 8);
    const node = (x + y - frame * 2) & 15;
    red = rail <= 1 ? 10 : -2;
    green = rail <= 1 ? 8 + Number(node <= 2) * 5 : 0;
    blue = rail <= 1 ? 5 + Number(node <= 2) * 7 : 3;
  } else {
    // EMBR: detached irregular sparks, not a continuous field or ray.
    const spark = (
      x * 17 + y * 31 + Math.floor(x * y * 0.125) + (frame >> 1) * 7 + material
    ) & 31;
    red = spark < 4 ? 13 : -3;
    green = spark < 4 ? 8 : -1;
    blue = spark < 4 ? -2 : 2;
  }

  rgb[0] += clampDelta(red) * boundedGain;
  rgb[1] += clampDelta(green) * boundedGain;
  rgb[2] += clampDelta(blue) * boundedGain;
}

function clampDelta(value: number): number {
  return Math.max(-MAX_CHANNEL_DELTA, Math.min(MAX_CHANNEL_DELTA, value));
}
