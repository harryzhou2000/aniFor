import { Material } from '../shared/materials';

/** Botanical particles with an identity-specific morphology in both presenters. */
export function isBotanicalMaterial(material: number): boolean {
  return material === Material.Wood || material === Material.Plant || material === Material.VINE
    || material === Material.SEED || material === Material.YEST;
}

/**
 * Allocation-free, deterministic RGB morphology. The caller continues to own
 * alpha, topology, body lighting, powder cohesion, and native growth state.
 */
export function applyCanvasBotanicalMorphology(
  rgb: Float32Array,
  material: number,
  x: number,
  y: number,
  index: number,
): void {
  if (material === Material.Wood) {
    const signedGrain = ((hash(index + 0x5a17) & 31) - 15) / 15;
    const ring = positiveModulo(x + Math.floor(y / 3) + material, 11) < 2 ? -7 : 2;
    const axial = positiveModulo(x + Math.floor(y / 7) + material, 9) < 2;
    rgb[0] += ring + signedGrain * 1.8 + (axial ? 3 : 0);
    rgb[1] += ring * 0.48 + signedGrain * 0.9 + (axial ? 1.5 : 0);
    rgb[2] += ring * 0.22 - (axial ? 1.5 : 0);
  } else if (material === Material.Plant) {
    const leaf = (hash(index + 0x2c11) & 7) / 7;
    const vein = positiveModulo(x * 2 + y + (hash(y + material * 19) & 7), 13) < 3;
    rgb[0] += leaf * 1.5 - (vein ? 3 : 0);
    rgb[1] += leaf * 3.5 + (vein ? 6 : 0);
    rgb[2] += leaf - (vein ? 2.5 : 0);
  } else if (material === Material.VINE) {
    const strand = positiveModulo(x + Math.floor(y / 4) + material, 7) < 2;
    const node = (hash(index + 0x713) & 15) < 2;
    rgb[0] += strand ? -3 : 1;
    rgb[1] += strand ? 7 : -1;
    rgb[2] += strand ? -2 : 0;
    if (node) {
      rgb[0] += 2;
      rgb[1] += 4;
      rgb[2] += 1;
    }
  } else if (material === Material.SEED) {
    const husk = (hash(index + 0x4eed) & 7) < 2;
    rgb[0] += husk ? 5 : -2;
    rgb[1] += husk ? 2 : -1;
    rgb[2] += husk ? -3 : 1;
  } else if (material === Material.YEST) {
    const colony = hash(index + 0x7e57) & 15;
    const speckle = colony < 3;
    rgb[0] += speckle ? 4 : -1;
    rgb[1] += speckle ? 3 : -0.5;
    rgb[2] += speckle ? 1 : -1.5;
  }
}

function positiveModulo(value: number, divisor: number): number {
  const remainder = value % divisor;
  return remainder < 0 ? remainder + divisor : remainder;
}

function hash(value: number): number {
  value = Math.imul(value ^ 0x9e3779b9, 0x85ebca6b);
  value ^= value >>> 13;
  return (Math.imul(value, 0xc2b2ae35) ^ (value >>> 16)) >>> 0;
}
