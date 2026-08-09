import type { VisualCaptureEvidencePlane } from '../shared/visual-capture-static-contract.js';

/** Existing renderer reads exposed through one fixed browser-audit bridge. */
export interface VisualCaptureEvidenceReaders {
  atmosphereFieldAlphaAt(x: number, y: number): number;
  liquidFieldAlphaAt(x: number, y: number): number;
  emissionFieldAlphaAt(x: number, y: number): number;
  powderSurfaceAlphaAt(x: number, y: number): number;
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
