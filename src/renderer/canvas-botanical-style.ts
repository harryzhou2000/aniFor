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

/**
 * Gives only a deep, exact PLNT body a restrained canopy-volume response.
 *
 * The caller has already proved the four-cardinal solid interior and supplied
 * the phase-local optical depth plus the existing organic macro relief. Small
 * growth tips, one-cell stems, contacts, walls, gaps, and ordinary surface
 * cells therefore remain on the native morphology/lifecycle paths. RGB is the
 * only mutable state; this helper never owns alpha, support, or growth state.
 */
export function applyCanvasPlantCanopyVolume(
  rgb: Float32Array,
  material: number,
  denseInterior: boolean,
  opticalDepthByte: number,
  opticalDepthEnabled: boolean,
  relief: number,
  x: number,
  y: number,
): void {
  if (material !== Material.Plant || !denseInterior
    || !opticalDepthEnabled || opticalDepthByte <= 6) return;
  const depth = Math.max(0, Math.min(1, (opticalDepthByte - 6) / 36));
  const depthSupport = depth * depth * (3 - 2 * depth);
  const signedRelief = Math.max(-1, Math.min(1, relief / 6)) * depthSupport;
  // A broad Plant body is usually a tree canopy, but native topology decides
  // that body elsewhere. Reuse its already-proven dense interior for a small
  // world-anchored leaf-cluster read: three-cell cells avoid simulation-pixel
  // pepper while the restrained vein keeps an otherwise smooth crown from
  // becoming a flat green disc. This is RGB-only and has no neighbour/state
  // lookup, so tips, stems, gaps, walls, and lifecycle ownership stay exact.
  const cluster = positiveModulo(Math.floor(x / 3) * 17 + Math.floor(y / 3) * 31, 29) / 28;
  const clusterCrown = smoothstep(0.64, 0.93, cluster);
  const clusterPocket = 1 - smoothstep(0.18, 0.48, cluster);
  const clusterVein = positiveModulo(Math.floor(x / 2) * 5 - Math.floor(y / 3) * 3, 23) === 0;
  rgb[0] += (1.4 * clusterCrown - 2.6 * clusterPocket - (clusterVein ? 2 : 0))
    * depthSupport;
  rgb[1] += (6 * clusterCrown - 3.4 * clusterPocket + (clusterVein ? 4 : 0))
    * depthSupport;
  rgb[2] += (1 * clusterCrown - 2.1 * clusterPocket - (clusterVein ? 1.2 : 0))
    * depthSupport;
  if (signedRelief > 0) {
    // The broad organic crown catches a filtered leaf-green fill rather than
    // becoming a white specular hotspot. The bound stays below seven bytes.
    rgb[0] += signedRelief * 1.5;
    rgb[1] += signedRelief * 6.5;
    rgb[2] += signedRelief * 2.3;
  } else {
    // Pockets are optically thicker than crowns. Keep their shadow subtle so
    // an inherited native tree palette remains recognisable afterward.
    const pocket = -signedRelief;
    rgb[0] *= 1 - pocket * 0.075;
    rgb[1] *= 1 - pocket * 0.040;
    rgb[2] *= 1 - pocket * 0.095;
  }
}

function positiveModulo(value: number, divisor: number): number {
  const remainder = value % divisor;
  return remainder < 0 ? remainder + divisor : remainder;
}

function smoothstep(start: number, end: number, value: number): number {
  const progress = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return progress * progress * (3 - 2 * progress);
}
