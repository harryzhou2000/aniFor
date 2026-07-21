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
  _index: number,
): void {
  if (material === Material.Wood) {
    const ring = positiveModulo(x + Math.floor(y / 3) + material, 11) < 2 ? -7 : 2;
    const axial = positiveModulo(x + Math.floor(y / 7) + material, 9) < 2;
    rgb[0] += ring + (axial ? 3 : 0);
    rgb[1] += ring * 0.48 + (axial ? 1.5 : 0);
    rgb[2] += ring * 0.22 - (axial ? 1.5 : 0);
  } else if (material === Material.Plant) {
    const leaf = positiveModulo(x * 5 + y * 3 + material, 8) / 7;
    const vein = positiveModulo(x * 2 + y + positiveModulo(y * 5 + 3, 8), 13) < 3;
    rgb[0] += leaf * 1.5 - (vein ? 3 : 0);
    rgb[1] += leaf * 3.5 + (vein ? 6 : 0);
    rgb[2] += leaf - (vein ? 2.5 : 0);
  } else if (material === Material.VINE) {
    const strand = positiveModulo(x + Math.floor(y / 4) + material, 7) < 2;
    const node = positiveModulo(x * 3 + y * 5 + material, 16) < 2;
    rgb[0] += strand ? -3 : 1;
    rgb[1] += strand ? 7 : -1;
    rgb[2] += strand ? -2 : 0;
    if (node) {
      rgb[0] += 2;
      rgb[1] += 4;
      rgb[2] += 1;
    }
  } else if (material === Material.SEED) {
    const localX = positiveModulo(x, 8) - 4;
    const localY = positiveModulo(y, 8) - 4;
    const radiusSquared = localX * localX + localY * localY;
    const husk = radiusSquared >= 5 && radiusSquared <= 13;
    const embryo = localX >= 0 && localX <= 2 && localY >= -1 && localY <= 1;
    rgb[0] += (husk ? 5 : -2) + (embryo ? 2 : 0);
    rgb[1] += (husk ? 2 : -1) + (embryo ? 5 : 0);
    rgb[2] += (husk ? -3 : 1) + (embryo ? 1 : 0);
  } else if (material === Material.YEST) {
    const localX = positiveModulo(x, 8) - 4;
    const localY = positiveModulo(y, 8) - 4;
    const radiusSquared = localX * localX + localY * localY;
    const cellRim = radiusSquared >= 5 && radiusSquared <= 13;
    const bud = (localX - 1) * (localX - 1) + (localY + 1) * (localY + 1) <= 2;
    rgb[0] += (cellRim ? 3 : -1) + (bud ? 3 : 0);
    rgb[1] += (cellRim ? 2 : -0.5) + (bud ? 4 : 0);
    rgb[2] += (cellRim ? 1 : -1.5) + (bud ? 2 : 0);
  }
}

function positiveModulo(value: number, divisor: number): number {
  const remainder = value % divisor;
  return remainder < 0 ? remainder + divisor : remainder;
}
