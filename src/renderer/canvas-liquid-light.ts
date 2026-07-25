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
const INTERFACE_MENISCUS_RELIEF_LIMIT = 0.12;
const INTERFACE_MENISCUS_MAX_DELTA = 6;
const EMISSION_BASE_EXPOSURE = 0.46;
const EMISSION_RELIEF_GAIN = 2.4;
const BODY_ALPHA_SUPPORT = Float32Array.from(
  { length: 256 }, (_, alpha) => smoothstep(COHESION_START_ALPHA, COHESION_END_ALPHA, alpha),
);
const BODY_NEIGHBOUR_SUPPORT = Float32Array.from(
  { length: 9 }, (_, neighbours) => smoothstep(2, 6, neighbours),
);
const VOLUME_CHROMA_PARAMETER_COUNT = 6;
const VOLUME_CHROMA_PARAMETERS = new Float32Array(
  RENDER_OPTICS_CLASS_COUNT * VOLUME_CHROMA_PARAMETER_COUNT,
);
const COLUMN_DEPTH_ABSORPTION = new Float32Array(RENDER_OPTICS_CLASS_COUNT).fill(0.06);
for (let optics = 0; optics < RENDER_OPTICS_CLASS_COUNT; optics++) {
  setVolumeChromaParameters(optics, 0.72, 0.84, 1.00, 0.72, 0.68, 0.58);
}
setVolumeChromaParameters(RenderOptics.Aqueous, 0.52, 0.88, 1.00, 1.00, 0.62, 0.36);
setVolumeChromaParameters(RenderOptics.Oily, 1.00, 0.72, 0.28, 0.40, 0.68, 1.00);
setVolumeChromaParameters(RenderOptics.Corrosive, 0.44, 1.00, 0.68, 0.72, 0.38, 0.62);
setVolumeChromaParameters(RenderOptics.CryogenicLiquid, 0.62, 0.90, 1.00, 1.00, 0.55, 0.28);
setVolumeChromaParameters(RenderOptics.MetallicLiquid, 1.00, 0.98, 0.94, 0.58, 0.62, 0.70);
setVolumeChromaParameters(RenderOptics.ViscousLiquid, 0.82, 0.92, 1.00, 0.70, 0.64, 0.58);
COLUMN_DEPTH_ABSORPTION[RenderOptics.Aqueous] = 0.14;
COLUMN_DEPTH_ABSORPTION[RenderOptics.Oily] = 0.18;
COLUMN_DEPTH_ABSORPTION[RenderOptics.Corrosive] = 0.09;
COLUMN_DEPTH_ABSORPTION[RenderOptics.Molten] = 0;
COLUMN_DEPTH_ABSORPTION[RenderOptics.CryogenicLiquid] = 0.10;
COLUMN_DEPTH_ABSORPTION[RenderOptics.MetallicLiquid] = 0.22;
COLUMN_DEPTH_ABSORPTION[RenderOptics.ViscousLiquid] = 0.20;
const BODY_PARAMETER_COUNT = 5;
const BODY_PARAMETERS = new Float32Array(RENDER_OPTICS_CLASS_COUNT * BODY_PARAMETER_COUNT);
for (let optics = 0; optics < RENDER_OPTICS_CLASS_COUNT; optics++) {
  setBodyParameters(optics, 0.05, 0.90, 8, 12, 15);
}
setBodyParameters(RenderOptics.Aqueous, 0.055, 2.55, 5, 14, 18);
setBodyParameters(RenderOptics.Oily, 0.085, 0.85, 16, 9, 3);
setBodyParameters(RenderOptics.Corrosive, 0.065, 1.0, 15, 8, 18);
setBodyParameters(RenderOptics.Molten, 0.025, 0.38, 2, 0.7, 0.2);
setBodyParameters(RenderOptics.CryogenicLiquid, 0.045, 2.8, 8, 16, 20);
setBodyParameters(RenderOptics.MetallicLiquid, 0.10, 1.2, 20, 20, 19);
setBodyParameters(RenderOptics.ViscousLiquid, 0.095, 0.72, 13, 15, 16);

/**
 * Shared exact dense-body eligibility for Canvas liquid styling. Callers can
 * compute it before an animated macro wave so sparse droplets avoid work that
 * every downstream body helper would otherwise reject anyway.
 */
export function canvasLiquidBodySupport(fieldAlpha: number, neighbourCount: number): number {
  return BODY_ALPHA_SUPPORT[fieldAlpha] * BODY_NEIGHBOUR_SUPPORT[neighbourCount];
}

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
  bodySupport = canvasLiquidBodySupport(fieldAlpha, neighbourCount),
): void {
  const support = bodySupport;
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
 * Signed family-coloured key/fill for an already qualified liquid body.
 * Inputs are values the semantic styling pass has already computed. The
 * response is RGB-only and allocation-free; support and opacity stay owned by
 * the liquid field and the supersampled contour reconstruction.
 */
export function canvasLiquidVolumeChromaResponse(
  optics: RenderOptics,
  fieldAlpha: number,
  neighbourCount: number,
  signedRelief: number,
  macroWave: number,
  bodySupport = canvasLiquidBodySupport(fieldAlpha, neighbourCount),
): number {
  if (optics === RenderOptics.Molten) return 0;
  const support = bodySupport;
  if (support <= 0) return 0;
  const boundedRelief = clamp(signedRelief, RELIEF_DARK_LIMIT, RELIEF_LIGHT_LIMIT);
  // The established WebGL composition gives broad reflected water and
  // cryogenic bodies a little more room than oil/viscous matter. Corrosive
  // liquid is intentionally restrained here because its later luminance-safe
  // hue transform already expands the signed response.
  const macroGain = optics === RenderOptics.Aqueous || optics === RenderOptics.CryogenicLiquid
    ? 1.35
    : optics === RenderOptics.Oily || optics === RenderOptics.MetallicLiquid
      ? 1.15
      : optics === RenderOptics.Corrosive ? 0.45 : 1;
  const response = (
    boundedRelief * 0.28 + clamp(macroWave, -1, 1) * 0.045 * macroGain
  ) * support;
  return clamp(response, -0.055, 0.065);
}

/**
 * Low-frequency, world-anchored liquid relief for the Canvas fallback. It is
 * deliberately a signed unit signal rather than a colour or coverage
 * operation: callers still gate it through cohesive same-species field support
 * before it can affect RGB. Two coupled waves keep dense-liquid rendering
 * materially cheaper than the richer WebGL shader while retaining readable
 * broad reflection and caustic bands, without a new field, sample, or
 * render-scale-dependent work.
 */
export function canvasLiquidMacroWave(
  x: number,
  y: number,
  visualTime: number,
  material: number,
): number {
  const time = visualTime * 0.001;
  const broadSheen = Math.sin(x * 0.041 + y * 0.016 + material * 0.83 + time * 0.22);
  // Reuse the broad phase to bend a second, shorter caustic band. This retains
  // a liquid-scale moving contour without the previous nested third/fourth
  // waves, and remains centred/continuous instead of becoming a cell pattern.
  const causticWave = 0.5 + 0.5 * Math.sin(
    x * 0.092 + broadSheen * 1.45 + material * 0.67,
  );
  return clamp(broadSheen * 0.48 + (smoothstep(0.18, 0.88, causticWave) - 0.5) * 0.92, -1, 1);
}

/**
 * Applies the Canvas counterpart to the WebGL broad reflected-band layer. The
 * caller has already rejected traits, emission, walls, and unlike-liquid
 * contact, while this function independently rejects sparse support. It only
 * moves RGB toward the existing family key or shadow; alpha and reconstruction
 * ownership stay entirely outside this operation.
 */
export function applyCanvasLiquidMacroSheen(
  color: Float32Array,
  optics: RenderOptics,
  fieldAlpha: number,
  neighbourCount: number,
  macroWave: number,
  bodySupport = canvasLiquidBodySupport(fieldAlpha, neighbourCount),
): void {
  if (optics === RenderOptics.Molten) return;
  const support = bodySupport;
  if (support <= 0) return;
  const wave = clamp(macroWave, -1, 1);
  if (wave === 0) return;
  const parameter = optics * VOLUME_CHROMA_PARAMETER_COUNT;
  // Aqueous and cryogenic bodies can carry a readable cool reflection; oil
  // remains a little broader and quieter, while corrosive hue stays governed
  // by its luminance-safe chroma step below.
  const strength = optics === RenderOptics.Aqueous || optics === RenderOptics.CryogenicLiquid
    ? 0.095
    : optics === RenderOptics.Oily ? 0.075
      : optics === RenderOptics.Corrosive ? 0.045
        : optics === RenderOptics.MetallicLiquid ? 0.065 : 0.070;
  const amount = Math.abs(wave) * support * strength;
  if (wave > 0) {
    color[0] += (255 - color[0]) * VOLUME_CHROMA_PARAMETERS[parameter] * amount;
    color[1] += (255 - color[1]) * VOLUME_CHROMA_PARAMETERS[parameter + 1] * amount;
    color[2] += (255 - color[2]) * VOLUME_CHROMA_PARAMETERS[parameter + 2] * amount;
  } else {
    color[0] *= 1 - VOLUME_CHROMA_PARAMETERS[parameter + 3] * amount;
    color[1] *= 1 - VOLUME_CHROMA_PARAMETERS[parameter + 4] * amount;
    color[2] *= 1 - VOLUME_CHROMA_PARAMETERS[parameter + 5] * amount;
  }
  compressPeak(color);
}

/**
 * Gives a dense, unlike-liquid boundary a restrained optical meniscus. The
 * caller has already proved exact semantic contact and passes the already
 * computed species-contrast relief, so this needs neither another field read
 * nor a neighbour scan. The response is deliberately unsigned: either side of
 * the same physical boundary receives the same quiet bright rim rather than a
 * time-varying light/dark separator. It changes RGB only.
 */
export function applyCanvasLiquidInterfaceMeniscus(
  color: Float32Array,
  optics: RenderOptics,
  fieldAlpha: number,
  neighbourCount: number,
  speciesRelief: number,
): void {
  if (optics === RenderOptics.Molten) return;
  const support = BODY_ALPHA_SUPPORT[fieldAlpha] * BODY_NEIGHBOUR_SUPPORT[neighbourCount];
  if (support <= 0) return;
  // The shared field permits a slightly larger positive than negative relief.
  // An interface rim must not inherit that directional asymmetry, otherwise
  // the two owners of one boundary can flicker at different intensities.
  const relief = Math.min(Math.abs(speciesRelief), INTERFACE_MENISCUS_RELIEF_LIMIT);
  if (relief <= 0) return;
  const strength = optics === RenderOptics.Aqueous || optics === RenderOptics.CryogenicLiquid
    ? 0.16
    : optics === RenderOptics.Oily || optics === RenderOptics.MetallicLiquid
      ? 0.14
      : optics === RenderOptics.Corrosive ? 0.11 : 0.13;
  const amount = Math.min(0.026, relief * support * strength);
  const parameter = optics * VOLUME_CHROMA_PARAMETER_COUNT;
  color[0] += Math.min(
    INTERFACE_MENISCUS_MAX_DELTA,
    (255 - color[0]) * VOLUME_CHROMA_PARAMETERS[parameter] * amount,
  );
  color[1] += Math.min(
    INTERFACE_MENISCUS_MAX_DELTA,
    (255 - color[1]) * VOLUME_CHROMA_PARAMETERS[parameter + 1] * amount,
  );
  color[2] += Math.min(
    INTERFACE_MENISCUS_MAX_DELTA,
    (255 - color[2]) * VOLUME_CHROMA_PARAMETERS[parameter + 2] * amount,
  );
  compressPeak(color);
}

export function applyCanvasLiquidVolumeChroma(
  color: Float32Array,
  optics: RenderOptics,
  response: number,
  opticalDepthByte = 0,
): void {
  if ((response === 0 && opticalDepthByte === 0) || optics === RenderOptics.Molten) return;
  const preserveLuminance = optics === RenderOptics.Corrosive;
  const luminance = preserveLuminance
    ? color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722 : 0;
  response = clamp(
    response * (preserveLuminance ? 2.70 : 1), -0.055, 0.065,
  );
  const parameter = optics * VOLUME_CHROMA_PARAMETER_COUNT;
  if (response > 0) {
    color[0] += (255 - color[0]) * VOLUME_CHROMA_PARAMETERS[parameter] * response * 0.90;
    color[1] += (255 - color[1]) * VOLUME_CHROMA_PARAMETERS[parameter + 1] * response * 0.90;
    color[2] += (255 - color[2]) * VOLUME_CHROMA_PARAMETERS[parameter + 2] * response * 0.90;
  } else {
    const amount = -response * 0.85;
    color[0] *= 1 - VOLUME_CHROMA_PARAMETERS[parameter + 3] * amount;
    color[1] *= 1 - VOLUME_CHROMA_PARAMETERS[parameter + 4] * amount;
    color[2] *= 1 - VOLUME_CHROMA_PARAMETERS[parameter + 5] * amount;
  }
  if (preserveLuminance) {
    const correction = luminance
      - (color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722);
    color[0] += correction;
    color[1] += correction;
    color[2] += correction;
  }
  // The existing liquid refresh supplies species-safe vertical depth. Reuse
  // the family shadow tint so deep pools absorb light while their exposed top
  // remains clear; this changes RGB only and adds no per-cell sampling.
  const columnAbsorption = opticalDepthByte / 255 * COLUMN_DEPTH_ABSORPTION[optics];
  if (columnAbsorption > 0) {
    color[0] *= 1 - VOLUME_CHROMA_PARAMETERS[parameter + 3] * columnAbsorption;
    color[1] *= 1 - VOLUME_CHROMA_PARAMETERS[parameter + 4] * columnAbsorption;
    color[2] *= 1 - VOLUME_CHROMA_PARAMETERS[parameter + 5] * columnAbsorption;
  }
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

function setVolumeChromaParameters(
  optics: number,
  keyRed: number,
  keyGreen: number,
  keyBlue: number,
  shadowRed: number,
  shadowGreen: number,
  shadowBlue: number,
): void {
  const offset = optics * VOLUME_CHROMA_PARAMETER_COUNT;
  VOLUME_CHROMA_PARAMETERS[offset] = keyRed;
  VOLUME_CHROMA_PARAMETERS[offset + 1] = keyGreen;
  VOLUME_CHROMA_PARAMETERS[offset + 2] = keyBlue;
  VOLUME_CHROMA_PARAMETERS[offset + 3] = shadowRed;
  VOLUME_CHROMA_PARAMETERS[offset + 4] = shadowGreen;
  VOLUME_CHROMA_PARAMETERS[offset + 5] = shadowBlue;
}
