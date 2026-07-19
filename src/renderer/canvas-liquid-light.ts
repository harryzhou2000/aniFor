const COHESION_START_ALPHA = 160;
const COHESION_END_ALPHA = 240;
const DENSE_CONTOUR_FLOOR = 0.18;
const SURFACE_TOP_START_ALPHA = 80;
const SURFACE_TOP_END_ALPHA = 192;

/**
 * Scales semantic-cell contour light down only where the shared liquid field
 * proves a cohesive body. Sparse droplets retain their exact local contour.
 */
export function canvasLiquidContourScale(fieldAlpha: number): number {
  return 1 - smoothstep(COHESION_START_ALPHA, COHESION_END_ALPHA, fieldAlpha)
    * (1 - DENSE_CONTOUR_FLOOR);
}

/**
 * Returns field-owned top-surface exposure for a semantic liquid cell. An
 * unlike material above remains a species boundary, not an empty-air glint.
 */
export function canvasLiquidSurfaceExposure(
  density: Uint8Array,
  width: number,
  x: number,
  y: number,
  semanticTopEmpty: boolean,
): number {
  if (!semanticTopEmpty) return 0;
  const topAlpha = y === 0 ? 0 : density[((y - 1) * width + x) * 4 + 3];
  return 1 - smoothstep(SURFACE_TOP_START_ALPHA, SURFACE_TOP_END_ALPHA, topAlpha);
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const amount = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return amount * amount * (3 - 2 * amount);
}
