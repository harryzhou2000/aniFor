import type { VisualCaptureEvidencePlane } from '../shared/visual-capture-static-contract.js';

/** Existing renderer reads exposed through one fixed browser-audit bridge. */
export interface VisualCaptureEvidenceReaders {
  atmosphereFieldAlphaAt(x: number, y: number): number;
  liquidFieldAlphaAt(x: number, y: number): number;
  emissionFieldAlphaAt(x: number, y: number): number;
  powderSurfaceAlphaAt(x: number, y: number): number;
}

export interface VisualCaptureEvidenceDigest {
  readonly hash: number;
  readonly supportHash: number;
  readonly alphaSum: number;
  readonly nonzero: number;
}

export interface VisualCaptureEvidenceRgbaField {
  readonly bytes: Uint8Array;
  readonly width: number;
  readonly height: number;
}

export interface PackedVisualCaptureEvidenceFields {
  readonly atmosphere: VisualCaptureEvidenceRgbaField;
  readonly liquid: VisualCaptureEvidenceRgbaField;
  readonly emission: VisualCaptureEvidenceRgbaField;
  readonly powderSurface: VisualCaptureEvidenceRgbaField;
}

const DIGEST_OFFSET = 2166136261 >>> 0;
const DIGEST_PRIME = 16777619;

function validRgbaField(field: VisualCaptureEvidenceRgbaField): boolean {
  return Number.isInteger(field.width) && field.width > 0
    && Number.isInteger(field.height) && field.height > 0
    && field.bytes.length === field.width * field.height * 4;
}

function digestDirectRgbaAlpha(
  field: VisualCaptureEvidenceRgbaField,
  worldWidth: number,
  worldHeight: number,
): VisualCaptureEvidenceDigest | undefined {
  if (field.width !== worldWidth || field.height !== worldHeight || !validRgbaField(field)) {
    return undefined;
  }
  let hash = DIGEST_OFFSET;
  let supportHash = DIGEST_OFFSET;
  let alphaSum = 0;
  let nonzero = 0;
  for (let offset = 3, index = 0; offset < field.bytes.length; offset += 4, index++) {
    const byte = field.bytes[offset];
    const supported = Number(byte > 0);
    hash = Math.imul((hash ^ byte ^ index) >>> 0, DIGEST_PRIME) >>> 0;
    supportHash = Math.imul((supportHash ^ supported ^ index) >>> 0, DIGEST_PRIME) >>> 0;
    alphaSum += byte;
    nonzero += supported;
  }
  return { hash, supportHash, alphaSum, nonzero };
}

/**
 * Digests the authoritative packed CPU fields without a callback per world
 * cell. The two compact-field loops intentionally retain their distinct
 * historical floating-point operation order: reassociating either bilinear
 * interpolation can change rounding at half-byte ties and rotate evidence IDs.
 */
export function digestPackedVisualCaptureEvidenceAlpha(
  fields: PackedVisualCaptureEvidenceFields,
  plane: VisualCaptureEvidencePlane,
  worldWidth: number,
  worldHeight: number,
): VisualCaptureEvidenceDigest | undefined {
  if (!Number.isInteger(worldWidth) || worldWidth <= 0
    || !Number.isInteger(worldHeight) || worldHeight <= 0) return undefined;
  if (plane === 'liquid-alpha') {
    return digestDirectRgbaAlpha(fields.liquid, worldWidth, worldHeight);
  }
  if (plane === 'powder-surface-alpha') {
    return digestDirectRgbaAlpha(fields.powderSurface, worldWidth, worldHeight);
  }
  let field: VisualCaptureEvidenceRgbaField;
  switch (plane) {
    case 'atmosphere-alpha': field = fields.atmosphere; break;
    case 'emission-alpha': field = fields.emission; break;
    default: {
      const unsupported: never = plane;
      throw new Error(`Unknown visual capture evidence plane ${JSON.stringify(unsupported)}`);
    }
  }
  if (!validRgbaField(field)) return undefined;

  let hash = DIGEST_OFFSET;
  let supportHash = DIGEST_OFFSET;
  let alphaSum = 0;
  let nonzero = 0;
  for (let y = 0; y < worldHeight; y++) {
    const fieldY = plane === 'atmosphere-alpha'
      ? Math.min(field.height - 1, Math.max(0, (y + 0.5) / worldHeight * field.height - 0.5))
      : Math.max(0, Math.min(field.height - 1, (y + 0.5) * field.height / worldHeight - 0.5));
    const top = Math.floor(fieldY);
    const bottom = Math.min(field.height - 1, top + 1);
    const blendY = fieldY - top;
    for (let x = 0; x < worldWidth; x++) {
      const fieldX = plane === 'atmosphere-alpha'
        ? Math.min(field.width - 1, Math.max(0, (x + 0.5) / worldWidth * field.width - 0.5))
        : Math.max(0, Math.min(field.width - 1, (x + 0.5) * field.width / worldWidth - 0.5));
      const left = Math.floor(fieldX);
      const right = Math.min(field.width - 1, left + 1);
      const blendX = fieldX - left;
      const topLeft = field.bytes[(top * field.width + left) * 4 + 3];
      const topRight = field.bytes[(top * field.width + right) * 4 + 3];
      const bottomLeft = field.bytes[(bottom * field.width + left) * 4 + 3];
      const bottomRight = field.bytes[(bottom * field.width + right) * 4 + 3];
      let sample: number;
      if (plane === 'atmosphere-alpha') {
        const topAlpha = topLeft * (1 - blendX) + topRight * blendX;
        const bottomAlpha = bottomLeft * (1 - blendX) + bottomRight * blendX;
        sample = (topAlpha * (1 - blendY) + bottomAlpha * blendY) / 255 * 255;
      } else {
        const topAlpha = topLeft + (topRight - topLeft) * blendX;
        const bottomAlpha = bottomLeft + (bottomRight - bottomLeft) * blendX;
        sample = topAlpha + (bottomAlpha - topAlpha) * blendY;
      }
      const index = y * worldWidth + x;
      const byte = Math.round(Math.max(0, Math.min(255, Number(sample) || 0)));
      const supported = Number(byte > 0);
      hash = Math.imul((hash ^ byte ^ index) >>> 0, DIGEST_PRIME) >>> 0;
      supportHash = Math.imul((supportHash ^ supported ^ index) >>> 0, DIGEST_PRIME) >>> 0;
      alphaSum += byte;
      nonzero += supported;
    }
  }
  return { hash, supportHash, alphaSum, nonzero };
}

export function readVisualCaptureEvidenceAlpha(
  readers: VisualCaptureEvidenceReaders,
  plane: VisualCaptureEvidencePlane,
  x: number,
  y: number,
): number {
  switch (plane) {
    case 'atmosphere-alpha': return readers.atmosphereFieldAlphaAt(x, y);
    case 'liquid-alpha': return readers.liquidFieldAlphaAt(x, y);
    case 'emission-alpha': return readers.emissionFieldAlphaAt(x, y);
    case 'powder-surface-alpha': return readers.powderSurfaceAlphaAt(x, y);
    default: {
      const unsupported: never = plane;
      throw new Error(`Unknown visual capture evidence plane ${JSON.stringify(unsupported)}`);
    }
  }
}

/**
 * Digests one authoritative renderer plane behind a single typed audit call.
 * Plane dispatch happens once; the exact historical byte/index grammar remains
 * unchanged while the capture script avoids routing every cell through the
 * public audit bridge and generic plane switch.
 */
export function digestVisualCaptureEvidenceAlpha(
  readers: VisualCaptureEvidenceReaders,
  plane: VisualCaptureEvidencePlane,
  width: number,
  height: number,
): VisualCaptureEvidenceDigest {
  let read: (x: number, y: number) => number;
  switch (plane) {
    case 'atmosphere-alpha': read = (x, y) => readers.atmosphereFieldAlphaAt(x, y); break;
    case 'liquid-alpha': read = (x, y) => readers.liquidFieldAlphaAt(x, y); break;
    case 'emission-alpha': read = (x, y) => readers.emissionFieldAlphaAt(x, y); break;
    case 'powder-surface-alpha': read = (x, y) => readers.powderSurfaceAlphaAt(x, y); break;
    default: {
      const unsupported: never = plane;
      throw new Error(`Unknown visual capture evidence plane ${JSON.stringify(unsupported)}`);
    }
  }
  let hash = DIGEST_OFFSET;
  let supportHash = DIGEST_OFFSET;
  let alphaSum = 0;
  let nonzero = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      const byte = Math.round(Math.max(0, Math.min(255, Number(read(x, y)) || 0)));
      const supported = Number(byte > 0);
      hash = Math.imul((hash ^ byte ^ index) >>> 0, DIGEST_PRIME) >>> 0;
      supportHash = Math.imul((supportHash ^ supported ^ index) >>> 0, DIGEST_PRIME) >>> 0;
      alphaSum += byte;
      nonzero += supported;
    }
  }
  return { hash, supportHash, alphaSum, nonzero };
}
