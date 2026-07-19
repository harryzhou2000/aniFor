const COHESION_START_ALPHA = 160;
const COHESION_END_ALPHA = 240;
const DENSE_CONTOUR_FLOOR = 0.18;
const SURFACE_TOP_START_ALPHA = 80;
const SURFACE_TOP_END_ALPHA = 192;
const RELIEF_SUPPORT_START_ALPHA = 0.28 * 255;
const RELIEF_SUPPORT_END_ALPHA = 0.72 * 255;
const RELIEF_DARK_LIMIT = -0.16;
const RELIEF_LIGHT_LIMIT = 0.18;
const INTERFACE_SUPPORT_START_ALPHA = 0.62 * 255;
const INTERFACE_SUPPORT_END_ALPHA = 0.88 * 255;
const INTERFACE_CONTRAST_START = 0.06;
const INTERFACE_CONTRAST_END = 0.28;
const INTERFACE_RELIEF_X = 0.075;
const INTERFACE_RELIEF_Y = 0.09;

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

/**
 * Signed, field-owned relief for a connected Canvas liquid surface. The four
 * cardinal alpha reads mirror WebGL's existing volume normal. Gating on both
 * centre and cardinal support keeps isolated droplets on their semantic-cell
 * contour, while the scalar result can multiply RGB without changing hue,
 * species, alpha, or reconstruction support.
 */
export function canvasLiquidFieldRelief(
  density: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  const leftX = Math.max(0, x - 1);
  const rightX = Math.min(width - 1, x + 1);
  const topY = Math.max(0, y - 1);
  const bottomY = Math.min(height - 1, y + 1);
  const center = density[(y * width + x) * 4 + 3];
  if (center <= RELIEF_SUPPORT_START_ALPHA) return 0;
  const left = density[(y * width + leftX) * 4 + 3];
  const right = density[(y * width + rightX) * 4 + 3];
  const top = density[(topY * width + x) * 4 + 3];
  const bottom = density[(bottomY * width + x) * 4 + 3];
  if (left === center && right === center && top === center && bottom === center) return 0;
  const neighbourMean = (left + right + top + bottom) * 0.25;
  if (neighbourMean <= RELIEF_SUPPORT_START_ALPHA) return 0;
  const connected = smoothstep(
    RELIEF_SUPPORT_START_ALPHA, RELIEF_SUPPORT_END_ALPHA, Math.min(center, neighbourMean),
  );
  if (connected <= 0) return 0;

  // Light arrives from the upper left. Signed curvature adds a restrained
  // crown highlight or overlap-pocket shadow without introducing cell noise.
  const directional = (right - left) * 0.22 + (bottom - top) * 0.30;
  const curvature = center - neighbourMean;
  const curvatureLight = curvature >= 0 ? curvature * 0.38 : curvature * 0.24;
  return clamp(
    (directional + curvatureLight) / 255 * connected,
    RELIEF_DARK_LIMIT,
    RELIEF_LIGHT_LIMIT,
  );
}

/**
 * Dense unlike-liquid neighbours behave as an optical interface even when the
 * union-density field is flat. RGB is canonical species ownership here, never
 * shaded presentation colour. Requiring dense alpha on both sides prevents an
 * empty shore or isolated droplet from being mistaken for a second liquid. The
 * caller first proves an unlike semantic-liquid neighbour, so ordinary pool
 * cells keep the original alpha-only hot path.
 */
export function canvasLiquidSpeciesRelief(
  density: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  const leftX = Math.max(0, x - 1);
  const rightX = Math.min(width - 1, x + 1);
  const topY = Math.max(0, y - 1);
  const bottomY = Math.min(height - 1, y + 1);
  const center = (y * width + x) * 4;
  return clamp(
    (liquidSpeciesContrast(density, center, (y * width + rightX) * 4)
      - liquidSpeciesContrast(density, center, (y * width + leftX) * 4))
      * INTERFACE_RELIEF_X
    + (liquidSpeciesContrast(density, center, (bottomY * width + x) * 4)
      - liquidSpeciesContrast(density, center, (topY * width + x) * 4))
      * INTERFACE_RELIEF_Y,
    RELIEF_DARK_LIMIT,
    RELIEF_LIGHT_LIMIT,
  );
}

function liquidSpeciesContrast(field: Uint8Array, center: number, neighbour: number): number {
  const support = smoothstep(
    INTERFACE_SUPPORT_START_ALPHA,
    INTERFACE_SUPPORT_END_ALPHA,
    Math.min(field[center + 3], field[neighbour + 3]),
  );
  if (support <= 0) return 0;
  const contrast = Math.max(
    Math.abs(field[center] - field[neighbour]),
    Math.abs(field[center + 1] - field[neighbour + 1]),
    Math.abs(field[center + 2] - field[neighbour + 2]),
  ) / 255;
  return support * smoothstep(INTERFACE_CONTRAST_START, INTERFACE_CONTRAST_END, contrast);
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const amount = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return amount * amount * (3 - 2 * amount);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
