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
  let hash = 2166136261 >>> 0;
  let supportHash = 2166136261 >>> 0;
  let alphaSum = 0;
  let nonzero = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      const byte = Math.round(Math.max(0, Math.min(255, Number(read(x, y)) || 0)));
      const supported = Number(byte > 0);
      hash = Math.imul((hash ^ byte ^ index) >>> 0, 16777619) >>> 0;
      supportHash = Math.imul((supportHash ^ supported ^ index) >>> 0, 16777619) >>> 0;
      alphaSum += byte;
      nonzero += supported;
    }
  }
  return { hash, supportHash, alphaSum, nonzero };
}
