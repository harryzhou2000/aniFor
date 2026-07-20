import { RENDER_OPTICS_CLASS_COUNT, RenderOptics } from './render-optics';

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
const EMISSION_BASE_EXPOSURE = 0.46;
const EMISSION_RELIEF_GAIN = 2.4;
const BODY_ALPHA_SUPPORT = Float32Array.from(
  { length: 256 }, (_, alpha) => smoothstep(COHESION_START_ALPHA, COHESION_END_ALPHA, alpha),
);
const BODY_NEIGHBOUR_SUPPORT = Float32Array.from(
  { length: 9 }, (_, neighbours) => smoothstep(2, 6, neighbours),
);
const BODY_PARAMETER_COUNT = 5;
const BODY_PARAMETERS = new Float32Array(RENDER_OPTICS_CLASS_COUNT * BODY_PARAMETER_COUNT);
for (let optics = 0; optics < RENDER_OPTICS_CLASS_COUNT; optics++) {
  setBodyParameters(optics, 0.05, 0.90, 8, 12, 15);
}
setBodyParameters(RenderOptics.Aqueous, 0.055, 2.55, 5, 14, 18);
setBodyParameters(RenderOptics.Oily, 0.085, 0.85, 16, 9, 3);
setBodyParameters(RenderOptics.Corrosive, 0.065, 1.0, 15, 8, 18);
setBodyParameters(RenderOptics.Molten, 0.025, 0.38, 2, 0.7, 0.2);

/**
 * Gives an authoritative Canvas liquid cell field-owned body depth and a
 * continuous exposed meniscus. Every input is already computed by the caller;
 * this helper changes RGB only and performs no sampling or allocation.
 */
export function applyCanvasLiquidBodyOptics(
  color: Float32Array,
  optics: RenderOptics,
  fieldAlpha: number,
  neighbourCount: number,
  signedRelief: number,
  surfaceExposure: number,
): void {
  const support = BODY_ALPHA_SUPPORT[fieldAlpha] * BODY_NEIGHBOUR_SUPPORT[neighbourCount];
  if (support <= 0) return;
  const parameter = optics * BODY_PARAMETER_COUNT;
  const absorption = BODY_PARAMETERS[parameter];
  const reliefGain = BODY_PARAMETERS[parameter + 1];

  const depth = support * (0.35 + neighbourCount * 0.08125);
  const boundedRelief = signedRelief < RELIEF_DARK_LIMIT ? RELIEF_DARK_LIMIT
    : signedRelief > RELIEF_LIGHT_LIMIT ? RELIEF_LIGHT_LIMIT : signedRelief;
  const relief = boundedRelief * reliefGain * support;
  const bodyScale = 1 - absorption * depth + relief;
  color[0] *= bodyScale;
  color[1] *= bodyScale;
  color[2] *= bodyScale;
  const rim = surfaceExposure * support;
  color[0] += BODY_PARAMETERS[parameter + 2] * rim;
  color[1] += BODY_PARAMETERS[parameter + 3] * rim;
  color[2] += BODY_PARAMETERS[parameter + 4] * rim;
  compressPeak(color);
}

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

/** Field-validated exposed contour used only for coloured emission reflection. */
export function canvasLiquidEmissionSurfaceExposure(
  density: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  semanticTopEmpty: boolean,
  semanticLeftEmpty: boolean,
  semanticRightEmpty: boolean,
  semanticBottomEmpty: boolean,
): number {
  const center = (y * width + x) * 4;
  if (density[center + 3] <= RELIEF_SUPPORT_START_ALPHA) return 0;
  const exposure = (
    neighbourExposure(density, width, x, Math.max(0, y - 1), semanticTopEmpty) * 1.0
    + neighbourExposure(density, width, Math.max(0, x - 1), y, semanticLeftEmpty) * 0.82
    + neighbourExposure(density, width, Math.min(width - 1, x + 1), y, semanticRightEmpty) * 0.82
    + neighbourExposure(density, width, x, Math.min(height - 1, y + 1), semanticBottomEmpty) * 0.46
  );
  return Math.min(1, exposure);
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

/**
 * Converts an exposed liquid top and its already-computed signed field relief
 * into a bounded reflection response. Only positive, light-facing relief adds
 * gain: a shadowed meniscus stays translucent instead of becoming an emission
 * halo. The caller still owns RGB and alpha and skips this path for emissive
 * liquids, so the helper cannot widen a surface or create feedback.
 */
export function canvasLiquidEmissionExposure(
  surfaceExposure: number,
  signedRelief: number,
): number {
  if (surfaceExposure <= 0) return 0;
  return clamp(
    surfaceExposure * (EMISSION_BASE_EXPOSURE + Math.max(0, signedRelief) * EMISSION_RELIEF_GAIN),
    0,
    1,
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

function neighbourExposure(
  density: Uint8Array,
  width: number,
  x: number,
  y: number,
  semanticEmpty: boolean,
): number {
  if (!semanticEmpty) return 0;
  return 1 - smoothstep(
    SURFACE_TOP_START_ALPHA,
    SURFACE_TOP_END_ALPHA,
    density[(y * width + x) * 4 + 3],
  );
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const amount = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return amount * amount * (3 - 2 * amount);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function compressPeak(color: Float32Array): void {
  const red = color[0];
  const green = color[1];
  const blue = color[2];
  if (red <= 254 && green <= 254 && blue <= 254) return;
  const peak = red > green ? (red > blue ? red : blue) : (green > blue ? green : blue);
  const scale = 254 / peak;
  color[0] *= scale;
  color[1] *= scale;
  color[2] *= scale;
}

function setBodyParameters(
  optics: number,
  absorption: number,
  relief: number,
  red: number,
  green: number,
  blue: number,
): void {
  const offset = optics * BODY_PARAMETER_COUNT;
  BODY_PARAMETERS[offset] = absorption;
  BODY_PARAMETERS[offset + 1] = relief;
  BODY_PARAMETERS[offset + 2] = red;
  BODY_PARAMETERS[offset + 3] = green;
  BODY_PARAMETERS[offset + 4] = blue;
}
