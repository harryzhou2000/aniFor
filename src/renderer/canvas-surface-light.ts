import { RenderPhase, surfaceLightGain, type RenderProfile } from './render-profile';
import { RenderOptics } from './render-optics';

export const CANVAS_TRANSLUCENT_FIELD_EXPOSURE = 0.38;
export const CANVAS_TRANSLUCENT_FIELD_GAIN = 1.6;
export const CANVAS_SOLID_FIELD_DIRECTION_GAIN = 1.25;
export const CANVAS_SOLID_FIELD_DIRECTION_LIMIT = 0.12;

/**
 * Samples one RGBA field's alpha at a world-cell centre. The return value stays
 * in byte space so callers can use the same thresholds as the backing field.
 * This is deliberately scalar: the Canvas hot loop gets bilinear support
 * without allocating a coordinate or colour tuple for every world cell.
 */
export function sampleCanvasFieldAlpha(
  field: Uint8Array,
  fieldWidth: number,
  fieldHeight: number,
  worldWidth: number,
  worldHeight: number,
  x: number,
  y: number,
): number {
  if (fieldWidth <= 0 || fieldHeight <= 0
    || field.length !== fieldWidth * fieldHeight * 4 || worldWidth <= 0 || worldHeight <= 0) {
    throw new Error('Canvas surface light field size mismatch');
  }
  const fieldX = Math.max(0, Math.min(
    fieldWidth - 1, (x + 0.5) * fieldWidth / worldWidth - 0.5,
  ));
  const fieldY = Math.max(0, Math.min(
    fieldHeight - 1, (y + 0.5) * fieldHeight / worldHeight - 0.5,
  ));
  const x0 = Math.floor(fieldX);
  const y0 = Math.floor(fieldY);
  const x1 = Math.min(fieldWidth - 1, x0 + 1);
  const y1 = Math.min(fieldHeight - 1, y0 + 1);
  return bilinearValues(
    field[(y0 * fieldWidth + x0) * 4 + 3],
    field[(y0 * fieldWidth + x1) * 4 + 3],
    field[(y1 * fieldWidth + x0) * 4 + 3],
    field[(y1 * fieldWidth + x1) * 4 + 3],
    fieldX - x0,
    fieldY - y0,
  );
}

/**
 * Eligibility for the directional part of shared-field light. The ordinary
 * scalar response remains independent; this addition belongs only to a real,
 * opaque solid contour and therefore cannot leak into reconstructed support.
 */
export function canvasSolidFieldLightingGain(
  phase: RenderPhase,
  optics: RenderOptics,
  traits: number,
  emissive: boolean,
  denseInterior: boolean,
  hasNativeWall: boolean,
  enabled: boolean,
): number {
  return enabled && phase === RenderPhase.Solid
    && optics !== RenderOptics.TranslucentRigid
    && traits === 0 && !emissive && !denseInterior && !hasNativeWall
    ? CANVAS_SOLID_FIELD_DIRECTION_GAIN : 0;
}

/** Dense semantic glass may carry scene light through its body, never its alpha. */
export function canvasTranslucentFieldExposure(
  optics: number,
  denseInterior: boolean,
  emissive: boolean,
  enabled: boolean,
): number {
  return enabled && denseInterior && !emissive && optics === RenderOptics.TranslucentRigid
    ? CANVAS_TRANSLUCENT_FIELD_EXPOSURE
    : 0;
}

/**
 * Applies the shared low-resolution emission field to an exposed Canvas matter
 * contour. RGB uses a screen blend so coloured light reveals the existing
 * material texture without whitening it; alpha and the semantic silhouette are
 * left byte-for-byte untouched.
 */
export function lightCanvasSurface(
  target: Uint8ClampedArray,
  offset: number,
  emission: Uint8Array,
  emissionWidth: number,
  emissionHeight: number,
  worldWidth: number,
  worldHeight: number,
  x: number,
  y: number,
  profile: RenderProfile,
  exposure: number,
  responseGain = 1,
  outwardNormalX = 0,
  outwardNormalY = 0,
  directionalGain = 0,
): void {
  if (exposure <= 0 || target[offset + 3] === 0) return;
  if (emissionWidth <= 0 || emissionHeight <= 0
    || emission.length !== emissionWidth * emissionHeight * 4 || worldWidth <= 0 || worldHeight <= 0) {
    throw new Error('Canvas surface light field size mismatch');
  }
  const fieldX = Math.max(0, Math.min(emissionWidth - 1, (x + 0.5) * emissionWidth / worldWidth - 0.5));
  const fieldY = Math.max(0, Math.min(emissionHeight - 1, (y + 0.5) * emissionHeight / worldHeight - 0.5));
  const x0 = Math.floor(fieldX);
  const y0 = Math.floor(fieldY);
  const x1 = Math.min(emissionWidth - 1, x0 + 1);
  const y1 = Math.min(emissionHeight - 1, y0 + 1);
  const mixX = fieldX - x0;
  const mixY = fieldY - y0;
  const topLeft = (y0 * emissionWidth + x0) * 4;
  const topRight = (y0 * emissionWidth + x1) * 4;
  const bottomLeft = (y1 * emissionWidth + x0) * 4;
  const bottomRight = (y1 * emissionWidth + x1) * 4;
  const alphaTopLeft = emission[topLeft + 3];
  const alphaTopRight = emission[topRight + 3];
  const alphaBottomLeft = emission[bottomLeft + 3];
  const alphaBottomRight = emission[bottomRight + 3];
  const alpha = bilinearValues(
    alphaTopLeft, alphaTopRight, alphaBottomLeft, alphaBottomRight, mixX, mixY,
  ) / 255;
  if (alpha <= 1 / 255) return;

  let response = Math.min(
    1,
    alpha * surfaceLightGain(profile) * Math.max(0, Math.min(1, exposure))
      * Math.max(0, responseGain),
  );
  if (directionalGain > 0 && (outwardNormalX !== 0 || outwardNormalY !== 0)) {
    // The four alpha values were already required by the bilinear sample. Their
    // analytic slope points toward the local emitter, so its positive dot with
    // the outward material normal is the source-facing fraction. Normalization
    // keeps the response independent of the field's downsample resolution.
    const gradientX = (
      alphaTopRight - alphaTopLeft
        + (alphaBottomRight - alphaBottomLeft - alphaTopRight + alphaTopLeft) * mixY
    ) / 255;
    const gradientY = (
      alphaBottomLeft - alphaTopLeft
        + (alphaBottomRight - alphaTopRight - alphaBottomLeft + alphaTopLeft) * mixX
    ) / 255;
    const gradientLength = Math.hypot(gradientX, gradientY);
    const normalLength = Math.hypot(outwardNormalX, outwardNormalY);
    if (gradientLength > 1 / 255 && normalLength > 0) {
      const facing = Math.max(0, Math.min(
        1,
        (gradientX * outwardNormalX + gradientY * outwardNormalY)
          / (gradientLength * normalLength),
      ));
      response = Math.min(
        1,
        response + Math.min(
          CANVAS_SOLID_FIELD_DIRECTION_LIMIT, response * facing * directionalGain,
        ),
      );
    }
  }
  for (let channel = 0; channel < 3; channel++) {
    const light = bilinear(
      emission, topLeft + channel, topRight + channel, bottomLeft + channel, bottomRight + channel, mixX, mixY,
    ) / 255;
    const base = target[offset + channel];
    target[offset + channel] = base + (255 - base) * light * response;
  }
}

function bilinearValues(
  topLeft: number,
  topRight: number,
  bottomLeft: number,
  bottomRight: number,
  mixX: number,
  mixY: number,
): number {
  const top = topLeft + (topRight - topLeft) * mixX;
  const bottom = bottomLeft + (bottomRight - bottomLeft) * mixX;
  return top + (bottom - top) * mixY;
}

function bilinear(
  bytes: Uint8Array,
  topLeft: number,
  topRight: number,
  bottomLeft: number,
  bottomRight: number,
  mixX: number,
  mixY: number,
): number {
  return bilinearValues(
    bytes[topLeft], bytes[topRight], bytes[bottomLeft], bytes[bottomRight], mixX, mixY,
  );
}
